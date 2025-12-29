-- Migration: Create materialized view for aggregated publisher metrics
-- Purpose: Pre-compute publisher portfolio metrics for fast list page queries
-- Includes: Total owners, Peak CCU, Review score, Revenue estimate, Trending status, Unique developers

-- =============================================
-- MATERIALIZED VIEW: Publisher Metrics
-- =============================================

CREATE MATERIALIZED VIEW publisher_metrics AS
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
publisher_apps AS (
  -- Join publishers to their apps with metrics and trends
  SELECT
    ap.publisher_id,
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
  FROM app_publishers ap
  JOIN apps a ON a.appid = ap.appid
  LEFT JOIN latest_metrics lm ON lm.appid = a.appid
  LEFT JOIN app_trends at ON at.appid = a.appid
  WHERE a.type = 'game' AND a.is_delisted = FALSE
),
publisher_developers AS (
  -- Count unique developers per publisher
  SELECT
    ap.publisher_id,
    COUNT(DISTINCT ad.developer_id)::INTEGER AS unique_developers
  FROM app_publishers ap
  JOIN app_developers ad ON ad.appid = ap.appid
  GROUP BY ap.publisher_id
)
SELECT
  pa.publisher_id,

  -- Owner metrics (sum across all games)
  COALESCE(SUM(pa.owners_min), 0)::BIGINT AS total_owners_min,
  COALESCE(SUM(pa.owners_max), 0)::BIGINT AS total_owners_max,

  -- CCU metrics
  COALESCE(SUM(pa.ccu_peak), 0)::BIGINT AS total_ccu_peak,
  COALESCE(MAX(pa.ccu_peak), 0)::INTEGER AS max_ccu_peak,

  -- Review metrics (weighted by review count)
  COALESCE(SUM(pa.total_reviews), 0)::BIGINT AS total_reviews,
  COALESCE(SUM(pa.positive_reviews), 0)::BIGINT AS total_positive_reviews,
  COALESCE(SUM(pa.negative_reviews), 0)::BIGINT AS total_negative_reviews,
  CASE
    WHEN SUM(pa.total_reviews) > 0
    THEN ROUND((SUM(pa.positive_reviews)::DECIMAL / SUM(pa.total_reviews)) * 100)::SMALLINT
    ELSE NULL
  END AS weighted_review_score,

  -- Revenue estimate: (avg_owners * price) summed across games
  COALESCE(SUM(
    ((COALESCE(pa.owners_min, 0) + COALESCE(pa.owners_max, 0)) / 2.0) *
    COALESCE(pa.current_price_cents, 0) / 100.0
  ), 0)::BIGINT AS estimated_revenue_usd,

  -- Trend counts
  COUNT(*) FILTER (WHERE pa.trend_30d_direction = 'up')::INTEGER AS games_trending_up,
  COUNT(*) FILTER (WHERE pa.trend_30d_direction = 'down')::INTEGER AS games_trending_down,
  COUNT(*) FILTER (WHERE pa.trend_30d_direction = 'stable')::INTEGER AS games_trending_stable,

  -- Activity status: games released in last year
  COUNT(*) FILTER (WHERE pa.release_date >= CURRENT_DATE - INTERVAL '1 year')::INTEGER AS games_released_last_year,

  -- Publisher-specific: unique developers count
  COALESCE(pd.unique_developers, 0)::INTEGER AS unique_developers,

  -- Metadata
  NOW() AS computed_at

FROM publisher_apps pa
LEFT JOIN publisher_developers pd ON pd.publisher_id = pa.publisher_id
GROUP BY pa.publisher_id, pd.unique_developers;

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Primary key index for REFRESH CONCURRENTLY support
CREATE UNIQUE INDEX idx_publisher_metrics_pk ON publisher_metrics(publisher_id);

-- Indexes for sorting by metrics
CREATE INDEX idx_publisher_metrics_owners ON publisher_metrics(total_owners_max DESC);
CREATE INDEX idx_publisher_metrics_ccu ON publisher_metrics(total_ccu_peak DESC);
CREATE INDEX idx_publisher_metrics_score ON publisher_metrics(weighted_review_score DESC NULLS LAST);
CREATE INDEX idx_publisher_metrics_revenue ON publisher_metrics(estimated_revenue_usd DESC);
CREATE INDEX idx_publisher_metrics_trending ON publisher_metrics(games_trending_up DESC);
CREATE INDEX idx_publisher_metrics_developers ON publisher_metrics(unique_developers DESC);

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON MATERIALIZED VIEW publisher_metrics IS
  'Pre-computed aggregate metrics for publishers. Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY publisher_metrics';

COMMENT ON COLUMN publisher_metrics.unique_developers IS 'Number of distinct developers who have published games with this publisher';
