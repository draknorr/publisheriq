-- CCU Skip Tracking
-- Allows skipping invalid appids that consistently return result:42 from Steam API
-- Reduces wasted API calls and sync duration

-- Add columns to track CCU fetch status
ALTER TABLE ccu_tier_assignments
  ADD COLUMN IF NOT EXISTS ccu_fetch_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ccu_skip_until TIMESTAMPTZ;

-- Partial index for efficient skip queries on Tier 3
-- Only Tier 3 uses skip logic (Tier 1+2 are always polled)
CREATE INDEX IF NOT EXISTS idx_ccu_tier_skip
  ON ccu_tier_assignments (ccu_skip_until)
  WHERE ccu_tier = 3;

COMMENT ON COLUMN ccu_tier_assignments.ccu_fetch_status IS 'Last CCU fetch result: pending (untested), valid (result:1), invalid (result:42)';
COMMENT ON COLUMN ccu_tier_assignments.ccu_skip_until IS 'Skip CCU polling until this time (for invalid appids). NULL means do not skip.';
