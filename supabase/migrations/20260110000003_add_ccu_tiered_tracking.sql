-- Tiered CCU Tracking System
-- Provides hourly granularity for high-priority games (Tier 1+2)
-- with daily tracking for the rest (Tier 3)

-- =============================================================================
-- Table: ccu_snapshots
-- Stores hourly CCU snapshots for Tier 1 and Tier 2 games
-- Retained for 30 days, then aggregated to daily_metrics
-- =============================================================================

CREATE TABLE ccu_snapshots (
  id BIGSERIAL PRIMARY KEY,
  appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
  snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  player_count INTEGER NOT NULL,
  ccu_tier SMALLINT NOT NULL, -- 1, 2, or 3

  UNIQUE(appid, snapshot_time)
);

-- Index for fetching a game's history
CREATE INDEX idx_ccu_snapshots_appid_time
  ON ccu_snapshots (appid, snapshot_time DESC);

-- Index for time-based queries (cleanup, aggregation)
CREATE INDEX idx_ccu_snapshots_time
  ON ccu_snapshots (snapshot_time DESC);

-- Index for tier-based queries
CREATE INDEX idx_ccu_snapshots_tier_time
  ON ccu_snapshots (ccu_tier, snapshot_time DESC);

-- Note: Partial index for recent data removed - NOW() is not immutable
-- Query performance is still good with idx_ccu_snapshots_appid_time

COMMENT ON TABLE ccu_snapshots IS 'Hourly CCU snapshots for tiered tracking. Tier 1+2 games get hourly/2-hourly snapshots. Retained for 30 days.';
COMMENT ON COLUMN ccu_snapshots.ccu_tier IS 'Tier at time of snapshot: 1=hourly (top CCU), 2=every 2h (new releases), 3=daily (all others)';

-- =============================================================================
-- Table: ccu_tier_assignments
-- Tracks current tier assignment for each game (recalculated hourly)
-- =============================================================================

CREATE TABLE ccu_tier_assignments (
  appid INTEGER PRIMARY KEY REFERENCES apps(appid) ON DELETE CASCADE,
  ccu_tier SMALLINT NOT NULL DEFAULT 3, -- 1=hourly, 2=every2h, 3=daily
  tier_reason TEXT, -- 'top_ccu', 'new_release', 'default'
  last_tier_change TIMESTAMPTZ DEFAULT NOW(),
  recent_peak_ccu INTEGER, -- Used for Tier 1 ranking (7-day max)
  release_rank INTEGER, -- Used for Tier 2 ranking (1 = newest)
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ccu_tier_assignments_tier ON ccu_tier_assignments (ccu_tier);

-- Partial index for Tier 1 ranking queries
CREATE INDEX idx_ccu_tier_assignments_tier1
  ON ccu_tier_assignments (recent_peak_ccu DESC NULLS LAST)
  WHERE ccu_tier = 1;

-- Partial index for Tier 2 ranking queries
CREATE INDEX idx_ccu_tier_assignments_tier2
  ON ccu_tier_assignments (release_rank ASC NULLS LAST)
  WHERE ccu_tier = 2;

COMMENT ON TABLE ccu_tier_assignments IS 'Current tier assignment for each game. Tier 1 = top 500 by CCU (hourly), Tier 2 = 1000 newest releases (every 2h), Tier 3 = all others (daily). Recalculated hourly.';
COMMENT ON COLUMN ccu_tier_assignments.recent_peak_ccu IS 'Maximum CCU in the last 7 days, used for Tier 1 ranking';
COMMENT ON COLUMN ccu_tier_assignments.release_rank IS 'Release date rank (1 = newest), used for Tier 2 ranking';

-- =============================================================================
-- Function: recalculate_ccu_tiers()
-- Recalculates tier assignments based on CCU and release date
-- Called hourly by the tiered CCU worker
-- =============================================================================

CREATE OR REPLACE FUNCTION recalculate_ccu_tiers()
RETURNS TABLE(tier1_count INT, tier2_count INT, tier3_count INT) AS $$
DECLARE
  v_tier1_count INT;
  v_tier2_count INT;
  v_tier3_count INT;
BEGIN
  -- Step 1: Calculate recent peak CCU for all games (last 7 days from snapshots)
  -- Falls back to daily_metrics if no snapshots exist yet
  CREATE TEMP TABLE recent_ccu ON COMMIT DROP AS
  SELECT
    COALESCE(s.appid, d.appid) as appid,
    GREATEST(COALESCE(s.peak_ccu, 0), COALESCE(d.peak_ccu, 0)) as recent_peak_ccu
  FROM (
    SELECT appid, MAX(player_count) as peak_ccu
    FROM ccu_snapshots
    WHERE snapshot_time > NOW() - INTERVAL '7 days'
    GROUP BY appid
  ) s
  FULL OUTER JOIN (
    SELECT appid, MAX(ccu_peak) as peak_ccu
    FROM daily_metrics
    WHERE metric_date > CURRENT_DATE - INTERVAL '7 days'
    GROUP BY appid
  ) d ON s.appid = d.appid;

  -- Step 2: Get release rankings (newest first, only last year)
  CREATE TEMP TABLE release_ranks ON COMMIT DROP AS
  SELECT
    appid,
    ROW_NUMBER() OVER (ORDER BY release_date DESC NULLS LAST, appid DESC) as release_rank
  FROM apps
  WHERE type = 'game'
    AND is_released = TRUE
    AND is_delisted = FALSE
    AND release_date IS NOT NULL
    AND release_date >= CURRENT_DATE - INTERVAL '1 year';

  -- Step 3: Determine Tier 1 (top 500 by CCU)
  CREATE TEMP TABLE tier1_games ON COMMIT DROP AS
  SELECT appid
  FROM recent_ccu
  WHERE recent_peak_ccu > 0
  ORDER BY recent_peak_ccu DESC NULLS LAST
  LIMIT 500;

  -- Step 4: Determine Tier 2 (top 1000 newest releases NOT in Tier 1)
  CREATE TEMP TABLE tier2_games ON COMMIT DROP AS
  SELECT r.appid
  FROM release_ranks r
  WHERE r.appid NOT IN (SELECT appid FROM tier1_games)
  ORDER BY r.release_rank
  LIMIT 1000;

  -- Step 5: Upsert all assignments for active games
  INSERT INTO ccu_tier_assignments (appid, ccu_tier, tier_reason, recent_peak_ccu, release_rank, updated_at)
  SELECT
    a.appid,
    CASE
      WHEN t1.appid IS NOT NULL THEN 1
      WHEN t2.appid IS NOT NULL THEN 2
      ELSE 3
    END as ccu_tier,
    CASE
      WHEN t1.appid IS NOT NULL THEN 'top_ccu'
      WHEN t2.appid IS NOT NULL THEN 'new_release'
      ELSE 'default'
    END as tier_reason,
    rc.recent_peak_ccu,
    rr.release_rank,
    NOW()
  FROM apps a
  LEFT JOIN tier1_games t1 ON a.appid = t1.appid
  LEFT JOIN tier2_games t2 ON a.appid = t2.appid
  LEFT JOIN recent_ccu rc ON a.appid = rc.appid
  LEFT JOIN release_ranks rr ON a.appid = rr.appid
  WHERE a.type = 'game' AND a.is_released = TRUE AND a.is_delisted = FALSE
  ON CONFLICT (appid) DO UPDATE SET
    ccu_tier = EXCLUDED.ccu_tier,
    tier_reason = EXCLUDED.tier_reason,
    recent_peak_ccu = EXCLUDED.recent_peak_ccu,
    release_rank = EXCLUDED.release_rank,
    last_tier_change = CASE
      WHEN ccu_tier_assignments.ccu_tier != EXCLUDED.ccu_tier
      THEN NOW()
      ELSE ccu_tier_assignments.last_tier_change
    END,
    updated_at = NOW();

  -- Get counts for return
  SELECT COUNT(*) INTO v_tier1_count FROM ccu_tier_assignments WHERE ccu_tier = 1;
  SELECT COUNT(*) INTO v_tier2_count FROM ccu_tier_assignments WHERE ccu_tier = 2;
  SELECT COUNT(*) INTO v_tier3_count FROM ccu_tier_assignments WHERE ccu_tier = 3;

  RETURN QUERY SELECT v_tier1_count, v_tier2_count, v_tier3_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_ccu_tiers() IS 'Recalculates tier assignments: Tier 1 = top 500 by 7-day peak CCU, Tier 2 = 1000 newest releases not in Tier 1, Tier 3 = all others';

-- =============================================================================
-- Function: cleanup_old_ccu_snapshots()
-- Deletes snapshots older than 30 days
-- Called by scheduled cleanup workflow
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_ccu_snapshots()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete snapshots older than 30 days
  -- Daily aggregates should already exist in daily_metrics from nightly aggregation
  DELETE FROM ccu_snapshots
  WHERE snapshot_time < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_ccu_snapshots() IS 'Removes CCU snapshots older than 30 days. Run after ensuring daily_metrics has aggregated peaks.';

-- =============================================================================
-- Function: aggregate_daily_ccu_peaks()
-- Aggregates hourly snapshots to daily peaks in daily_metrics
-- Should be run before cleanup to preserve data
-- =============================================================================

CREATE OR REPLACE FUNCTION aggregate_daily_ccu_peaks(target_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS INTEGER AS $$
DECLARE
  aggregated_count INTEGER;
BEGIN
  -- Aggregate max CCU from snapshots for the target date into daily_metrics
  INSERT INTO daily_metrics (appid, metric_date, ccu_peak, ccu_source)
  SELECT
    appid,
    target_date,
    MAX(player_count) as ccu_peak,
    'steam_api' as ccu_source
  FROM ccu_snapshots
  WHERE snapshot_time >= target_date
    AND snapshot_time < target_date + INTERVAL '1 day'
  GROUP BY appid
  ON CONFLICT (appid, metric_date) DO UPDATE SET
    ccu_peak = GREATEST(COALESCE(daily_metrics.ccu_peak, 0), EXCLUDED.ccu_peak),
    ccu_source = CASE
      WHEN EXCLUDED.ccu_peak > COALESCE(daily_metrics.ccu_peak, 0)
      THEN 'steam_api'
      ELSE daily_metrics.ccu_source
    END;

  GET DIAGNOSTICS aggregated_count = ROW_COUNT;
  RETURN aggregated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION aggregate_daily_ccu_peaks(DATE) IS 'Aggregates hourly CCU snapshots to daily peaks. Run nightly before cleanup.';
