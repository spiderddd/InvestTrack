/**
 * Test fixtures entry point
 * Export all test data for use in tests
 */

export { testAssets, assetCategories, getAssetById, getAssetsByCategory } from './assets.js';
export { testStrategies, getStrategyById, getActiveStrategies } from './strategies.js';
export { testStatements, getStatementById, getStatementsByDateRange } from './statements.js';
export { 
  testTransactions, 
  getTransactionsByStatementId, 
  getTransactionsByAssetId,
  getCumulativePosition 
} from './transactions.js';
export { testPrices, getLatestPrice, getPriceHistory } from './prices.js';

// Example data fixtures (based on scripts/example.json)
export {
  exampleAssets,
  examplePrices,
  expectedHoldings,
  expectedMarketValues,
  expectedSummary,
  expectedStrategy,
  expectedStatements,
  getAssetNameByType,
  calculateExpectedValue,
  isCloseTo
} from './example-data.js';
