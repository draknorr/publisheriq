-- Migration: Add last_ccu_synced column for rotation tracking
--
-- Problem: Daily CCU sync only processes ~21k of 120k+ Tier 3 games before timing out.
-- Each run queries games in the same order, so the same 21k games get synced every day.
--
-- Solution: Track when each game was last synced and query oldest-first to rotate
-- through all games across multiple runs per day.

-- Add the column to track when each game was last successfully synced for CCU
ALTER TABLE ccu_tier_assignments
ADD COLUMN IF NOT EXISTS last_ccu_synced TIMESTAMPTZ;

-- Add comment explaining the column
COMMENT ON COLUMN ccu_tier_assignments.last_ccu_synced IS
  'Timestamp of last successful CCU fetch. Used to order queries so oldest-synced games are fetched first, enabling rotation across multiple daily runs.';

-- Create partial index for efficient ordering on Tier 3 queries
-- NULLS FIRST ensures never-synced games are prioritized
CREATE INDEX IF NOT EXISTS idx_ccu_tier_last_synced
ON ccu_tier_assignments (ccu_tier, last_ccu_synced ASC NULLS FIRST)
WHERE ccu_tier = 3;
