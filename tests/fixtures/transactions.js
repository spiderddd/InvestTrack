/**
 * Test fixtures for transactions
 * Links assets to statements with quantity and cost changes
 */

export const testTransactions = [
  // 2024-01: 初始建仓
  { statement_id: 'stmt-2024-01', statement_date: '2024-01-31', asset_id: 'asset-stock-1', quantity_change: 100, cost_change: 30000 },
  { statement_id: 'stmt-2024-01', statement_date: '2024-01-31', asset_id: 'asset-stock-2', quantity_change: 10, cost_change: 20000 },
  { statement_id: 'stmt-2024-01', statement_date: '2024-01-31', asset_id: 'asset-cash-1', quantity_change: 10000, cost_change: 10000 },
  
  // 2024-02: 加仓
  { statement_id: 'stmt-2024-02', statement_date: '2024-02-29', asset_id: 'asset-stock-1', quantity_change: 50, cost_change: 16000 },
  { statement_id: 'stmt-2024-02', statement_date: '2024-02-29', asset_id: 'asset-fixed-1', quantity_change: 5000, cost_change: 5000 },
  
  // 2024-03: 调仓
  { statement_id: 'stmt-2024-03', statement_date: '2024-03-31', asset_id: 'asset-stock-1', quantity_change: -30, cost_change: -9000 }, // 卖出
  { statement_id: 'stmt-2024-03', statement_date: '2024-03-31', asset_id: 'asset-fund-1', quantity_change: 2000, cost_change: 8000 },
  
  // 2024-04: 继续加仓
  { statement_id: 'stmt-2024-04', statement_date: '2024-04-30', asset_id: 'asset-gold-1', quantity_change: 50, cost_change: 10000 },
  { statement_id: 'stmt-2024-04', statement_date: '2024-04-30', asset_id: 'asset-cash-1', quantity_change: 5000, cost_change: 5000 },
  
  // 2024-05: 卖出盈利
  { statement_id: 'stmt-2024-05', statement_date: '2024-05-31', asset_id: 'asset-stock-2', quantity_change: -5, cost_change: -10000 },
  
  // 2024-06: 平衡调整
  { statement_id: 'stmt-2024-06', statement_date: '2024-06-30', asset_id: 'asset-stock-1', quantity_change: 20, cost_change: 7000 },
  { statement_id: 'stmt-2024-06', statement_date: '2024-06-30', asset_id: 'asset-fixed-1', quantity_change: 3000, cost_change: 3000 }
];

/**
 * Get transactions by statement ID
 */
export function getTransactionsByStatementId(statementId) {
  return testTransactions.filter(t => t.statement_id === statementId);
}

/**
 * Get transactions by asset ID
 */
export function getTransactionsByAssetId(assetId) {
  return testTransactions.filter(t => t.asset_id === assetId);
}

/**
 * Get cumulative position for an asset up to a date
 * Returns { quantity, cost }
 */
export function getCumulativePosition(assetId, upToDate) {
  const relevantTxs = testTransactions.filter(
    t => t.asset_id === assetId && t.statement_date <= upToDate
  );
  
  return relevantTxs.reduce(
    (acc, t) => ({
      quantity: acc.quantity + t.quantity_change,
      cost: acc.cost + t.cost_change
    }),
    { quantity: 0, cost: 0 }
  );
}
