-- Migration: Add velocity tracking columns to sync_status
-- Purpose: Enable velocity-based sync scheduling with per-app intervals

-- Add reviews-specific scheduling columns
ALTER TABLE sync_status
    ADD COLUMN IF NOT EXISTS next_reviews_sync TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS reviews_interval_hours INTEGER DEFAULT 24,
    ADD COLUMN IF NOT EXISTS review_velocity_tier TEXT DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS last_known_total_reviews INTEGER,
    ADD COLUMN IF NOT EXISTS velocity_7d DECIMAL(8,4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS velocity_calculated_at TIMESTAMPTZ;

-- Index for reviews-specific sync queries
CREATE INDEX IF NOT EXISTS idx_sync_status_reviews_sync
    ON sync_status(next_reviews_sync, review_velocity_tier)
    WHERE is_syncable = TRUE;

-- Add constraint for velocity tier values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_review_velocity_tier'
    ) THEN
        ALTER TABLE sync_status
            ADD CONSTRAINT chk_review_velocity_tier
            CHECK (review_velocity_tier IN ('high', 'medium', 'low', 'dormant', 'unknown'));
    END IF;
END $$;

-- Add comments
COMMENT ON COLUMN sync_status.next_reviews_sync IS 'Next scheduled time for reviews sync (velocity-based)';
COMMENT ON COLUMN sync_status.reviews_interval_hours IS 'Current sync interval: 4 (high), 12 (medium), 24 (low), 72 (dormant)';
COMMENT ON COLUMN sync_status.review_velocity_tier IS 'Velocity tier: high (>=5/day), medium (1-5), low (0.1-1), dormant (<0.1)';
COMMENT ON COLUMN sync_status.last_known_total_reviews IS 'Cached total_reviews for delta calculation';
COMMENT ON COLUMN sync_status.velocity_7d IS '7-day average reviews per day';
