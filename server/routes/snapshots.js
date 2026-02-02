/**
 * @fileoverview Snapshot Routes
 * 
 * API Endpoints for managing monthly investment snapshots and historical data.
 * 
 * Routes:
 * - GET    /api/snapshots           - List all snapshots with pagination
 * - GET    /api/snapshots/dates     - Get all snapshot dates only
 * - GET    /api/snapshots/history   - Get snapshot history graph data
 * - POST   /api/snapshots/recalculate - Recalculate snapshot cache
 * - GET    /api/snapshots/previous/:date - Get previous snapshot before a date
 * - GET    /api/snapshots/details-by-date - Get snapshot details by date
 * - GET    /api/snapshots/:id       - Get snapshot details by ID
 * - POST   /api/snapshots           - Create or update snapshot
 */

import express from 'express';
import { SnapshotService } from '../services/snapshotService.js';
import { sendSuccess, sendCreated, sendError } from '../utils/responseHelper.js';
import { validateBody, validateParams, validateQuery } from '../validations/middleware.js';
import { SnapshotSchema, PaginationSchema } from '../validations/schemas.js';
import { z } from 'zod';

const router = express.Router();

// Schema for ID parameter validation
const IdParamSchema = z.object({ id: z.string().min(1) });

// Schema for date query parameter validation
const DateQuerySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}$/, 'Date must be YYYY-MM format') });

/**
 * @route   GET /api/snapshots
 * @desc    Get list of snapshots with pagination
 * @access  Public
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 20)
 * @returns {Object} Paginated list of snapshots with metadata
 */
router.get('/', validateQuery(PaginationSchema), async (req, res) => {
    try {
        const { page, limit } = req.query;
        const data = await SnapshotService.getList(page, limit);
        sendSuccess(res, data, 'Snapshots retrieved successfully');
    } catch (e) { 
        sendError(res, e, 'Get Snapshots'); 
    }
});

/**
 * @route   GET /api/snapshots/dates
 * @desc    Get all snapshot dates only
 * @access  Public
 * @returns {Array<string>} List of dates in YYYY-MM format
 */
router.get('/dates', async (req, res) => {
    try {
        const data = await SnapshotService.getDatesOnly();
        sendSuccess(res, data, 'Snapshot dates retrieved successfully');
    } catch (e) { 
        sendError(res, e, 'Get Snapshot Dates'); 
    }
});

/**
 * @route   GET /api/snapshots/history
 * @desc    Get snapshot history graph data
 * @access  Public
 * @returns {Object} Historical snapshot data for visualization
 */
router.get('/history', async (req, res) => {
    try {
        const data = await SnapshotService.getHistoryGraph();
        sendSuccess(res, data, 'Snapshot history retrieved successfully');
    } catch (e) { 
        sendError(res, e, 'Snapshot History'); 
    }
});

/**
 * @route   POST /api/snapshots/recalculate
 * @desc    Recalculate snapshot cache
 * @access  Public
 * @returns {Object} Recalculation result with updated count
 */
router.post('/recalculate', async (req, res) => {
    try {
        const result = await SnapshotService.recalculateCache();
        sendSuccess(res, result, 'Cache recalculated successfully');
    } catch (e) { 
        sendError(res, e, 'Recalculate Cache'); 
    }
});

/**
 * @route   GET /api/snapshots/previous/:date
 * @desc    Get the previous snapshot before a given date
 * @access  Public
 * @params  {string} date - Date in YYYY-MM format
 * @returns {Object} Previous snapshot or empty object if none found
 */
router.get('/previous/:date', validateParams(z.object({ date: z.string().regex(/^\d{4}-\d{2}$/, 'Date must be YYYY-MM format') })), async (req, res) => {
    try {
        const data = await SnapshotService.getPrevious(req.params.date);
        sendSuccess(res, data || {}, data ? 'Previous snapshot retrieved' : 'No previous snapshot found');
    } catch (e) { 
        sendError(res, e, 'Get Previous Snapshot'); 
    }
});

/**
 * @route   GET /api/snapshots/details-by-date
 * @desc    Get snapshot details by date
 * @access  Public
 * @query   {string} date - Date in YYYY-MM format
 * @returns {Object} Snapshot details or null if not found
 */
router.get('/details-by-date', validateQuery(DateQuerySchema), async (req, res) => {
    try {
        const { date } = req.query;
        const data = await SnapshotService.getDetailsByDate(date);
        sendSuccess(res, data, data ? 'Snapshot details retrieved' : 'No snapshot found for this date');
    } catch (e) { 
        sendError(res, e, 'Get Snapshot By Date'); 
    }
});

/**
 * @route   GET /api/snapshots/:id
 * @desc    Get snapshot details by ID
 * @access  Public
 * @params  {string} id - Snapshot ID
 * @returns {Object} Complete snapshot details
 */
router.get('/:id', validateParams(IdParamSchema), async (req, res) => {
    try {
        const data = await SnapshotService.getDetails(req.params.id);
        sendSuccess(res, data, 'Snapshot details retrieved successfully');
    } catch (e) { 
        sendError(res, e, 'Snapshot Details'); 
    }
});

/**
 * @route   POST /api/snapshots
 * @desc    Create or update a snapshot
 * @access  Public
 * @body    {Snapshot} Snapshot data with date, assets, totals
 * @returns {Object} Created or updated snapshot
 */
router.post('/', validateBody(SnapshotSchema), async (req, res) => {
    try {
        const result = await SnapshotService.createOrUpdate(req.body);
        sendCreated(res, result, 'Snapshot saved successfully');
    } catch(e) { 
        sendError(res, e, 'Save Snapshot'); 
    }
});

export default router;
