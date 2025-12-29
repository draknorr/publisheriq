-- Add items_skipped column to sync_jobs table
-- Tracks apps that were processed but had no data available (e.g., no histogram data)

ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS items_skipped INTEGER DEFAULT 0;

COMMENT ON COLUMN sync_jobs.items_skipped IS 'Number of items skipped (no data available from API)';
