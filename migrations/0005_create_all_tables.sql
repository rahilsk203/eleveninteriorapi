-- Migration: 0005_create_all_tables.sql
-- Create all tables for Eleven Interior API

-- Create inquiries table
CREATE TABLE inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    location TEXT NOT NULL,
    project_description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority INTEGER DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT DEFAULT '',
    assigned_to TEXT DEFAULT NULL
);

-- Create media_metadata table
CREATE TABLE media_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_type TEXT NOT NULL CHECK(media_type IN ('video', 'image')),
    section TEXT NOT NULL,
    cloudinary_public_id TEXT NOT NULL UNIQUE,
    cloudinary_url TEXT NOT NULL,
    cloudinary_secure_url TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    format TEXT NOT NULL,
    alt_text TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    upload_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    cdn_optimization_level TEXT DEFAULT 'auto'
);

-- Create api_analytics table
CREATE TABLE api_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,
    request_size INTEGER DEFAULT 0,
    response_size INTEGER DEFAULT 0
);

-- Create indexes for inquiries table
CREATE INDEX idx_inquiries_status ON inquiries(status);
CREATE INDEX idx_inquiries_created_at ON inquiries(created_at DESC);
CREATE INDEX idx_inquiries_email ON inquiries(email);
CREATE INDEX idx_inquiries_priority_status ON inquiries(priority, status);
CREATE INDEX idx_inquiries_assigned_to ON inquiries(assigned_to);
CREATE INDEX idx_inquiries_dashboard ON inquiries(status, created_at DESC, priority);

-- Create indexes for media_metadata table
CREATE INDEX idx_media_type_section ON media_metadata(media_type, section);
CREATE INDEX idx_media_active ON media_metadata(is_active);
CREATE INDEX idx_media_upload_timestamp ON media_metadata(upload_timestamp DESC);
CREATE INDEX idx_media_cloudinary_id ON media_metadata(cloudinary_public_id);
CREATE INDEX idx_media_access_patterns ON media_metadata(access_count DESC, last_accessed);

-- Create indexes for api_analytics table
CREATE INDEX idx_analytics_endpoint ON api_analytics(endpoint);
CREATE INDEX idx_analytics_timestamp ON api_analytics(timestamp DESC);
CREATE INDEX idx_analytics_status_code ON api_analytics(status_code);
CREATE INDEX idx_analytics_performance ON api_analytics(endpoint, timestamp DESC, response_time_ms);

-- Create triggers
CREATE TRIGGER update_inquiries_timestamp 
AFTER UPDATE ON inquiries
FOR EACH ROW
BEGIN
    UPDATE inquiries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_media_access_stats
AFTER UPDATE ON media_metadata
FOR EACH ROW
WHEN NEW.last_accessed != OLD.last_accessed
BEGIN
    UPDATE media_metadata 
    SET access_count = access_count + 1 
    WHERE id = NEW.id;
END;