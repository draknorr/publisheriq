-- Migration: Add estimated_weekly_hours to latest_daily_metrics (game-level)
--
-- Formula: SUM(ccu_peak over 7 days) × (average_2weeks / 2 / 60)
--
-- IMPORTANT: This is an ESTIMATE, not actual data.
-- Steam does not expose real "total played hours" data.

-- Drop and recreate the view with the new column
DROP MATERIALIZED VIEW IF EXISTS latest_daily_metrics;

CREATE MATERIALIZED VIEW latest_daily_metrics AS
WITH latest_row AS (
  -- Get the most recent metrics row for each app
  SELECT DISTINCT ON (appid)
    appid,
    metric_date,
    owners_min,
    owners_max,
    ccu_peak,
    total_reviews,
    positive_reviews,
    review_score,
    price_cents,
    average_playtime_2weeks
  FROM daily_metrics
  ORDER BY appid, metric_date DESC
),
weekly_ccu AS (
  -- Calculate 7-day CCU sum for each app
  SELECT
    appid,
    SUM(ccu_peak) AS ccu_7d_sum
  FROM daily_metrics
  WHERE metric_date >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY appid
)
SELECT
  lr.appid,
  lr.metric_date,
  lr.owners_min,
  lr.owners_max,
  (lr.owners_min + lr.owners_max) / 2 AS owners_midpoint,
  lr.ccu_peak,
  lr.total_reviews,
  lr.positive_reviews,
  lr.review_score,
  CASE WHEN lr.total_reviews > 0
    THEN ROUND(lr.positive_reviews * 100.0 / lr.total_reviews, 1)
    ELSE NULL
  END AS positive_percentage,
  lr.price_cents,
  -- ESTIMATED Weekly Played Hours per game
  -- Formula: SUM(7-day CCU) × (avg_playtime_2weeks / 2 / 60)
  -- This is an ESTIMATE - Steam does not provide actual total played hours
  COALESCE(
    ROUND(wc.ccu_7d_sum * COALESCE(lr.average_playtime_2weeks, 0) / 2.0 / 60.0),
    0
  )::BIGINT AS estimated_weekly_hours
FROM latest_row lr
LEFT JOIN weekly_ccu wc ON wc.appid = lr.appid;

-- Create indexes for fast lookups
CREATE UNIQUE INDEX idx_latest_daily_metrics_appid ON latest_daily_metrics (appid);
CREATE INDEX idx_latest_daily_metrics_weekly_hours ON latest_daily_metrics (estimated_weekly_hours DESC);

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
  'Pre-computed latest metrics per app including estimated_weekly_hours (ESTIMATE based on CCU × avg playtime). Refresh with refresh_latest_daily_metrics()';
