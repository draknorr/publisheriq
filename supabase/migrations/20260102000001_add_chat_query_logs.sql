-- Chat query logs for analytics and debugging
-- Uses 7-day retention with auto-cleanup

CREATE TABLE chat_query_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query_text TEXT NOT NULL,
    tool_names TEXT[] DEFAULT '{}',
    tool_count INTEGER DEFAULT 0,
    iteration_count INTEGER DEFAULT 1,
    response_length INTEGER DEFAULT 0,
    timing_llm_ms INTEGER,
    timing_tools_ms INTEGER,
    timing_total_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for time-based queries and cleanup
CREATE INDEX idx_chat_query_logs_created_at ON chat_query_logs(created_at DESC);

-- Index for searching by tool usage
CREATE INDEX idx_chat_query_logs_tool_names ON chat_query_logs USING GIN(tool_names);

-- Enable RLS (matching pattern from initial_schema.sql)
ALTER TABLE chat_query_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for admin dashboard)
CREATE POLICY "Allow public read access" ON chat_query_logs FOR SELECT USING (true);

-- Function for cleanup (called by cron or manual trigger)
CREATE OR REPLACE FUNCTION cleanup_old_chat_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM chat_query_logs
    WHERE created_at < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
