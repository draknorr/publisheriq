-- Create materialized view for latest daily metrics per app
-- This replaces the slow LATERAL join in the Discovery cube

-- Drop if exists (for re-running)
DROP MATERIALIZED VIEW IF EXISTS latest_daily_metrics;

-- Create materialized view with latest metrics per app
CREATE MATERIALIZED VIEW latest_daily_metrics AS
SELECT DISTINCT ON (appid)
  appid,
  metric_date,
  owners_min,
  owners_max,
  (owners_min + owners_max) / 2 as owners_midpoint,
  ccu_peak,
  total_reviews,
  positive_reviews,
  review_score,
  CASE WHEN total_reviews > 0
    THEN ROUND(positive_reviews * 100.0 / total_reviews, 1)
    ELSE NULL
  END as positive_percentage,
  price_cents
FROM daily_metrics
ORDER BY appid, metric_date DESC;

-- Create index for fast lookups
CREATE UNIQUE INDEX idx_latest_daily_metrics_appid ON latest_daily_metrics (appid);

-- Create function to refresh the materialized view
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

-- Add comment
COMMENT ON MATERIALIZED VIEW latest_daily_metrics IS 'Pre-computed latest metrics per app for fast Discovery queries. Refresh with refresh_latest_daily_metrics()';
