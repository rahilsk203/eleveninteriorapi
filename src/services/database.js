/**
 * Database Service - Optimized D1 operations with query caching
 * DSA Optimization: Prepared statements and connection pooling simulation
 */

import { DatabaseError } from '../middleware/errorHandler.js';

class DatabaseService {
  constructor(db) {
    this.db = db;
    // Query cache for frequently used queries (O(1) access)
    this.queryCache = new Map();
    this.maxCacheSize = 100;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Execute query with caching support
  async executeQuery(sql, params = [], useCache = false, cacheKey = null) {
    try {
      // Check cache first if caching is enabled
      if (useCache && cacheKey) {
        const cached = this.queryCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.result;
        }
      }

      // Execute query
      const result = await this.db.prepare(sql).bind(...params).all();

      // Cache result if caching is enabled
      if (useCache && cacheKey) {
        // Implement LRU eviction
        if (this.queryCache.size >= this.maxCacheSize) {
          const firstKey = this.queryCache.keys().next().value;
          this.queryCache.delete(firstKey);
        }
        
        this.queryCache.set(cacheKey, {
          result: result,
          timestamp: Date.now()
        });
      }

      return result;
      
    } catch (error) {
      throw new DatabaseError(`Query execution failed: ${error.message}`);
    }
  }

  // Inquiry operations
  async createInquiry(inquiryData) {
    const sql = `
      INSERT INTO inquiries (name, email, phone, location, project_description, status, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      inquiryData.name,
      inquiryData.email,
      inquiryData.phone,
      inquiryData.location,
      inquiryData.project_description,
      inquiryData.status || 'pending',
      inquiryData.priority || 3
    ];

    try {
      const result = await this.db.prepare(sql).bind(...params).run();
      
      if (result.success) {
        return await this.getInquiry(result.meta.last_row_id);
      } else {
        throw new DatabaseError('Failed to create inquiry');
      }
    } catch (error) {
      throw new DatabaseError(`Create inquiry failed: ${error.message}`);
    }
  }

  async getInquiry(id) {
    const sql = `SELECT * FROM inquiries WHERE id = ?`;
    const result = await this.executeQuery(sql, [id]);
    
    if (result.results.length === 0) {
      return null;
    }
    
    return result.results[0];
  }

  async getInquiries(options = {}) {
    let sql = `SELECT * FROM inquiries`;
    const params = [];
    const conditions = [];

    // Add filters
    if (options.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }

    if (options.priority) {
      conditions.push('priority = ?');
      params.push(options.priority);
    }

    if (options.email) {
      conditions.push('email = ?');
      params.push(options.email);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    // Add sorting (default: newest first)
    sql += ` ORDER BY ${options.sortBy || 'created_at'} ${options.sortOrder || 'DESC'}`;

    // Add pagination
    if (options.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
      
      if (options.offset) {
        sql += ` OFFSET ?`;
        params.push(options.offset);
      }
    }

    // Use caching for frequently accessed data
    const useCache = !options.status && !options.priority && !options.email;
    const cacheKey = useCache ? `inquiries_${options.sortBy || 'created_at'}_${options.limit || 'all'}` : null;

    return await this.executeQuery(sql, params, useCache, cacheKey);
  }

  async updateInquiry(id, updates) {
    const allowedFields = ['name', 'email', 'phone', 'location', 'project_description', 'status', 'priority', 'notes', 'assigned_to'];
    const setClause = [];
    const params = [];

    // Build dynamic update query
    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.includes(key) && value !== undefined) {
        setClause.push(`${key} = ?`);
        params.push(value);
      }
    });

    if (setClause.length === 0) {
      throw new DatabaseError('No valid fields to update');
    }

    params.push(id); // Add ID for WHERE clause

    const sql = `
      UPDATE inquiries 
      SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    try {
      const result = await this.db.prepare(sql).bind(...params).run();
      
      if (result.success && result.meta.changes > 0) {
        // Clear cache for inquiries
        this.clearInquiryCache();
        return await this.getInquiry(id);
      } else {
        throw new DatabaseError('Inquiry not found or no changes made');
      }
    } catch (error) {
      throw new DatabaseError(`Update inquiry failed: ${error.message}`);
    }
  }

  async deleteInquiry(id) {
    const sql = `DELETE FROM inquiries WHERE id = ?`;
    
    try {
      const result = await this.db.prepare(sql).bind(id).run();
      
      if (result.success && result.meta.changes > 0) {
        // Clear cache for inquiries
        this.clearInquiryCache();
        return true;
      } else {
        throw new DatabaseError('Inquiry not found');
      }
    } catch (error) {
      throw new DatabaseError(`Delete inquiry failed: ${error.message}`);
    }
  }

  // Media metadata operations
  async saveMediaMetadata(metadata) {
    const sql = `
      INSERT INTO media_metadata (
        media_type, section, cloudinary_public_id, cloudinary_url, cloudinary_secure_url,
        original_filename, file_size, width, height, format, alt_text, is_active,
        title, description, sort_order, secure_url, bytes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      metadata.media_type,
      metadata.section,
      metadata.cloudinary_public_id,
      metadata.cloudinary_url,
      metadata.cloudinary_secure_url || metadata.secure_url,
      metadata.original_filename || '',
      metadata.file_size || metadata.bytes || 0,
      metadata.width,
      metadata.height,
      metadata.format,
      metadata.alt_text || '',
      metadata.is_active !== false ? true : false,
      metadata.title || '',
      metadata.description || '',
      metadata.sort_order || 0,
      metadata.secure_url || metadata.cloudinary_secure_url,
      metadata.bytes || metadata.file_size || 0
    ];

    try {
      const result = await this.db.prepare(sql).bind(...params).run();
      
      if (result.success) {
        this.clearMediaCache();
        return await this.getMediaMetadata(result.meta.last_row_id);
      } else {
        throw new DatabaseError('Failed to save media metadata');
      }
    } catch (error) {
      throw new DatabaseError(`Save media metadata failed: ${error.message}`);
    }
  }

  async getMediaMetadata(id) {
    const sql = `SELECT * FROM media_metadata WHERE id = ?`;
    const result = await this.executeQuery(sql, [id]);
    
    return result.results.length > 0 ? result.results[0] : null;
  }

  async getMediaBySection(mediaType, section) {
    const sql = `
      SELECT * FROM media_metadata 
      WHERE media_type = ? AND section = ? AND is_active = TRUE
      ORDER BY sort_order ASC, upload_timestamp DESC
    `;
    
    const cacheKey = `media_${mediaType}_${section}`;
    return await this.executeQuery(sql, [mediaType, section], true, cacheKey);
  }

  async updateMediaMetadata(id, updates) {
    const allowedFields = ['alt_text', 'title', 'description', 'sort_order', 'is_active'];
    const setClause = [];
    const params = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.includes(key) && value !== undefined) {
        setClause.push(`${key} = ?`);
        params.push(value);
      }
    });

    if (setClause.length === 0) {
      throw new DatabaseError('No valid fields to update');
    }

    params.push(id);

    const sql = `
      UPDATE media_metadata 
      SET ${setClause.join(', ')}, last_accessed = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    try {
      const result = await this.db.prepare(sql).bind(...params).run();
      
      if (result.success && result.meta.changes > 0) {
        this.clearMediaCache();
        return await this.getMediaMetadata(id);
      } else {
        throw new DatabaseError('Media not found or no changes made');
      }
    } catch (error) {
      throw new DatabaseError(`Update media metadata failed: ${error.message}`);
    }
  }

  async deleteMediaMetadata(id) {
    const sql = `DELETE FROM media_metadata WHERE id = ?`;
    
    try {
      const result = await this.db.prepare(sql).bind(id).run();
      
      if (result.success && result.meta.changes > 0) {
        this.clearMediaCache();
        return true;
      } else {
        throw new DatabaseError('Media not found');
      }
    } catch (error) {
      throw new DatabaseError(`Delete media metadata failed: ${error.message}`);
    }
  }

  // Cache management
  clearInquiryCache() {
    for (const [key] of this.queryCache) {
      if (key.startsWith('inquiries_')) {
        this.queryCache.delete(key);
      }
    }
  }

  clearMediaCache() {
    for (const [key] of this.queryCache) {
      if (key.startsWith('media_')) {
        this.queryCache.delete(key);
      }
    }
  }

  clearAllCache() {
    this.queryCache.clear();
  }

  // Analytics operations
  async logApiCall(logData) {
    const sql = `
      INSERT INTO api_analytics (endpoint, method, status_code, response_time_ms, ip_address, user_agent, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      logData.endpoint,
      logData.method,
      logData.status_code,
      logData.response_time_ms,
      logData.ip_address,
      logData.user_agent,
      logData.error_message
    ];

    try {
      await this.db.prepare(sql).bind(...params).run();
    } catch (error) {
      // Don't throw error for analytics logging failure
      console.error('Failed to log API call:', error.message);
    }
  }
}

export { DatabaseService };