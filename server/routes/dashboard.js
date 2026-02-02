/**
 * @fileoverview Dashboard Routes
 * 
 * API Endpoints for dashboard analytics and visualizations.
 * Provides consolidated data for charts, metrics, and portfolio overview.
 * 
 * Routes:
 * - GET /api/dashboard/overview   - Complete dashboard overview (metrics + allocation + trend)
 * - GET /api/dashboard/metrics    - Key performance metrics
 * - GET /api/dashboard/allocation - Asset allocation breakdown
 * - GET /api/dashboard/trend      - Historical trend data
 * - GET /api/dashboard/breakdown  - Performance attribution breakdown
 * 
 * Query Parameters:
 * - viewMode: 'strategy' | 'total' - View by strategy or total portfolio
 * - timeRange: 'all' | 'ytd' | '1y' - Time range filter
 * - layerId: string (optional) - Filter by specific strategy layer
 * - startDate: string (optional) - Custom start date (YYYY-MM format)
 */

import express from 'express';
import { DashboardService } from '../services/dashboardService.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';
import { validateQuery } from '../validations/middleware.js';
import { DashboardQuerySchema } from '../validations/schemas.js';

const router = express.Router();

/**
 * @route   GET /api/dashboard/overview
 * @desc    Get complete dashboard overview
 * @access  Public
 * @query   {viewMode, timeRange, layerId?, startDate?}
 * @returns {Object} Consolidated metrics, allocation, and trend data
 */
router.get('/overview', validateQuery(DashboardQuerySchema), async (req, res) => {
    try {
        const { viewMode, timeRange, layerId, startDate } = req.query;
        const data = await DashboardService.getOverview({ 
            viewMode: viewMode || 'strategy', 
            timeRange: timeRange || 'all',
            layerId: layerId || null,
            startDate: startDate || null
        });
        sendSuccess(res, data, 'Dashboard overview retrieved successfully');
    } catch (e) { 
        sendError(res, e, 'Get Dashboard Overview'); 
    }
});

/**
 * @route   GET /api/dashboard/metrics
 * @desc    Get key performance metrics
 * @access  Public
 * @query   {viewMode, timeRange}
 * @returns {Object} endValue, endInvested, profit, returnRate
 */
router.get('/metrics', validateQuery(DashboardQuerySchema), async (req, res) => {
    try {
        const { viewMode, timeRange } = req.query;
        const data = await DashboardService.getMetrics({ 
            viewMode: viewMode || 'strategy', 
            timeRange: timeRange || 'all' 
        });
        sendSuccess(res, data, 'Dashboard metrics retrieved successfully');
    } catch (e) { 
        sendError(res, e, 'Get Dashboard Metrics'); 
    }
});

/**
 * @route   GET /api/dashboard/allocation
 * @desc    Get asset allocation breakdown
 * @access  Public
 * @query   {viewMode, layerId?}
 * @returns {Array} Allocation data with weights and colors
 */
router.get('/allocation', validateQuery(DashboardQuerySchema), async (req, res) => {
    try {
        const { viewMode, layerId } = req.query;
        const data = await DashboardService.getAllocation({ 
            viewMode: viewMode || 'strategy',
            layerId: layerId || null
        });
        sendSuccess(res, data, 'Allocation data retrieved successfully');
    } catch (e) { 
        sendError(res, e, 'Get Allocation'); 
    }
});

/**
 * @route   GET /api/dashboard/trend
 * @desc    Get historical trend data for charts
 * @access  Public
 * @query   {viewMode, layerId?, startDate?}
 * @returns {Array} Time series data points
 */
router.get('/trend', validateQuery(DashboardQuerySchema), async (req, res) => {
    try {
        const { viewMode, layerId, startDate } = req.query;
        const data = await DashboardService.getTrend({ 
            viewMode: viewMode || 'strategy',
            layerId: layerId || null,
            startDate: startDate || null
        });
        sendSuccess(res, data, 'Trend data retrieved successfully');
    } catch (e) { 
        sendError(res, e, 'Get Trend'); 
    }
});

/**
 * @route   GET /api/dashboard/breakdown
 * @desc    Get performance attribution breakdown
 * @access  Public
 * @query   {viewMode, timeRange, layerId?}
 * @returns {Array} Attribution analysis by asset/layer
 */
router.get('/breakdown', validateQuery(DashboardQuerySchema), async (req, res) => {
    try {
        const { viewMode, timeRange, layerId } = req.query;
        const data = await DashboardService.getAttribution({ 
            viewMode: viewMode || 'strategy',
            timeRange: timeRange || 'all',
            layerId: layerId || null
        });
        sendSuccess(res, data, 'Breakdown data retrieved successfully');
    } catch (e) { 
        sendError(res, e, 'Get Breakdown'); 
    }
});

export default router;
