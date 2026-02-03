
import express from 'express';
import { PriceSyncService } from '../services/priceSyncService.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';

const router = express.Router();

/**
 * @route   GET /api/prices/gold
 * @desc    Get current gold price (syncs if needed)
 * @access  Public
 */
router.get('/gold', async (req, res) => {
    try {
        let priceData = await PriceSyncService.getGoldPrice();

        const today = new Date().toISOString().slice(0, 10);
        if (!priceData || priceData.date !== today) {
            try {
                priceData = await PriceSyncService.syncGoldPrices();
            } catch (syncError) {
                if (priceData) {
                    console.log('[Prices] Sync failed, using cached price');
                } else {
                    return sendError(res, { message: '金价获取失败，且无历史数据' }, 'Get Gold Price', 503);
                }
            }
        }

        sendSuccess(res, priceData, 'Gold price retrieved');
    } catch (e) {
        sendError(res, e, 'Get Gold Price');
    }
});

/**
 * @route   POST /api/prices/sync
 * @desc    Sync gold prices
 * @access  Public
 */
router.post('/sync', async (req, res) => {
    try {
        const result = await PriceSyncService.syncGoldPrices();
        sendSuccess(res, result, 'Gold prices synced');
    } catch (e) {
        sendError(res, e, 'Sync Prices');
    }
});

/**
 * @route   POST /api/prices/sync/stocks
 * @desc    Sync stock prices
 * @access  Public
 */
router.post('/sync/stocks', async (req, res) => {
    try {
        const result = await PriceSyncService.syncStockPrices();
        sendSuccess(res, result, 'Stock prices synced');
    } catch (e) {
        sendError(res, e, 'Sync Stock Prices');
    }
});

/**
 * @route   POST /api/prices/sync/all
 * @desc    Sync all prices (gold + stocks)
 * @access  Public
 */
router.post('/sync/all', async (req, res) => {
    try {
        const result = await PriceSyncService.syncAllPrices();
        sendSuccess(res, result, 'All prices synced');
    } catch (e) {
        sendError(res, e, 'Sync All Prices');
    }
});

/**
 * @route   GET /api/prices/status
 * @desc    Get sync status (latest prices and their dates)
 * @access  Public
 */
router.get('/status', async (req, res) => {
    try {
        const goldPrice = await PriceSyncService.getGoldPrice();
        sendSuccess(res, { 
            gold: goldPrice,
            today: new Date().toISOString().slice(0, 10)
        }, 'Price sync status');
    } catch (e) {
        sendError(res, e, 'Get Price Status');
    }
});

export default router;
