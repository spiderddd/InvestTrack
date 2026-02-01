
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 配置 ---
const JSON_FILE = 'data_export.json'; // 你的导出文件名
const DB_PATH = path.join(__dirname, 'data', 'invest_track_v2.db'); // 目标数据库路径

// 检查文件是否存在
if (!fs.existsSync(JSON_FILE)) {
    console.error(`❌ 未找到数据文件: ${JSON_FILE}`);
    console.error(`请将导出的JSON文件重命名为 "${JSON_FILE}" 并放在项目根目录下。`);
    process.exit(1);
}

// 读取 JSON
console.log(`📖 读取 ${JSON_FILE}...`);
const rawData = fs.readFileSync(JSON_FILE, 'utf8');
const data = JSON.parse(rawData);

if (!data.tables) {
    console.error("❌ JSON 格式错误: 缺少 'tables' 字段。请确保使用的是符合文档描述的导出文件。");
    process.exit(1);
}

// 连接数据库
const db = new sqlite3.Database(DB_PATH);

console.log(`🔌 连接到数据库: ${DB_PATH}`);

db.serialize(() => {
    // 开启外键约束
    db.run("PRAGMA foreign_keys = OFF"); // 暂时关闭外键以便清空数据
    db.run("BEGIN TRANSACTION");

    try {
        // 1. 清空现有数据 (顺序很重要)
        console.log("🧹 清空现有表数据...");
        db.run("DELETE FROM transactions");
        db.run("DELETE FROM market_prices");
        db.run("DELETE FROM snapshots");
        db.run("DELETE FROM strategy_targets");
        db.run("DELETE FROM strategy_layers");
        db.run("DELETE FROM strategy_versions");
        db.run("DELETE FROM assets");

        const tables = data.tables;
        const now = Date.now();

        // 2. 导入 Assets (资产表)
        if (tables.assets && tables.assets.length > 0) {
            console.log(`📥 导入 Assets (${tables.assets.length} 条)...`);
            const stmt = db.prepare("INSERT INTO assets (id, type, name, ticker, note, created_at) VALUES (?, ?, ?, ?, ?, ?)");
            tables.assets.forEach(row => {
                stmt.run(
                    row.id,
                    row.type,
                    row.name,
                    row.ticker || null,
                    row.note || null,
                    row.created_at || now
                );
            });
            stmt.finalize();
        }

        // 3. 导入 Strategy Versions (策略版本)
        if (tables.strategy_versions && tables.strategy_versions.length > 0) {
            console.log(`📥 导入 Strategy Versions (${tables.strategy_versions.length} 条)...`);
            const stmt = db.prepare("INSERT INTO strategy_versions (id, name, description, start_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?)");
            tables.strategy_versions.forEach(row => {
                stmt.run(
                    row.id,
                    row.name,
                    row.description || '',
                    row.start_date,
                    row.status || 'active',
                    row.created_at || now
                );
            });
            stmt.finalize();
        }

        // 4. 导入 Strategy Layers (策略层级)
        if (tables.strategy_layers && tables.strategy_layers.length > 0) {
            console.log(`📥 导入 Strategy Layers (${tables.strategy_layers.length} 条)...`);
            const stmt = db.prepare("INSERT INTO strategy_layers (id, version_id, name, weight, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)");
            tables.strategy_layers.forEach(row => {
                stmt.run(
                    row.id,
                    row.version_id,
                    row.name,
                    row.weight,
                    row.description || '',
                    row.sort_order || 0
                );
            });
            stmt.finalize();
        }

        // 5. 导入 Strategy Targets (策略目标)
        if (tables.strategy_targets && tables.strategy_targets.length > 0) {
            console.log(`📥 导入 Strategy Targets (${tables.strategy_targets.length} 条)...`);
            const stmt = db.prepare("INSERT INTO strategy_targets (id, layer_id, asset_id, target_name, weight, color, note, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            tables.strategy_targets.forEach(row => {
                stmt.run(
                    row.id,
                    row.layer_id,
                    row.asset_id,
                    row.target_name || '', // 注意：original_asset_name 在导入时忽略，数据库里存的是 target_name
                    row.weight,
                    row.color || '#cbd5e1',
                    row.note || '',
                    row.sort_order || 0
                );
            });
            stmt.finalize();
        }

        // 6. 导入 Snapshots (快照)
        if (tables.snapshots && tables.snapshots.length > 0) {
            console.log(`📥 导入 Snapshots (${tables.snapshots.length} 条)...`);
            const stmt = db.prepare("INSERT INTO snapshots (id, date, total_value, total_invested, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
            tables.snapshots.forEach(row => {
                stmt.run(
                    row.id,
                    row.date,
                    row.total_value,
                    row.total_invested,
                    row.note || '',
                    row.created_at || now, // 假如导出没有时间戳，补充当前时间
                    row.updated_at || now
                );
            });
            stmt.finalize();
        }

        // 7. 导入 Transactions (如果有导出)
        if (tables.transactions && tables.transactions.length > 0) {
             console.log(`📥 导入 Transactions (${tables.transactions.length} 条)...`);
             const stmt = db.prepare(`
                INSERT INTO transactions (id, asset_id, snapshot_id, date, type, quantity_change, cost_change, note, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             `);
             tables.transactions.forEach(row => {
                stmt.run(
                    row.id,
                    row.asset_id,
                    row.snapshot_id,
                    row.date,
                    row.type,
                    row.quantity_change,
                    row.cost_change,
                    row.note,
                    row.created_at || now
                );
             });
             stmt.finalize();
        }

        // 8. 导入 Market Prices (如果有导出)
        if (tables.market_prices && tables.market_prices.length > 0) {
            console.log(`📥 导入 Market Prices (${tables.market_prices.length} 条)...`);
            const stmt = db.prepare(`
                INSERT INTO market_prices (id, asset_id, date, price, source, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            tables.market_prices.forEach(row => {
               stmt.run(
                   row.id,
                   row.asset_id,
                   row.date,
                   row.price,
                   row.source,
                   row.updated_at || now
               );
            });
            stmt.finalize();
       }

        db.run("PRAGMA foreign_keys = ON");
        db.run("COMMIT");
        console.log("✅ 数据导入成功！");

    } catch (err) {
        console.error("❌ 导入出错，正在回滚...");
        console.error(err);
        db.run("ROLLBACK");
    } finally {
        db.close();
    }
});
