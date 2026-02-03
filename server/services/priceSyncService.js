
import { fetch, ProxyAgent } from 'undici';
import { TextDecoder } from 'util';
import { AssetService } from './assetService.js';
import { lruCache } from '../utils/cache.js';

// EastMoney API headers
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://quote.eastmoney.com'
};

/**
 * Generate secid for EastMoney API based on ticker
 * 1.xxx = Shanghai (6, 9, 5开头)
 * 0.xxx = Shenzhen (其他)
 */
function makeSecid(ticker) {
    if (ticker.startsWith('6') || ticker.startsWith('9') || ticker.startsWith('5')) {
        return `1.${ticker}`;  // Shanghai
    }
    return `0.${ticker}`;  // Shenzhen
}

async function fetchStockPrice(ticker) {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || 
                     process.env.HTTP_PROXY || process.env.http_proxy;
    const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
    
    const secid = makeSecid(ticker);
    
    // 1. Try real-time price first
    try {
        const url = 'https://push2.eastmoney.com/api/qt/stock/get';
        const params = new URLSearchParams({
            secid: secid,
            fields: 'f58,f43,f60',
            _: Date.now().toString()
        });
        
        const response = await fetch(`${url}?${params}`, { 
            dispatcher,
            headers: HEADERS 
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.data && data.data.f43 && data.data.f43 > 0) {
                return {
                    name: data.data.f58,
                    price: data.data.f43 / 100
                };
            }
        }
    } catch (e) {
        console.log(`[PriceSync] Real-time price failed for ${ticker}, trying historical...`);
    }
    
    // 2. Fallback to historical closing price
    try {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';
        const params = new URLSearchParams({
            secid: secid,
            klt: '101',      // Daily
            fqt: '0',        // No adjustment
            beg: '19900101',
            end: today,
            fields1: 'f1,f2,f3,f4,f5,f6',
            fields2: 'f51,f52,f53,f54,f55'
        });
        
        const response = await fetch(`${url}?${params}`, { 
            dispatcher,
            headers: HEADERS 
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.data && data.data.klines && data.data.klines.length > 0) {
                const last = data.data.klines[data.data.klines.length - 1].split(',');
                return {
                    name: `股票${ticker}`,
                    price: parseFloat(last[2])  // Closing price
                };
            }
        }
    } catch (e) {
        console.error(`[PriceSync] Historical price failed for ${ticker}:`, e.message);
    }
    
    return null;
}

async function fetchShGoldPrice() {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || 
                     process.env.HTTP_PROXY || process.env.http_proxy;

    const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

    const url = "https://www.5huangjin.com/data/jin.js";

    try {
        const response = await fetch(url, { dispatcher });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder('gbk');
        const text = decoder.decode(buffer);

        const match = text.match(/var hq_str_gds_AUTD="([^"]+)"/);
        if (match) {
            const data = match[1].split(',');
            const price = parseFloat(data[0]);
            if (price && price > 0) return price;
        }
        return null;
    } catch (error) {
        console.error('[PriceSync] Failed to fetch gold price:', error.message);
        return null;
    }
}

export const PriceSyncService = {
    syncGoldPrices: async () => {
        const goldAssets = await AssetService.getByType('gold');
        if (goldAssets.length === 0) {
            console.log('[PriceSync] No gold assets found');
            return null;
        }

        const price = await fetchShGoldPrice();
        if (!price) {
            throw new Error('Failed to fetch gold price from 5huangjin.com');
        }

        const today = new Date().toISOString().slice(0, 10);
        let updated = 0;

        for (const asset of goldAssets) {
            await AssetService.updatePrice(asset.id, price, today, 'sync');
            updated++;
        }

        console.log(`[PriceSync] Synced gold price: ¥${price.toFixed(2)} for ${updated} asset(s)`);

        // Clear cache after price update
        lruCache.delete(`totals:${today}`);
        lruCache.delete('historyGraph');
        console.log(`[PriceSync] Cache cleared for date ${today}`);

        return { price, assetsUpdated: updated, date: today, type: 'gold' };
    },

    syncStockPrices: async () => {
        // Get all security assets with ticker
        const allAssets = await AssetService.getAll({ format: 'simple' });
        const stockAssets = allAssets.filter(a => a.type === 'security' && a.ticker);
        
        if (stockAssets.length === 0) {
            console.log('[PriceSync] No stock assets found');
            return { type: 'stock', assetsUpdated: 0, skipped: 0, failed: 0 };
        }

        const today = new Date().toISOString().slice(0, 10);
        let updated = 0;
        let skipped = 0;
        let failed = 0;

        console.log(`[PriceSync] Starting stock price sync for ${stockAssets.length} assets...`);

        for (let i = 0; i < stockAssets.length; i++) {
            const asset = stockAssets[i];
            console.log(`[PriceSync] [${i + 1}/${stockAssets.length}] Processing: ${asset.name} (${asset.ticker})`);
            
            const result = await fetchStockPrice(asset.ticker);
            
            if (!result || result.price <= 0) {
                console.log(`[PriceSync]       ⚠️  Skipped: Unable to get price`);
                skipped++;
                continue;
            }
            
            try {
                await AssetService.updatePrice(asset.id, result.price, today, 'sync');
                console.log(`[PriceSync]       ✅ Success: ¥${result.price.toFixed(2)}`);
                updated++;
            } catch (e) {
                console.error(`[PriceSync]       ❌ Failed:`, e.message);
                failed++;
            }
        }

        console.log(`[PriceSync] Stock sync complete: ${updated} success, ${failed} failed, ${skipped} skipped`);

        // Clear cache after price update
        lruCache.delete(`totals:${today}`);
        lruCache.delete('historyGraph');
        console.log(`[PriceSync] Cache cleared for date ${today}`);

        return { 
            type: 'stock',
            assetsUpdated: updated, 
            failed, 
            skipped, 
            date: today 
        };
    },

    syncAllPrices: async () => {
        const results = {
            gold: null,
            stock: null
        };
        
        try {
            results.gold = await PriceSyncService.syncGoldPrices();
        } catch (e) {
            console.error('[PriceSync] Gold sync failed:', e.message);
            results.gold = { error: e.message };
        }
        
        try {
            results.stock = await PriceSyncService.syncStockPrices();
        } catch (e) {
            console.error('[PriceSync] Stock sync failed:', e.message);
            results.stock = { error: e.message };
        }
        
        return results;
    },

    getGoldPrice: async () => {
        const goldAssets = await AssetService.getByType('gold');
        if (goldAssets.length === 0) return null;

        return await AssetService.getLatestPrice(goldAssets[0].id);
    },

    fetchShGoldPrice,
    fetchStockPrice
};
