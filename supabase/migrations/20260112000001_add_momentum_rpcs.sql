-- Migration: Add momentum and sentiment RPCs for embedding enrichment
-- Sprint 2.1-2.2: Temporal aggregation functions

-- ============================================================================
-- RPC 1: get_game_momentum
-- Returns CCU growth metrics and review velocity for a single game
-- ============================================================================
CREATE OR REPLACE FUNCTION get_game_momentum(p_appid INTEGER)
RETURNS TABLE (
  ccu_growth_7d NUMERIC,
  ccu_growth_30d NUMERIC,
  velocity_7d NUMERIC,
  velocity_acceleration NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_recent_7d_avg NUMERIC;
  v_prev_7d_avg NUMERIC;
  v_full_30d_avg NUMERIC;
  v_velocity_7d NUMERIC;
  v_velocity_30d NUMERIC;
BEGIN
  -- Calculate CCU averages from ccu_snapshots
  -- Recent 7 days average
  SELECT AVG(player_count)::NUMERIC
  INTO v_recent_7d_avg
  FROM ccu_snapshots
  WHERE appid = p_appid
    AND snapshot_time > NOW() - INTERVAL '7 days';

  -- Previous 7 days average (days 8-14)
  SELECT AVG(player_count)::NUMERIC
  INTO v_prev_7d_avg
  FROM ccu_snapshots
  WHERE appid = p_appid
    AND snapshot_time > NOW() - INTERVAL '14 days'
    AND snapshot_time <= NOW() - INTERVAL '7 days';

  -- Full 30 days average (baseline)
  SELECT AVG(player_count)::NUMERIC
  INTO v_full_30d_avg
  FROM ccu_snapshots
  WHERE appid = p_appid
    AND snapshot_time > NOW() - INTERVAL '30 days';

  -- Get velocity metrics from materialized view
  SELECT rvs.velocity_7d, rvs.velocity_30d
  INTO v_velocity_7d, v_velocity_30d
  FROM review_velocity_stats rvs
  WHERE rvs.appid = p_appid;

  -- Return calculated metrics
  RETURN QUERY SELECT
    -- CCU growth 7d: week-over-week change
    CASE
      WHEN v_prev_7d_avg IS NOT NULL AND v_prev_7d_avg > 0
      THEN ROUND(((v_recent_7d_avg - v_prev_7d_avg) / v_prev_7d_avg) * 100, 2)
      ELSE NULL
    END AS ccu_growth_7d,

    -- CCU growth 30d: deviation from 30-day baseline
    CASE
      WHEN v_full_30d_avg IS NOT NULL AND v_full_30d_avg > 0
      THEN ROUND(((v_recent_7d_avg - v_full_30d_avg) / v_full_30d_avg) * 100, 2)
      ELSE NULL
    END AS ccu_growth_30d,

    -- Review velocity (7-day average)
    v_velocity_7d AS velocity_7d,

    -- Velocity acceleration (positive = gaining reviews faster)
    CASE
      WHEN v_velocity_7d IS NOT NULL AND v_velocity_30d IS NOT NULL
      THEN ROUND(v_velocity_7d - v_velocity_30d, 4)
      ELSE NULL
    END AS velocity_acceleration;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION get_game_momentum(INTEGER) IS
'Returns CCU growth and review velocity metrics for embedding enrichment.
ccu_growth_7d: % change week-over-week
ccu_growth_30d: % deviation from 30-day baseline
velocity_7d: reviews per day (7-day avg)
velocity_acceleration: velocity_7d - velocity_30d (positive = accelerating)';


-- ============================================================================
-- RPC 2: get_sentiment_trajectory
-- Returns sentiment shift between recent and historical reviews
-- ============================================================================
CREATE OR REPLACE FUNCTION get_sentiment_trajectory(p_appid INTEGER)
RETURNS TABLE (
  recent_review_pct NUMERIC,
  historical_review_pct NUMERIC,
  sentiment_delta NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_recent_positive INTEGER;
  v_recent_total INTEGER;
  v_positive INTEGER;
  v_total INTEGER;
  v_recent_pct NUMERIC;
  v_historical_pct NUMERIC;
BEGIN
  -- Get latest daily_metrics for the app
  SELECT
    dm.recent_positive,
    dm.recent_total_reviews,
    dm.positive_reviews,
    dm.total_reviews
  INTO
    v_recent_positive,
    v_recent_total,
    v_positive,
    v_total
  FROM daily_metrics dm
  WHERE dm.appid = p_appid
  ORDER BY dm.metric_date DESC
  LIMIT 1;

  -- Calculate percentages
  v_recent_pct := CASE
    WHEN v_recent_total IS NOT NULL AND v_recent_total > 0
    THEN ROUND((v_recent_positive::NUMERIC / v_recent_total) * 100, 2)
    ELSE NULL
  END;

  v_historical_pct := CASE
    WHEN v_total IS NOT NULL AND v_total > 0
    THEN ROUND((v_positive::NUMERIC / v_total) * 100, 2)
    ELSE NULL
  END;

  -- Return calculated metrics
  RETURN QUERY SELECT
    v_recent_pct AS recent_review_pct,
    v_historical_pct AS historical_review_pct,
    CASE
      WHEN v_recent_pct IS NOT NULL AND v_historical_pct IS NOT NULL
      THEN ROUND(v_recent_pct - v_historical_pct, 2)
      ELSE NULL
    END AS sentiment_delta;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION get_sentiment_trajectory(INTEGER) IS
'Returns sentiment trajectory metrics for embedding enrichment.
recent_review_pct: positive % of reviews from last 30 days
historical_review_pct: positive % of all-time reviews
sentiment_delta: recent - historical (positive = improving sentiment)';
