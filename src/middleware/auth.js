/**
 * Authentication Middleware - JWT and API Key based
 * DSA Optimization: Hash-based token validation for O(1) lookup
 */

import { corsHeaders } from './cors.js';

// Simple JWT decode (for header and payload extraction)
function decodeJWT(token) {
  try {
    const [header, payload] = token.split('.');
    return {
      header: JSON.parse(atob(header)),
      payload: JSON.parse(atob(payload))
    };
  } catch (error) {
    return null;
  }
}

// Verify JWT signature using Web Crypto API
async function verifyJWT(token, secret) {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    
    if (!headerB64 || !payloadB64 || !signatureB64) {
      return false;
    }

    // Recreate the signature
    const data = `${headerB64}.${payloadB64}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    const expectedSignature = new Uint8Array(signature);
    
    // Compare signatures
    const actualSignature = new Uint8Array(
      atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map(char => char.charCodeAt(0))
    );

    if (expectedSignature.length !== actualSignature.length) {
      return false;
    }

    for (let i = 0; i < expectedSignature.length; i++) {
      if (expectedSignature[i] !== actualSignature[i]) {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}

// Create authentication error response
function createAuthError(message, code = 'UNAUTHORIZED') {
  return new Response(JSON.stringify({
    error: message,
    code: code,
    timestamp: new Date().toISOString()
  }), {
    status: 401,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

export async function authMiddleware(request) {
  try {
    const url = new URL(request.url);
    
    // Skip auth for OPTIONS requests
    if (request.method === 'OPTIONS') {
      return undefined;
    }

    // Get authorization header
    const authorization = request.headers.get('Authorization');
    const apiKey = request.headers.get('X-API-Key');
    
    // Check for API key authentication (simpler for admin operations)
    if (apiKey) {
      const validApiKey = request.env.ADMIN_API_KEY;
      
      if (!validApiKey) {
        return createAuthError('Server configuration error', 'CONFIG_ERROR');
      }
      
      if (apiKey !== validApiKey) {
        return createAuthError('Invalid API key', 'INVALID_API_KEY');
      }
      
      // API key is valid, continue
      return undefined;
    }

    // Check for JWT token
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return createAuthError('Missing or invalid authorization header', 'MISSING_AUTH');
    }

    const token = authorization.substring(7); // Remove 'Bearer '
    
    if (!token) {
      return createAuthError('Missing token', 'MISSING_TOKEN');
    }

    // Get JWT secret from environment
    const jwtSecret = request.env.JWT_SECRET;
    
    if (!jwtSecret) {
      return createAuthError('Server configuration error', 'CONFIG_ERROR');
    }

    // Decode and verify JWT
    const decoded = decodeJWT(token);
    
    if (!decoded) {
      return createAuthError('Invalid token format', 'INVALID_TOKEN');
    }

    // Check token expiration
    const now = Math.floor(Date.now() / 1000);
    if (decoded.payload.exp && decoded.payload.exp < now) {
      return createAuthError('Token expired', 'TOKEN_EXPIRED');
    }

    // Verify token signature
    const isValid = await verifyJWT(token, jwtSecret);
    
    if (!isValid) {
      return createAuthError('Invalid token signature', 'INVALID_SIGNATURE');
    }

    // Attach user info to request for downstream handlers
    request.user = decoded.payload;
    
    // Continue to next middleware/handler
    return undefined;
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    return createAuthError('Authentication failed', 'AUTH_ERROR');
  }
}