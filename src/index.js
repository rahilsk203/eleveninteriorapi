/**
 * Eleven Interior API - High Performance Cloudflare Worker
 * Optimized with DSA principles for maximum efficiency
 */

import { Router } from 'itty-router';
import { corsHeaders, handleCORS } from './middleware/cors.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import videoRoutes from './routes/videos.js';
import imageRoutes from './routes/images.js';
import inquiryRoutes from './routes/inquiries.js';
import healthRoutes from './routes/health.js';

// Create optimized router with pre-compiled route tree
const router = Router();

// Health check endpoint (no auth required)
router.all('/health/*', healthRoutes.handle);

// CORS preflight handling
router.options('*', handleCORS);

// Apply global middleware pipeline
router.all('*', rateLimiter);

// Public endpoints (no auth required)
router.get('/api/v1/videos/:section', videoRoutes.getVideo);
router.get('/api/v1/images/:section', imageRoutes.getImages);
router.post('/api/v1/inquiries', inquiryRoutes.createInquiry);

// Protected endpoints (auth required)
router.all('/api/v1/admin/*', authMiddleware);
router.post('/api/v1/admin/videos/upload', videoRoutes.uploadVideo);
router.put('/api/v1/admin/videos/:section', videoRoutes.updateVideo);
router.delete('/api/v1/admin/videos/:section', videoRoutes.deleteVideo);

router.post('/api/v1/admin/images/upload', imageRoutes.uploadImage);
router.put('/api/v1/admin/images/:section/:id', imageRoutes.updateImage);
router.delete('/api/v1/admin/images/:section/:id', imageRoutes.deleteImage);

router.get('/api/v1/admin/inquiries', inquiryRoutes.getInquiries);
router.get('/api/v1/admin/inquiries/:id', inquiryRoutes.getInquiry);
router.put('/api/v1/admin/inquiries/:id', inquiryRoutes.updateInquiry);
router.delete('/api/v1/admin/inquiries/:id', inquiryRoutes.deleteInquiry);

// 404 handler
router.all('*', () => new Response('Not Found', { status: 404, headers: corsHeaders }));

// Main worker event handler with optimized error handling
export default {
  async fetch(request, env, ctx) {
    try {
      // Attach environment to request for downstream access
      request.env = env;
      request.ctx = ctx;
      
      // Route request through optimized router
      const response = await router.handle(request);
      
      // Ensure CORS headers are always present
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        if (!headers.has(key)) {
          headers.set(key, value);
        }
      });
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
      
    } catch (error) {
      return errorHandler(error, request);
    }
  }
};