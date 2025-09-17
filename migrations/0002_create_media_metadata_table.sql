-- Migration: 0002_create_media_metadata_table.sql
-- Store metadata for videos and images for faster retrieval

CREATE TABLE IF NOT EXISTS media_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_type TEXT NOT NULL CHECK(media_type IN ('video', 'image')),
    section TEXT NOT NULL,
    cloudinary_public_id TEXT NOT NULL UNIQUE,
    cloudinary_url TEXT NOT NULL,
    secure_url TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    format TEXT,
    bytes INTEGER,
    duration REAL, -- for videos only
    alt_text TEXT DEFAULT '',
    title TEXT DEFAULT '',
    description TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for optimized media queries
CREATE INDEX IF NOT EXISTS idx_media_type_section ON media_metadata(media_type, section);
CREATE INDEX IF NOT EXISTS idx_media_section_active ON media_metadata(section, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_media_cloudinary_id ON media_metadata(cloudinary_public_id);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media_metadata(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER IF NOT EXISTS update_media_timestamp 
AFTER UPDATE ON media_metadata
FOR EACH ROW
BEGIN
    UPDATE media_metadata SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Pre-defined valid sections (can be enforced via CHECK constraint)
-- Video sections: 'hero', 'feature'
-- Image sections: 'contact', 'entrance', 'gallery', 'logo', 'about', 'swordman'