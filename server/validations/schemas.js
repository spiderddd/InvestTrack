/**
 * Validation Schemas using Zod
 * 
 * These schemas validate incoming API requests against the shared types.
 * Import and use with the validate middleware.
 */

import { z } from 'zod';

// Asset Category enum
const AssetCategorySchema = z.enum(['security', 'fund', 'wealth', 'gold', 'fixed', 'crypto', 'other']);

// Strategy Status enum
const StrategyStatusSchema = z.enum(['active', 'archived']);

// ID validation (UUID or string ID)
const IdSchema = z.string().min(1, 'ID is required');

/**
 * Asset Schema
 */
export const AssetSchema = z.object({
  id: IdSchema.optional(), // Optional for create (will be generated)
  type: AssetCategorySchema,
  name: z.string().min(1, 'Asset name is required').max(100, 'Name too long'),
  ticker: z.string().max(20).optional(),
  note: z.string().max(500).optional()
});

export const AssetUpdateSchema = AssetSchema.partial().omit({ id: true });

/**
 * Strategy Target Schema (Level 3)
 */
export const StrategyTargetSchema = z.object({
  id: IdSchema,
  assetId: IdSchema,
  targetName: z.string().min(1, 'Target name is required'),
  weight: z.number().min(0).max(100, 'Weight must be between 0 and 100'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be hex format like #3b82f6'),
  note: z.string().max(500).optional()
});

/**
 * Strategy Layer Schema (Level 2)
 */
export const StrategyLayerSchema = z.object({
  id: IdSchema,
  name: z.string().min(1, 'Layer name is required').max(50),
  weight: z.number().min(0).max(100, 'Weight must be between 0 and 100'),
  description: z.string().max(500).optional(),
  items: z.array(StrategyTargetSchema)
});

/**
 * Strategy Layer Schema for Update (Level 2) - items optional
 */
export const StrategyLayerUpdateSchema = z.object({
  id: IdSchema.optional(),
  name: z.string().min(1, 'Layer name is required').max(50),
  weight: z.number().min(0).max(100, 'Weight must be between 0 and 100'),
  description: z.string().max(500).optional(),
  items: z.array(StrategyTargetSchema).optional()
});

/**
 * Strategy Version Schema (Level 1)
 */
export const StrategyVersionSchema = z.object({
  id: IdSchema,
  name: z.string().min(1, 'Strategy name is required').max(100),
  description: z.string().max(100000),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  status: StrategyStatusSchema,
  layers: z.array(StrategyLayerSchema)
});

export const StrategyVersionCreateSchema = StrategyVersionSchema.omit({ id: true });

/**
 * Asset Record Schema (for Snapshots)
 */
export const AssetRecordSchema = z.object({
  id: IdSchema,
  assetId: IdSchema,
  name: z.string().min(1),
  category: AssetCategorySchema,
  unitPrice: z.number().min(0),
  quantity: z.number(),
  marketValue: z.number(),
  totalCost: z.number(),
  addedPrincipal: z.number(),
  addedQuantity: z.number(),
  note: z.string().optional()
});

/**
 * Snapshot Schema
 */
export const SnapshotSchema = z.object({
  id: IdSchema.optional(),
  date: z.string().regex(/^\d{4}-\d{2}$/, 'Date must be YYYY-MM format'),
  assets: z.array(AssetRecordSchema).optional(),
  totalValue: z.number().min(0),
  totalInvested: z.number().min(0),
  note: z.string().max(2000).optional()
});

/**
 * Price Update Schema
 */
export const PriceUpdateSchema = z.object({
  price: z.number().positive('Price must be positive'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format').optional()
});

/**
 * Query Parameters Schemas
 */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const DashboardQuerySchema = z.object({
  viewMode: z.enum(['strategy', 'total']).default('strategy'),
  timeRange: z.enum(['all', 'ytd', '1y']).default('all'),
  layerId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}$/).optional()
});
