-- Migration: Fix review_score in game metrics views
-- Use PICS review data as fallback when daily_metrics.review_score is NULL

-- =============================================
-- Recreate developer_game_metrics with PICS fallback
-- =============================================

DROP MATERIALIZED VIEW IF EXISTS developer_game_metrics CASCADE;

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
  -- Use PICS review score as fallback when daily_metrics doesn't have it
  COALESCE(lm.review_score, a.pics_review_score) AS review_score,
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

-- Recreate indexes
CREATE INDEX idx_developer_game_metrics_dev ON developer_game_metrics(developer_id);
CREATE INDEX idx_developer_game_metrics_release ON developer_game_metrics(release_date DESC);
CREATE INDEX idx_developer_game_metrics_year ON developer_game_metrics(release_year);
CREATE UNIQUE INDEX idx_developer_game_metrics_unique ON developer_game_metrics(developer_id, appid);

COMMENT ON MATERIALIZED VIEW developer_game_metrics IS
  'Per-game metrics for each developer. Uses PICS review_score as fallback.';


-- =============================================
-- Recreate publisher_game_metrics with PICS fallback
-- =============================================

DROP MATERIALIZED VIEW IF EXISTS publisher_game_metrics CASCADE;

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
  -- Use PICS review score as fallback when daily_metrics doesn't have it
  COALESCE(lm.review_score, a.pics_review_score) AS review_score,
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

-- Recreate indexes
CREATE INDEX idx_publisher_game_metrics_pub ON publisher_game_metrics(publisher_id);
CREATE INDEX idx_publisher_game_metrics_release ON publisher_game_metrics(release_date DESC);
CREATE INDEX idx_publisher_game_metrics_year ON publisher_game_metrics(release_year);
CREATE UNIQUE INDEX idx_publisher_game_metrics_unique ON publisher_game_metrics(publisher_id, appid);

COMMENT ON MATERIALIZED VIEW publisher_game_metrics IS
  'Per-game metrics for each publisher. Uses PICS review_score as fallback.';
