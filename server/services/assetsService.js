import { getQuery } from '../db.js';

export const AssetService = {
  getHoldingsByDate: async (date) => {
    if (!date) throw { statusCode: 400, message: 'Date required' };

    const allAssets = await getQuery('SELECT id, name, type FROM assets');

    if (allAssets.length === 0) {
      return { date, assets: [] };
    }

    const allAssetIds = allAssets.map(a => a.id);
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
    
    const holdingsMap = new Map(holdings.map(h => [h.assetId, h]));

    const assets = await Promise.all(allAssets.map(async (asset) => {
      const h = holdingsMap.get(asset.id);
      const quantity = h ? h.quantity : 0;
      const totalCost = h ? h.totalCost : 0;

      const priceRow = await getQuery(`
        SELECT price FROM market_prices 
        WHERE asset_id = ? AND date <= ? 
        ORDER BY date DESC LIMIT 1
      `, [asset.id, date]);

      let unitPrice = priceRow.length > 0 ? priceRow[0].price : 0;
      if (unitPrice === 0 && (asset.type === 'fixed' || asset.type === 'wealth')) {
        unitPrice = 1;
      }

      return {
        assetId: asset.id,
        name: asset.name,
        category: asset.type,
        quantity: quantity,
        totalCost: totalCost,
        unitPrice: unitPrice
      };
    }));

    return { date, assets };
  }
};
