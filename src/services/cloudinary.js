/**
 * Cloudinary Service - Optimized for high-performance media operations
 * DSA Optimization: Cached transformations and batch operations
 */

import { CloudinaryError } from '../middleware/errorHandler.js';

class CloudinaryService {
  constructor(cloudName, apiKey, apiSecret) {
    this.cloudName = cloudName;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = `https://api.cloudinary.com/v1_1/${cloudName}`;
    
    // Cache for transformation URLs (LRU cache for O(1) access)
    this.transformationCache = new Map();
    this.maxCacheSize = 1000;
  }

  // Generate secure signature for authenticated requests
  async generateSignature(params, secret) {
    // CRITICAL: Parameters that should be included in signature calculation
    const allowedParams = ['timestamp', 'folder', 'public_id', 'resource_type', 'public_ids'];
    const paramsToSign = {};
    
    allowedParams.forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        paramsToSign[key] = params[key];
      }
    });

    // Create sorted parameter string
    const sortedParams = Object.keys(paramsToSign)
      .sort()
      .map(key => `${key}=${paramsToSign[key]}`)
      .join('&');

    const stringToSign = sortedParams + secret;
    
    // Use SHA-1 for Cloudinary (not SHA-256)
    const encoder = new TextEncoder();
    const data = encoder.encode(stringToSign);
    const hash = await crypto.subtle.digest('SHA-1', data);
    
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Upload file to Cloudinary with optimized parameters
  async uploadFile(file, options = {}) {
    try {
      const formData = new FormData();
      
      // Use timestamp for unique identification
      const timestamp = Math.floor(Date.now() / 1000);
      
      // CRITICAL: Parameters that go into signature calculation
      const signatureParams = {
        timestamp: timestamp
      };

      // Add folder to signature if specified
      if (options.folder) {
        signatureParams.folder = options.folder;
      }

      // Add public_id to signature if specified
      if (options.publicId) {
        signatureParams.public_id = options.publicId;
      }

      // Generate signature with all signature parameters
      const signature = await this.generateSignature(signatureParams, this.apiSecret);
      
      // Add file first
      formData.append('file', file);
      
      // Add signature parameters
      formData.append('timestamp', timestamp);
      if (options.folder) {
        formData.append('folder', options.folder);
      }
      
      // Add authentication
      formData.append('signature', signature);
      formData.append('api_key', this.apiKey);

      // Add all other parameters (NOT in signature)
      if (options.publicId) {
        formData.append('public_id', options.publicId);
      }
      
      if (options.resourceType && options.resourceType !== 'auto') {
        formData.append('resource_type', options.resourceType);
      }

      // Add quality optimization (NOT in signature)
      if (options.resourceType === 'image') {
        formData.append('quality', 'auto:good');
        formData.append('fetch_format', 'auto');
      }

      // Upload to Cloudinary
      const response = await fetch(`${this.baseUrl}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new CloudinaryError(`Upload failed: ${error.error?.message || 'Unknown error'}`);
      }

      return await response.json();
      
    } catch (error) {
      if (error instanceof CloudinaryError) {
        throw error;
      }
      throw new CloudinaryError(`Upload operation failed: ${error.message}`);
    }
  }

  // Delete file from Cloudinary
  async deleteFile(publicId, resourceType = 'image') {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const params = {
        public_id: publicId,
        timestamp: timestamp
      };

      const signature = await this.generateSignature(params, this.apiSecret);
      
      const formData = new FormData();
      formData.append('public_id', publicId);
      formData.append('signature', signature);
      formData.append('api_key', this.apiKey);
      formData.append('timestamp', timestamp);

      const response = await fetch(`${this.baseUrl}/${resourceType}/destroy`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new CloudinaryError(`Delete failed: ${error.error?.message || 'Unknown error'}`);
      }

      return await response.json();
      
    } catch (error) {
      if (error instanceof CloudinaryError) {
        throw error;
      }
      throw new CloudinaryError(`Delete operation failed: ${error.message}`);
    }
  }

  // Generate optimized URL with transformations (cached for performance)
  generateUrl(publicId, options = {}) {
    const cacheKey = `${publicId}_${JSON.stringify(options)}`;
    
    // Check cache first (O(1) lookup)
    if (this.transformationCache.has(cacheKey)) {
      return this.transformationCache.get(cacheKey);
    }

    // Build transformation string
    const transformations = [];
    
    if (options.width || options.height) {
      let crop = `c_${options.crop || 'fill'}`;
      if (options.width) crop += `,w_${options.width}`;
      if (options.height) crop += `,h_${options.height}`;
      transformations.push(crop);
    }

    if (options.quality) {
      transformations.push(`q_${options.quality}`);
    }

    if (options.format) {
      transformations.push(`f_${options.format}`);
    }

    // Add progressive for better loading
    if (options.progressive !== false) {
      transformations.push('fl_progressive');
    }

    // Build final URL
    const transformationString = transformations.length > 0 ? 
      `/${transformations.join(',')}` : '';
    
    const url = `https://res.cloudinary.com/${this.cloudName}/image/upload${transformationString}/${publicId}`;

    // Cache the result (implement LRU eviction if cache is full)
    if (this.transformationCache.size >= this.maxCacheSize) {
      const firstKey = this.transformationCache.keys().next().value;
      this.transformationCache.delete(firstKey);
    }
    
    this.transformationCache.set(cacheKey, url);
    
    return url;
  }

  // Generate video URL with optimizations
  generateVideoUrl(publicId, options = {}) {
    const transformations = [];
    
    if (options.width || options.height) {
      let crop = `c_${options.crop || 'fill'}`;
      if (options.width) crop += `,w_${options.width}`;
      if (options.height) crop += `,h_${options.height}`;
      transformations.push(crop);
    }

    if (options.quality) {
      transformations.push(`q_${options.quality}`);
    }

    // Video-specific optimizations
    transformations.push('f_mp4'); // Force MP4 format
    transformations.push('vc_h264'); // H.264 codec for compatibility

    const transformationString = transformations.length > 0 ? 
      `/${transformations.join(',')}` : '';
    
    return `https://res.cloudinary.com/${this.cloudName}/video/upload${transformationString}/${publicId}`;
  }

  // Batch operations for multiple files (optimized for bulk operations)
  async batchDelete(publicIds, resourceType = 'image') {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const params = {
        public_ids: publicIds.join(','),
        timestamp: timestamp
      };

      const signature = await this.generateSignature(params, this.apiSecret);
      
      const formData = new FormData();
      formData.append('public_ids', publicIds.join(','));
      formData.append('signature', signature);
      formData.append('api_key', this.apiKey);
      formData.append('timestamp', timestamp);

      const response = await fetch(`${this.baseUrl}/${resourceType}/delete_resources`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new CloudinaryError(`Batch delete failed: ${error.error?.message || 'Unknown error'}`);
      }

      return await response.json();
      
    } catch (error) {
      if (error instanceof CloudinaryError) {
        throw error;
      }
      throw new CloudinaryError(`Batch delete operation failed: ${error.message}`);
    }
  }

  // Get resource details
  async getResourceDetails(publicId, resourceType = 'image') {
    try {
      const response = await fetch(
        `${this.baseUrl}/resources/${resourceType}/upload/${publicId}?api_key=${this.apiKey}`,
        {
          headers: {
            'Authorization': `Bearer ${await this.generateSignature({ public_id: publicId }, this.apiSecret)}`
          }
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new CloudinaryError(`Get resource failed: ${error.error?.message || 'Unknown error'}`);
      }

      return await response.json();
      
    } catch (error) {
      if (error instanceof CloudinaryError) {
        throw error;
      }
      throw new CloudinaryError(`Get resource operation failed: ${error.message}`);
    }
  }
}

// Factory function to create Cloudinary service instance
export function createCloudinaryService(env) {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;
  
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new CloudinaryError('Missing required Cloudinary configuration');
  }
  
  return new CloudinaryService(CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET);
}

export { CloudinaryService };