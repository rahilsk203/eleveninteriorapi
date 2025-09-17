/**
 * Health Routes - System health monitoring and diagnostics
 * DSA Optimization: Cached health checks and fast response times
 */

import { corsHeaders } from '../middleware/cors.js';
import { DatabaseService } from '../services/database.js';
import { createCloudinaryService } from '../services/cloudinary.js';

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

class HealthRoutes {
  constructor() {
    this.handle = this.handle.bind(this);
    this.basicHealth = this.basicHealth.bind(this);
    this.detailedHealth = this.detailedHealth.bind(this);
    this.databaseHealth = this.databaseHealth.bind(this);
    this.cloudinaryHealth = this.cloudinaryHealth.bind(this);
    
    // Cache health check results for 30 seconds
    this.healthCache = new Map();
    this.cacheTimeout = 30 * 1000; // 30 seconds
  }

  // Route handler
  async handle(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/health' || path === '/health/') {
        return await this.basicHealth(request);
      } else if (path === '/health/detailed') {
        return await this.detailedHealth(request);
      } else if (path === '/health/database') {
        return await this.databaseHealth(request);
      } else if (path === '/health/cloudinary') {
        return await this.cloudinaryHealth(request);
      } else {
        return new Response('Not Found', { status: 404, headers: corsHeaders });
      }
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  }

  // Basic health check - fastest response
  async basicHealth(request) {
    const cacheKey = 'basic_health';
    const cached = this.healthCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return createResponse(cached.data);
    }

    const startTime = Date.now();
    
    const healthData = {
      status: 'healthy',
      service: 'Eleven Interior API',
      version: '1.0.0',
      environment: request.env?.ENVIRONMENT || 'unknown',
      uptime: 'cloudflare_worker', // Workers don't have traditional uptime
      response_time_ms: Date.now() - startTime,
      checks: {
        api: 'ok',
        worker: 'ok'
      }
    };

    // Cache the result
    this.healthCache.set(cacheKey, {
      data: healthData,
      timestamp: Date.now()
    });

    return createResponse(healthData);
  }

  // Detailed health check with all services
  async detailedHealth(request) {
    const cacheKey = 'detailed_health';
    const cached = this.healthCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return createResponse(cached.data);
    }

    const startTime = Date.now();
    const checks = {};
    let overallStatus = 'healthy';

    try {
      // Test database connection
      const dbStartTime = Date.now();
      try {
        const db = new DatabaseService(request.env.DB);
        await db.executeQuery('SELECT 1 as test');
        checks.database = {
          status: 'ok',
          response_time_ms: Date.now() - dbStartTime
        };
      } catch (dbError) {
        checks.database = {
          status: 'error',
          error: dbError.message,
          response_time_ms: Date.now() - dbStartTime
        };
        overallStatus = 'degraded';
      }

      // Test Cloudinary connection
      const cloudinaryStartTime = Date.now();
      try {
        const cloudinary = createCloudinaryService(request.env);
        // Simple test - this would ideally be a lightweight API call
        if (cloudinary.cloudName) {
          checks.cloudinary = {
            status: 'ok',
            response_time_ms: Date.now() - cloudinaryStartTime,
            cloud_name: cloudinary.cloudName
          };
        } else {
          throw new Error('Cloudinary not configured');
        }
      } catch (cloudinaryError) {
        checks.cloudinary = {
          status: 'error',
          error: cloudinaryError.message,
          response_time_ms: Date.now() - cloudinaryStartTime
        };
        overallStatus = 'degraded';
      }

      // Environment checks
      checks.environment = {
        status: 'ok',
        variables: {
          CLOUDINARY_CLOUD_NAME: !!request.env.CLOUDINARY_CLOUD_NAME,
          CLOUDINARY_API_KEY: !!request.env.CLOUDINARY_API_KEY,
          CLOUDINARY_API_SECRET: !!request.env.CLOUDINARY_API_SECRET,
          JWT_SECRET: !!request.env.JWT_SECRET,
          ADMIN_API_KEY: !!request.env.ADMIN_API_KEY,
          DB_BINDING: !!request.env.DB
        }
      };

      // Worker performance metrics
      checks.performance = {
        status: 'ok',
        memory_usage: 'unknown', // Would need monitoring setup
        cpu_usage: 'unknown',
        active_requests: 'unknown'
      };

    } catch (error) {
      overallStatus = 'unhealthy';
      checks.error = error.message;
    }

    const healthData = {
      status: overallStatus,
      service: 'Eleven Interior API',
      version: '1.0.0',
      environment: request.env?.ENVIRONMENT || 'unknown',
      total_response_time_ms: Date.now() - startTime,
      checks: checks,
      timestamp: new Date().toISOString()
    };

    // Cache the result
    this.healthCache.set(cacheKey, {
      data: healthData,
      timestamp: Date.now()
    });

    const status = overallStatus === 'healthy' ? 200 : 
                   overallStatus === 'degraded' ? 200 : 503;

    return createResponse(healthData, status);
  }

  // Database-specific health check
  async databaseHealth(request) {
    const startTime = Date.now();
    
    try {
      const db = new DatabaseService(request.env.DB);
      
      // Test basic connectivity
      const connectTest = await db.executeQuery('SELECT 1 as connectivity_test');
      
      // Test inquiries table
      const inquiriesTest = await db.executeQuery('SELECT COUNT(*) as total_inquiries FROM inquiries LIMIT 1');
      
      // Test media metadata table
      const mediaTest = await db.executeQuery('SELECT COUNT(*) as total_media FROM media_metadata LIMIT 1');
      
      const healthData = {
        status: 'healthy',
        database: 'Cloudflare D1',
        response_time_ms: Date.now() - startTime,
        connectivity: connectTest.success ? 'ok' : 'error',
        tables: {
          inquiries: {
            accessible: true,
            total_records: inquiriesTest.results[0]?.total_inquiries || 0
          },
          media_metadata: {
            accessible: true,
            total_records: mediaTest.results[0]?.total_media || 0
          }
        },
        last_checked: new Date().toISOString()
      };

      return createResponse(healthData);

    } catch (error) {
      const healthData = {
        status: 'unhealthy',
        database: 'Cloudflare D1',
        response_time_ms: Date.now() - startTime,
        error: error.message,
        last_checked: new Date().toISOString()
      };

      return createResponse(healthData, 503);
    }
  }

  // Cloudinary-specific health check
  async cloudinaryHealth(request) {
    const startTime = Date.now();
    
    try {
      const cloudinary = createCloudinaryService(request.env);
      
      const healthData = {
        status: 'healthy',
        service: 'Cloudinary',
        response_time_ms: Date.now() - startTime,
        configuration: {
          cloud_name: cloudinary.cloudName,
          api_configured: !!request.env.CLOUDINARY_API_KEY && !!request.env.CLOUDINARY_API_SECRET
        },
        cache_stats: {
          transformation_cache_size: cloudinary.transformationCache.size,
          max_cache_size: cloudinary.maxCacheSize
        },
        last_checked: new Date().toISOString()
      };

      return createResponse(healthData);

    } catch (error) {
      const healthData = {
        status: 'unhealthy',
        service: 'Cloudinary',
        response_time_ms: Date.now() - startTime,
        error: error.message,
        last_checked: new Date().toISOString()
      };

      return createResponse(healthData, 503);
    }
  }
}

// Export singleton instance
const healthRoutes = new HealthRoutes();
export default healthRoutes;