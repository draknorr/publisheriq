-- Migration: Add monthly_game_metrics materialized view
--
-- Provides estimated played hours per game per month
-- Formula: SUM(ccu_peak for month) × (avg_playtime_2weeks / 2 / 60)
--
-- IMPORTANT: This is an ESTIMATE, not actual data.
-- Steam does not expose real "total played hours" data.

CREATE MATERIALIZED VIEW monthly_game_metrics AS
WITH monthly_data AS (
  SELECT
    appid,
    DATE_TRUNC('month', metric_date)::DATE AS month,
    SUM(ccu_peak) AS monthly_ccu_sum,
    -- Use the average of avg_playtime_2weeks for the month
    AVG(average_playtime_2weeks) AS avg_playtime_2weeks
  FROM daily_metrics
  WHERE metric_date >= '2024-01-01'  -- Limit historical data
  GROUP BY appid, DATE_TRUNC('month', metric_date)
)
SELECT
  md.appid,
  md.month,
  EXTRACT(YEAR FROM md.month)::INTEGER AS year,
  EXTRACT(MONTH FROM md.month)::INTEGER AS month_num,
  md.monthly_ccu_sum,
  -- ESTIMATED Monthly Played Hours per game
  -- Formula: SUM(monthly CCU) × (avg_playtime_2weeks / 2 / 60)
  -- This is an ESTIMATE - Steam does not provide actual total played hours
  COALESCE(
    ROUND(md.monthly_ccu_sum * COALESCE(md.avg_playtime_2weeks, 0) / 2.0 / 60.0),
    0
  )::BIGINT AS estimated_monthly_hours,
  a.name AS game_name
FROM monthly_data md
JOIN apps a ON a.appid = md.appid
WHERE a.type = 'game' AND a.is_delisted = false;

-- Create indexes for fast queries
CREATE UNIQUE INDEX idx_monthly_game_metrics_pk ON monthly_game_metrics (appid, month);
CREATE INDEX idx_monthly_game_metrics_month ON monthly_game_metrics (month DESC);
CREATE INDEX idx_monthly_game_metrics_hours ON monthly_game_metrics (estimated_monthly_hours DESC);
CREATE INDEX idx_monthly_game_metrics_year_month ON monthly_game_metrics (year, month_num);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_monthly_game_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_game_metrics;
END;
$$;

-- Grant permissions
GRANT SELECT ON monthly_game_metrics TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION refresh_monthly_game_metrics() TO service_role;

COMMENT ON MATERIALIZED VIEW monthly_game_metrics IS
  'Pre-computed monthly metrics per game including estimated_monthly_hours (ESTIMATE based on monthly CCU × avg playtime). Refresh with refresh_monthly_game_metrics()';
