/**
 * InvestTrack 数据填充脚本 (Seed Data)
 * 
 * 用途：通过调用本地 API 生成模拟的测试数据，包括资产、策略和半年的历史账本。
 * 运行：确保 server 启动后，执行 `node scripts/seed_data.js [backup.json]`
 * - 不带参数：使用内置的 MOCK_ASSETS 等模拟数据
 * - 带参数：从指定的 JSON 文件导入数据（格式同 /api/export/backup 导出的格式）
 */

import fs from 'fs';

const API_BASE = 'http://localhost:3001/api';

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const MOCK_ASSETS = [
    { name: '沪深300ETF', type: 'fund', ticker: '510300', note: 'A股核心宽基' },
    { name: '纳指100ETF', type: 'fund', ticker: '513100', note: '美股科技成长' },
    { name: '腾讯控股', type: 'security', ticker: '00700.HK', note: '港股互联网龙头' },
    { name: '招商银行理财', type: 'wealth', ticker: '', note: 'R2稳健型' },
    { name: '实物黄金', type: 'gold', ticker: '', note: '避险资产' },
    { name: 'Bitcoin', type: 'crypto', ticker: 'BTC', note: '数字黄金' },
    { name: '备用金(余额宝)', type: 'fixed', ticker: '', note: '流动资金' }
];

const MOCK_STRATEGY = {
    name: '2024 全球配置策略 (模拟)',
    description: '# 核心思想\n\n本策略采用 **核心-卫星** 架构。\n\n- **稳健层 (40%)**: 确定的收益，抗跌。\n- **进取层 (60%)**: 捕捉中美科技成长的红利。',
    startDate: '2024-01-01',
    status: 'active',
    layers: [
        {
            id: generateId(),
            name: '第一层：稳健底仓',
            weight: 40,
            description: '提供安全垫，随时可用的流动性',
            items: [
                { id: generateId(), assetId: 'ASSET_ID_1', targetName: '招商银行理财', weight: 20, color: '#64748b', note: '长期理财' },
                { id: generateId(), assetId: 'ASSET_ID_2', targetName: '备用金(余额宝)', weight: 10, color: '#94a3b8', note: '随时取用' },
                { id: generateId(), assetId: 'ASSET_ID_3', targetName: '实物黄金', weight: 10, color: '#f59e0b', note: '抗通胀' }
            ]
        },
        {
            id: generateId(),
            name: '第二层：进取成长',
            weight: 60,
            description: '主要收益来源',
            items: [
                { id: generateId(), assetId: 'ASSET_ID_4', targetName: '沪深300ETF', weight: 20, color: '#ef4444', note: '做多中国' },
                { id: generateId(), assetId: 'ASSET_ID_5', targetName: '纳指100ETF', weight: 20, color: '#3b82f6', note: 'AI 浪潮' },
                { id: generateId(), assetId: 'ASSET_ID_6', targetName: '腾讯控股', weight: 10, color: '#8b5cf6', note: '低估值反弹' },
                { id: generateId(), assetId: 'ASSET_ID_7', targetName: 'Bitcoin', weight: 10, color: '#f97316', note: '非对称收益' }
            ]
        }
    ]
};

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

const runWithMockData = async () => {
    console.log("🚀 开始生成测试数据（内置模拟数据）...");

    const assetMap = {};
    
    for (const asset of MOCK_ASSETS) {
        const res = await post('/assets', asset);
        assetMap[asset.name] = { id: res.data.id, type: asset.type, name: asset.name };
        console.log(`   ✅ 创建资产: ${asset.name}`);
    }

    const strategyPayload = JSON.parse(JSON.stringify(MOCK_STRATEGY));
    strategyPayload.layers.forEach(layer => {
        layer.items.forEach(item => {
            if (item.targetName && assetMap[item.targetName]) {
                item.assetId = assetMap[item.targetName].id;
                console.log(`   🔄 替换 ${item.targetName}: ${assetMap[item.targetName].id}`);
            }
        });
    });
    await post('/strategies', strategyPayload);
    console.log("   ✅ 策略创建成功");

    let marketState = {
        [assetMap['沪深300ETF'].id]: { price: 3.5, quantity: 10000, totalCost: 35000 },
        [assetMap['纳指100ETF'].id]: { price: 1.2, quantity: 20000, totalCost: 24000 },
        [assetMap['腾讯控股'].id]: { price: 280, quantity: 200, totalCost: 56000 },
        [assetMap['招商银行理财'].id]: { price: 1.0, quantity: 50000, totalCost: 50000 },
        [assetMap['实物黄金'].id]: { price: 480, quantity: 50, totalCost: 24000 },
        [assetMap['Bitcoin'].id]: { price: 450000, quantity: 0.1, totalCost: 45000 },
        [assetMap['备用金(余额宝)'].id]: { price: 1.0, quantity: 20000, totalCost: 20000 }
    };

    const months = ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'];
    const notes = [
        "建仓完成，期待今年表现。", 
        "美股持续新高，但这部分仓位不动。", 
        "A股这就3000点保卫战了？加仓！", 
        "黄金涨疯了，稍微止盈了一点。", 
        "发奖金了，买入一点理财。", 
        "半年总结：整体跑赢通胀，继续保持。"
    ];

    for (let i = 0; i < months.length; i++) {
        const month = months[i];
        const snapshotAssets = [];
        let totalValue = 0, totalInvested = 0;

        for (const [name, info] of Object.entries(assetMap)) {
            const state = marketState[info.id];
            const isFixed = name.includes('理财') || name.includes('余额宝');
            
            if (!isFixed) {
                const change = 1 + (Math.random() * 0.13 - 0.05);
                state.price = parseFloat((state.price * change).toFixed(4));
            }

            let addedQ = 0, addedC = 0, txNote = "";
            if (i === 0) {
                addedQ = state.quantity;
                addedC = state.totalCost;
                txNote = "初始建仓";
            } else if (Math.random() > 0.7) {
                if (isFixed) {
                    addedQ = 5000; addedC = 5000;
                    state.quantity += 5000; state.totalCost += 5000;
                    txNote = "定期存款";
                } else {
                    addedC = 2000; addedQ = 2000 / state.price;
                    state.quantity += addedQ; state.totalCost += 2000;
                    txNote = "定投扣款";
                }
            }

            totalValue += state.quantity * state.price;
            totalInvested += state.totalCost;

            snapshotAssets.push({
                id: generateId(),
                assetId: info.id,
                name: info.name,
                category: info.type,
                unitPrice: state.price,
                quantity: state.quantity,
                marketValue: state.quantity * state.price,
                totalCost: state.totalCost,
                addedPrincipal: addedC,
                addedQuantity: addedQ,
                note: txNote
            });
        }

        await post('/snapshots', {
            date: month,
            note: `# ${month} 投资笔记\n\n${notes[i]}`,
            assets: snapshotAssets,
            totalValue, totalInvested
        });
        console.log(`   ✅ 生成账本: ${month}`);
    }

    console.log("\n🎉 测试数据生成完毕！");
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

    const { assets, strategies, snapshots } = backupData;
    
    const pricesCount = isNewFormat 
        ? assets?.reduce((sum, a) => sum + (a.prices?.length || 0), 0) 
        : snapshots?.prices?.length || 0;
    
    const transactionsCount = isNewFormat
        ? snapshots?.reduce((sum, s) => sum + (s.transactions?.length || 0), 0)
        : snapshots?.transactions?.length || 0;

    console.log(`📦 资产: ${assets?.length || 0}`);
    console.log(`📦 策略: ${strategies?.length || 0}`);
    console.log(`📦 快照: ${snapshots?.length || 0}`);
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
    console.log(`   - 快照: ${result.snapshots}`);
};

const run = async () => {
    const args = process.argv.slice(2);
    const backupFile = args[0];

    if (backupFile) {
        await runWithBackupFile(backupFile);
    } else {
        await runWithMockData();
    }
};

run();
