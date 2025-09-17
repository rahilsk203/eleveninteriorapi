-- Migration: 0001_create_inquiries_table.sql
-- Create inquiries table with optimized indexes for fast queries

CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    location TEXT NOT NULL,
    project_description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority INTEGER DEFAULT 3 CHECK(priority BETWEEN 1 AND 5), -- 1=highest, 5=lowest
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT DEFAULT '',
    assigned_to TEXT DEFAULT NULL
);

-- Optimized indexes for common query patterns (DSA: B-tree indexes for O(log n) lookups)
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_email ON inquiries(email);
CREATE INDEX IF NOT EXISTS idx_inquiries_priority_status ON inquiries(priority, status);
CREATE INDEX IF NOT EXISTS idx_inquiries_assigned_to ON inquiries(assigned_to);

-- Composite index for admin dashboard queries (status + created_at for pagination)
CREATE INDEX IF NOT EXISTS idx_inquiries_dashboard ON inquiries(status, created_at DESC, priority);

-- Update trigger to maintain updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_inquiries_timestamp 
AFTER UPDATE ON inquiries
FOR EACH ROW
BEGIN
    UPDATE inquiries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;