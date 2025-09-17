-- Migration: 0007_add_category_column.sql
-- Add category column to media_metadata table for better image organization

ALTER TABLE media_metadata ADD COLUMN category TEXT DEFAULT '';

-- Create index for category for better performance when filtering by category
CREATE INDEX IF NOT EXISTS idx_media_category ON media_metadata(section, category);

-- Update existing records to have empty category as default
UPDATE media_metadata SET category = '' WHERE category IS NULL;