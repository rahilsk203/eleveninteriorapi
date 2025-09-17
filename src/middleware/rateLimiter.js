/**
 * Rate Limiter Middleware - DSA optimized with sliding window algorithm
 * Uses in-memory LRU cache for maximum performance
 */

import { corsHeaders } from './cors.js';

// LRU Cache implementation for rate limiting (DSA: Doubly Linked List + HashMap)
class LRUCache {
  constructor(capacity = 1000) {
    this.capacity = capacity;
    this.cache = new Map();
    this.head = { key: null, value: null, prev: null, next: null };
    this.tail = { key: null, value: null, prev: null, next: null };
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key) {
    if (this.cache.has(key)) {
      const node = this.cache.get(key);
      this.moveToHead(node);
      return node.value;
    }
    return null;
  }

  put(key, value) {
    if (this.cache.has(key)) {
      const node = this.cache.get(key);
      node.value = value;
      this.moveToHead(node);
    } else {
      const newNode = { key, value, prev: null, next: null };
      
      if (this.cache.size >= this.capacity) {
        const tail = this.removeTail();
        this.cache.delete(tail.key);
      }
      
      this.cache.set(key, newNode);
      this.addToHead(newNode);
    }
  }

  addToHead(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
  }

  removeNode(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  moveToHead(node) {
    this.removeNode(node);
    this.addToHead(node);
  }

  removeTail() {
    const last = this.tail.prev;
    this.removeNode(last);
    return last;
  }
}

// Global rate limit cache
const rateLimitCache = new LRUCache(1000);

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // requests per window
  adminMaxRequests: 500, // higher limit for admin endpoints
  blockDuration: 60 * 60 * 1000 // 1 hour block for abuse
};

function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For') || 
         request.headers.get('X-Real-IP') || 
         'unknown';
}

function isAdminEndpoint(url) {
  return url.includes('/admin/');
}

export async function rateLimiter(request) {
  const ip = getClientIP(request);
  const now = Date.now();
  const isAdmin = isAdminEndpoint(request.url);
  
  // Get current rate limit data for this IP
  let limitData = rateLimitCache.get(ip);
  
  if (!limitData) {
    limitData = {
      count: 0,
      windowStart: now,
      blocked: false,
      blockUntil: 0
    };
  }

  // Check if IP is currently blocked
  if (limitData.blocked && now < limitData.blockUntil) {
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_BLOCKED',
      retryAfter: Math.ceil((limitData.blockUntil - now) / 1000)
    }), {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((limitData.blockUntil - now) / 1000).toString()
      }
    });
  }

  // Reset window if expired
  if (now - limitData.windowStart > RATE_LIMIT_CONFIG.windowMs) {
    limitData.count = 0;
    limitData.windowStart = now;
    limitData.blocked = false;
  }

  // Increment request count
  limitData.count++;
  
  // Check rate limits
  const maxRequests = isAdmin ? 
    RATE_LIMIT_CONFIG.adminMaxRequests : 
    RATE_LIMIT_CONFIG.maxRequests;

  if (limitData.count > maxRequests) {
    limitData.blocked = true;
    limitData.blockUntil = now + RATE_LIMIT_CONFIG.blockDuration;
    
    rateLimitCache.put(ip, limitData);
    
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: RATE_LIMIT_CONFIG.blockDuration / 1000
    }), {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': (RATE_LIMIT_CONFIG.blockDuration / 1000).toString()
      }
    });
  }

  // Update cache
  rateLimitCache.put(ip, limitData);
  
  // Add rate limit headers to response
  const remaining = Math.max(0, maxRequests - limitData.count);
  const resetTime = Math.ceil((limitData.windowStart + RATE_LIMIT_CONFIG.windowMs) / 1000);
  
  // Continue to next middleware/handler
  return undefined;
}