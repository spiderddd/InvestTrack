/**
 * Test fixtures based on example.json data
 * Used for API integration testing
 */

// 基于 scripts/example.json 的预期数据
export const exampleAssets = [
  { name: '沪深300ETF', type: 'fund', ticker: '510300', note: 'A股核心宽基' },
  { name: '纳指100ETF', type: 'fund', ticker: '513100', note: '美股科技成长' },
  { name: '腾讯控股', type: 'security', ticker: '00700.HK', note: '港股互联网龙头' },
  { name: '招商银行理财', type: 'wealth', ticker: '', note: 'R2稳健型' },
  { name: '实物黄金', type: 'gold', ticker: '', note: '避险资产' },
  { name: 'Bitcoin', type: 'crypto', ticker: 'BTC', note: '数字黄金' },
  { name: '备用金(余额宝)', type: 'fixed', ticker: '', note: '流动资金' }
];

// 2024-06价格数据
export const examplePrices = {
  '2024-06': {
    '沪深300ETF': 3.3277,
    '纳指100ETF': 1.16,
    '腾讯控股': 367.4824,
    '招商银行理财': 1,
    '实物黄金': 490.8873,
    'Bitcoin': 572585.2491,
    '备用金(余额宝)': 1
  }
};

// 预期最终持仓（基于所有transactions累计）
export const expectedHoldings = {
  '沪深300ETF': { quantity: 10582.6317, cost: 37000 },
  '纳指100ETF': { quantity: 21724.1379, cost: 26000 },
  '腾讯控股': { quantity: 205.6434, cost: 58000 },
  '招商银行理财': { quantity: 55000, cost: 55000 },
  '实物黄金': { quantity: 61.9056, cost: 30000 },
  'Bitcoin': { quantity: 0.1079, cost: 49000 },
  '备用金(余额宝)': { quantity: 20060, cost: 20000 }
};

// 预期2024-06-30的市值（价格 × 数量）
export const expectedMarketValues = {
  '沪深300ETF': 35215.82,
  '纳指100ETF': 25200.00,
  '腾讯控股': 75570.33,
  '招商银行理财': 55000.00,
  '实物黄金': 30388.67,
  'Bitcoin': 61781.95,
  '备用金(余额宝)': 20060.00
};

// 预期汇总数据
export const expectedSummary = {
  totalInvested: 275000,
  totalValue: 303216.77,
  profit: 28216.77,
  returnRate: 10.26
};

// 策略配置预期
export const expectedStrategy = {
  name: '2024 全球配置策略 (模拟)',
  layerCount: 2,
  totalTargets: 7,
  layers: [
    { name: '第一层：稳健底仓', weight: 40 },
    { name: '第二层：进取成长', weight: 60 }
  ]
};

// 月度报表预期
export const expectedStatements = [
  { date: '2024-06-30', totalInvested: 4000 },
  { date: '2024-05-31', totalInvested: 13000 },
  { date: '2024-04-30', totalInvested: 2000 },
  { date: '2024-03-31', totalInvested: 0 },
  { date: '2024-02-29', totalInvested: 2000 },
  { date: '2024-01-31', totalInvested: 254000 }
];

/**
 * 获取资产名称映射
 */
export function getAssetNameByType(type) {
  return exampleAssets.filter(a => a.type === type).map(a => a.name);
}

/**
 * 计算预期市值（带容错）
 */
export function calculateExpectedValue(assetName, tolerance = 0.01) {
  const qty = expectedHoldings[assetName]?.quantity || 0;
  const price = examplePrices['2024-06'][assetName] || 0;
  return qty * price;
}

/**
 * 验证数值是否在容错范围内
 */
export function isCloseTo(actual, expected, tolerance = 0.01) {
  return Math.abs(actual - expected) <= tolerance;
}
