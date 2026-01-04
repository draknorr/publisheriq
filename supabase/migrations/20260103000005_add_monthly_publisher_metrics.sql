-- Migration: Add monthly_publisher_metrics materialized view
--
-- Aggregates monthly game metrics by publisher
-- Formula: SUM(game estimated_monthly_hours) per publisher per month
--
-- IMPORTANT: This is an ESTIMATE, not actual data.
-- Steam does not expose real "total played hours" data.

CREATE MATERIALIZED VIEW monthly_publisher_metrics AS
WITH monthly_game_data AS (
  -- Get monthly metrics per game
  SELECT
    appid,
    DATE_TRUNC('month', metric_date)::DATE AS month,
    SUM(ccu_peak) AS monthly_ccu_sum,
    AVG(average_playtime_2weeks) AS avg_playtime_2weeks
  FROM daily_metrics
  WHERE metric_date >= '2024-01-01'
  GROUP BY appid, DATE_TRUNC('month', metric_date)
),
game_hours AS (
  -- Calculate estimated hours per game per month
  SELECT
    mgd.appid,
    mgd.month,
    COALESCE(
      ROUND(mgd.monthly_ccu_sum * COALESCE(mgd.avg_playtime_2weeks, 0) / 2.0 / 60.0),
      0
    )::BIGINT AS estimated_monthly_hours
  FROM monthly_game_data mgd
)
SELECT
  p.id AS publisher_id,
  p.name AS publisher_name,
  gh.month,
  EXTRACT(YEAR FROM gh.month)::INTEGER AS year,
  EXTRACT(MONTH FROM gh.month)::INTEGER AS month_num,
  COUNT(DISTINCT ap.appid) AS game_count,
  SUM(gh.estimated_monthly_hours) AS estimated_monthly_hours
FROM publishers p
JOIN app_publishers ap ON ap.publisher_id = p.id
JOIN apps a ON a.appid = ap.appid AND a.type = 'game' AND a.is_delisted = false
JOIN game_hours gh ON gh.appid = ap.appid
GROUP BY p.id, p.name, gh.month;

-- Create indexes for fast queries
CREATE UNIQUE INDEX idx_monthly_publisher_metrics_pk ON monthly_publisher_metrics (publisher_id, month);
CREATE INDEX idx_monthly_publisher_metrics_month ON monthly_publisher_metrics (month DESC);
CREATE INDEX idx_monthly_publisher_metrics_hours ON monthly_publisher_metrics (estimated_monthly_hours DESC);
CREATE INDEX idx_monthly_publisher_metrics_year_month ON monthly_publisher_metrics (year, month_num);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_monthly_publisher_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_publisher_metrics;
END;
$$;

-- Grant permissions
GRANT SELECT ON monthly_publisher_metrics TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION refresh_monthly_publisher_metrics() TO service_role;

COMMENT ON MATERIALIZED VIEW monthly_publisher_metrics IS
  'Pre-computed monthly metrics per publisher including estimated_monthly_hours (ESTIMATE based on sum of game monthly hours). Refresh with refresh_monthly_publisher_metrics()';
