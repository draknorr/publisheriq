-- Migration: Add estimated_weekly_hours to publisher and developer metrics
--
-- Formula: SUM(ccu_peak over 7 days) × (average_2weeks / 2 / 60)
--
-- IMPORTANT: This is an ESTIMATE, not actual data.
-- Steam does not expose real "total played hours" data.
-- The metric should always be labeled as "estimated" in UI and responses.

-- =============================================
-- UPDATE: Publisher Metrics View
-- =============================================

DROP MATERIALIZED VIEW IF EXISTS publisher_metrics;

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
    dm.review_score,
    dm.average_playtime_2weeks
  FROM daily_metrics dm
  ORDER BY dm.appid, dm.metric_date DESC
),
weekly_ccu AS (
  -- Calculate 7-day CCU sum for each app (for estimated played hours)
  SELECT
    appid,
    SUM(ccu_peak) AS ccu_7d_sum
  FROM daily_metrics
  WHERE metric_date >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY appid
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
    lm.average_playtime_2weeks,
    wc.ccu_7d_sum,
    at.trend_30d_direction
  FROM app_publishers ap
  JOIN apps a ON a.appid = ap.appid
  LEFT JOIN latest_metrics lm ON lm.appid = a.appid
  LEFT JOIN weekly_ccu wc ON wc.appid = a.appid
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
  p.name AS publisher_name,
  p.game_count,

  -- Owner metrics (consolidated midpoint for Cube)
  COALESCE((SUM(pa.owners_min) + SUM(pa.owners_max)) / 2, 0)::BIGINT AS total_owners,

  -- CCU metrics
  COALESCE(SUM(pa.ccu_peak), 0)::BIGINT AS total_ccu,

  -- ESTIMATED Weekly Played Hours
  -- Formula: SUM(7-day CCU) × (avg_playtime_2weeks / 2 / 60)
  -- This is an ESTIMATE - Steam does not provide actual total played hours
  COALESCE(SUM(
    COALESCE(pa.ccu_7d_sum, 0) * COALESCE(pa.average_playtime_2weeks, 0) / 2.0 / 60.0
  ), 0)::BIGINT AS estimated_weekly_hours,

  -- Review metrics
  COALESCE(SUM(pa.total_reviews), 0)::BIGINT AS total_reviews,
  COALESCE(SUM(pa.positive_reviews), 0)::BIGINT AS positive_reviews,
  CASE
    WHEN SUM(pa.total_reviews) > 0
    THEN ROUND((SUM(pa.positive_reviews)::DECIMAL / SUM(pa.total_reviews)) * 100)::SMALLINT
    ELSE NULL
  END AS avg_review_score,

  -- Revenue estimate in cents
  COALESCE(SUM(
    ((COALESCE(pa.owners_min, 0) + COALESCE(pa.owners_max, 0)) / 2.0) *
    COALESCE(pa.current_price_cents, 0)
  ), 0)::BIGINT AS revenue_estimate_cents,

  -- Trending as boolean
  (COUNT(*) FILTER (WHERE pa.trend_30d_direction = 'up') > 0) AS is_trending,

  -- Keep detailed counts
  COUNT(*) FILTER (WHERE pa.trend_30d_direction = 'up')::INTEGER AS games_trending_up,
  COUNT(*) FILTER (WHERE pa.trend_30d_direction = 'down')::INTEGER AS games_trending_down,
  COUNT(*) FILTER (WHERE pa.trend_30d_direction = 'stable')::INTEGER AS games_trending_stable,
  COUNT(*) FILTER (WHERE pa.release_date >= CURRENT_DATE - INTERVAL '1 year')::INTEGER AS games_released_last_year,

  -- Publisher-specific
  COALESCE(pd.unique_developers, 0)::INTEGER AS unique_developers,

  -- Metadata
  NOW() AS computed_at

FROM publisher_apps pa
JOIN publishers p ON p.id = pa.publisher_id
LEFT JOIN publisher_developers pd ON pd.publisher_id = pa.publisher_id
GROUP BY pa.publisher_id, p.name, p.game_count, pd.unique_developers;

-- Indexes for performance
CREATE UNIQUE INDEX idx_publisher_metrics_pk ON publisher_metrics(publisher_id);
CREATE INDEX idx_publisher_metrics_owners ON publisher_metrics(total_owners DESC);
CREATE INDEX idx_publisher_metrics_ccu ON publisher_metrics(total_ccu DESC);
CREATE INDEX idx_publisher_metrics_weekly_hours ON publisher_metrics(estimated_weekly_hours DESC);
CREATE INDEX idx_publisher_metrics_score ON publisher_metrics(avg_review_score DESC NULLS LAST);
CREATE INDEX idx_publisher_metrics_revenue ON publisher_metrics(revenue_estimate_cents DESC);
CREATE INDEX idx_publisher_metrics_trending ON publisher_metrics(games_trending_up DESC);
CREATE INDEX idx_publisher_metrics_developers ON publisher_metrics(unique_developers DESC);
CREATE INDEX idx_publisher_metrics_name ON publisher_metrics(publisher_name);

COMMENT ON MATERIALIZED VIEW publisher_metrics IS
  'Pre-computed aggregate metrics for publishers. estimated_weekly_hours is an ESTIMATE based on CCU × avg playtime - Steam does not provide actual total played hours. Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY publisher_metrics';


-- =============================================
-- UPDATE: Developer Metrics View
-- =============================================

DROP MATERIALIZED VIEW IF EXISTS developer_metrics;

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
    dm.review_score,
    dm.average_playtime_2weeks
  FROM daily_metrics dm
  ORDER BY dm.appid, dm.metric_date DESC
),
weekly_ccu AS (
  -- Calculate 7-day CCU sum for each app (for estimated played hours)
  SELECT
    appid,
    SUM(ccu_peak) AS ccu_7d_sum
  FROM daily_metrics
  WHERE metric_date >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY appid
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
    lm.average_playtime_2weeks,
    wc.ccu_7d_sum,
    at.trend_30d_direction
  FROM app_developers ad
  JOIN apps a ON a.appid = ad.appid
  LEFT JOIN latest_metrics lm ON lm.appid = a.appid
  LEFT JOIN weekly_ccu wc ON wc.appid = a.appid
  LEFT JOIN app_trends at ON at.appid = a.appid
  WHERE a.type = 'game' AND a.is_delisted = FALSE
)
SELECT
  da.developer_id,
  d.name AS developer_name,
  d.game_count,

  -- Owner metrics (consolidated midpoint for Cube)
  COALESCE((SUM(da.owners_min) + SUM(da.owners_max)) / 2, 0)::BIGINT AS total_owners,

  -- CCU metrics
  COALESCE(SUM(da.ccu_peak), 0)::BIGINT AS total_ccu,

  -- ESTIMATED Weekly Played Hours
  -- Formula: SUM(7-day CCU) × (avg_playtime_2weeks / 2 / 60)
  -- This is an ESTIMATE - Steam does not provide actual total played hours
  COALESCE(SUM(
    COALESCE(da.ccu_7d_sum, 0) * COALESCE(da.average_playtime_2weeks, 0) / 2.0 / 60.0
  ), 0)::BIGINT AS estimated_weekly_hours,

  -- Review metrics
  COALESCE(SUM(da.total_reviews), 0)::BIGINT AS total_reviews,
  COALESCE(SUM(da.positive_reviews), 0)::BIGINT AS positive_reviews,
  CASE
    WHEN SUM(da.total_reviews) > 0
    THEN ROUND((SUM(da.positive_reviews)::DECIMAL / SUM(da.total_reviews)) * 100)::SMALLINT
    ELSE NULL
  END AS avg_review_score,

  -- Revenue estimate in cents
  COALESCE(SUM(
    ((COALESCE(da.owners_min, 0) + COALESCE(da.owners_max, 0)) / 2.0) *
    COALESCE(da.current_price_cents, 0)
  ), 0)::BIGINT AS revenue_estimate_cents,

  -- Trending as boolean
  (COUNT(*) FILTER (WHERE da.trend_30d_direction = 'up') > 0) AS is_trending,

  -- Keep detailed counts
  COUNT(*) FILTER (WHERE da.trend_30d_direction = 'up')::INTEGER AS games_trending_up,
  COUNT(*) FILTER (WHERE da.trend_30d_direction = 'down')::INTEGER AS games_trending_down,
  COUNT(*) FILTER (WHERE da.trend_30d_direction = 'stable')::INTEGER AS games_trending_stable,
  COUNT(*) FILTER (WHERE da.release_date >= CURRENT_DATE - INTERVAL '1 year')::INTEGER AS games_released_last_year,

  -- Metadata
  NOW() AS computed_at

FROM developer_apps da
JOIN developers d ON d.id = da.developer_id
GROUP BY da.developer_id, d.name, d.game_count;

-- Indexes for performance
CREATE UNIQUE INDEX idx_developer_metrics_pk ON developer_metrics(developer_id);
CREATE INDEX idx_developer_metrics_owners ON developer_metrics(total_owners DESC);
CREATE INDEX idx_developer_metrics_ccu ON developer_metrics(total_ccu DESC);
CREATE INDEX idx_developer_metrics_weekly_hours ON developer_metrics(estimated_weekly_hours DESC);
CREATE INDEX idx_developer_metrics_score ON developer_metrics(avg_review_score DESC NULLS LAST);
CREATE INDEX idx_developer_metrics_revenue ON developer_metrics(revenue_estimate_cents DESC);
CREATE INDEX idx_developer_metrics_trending ON developer_metrics(games_trending_up DESC);
CREATE INDEX idx_developer_metrics_name ON developer_metrics(developer_name);

COMMENT ON MATERIALIZED VIEW developer_metrics IS
  'Pre-computed aggregate metrics for developers. estimated_weekly_hours is an ESTIMATE based on CCU × avg playtime - Steam does not provide actual total played hours. Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY developer_metrics';
