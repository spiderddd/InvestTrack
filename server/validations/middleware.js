/**
 * Validation Middleware
 * 
 * Usage:
 *   import { validate, validateParams } from '../validations/middleware.js';
 *   import { AssetSchema } from '../validations/schemas.js';
 *   
 *   router.post('/', validate(AssetSchema), async (req, res) => {
 *     // req.body is now validated and typed
 *   });
 */

import { sendError } from '../utils/responseHelper.js';

/**
 * Validates request body against a Zod schema
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {string} source - Where to get data from: 'body' | 'params' | 'query'
 */
export const validate = (schema, source = 'body') => {
  return async (req, res, next) => {
    try {
      const data = source === 'body' ? req.body : 
                   source === 'params' ? req.params : 
                   source === 'query' ? req.query : req.body;
      
      // Parse and validate
      const validated = await schema.parseAsync(data);
      
      // Replace original data with validated (and potentially transformed) data
      if (source === 'body') req.body = validated;
      else if (source === 'params') req.params = validated;
      else if (source === 'query') req.query = validated;
      
      next();
    } catch (error) {
      // Format Zod errors into readable messages
      if (error.errors && Array.isArray(error.errors)) {
        const messages = error.errors.map(e => {
          const path = e.path.length > 0 ? e.path.join('.') : 'value';
          return `${path}: ${e.message}`;
        });
        
        return sendError(res, { 
          message: `Validation failed: ${messages.join(', ')}`,
          details: error.errors 
        }, 'Validation', 400);
      }
      
      return sendError(res, error, 'Validation', 400);
    }
  };
};

/**
 * Validates request params (URL parameters)
 */
export const validateParams = (schema) => validate(schema, 'params');

/**
 * Validates query parameters
 */
export const validateQuery = (schema) => validate(schema, 'query');

/**
 * Validates request body (default)
 */
export const validateBody = (schema) => validate(schema, 'body');
