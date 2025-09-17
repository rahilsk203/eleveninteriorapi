-- Migration: 0003_create_api_analytics_table.sql
-- Track API usage for performance monitoring and rate limiting

CREATE TABLE IF NOT EXISTS api_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT DEFAULT NULL
);

-- Indexes for analytics and monitoring
CREATE INDEX IF NOT EXISTS idx_analytics_endpoint ON api_analytics(endpoint);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON api_analytics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_status ON api_analytics(status_code);
CREATE INDEX IF NOT EXISTS idx_analytics_ip ON api_analytics(ip_address, timestamp DESC);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
    ip_address TEXT PRIMARY KEY,
    request_count INTEGER DEFAULT 1,
    window_start DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_request DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_last_request ON rate_limits(last_request);