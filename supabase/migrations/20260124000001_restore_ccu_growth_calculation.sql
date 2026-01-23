-- =============================================================================
-- Migration: Restore CCU Growth Calculation
-- Purpose: The Jan 23 migration (fix_fresh_release_ccu_tiers) accidentally removed
--          the growth calculation that was added in Jan 17 migration.
--          This restores it while keeping the fresh release fix.
-- =============================================================================

-- Update column comments
COMMENT ON COLUMN ccu_tier_assignments.ccu_growth_7d_percent IS '3-day CCU growth: ((last 3 days avg - prior 3 days avg) / prior avg) * 100. Named 7d for backwards compatibility.';

-- =============================================================================
-- Updated Function: recalculate_ccu_tiers()
-- Merges:
--   1. Fresh release fix (NULL release dates included in Tier 2)
--   2. Growth calculation (3-day windows from ccu_snapshots)
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

  -- Step 2: Get release rankings (newest first)
  -- Include games with NULL release_date if is_released=TRUE
  -- These are potential fresh releases that need tracking
  CREATE TEMP TABLE release_ranks ON COMMIT DROP AS
  SELECT
    appid,
    ROW_NUMBER() OVER (
      ORDER BY
        -- NULL release dates go first (potential fresh releases needing sync)
        CASE WHEN release_date IS NULL THEN 0 ELSE 1 END,
        release_date DESC NULLS LAST,
        appid DESC
    ) as release_rank
  FROM apps
  WHERE type = 'game'
    AND is_released = TRUE
    AND is_delisted = FALSE
    AND (
      -- Include games released in the last year
      release_date >= CURRENT_DATE - INTERVAL '1 year'
      -- Also include games with no release date (potential fresh releases)
      OR release_date IS NULL
    );

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

  -- Step 5: Calculate CCU growth percentages (RESTORED from Jan 17 migration)
  -- Uses 3-day windows instead of 7-day to work with limited snapshot history
  -- 3-day growth: (last 3 days avg - prior 3 days avg) / prior avg * 100
  -- 30-day growth: (last 3 days avg - 30-day baseline avg) / baseline avg * 100
  CREATE TEMP TABLE ccu_growth ON COMMIT DROP AS
  SELECT
    appid,
    -- 3-day growth: compare last 3 days to prior 3 days (days 3-6 ago)
    CASE
      WHEN prior_3d_avg IS NULL OR prior_3d_avg = 0 THEN NULL
      ELSE ROUND(((last_3d_avg - prior_3d_avg) / prior_3d_avg) * 100, 2)
    END AS growth_7d_pct,
    -- 30-day growth: compare last 3 days to full 30-day baseline
    CASE
      WHEN baseline_30d_avg IS NULL OR baseline_30d_avg = 0 THEN NULL
      ELSE ROUND(((last_3d_avg - baseline_30d_avg) / baseline_30d_avg) * 100, 2)
    END AS growth_30d_pct
  FROM (
    SELECT
      appid,
      AVG(player_count) FILTER (WHERE snapshot_time > NOW() - INTERVAL '3 days') AS last_3d_avg,
      AVG(player_count) FILTER (WHERE snapshot_time > NOW() - INTERVAL '6 days' AND snapshot_time <= NOW() - INTERVAL '3 days') AS prior_3d_avg,
      AVG(player_count) FILTER (WHERE snapshot_time > NOW() - INTERVAL '30 days') AS baseline_30d_avg
    FROM ccu_snapshots
    WHERE snapshot_time > NOW() - INTERVAL '30 days'
    GROUP BY appid
  ) growth_calcs;

  -- Step 6: Upsert all assignments for active games with growth data
  INSERT INTO ccu_tier_assignments (
    appid, ccu_tier, tier_reason, recent_peak_ccu, release_rank,
    ccu_growth_7d_percent, ccu_growth_30d_percent, updated_at
  )
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
    cg.growth_7d_pct,
    cg.growth_30d_pct,
    NOW()
  FROM apps a
  LEFT JOIN tier1_games t1 ON a.appid = t1.appid
  LEFT JOIN tier2_games t2 ON a.appid = t2.appid
  LEFT JOIN recent_ccu rc ON a.appid = rc.appid
  LEFT JOIN release_ranks rr ON a.appid = rr.appid
  LEFT JOIN ccu_growth cg ON a.appid = cg.appid
  WHERE a.type = 'game' AND a.is_released = TRUE AND a.is_delisted = FALSE
  ON CONFLICT (appid) DO UPDATE SET
    ccu_tier = EXCLUDED.ccu_tier,
    tier_reason = EXCLUDED.tier_reason,
    recent_peak_ccu = EXCLUDED.recent_peak_ccu,
    release_rank = EXCLUDED.release_rank,
    ccu_growth_7d_percent = EXCLUDED.ccu_growth_7d_percent,
    ccu_growth_30d_percent = EXCLUDED.ccu_growth_30d_percent,
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

COMMENT ON FUNCTION recalculate_ccu_tiers() IS 'Recalculates tier assignments and CCU growth percentages. Tier 1 = top 500 by 7-day peak CCU, Tier 2 = 1000 newest releases (including NULL release dates), Tier 3 = all others. Growth calculated using 3-day comparison windows from ccu_snapshots.';
