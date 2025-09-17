-- Migration: 0004_fix_inquiries_table.sql
-- Drop and recreate inquiries table to fix remote database issues

-- Drop existing table and indexes if they exist
DROP TABLE IF EXISTS inquiries;

-- Create inquiries table with optimized structure
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

-- Create optimized indexes for performance
CREATE INDEX idx_inquiries_status ON inquiries(status);
CREATE INDEX idx_inquiries_created_at ON inquiries(created_at DESC);
CREATE INDEX idx_inquiries_email ON inquiries(email);
CREATE INDEX idx_inquiries_priority_status ON inquiries(priority, status);
CREATE INDEX idx_inquiries_assigned_to ON inquiries(assigned_to);
CREATE INDEX idx_inquiries_dashboard ON inquiries(status, created_at DESC, priority);

-- Create update trigger for timestamp maintenance
CREATE TRIGGER update_inquiries_timestamp 
AFTER UPDATE ON inquiries
FOR EACH ROW
BEGIN
    UPDATE inquiries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;