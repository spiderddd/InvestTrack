/**
 * InvestTrack 数据填充脚本 (Seed Data)
 * 
 * 用途：通过调用本地 API 生成模拟的测试数据，包括资产、策略和半年的历史账本。
 * 运行：确保 server 启动后，执行 `node scripts/seed_data.js`
 */

const API_BASE = 'http://localhost:3001/api';

// 模拟数据配置
const MOCK_ASSETS = [
    { name: '沪深300ETF', type: 'fund', ticker: '510300', note: 'A股核心宽基' },
    { name: '纳指100ETF', type: 'fund', ticker: '513100', note: '美股科技成长' },
    { name: '腾讯控股', type: 'security', ticker: '00700.HK', note: '港股互联网龙头' },
    { name: '招商银行理财', type: 'wealth', ticker: '', note: 'R2稳健型' },
    { name: '实物黄金', type: 'gold', ticker: '', note: '避险资产' },
    { name: 'Bitcoin', type: 'crypto', ticker: 'BTC', note: '数字黄金' },
    { name: '备用金(余额宝)', type: 'fixed', ticker: '', note: '流动资金' }
];

// 辅助函数：API 请求
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

const run = async () => {
    console.log("🚀 开始生成测试数据...");
    console.log(`📡 连接 API: ${API_BASE}`);

    // 1. 创建资产
    console.log("\n📦 步骤 1: 创建资产...");
    const assetMap = {}; // name -> id
    
    for (const asset of MOCK_ASSETS) {
        const res = await post('/assets', asset);
        assetMap[asset.name] = res.id;
        console.log(`   ✅ 创建资产: ${asset.name}`);
    }

    // 2. 创建策略
    console.log("\nStrategy 步骤 2: 创建策略...");
    const strategyPayload = {
        name: '2024 全球配置策略 (模拟)',
        description: '# 核心思想\n\n本策略采用 **核心-卫星** 架构。\n\n- **稳健层 (40%)**: 确定的收益，抗跌。\n- **进取层 (60%)**: 捕捉中美科技成长的红利。',
        startDate: '2024-01-01',
        status: 'active',
        layers: [
            {
                name: '第一层：稳健底仓',
                weight: 40,
                description: '提供安全垫，随时可用的流动性',
                items: [
                    { assetId: assetMap['招商银行理财'], weight: 20, color: '#64748b', note: '长期理财' },
                    { assetId: assetMap['备用金(余额宝)'], weight: 10, color: '#94a3b8', note: '随时取用' },
                    { assetId: assetMap['实物黄金'], weight: 10, color: '#f59e0b', note: '抗通胀' }
                ]
            },
            {
                name: '第二层：进取成长',
                weight: 60,
                description: '主要收益来源',
                items: [
                    { assetId: assetMap['沪深300ETF'], weight: 20, color: '#ef4444', note: '做多中国' },
                    { assetId: assetMap['纳指100ETF'], weight: 20, color: '#3b82f6', note: 'AI 浪潮' },
                    { assetId: assetMap['腾讯控股'], weight: 10, color: '#8b5cf6', note: '低估值反弹' },
                    { assetId: assetMap['Bitcoin'], weight: 10, color: '#f97316', note: '非对称收益' }
                ]
            }
        ]
    };
    await post('/strategies', strategyPayload);
    console.log("   ✅ 策略创建成功");

    // 3. 生成历史快照 (模拟过去6个月)
    console.log("\n📅 步骤 3: 生成历史月度账本 (模拟流水与波动)...");

    // 初始价格与持仓 (1月份建仓)
    let marketState = {
        [assetMap['沪深300ETF']]: { price: 3.5, quantity: 10000 },
        [assetMap['纳指100ETF']]: { price: 1.2, quantity: 20000 },
        [assetMap['腾讯控股']]: { price: 280, quantity: 200 },
        [assetMap['招商银行理财']]: { price: 1.0, quantity: 50000 },
        [assetMap['实物黄金']]: { price: 480, quantity: 50 },
        [assetMap['Bitcoin']]: { price: 450000, quantity: 0.1 },
        [assetMap['备用金(余额宝)']]: { price: 1.0, quantity: 20000 }
    };

    const months = ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'];

    for (let i = 0; i < months.length; i++) {
        const month = months[i];
        const isInit = i === 0; // 是否是建仓月
        const snapshotAssets = [];
        
        // 随机生成本月笔记
        const notes = [
            "建仓完成，期待今年表现。", 
            "美股持续新高，但这部分仓位不动。", 
            "A股这就3000点保卫战了？加仓！", 
            "黄金涨疯了，稍微止盈了一点。", 
            "发奖金了，买入一点理财。", 
            "半年总结：整体跑赢通胀，继续保持。"
        ];

        for (const [name, id] of Object.entries(assetMap)) {
            const state = marketState[id];
            
            // 1. 模拟价格波动 (-5% 到 +8%)
            const isFixed = name.includes('理财') || name.includes('余额宝');
            if (!isFixed) {
                const change = 1 + (Math.random() * 0.13 - 0.05); 
                state.price = parseFloat((state.price * change).toFixed(4));
            }

            // 2. 模拟交易流水
            let addedQ = 0;
            let addedC = 0;
            let txNote = ""; 

            if (isInit) {
                addedQ = state.quantity;
                addedC = state.quantity * state.price;
                txNote = "初始建仓";
            } else {
                const rand = Math.random();
                if (rand > 0.7) {
                    if (isFixed) {
                        const deposit = 5000;
                        addedQ = deposit; 
                        addedC = deposit;
                        state.quantity += deposit;
                        txNote = Math.random() > 0.5 ? "定期存款" : "发工资存入";
                    } else {
                        const cost = 2000;
                        const q = cost / state.price;
                        addedQ = q;
                        addedC = cost;
                        state.quantity += q;
                        txNote = Math.random() > 0.5 ? "看好后市加仓" : "定投扣款";
                    }
                } else if (isFixed && rand < 0.2) {
                    const interest = state.quantity * 0.003;
                    addedQ = interest;
                    addedC = 0;
                    state.quantity += interest;
                }
            }

            snapshotAssets.push({
                assetId: id,
                unitPrice: state.price,
                addedQuantity: addedQ,
                addedPrincipal: addedC,
                note: txNote
            });
        }

        const payload = {
            date: month,
            note: `# ${month} 投资笔记\n\n${notes[i]}`,
            assets: snapshotAssets
        };

        await post('/snapshots', payload);
        console.log(`   ✅ 生成账本: ${month}`);
    }

    console.log("\n🎉 所有数据生成完毕！请刷新前端页面查看效果。");
};

run();