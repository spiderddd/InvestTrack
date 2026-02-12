/**
 * Test fixtures for assets
 * Based on actual data structure from the application
 */

export const testAssets = [
  {
    id: 'asset-stock-1',
    name: '腾讯控股',
    category: 'security',
    ticker: '00700'
  },
  {
    id: 'asset-stock-2',
    name: '贵州茅台',
    category: 'security',
    ticker: '600519'
  },
  {
    id: 'asset-fund-1',
    name: '沪深300ETF',
    category: 'fund',
    ticker: '510300'
  },
  {
    id: 'asset-cash-1',
    name: '余额宝',
    category: 'wealth',
    ticker: null
  },
  {
    id: 'asset-fixed-1',
    name: '定期存款',
    category: 'fixed',
    ticker: null
  },
  {
    id: 'asset-gold-1',
    name: '黄金ETF',
    category: 'gold',
    ticker: null
  }
];

export const assetCategories = {
  stock: ['security', 'fund'],
  cashBond: ['fixed', 'wealth'],
  alternative: ['gold', 'crypto']
};

/**
 * Get asset by ID
 */
export function getAssetById(id) {
  return testAssets.find(a => a.id === id);
}

/**
 * Get assets by category
 */
export function getAssetsByCategory(category) {
  return testAssets.filter(a => a.category === category);
}
