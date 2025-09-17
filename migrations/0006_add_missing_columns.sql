-- Migration: 0006_add_missing_columns.sql
-- Add missing columns to media_metadata table

ALTER TABLE media_metadata ADD COLUMN title TEXT DEFAULT '';
ALTER TABLE media_metadata ADD COLUMN description TEXT DEFAULT '';
ALTER TABLE media_metadata ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE media_metadata ADD COLUMN secure_url TEXT;
ALTER TABLE media_metadata ADD COLUMN bytes INTEGER;

-- Create index for sort_order for better performance
CREATE INDEX idx_media_sort_order ON media_metadata(section, sort_order);

-- Update secure_url to match cloudinary_secure_url for existing records
UPDATE media_metadata SET secure_url = cloudinary_secure_url WHERE secure_url IS NULL;

-- Update bytes from file_size for existing records
UPDATE media_metadata SET bytes = file_size WHERE bytes IS NULL;