/**
 * Validation Utilities - Input validation and sanitization
 * DSA Optimization: Pre-compiled regex patterns and cached validators
 */

// Pre-compiled regex patterns for performance
const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[\+]?[1-9][\d]{3,20}$/,
  url: /^https?:\/\/[^\s/$.?#].[^\s]*$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  filename: /^[a-zA-Z0-9._-]+$/,
  base64: /^[A-Za-z0-9+/]*={0,2}$/
};

// File type mappings for O(1) lookup
const ALLOWED_FILE_TYPES = new Map([
  // Images
  ['image/jpeg', { type: 'image', maxSize: 10 * 1024 * 1024 }],
  ['image/jpg', { type: 'image', maxSize: 10 * 1024 * 1024 }],
  ['image/png', { type: 'image', maxSize: 10 * 1024 * 1024 }],
  ['image/webp', { type: 'image', maxSize: 10 * 1024 * 1024 }],
  ['image/gif', { type: 'image', maxSize: 10 * 1024 * 1024 }],
  
  // Videos
  ['video/mp4', { type: 'video', maxSize: 100 * 1024 * 1024 }],
  ['video/webm', { type: 'video', maxSize: 100 * 1024 * 1024 }],
  ['video/ogg', { type: 'video', maxSize: 100 * 1024 * 1024 }],
  ['video/mov', { type: 'video', maxSize: 100 * 1024 * 1024 }],
  ['video/avi', { type: 'video', maxSize: 100 * 1024 * 1024 }]
]);

// Sanitize string input
export function sanitizeString(input, maxLength = 1000) {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove basic HTML tags
    .replace(/\0/g, ''); // Remove null bytes
}

// Validate email format
export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return PATTERNS.email.test(email.trim().toLowerCase());
}

// Validate phone number
export function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return PATTERNS.phone.test(cleaned);
}

// Validate URL
export function validateUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return PATTERNS.url.test(url.trim());
}

// Validate file type and size
export function validateFile(file, expectedType = null) {
  if (!file || !(file instanceof File)) {
    return { valid: false, error: 'Invalid file object' };
  }

  const fileTypeInfo = ALLOWED_FILE_TYPES.get(file.type);
  if (!fileTypeInfo) {
    return { 
      valid: false, 
      error: `Unsupported file type: ${file.type}` 
    };
  }

  if (expectedType && fileTypeInfo.type !== expectedType) {
    return { 
      valid: false, 
      error: `Expected ${expectedType} file, got ${fileTypeInfo.type}` 
    };
  }

  if (file.size > fileTypeInfo.maxSize) {
    const maxSizeMB = fileTypeInfo.maxSize / (1024 * 1024);
    return { 
      valid: false, 
      error: `File too large. Maximum size: ${maxSizeMB}MB` 
    };
  }

  return { valid: true, type: fileTypeInfo.type };
}

// Rate limiting key generation
export function generateRateLimitKey(ip, endpoint = '') {
  return `rate_limit:${ip}:${endpoint}`;
}

// Generate secure random string
export function generateSecureRandom(length = 32) {
  const array = new Uint8Array(length / 2);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Hash string using Web Crypto API
export async function hashString(input, algorithm = 'SHA-256') {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest(algorithm, data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Validate and parse JSON safely
export function parseJsonSafely(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return defaultValue;
  }
}

// Extract client IP address
export function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 
         request.headers.get('X-Real-IP') || 
         'unknown';
}

// Validate pagination parameters
export function validatePagination(limit, offset) {
  const validatedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const validatedOffset = Math.max(parseInt(offset) || 0, 0);
  
  return { limit: validatedLimit, offset: validatedOffset };
}

// Check if string contains profanity (basic implementation)
export function containsProfanity(text) {
  const profanityWords = ['spam', 'scam', 'fake']; // Basic list
  const lowercaseText = text.toLowerCase();
  
  return profanityWords.some(word => lowercaseText.includes(word));
}

// Generate API response with consistent format
export function formatApiResponse(data, success = true, meta = null) {
  const response = {
    success,
    data,
    timestamp: new Date().toISOString()
  };
  
  if (meta) {
    response.meta = meta;
  }
  
  return response;
}

// Validate section names for media
export function validateMediaSection(section, mediaType) {
  const validSections = new Map([
    ['video', new Set(['hero', 'feature'])],
    ['image', new Set(['contact', 'entrance', 'gallery', 'logo', 'about', 'swordman'])]
  ]);
  
  const allowedSections = validSections.get(mediaType);
  return allowedSections ? allowedSections.has(section) : false;
}

// Performance monitoring helper
export class PerformanceMonitor {
  constructor(label) {
    this.label = label;
    this.startTime = performance.now();
  }
  
  end() {
    const duration = performance.now() - this.startTime;
    console.log(`[Performance] ${this.label}: ${duration.toFixed(2)}ms`);
    return duration;
  }
}

// Request context helper
export function createRequestContext(request, env) {
  return {
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    userAgent: request.headers.get('User-Agent'),
    ip: getClientIP(request),
    environment: env.ENVIRONMENT || 'unknown'
  };
}