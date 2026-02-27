import { getQuery } from '../db.js';

export const AssetService = {
  getHoldingsByDate: async (date) => {
    if (!date) throw { statusCode: 400, message: 'Date required' };

    const allAssetIds = await AssetService.getAllAssetIds();

    if (allAssetIds.length === 0) {
      return { date, assets: [] };
    }

    const placeholders = allAssetIds.map(() => '?').join(',');
    const holdingsSql = `
      SELECT 
        t.asset_id as assetId,
        SUM(t.quantity_change) as quantity,
        SUM(t.cost_change) as totalCost
      FROM transactions t
      WHERE t.date <= ? AND t.asset_id IN (${placeholders})
      GROUP BY t.asset_id
    `;
    const holdings = await getQuery(holdingsSql, [date, ...allAssetIds]);

    const assets = await Promise.all(holdings.map(async (h) => {
      const assetInfo = await getQuery('SELECT name, type FROM assets WHERE id = ?', [h.assetId]);
      const meta = assetInfo[0] || { name: 'Unknown', type: 'other' };

      const priceRow = await getQuery(`
        SELECT price FROM market_prices 
        WHERE asset_id = ? AND date <= ? 
        ORDER BY date DESC LIMIT 1
      `, [h.assetId, date]);

      let unitPrice = priceRow.length > 0 ? priceRow[0].price : 0;
      if (unitPrice === 0 && (meta.type === 'fixed' || meta.type === 'wealth')) {
        unitPrice = 1;
      }

      return {
        assetId: h.assetId,
        name: meta.name,
        category: meta.type,
        quantity: h.quantity,
        totalCost: h.totalCost,
        unitPrice: unitPrice
      };
    }));

    return { date, assets };
  },

  getAllAssetIds: async () => {
    const transactionAssetIds = await getQuery('SELECT DISTINCT asset_id FROM transactions');
    const strategyAssetIds = await getQuery(`
      SELECT DISTINCT asset_id FROM strategy_targets 
      WHERE layer_id IN (
        SELECT id FROM strategy_layers WHERE version_id = (
          SELECT id FROM strategy_versions WHERE status = 'active'
        )
      )
    `);

    const allIds = [
      ...transactionAssetIds.map(r => r.asset_id),
      ...strategyAssetIds.map(r => r.asset_id)
    ];
    return [...new Set(allIds)];
  }
};
