-- Add columns to track new vs updated items in sync jobs
-- This helps troubleshoot whether jobs are getting fresh data

ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS items_created INTEGER DEFAULT 0;
ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS items_updated INTEGER DEFAULT 0;

COMMENT ON COLUMN sync_jobs.items_created IS 'Number of new records created during this job';
COMMENT ON COLUMN sync_jobs.items_updated IS 'Number of existing records updated during this job';
