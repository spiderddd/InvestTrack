/**
 * InvestTrack 数据填充脚本 (Seed Data)
 *
 * 用途：通过调用本地 API 生成模拟的测试数据，包括资产、策略和半年的历史账本。
 * 运行：确保 server 启动后，执行 `node scripts/seed_data.js [backup.json]`
 * - 不带参数：使用 scripts/example.json 作为默认数据
 * - 带参数：从指定的 JSON 文件导入数据（格式同 /api/export/backup 导出的格式）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const API_BASE = 'http://localhost:3001/api';

// 获取当前文件目录（ESM 兼容）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const post = async (endpoint, data) => {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`API Error ${res.status}: ${err}`);
        }
        return await res.json();
    } catch (error) {
        console.error(`❌ 请求失败 [${endpoint}]:`, error.message);
        process.exit(1);
    }
};

const runWithBackupFile = async (filePath) => {
    if (!fs.existsSync(filePath)) {
        console.error(`❌ 文件不存在: ${filePath}`);
        process.exit(1);
    }

    const backupData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (!backupData._meta || backupData._meta.type !== 'invest_track_backup') {
        console.error("❌ 无效的备份文件格式");
        process.exit(1);
    }

    const isNewFormat = backupData._meta.version === "2.0";

    console.log(`🚀 从备份文件导入数据: ${filePath}`);
    console.log(`📅 导出时间: ${backupData._meta.exportedAt}`);
    console.log(`📦 版本: ${backupData._meta.version} (${isNewFormat ? '精简版' : '旧版'})`);

    const { assets, strategies, monthlyStatements } = backupData;

    const pricesCount = isNewFormat
        ? assets?.reduce((sum, a) => sum + (a.prices?.length || 0), 0)
        : monthlyStatements?.prices?.length || 0;

    const transactionsCount = isNewFormat
        ? monthlyStatements?.reduce((sum, s) => sum + (s.transactions?.length || 0), 0)
        : monthlyStatements?.transactions?.length || 0;

    console.log(`📦 资产: ${assets?.length || 0}`);
    console.log(`📦 策略: ${strategies?.length || 0}`);
    console.log(`📦 月度账单: ${monthlyStatements?.length || 0}`);
    console.log(`📦 市价记录: ${pricesCount}`);
    console.log(`📦 交易记录: ${transactionsCount}`);

    const res = await fetch(`${API_BASE}/export/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupData)
    });

    if (!res.ok) {
        const err = await res.text();
        console.error(`❌ 导入失败: ${err}`);
        process.exit(1);
    }

    const result = await res.json();
    console.log("\n🎉 导入成功！");
    console.log(`   - 资产: ${result.assets}`);
    console.log(`   - 策略: ${result.strategies}`);
    console.log(`   - 月度账单: ${result.monthlyStatements}`);
};

const run = async () => {
    const args = process.argv.slice(2);
    const backupFile = args[0] || path.join(__dirname, 'example.json');

    await runWithBackupFile(backupFile);
};

run();
