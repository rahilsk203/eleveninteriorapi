/**
 * Inquiry Routes - Optimized CRUD operations for customer inquiries
 * DSA Optimization: Indexed queries and cached responses for admin dashboard
 */

import { DatabaseService } from '../services/database.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { corsHeaders } from '../middleware/cors.js';
import { z } from 'zod';

// Validation schemas
const createInquirySchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().max(255).toLowerCase().trim(),
  phone: z.string().min(10).max(20).trim(),
  location: z.string().min(2).max(200).trim(),
  project_description: z.string().min(10).max(2000).trim()
});

const updateInquirySchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  email: z.string().email().max(255).toLowerCase().trim().optional(),
  phone: z.string().min(10).max(20).trim().optional(),
  location: z.string().min(2).max(200).trim().optional(),
  project_description: z.string().min(10).max(2000).trim().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(2000).trim().optional(),
  assigned_to: z.string().max(100).trim().optional()
});

const queryParamsSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  assigned_to: z.string().max(100).optional(),
  email: z.string().email().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  sort_by: z.enum(['created_at', 'updated_at', 'priority', 'status', 'name']).optional(),
  sort_order: z.enum(['ASC', 'DESC']).optional(),
  search: z.string().max(100).optional()
});

// Valid status transitions (business logic optimization)
const STATUS_TRANSITIONS = new Map([
  ['pending', new Set(['in_progress', 'cancelled'])],
  ['in_progress', new Set(['completed', 'cancelled', 'pending'])],
  ['completed', new Set(['in_progress'])], // Allow reopening if needed
  ['cancelled', new Set(['pending'])] // Allow reactivation
]);

// Priority levels with descriptions
const PRIORITY_LEVELS = new Map([
  [1, 'Critical'],
  [2, 'High'],
  [3, 'Medium'],
  [4, 'Low'],
  [5, 'Backlog']
]);

// Helper function to sanitize search query
function sanitizeSearchQuery(query) {
  if (!query) return null;
  
  // Remove special characters and normalize
  return query
    .replace(/[^\w\s@.-]/g, '')
    .trim()
    .toLowerCase();
}

// Helper function to build search conditions
function buildSearchConditions(searchQuery) {
  if (!searchQuery) return { conditions: [], params: [] };
  
  const searchConditions = [
    'LOWER(name) LIKE ?',
    'LOWER(email) LIKE ?',
    'LOWER(location) LIKE ?',
    'LOWER(project_description) LIKE ?'
  ];
  
  const searchParam = `%${searchQuery}%`;
  const searchParams = new Array(searchConditions.length).fill(searchParam);
  
  return {
    conditions: [`(${searchConditions.join(' OR ')})`],
    params: searchParams
  };
}

// Create standardized response
function createResponse(data, status = 200, meta = null) {
  const response = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };
  
  if (meta) {
    response.meta = meta;
  }
  
  return new Response(JSON.stringify(response, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

// Enhance inquiry data with computed fields
function enhanceInquiryData(inquiry) {
  if (!inquiry) return null;
  
  return {
    ...inquiry,
    priority_label: PRIORITY_LEVELS.get(inquiry.priority) || 'Unknown',
    created_ago: getTimeAgo(inquiry.created_at),
    updated_ago: getTimeAgo(inquiry.updated_at),
    is_urgent: inquiry.priority <= 2 && inquiry.status === 'pending',
    days_since_created: Math.floor((Date.now() - new Date(inquiry.created_at).getTime()) / (1000 * 60 * 60 * 24))
  };
}

// Helper function to calculate time ago
function getTimeAgo(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }
}

class InquiryRoutes {
  constructor() {
    // Bind methods to preserve 'this' context
    this.createInquiry = this.createInquiry.bind(this);
    this.getInquiries = this.getInquiries.bind(this);
    this.getInquiry = this.getInquiry.bind(this);
    this.updateInquiry = this.updateInquiry.bind(this);
    this.deleteInquiry = this.deleteInquiry.bind(this);
    this.getInquiryStats = this.getInquiryStats.bind(this);
  }

  // Create new inquiry (public endpoint)
  async createInquiry(request) {
    try {
      const body = await request.json();
      const validatedData = createInquirySchema.parse(body);

      // Check for duplicate inquiries (same email and similar project description)
      const db = new DatabaseService(request.env.DB);
      const recentInquiries = await db.getInquiries({
        email: validatedData.email,
        limit: 5,
        sortBy: 'created_at',
        sortOrder: 'DESC'
      });

      // Check if there's a recent inquiry from same email (within 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentInquiry = recentInquiries.results.find(inquiry => 
        new Date(inquiry.created_at) > oneDayAgo
      );

      if (recentInquiry) {
        // Check if it's a very similar inquiry (simple similarity check)
        const similarity = calculateSimilarity(
          validatedData.project_description.toLowerCase(),
          recentInquiry.project_description.toLowerCase()
        );
        
        if (similarity > 0.8) { // 80% similarity threshold
          throw new ValidationError('A similar inquiry was submitted recently. Please wait 24 hours before submitting another inquiry or contact us directly.');
        }
      }

      // Create inquiry with automatic priority assignment
      const inquiryData = {
        ...validatedData,
        priority: calculateAutoPriority(validatedData),
        status: 'pending'
      };

      const newInquiry = await db.createInquiry(inquiryData);
      const enhancedInquiry = enhanceInquiryData(newInquiry);

      // Log the API call for analytics
      await db.logApiCall({
        endpoint: '/api/v1/inquiries',
        method: 'POST',
        status_code: 201,
        ip_address: request.headers.get('CF-Connecting-IP') || 'unknown',
        user_agent: request.headers.get('User-Agent') || 'unknown'
      });

      return createResponse(enhancedInquiry, 201, {
        message: 'Inquiry submitted successfully',
        inquiry_id: newInquiry.id,
        estimated_response_time: '24-48 hours'
      });

    } catch (error) {
      throw error;
    }
  }

  // Get inquiries with filtering and pagination (admin endpoint)
  async getInquiries(request) {
    try {
      const url = new URL(request.url);
      const queryParams = {};
      
      // Parse query parameters
      for (const [key, value] of url.searchParams.entries()) {
        if (key === 'limit' || key === 'offset' || key === 'priority') {
          queryParams[key] = parseInt(value);
        } else {
          queryParams[key] = value;
        }
      }

      const validatedParams = queryParamsSchema.parse(queryParams);
      const db = new DatabaseService(request.env.DB);

      // Build query options
      const options = {
        status: validatedParams.status,
        priority: validatedParams.priority,
        assigned_to: validatedParams.assigned_to,
        email: validatedParams.email,
        limit: validatedParams.limit || 20,
        offset: validatedParams.offset || 0,
        sortBy: validatedParams.sort_by || 'created_at',
        sortOrder: validatedParams.sort_order || 'DESC'
      };

      // Handle search query
      let searchConditions = { conditions: [], params: [] };
      if (validatedParams.search) {
        const sanitizedSearch = sanitizeSearchQuery(validatedParams.search);
        if (sanitizedSearch) {
          searchConditions = buildSearchConditions(sanitizedSearch);
        }
      }

      // Get inquiries
      const inquiries = await db.getInquiries(options);
      
      // Filter by search if needed (since D1 doesn't support complex search queries easily)
      let filteredResults = inquiries.results;
      if (searchConditions.conditions.length > 0) {
        const searchTerm = validatedParams.search.toLowerCase();
        filteredResults = inquiries.results.filter(inquiry => {
          return inquiry.name.toLowerCase().includes(searchTerm) ||
                 inquiry.email.toLowerCase().includes(searchTerm) ||
                 inquiry.location.toLowerCase().includes(searchTerm) ||
                 inquiry.project_description.toLowerCase().includes(searchTerm);
        });
      }

      // Enhance inquiry data
      const enhancedInquiries = filteredResults.map(enhanceInquiryData);

      // Get total count for pagination
      const totalCount = await this.getTotalInquiriesCount(db, validatedParams);

      return createResponse(enhancedInquiries, 200, {
        pagination: {
          total: totalCount,
          limit: options.limit,
          offset: options.offset,
          has_more: (options.offset + options.limit) < totalCount
        },
        filters_applied: {
          status: validatedParams.status,
          priority: validatedParams.priority,
          search: validatedParams.search,
          assigned_to: validatedParams.assigned_to
        }
      });

    } catch (error) {
      throw error;
    }
  }

  // Get single inquiry by ID (admin endpoint)
  async getInquiry(request) {
    try {
      const url = new URL(request.url);
      const inquiryId = parseInt(url.pathname.split('/').pop());

      if (!inquiryId || isNaN(inquiryId)) {
        throw new ValidationError('Valid inquiry ID is required');
      }

      const db = new DatabaseService(request.env.DB);
      const inquiry = await db.getInquiry(inquiryId);

      if (!inquiry) {
        throw new NotFoundError(`Inquiry with ID ${inquiryId}`);
      }

      const enhancedInquiry = enhanceInquiryData(inquiry);

      return createResponse(enhancedInquiry);

    } catch (error) {
      throw error;
    }
  }

  // Update inquiry (admin endpoint)
  async updateInquiry(request) {
    try {
      const url = new URL(request.url);
      const inquiryId = parseInt(url.pathname.split('/').pop());

      if (!inquiryId || isNaN(inquiryId)) {
        throw new ValidationError('Valid inquiry ID is required');
      }

      const updates = await request.json();
      const validatedUpdates = updateInquirySchema.parse(updates);

      const db = new DatabaseService(request.env.DB);
      
      // Get current inquiry to validate status transitions
      const currentInquiry = await db.getInquiry(inquiryId);
      
      if (!currentInquiry) {
        throw new NotFoundError(`Inquiry with ID ${inquiryId}`);
      }

      // Validate status transition if status is being updated
      if (validatedUpdates.status && validatedUpdates.status !== currentInquiry.status) {
        const allowedTransitions = STATUS_TRANSITIONS.get(currentInquiry.status);
        
        if (!allowedTransitions || !allowedTransitions.has(validatedUpdates.status)) {
          throw new ValidationError(`Invalid status transition from '${currentInquiry.status}' to '${validatedUpdates.status}'`);
        }
      }

      const updatedInquiry = await db.updateInquiry(inquiryId, validatedUpdates);
      const enhancedInquiry = enhanceInquiryData(updatedInquiry);

      return createResponse(enhancedInquiry, 200, {
        message: 'Inquiry updated successfully',
        changes_made: Object.keys(validatedUpdates)
      });

    } catch (error) {
      throw error;
    }
  }

  // Delete inquiry (admin endpoint)
  async deleteInquiry(request) {
    try {
      const url = new URL(request.url);
      const inquiryId = parseInt(url.pathname.split('/').pop());

      if (!inquiryId || isNaN(inquiryId)) {
        throw new ValidationError('Valid inquiry ID is required');
      }

      const db = new DatabaseService(request.env.DB);
      
      // Check if inquiry exists
      const inquiry = await db.getInquiry(inquiryId);
      
      if (!inquiry) {
        throw new NotFoundError(`Inquiry with ID ${inquiryId}`);
      }

      await db.deleteInquiry(inquiryId);

      return createResponse({
        message: 'Inquiry deleted successfully',
        deleted_inquiry: {
          id: inquiryId,
          name: inquiry.name,
          email: inquiry.email,
          created_at: inquiry.created_at
        }
      });

    } catch (error) {
      throw error;
    }
  }

  // Get inquiry statistics (admin endpoint)
  async getInquiryStats(request) {
    try {
      const db = new DatabaseService(request.env.DB);
      
      // Get all inquiries for statistics
      const allInquiries = await db.getInquiries({ limit: 1000 });
      const inquiries = allInquiries.results;

      // Calculate statistics
      const stats = {
        total_inquiries: inquiries.length,
        by_status: {
          pending: inquiries.filter(i => i.status === 'pending').length,
          in_progress: inquiries.filter(i => i.status === 'in_progress').length,
          completed: inquiries.filter(i => i.status === 'completed').length,
          cancelled: inquiries.filter(i => i.status === 'cancelled').length
        },
        by_priority: {
          critical: inquiries.filter(i => i.priority === 1).length,
          high: inquiries.filter(i => i.priority === 2).length,
          medium: inquiries.filter(i => i.priority === 3).length,
          low: inquiries.filter(i => i.priority === 4).length,
          backlog: inquiries.filter(i => i.priority === 5).length
        },
        urgent_inquiries: inquiries.filter(i => i.priority <= 2 && i.status === 'pending').length,
        average_response_time: this.calculateAverageResponseTime(inquiries),
        this_month: inquiries.filter(i => {
          const created = new Date(i.created_at);
          const now = new Date();
          return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
        }).length,
        completion_rate: this.calculateCompletionRate(inquiries)
      };

      return createResponse(stats, 200, {
        calculated_at: new Date().toISOString(),
        period: 'all_time'
      });

    } catch (error) {
      throw error;
    }
  }

  // Helper methods
  async getTotalInquiriesCount(db, filters) {
    // For simplicity, get all and count (in production, you'd want a COUNT query)
    const options = {
      status: filters.status,
      priority: filters.priority,
      assigned_to: filters.assigned_to,
      email: filters.email
    };
    
    const allInquiries = await db.getInquiries(options);
    return allInquiries.results.length;
  }

  calculateAverageResponseTime(inquiries) {
    const respondedInquiries = inquiries.filter(i => i.status !== 'pending');
    
    if (respondedInquiries.length === 0) return 0;
    
    const totalResponseTime = respondedInquiries.reduce((total, inquiry) => {
      const created = new Date(inquiry.created_at);
      const updated = new Date(inquiry.updated_at);
      return total + (updated - created);
    }, 0);
    
    const averageMs = totalResponseTime / respondedInquiries.length;
    return Math.round(averageMs / (1000 * 60 * 60)); // Convert to hours
  }

  calculateCompletionRate(inquiries) {
    if (inquiries.length === 0) return 0;
    
    const completedCount = inquiries.filter(i => i.status === 'completed').length;
    return Math.round((completedCount / inquiries.length) * 100);
  }
}

// Helper function to calculate automatic priority
function calculateAutoPriority(inquiryData) {
  let priority = 3; // Default: Medium
  
  const description = inquiryData.project_description.toLowerCase();
  
  // High priority keywords
  const urgentKeywords = ['urgent', 'asap', 'immediately', 'emergency', 'deadline'];
  const importantKeywords = ['commercial', 'office', 'hotel', 'restaurant', 'large'];
  
  if (urgentKeywords.some(keyword => description.includes(keyword))) {
    priority = 1; // Critical
  } else if (importantKeywords.some(keyword => description.includes(keyword))) {
    priority = 2; // High
  }
  
  return priority;
}

// Simple similarity calculation (Jaccard similarity)
function calculateSimilarity(str1, str2) {
  const set1 = new Set(str1.split(' '));
  const set2 = new Set(str2.split(' '));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

// Export singleton instance
const inquiryRoutes = new InquiryRoutes();
export default inquiryRoutes;