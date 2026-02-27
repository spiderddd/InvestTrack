/**
 * @fileoverview Monthly Statement Routes
 * 
 * API Endpoints for managing monthly investment statements and historical data.
 * 
 * Routes:
 * - GET    /api/statements           - List all statements with pagination
 * - GET    /api/statements/periods   - Get all statement periods only
 * - GET    /api/statements/history   - Get statement history graph data
 * - POST   /api/statements/recalculate - Recalculate statement cache
 * - GET    /api/statements/previous/:period - Get previous statement before a period
 * - GET    /api/statements/details-by-period - Get statement details by period
 * - GET    /api/statements/:id       - Get statement details by ID
 * - POST   /api/statements           - Create or update statement
 */

import express from 'express';
import { StatementService } from '../services/statementService.js';
import { sendSuccess, sendCreated, sendError } from '../utils/responseHelper.js';
import { validateBody, validateParams, validateQuery } from '../validations/middleware.js';
import { MonthlyStatementSchema, PaginationSchema } from '../validations/schemas.js';
import { z } from 'zod';

const router = express.Router();

// Schema for ID parameter validation
const IdParamSchema = z.object({ id: z.string().min(1) });

/**
 * @route   GET /api/statements
 * @desc    Get list of statements with pagination
 * @access  Public
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 20)
 * @returns {Object} Paginated list of statements with metadata
 */
router.get('/', validateQuery(PaginationSchema), async (req, res) => {
    try {
        const { page, limit } = req.query;
        const data = await StatementService.getList(page, limit);
        sendSuccess(res, data, 'Statements retrieved successfully');
    } catch (e) { 
        sendError(res, e, 'Get Statements'); 
    }
});

/**
 * @route   GET /api/statements/dates
 * @desc    Get all statement dates only
 * @access  Public
 * @returns {Array<string>} List of dates in YYYY-MM-DD format
 */
router.get('/dates', async (req, res) => {
    try {
        const data = await StatementService.getPeriodsOnly();
        sendSuccess(res, data, 'Statement dates retrieved successfully');
    } catch (e) { 
        sendError(res, e, 'Get Statement Dates'); 
    }
});

/**
 * @route   GET /api/statements/history
 * @desc    Get statement history graph data
 * @access  Public
 * @returns {Object} Historical statement data for visualization
 */
router.get('/history', async (req, res) => {
    try {
        const data = await StatementService.getHistoryGraph();
        sendSuccess(res, data, 'Statement history retrieved successfully');
    } catch (e) { 
        sendError(res, e, 'Statement History'); 
    }
});

/**
 * @route   POST /api/statements/recalculate
 * @desc    Recalculate statement cache
 * @access  Public
 * @returns {Object} Recalculation result with updated count
 */
router.post('/recalculate', async (req, res) => {
    try {
        const result = await StatementService.recalculateCache();
        sendSuccess(res, result, 'Cache recalculated successfully');
    } catch (e) { 
        sendError(res, e, 'Recalculate Cache'); 
    }
});

/**
 * @route   GET /api/statements/previous/:date
 * @desc    Get the previous statement before a given date
 * @access  Public
 * @params  {string} date - Date in YYYY-MM-DD format
 * @returns {Object} Previous statement or empty object if none found
 */
router.get('/previous/:date', validateParams(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format') })), async (req, res) => {
    try {
        const data = await StatementService.getPrevious(req.params.date);
        sendSuccess(res, data || {}, data ? 'Previous statement retrieved' : 'No previous statement found');
    } catch (e) { 
        sendError(res, e, 'Get Previous Statement'); 
    }
});

/**
 * @route   GET /api/statements/:id
 * @desc    Get statement details by ID
 * @access  Public
 * @params  {string} id - Statement ID
 * @returns {Object} Complete statement details
 */
router.get('/:id', validateParams(IdParamSchema), async (req, res) => {
    try {
        const data = await StatementService.getDetails(req.params.id);
        sendSuccess(res, data, 'Statement details retrieved successfully');
    } catch (e) { 
        sendError(res, e, 'Statement Details'); 
    }
});

/**
 * @route   POST /api/statements
 * @desc    Create or update a statement
 * @access  Public
 * @body    {MonthlyStatement} Statement data with period, assets, totals
 * @returns {Object} Created or updated statement
 */
router.post('/', validateBody(MonthlyStatementSchema), async (req, res) => {
    try {
        const result = await StatementService.createOrUpdate(req.body);
        sendCreated(res, result, 'Statement saved successfully');
    } catch(e) { 
        sendError(res, e, 'Save Statement'); 
    }
});

export default router;
