/**
 * Response Helper
 * 
 * Provides standardized success and error response formats.
 * All API responses follow a consistent structure for better client handling.
 */

/**
 * Send success response
 * @param {import('express').Response} res - Express response object
 * @param {any} data - Data to send
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
export const sendSuccess = (res, data, message = null, statusCode = 200) => {
  const response = {
    success: true,
    data
  };
  
  if (message) {
    response.message = message;
  }
  
  res.status(statusCode).json(response);
};

/**
 * Send created response (201)
 */
export const sendCreated = (res, data, message = 'Resource created successfully') => {
  sendSuccess(res, data, message, 201);
};

/**
 * Send no content response (204)
 */
export const sendNoContent = (res) => {
  res.status(204).send();
};

/**
 * Standardized error response format
 * @typedef {Object} ErrorResponse
 * @property {boolean} success - Always false
 * @property {string} error - Error message
 * @property {string} [context] - Where the error occurred
 * @property {Array} [details] - Validation error details
 */

/**
 * Send error response
 * @param {import('express').Response} res - Express response object
 * @param {Error|Object} error - Error object or error details
 * @param {string} context - Context where error occurred (e.g., 'Create Asset')
 * @param {number} [statusCode] - HTTP status code (default: 500)
 * @returns {import('express').Response}
 */
export const sendError = (res, error, context = "Operation", statusCode = null) => {
  // Determine status code
  let code = statusCode || error.statusCode || 500;
  
  // Handle specific error types
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    code = 409; // Conflict
  } else if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    code = 400; // Bad Request
  } else if (error.message && error.message.includes('not found')) {
    code = 404; // Not Found
  }
  
  // Log error for debugging
  console.error(`[${context}]`, error);
  
  // Build error response
  const response = {
    success: false,
    error: error.message || 'Internal Server Error',
    context
  };
  
  // Include validation details if present
  if (error.details && Array.isArray(error.details)) {
    response.details = error.details;
  }
  
  // Don't expose internal details in production for 500 errors
  if (code === 500 && process.env.NODE_ENV === 'production') {
    response.error = 'Internal Server Error';
    delete response.details;
  }
  
  return res.status(code).json(response);
};

/**
 * Common HTTP status codes for reference
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500
};
