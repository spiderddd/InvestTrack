
import { v4 as uuidv4 } from 'uuid';
import { runQuery, getQuery, withTransaction } from '../db.js';
import { lruCache } from '../utils/cache.js';

export const SnapshotService = {
    getList: async (page = 1, limit = 20) => {
        const offset = (page - 1) * limit;

        const [countResult, rows] = await Promise.all([
            getQuery("SELECT COUNT(*) as count FROM snapshots"),
            getQuery(`
                SELECT
                    s.id, s.date, s.note,
                    COALESCE(SUM(t.cost_change), 0) as totalInvested
                FROM snapshots s
                LEFT JOIN transactions t ON s.date = t.date
                GROUP BY s.id, s.date, s.note
                ORDER BY s.date DESC
                LIMIT ? OFFSET ?
            `, [limit, offset])
        ]);

        const total = countResult[0].count;
        const items = rows.map(r => ({
            id: r.id,
            date: r.date,
            note: r.note,
            totalInvested: r.totalInvested,
        }));
        return { items, total, page: parseInt(page), limit: parseInt(limit) };
    },

    calculateTotals: async (date) => {
        const cacheKey = `totals:${date}`;
        const cached = lruCache.get(cacheKey);
        if (cached) return cached;

        const holdingsSql = `
            SELECT t.asset_id, SUM(t.quantity_change) as quantity, SUM(t.cost_change) as totalCost
            FROM transactions t WHERE t.date <= ? GROUP BY t.asset_id
        `;
        const holdings = await getQuery(holdingsSql, [date]);
        
        let totalValue = 0;
        let totalInvested = 0;

        // Convert YYYY-MM to YYYY-MM-DD (last day of month) for price query
        const priceDate = date.length === 7 ? `${date}-31` : date;
        
        for (const h of holdings) {
            if (Math.abs(h.quantity) < 0.000001) continue;
            const priceRow = await getQuery(
                `SELECT price FROM market_prices WHERE asset_id=? AND date<=? ORDER BY date DESC LIMIT 1`,
                [h.asset_id, priceDate]
            );
            const price = priceRow.length > 0 ? priceRow[0].price : 0;
            totalValue += (h.quantity * price);
            totalInvested += h.totalCost;
        }

        const result = { totalValue, totalInvested };
        lruCache.set(cacheKey, result);
        return result;
    },

    // New: Lightweight list for dropdowns
    getDatesOnly: async () => {
        const rows = await getQuery("SELECT date FROM snapshots ORDER BY date DESC");
        return rows.map(r => r.date);
    },

    // Optimized: Get nearest previous snapshot without fetching full history list
    getPrevious: async (date) => {
        const sql = `
            SELECT id, date, note
            FROM snapshots
            WHERE date < ?
            ORDER BY date DESC
            LIMIT 1
        `;
        const rows = await getQuery(sql, [date]);
        if (rows.length === 0) return null;
        
        // Hydrate with details for the 'copy from previous' feature
        return await SnapshotService.getDetails(rows[0].id);
    },

    getHistoryGraph: async () => {
        const cacheKey = 'historyGraph';
        const cached = lruCache.get(cacheKey);
        if (cached) return cached;

        const snapshots = await getQuery("SELECT id, date FROM snapshots ORDER BY date ASC");
        const allTxs = await getQuery("SELECT asset_id, date, quantity_change, cost_change FROM transactions ORDER BY date ASC");
        const allPrices = await getQuery("SELECT asset_id, date, price FROM market_prices ORDER BY date ASC");
        
        const pricesByAsset = new Map();
        allPrices.forEach(p => {
             if (!pricesByAsset.has(p.asset_id)) pricesByAsset.set(p.asset_id, []);
             pricesByAsset.get(p.asset_id).push(p);
        });

        const runningState = new Map(); 
        let txCursor = 0;
        const totalTxs = allTxs.length;

        const result = snapshots.map(s => {
            const snapshotDate = s.date;
            
            while (txCursor < totalTxs && allTxs[txCursor].date <= snapshotDate) {
                const tx = allTxs[txCursor];
                if (!runningState.has(tx.asset_id)) {
                    runningState.set(tx.asset_id, { quantity: 0, cost: 0 });
                }
                const state = runningState.get(tx.asset_id);
                state.quantity += tx.quantity_change;
                state.cost += tx.cost_change;
                txCursor++;
            }

            const assetsWithPrice = [];
            let totalValue = 0;
            let totalInvested = 0;
            // Convert YYYY-MM to YYYY-MM-DD (last day of month) for price comparison
            const priceDate = snapshotDate.length === 7 ? `${snapshotDate}-31` : snapshotDate;
            for (const [assetId, state] of runningState.entries()) {
                if (Math.abs(state.quantity) < 0.000001) continue;
                const assetPrices = pricesByAsset.get(assetId) || [];
                let price = 0;
                for (let i = assetPrices.length - 1; i >= 0; i--) {
                    if (assetPrices[i].date <= priceDate) {
                        price = assetPrices[i].price;
                        break;
                    }
                }
                const marketValue = state.quantity * price;
                assetsWithPrice.push({
                    assetId: assetId,
                    quantity: state.quantity,
                    unitPrice: price,
                    marketValue: marketValue,
                    totalCost: state.cost
                });
                totalValue += marketValue;
                totalInvested += state.cost;
            }

            return {
                id: s.id,
                date: s.date,
                totalValue,
                totalInvested,
                assets: assetsWithPrice
            };
        });

        lruCache.set(cacheKey, result);
        return result;
    },

    getDetails: async (id) => {
        const headerRows = await getQuery("SELECT id, date, note FROM snapshots WHERE id = ?", [id]);
        if (headerRows.length === 0) throw { statusCode: 404, message: "Snapshot not found" };
        const snapshot = headerRows[0];
        const snapshotDate = snapshot.date;

        // Get totals from cache
        const totals = await SnapshotService.calculateTotals(snapshotDate);
        snapshot.totalValue = totals.totalValue;
        snapshot.totalInvested = totals.totalInvested;

        const holdingsSql = `
            SELECT 
                t.asset_id as assetId,
                SUM(t.quantity_change) as quantity,
                SUM(t.cost_change) as totalCost
            FROM transactions t
            WHERE t.date <= ?
            GROUP BY t.asset_id
            HAVING quantity != 0
        `;
        const holdings = await getQuery(holdingsSql, [snapshotDate]);

        // Fetch Note as well
        const flowSql = `SELECT asset_id, quantity_change, cost_change, note FROM transactions WHERE snapshot_id = ?`;
        const flows = await getQuery(flowSql, [id]);
        const flowMap = new Map();
        flows.forEach(f => flowMap.set(f.asset_id, { q: f.quantity_change, c: f.cost_change, n: f.note }));

        // Convert YYYY-MM to YYYY-MM-DD (last day of month) for price query
        const priceDate = snapshotDate.length === 7 ? `${snapshotDate}-31` : snapshotDate;
        
        const fullAssets = await Promise.all(holdings.map(async (h) => {
            const assetInfo = await getQuery("SELECT name, type FROM assets WHERE id = ?", [h.assetId]);
            const meta = assetInfo[0] || { name: 'Unknown', type: 'other' };

            const priceRow = await getQuery(`
                SELECT price FROM market_prices 
                WHERE asset_id = ? AND date <= ? 
                ORDER BY date DESC LIMIT 1
            `, [h.assetId, priceDate]);

            let unitPrice = priceRow.length > 0 ? priceRow[0].price : 0;
            if (unitPrice === 0 && (meta.type === 'fixed' || meta.type === 'wealth')) {
                unitPrice = 1;
            }

            const currentFlow = flowMap.get(h.assetId) || { q: 0, c: 0, n: '' };

            return {
                id: uuidv4(),
                assetId: h.assetId,
                name: meta.name,
                category: meta.type,
                unitPrice: unitPrice,
                quantity: h.quantity,
                marketValue: h.quantity * unitPrice,
                totalCost: h.totalCost,
                addedQuantity: currentFlow.q,
                addedPrincipal: currentFlow.c,
                note: currentFlow.n || ''
            };
        }));

        snapshot.assets = fullAssets;
        return snapshot;
    },

    // New helper for asset manager time travel (supports YYYY-MM or YYYY-MM-DD)
    getDetailsByDate: async (date) => {
        if (!date) throw { statusCode: 400, message: "Date required" };
        
        const isFullDate = date.length === 10;
        let snapshotDate = date;
        let priceDate = date;
        
        if (isFullDate) {
            // For YYYY-MM-DD, find the latest snapshot <= this date (compare YYYY-MM parts)
            const monthPart = date.slice(0, 7);  // YYYY-MM
            const snapshotRows = await getQuery(
                "SELECT id, date FROM snapshots WHERE date <= ? ORDER BY date DESC LIMIT 1",
                [monthPart]
            );
            if (snapshotRows.length === 0) {
                console.log(`[SnapshotService] No snapshot found <= ${monthPart}`);
                return null;
            }
            snapshotDate = snapshotRows[0].date;
            console.log(`[SnapshotService] Real-time view: date=${date}, using snapshot=${snapshotDate}`);
        }
        
        // Get the snapshot header
        const headerRows = await getQuery("SELECT id, date, note FROM snapshots WHERE date = ?", [snapshotDate]);
        if (headerRows.length === 0) {
            console.log(`[SnapshotService] Snapshot not found: ${snapshotDate}`);
            return null;
        }
        
        const snapshot = headerRows[0];
        const snapshotId = snapshot.id;
        
        // Calculate holdings up to the target date
        const holdingsSql = `
            SELECT 
                t.asset_id as assetId,
                SUM(t.quantity_change) as quantity,
                SUM(t.cost_change) as totalCost
            FROM transactions t
            WHERE t.date <= ?
            GROUP BY t.asset_id
            HAVING ABS(quantity) > 0.000001
        `;
        const holdings = await getQuery(holdingsSql, [priceDate]);
        console.log(`[SnapshotService] Holdings count for ${priceDate}: ${holdings.length}`);

        // Get snapshot-specific transactions for note/flow tracking (only for month view)
        let flowMap = new Map();
        if (!isFullDate) {
            const flowSql = `SELECT asset_id, quantity_change, cost_change, note FROM transactions WHERE snapshot_id = ?`;
            const flows = await getQuery(flowSql, [snapshotId]);
            flows.forEach(f => flowMap.set(f.asset_id, { q: f.quantity_change, c: f.cost_change, n: f.note }));
        }

        // Build assets with real-time prices
        const fullAssets = await Promise.all(holdings.map(async (h) => {
            const assetInfo = await getQuery("SELECT name, type FROM assets WHERE id = ?", [h.assetId]);
            const meta = assetInfo[0] || { name: 'Unknown', type: 'other' };

            const priceRow = await getQuery(`
                SELECT price FROM market_prices 
                WHERE asset_id = ? AND date <= ? 
                ORDER BY date DESC LIMIT 1
            `, [h.assetId, priceDate]);

            let unitPrice = priceRow.length > 0 ? priceRow[0].price : 0;
            if (unitPrice === 0 && (meta.type === 'fixed' || meta.type === 'wealth')) {
                unitPrice = 1;
            }

            // For real-time view, show 0 for addedQuantity/addedPrincipal (we're viewing, not editing)
            const currentFlow = isFullDate ? { q: 0, c: 0, n: '' } : (flowMap.get(h.assetId) || { q: 0, c: 0, n: '' });

            return {
                id: uuidv4(),
                assetId: h.assetId,
                name: meta.name,
                category: meta.type,
                unitPrice: unitPrice,
                quantity: h.quantity,
                marketValue: h.quantity * unitPrice,
                totalCost: h.totalCost,
                addedQuantity: currentFlow.q,
                addedPrincipal: currentFlow.c,
                note: currentFlow.n || ''
            };
        }));

        // Calculate totals
        const totalValue = fullAssets.reduce((sum, a) => sum + a.marketValue, 0);
        const totalInvested = fullAssets.reduce((sum, a) => sum + a.totalCost, 0);

        return {
            id: snapshotId,
            date: isFullDate ? priceDate : snapshotDate,
            note: snapshot.note,
            totalValue,
            totalInvested,
            assets: fullAssets
        };
    },

    // Treat 'snapshots' table as a Write-Through Cache
    createOrUpdate: async (data) => {
        const { date, assets, note } = data;
        
        if (!date || !Array.isArray(assets)) {
            throw { statusCode: 400, message: "Invalid snapshot data format" };
        }

        return await withTransaction(async () => {
            const now = Date.now();
            const snapRows = await getQuery("SELECT id FROM snapshots WHERE date = ?", [date]);
            const snapshotId = snapRows.length > 0 ? snapRows[0].id : uuidv4();

            await runQuery("DELETE FROM transactions WHERE snapshot_id = ?", [snapshotId]);
            
            for (const asset of assets) {
                if (asset.unitPrice !== undefined && asset.unitPrice !== null) {
                    await runQuery(`
                        INSERT INTO market_prices (id, asset_id, date, price, source, updated_at)
                        VALUES (?, ?, ?, ?, 'manual', ?)
                        ON CONFLICT(asset_id, date) DO UPDATE SET price=excluded.price, updated_at=excluded.updated_at
                    `, [uuidv4(), asset.assetId, date, asset.unitPrice, now]);
                }

                const qChange = parseFloat(asset.addedQuantity) || 0;
                const cChange = parseFloat(asset.addedPrincipal) || 0;
                const txNote = asset.note || '';
                
                if (Math.abs(qChange) > 0 || Math.abs(cChange) > 0 || txNote.length > 0) {
                     await runQuery(`
                        INSERT INTO transactions (id, asset_id, snapshot_id, date, type, quantity_change, cost_change, note, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                     `, [uuidv4(), asset.assetId, snapshotId, date, 'adjustment', qChange, cChange, txNote, now]);
                }
            }

            if (snapRows.length > 0) {
                await runQuery("UPDATE snapshots SET note=?, updated_at=? WHERE id=?", 
                    [note, now, snapshotId]);
            } else {
                await runQuery("INSERT INTO snapshots (id, date, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                    [snapshotId, date, note, now, now]);
            }

            // Clear cache for this date
            lruCache.delete(`totals:${date}`);
            lruCache.delete('historyGraph');

            return { success: true, id: snapshotId };
        });
    },

    // Clear all calculated caches (e.g., after data import)
    recalculateCache: async () => {
        lruCache.clear();
        return { success: true, count: 0, message: "Cache cleared" };
    }
};
