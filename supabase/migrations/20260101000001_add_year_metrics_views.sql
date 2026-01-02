-- Migration: Create per-year materialized views for developer and publisher metrics
-- Purpose: Enable filtering developer/publisher stats by release year or date range
-- Example: "developers with games released in 2025" or "past 12 months"

-- =============================================
-- MATERIALIZED VIEW: Developer Year Metrics
-- =============================================

CREATE MATERIALIZED VIEW developer_year_metrics AS
WITH latest_metrics AS (
  -- Get the most recent metrics for each app
  SELECT DISTINCT ON (dm.appid)
    dm.appid,
    dm.owners_min,
    dm.owners_max,
    dm.ccu_peak,
    dm.total_reviews,
    dm.positive_reviews,
    dm.review_score
  FROM daily_metrics dm
  ORDER BY dm.appid, dm.metric_date DESC
),
developer_apps AS (
  -- Join developers to their apps with metrics, grouped by release year
  SELECT
    ad.developer_id,
    a.release_date,
    EXTRACT(YEAR FROM a.release_date)::INTEGER AS release_year,
    a.appid,
    a.current_price_cents,
    lm.owners_min,
    lm.owners_max,
    lm.ccu_peak,
    lm.total_reviews,
    lm.positive_reviews,
    lm.review_score
  FROM app_developers ad
  JOIN apps a ON a.appid = ad.appid
  LEFT JOIN latest_metrics lm ON lm.appid = a.appid
  WHERE a.type = 'game'
    AND a.is_delisted = FALSE
    AND a.release_date IS NOT NULL
)
SELECT
  da.developer_id,
  d.name AS developer_name,
  da.release_year,

  -- Date range for this year (enables rolling period filtering)
  MIN(da.release_date)::DATE AS earliest_release,
  MAX(da.release_date)::DATE AS latest_release,

  -- Game count for this year
  COUNT(DISTINCT da.appid)::INTEGER AS game_count,

  -- Owner metrics (midpoint estimate)
  COALESCE((SUM(da.owners_min) + SUM(da.owners_max)) / 2, 0)::BIGINT AS total_owners,

  -- CCU metrics
  COALESCE(SUM(da.ccu_peak), 0)::BIGINT AS total_ccu,

  -- Review metrics
  COALESCE(SUM(da.total_reviews), 0)::BIGINT AS total_reviews,
  CASE
    WHEN SUM(da.total_reviews) > 0
    THEN ROUND((SUM(da.positive_reviews)::DECIMAL / SUM(da.total_reviews)) * 100)::SMALLINT
    ELSE NULL
  END AS avg_review_score,

  -- Revenue estimate in cents
  COALESCE(SUM(
    ((COALESCE(da.owners_min, 0) + COALESCE(da.owners_max, 0)) / 2.0) *
    COALESCE(da.current_price_cents, 0)
  ), 0)::BIGINT AS revenue_estimate_cents

FROM developer_apps da
JOIN developers d ON d.id = da.developer_id
GROUP BY da.developer_id, d.name, da.release_year;

-- Indexes for developer_year_metrics
CREATE UNIQUE INDEX idx_developer_year_metrics_pk ON developer_year_metrics(developer_id, release_year);
CREATE INDEX idx_developer_year_metrics_year ON developer_year_metrics(release_year);
CREATE INDEX idx_developer_year_metrics_latest ON developer_year_metrics(latest_release DESC);
CREATE INDEX idx_developer_year_metrics_owners ON developer_year_metrics(total_owners DESC);
CREATE INDEX idx_developer_year_metrics_game_count ON developer_year_metrics(game_count DESC);
CREATE INDEX idx_developer_year_metrics_name ON developer_year_metrics(developer_name);

COMMENT ON MATERIALIZED VIEW developer_year_metrics IS
  'Pre-computed developer metrics grouped by release year. Enables year-filtered queries. Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY developer_year_metrics';


-- =============================================
-- MATERIALIZED VIEW: Publisher Year Metrics
-- =============================================

CREATE MATERIALIZED VIEW publisher_year_metrics AS
WITH latest_metrics AS (
  -- Get the most recent metrics for each app
  SELECT DISTINCT ON (dm.appid)
    dm.appid,
    dm.owners_min,
    dm.owners_max,
    dm.ccu_peak,
    dm.total_reviews,
    dm.positive_reviews,
    dm.review_score
  FROM daily_metrics dm
  ORDER BY dm.appid, dm.metric_date DESC
),
publisher_apps AS (
  -- Join publishers to their apps with metrics, grouped by release year
  SELECT
    ap.publisher_id,
    a.release_date,
    EXTRACT(YEAR FROM a.release_date)::INTEGER AS release_year,
    a.appid,
    a.current_price_cents,
    lm.owners_min,
    lm.owners_max,
    lm.ccu_peak,
    lm.total_reviews,
    lm.positive_reviews,
    lm.review_score
  FROM app_publishers ap
  JOIN apps a ON a.appid = ap.appid
  LEFT JOIN latest_metrics lm ON lm.appid = a.appid
  WHERE a.type = 'game'
    AND a.is_delisted = FALSE
    AND a.release_date IS NOT NULL
)
SELECT
  pa.publisher_id,
  p.name AS publisher_name,
  pa.release_year,

  -- Date range for this year (enables rolling period filtering)
  MIN(pa.release_date)::DATE AS earliest_release,
  MAX(pa.release_date)::DATE AS latest_release,

  -- Game count for this year
  COUNT(DISTINCT pa.appid)::INTEGER AS game_count,

  -- Owner metrics (midpoint estimate)
  COALESCE((SUM(pa.owners_min) + SUM(pa.owners_max)) / 2, 0)::BIGINT AS total_owners,

  -- CCU metrics
  COALESCE(SUM(pa.ccu_peak), 0)::BIGINT AS total_ccu,

  -- Review metrics
  COALESCE(SUM(pa.total_reviews), 0)::BIGINT AS total_reviews,
  CASE
    WHEN SUM(pa.total_reviews) > 0
    THEN ROUND((SUM(pa.positive_reviews)::DECIMAL / SUM(pa.total_reviews)) * 100)::SMALLINT
    ELSE NULL
  END AS avg_review_score,

  -- Revenue estimate in cents
  COALESCE(SUM(
    ((COALESCE(pa.owners_min, 0) + COALESCE(pa.owners_max, 0)) / 2.0) *
    COALESCE(pa.current_price_cents, 0)
  ), 0)::BIGINT AS revenue_estimate_cents

FROM publisher_apps pa
JOIN publishers p ON p.id = pa.publisher_id
GROUP BY pa.publisher_id, p.name, pa.release_year;

-- Indexes for publisher_year_metrics
CREATE UNIQUE INDEX idx_publisher_year_metrics_pk ON publisher_year_metrics(publisher_id, release_year);
CREATE INDEX idx_publisher_year_metrics_year ON publisher_year_metrics(release_year);
CREATE INDEX idx_publisher_year_metrics_latest ON publisher_year_metrics(latest_release DESC);
CREATE INDEX idx_publisher_year_metrics_owners ON publisher_year_metrics(total_owners DESC);
CREATE INDEX idx_publisher_year_metrics_game_count ON publisher_year_metrics(game_count DESC);
CREATE INDEX idx_publisher_year_metrics_name ON publisher_year_metrics(publisher_name);

COMMENT ON MATERIALIZED VIEW publisher_year_metrics IS
  'Pre-computed publisher metrics grouped by release year. Enables year-filtered queries. Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY publisher_year_metrics';


-- =============================================
-- MATERIALIZED VIEW: Developer Rolling Metrics (for dynamic date filtering)
-- Stores per-game data for each developer to enable arbitrary date range aggregations
-- =============================================

CREATE MATERIALIZED VIEW developer_game_metrics AS
WITH latest_metrics AS (
  SELECT DISTINCT ON (dm.appid)
    dm.appid,
    dm.owners_min,
    dm.owners_max,
    dm.ccu_peak,
    dm.total_reviews,
    dm.positive_reviews,
    dm.review_score
  FROM daily_metrics dm
  ORDER BY dm.appid, dm.metric_date DESC
)
SELECT
  ad.developer_id,
  d.name AS developer_name,
  a.appid,
  a.name AS game_name,
  a.release_date,
  EXTRACT(YEAR FROM a.release_date)::INTEGER AS release_year,
  a.current_price_cents,
  COALESCE((lm.owners_min + lm.owners_max) / 2, 0)::BIGINT AS owners,
  COALESCE(lm.ccu_peak, 0)::INTEGER AS ccu,
  COALESCE(lm.total_reviews, 0)::INTEGER AS total_reviews,
  COALESCE(lm.positive_reviews, 0)::INTEGER AS positive_reviews,
  lm.review_score,
  COALESCE(
    ((COALESCE(lm.owners_min, 0) + COALESCE(lm.owners_max, 0)) / 2.0) *
    COALESCE(a.current_price_cents, 0),
    0
  )::BIGINT AS revenue_estimate_cents
FROM app_developers ad
JOIN apps a ON a.appid = ad.appid
JOIN developers d ON d.id = ad.developer_id
LEFT JOIN latest_metrics lm ON lm.appid = a.appid
WHERE a.type = 'game'
  AND a.is_delisted = FALSE
  AND a.release_date IS NOT NULL;

CREATE INDEX idx_developer_game_metrics_dev ON developer_game_metrics(developer_id);
CREATE INDEX idx_developer_game_metrics_release ON developer_game_metrics(release_date DESC);
CREATE INDEX idx_developer_game_metrics_year ON developer_game_metrics(release_year);
CREATE INDEX idx_developer_game_metrics_appid ON developer_game_metrics(appid);

COMMENT ON MATERIALIZED VIEW developer_game_metrics IS
  'Per-game metrics for each developer. Enables rolling period aggregations like "past 12 months".';


-- =============================================
-- MATERIALIZED VIEW: Publisher Rolling Metrics
-- =============================================

CREATE MATERIALIZED VIEW publisher_game_metrics AS
WITH latest_metrics AS (
  SELECT DISTINCT ON (dm.appid)
    dm.appid,
    dm.owners_min,
    dm.owners_max,
    dm.ccu_peak,
    dm.total_reviews,
    dm.positive_reviews,
    dm.review_score
  FROM daily_metrics dm
  ORDER BY dm.appid, dm.metric_date DESC
)
SELECT
  ap.publisher_id,
  p.name AS publisher_name,
  a.appid,
  a.name AS game_name,
  a.release_date,
  EXTRACT(YEAR FROM a.release_date)::INTEGER AS release_year,
  a.current_price_cents,
  COALESCE((lm.owners_min + lm.owners_max) / 2, 0)::BIGINT AS owners,
  COALESCE(lm.ccu_peak, 0)::INTEGER AS ccu,
  COALESCE(lm.total_reviews, 0)::INTEGER AS total_reviews,
  COALESCE(lm.positive_reviews, 0)::INTEGER AS positive_reviews,
  lm.review_score,
  COALESCE(
    ((COALESCE(lm.owners_min, 0) + COALESCE(lm.owners_max, 0)) / 2.0) *
    COALESCE(a.current_price_cents, 0),
    0
  )::BIGINT AS revenue_estimate_cents
FROM app_publishers ap
JOIN apps a ON a.appid = ap.appid
JOIN publishers p ON p.id = ap.publisher_id
LEFT JOIN latest_metrics lm ON lm.appid = a.appid
WHERE a.type = 'game'
  AND a.is_delisted = FALSE
  AND a.release_date IS NOT NULL;

CREATE INDEX idx_publisher_game_metrics_pub ON publisher_game_metrics(publisher_id);
CREATE INDEX idx_publisher_game_metrics_release ON publisher_game_metrics(release_date DESC);
CREATE INDEX idx_publisher_game_metrics_year ON publisher_game_metrics(release_year);
CREATE INDEX idx_publisher_game_metrics_appid ON publisher_game_metrics(appid);

COMMENT ON MATERIALIZED VIEW publisher_game_metrics IS
  'Per-game metrics for each publisher. Enables rolling period aggregations like "past 12 months".';


-- =============================================
-- UPDATE REFRESH FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION refresh_all_metrics_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY developer_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY publisher_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY developer_year_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY publisher_year_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY developer_game_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY publisher_game_metrics;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_all_metrics_views() IS
  'Refreshes all metrics materialized views. Call periodically to update aggregated stats.';
