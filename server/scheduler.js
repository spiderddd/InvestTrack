
import cron from 'node-cron';
import { PriceSyncService } from './services/priceSyncService.js';

// Gold price sync: Daily at 01:00
cron.schedule('0 1 * * *', async () => {
    console.log('[Scheduler] Syncing gold prices at 01:00...');
    try {
        await PriceSyncService.syncGoldPrices();
        console.log('[Scheduler] Gold prices synced successfully');
    } catch (e) {
        console.error('[Scheduler] Failed to sync gold prices:', e.message);
    }
});

// Stock price sync: Daily at 01:30 (after gold sync)
cron.schedule('30 1 * * *', async () => {
    console.log('[Scheduler] Syncing stock prices at 01:30...');
    try {
        await PriceSyncService.syncStockPrices();
        console.log('[Scheduler] Stock prices synced successfully');
    } catch (e) {
        console.error('[Scheduler] Failed to sync stock prices:', e.message);
    }
});

console.log('[Scheduler] Price sync scheduler initialized:');
console.log('[Scheduler]   - Gold prices: daily at 01:00');
console.log('[Scheduler]   - Stock prices: daily at 01:30');
