/**
 * @fileoverview Strategy Routes
 * 
 * API Endpoints for managing investment strategies and their hierarchical structure.
 * 
 * Routes:
 * - GET    /api/strategies     - List all strategies
 * - POST   /api/strategies     - Create new strategy
 * - PUT    /api/strategies/:id - Update strategy
 * - DELETE /api/strategies/:id - Delete strategy
 * 
 * Strategy Hierarchy:
 * - StrategyVersion (Level 1): Overall strategy with start date and status
 *   └── StrategyLayer (Level 2): Structural layers with weights
 *       └── StrategyTarget (Level 3): Individual asset allocations
 */

import express from 'express';
import { StrategyService } from '../services/strategyService.js';
import { sendSuccess, sendCreated, sendError } from '../utils/responseHelper.js';
import { validateBody, validateParams } from '../validations/middleware.js';
import { StrategyVersionSchema, StrategyVersionCreateSchema } from '../validations/schemas.js';
import { z } from 'zod';

const router = express.Router();

const IdParamSchema = z.object({ id: z.string().min(1) });

/**
 * @route   GET /api/strategies
 * @desc    Get all strategy versions
 * @access  Public
 * @returns {Array<StrategyVersion>} List of strategies with their layers and targets
 */
router.get('/', async (req, res) => {
    try {
        const data = await StrategyService.getAll();
        sendSuccess(res, data, 'Strategies retrieved successfully');
    } catch (e) { 
        sendError(res, e, 'Get Strategies'); 
    }
});

/**
 * @route   POST /api/strategies
 * @desc    Create new strategy version
 * @access  Public
 * @body    {StrategyVersion} Complete strategy with layers and targets
 * @note    The ID will be generated automatically
 */
router.post('/', validateBody(StrategyVersionCreateSchema), async (req, res) => {
    try {
        const result = await StrategyService.create(req.body);
        sendCreated(res, result, 'Strategy created successfully');
    } catch (e) { 
        sendError(res, e, 'Create Strategy'); 
    }
});

/**
 * @route   PUT /api/strategies/:id
 * @desc    Update existing strategy
 * @access  Public
 * @params  {string} id - Strategy ID
 * @body    {StrategyVersion} Complete updated strategy
 * @note    Replaces the entire strategy including layers and targets
 */
router.put('/:id', validateParams(IdParamSchema), validateBody(StrategyVersionSchema), async (req, res) => {
    try {
        const result = await StrategyService.update(req.params.id, req.body);
        sendSuccess(res, result, 'Strategy updated successfully');
    } catch (e) { 
        sendError(res, e, 'Update Strategy'); 
    }
});

/**
 * @route   DELETE /api/strategies/:id
 * @desc    Delete strategy and all its layers/targets
 * @access  Public
 * @params  {string} id - Strategy ID
 * @warning This will cascade delete all associated layers and targets
 */
router.delete('/:id', validateParams(IdParamSchema), async (req, res) => {
    try {
        const result = await StrategyService.delete(req.params.id);
        sendSuccess(res, result, 'Strategy deleted successfully');
    } catch (e) { 
        sendError(res, e, 'Delete Strategy'); 
    }
});

export default router;