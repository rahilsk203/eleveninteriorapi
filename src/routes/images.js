/**
 * Image Routes - Optimized image management for all sections
 * DSA Optimization: Hash-based section validation and batch operations
 */

import { createCloudinaryService } from '../services/cloudinary.js';
import { DatabaseService } from '../services/database.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { corsHeaders } from '../middleware/cors.js';
import { z } from 'zod';

// Valid image sections (O(1) lookup with Set)
const VALID_IMAGE_SECTIONS = new Set([
  'contact', 'entrance', 'gallery', 'logo', 'about', 'swordman'
]);

// Validation schemas
const imageUploadSchema = z.object({
  section: z.enum(['contact', 'entrance', 'gallery', 'logo', 'about', 'swordman']),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  alt_text: z.string().max(200).optional(),
  sort_order: z.number().int().min(0).optional()
});

const imageUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  alt_text: z.string().max(200).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional()
});

const batchUploadSchema = z.object({
  section: z.enum(['contact', 'entrance', 'gallery', 'logo', 'about', 'swordman']),
  images: z.array(z.object({
    title: z.string().max(200).optional(),
    description: z.string().max(1000).optional(),
    alt_text: z.string().max(200).optional(),
    sort_order: z.number().int().min(0).optional()
  })).max(20) // Max 20 images per batch
});

// Helper function to validate section
function validateSection(section) {
  if (!VALID_IMAGE_SECTIONS.has(section)) {
    throw new ValidationError(`Invalid image section: ${section}. Valid sections: ${Array.from(VALID_IMAGE_SECTIONS).join(', ')}`);
  }
}

// Helper function to process image file
async function processImageFile(request) {
  const contentType = request.headers.get('content-type');
  
  if (!contentType || !contentType.includes('multipart/form-data')) {
    throw new ValidationError('Content-Type must be multipart/form-data');
  }

  const formData = await request.formData();
  return formData;
}

// Generate responsive image URLs
function generateResponsiveUrls(cloudinary, publicId) {
  return {
    original: cloudinary.generateUrl(publicId),
    large: cloudinary.generateUrl(publicId, { 
      width: 1920, 
      height: 1080, 
      crop: 'fill', 
      quality: 'auto:good' 
    }),
    medium: cloudinary.generateUrl(publicId, { 
      width: 1280, 
      height: 720, 
      crop: 'fill', 
      quality: 'auto:good' 
    }),
    small: cloudinary.generateUrl(publicId, { 
      width: 640, 
      height: 360, 
      crop: 'fill', 
      quality: 'auto:eco' 
    }),
    thumbnail: cloudinary.generateUrl(publicId, { 
      width: 300, 
      height: 200, 
      crop: 'fill', 
      quality: 'auto:low' 
    }),
    webp_large: cloudinary.generateUrl(publicId, { 
      width: 1920, 
      height: 1080, 
      crop: 'fill', 
      quality: 'auto:good',
      format: 'webp'
    }),
    webp_medium: cloudinary.generateUrl(publicId, { 
      width: 1280, 
      height: 720, 
      crop: 'fill', 
      quality: 'auto:good',
      format: 'webp'
    })
  };
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

class ImageRoutes {
  constructor() {
    // Bind methods to preserve 'this' context
    this.uploadImage = this.uploadImage.bind(this);
    this.uploadBatchImages = this.uploadBatchImages.bind(this);
    this.getImages = this.getImages.bind(this);
    this.updateImage = this.updateImage.bind(this);
    this.deleteImage = this.deleteImage.bind(this);
    this.reorderImages = this.reorderImages.bind(this);
  }

  // Upload single image
  async uploadImage(request) {
    try {
      const formData = await processImageFile(request);
      const imageFile = formData.get('image');
      
      if (!imageFile || !(imageFile instanceof File)) {
        throw new ValidationError('Image file is required');
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(imageFile.type)) {
        throw new ValidationError(`Invalid image type: ${imageFile.type}. Allowed types: ${allowedTypes.join(', ')}`);
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (imageFile.size > maxSize) {
        throw new ValidationError(`Image file too large. Maximum size: ${maxSize / (1024 * 1024)}MB`);
      }

      // Parse and validate metadata
      const section = formData.get('section');
      const title = formData.get('title') || '';
      const description = formData.get('description') || '';
      const alt_text = formData.get('alt_text') || '';
      const sort_order = parseInt(formData.get('sort_order')) || 0;

      const validatedData = imageUploadSchema.parse({
        section,
        title: title || undefined,
        description: description || undefined,
        alt_text: alt_text || undefined,
        sort_order
      });

      // Initialize services
      const cloudinary = createCloudinaryService(request.env);
      const db = new DatabaseService(request.env.DB);

      // Upload to Cloudinary with optimized settings
      const uploadResult = await cloudinary.uploadFile(imageFile, {
        resourceType: 'image',
        folder: `eleven-interior/images/${validatedData.section}`,
        publicId: `${validatedData.section}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });

      // Save metadata to database
      const metadata = {
        media_type: 'image',
        section: validatedData.section,
        cloudinary_public_id: uploadResult.public_id,
        cloudinary_url: uploadResult.url,
        secure_url: uploadResult.secure_url,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
        alt_text: validatedData.alt_text || '',
        title: validatedData.title || '',
        description: validatedData.description || '',
        sort_order: validatedData.sort_order
      };

      const savedMetadata = await db.saveMediaMetadata(metadata);

      // Generate responsive URLs
      const responsiveUrls = generateResponsiveUrls(cloudinary, uploadResult.public_id);

      return createResponse({
        id: savedMetadata.id,
        section: validatedData.section,
        cloudinary_public_id: uploadResult.public_id,
        urls: responsiveUrls,
        metadata: {
          width: uploadResult.width,
          height: uploadResult.height,
          format: uploadResult.format,
          size: uploadResult.bytes
        },
        content: {
          title: validatedData.title,
          description: validatedData.description,
          alt_text: validatedData.alt_text
        },
        sort_order: validatedData.sort_order,
        uploaded_at: savedMetadata.created_at
      }, 201);

    } catch (error) {
      throw error;
    }
  }

  // Upload multiple images (batch upload)
  async uploadBatchImages(request) {
    try {
      const formData = await processImageFile(request);
      const section = formData.get('section');
      
      validateSection(section);

      // Get all image files
      const imageFiles = [];
      const metadata = [];
      
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('image_') && value instanceof File) {
          const index = key.split('_')[1];
          imageFiles.push({
            file: value,
            title: formData.get(`title_${index}`) || '',
            description: formData.get(`description_${index}`) || '',
            alt_text: formData.get(`alt_text_${index}`) || '',
            sort_order: parseInt(formData.get(`sort_order_${index}`)) || 0
          });
        }
      }

      if (imageFiles.length === 0) {
        throw new ValidationError('At least one image file is required');
      }

      if (imageFiles.length > 20) {
        throw new ValidationError('Maximum 20 images allowed per batch upload');
      }

      // Initialize services
      const cloudinary = createCloudinaryService(request.env);
      const db = new DatabaseService(request.env.DB);

      const uploadResults = [];
      const errors = [];

      // Process uploads in parallel for better performance
      const uploadPromises = imageFiles.map(async (imageData, index) => {
        try {
          // Validate file
          const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
          if (!allowedTypes.includes(imageData.file.type)) {
            throw new ValidationError(`Invalid image type for image ${index + 1}: ${imageData.file.type}`);
          }

          const maxSize = 10 * 1024 * 1024; // 10MB
          if (imageData.file.size > maxSize) {
            throw new ValidationError(`Image ${index + 1} too large. Maximum size: ${maxSize / (1024 * 1024)}MB`);
          }

          // Upload to Cloudinary
          const uploadResult = await cloudinary.uploadFile(imageData.file, {
            resourceType: 'image',
            folder: `eleven-interior/images/${section}`,
            publicId: `${section}_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
          });

          // Save metadata to database
          const metadata = {
            media_type: 'image',
            section: section,
            cloudinary_public_id: uploadResult.public_id,
            cloudinary_url: uploadResult.url,
            secure_url: uploadResult.secure_url,
            width: uploadResult.width,
            height: uploadResult.height,
            format: uploadResult.format,
            bytes: uploadResult.bytes,
            alt_text: imageData.alt_text,
            title: imageData.title,
            description: imageData.description,
            sort_order: imageData.sort_order
          };

          const savedMetadata = await db.saveMediaMetadata(metadata);
          const responsiveUrls = generateResponsiveUrls(cloudinary, uploadResult.public_id);

          return {
            success: true,
            index: index + 1,
            data: {
              id: savedMetadata.id,
              section: section,
              cloudinary_public_id: uploadResult.public_id,
              urls: responsiveUrls,
              metadata: {
                width: uploadResult.width,
                height: uploadResult.height,
                format: uploadResult.format,
                size: uploadResult.bytes
              },
              content: {
                title: imageData.title,
                description: imageData.description,
                alt_text: imageData.alt_text
              },
              sort_order: imageData.sort_order,
              uploaded_at: savedMetadata.created_at
            }
          };

        } catch (error) {
          return {
            success: false,
            index: index + 1,
            error: error.message
          };
        }
      });

      const results = await Promise.all(uploadPromises);
      
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      return createResponse({
        message: `Batch upload completed. ${successful.length} successful, ${failed.length} failed.`,
        section: section,
        successful_uploads: successful.map(r => r.data),
        failed_uploads: failed.map(r => ({ index: r.index, error: r.error })),
        summary: {
          total: imageFiles.length,
          successful: successful.length,
          failed: failed.length
        }
      }, 201);

    } catch (error) {
      throw error;
    }
  }

  // Get images for specific section
  async getImages(request) {
    try {
      const url = new URL(request.url);
      const section = url.pathname.split('/').pop();
      const searchParams = url.searchParams;

      validateSection(section);

      // Parse query parameters
      const limit = parseInt(searchParams.get('limit')) || null;
      const offset = parseInt(searchParams.get('offset')) || 0;
      const includeInactive = searchParams.get('include_inactive') === 'true';

      const db = new DatabaseService(request.env.DB);
      let images = await db.getMediaBySection('image', section);

      // Filter inactive images if needed
      if (!includeInactive) {
        images.results = images.results.filter(img => img.is_active);
      }

      // Apply pagination
      const total = images.results.length;
      if (limit) {
        images.results = images.results.slice(offset, offset + limit);
      }

      const cloudinary = createCloudinaryService(request.env);

      // Generate responsive URLs for each image
      const processedImages = images.results.map(image => {
        const responsiveUrls = generateResponsiveUrls(cloudinary, image.cloudinary_public_id);

        return {
          id: image.id,
          section: image.section,
          urls: responsiveUrls,
          metadata: {
            width: image.width,
            height: image.height,
            format: image.format,
            size: image.bytes
          },
          content: {
            title: image.title,
            description: image.description,
            alt_text: image.alt_text
          },
          sort_order: image.sort_order,
          is_active: image.is_active,
          created_at: image.created_at,
          updated_at: image.updated_at
        };
      });

      return createResponse({
        section: section,
        images: processedImages,
        pagination: {
          total: total,
          limit: limit,
          offset: offset,
          has_more: limit ? (offset + limit) < total : false
        }
      });

    } catch (error) {
      throw error;
    }
  }

  // Update image metadata
  async updateImage(request) {
    try {
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const section = pathParts[pathParts.length - 2];
      const imageId = parseInt(pathParts[pathParts.length - 1]);

      validateSection(section);

      if (!imageId || isNaN(imageId)) {
        throw new ValidationError('Valid image ID is required');
      }

      const updates = await request.json();
      const validatedUpdates = imageUpdateSchema.parse(updates);

      const db = new DatabaseService(request.env.DB);
      
      // Check if image exists and belongs to the specified section
      const existingImage = await db.getMediaMetadata(imageId);
      
      if (!existingImage || existingImage.section !== section || existingImage.media_type !== 'image') {
        throw new NotFoundError(`Image with ID ${imageId} in ${section} section`);
      }

      const updatedImage = await db.updateMediaMetadata(imageId, validatedUpdates);
      const cloudinary = createCloudinaryService(request.env);

      // Generate responsive URLs
      const responsiveUrls = generateResponsiveUrls(cloudinary, updatedImage.cloudinary_public_id);

      return createResponse({
        id: updatedImage.id,
        section: updatedImage.section,
        urls: responsiveUrls,
        metadata: {
          width: updatedImage.width,
          height: updatedImage.height,
          format: updatedImage.format,
          size: updatedImage.bytes
        },
        content: {
          title: updatedImage.title,
          description: updatedImage.description,
          alt_text: updatedImage.alt_text
        },
        sort_order: updatedImage.sort_order,
        is_active: updatedImage.is_active,
        updated_at: updatedImage.updated_at
      });

    } catch (error) {
      throw error;
    }
  }

  // Delete image
  async deleteImage(request) {
    try {
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const section = pathParts[pathParts.length - 2];
      const imageId = parseInt(pathParts[pathParts.length - 1]);

      validateSection(section);

      if (!imageId || isNaN(imageId)) {
        throw new ValidationError('Valid image ID is required');
      }

      const db = new DatabaseService(request.env.DB);
      
      // Check if image exists and belongs to the specified section
      const existingImage = await db.getMediaMetadata(imageId);
      
      if (!existingImage || existingImage.section !== section || existingImage.media_type !== 'image') {
        throw new NotFoundError(`Image with ID ${imageId} in ${section} section`);
      }

      const cloudinary = createCloudinaryService(request.env);

      // Delete from Cloudinary
      await cloudinary.deleteFile(existingImage.cloudinary_public_id, 'image');

      // Delete metadata from database
      await db.deleteMediaMetadata(imageId);

      return createResponse({
        message: `Image deleted successfully`,
        deleted_id: imageId,
        section: section,
        cloudinary_public_id: existingImage.cloudinary_public_id
      });

    } catch (error) {
      throw error;
    }
  }

  // Reorder images in a section
  async reorderImages(request) {
    try {
      const { section, image_orders } = await request.json();
      
      validateSection(section);

      if (!Array.isArray(image_orders) || image_orders.length === 0) {
        throw new ValidationError('image_orders must be a non-empty array');
      }

      // Validate image order structure
      for (const order of image_orders) {
        if (!order.id || typeof order.sort_order !== 'number') {
          throw new ValidationError('Each image order must have id and sort_order');
        }
      }

      const db = new DatabaseService(request.env.DB);

      // Update sort orders
      const updatePromises = image_orders.map(async (order) => {
        const image = await db.getMediaMetadata(order.id);
        
        if (!image || image.section !== section || image.media_type !== 'image') {
          throw new ValidationError(`Image with ID ${order.id} not found in ${section} section`);
        }

        return db.updateMediaMetadata(order.id, { sort_order: order.sort_order });
      });

      await Promise.all(updatePromises);

      return createResponse({
        message: `Successfully reordered ${image_orders.length} images in ${section} section`,
        section: section,
        updated_images: image_orders.length
      });

    } catch (error) {
      throw error;
    }
  }
}

// Export singleton instance
const imageRoutes = new ImageRoutes();
export default imageRoutes;