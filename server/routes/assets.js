/**
 * @fileoverview Asset Routes
 * 
 * API Endpoints for managing investment assets.
 * 
 * Routes:
 * - GET    /api/assets              - List all assets
 * - POST   /api/assets              - Create new asset
 * - PUT    /api/assets/:id          - Update asset
 * - DELETE /api/assets/:id          - Delete asset
 * - POST   /api/assets/:id/price    - Update asset price
 * - GET    /api/assets/:id/history  - Get asset price history
 */

import express from 'express';
import { AssetService } from '../services/assetService.js';
import { AssetService as HoldingsService } from '../services/assetsService.js';
import { sendSuccess, sendCreated, sendError } from '../utils/responseHelper.js';
import { validateBody, validateParams, validateQuery } from '../validations/middleware.js';
import { AssetSchema, AssetUpdateSchema, PriceUpdateSchema } from '../validations/schemas.js';
import { z } from 'zod';

const router = express.Router();

const IdParamSchema = z.object({ id: z.string().min(1) });
const DateQuerySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format') });

/**
 * @route   GET /api/assets/holdings-by-date
 * @desc    Get asset holdings up to a specific date
 * @access  Public
 * @query   {string} date - Date in YYYY-MM-DD format
 * @returns {Object} Holdings with quantity, totalCost, and latest unitPrice
 */
router.get('/holdings-by-date', validateQuery(DateQuerySchema), async (req, res) => {
    try {
        const { date } = req.query;
        const data = await HoldingsService.getHoldingsByDate(date);
        sendSuccess(res, data, 'Holdings retrieved successfully');
    } catch (e) {
        sendError(res, e, 'Get Holdings By Date');
    }
});

/**
 * @route   GET /api/assets
 * @desc    Get all assets
 * @access  Public
 * @query   {string} [fields] - Comma-separated list of fields to include
 * @query   {string} [format] - Response format (e.g., 'json', 'csv')
 */
router.get('/', async (req, res) => {
    try {
        const { fields, format } = req.query;
        const data = await AssetService.getAll({ fields, format });
        sendSuccess(res, data, 'Assets retrieved successfully');
    } catch (e) { 
        sendError(res, e, 'Get Assets'); 
    }
});

/**
 * @route   POST /api/assets
 * @desc    Create new asset
 * @access  Public
 * @body    {Asset} Asset data
 */
router.post('/', validateBody(AssetSchema), async (req, res) => {
    try {
        const data = await AssetService.create(req.body);
        sendCreated(res, data, 'Asset created successfully');
    } catch (e) { 
        sendError(res, e, 'Create Asset'); 
    }
});

/**
 * @route   PUT /api/assets/:id
 * @desc    Update existing asset
 * @access  Public
 * @params  {string} id - Asset ID
 * @body    {Partial<Asset>} Updated asset data
 */
router.put('/:id', validateParams(IdParamSchema), validateBody(AssetUpdateSchema), async (req, res) => {
    try {
        const data = await AssetService.update(req.params.id, req.body);
        sendSuccess(res, data, 'Asset updated successfully');
    } catch (e) { 
        sendError(res, e, 'Update Asset'); 
    }
});

/**
 * @route   DELETE /api/assets/:id
 * @desc    Delete asset
 * @access  Public
 * @params  {string} id - Asset ID
 */
router.delete('/:id', validateParams(IdParamSchema), async (req, res) => {
    try {
        const data = await AssetService.delete(req.params.id);
        sendSuccess(res, data, 'Asset deleted successfully');
    } catch (e) { 
        sendError(res, e, 'Delete Asset'); 
    }
});

/**
 * @route   POST /api/assets/:id/price
 * @desc    Update asset price for specific date
 * @access  Public
 * @params  {string} id - Asset ID
 * @body    {price: number, date?: string} Price data
 */
router.post('/:id/price', validateParams(IdParamSchema), validateBody(PriceUpdateSchema), async (req, res) => {
    try {
        const { price, date } = req.body;
        // Default to today if no date
        const targetDate = date || new Date().toISOString().slice(0, 10);
        const data = await AssetService.updatePrice(req.params.id, price, targetDate);
        sendSuccess(res, data, 'Price updated successfully');
    } catch (e) { 
        sendError(res, e, 'Update Price'); 
    }
});

/**
 * @route   POST /api/assets/latest_prices
 * @desc    Get latest prices for multiple assets
 * @access  Public
 * @body    {assetIds: string[]} Array of asset IDs
 */
router.post('/latest_prices', async (req, res) => {
    try {
        const { assetIds } = req.body;
        if (!assetIds || !Array.isArray(assetIds)) {
            return sendError(res, { statusCode: 400, message: 'assetIds array required' }, 'Get Prices');
        }
        const data = await AssetService.getLatestPrices(assetIds);
        sendSuccess(res, data, 'Prices retrieved successfully');
    } catch (e) {
        sendError(res, e, 'Get Prices');
    }
});

/**
 * @route   GET /api/assets/:id/history
 * @desc    Get asset price history
 * @access  Public
 * @params  {string} id - Asset ID
 */
router.get('/:id/history', validateParams(IdParamSchema), async (req, res) => {
    try {
        const data = await AssetService.getHistory(req.params.id);
        sendSuccess(res, data, 'Asset history retrieved successfully');
    } catch (e) {
        sendError(res, e, 'Asset History');
    }
});

/**
 * @route   GET /api/assets/:id/prices
 * @desc    Get asset price trend data
 * @access  Public
 * @params  {string} id - Asset ID
 */
router.get('/:id/prices', validateParams(IdParamSchema), async (req, res) => {
    try {
        const data = await AssetService.getPrices(req.params.id);
        sendSuccess(res, data, 'Asset prices retrieved successfully');
    } catch (e) {
        sendError(res, e, 'Asset Prices');
    }
});

export default router;
