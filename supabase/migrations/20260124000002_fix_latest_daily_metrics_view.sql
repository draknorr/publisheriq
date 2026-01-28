-- =============================================================================
-- Migration: Fix latest_daily_metrics View to Coalesce Across Rows
-- =============================================================================
--
-- Problem: Different sync workers write different columns to daily_metrics:
--   - CCU sync: ccu_peak, ccu_source (hourly for Tier 1/2, 3x daily for Tier 3)
--   - Reviews sync: total_reviews, positive_reviews, review_score (variable)
--   - SteamSpy sync: owners, price, playtime, reviews (daily at 02:15 UTC)
--
-- The old view used DISTINCT ON (appid) ORDER BY metric_date DESC, which picks
-- only the single most recent row. If CCU sync ran most recently (creating a
-- row with only CCU data), all other columns appear as NULL.
--
-- Solution: Use separate subqueries to get the most recent non-NULL value for
-- each column group, then join them together.
-- =============================================================================

-- Drop dependent view first
DROP MATERIALIZED VIEW IF EXISTS mv_apps_aggregate_stats;

-- Now drop the main view
DROP MATERIALIZED VIEW IF EXISTS latest_daily_metrics;

CREATE MATERIALIZED VIEW latest_daily_metrics AS
WITH
  -- Most recent CCU data (from CCU sync or SteamSpy)
  latest_ccu AS (
    SELECT DISTINCT ON (appid)
      appid,
      metric_date AS ccu_date,
      ccu_peak,
      ccu_source
    FROM daily_metrics
    WHERE ccu_peak IS NOT NULL
    ORDER BY appid, metric_date DESC
  ),

  -- Most recent reviews data (from Reviews sync or SteamSpy)
  latest_reviews AS (
    SELECT DISTINCT ON (appid)
      appid,
      total_reviews,
      positive_reviews,
      negative_reviews,
      review_score,
      review_score_desc
    FROM daily_metrics
    WHERE total_reviews IS NOT NULL
    ORDER BY appid, metric_date DESC
  ),

  -- Most recent owner/price/playtime data (from SteamSpy)
  latest_owners AS (
    SELECT DISTINCT ON (appid)
      appid,
      owners_min,
      owners_max,
      price_cents,
      discount_percent,
      average_playtime_forever,
      average_playtime_2weeks
    FROM daily_metrics
    WHERE owners_min IS NOT NULL
    ORDER BY appid, metric_date DESC
  ),

  -- Weekly CCU sum for estimated_weekly_hours calculation
  weekly_ccu AS (
    SELECT
      appid,
      SUM(ccu_peak) AS ccu_7d_sum
    FROM daily_metrics
    WHERE metric_date >= CURRENT_DATE - INTERVAL '7 days'
      AND ccu_peak IS NOT NULL
    GROUP BY appid
  ),

  -- Get all unique appids that have any metrics
  all_appids AS (
    SELECT DISTINCT appid FROM daily_metrics
  )

SELECT
  a.appid,
  c.ccu_date AS metric_date,
  o.owners_min,
  o.owners_max,
  COALESCE((COALESCE(o.owners_min, 0) + COALESCE(o.owners_max, 0)) / 2, 0) AS owners_midpoint,
  c.ccu_peak,
  c.ccu_source,
  r.total_reviews,
  r.positive_reviews,
  r.negative_reviews,
  r.review_score,
  r.review_score_desc,
  CASE
    WHEN r.total_reviews > 0
    THEN ROUND(r.positive_reviews::numeric * 100.0 / r.total_reviews::numeric, 1)
    ELSE NULL
  END AS positive_percentage,
  o.price_cents,
  o.discount_percent,
  o.average_playtime_forever,
  o.average_playtime_2weeks,
  -- ESTIMATED Weekly Played Hours per game
  -- Formula: SUM(7-day CCU) x (avg_playtime_2weeks / 2 / 60)
  COALESCE(
    ROUND((w.ccu_7d_sum * COALESCE(o.average_playtime_2weeks, 0))::numeric / 2.0 / 60.0),
    0
  )::BIGINT AS estimated_weekly_hours
FROM all_appids a
LEFT JOIN latest_ccu c ON a.appid = c.appid
LEFT JOIN latest_reviews r ON a.appid = r.appid
LEFT JOIN latest_owners o ON a.appid = o.appid
LEFT JOIN weekly_ccu w ON a.appid = w.appid;

-- Create indexes for fast lookups
CREATE UNIQUE INDEX idx_latest_daily_metrics_appid ON latest_daily_metrics (appid);
CREATE INDEX idx_latest_daily_metrics_ccu ON latest_daily_metrics (ccu_peak DESC NULLS LAST);
CREATE INDEX idx_latest_daily_metrics_reviews ON latest_daily_metrics (total_reviews DESC NULLS LAST);
CREATE INDEX idx_latest_daily_metrics_weekly_hours ON latest_daily_metrics (estimated_weekly_hours DESC NULLS LAST);

-- Recreate function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_latest_daily_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY latest_daily_metrics;
END;
$$;

-- Grant permissions
GRANT SELECT ON latest_daily_metrics TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION refresh_latest_daily_metrics() TO service_role;

COMMENT ON MATERIALIZED VIEW latest_daily_metrics IS
  'Pre-computed latest metrics per app. Coalesces across rows to get most recent non-NULL value for each column group (CCU, reviews, owners/price). Refresh with refresh_latest_daily_metrics()';

-- =============================================================================
-- Recreate mv_apps_aggregate_stats (depends on latest_daily_metrics)
-- =============================================================================
-- Improved: Now uses average_playtime_forever directly from latest_daily_metrics
-- instead of a LATERAL subquery, since the new view includes playtime data.

CREATE MATERIALIZED VIEW mv_apps_aggregate_stats AS
WITH base_data AS (
  SELECT
    a.type::TEXT AS app_type,
    COALESCE(ldm.ccu_peak, 0) AS ccu_peak,
    ldm.review_score,
    ct.ccu_growth_7d_percent,
    COALESCE(rvs.velocity_7d, 0) - COALESCE(rvs.velocity_30d, 0) AS velocity_acceleration,
    atr.current_positive_ratio,
    atr.previous_positive_ratio,
    a.is_free,
    ldm.price_cents,
    ldm.average_playtime_forever  -- Now available directly from latest_daily_metrics
  FROM apps a
  LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
  LEFT JOIN ccu_tier_assignments ct ON ct.appid = a.appid
  LEFT JOIN review_velocity_stats rvs ON rvs.appid = a.appid
  LEFT JOIN app_trends atr ON atr.appid = a.appid
  WHERE a.is_released = TRUE AND a.is_delisted = FALSE
),
computed AS (
  SELECT
    bd.*,
    CASE
      WHEN bd.ccu_growth_7d_percent IS NOT NULL
      THEN (bd.ccu_growth_7d_percent + COALESCE(bd.velocity_acceleration, 0)) / 2
      ELSE NULL
    END AS momentum_score,
    CASE
      WHEN bd.current_positive_ratio IS NOT NULL AND bd.previous_positive_ratio IS NOT NULL
      THEN (bd.current_positive_ratio - bd.previous_positive_ratio) * 100
      ELSE NULL
    END AS sentiment_delta,
    CASE
      WHEN bd.is_free OR bd.price_cents IS NULL OR bd.price_cents = 0 THEN NULL
      WHEN bd.average_playtime_forever IS NULL OR bd.average_playtime_forever = 0 THEN NULL
      ELSE (bd.average_playtime_forever::DECIMAL / 60) / (bd.price_cents::DECIMAL / 100)
    END AS value_score
  FROM base_data bd
)
SELECT
  c.app_type,
  COUNT(*)::BIGINT AS total_games,
  ROUND(AVG(c.ccu_peak), 0)::DECIMAL AS avg_ccu,
  ROUND(AVG(c.review_score), 1)::DECIMAL AS avg_score,
  ROUND(AVG(c.momentum_score), 2)::DECIMAL AS avg_momentum,
  COUNT(*) FILTER (WHERE c.ccu_growth_7d_percent >= 10)::INT AS trending_up_count,
  COUNT(*) FILTER (WHERE c.ccu_growth_7d_percent <= -10)::INT AS trending_down_count,
  COUNT(*) FILTER (WHERE c.sentiment_delta >= 3)::INT AS sentiment_improving_count,
  COUNT(*) FILTER (WHERE c.sentiment_delta <= -3)::INT AS sentiment_declining_count,
  ROUND(AVG(c.value_score), 2)::DECIMAL AS avg_value_score
FROM computed c
GROUP BY c.app_type;

CREATE UNIQUE INDEX idx_mv_apps_aggregate_stats_pk ON mv_apps_aggregate_stats (app_type);

GRANT SELECT ON mv_apps_aggregate_stats TO anon, authenticated, service_role;

COMMENT ON MATERIALIZED VIEW mv_apps_aggregate_stats IS
  'Pre-computed aggregate statistics by app type. Refresh with refresh_filter_count_views()';
