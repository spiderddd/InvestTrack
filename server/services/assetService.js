
import { v4 as uuidv4 } from 'uuid';
import { runQuery, getQuery } from '../db.js';

export const AssetService = {
    /**
     * Get all assets
     * @param {Object} options - Query options
     * @param {string} options.fields - Comma-separated list of fields to return (e.g., "id,name,type,ticker")
     * @param {string} options.format - Output format: 'simple' (no createdAt) or 'full' (default)
     * @returns {Promise<Array>} List of assets
     */
    getAll: async (options = {}) => {
        const { fields, format } = options;
        
        let sql;
        let orderBy = 'ORDER BY created_at DESC';
        
        if (fields) {
            // Only return specified fields
            const allowedFields = fields.split(',').map(f => f.trim()).filter(f => 
                ['id', 'name', 'type', 'ticker', 'note', 'created_at', 'createdAt'].includes(f)
            );
            
            // Map createdAt to created_at for SQL
            const sqlFields = allowedFields.map(f => f === 'createdAt' ? 'created_at as createdAt' : f);
            
            if (sqlFields.length === 0) {
                // Fallback to default if no valid fields
                sql = "SELECT id, type, name, ticker, note, created_at as createdAt FROM assets ORDER BY name";
            } else {
                // Check if we need to map createdAt back
                const selectFields = fields.split(',').map(f => f.trim()).map(f => {
                    if (f === 'createdAt') return 'created_at as createdAt';
                    return f;
                }).join(', ');
                sql = `SELECT ${selectFields} FROM assets ORDER BY name`;
            }
        } else if (format === 'simple') {
            // Simple format: exclude created_at
            sql = "SELECT id, type, name, ticker, note FROM assets ORDER BY name";
        } else {
            // Full format (default)
            sql = "SELECT id, type, name, ticker, note, created_at as createdAt FROM assets ORDER BY created_at DESC";
        }
        
        return await getQuery(sql);
    },

    create: async (data) => {
        const { name, type, ticker, note } = data;
        if (!name || !type) throw { statusCode: 400, message: "Name and Type required" };

        // Check for duplicate by name or ticker
        const existing = await getQuery(
            "SELECT id, name, ticker FROM assets WHERE name = ? OR (ticker = ? AND ticker IS NOT NULL AND ticker != '')",
            [name, ticker]
        );
        if (existing.length > 0) {
            const existingAsset = existing[0];
            if (existingAsset.name === name) {
                throw { statusCode: 409, message: "同名资产已存在" };
            }
            if (ticker && existingAsset.ticker === ticker) {
                throw { statusCode: 409, message: `代码为 ${ticker} 的资产已存在` };
            }
        }

        const id = uuidv4();
        const now = Date.now();
        await runQuery(
            "INSERT INTO assets (id, type, name, ticker, note, created_at) VALUES (?, ?, ?, ?, ?, ?)", 
            [id, type, name, ticker, note, now]
        );
        return { id, name, type, ticker, note, createdAt: now };
    },

    update: async (id, data) => {
        const { name, type, ticker, note } = data;
        await runQuery(
            "UPDATE assets SET name = ?, type = ?, ticker = ?, note = ? WHERE id = ?", 
            [name, type, ticker, note, id]
        );
        return { success: true, id };
    },

    delete: async (id) => {
        // Optional: Check for dependency constraints (foreign keys usually handle this via CASCADE or error)
        await runQuery("DELETE FROM assets WHERE id = ?", [id]);
        return { success: true };
    },

    // New: Update Latest Price (for Crawler/API)
    updatePrice: async (assetId, price, date, source = 'manual') => {
        const id = uuidv4();
        const now = Date.now();
        // Upsert logic
        await runQuery(`
            INSERT INTO market_prices (id, asset_id, date, price, source, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(asset_id, date) DO UPDATE SET price=excluded.price, source=excluded.source, updated_at=excluded.updated_at
        `, [id, assetId, date, price, source, now]);
        return { success: true };
    },

    // Get latest prices for multiple assets
    getLatestPrices: async (assetIds) => {
        if (!assetIds || assetIds.length === 0) return {};

        const placeholders = assetIds.map(() => '?').join(',');
        // Get latest price for each asset
        const sql = `
            SELECT asset_id, price, date
            FROM market_prices
            WHERE asset_id IN (${placeholders})
            AND date <= ?
        `;

        const currentDate = new Date().toISOString().slice(0, 10);
        const prices = await getQuery(sql, [...assetIds, currentDate]);

        // Convert to map: assetId -> { price, date }
        const priceMap = {};
        for (const p of prices) {
            // Keep the latest price for each asset
            // Use both asset_id (DB) and assetId (camelCase for frontend compatibility)
            const key = p.assetId || p.asset_id;
            if (!key) continue;
            if (!priceMap[key] || p.date > priceMap[key].date) {
                priceMap[key] = { price: p.price, date: p.date };
            }
        }

        return priceMap;
    },

    getHistory: async (assetId) => {
        // OPTIMIZED: Fetch all raw data first
        
        // 1. Get all transactions for this asset (Include Note)
        const txs = await getQuery("SELECT date, quantity_change, cost_change, note FROM transactions WHERE asset_id = ? ORDER BY date ASC", [assetId]);
        
        // 2. Get all prices for this asset
        const prices = await getQuery("SELECT date, price FROM market_prices WHERE asset_id = ? ORDER BY date ASC", [assetId]);
        
        // 3. Get statement dates (to align the timeline)
        const statements = await getQuery("SELECT date FROM monthly_statements ORDER BY date ASC");
        
        const history = [];
        
        // Optimization pointers
        let txIndex = 0;
        
        let cumQ = 0;
        let cumC = 0;
        
        for (const s of statements) {
            const statementDate = s.date;

            let periodAddedQ = 0;
            let periodAddedC = 0;
            let periodNotes = [];

            // Advance transaction pointer until we pass the statement date
            while (txIndex < txs.length && txs[txIndex].date <= statementDate) {
                const t = txs[txIndex];
                cumQ += t.quantity_change;
                cumC += t.cost_change;

                // Track changes that specifically belong to this "period" (between previous statement and this one)
                // Note: This logic assumes statements are chronologically processed.
                periodAddedQ += t.quantity_change;
                periodAddedC += t.cost_change;

                if (t.note && t.note.trim().length > 0) {
                    periodNotes.push(t.note);
                }

                txIndex++;
            }

            // If asset never existed or was fully sold long ago and no activity, we might skip
            // But if it has a non-zero quantity, we must record it.
            // If it has 0 quantity but had activity this month, record it.
            if (Math.abs(cumQ) < 0.000001 && periodAddedQ === 0 && periodAddedC === 0) {
                continue;
            }

            // Find price at this date
            // Simple reverse search for latest price <= statementDate
            let unitPrice = 0;
            for (let i = prices.length - 1; i >= 0; i--) {
                if (prices[i].date <= statementDate) {
                    unitPrice = prices[i].price;
                    break;
                }
            }

            history.push({
                date: statementDate,
                unitPrice: unitPrice,
                quantity: cumQ,
                marketValue: cumQ * unitPrice,
                totalCost: cumC,
                addedQuantity: periodAddedQ,
                addedPrincipal: periodAddedC,
                note: periodNotes.join('; ')
            });
        }
        return history;
    },

    getByType: async (type) => {
        return await getQuery(
            "SELECT id, type, name, ticker, note FROM assets WHERE type = ? ORDER BY name",
            [type]
        );
    },

    getPrices: async (assetId) => {
        const rows = await getQuery(`
            SELECT date, price, source
            FROM market_prices
            WHERE asset_id = ?
            ORDER BY date ASC
        `, [assetId]);
        return rows;
    },

    getLatestPrice: async (assetId) => {
        const rows = await getQuery(`
            SELECT price, date, source
            FROM market_prices
            WHERE asset_id = ?
            ORDER BY date DESC
            LIMIT 1
        `, [assetId]);
        return rows[0] || null;
    }
};
