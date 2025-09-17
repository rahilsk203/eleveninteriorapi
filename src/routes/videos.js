/**
 * Video Routes - Optimized video management for Hero and Feature sections
 * DSA Optimization: Hash-based section validation and cached responses
 */

import { createCloudinaryService } from '../services/cloudinary.js';
import { DatabaseService } from '../services/database.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { corsHeaders } from '../middleware/cors.js';
import { z } from 'zod';

// Valid video sections (O(1) lookup with Set)
const VALID_VIDEO_SECTIONS = new Set(['hero', 'feature']);

// Validation schemas
const videoUploadSchema = z.object({
  section: z.enum(['hero', 'feature']),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  alt_text: z.string().max(200).optional()
});

const videoUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  alt_text: z.string().max(200).optional(),
  is_active: z.boolean().optional()
});

// Helper function to validate section
function validateSection(section) {
  if (!VALID_VIDEO_SECTIONS.has(section)) {
    throw new ValidationError(`Invalid video section: ${section}. Valid sections: ${Array.from(VALID_VIDEO_SECTIONS).join(', ')}`);
  }
}

// Helper function to process video file
async function processVideoFile(request) {
  const contentType = request.headers.get('content-type');
  
  if (!contentType || !contentType.includes('multipart/form-data')) {
    throw new ValidationError('Content-Type must be multipart/form-data');
  }

  const formData = await request.formData();
  const videoFile = formData.get('video');
  
  if (!videoFile || !(videoFile instanceof File)) {
    throw new ValidationError('Video file is required');
  }

  // Validate file type
  const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/mov', 'video/avi'];
  if (!allowedTypes.includes(videoFile.type)) {
    throw new ValidationError(`Invalid video type: ${videoFile.type}. Allowed types: ${allowedTypes.join(', ')}`);
  }

  // Validate file size (max 100MB)
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (videoFile.size > maxSize) {
    throw new ValidationError(`Video file too large. Maximum size: ${maxSize / (1024 * 1024)}MB`);
  }

  return { videoFile, formData };
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

class VideoRoutes {
  constructor() {
    // Bind methods to preserve 'this' context
    this.uploadVideo = this.uploadVideo.bind(this);
    this.getVideo = this.getVideo.bind(this);
    this.updateVideo = this.updateVideo.bind(this);
    this.deleteVideo = this.deleteVideo.bind(this);
  }

  // Upload video to specific section
  async uploadVideo(request) {
    try {
      const { videoFile, formData } = await processVideoFile(request);
      
      // Parse and validate metadata
      const section = formData.get('section');
      const title = formData.get('title') || '';
      const description = formData.get('description') || '';
      const alt_text = formData.get('alt_text') || '';

      // Validate input
      const validatedData = videoUploadSchema.parse({
        section,
        title: title || undefined,
        description: description || undefined,
        alt_text: alt_text || undefined
      });

      // Initialize services
      const cloudinary = createCloudinaryService(request.env);
      const db = new DatabaseService(request.env.DB);

      // Check if video already exists for this section (hero and feature should be unique)
      const existingVideos = await db.getMediaBySection('video', validatedData.section);
      
      if (existingVideos.results.length > 0) {
        // For hero and feature sections, replace existing video
        const existingVideo = existingVideos.results[0];
        
        // Delete old video from Cloudinary
        try {
          await cloudinary.deleteFile(existingVideo.cloudinary_public_id, 'video');
        } catch (deleteError) {
          console.warn('Failed to delete old video from Cloudinary:', deleteError.message);
        }
        
        // Delete old metadata
        await db.deleteMediaMetadata(existingVideo.id);
      }

      // Upload to Cloudinary with optimized settings
      const uploadResult = await cloudinary.uploadFile(videoFile, {
        resourceType: 'video',
        folder: `eleven-interior/videos/${validatedData.section}`,
        publicId: `${validatedData.section}_video_${Date.now()}`,
        overwrite: true
      });

      // Save metadata to database
      const metadata = {
        media_type: 'video',
        section: validatedData.section,
        cloudinary_public_id: uploadResult.public_id,
        cloudinary_url: uploadResult.url,
        secure_url: uploadResult.secure_url,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
        duration: uploadResult.duration,
        alt_text: validatedData.alt_text || '',
        title: validatedData.title || '',
        description: validatedData.description || '',
        sort_order: 0
      };

      const savedMetadata = await db.saveMediaMetadata(metadata);

      // Generate optimized URLs for different use cases
      const optimizedUrls = {
        original: uploadResult.secure_url,
        hd: cloudinary.generateVideoUrl(uploadResult.public_id, { 
          quality: 'auto:good', 
          width: 1920, 
          height: 1080 
        }),
        sd: cloudinary.generateVideoUrl(uploadResult.public_id, { 
          quality: 'auto:low', 
          width: 1280, 
          height: 720 
        }),
        mobile: cloudinary.generateVideoUrl(uploadResult.public_id, { 
          quality: 'auto:low', 
          width: 768, 
          height: 432 
        })
      };

      return createResponse({
        id: savedMetadata.id,
        section: validatedData.section,
        cloudinary_public_id: uploadResult.public_id,
        urls: optimizedUrls,
        metadata: {
          width: uploadResult.width,
          height: uploadResult.height,
          duration: uploadResult.duration,
          format: uploadResult.format,
          size: uploadResult.bytes
        },
        content: {
          title: validatedData.title,
          description: validatedData.description,
          alt_text: validatedData.alt_text
        },
        uploaded_at: savedMetadata.created_at
      }, 201);

    } catch (error) {
      throw error;
    }
  }

  // Get video for specific section
  async getVideo(request) {
    try {
      const url = new URL(request.url);
      const section = url.pathname.split('/').pop();

      validateSection(section);

      const db = new DatabaseService(request.env.DB);
      const videos = await db.getMediaBySection('video', section);

      if (videos.results.length === 0) {
        throw new NotFoundError(`Video for ${section} section`);
      }

      const video = videos.results[0]; // Should only be one video per section
      const cloudinary = createCloudinaryService(request.env);

      // Generate optimized URLs
      const optimizedUrls = {
        original: video.secure_url,
        hd: cloudinary.generateVideoUrl(video.cloudinary_public_id, { 
          quality: 'auto:good', 
          width: 1920, 
          height: 1080 
        }),
        sd: cloudinary.generateVideoUrl(video.cloudinary_public_id, { 
          quality: 'auto:low', 
          width: 1280, 
          height: 720 
        }),
        mobile: cloudinary.generateVideoUrl(video.cloudinary_public_id, { 
          quality: 'auto:low', 
          width: 768, 
          height: 432 
        })
      };

      return createResponse({
        id: video.id,
        section: video.section,
        urls: optimizedUrls,
        metadata: {
          width: video.width,
          height: video.height,
          duration: video.duration,
          format: video.format,
          size: video.bytes
        },
        content: {
          title: video.title,
          description: video.description,
          alt_text: video.alt_text
        },
        created_at: video.created_at,
        updated_at: video.updated_at
      });

    } catch (error) {
      throw error;
    }
  }

  // Update video metadata
  async updateVideo(request) {
    try {
      const url = new URL(request.url);
      const section = url.pathname.split('/').pop();

      validateSection(section);

      const updates = await request.json();
      const validatedUpdates = videoUpdateSchema.parse(updates);

      const db = new DatabaseService(request.env.DB);
      const videos = await db.getMediaBySection('video', section);

      if (videos.results.length === 0) {
        throw new NotFoundError(`Video for ${section} section`);
      }

      const video = videos.results[0];
      const updatedVideo = await db.updateMediaMetadata(video.id, validatedUpdates);

      const cloudinary = createCloudinaryService(request.env);

      // Generate optimized URLs
      const optimizedUrls = {
        original: updatedVideo.secure_url,
        hd: cloudinary.generateVideoUrl(updatedVideo.cloudinary_public_id, { 
          quality: 'auto:good', 
          width: 1920, 
          height: 1080 
        }),
        sd: cloudinary.generateVideoUrl(updatedVideo.cloudinary_public_id, { 
          quality: 'auto:low', 
          width: 1280, 
          height: 720 
        }),
        mobile: cloudinary.generateVideoUrl(updatedVideo.cloudinary_public_id, { 
          quality: 'auto:low', 
          width: 768, 
          height: 432 
        })
      };

      return createResponse({
        id: updatedVideo.id,
        section: updatedVideo.section,
        urls: optimizedUrls,
        metadata: {
          width: updatedVideo.width,
          height: updatedVideo.height,
          duration: updatedVideo.duration,
          format: updatedVideo.format,
          size: updatedVideo.bytes
        },
        content: {
          title: updatedVideo.title,
          description: updatedVideo.description,
          alt_text: updatedVideo.alt_text
        },
        is_active: updatedVideo.is_active,
        updated_at: updatedVideo.updated_at
      });

    } catch (error) {
      throw error;
    }
  }

  // Delete video
  async deleteVideo(request) {
    try {
      const url = new URL(request.url);
      const section = url.pathname.split('/').pop();

      validateSection(section);

      const db = new DatabaseService(request.env.DB);
      const videos = await db.getMediaBySection('video', section);

      if (videos.results.length === 0) {
        throw new NotFoundError(`Video for ${section} section`);
      }

      const video = videos.results[0];
      const cloudinary = createCloudinaryService(request.env);

      // Delete from Cloudinary
      await cloudinary.deleteFile(video.cloudinary_public_id, 'video');

      // Delete metadata from database
      await db.deleteMediaMetadata(video.id);

      return createResponse({
        message: `Video for ${section} section deleted successfully`,
        deleted_id: video.id,
        section: section
      });

    } catch (error) {
      throw error;
    }
  }
}

// Export singleton instance
const videoRoutes = new VideoRoutes();
export default videoRoutes;