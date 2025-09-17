/**
 * Authentication Routes - Login and Session Management
 * Provides JWT-based authentication with secure session handling
 */

import { corsHeaders } from '../middleware/cors.js';
import { DatabaseService } from '../services/database.js';
import { ValidationError, AuthenticationError } from '../middleware/errorHandler.js';
import { z } from 'zod';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Confirm password is required')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

// Helper function to hash passwords
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper function to generate JWT
async function generateJWT(payload, secret, expiresIn = '24h') {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const exp = now + (expiresIn === '24h' ? 24 * 60 * 60 : 
                     expiresIn === '7d' ? 7 * 24 * 60 * 60 : 
                     parseInt(expiresIn));

  const jwtPayload = {
    ...payload,
    iat: now,
    exp: exp
  };

  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '');
  const payloadB64 = btoa(JSON.stringify(jwtPayload)).replace(/=/g, '');
  
  const data = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

// Helper function to generate secure random token
function generateRefreshToken() {
  return crypto.randomUUID() + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Create standardized response
function createResponse(data, status = 200) {
  return new Response(JSON.stringify({
    success: true,
    data,
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

// Create error response
function createErrorResponse(message, status = 400, code = 'ERROR') {
  return new Response(JSON.stringify({
    success: false,
    error: {
      message,
      code
    },
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

class AuthRoutes {
  constructor() {
    this.login = this.login.bind(this);
    this.refreshToken = this.refreshToken.bind(this);
    this.logout = this.logout.bind(this);
    this.changePassword = this.changePassword.bind(this);
    this.getProfile = this.getProfile.bind(this);
    this.createAdminUser = this.createAdminUser.bind(this);
    this.getAdminApiKey = this.getAdminApiKey.bind(this);
    this.regenerateApiKey = this.regenerateApiKey.bind(this);
  }

  // Admin login
  async login(request) {
    try {
      const body = await request.json();
      const validatedData = loginSchema.parse(body);

      const db = new DatabaseService(request.env.DB);
      
      // Check if admin user exists
      const user = await this.getAdminUser(db, validatedData.email);
      
      if (!user) {
        return createErrorResponse('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Verify password
      const hashedPassword = await hashPassword(validatedData.password);
      if (hashedPassword !== user.password_hash) {
        return createErrorResponse('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Generate tokens
      const accessToken = await generateJWT({
        userId: user.id,
        email: user.email,
        role: user.role,
        type: 'access'
      }, request.env.JWT_SECRET, '24h');

      const refreshToken = generateRefreshToken();

      // Store refresh token in database
      await this.storeRefreshToken(db, user.id, refreshToken);

      // Update last login
      await db.executeQuery(
        'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
      );

      return createResponse({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          created_at: user.created_at,
          last_login: new Date().toISOString()
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 24 * 60 * 60, // 24 hours in seconds
          tokenType: 'Bearer'
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
      }
      throw error;
    }
  }

  // Refresh access token
  async refreshToken(request) {
    try {
      const body = await request.json();
      const validatedData = refreshTokenSchema.parse(body);

      const db = new DatabaseService(request.env.DB);
      
      // Verify refresh token
      const tokenData = await this.verifyRefreshToken(db, validatedData.refreshToken);
      
      if (!tokenData) {
        return createErrorResponse('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }

      // Get user data
      const user = await this.getAdminUserById(db, tokenData.user_id);
      
      if (!user) {
        return createErrorResponse('User not found', 404, 'USER_NOT_FOUND');
      }

      // Generate new access token
      const accessToken = await generateJWT({
        userId: user.id,
        email: user.email,
        role: user.role,
        type: 'access'
      }, request.env.JWT_SECRET, '24h');

      return createResponse({
        tokens: {
          accessToken,
          expiresIn: 24 * 60 * 60,
          tokenType: 'Bearer'
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
      }
      throw error;
    }
  }

  // Logout (invalidate refresh token)
  async logout(request) {
    try {
      const body = await request.json();
      const { refreshToken } = body;

      if (refreshToken) {
        const db = new DatabaseService(request.env.DB);
        await this.revokeRefreshToken(db, refreshToken);
      }

      return createResponse({
        message: 'Logged out successfully'
      });

    } catch (error) {
      throw error;
    }
  }

  // Change password
  async changePassword(request) {
    try {
      const body = await request.json();
      const validatedData = changePasswordSchema.parse(body);

      const userId = request.user?.userId;
      if (!userId) {
        return createErrorResponse('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }

      const db = new DatabaseService(request.env.DB);
      const user = await this.getAdminUserById(db, userId);
      
      if (!user) {
        return createErrorResponse('User not found', 404, 'USER_NOT_FOUND');
      }

      // Verify current password
      const currentPasswordHash = await hashPassword(validatedData.currentPassword);
      if (currentPasswordHash !== user.password_hash) {
        return createErrorResponse('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
      }

      // Hash new password
      const newPasswordHash = await hashPassword(validatedData.newPassword);

      // Update password
      await db.executeQuery(
        'UPDATE admin_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newPasswordHash, userId]
      );

      // Revoke all refresh tokens for this user (force re-login on all devices)
      await db.executeQuery(
        'DELETE FROM refresh_tokens WHERE user_id = ?',
        [userId]
      );

      return createResponse({
        message: 'Password changed successfully. Please log in again.'
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
      }
      throw error;
    }
  }

  // Get user profile
  async getProfile(request) {
    try {
      const userId = request.user?.userId;
      if (!userId) {
        return createErrorResponse('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }

      const db = new DatabaseService(request.env.DB);
      const user = await this.getAdminUserById(db, userId);
      
      if (!user) {
        return createErrorResponse('User not found', 404, 'USER_NOT_FOUND');
      }

      return createResponse({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          created_at: user.created_at,
          last_login: user.last_login
        }
      });

    } catch (error) {
      throw error;
    }
  }

  // Create admin user (for initial setup)
  async createAdminUser(request) {
    try {
      const body = await request.json();
      const validatedData = loginSchema.parse(body);

      const db = new DatabaseService(request.env.DB);
      
      // Check if any admin user already exists
      const existingUser = await db.executeQuery('SELECT COUNT(*) as count FROM admin_users');
      if (existingUser.results[0]?.count > 0) {
        return createErrorResponse('Admin user already exists', 403, 'ADMIN_EXISTS');
      }

      // Hash password
      const passwordHash = await hashPassword(validatedData.password);

      // Create admin user
      const result = await db.executeQuery(
        'INSERT INTO admin_users (email, password_hash, role) VALUES (?, ?, ?)',
        [validatedData.email, passwordHash, 'admin']
      );

      return createResponse({
        message: 'Admin user created successfully',
        userId: result.meta.last_row_id,
        adminApiKey: request.env.ADMIN_API_KEY || 'API key not configured'
      }, 201);

    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(error.errors[0].message, 400, 'VALIDATION_ERROR');
      }
      throw error;
    }
  }

  // Get admin API key (protected endpoint)
  async getAdminApiKey(request) {
    try {
      const userId = request.user?.userId;
      if (!userId) {
        return createErrorResponse('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }

      const db = new DatabaseService(request.env.DB);
      const user = await this.getAdminUserById(db, userId);
      
      if (!user || user.role !== 'admin') {
        return createErrorResponse('Access denied. Admin role required.', 403, 'ACCESS_DENIED');
      }

      return createResponse({
        adminApiKey: request.env.ADMIN_API_KEY || 'API key not configured',
        message: 'Admin API key retrieved successfully',
        usage: {
          header: 'X-API-Key',
          example: `X-API-Key: ${request.env.ADMIN_API_KEY || 'your-api-key-here'}`
        }
      });

    } catch (error) {
      throw error;
    }
  }

  // Regenerate admin API key (for security)
  async regenerateApiKey(request) {
    try {
      const userId = request.user?.userId;
      if (!userId) {
        return createErrorResponse('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }

      const db = new DatabaseService(request.env.DB);
      const user = await this.getAdminUserById(db, userId);
      
      if (!user || user.role !== 'admin') {
        return createErrorResponse('Access denied. Admin role required.', 403, 'ACCESS_DENIED');
      }

      // Generate new API key
      const newApiKey = 'eleven-interior-admin-' + Date.now() + '-' + Math.random().toString(36).substr(2, 12);

      return createResponse({
        message: 'New API key generated. Please update your environment variables.',
        newApiKey: newApiKey,
        currentApiKey: request.env.ADMIN_API_KEY || 'Not configured',
        instructions: {
          step1: 'Update ADMIN_API_KEY in wrangler.toml',
          step2: 'Redeploy the application',
          step3: 'Update all clients using the old API key'
        }
      });

    } catch (error) {
      throw error;
    }
  }

  // Helper methods
  async getAdminUser(db, email) {
    const result = await db.executeQuery(
      'SELECT * FROM admin_users WHERE email = ? AND is_active = 1',
      [email]
    );
    return result.results[0] || null;
  }

  async getAdminUserById(db, userId) {
    const result = await db.executeQuery(
      'SELECT * FROM admin_users WHERE id = ? AND is_active = 1',
      [userId]
    );
    return result.results[0] || null;
  }

  async storeRefreshToken(db, userId, refreshToken) {
    // Delete existing refresh tokens for this user (limit to 1 active session)
    await db.executeQuery('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
    
    // Store new refresh token
    await db.executeQuery(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, datetime("now", "+7 days"))',
      [userId, refreshToken]
    );
  }

  async verifyRefreshToken(db, refreshToken) {
    const result = await db.executeQuery(
      'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime("now") AND is_active = 1',
      [refreshToken]
    );
    return result.results[0] || null;
  }

  async revokeRefreshToken(db, refreshToken) {
    await db.executeQuery(
      'UPDATE refresh_tokens SET is_active = 0 WHERE token = ?',
      [refreshToken]
    );
  }
}

// Export singleton instance
const authRoutes = new AuthRoutes();
export default authRoutes;