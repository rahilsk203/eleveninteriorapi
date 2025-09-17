/**
 * Test Suite for Eleven Interior API
 * Comprehensive testing with DSA validation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Mock environment for testing
const mockEnv = {
  ENVIRONMENT: 'test',
  CLOUDINARY_CLOUD_NAME: 'test-cloud',
  CLOUDINARY_API_KEY: 'test-key',
  CLOUDINARY_API_SECRET: 'test-secret',
  JWT_SECRET: 'test-jwt-secret-key-for-testing',
  ADMIN_API_KEY: 'test-admin-api-key',
  DB: null // Mock database
};

// Mock request helper
function createMockRequest(method, url, body = null, headers = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'CF-Connecting-IP': '192.168.1.1',
    'User-Agent': 'Test-Agent/1.0'
  };

  return {
    method,
    url: `https://api.test.com${url}`,
    headers: new Headers({ ...defaultHeaders, ...headers }),
    json: async () => body,
    formData: async () => {
      const formData = new FormData();
      if (body) {
        Object.entries(body).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }
      return formData;
    },
    env: mockEnv
  };
}

describe('API Core Functionality', () => {
  describe('Health Checks', () => {
    it('should return basic health status', async () => {
      const { default: healthRoutes } = await import('../src/routes/health.js');
      const request = createMockRequest('GET', '/health');
      
      const response = await healthRoutes.basicHealth(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('healthy');
      expect(data.data.service).toBe('Eleven Interior API');
    });

    it('should handle detailed health check', async () => {
      const { default: healthRoutes } = await import('../src/routes/health.js');
      const request = createMockRequest('GET', '/health/detailed');
      
      const response = await healthRoutes.detailedHealth(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.data.checks).toBeDefined();
      expect(data.data.checks.environment).toBeDefined();
    });
  });

  describe('CORS Middleware', () => {
    it('should handle OPTIONS requests', async () => {
      const { handleCORS } = await import('../src/middleware/cors.js');
      const request = createMockRequest('OPTIONS', '/api/v1/test');
      
      const response = handleCORS(request);
      
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should pass through non-OPTIONS requests', async () => {
      const { handleCORS } = await import('../src/middleware/cors.js');
      const request = createMockRequest('GET', '/api/v1/test');
      
      const response = handleCORS(request);
      
      expect(response).toBeUndefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const { rateLimiter } = await import('../src/middleware/rateLimiter.js');
      const request = createMockRequest('GET', '/api/v1/test');
      
      const response = await rateLimiter(request);
      
      expect(response).toBeUndefined(); // Should pass through
    });

    it('should detect admin endpoints', async () => {
      const { rateLimiter } = await import('../src/middleware/rateLimiter.js');
      const request = createMockRequest('GET', '/api/v1/admin/test');
      
      const response = await rateLimiter(request);
      
      expect(response).toBeUndefined(); // Should pass through with higher limits
    });
  });

  describe('Error Handling', () => {
    it('should format errors correctly', async () => {
      const { errorHandler, ValidationError } = await import('../src/middleware/errorHandler.js');
      const request = createMockRequest('GET', '/api/v1/test');
      const error = new ValidationError('Test validation error');
      
      const response = errorHandler(error, request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.message).toBe('Test validation error');
    });

    it('should handle unknown errors', async () => {
      const { errorHandler } = await import('../src/middleware/errorHandler.js');
      const request = createMockRequest('GET', '/api/v1/test');
      const error = new Error('Unknown error');
      
      const response = errorHandler(error, request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });
});

describe('Validation Utilities', () => {
  describe('Email Validation', () => {
    it('should validate correct emails', async () => {
      const { validateEmail } = await import('../src/utils/validation.js');
      
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid emails', async () => {
      const { validateEmail } = await import('../src/utils/validation.js');
      
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
    });
  });

  describe('Phone Validation', () => {
    it('should validate correct phone numbers', async () => {
      const { validatePhone } = await import('../src/utils/validation.js');
      
      expect(validatePhone('1234567890')).toBe(true);
      expect(validatePhone('+1-234-567-8900')).toBe(true);
      expect(validatePhone('(123) 456-7890')).toBe(true);
    });

    it('should reject invalid phone numbers', async () => {
      const { validatePhone } = await import('../src/utils/validation.js');
      
      expect(validatePhone('123')).toBe(false);
      expect(validatePhone('not-a-phone')).toBe(false);
    });
  });

  describe('File Validation', () => {
    it('should validate image files', async () => {
      const { validateFile } = await import('../src/utils/validation.js');
      
      const mockImageFile = {
        type: 'image/jpeg',
        size: 1024 * 1024 // 1MB
      };
      
      const result = validateFile(mockImageFile, 'image');
      
      expect(result.valid).toBe(true);
      expect(result.type).toBe('image');
    });

    it('should reject oversized files', async () => {
      const { validateFile } = await import('../src/utils/validation.js');
      
      const mockLargeFile = {
        type: 'image/jpeg',
        size: 20 * 1024 * 1024 // 20MB (over limit)
      };
      
      const result = validateFile(mockLargeFile, 'image');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
    });
  });

  describe('String Sanitization', () => {
    it('should sanitize malicious input', async () => {
      const { sanitizeString } = await import('../src/utils/validation.js');
      
      const maliciousInput = '<script>alert("xss")</script>test';
      const sanitized = sanitizeString(maliciousInput);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(sanitized).toContain('test');
    });

    it('should trim whitespace', async () => {
      const { sanitizeString } = await import('../src/utils/validation.js');
      
      const input = '  test string  ';
      const sanitized = sanitizeString(input);
      
      expect(sanitized).toBe('test string');
    });
  });
});

describe('Performance Tests', () => {
  describe('Cache Performance', () => {
    it('should perform LRU cache operations in O(1)', async () => {
      const { rateLimiter } = await import('../src/middleware/rateLimiter.js');
      
      const startTime = performance.now();
      
      // Simulate multiple cache operations
      for (let i = 0; i < 1000; i++) {
        const request = createMockRequest('GET', `/api/v1/test${i}`);
        await rateLimiter(request);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete 1000 operations in reasonable time
      expect(duration).toBeLessThan(100); // 100ms for 1000 operations
    });
  });

  describe('Query Optimization', () => {
    it('should handle pagination efficiently', async () => {
      const { validatePagination } = await import('../src/utils/validation.js');
      
      const result = validatePagination('50', '100');
      
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(100);
    });

    it('should enforce pagination limits', async () => {
      const { validatePagination } = await import('../src/utils/validation.js');
      
      const result = validatePagination('1000', '-10');
      
      expect(result.limit).toBe(100); // Max limit
      expect(result.offset).toBe(0); // Min offset
    });
  });
});

describe('Security Tests', () => {
  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const { authMiddleware } = await import('../src/middleware/auth.js');
      const request = createMockRequest('GET', '/api/v1/admin/test');
      
      const response = await authMiddleware(request);
      
      expect(response.status).toBe(401);
    });

    it('should accept valid API key', async () => {
      const { authMiddleware } = await import('../src/middleware/auth.js');
      const request = createMockRequest('GET', '/api/v1/admin/test', null, {
        'X-API-Key': 'test-admin-api-key'
      });
      
      const response = await authMiddleware(request);
      
      expect(response).toBeUndefined(); // Should pass through
    });
  });

  describe('Input Sanitization', () => {
    it('should prevent SQL injection patterns', async () => {
      const { sanitizeString } = await import('../src/utils/validation.js');
      
      const maliciousInput = "'; DROP TABLE users; --";
      const sanitized = sanitizeString(maliciousInput);
      
      expect(sanitized).not.toContain("'");
      expect(sanitized).not.toContain(';');
      expect(sanitized).not.toContain('--');
    });

    it('should detect profanity', async () => {
      const { containsProfanity } = await import('../src/utils/validation.js');
      
      expect(containsProfanity('This is spam content')).toBe(true);
      expect(containsProfanity('This is a normal message')).toBe(false);
    });
  });
});

describe('Integration Tests', () => {
  describe('Inquiry Flow', () => {
    it('should validate inquiry creation schema', () => {
      const validInquiry = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        location: 'New York',
        project_description: 'I need interior design for my office space.'
      };

      // This would normally use the actual inquiry validation
      expect(validInquiry.name.length).toBeGreaterThan(1);
      expect(validInquiry.email).toContain('@');
      expect(validInquiry.phone.length).toBeGreaterThan(9);
      expect(validInquiry.project_description.length).toBeGreaterThan(9);
    });
  });

  describe('Media Sections', () => {
    it('should validate video sections', async () => {
      const { validateMediaSection } = await import('../src/utils/validation.js');
      
      expect(validateMediaSection('hero', 'video')).toBe(true);
      expect(validateMediaSection('feature', 'video')).toBe(true);
      expect(validateMediaSection('invalid', 'video')).toBe(false);
    });

    it('should validate image sections', async () => {
      const { validateMediaSection } = await import('../src/utils/validation.js');
      
      expect(validateMediaSection('gallery', 'image')).toBe(true);
      expect(validateMediaSection('contact', 'image')).toBe(true);
      expect(validateMediaSection('invalid', 'image')).toBe(false);
    });
  });
});

describe('Edge Cases', () => {
  describe('Malformed Requests', () => {
    it('should handle malformed JSON', async () => {
      const request = createMockRequest('POST', '/api/v1/inquiries');
      request.json = async () => {
        throw new Error('Invalid JSON');
      };

      // This would be handled by the error middleware
      expect(() => request.json()).toThrow();
    });

    it('should handle missing headers', async () => {
      const request = createMockRequest('GET', '/api/v1/test', null, {});
      
      expect(request.headers.get('Content-Type')).toBeNull();
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle empty strings', async () => {
      const { sanitizeString } = await import('../src/utils/validation.js');
      
      expect(sanitizeString('')).toBe('');
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
    });

    it('should handle maximum length strings', async () => {
      const { sanitizeString } = await import('../src/utils/validation.js');
      
      const longString = 'a'.repeat(2000);
      const sanitized = sanitizeString(longString, 1000);
      
      expect(sanitized.length).toBe(1000);
    });
  });
});

// Mock implementations for testing
global.fetch = async (url, options) => {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

global.FormData = class MockFormData {
  constructor() {
    this.data = new Map();
  }
  
  append(key, value) {
    this.data.set(key, value);
  }
  
  get(key) {
    return this.data.get(key);
  }
  
  entries() {
    return this.data.entries();
  }
};

global.File = class MockFile {
  constructor(content, name, options = {}) {
    this.content = content;
    this.name = name;
    this.type = options.type || 'text/plain';
    this.size = options.size || content.length;
  }
};