-- Migration: Create materialized view for aggregated developer metrics
-- Purpose: Pre-compute developer portfolio metrics for fast list page queries
-- Includes: Total owners, Peak CCU, Review score, Revenue estimate, Trending status

-- =============================================
-- MATERIALIZED VIEW: Developer Metrics
-- =============================================

CREATE MATERIALIZED VIEW developer_metrics AS
WITH latest_metrics AS (
  -- Get the most recent metrics for each app
  SELECT DISTINCT ON (dm.appid)
    dm.appid,
    dm.owners_min,
    dm.owners_max,
    dm.ccu_peak,
    dm.total_reviews,
    dm.positive_reviews,
    dm.negative_reviews,
    dm.review_score
  FROM daily_metrics dm
  ORDER BY dm.appid, dm.metric_date DESC
),
developer_apps AS (
  -- Join developers to their apps with metrics and trends
  SELECT
    ad.developer_id,
    a.appid,
    a.release_date,
    a.current_price_cents,
    lm.owners_min,
    lm.owners_max,
    lm.ccu_peak,
    lm.total_reviews,
    lm.positive_reviews,
    lm.negative_reviews,
    lm.review_score,
    at.trend_30d_direction
  FROM app_developers ad
  JOIN apps a ON a.appid = ad.appid
  LEFT JOIN latest_metrics lm ON lm.appid = a.appid
  LEFT JOIN app_trends at ON at.appid = a.appid
  WHERE a.type = 'game' AND a.is_delisted = FALSE
)
SELECT
  developer_id,

  -- Owner metrics (sum across all games)
  COALESCE(SUM(owners_min), 0)::BIGINT AS total_owners_min,
  COALESCE(SUM(owners_max), 0)::BIGINT AS total_owners_max,

  -- CCU metrics
  COALESCE(SUM(ccu_peak), 0)::BIGINT AS total_ccu_peak,
  COALESCE(MAX(ccu_peak), 0)::INTEGER AS max_ccu_peak,

  -- Review metrics (weighted by review count)
  COALESCE(SUM(total_reviews), 0)::BIGINT AS total_reviews,
  COALESCE(SUM(positive_reviews), 0)::BIGINT AS total_positive_reviews,
  COALESCE(SUM(negative_reviews), 0)::BIGINT AS total_negative_reviews,
  CASE
    WHEN SUM(total_reviews) > 0
    THEN ROUND((SUM(positive_reviews)::DECIMAL / SUM(total_reviews)) * 100)::SMALLINT
    ELSE NULL
  END AS weighted_review_score,

  -- Revenue estimate: (avg_owners * price) summed across games
  COALESCE(SUM(
    ((COALESCE(owners_min, 0) + COALESCE(owners_max, 0)) / 2.0) *
    COALESCE(current_price_cents, 0) / 100.0
  ), 0)::BIGINT AS estimated_revenue_usd,

  -- Trend counts
  COUNT(*) FILTER (WHERE trend_30d_direction = 'up')::INTEGER AS games_trending_up,
  COUNT(*) FILTER (WHERE trend_30d_direction = 'down')::INTEGER AS games_trending_down,
  COUNT(*) FILTER (WHERE trend_30d_direction = 'stable')::INTEGER AS games_trending_stable,

  -- Activity status: games released in last year
  COUNT(*) FILTER (WHERE release_date >= CURRENT_DATE - INTERVAL '1 year')::INTEGER AS games_released_last_year,

  -- Metadata
  NOW() AS computed_at

FROM developer_apps
GROUP BY developer_id;

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Primary key index for REFRESH CONCURRENTLY support
CREATE UNIQUE INDEX idx_developer_metrics_pk ON developer_metrics(developer_id);

-- Indexes for sorting by metrics
CREATE INDEX idx_developer_metrics_owners ON developer_metrics(total_owners_max DESC);
CREATE INDEX idx_developer_metrics_ccu ON developer_metrics(total_ccu_peak DESC);
CREATE INDEX idx_developer_metrics_score ON developer_metrics(weighted_review_score DESC NULLS LAST);
CREATE INDEX idx_developer_metrics_revenue ON developer_metrics(estimated_revenue_usd DESC);
CREATE INDEX idx_developer_metrics_trending ON developer_metrics(games_trending_up DESC);

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON MATERIALIZED VIEW developer_metrics IS
  'Pre-computed aggregate metrics for developers. Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY developer_metrics';

COMMENT ON COLUMN developer_metrics.total_owners_min IS 'Sum of minimum owner estimates across all games';
COMMENT ON COLUMN developer_metrics.total_owners_max IS 'Sum of maximum owner estimates across all games';
COMMENT ON COLUMN developer_metrics.total_ccu_peak IS 'Sum of peak CCU across all games';
COMMENT ON COLUMN developer_metrics.max_ccu_peak IS 'Highest peak CCU of any single game';
COMMENT ON COLUMN developer_metrics.weighted_review_score IS 'Review positivity percentage weighted by review count (0-100)';
COMMENT ON COLUMN developer_metrics.estimated_revenue_usd IS 'Rough revenue estimate: avg_owners * current_price summed';
COMMENT ON COLUMN developer_metrics.games_trending_up IS 'Number of games with positive 30-day review trend';
COMMENT ON COLUMN developer_metrics.games_released_last_year IS 'Number of games released in the past 12 months';
