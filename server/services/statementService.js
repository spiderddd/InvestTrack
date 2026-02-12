
import { v4 as uuidv4 } from 'uuid';
import { runQuery, getQuery, withTransaction } from '../db.js';
import { lruCache } from '../utils/cache.js';

export const StatementService = {
    getList: async (page = 1, limit = 20) => {
        const offset = (page - 1) * limit;

        const [countResult, rows] = await Promise.all([
            getQuery("SELECT COUNT(*) as count FROM monthly_statements"),
            getQuery(`
                SELECT
                    s.id, s.date, s.note,
                    COALESCE(SUM(t.cost_change), 0) as totalInvested
                FROM monthly_statements s
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
        
        for (const h of holdings) {
            if (Math.abs(h.quantity) < 0.000001) continue;
            const priceRow = await getQuery(
                `SELECT price FROM market_prices WHERE asset_id=? AND date<=? ORDER BY date DESC LIMIT 1`,
                [h.asset_id, date]
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
    getPeriodsOnly: async () => {
        const rows = await getQuery("SELECT date FROM monthly_statements ORDER BY date DESC");
        return rows.map(r => r.date);
    },

    // Optimized: Get nearest previous statement without fetching full history list
    getPrevious: async (date) => {
        const sql = `
            SELECT id, date, note
            FROM monthly_statements
            WHERE date < ?
            ORDER BY date DESC
            LIMIT 1
        `;
        const rows = await getQuery(sql, [date]);
        if (rows.length === 0) return null;
        
        // Hydrate with details for the 'copy from previous' feature
        return await StatementService.getDetails(rows[0].id);
    },

    getHistoryGraph: async () => {
        const cacheKey = 'historyGraph';
        const cached = lruCache.get(cacheKey);
        if (cached) return cached;

        const statements = await getQuery("SELECT id, date FROM monthly_statements ORDER BY date ASC");
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

        const result = statements.map(s => {
            const statementDate = s.date;
            
            while (txCursor < totalTxs && allTxs[txCursor].date <= statementDate) {
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
            for (const [assetId, state] of runningState.entries()) {
                if (Math.abs(state.quantity) < 0.000001) continue;
                const assetPrices = pricesByAsset.get(assetId) || [];
                let price = 0;
                for (let i = assetPrices.length - 1; i >= 0; i--) {
                    if (assetPrices[i].date <= statementDate) {
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
        const headerRows = await getQuery("SELECT id, date, note FROM monthly_statements WHERE id = ?", [id]);
        if (headerRows.length === 0) throw { statusCode: 404, message: "Statement not found" };
        const statement = headerRows[0];
        const statementDate = statement.date;

        // Get totals from cache
        const totals = await StatementService.calculateTotals(statementDate);
        statement.totalValue = totals.totalValue;
        statement.totalInvested = totals.totalInvested;

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
        const holdings = await getQuery(holdingsSql, [statementDate]);

        // Fetch Note as well
        const flowSql = `SELECT asset_id, quantity_change, cost_change, note FROM transactions WHERE statement_id = ?`;
        const flows = await getQuery(flowSql, [id]);
        const flowMap = new Map();
        flows.forEach(f => flowMap.set(f.asset_id, { q: f.quantity_change, c: f.cost_change, n: f.note }));
        
        const fullAssets = await Promise.all(holdings.map(async (h) => {
            const assetInfo = await getQuery("SELECT name, type FROM assets WHERE id = ?", [h.assetId]);
            const meta = assetInfo[0] || { name: 'Unknown', type: 'other' };

            const priceRow = await getQuery(`
                SELECT price FROM market_prices 
                WHERE asset_id = ? AND date <= ? 
                ORDER BY date DESC LIMIT 1
            `, [h.assetId, statementDate]);

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

        statement.assets = fullAssets;
        return statement;
    },

    // New helper for asset manager time travel (supports YYYY-MM or YYYY-MM-DD)
    getDetailsByPeriod: async (date) => {
        if (!date) throw { statusCode: 400, message: "Date required" };
        
        const isFullDate = date.length === 10;
        let statementDate = date;
        
        if (isFullDate) {
            // For YYYY-MM-DD, find the latest statement <= this date (compare YYYY-MM parts)
            const monthPart = date.slice(0, 7);  // YYYY-MM
            const statementRows = await getQuery(
                "SELECT id, date FROM monthly_statements WHERE date <= ? ORDER BY date DESC LIMIT 1",
                [monthPart]
            );
            if (statementRows.length === 0) {
                console.log(`[StatementService] No statement found <= ${monthPart}`);
                return null;
            }
            statementDate = statementRows[0].date;
            console.log(`[StatementService] Real-time view: date=${date}, using statement=${statementDate}`);
        }
        
        // Get the statement header
        const headerRows = await getQuery("SELECT id, date, note FROM monthly_statements WHERE date = ?", [statementDate]);
        if (headerRows.length === 0) {
            console.log(`[StatementService] Statement not found: ${statementDate}`);
            return null;
        }
        
        const statement = headerRows[0];
        const statementId = statement.id;
        
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
        const holdings = await getQuery(holdingsSql, [date]);
        console.log(`[StatementService] Holdings count for ${date}: ${holdings.length}`);

        // Get statement-specific transactions for note/flow tracking (only for month view)
        let flowMap = new Map();
        if (!isFullDate) {
            const flowSql = `SELECT asset_id, quantity_change, cost_change, note FROM transactions WHERE statement_id = ?`;
            const flows = await getQuery(flowSql, [statementId]);
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
            `, [h.assetId, date]);

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
            id: statementId,
            date: date,
            note: statement.note,
            totalValue,
            totalInvested,
            assets: fullAssets
        };
    },

    // Treat 'monthly_statements' table as a Write-Through Cache
    createOrUpdate: async (data) => {
        const { date, assets, note } = data;
        
        if (!date || !Array.isArray(assets)) {
            throw { statusCode: 400, message: "Invalid statement data format" };
        }

        return await withTransaction(async () => {
            const now = Date.now();
            const stmtRows = await getQuery("SELECT id FROM monthly_statements WHERE date = ?", [date]);
            const statementId = stmtRows.length > 0 ? stmtRows[0].id : uuidv4();

            await runQuery("DELETE FROM transactions WHERE statement_id = ?", [statementId]);
            
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
                        INSERT INTO transactions (id, asset_id, statement_id, date, type, quantity_change, cost_change, note, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                     `, [uuidv4(), asset.assetId, statementId, date, 'adjustment', qChange, cChange, txNote, now]);
                }
            }

            if (stmtRows.length > 0) {
                await runQuery("UPDATE monthly_statements SET note=?, updated_at=? WHERE id=?", 
                    [note, now, statementId]);
            } else {
                await runQuery("INSERT INTO monthly_statements (id, date, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                    [statementId, date, note, now, now]);
            }

            // Clear cache for this date
            lruCache.delete(`totals:${date}`);
            lruCache.delete('historyGraph');

            return { success: true, id: statementId };
        });
    },

    // Clear all calculated caches (e.g., after data import)
    recalculateCache: async () => {
        lruCache.clear();
        return { success: true, count: 0, message: "Cache cleared" };
    }
};
