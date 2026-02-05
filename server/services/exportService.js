import { v4 as uuidv4 } from 'uuid';
import { runQuery, getQuery, withTransaction } from '../db.js';
import { lruCache } from '../utils/cache.js';

const generateId = () => uuidv4();

export const ExportService = {
    async exportForBackup() {
        const [assets, strategies, snapshots] = await Promise.all([
            this.exportAssets(),
            this.exportStrategies(),
            this.exportSnapshots()
        ]);

        return {
            _meta: {
                version: "2.0",
                exportedAt: new Date().toISOString(),
                type: "invest_track_backup"
            },
            assets,
            strategies,
            snapshots
        };
    },

    async exportAssets() {
        const assets = await getQuery("SELECT type, name, ticker, note FROM assets ORDER BY name");

        for (const asset of assets) {
            asset.prices = await getQuery(
                "SELECT date, price FROM market_prices WHERE asset_id = (SELECT id FROM assets WHERE name = ?) ORDER BY date DESC",
                [asset.name]
            );
        }

        return assets;
    },

    async exportStrategies() {
        const versions = await getQuery("SELECT id, name, description, start_date as startDate, status, archived_at as archivedAt, updated_at as updatedAt FROM strategy_versions ORDER BY start_date DESC");
        const layers = await getQuery("SELECT id, version_id as versionId, name, weight, description FROM strategy_layers ORDER BY sort_order ASC");
        const targets = await getQuery(`
            SELECT t.id, t.layer_id as layerId, t.asset_id as assetId, t.weight, t.color, t.note
            FROM strategy_targets t
            LEFT JOIN assets a ON t.asset_id = a.id
            ORDER BY t.sort_order ASC
        `);

        const assetIdToName = new Map();
        const assets = await getQuery("SELECT id, name FROM assets");
        assets.forEach(a => assetIdToName.set(a.id, a.name));

        return versions.map(v => ({
            name: v.name,
            description: v.description,
            startDate: v.startDate,
            status: v.status,
            layers: layers.filter(l => l.versionId === v.id).map(l => ({
                id: l.id,
                name: l.name,
                weight: l.weight,
                description: l.description,
                items: targets.filter(t => t.layerId === l.id).map(t => ({
                    targetName: assetIdToName.get(t.assetId) || 'Unknown',
                    weight: t.weight,
                    color: t.color,
                    note: t.note
                }))
            }))
        }));
    },

    async exportSnapshots() {
        const snapshots = await getQuery("SELECT date, note FROM snapshots ORDER BY date DESC");

        const assetIdToName = new Map();
        const assets = await getQuery("SELECT id, name FROM assets");
        assets.forEach(a => assetIdToName.set(a.id, a.name));

        const dateToTransactions = new Map();
        const allDates = snapshots.map(s => s.date);
        if (allDates.length > 0) {
            const placeholders = allDates.map(() => '?').join(',');
            const transactions = await getQuery(`
                SELECT asset_id as assetId, date, type, 
                       quantity_change as quantityChange, cost_change as costChange, note
                FROM transactions 
                WHERE date IN (${placeholders})
                ORDER BY date DESC
            `, allDates);

            for (const tx of transactions) {
                if (!dateToTransactions.has(tx.date)) {
                    dateToTransactions.set(tx.date, []);
                }
                dateToTransactions.get(tx.date).push({
                    date: tx.date,
                    type: tx.type,
                    quantityChange: tx.quantityChange,
                    costChange: tx.costChange,
                    note: tx.note,
                    assetName: assetIdToName.get(tx.assetId) || tx.assetId
                });
            }
        }

        for (const snapshot of snapshots) {
            snapshot.transactions = dateToTransactions.get(snapshot.date) || [];
        }

        return snapshots;
    },

    async importBackup(data) {
        if (!data._meta || data._meta.type !== 'invest_track_backup') {
            throw { statusCode: 400, message: "Invalid backup file format" };
        }

        const { assets, strategies, snapshots } = data;
        const isNewFormat = data._meta.version === "2.0";

        const result = await withTransaction(async () => {
            const nameToId = new Map();
            const oldIdToNewId = new Map();
            const dateToSnapshotId = new Map();
            const now = Date.now();

            for (const a of assets || []) {
                const id = generateId();
                nameToId.set(a.name, id);
                await runQuery(
                    "INSERT INTO assets (id, type, name, ticker, note, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    [id, a.type, a.name, a.ticker || '', a.note || '', now]
                );

                if (isNewFormat && a.prices?.length > 0) {
                    for (const p of a.prices) {
                        await runQuery(`
                            INSERT INTO market_prices (id, asset_id, date, price, source, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?)
                            ON CONFLICT(asset_id, date) DO UPDATE SET price=excluded.price
                        `, [generateId(), id, p.date, p.price, 'import', now]);
                    }
                }
            }

            for (const s of strategies || []) {
                const versionId = generateId();
                await runQuery(
                    "INSERT INTO strategy_versions (id, name, description, start_date, status, archived_at, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [versionId, s.name, s.description, s.startDate, s.status, s.archivedAt || null, now, now]
                );

                for (const layer of s.layers || []) {
                    const layerId = layer.id || generateId();
                    await runQuery(
                        "INSERT INTO strategy_layers (id, version_id, name, weight, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
                        [layerId, versionId, layer.name, layer.weight, layer.description || '', 0]
                    );

                    for (const item of layer.items || []) {
                        const assetId = nameToId.get(item.targetName);
                        if (assetId) {
                            await runQuery(
                                "INSERT INTO strategy_targets (id, layer_id, asset_id, weight, color, note, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
                                [item.id || generateId(), layerId, assetId, item.weight, item.color || '', item.note || '', 0]
                            );
                        }
                    }
                }
            }

            const snapshotData = isNewFormat ? snapshots : (snapshots?.snapshots || snapshots || []);
            for (const snap of snapshotData) {
                const snapId = generateId();
                dateToSnapshotId.set(snap.date, snapId);
                await runQuery(
                    "INSERT INTO snapshots (id, date, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                    [snapId, snap.date, snap.note || '', now, now]
                );

                if (isNewFormat && snap.transactions?.length > 0) {
                    for (const tx of snap.transactions) {
                        const assetId = nameToId.get(tx.assetName);
                        if (assetId) {
                            await runQuery(`
                                INSERT INTO transactions (id, asset_id, snapshot_id, date, type, quantity_change, cost_change, note, created_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `, [generateId(), assetId, snapId, tx.date || snap.date, tx.type, tx.quantityChange || 0, tx.costChange || 0, tx.note || '', now]);
                        }
                    }
                }
            }

            if (!isNewFormat) {
                const prices = snapshots?.prices || [];
                for (const p of prices) {
                    await runQuery(`
                        INSERT INTO market_prices (id, asset_id, date, price, source, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT(asset_id, date) DO UPDATE SET price=excluded.price
                    `, [generateId(), p.assetId, p.date, p.price, 'import', now]);
                }

                const transactions = snapshots?.transactions || [];
                for (const tx of transactions) {
                    const snapshotId = tx.snapshotId || dateToSnapshotId.get(tx.date);
                    await runQuery(`
                        INSERT INTO transactions (id, asset_id, snapshot_id, date, type, quantity_change, cost_change, note, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [generateId(), tx.assetId, snapshotId, tx.date, tx.type, tx.quantityChange || 0, tx.costChange || 0, tx.note || '', now]);
                }
            }

            return {
                assets: assets?.length || 0,
                strategies: strategies?.length || 0,
                snapshots: snapshotData.length
            };
        });

        lruCache.clear();
        return result;
    }
};
