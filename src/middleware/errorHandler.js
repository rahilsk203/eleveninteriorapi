/**
 * Error Handler Middleware - Centralized error handling with logging
 * DSA Optimization: Error categorization with hash maps for fast lookup
 */

import { corsHeaders } from './cors.js';

// Error categories for fast lookup (O(1) access)
const ERROR_CATEGORIES = new Map([
  ['ValidationError', { status: 400, code: 'VALIDATION_ERROR' }],
  ['NotFoundError', { status: 404, code: 'NOT_FOUND' }],
  ['UnauthorizedError', { status: 401, code: 'UNAUTHORIZED' }],
  ['ForbiddenError', { status: 403, code: 'FORBIDDEN' }],
  ['ConflictError', { status: 409, code: 'CONFLICT' }],
  ['RateLimitError', { status: 429, code: 'RATE_LIMIT' }],
  ['CloudinaryError', { status: 503, code: 'EXTERNAL_SERVICE_ERROR' }],
  ['DatabaseError', { status: 500, code: 'DATABASE_ERROR' }],
  ['NetworkError', { status: 503, code: 'NETWORK_ERROR' }]
]);

// Extract error details with fallback
function getErrorDetails(error) {
  // Check if it's a known error type
  const errorType = error.constructor.name;
  const category = ERROR_CATEGORIES.get(errorType);
  
  if (category) {
    return {
      status: category.status,
      code: category.code,
      message: error.message || 'An error occurred'
    };
  }

  // Handle HTTP errors from fetch operations
  if (error.status && error.status >= 400) {
    return {
      status: error.status,
      code: 'HTTP_ERROR',
      message: error.message || `HTTP ${error.status} error`
    };
  }

  // Default to internal server error
  return {
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred'
  };
}

// Log error for monitoring (structured logging)
function logError(error, request, errorDetails) {
  const logData = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.constructor.name,
      message: error.message,
      stack: error.stack,
      code: errorDetails.code
    },
    request: {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      userAgent: request.headers.get('User-Agent'),
      ip: request.headers.get('CF-Connecting-IP') || 
          request.headers.get('X-Forwarded-For') || 
          'unknown'
    },
    response: {
      status: errorDetails.status
    }
  };

  // In production, you might want to send this to an external logging service
  console.error('API Error:', JSON.stringify(logData, null, 2));
}

// Create standardized error response
function createErrorResponse(errorDetails, request, includeStack = false) {
  const response = {
    error: {
      code: errorDetails.code,
      message: errorDetails.message,
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      path: new URL(request.url).pathname
    }
  };

  // Include stack trace in development
  if (includeStack && request.env?.ENVIRONMENT !== 'production') {
    response.error.stack = errorDetails.stack;
  }

  return new Response(JSON.stringify(response, null, 2), {
    status: errorDetails.status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Request-ID': response.error.requestId
    }
  });
}

// Main error handler
export function errorHandler(error, request) {
  try {
    // Get error details
    const errorDetails = getErrorDetails(error);
    
    // Log error for monitoring
    logError(error, request, errorDetails);
    
    // Determine if we should include stack trace
    const includeStack = request.env?.ENVIRONMENT !== 'production';
    
    // Create and return error response
    return createErrorResponse({
      ...errorDetails,
      stack: error.stack
    }, request, includeStack);
    
  } catch (handlerError) {
    // Fallback error response if error handler itself fails
    console.error('Error handler failed:', handlerError);
    
    return new Response(JSON.stringify({
      error: {
        code: 'ERROR_HANDLER_FAILURE',
        message: 'Critical error in error handling',
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

// Custom error classes for better error categorization
export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class NotFoundError extends Error {
  constructor(resource) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized access') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class CloudinaryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CloudinaryError';
  }
}

export class DatabaseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DatabaseError';
  }
}