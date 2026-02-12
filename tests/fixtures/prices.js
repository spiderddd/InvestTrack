/**
 * Test fixtures for prices
 * Historical prices for assets
 */

export const testPrices = [
  // 腾讯控股 (asset-stock-1)
  { asset_id: 'asset-stock-1', date: '2024-01-31', price: 300 },
  { asset_id: 'asset-stock-1', date: '2024-02-29', price: 320 },
  { asset_id: 'asset-stock-1', date: '2024-03-31', price: 310 },
  { asset_id: 'asset-stock-1', date: '2024-04-30', price: 330 },
  { asset_id: 'asset-stock-1', date: '2024-05-31', price: 350 },
  { asset_id: 'asset-stock-1', date: '2024-06-30', price: 340 },
  
  // 贵州茅台 (asset-stock-2)
  { asset_id: 'asset-stock-2', date: '2024-01-31', price: 2000 },
  { asset_id: 'asset-stock-2', date: '2024-02-29', price: 2100 },
  { asset_id: 'asset-stock-2', date: '2024-03-31', price: 2050 },
  { asset_id: 'asset-stock-2', date: '2024-04-30', price: 2200 },
  { asset_id: 'asset-stock-2', date: '2024-05-31', price: 2300 },
  { asset_id: 'asset-stock-2', date: '2024-06-30', price: 2250 },
  
  // 沪深300ETF (asset-fund-1)
  { asset_id: 'asset-fund-1', date: '2024-03-31', price: 4.0 },
  { asset_id: 'asset-fund-1', date: '2024-04-30', price: 4.1 },
  { asset_id: 'asset-fund-1', date: '2024-05-31', price: 4.2 },
  { asset_id: 'asset-fund-1', date: '2024-06-30', price: 4.15 },
  
  // 黄金ETF (asset-gold-1) - 每克价格
  { asset_id: 'asset-gold-1', date: '2024-04-30', price: 200 },
  { asset_id: 'asset-gold-1', date: '2024-05-31', price: 210 },
  { asset_id: 'asset-gold-1', date: '2024-06-30', price: 205 },
  
  // 余额宝和定期存款固定为1
  { asset_id: 'asset-cash-1', date: '2024-01-31', price: 1 },
  { asset_id: 'asset-cash-1', date: '2024-02-29', price: 1 },
  { asset_id: 'asset-cash-1', date: '2024-03-31', price: 1 },
  { asset_id: 'asset-cash-1', date: '2024-04-30', price: 1 },
  { asset_id: 'asset-cash-1', date: '2024-05-31', price: 1 },
  { asset_id: 'asset-cash-1', date: '2024-06-30', price: 1 },
  
  { asset_id: 'asset-fixed-1', date: '2024-02-29', price: 1 },
  { asset_id: 'asset-fixed-1', date: '2024-03-31', price: 1 },
  { asset_id: 'asset-fixed-1', date: '2024-04-30', price: 1 },
  { asset_id: 'asset-fixed-1', date: '2024-05-31', price: 1 },
  { asset_id: 'asset-fixed-1', date: '2024-06-30', price: 1 }
];

/**
 * Get latest price for an asset up to a date
 */
export function getLatestPrice(assetId, upToDate) {
  const relevantPrices = testPrices.filter(
    p => p.asset_id === assetId && p.date <= upToDate
  );
  
  if (relevantPrices.length === 0) return null;
  
  // Sort by date descending and return the first (latest)
  return relevantPrices.sort((a, b) => b.date.localeCompare(a.date))[0];
}

/**
 * Get price history for an asset
 */
export function getPriceHistory(assetId) {
  return testPrices
    .filter(p => p.asset_id === assetId)
    .sort((a, b) => a.date.localeCompare(b.date));
}
