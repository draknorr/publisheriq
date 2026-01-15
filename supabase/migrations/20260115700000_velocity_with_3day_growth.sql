-- Migration: Add velocity columns with 3-day growth windows
-- Date: 2026-01-15
--
-- COMBINES:
--   1. 3-day growth windows (works with limited CCU data, ~6 days)
--   2. Review velocity columns from review_velocity_stats
--
-- REASON: CCU data currently has ~6 days of history, so 7-day growth windows
--         returned NULL (no data in the prior 7-day window). 3-day windows work.

-- ============================================================================
-- STEP 1: Recreate publisher_metrics with 3-day growth windows + velocity
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS publisher_metrics CASCADE;

CREATE MATERIALIZED VIEW publisher_metrics AS
WITH latest_metrics AS (
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
  SELECT
    appid,
    SUM(ccu_peak) AS ccu_7d_sum
  FROM daily_metrics
  WHERE metric_date >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY appid
),
publisher_apps AS (
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
  SELECT
    ap.publisher_id,
    COUNT(DISTINCT ad.developer_id)::INTEGER AS unique_developers
  FROM app_publishers ap
  JOIN app_developers ad ON ad.appid = ap.appid
  GROUP BY ap.publisher_id
),
publisher_genres AS (
  SELECT
    ap.publisher_id,
    ARRAY_AGG(DISTINCT ag.genre_id ORDER BY ag.genre_id) AS genre_ids
  FROM app_publishers ap
  JOIN apps a ON a.appid = ap.appid AND a.type = 'game' AND a.is_delisted = FALSE
  JOIN app_genres ag ON ag.appid = ap.appid
  GROUP BY ap.publisher_id
),
publisher_tags AS (
  SELECT
    ap.publisher_id,
    ARRAY_AGG(DISTINCT ast.tag_id ORDER BY ast.tag_id) AS tag_ids
  FROM app_publishers ap
  JOIN apps a ON a.appid = ap.appid AND a.type = 'game' AND a.is_delisted = FALSE
  JOIN app_steam_tags ast ON ast.appid = ap.appid
  GROUP BY ap.publisher_id
),
publisher_categories AS (
  SELECT
    ap.publisher_id,
    ARRAY_AGG(DISTINCT ac.category_id ORDER BY ac.category_id) AS category_ids
  FROM app_publishers ap
  JOIN apps a ON a.appid = ap.appid AND a.type = 'game' AND a.is_delisted = FALSE
  JOIN app_categories ac ON ac.appid = ap.appid
  GROUP BY ap.publisher_id
),
publisher_steam_deck AS (
  SELECT DISTINCT ON (ap.publisher_id)
    ap.publisher_id,
    asd.category AS best_steam_deck_category
  FROM app_publishers ap
  JOIN apps a ON a.appid = ap.appid AND a.type = 'game' AND a.is_delisted = FALSE
  JOIN app_steam_deck asd ON asd.appid = ap.appid
  WHERE asd.category IN ('verified', 'playable')
  ORDER BY ap.publisher_id,
    CASE asd.category WHEN 'verified' THEN 1 WHEN 'playable' THEN 2 END
),
publisher_platforms AS (
  SELECT
    ap.publisher_id,
    ARRAY_AGG(DISTINCT platform ORDER BY platform) FILTER (WHERE platform IS NOT NULL AND platform != '') AS platform_array
  FROM app_publishers ap
  JOIN apps a ON a.appid = ap.appid AND a.type = 'game' AND a.is_delisted = FALSE
  CROSS JOIN LATERAL UNNEST(STRING_TO_ARRAY(a.platforms, ',')) AS platform
  WHERE a.platforms IS NOT NULL AND a.platforms != ''
  GROUP BY ap.publisher_id
),
-- 3-DAY GROWTH WINDOWS (works with ~6 days of CCU data)
publisher_growth AS (
  SELECT
    ap.publisher_id,
    -- 3-day growth: compare last 3 days vs prior 3 days
    AVG(cs.player_count) FILTER (WHERE cs.snapshot_time > NOW() - INTERVAL '3 days') AS current_3d_avg,
    AVG(cs.player_count) FILTER (
      WHERE cs.snapshot_time > NOW() - INTERVAL '6 days'
        AND cs.snapshot_time <= NOW() - INTERVAL '3 days'
    ) AS prior_3d_avg,
    -- 7-day baseline for 30-day growth (compare recent 3d vs 7d baseline)
    AVG(cs.player_count) FILTER (WHERE cs.snapshot_time > NOW() - INTERVAL '7 days') AS baseline_7d_avg
  FROM app_publishers ap
  JOIN apps a ON a.appid = ap.appid AND a.type = 'game' AND a.is_delisted = FALSE
  LEFT JOIN ccu_snapshots cs ON cs.appid = ap.appid AND cs.snapshot_time > NOW() - INTERVAL '7 days'
  GROUP BY ap.publisher_id
),
-- VELOCITY: Aggregate from review_velocity_stats
publisher_velocity AS (
  SELECT
    ap.publisher_id,
    SUM(rvs.velocity_7d)::DECIMAL(10,4) AS review_velocity_7d,
    SUM(rvs.velocity_30d)::DECIMAL(10,4) AS review_velocity_30d
  FROM app_publishers ap
  JOIN apps a ON a.appid = ap.appid AND a.type = 'game' AND a.is_delisted = FALSE
  LEFT JOIN review_velocity_stats rvs ON rvs.appid = ap.appid
  GROUP BY ap.publisher_id
)
SELECT
  pa.publisher_id,
  p.name AS publisher_name,
  p.game_count,
  COALESCE((SUM(pa.owners_min) + SUM(pa.owners_max)) / 2, 0)::BIGINT AS total_owners,
  COALESCE(SUM(pa.ccu_peak), 0)::BIGINT AS total_ccu,
  COALESCE(SUM(
    COALESCE(pa.ccu_7d_sum, 0) * COALESCE(pa.average_playtime_2weeks, 0) / 2.0 / 60.0
  ), 0)::BIGINT AS estimated_weekly_hours,
  COALESCE(SUM(pa.total_reviews), 0)::BIGINT AS total_reviews,
  COALESCE(SUM(pa.positive_reviews), 0)::BIGINT AS positive_reviews,
  CASE
    WHEN SUM(pa.total_reviews) > 0
    THEN ROUND((SUM(pa.positive_reviews)::DECIMAL / SUM(pa.total_reviews)) * 100)::SMALLINT
    ELSE NULL
  END AS avg_review_score,
  COALESCE(SUM(
    ((COALESCE(pa.owners_min, 0) + COALESCE(pa.owners_max, 0)) / 2.0) *
    COALESCE(pa.current_price_cents, 0)
  ), 0)::BIGINT AS revenue_estimate_cents,
  (COUNT(*) FILTER (WHERE pa.trend_30d_direction = 'up') > 0) AS is_trending,
  COUNT(*) FILTER (WHERE pa.trend_30d_direction = 'up')::INTEGER AS games_trending_up,
  COUNT(*) FILTER (WHERE pa.trend_30d_direction = 'down')::INTEGER AS games_trending_down,
  COUNT(*) FILTER (WHERE pa.trend_30d_direction = 'stable')::INTEGER AS games_trending_stable,
  COUNT(*) FILTER (WHERE pa.release_date >= CURRENT_DATE - INTERVAL '1 year')::INTEGER AS games_released_last_year,
  COALESCE(pd.unique_developers, 0)::INTEGER AS unique_developers,
  -- Content arrays
  pg.genre_ids,
  pt.tag_ids,
  pc.category_ids,
  psd.best_steam_deck_category,
  pp.platform_array,
  -- 3-day growth (labeled as 7d for API compatibility)
  CASE
    WHEN pgr.prior_3d_avg > 0
    THEN ROUND(((pgr.current_3d_avg - pgr.prior_3d_avg) / pgr.prior_3d_avg) * 100, 2)
    ELSE NULL
  END::DECIMAL AS ccu_growth_7d_percent,
  -- 30-day growth: compare current 3d vs 7d baseline
  CASE
    WHEN pgr.baseline_7d_avg > 0
    THEN ROUND(((pgr.current_3d_avg - pgr.baseline_7d_avg) / pgr.baseline_7d_avg) * 100, 2)
    ELSE NULL
  END::DECIMAL AS ccu_growth_30d_percent,
  -- Velocity columns
  COALESCE(pv.review_velocity_7d, 0)::DECIMAL AS review_velocity_7d,
  COALESCE(pv.review_velocity_30d, 0)::DECIMAL AS review_velocity_30d,
  NOW() AS computed_at

FROM publisher_apps pa
JOIN publishers p ON p.id = pa.publisher_id
LEFT JOIN publisher_developers pd ON pd.publisher_id = pa.publisher_id
LEFT JOIN publisher_genres pg ON pg.publisher_id = pa.publisher_id
LEFT JOIN publisher_tags pt ON pt.publisher_id = pa.publisher_id
LEFT JOIN publisher_categories pc ON pc.publisher_id = pa.publisher_id
LEFT JOIN publisher_steam_deck psd ON psd.publisher_id = pa.publisher_id
LEFT JOIN publisher_platforms pp ON pp.publisher_id = pa.publisher_id
LEFT JOIN publisher_growth pgr ON pgr.publisher_id = pa.publisher_id
LEFT JOIN publisher_velocity pv ON pv.publisher_id = pa.publisher_id
GROUP BY pa.publisher_id, p.name, p.game_count, pd.unique_developers,
         pg.genre_ids, pt.tag_ids, pc.category_ids, psd.best_steam_deck_category,
         pp.platform_array, pgr.current_3d_avg, pgr.prior_3d_avg, pgr.baseline_7d_avg,
         pv.review_velocity_7d, pv.review_velocity_30d;

-- Indexes for publisher_metrics
CREATE UNIQUE INDEX idx_publisher_metrics_pk ON publisher_metrics(publisher_id);
CREATE INDEX idx_publisher_metrics_owners ON publisher_metrics(total_owners DESC);
CREATE INDEX idx_publisher_metrics_ccu ON publisher_metrics(total_ccu DESC);
CREATE INDEX idx_publisher_metrics_weekly_hours ON publisher_metrics(estimated_weekly_hours DESC);
CREATE INDEX idx_publisher_metrics_score ON publisher_metrics(avg_review_score DESC NULLS LAST);
CREATE INDEX idx_publisher_metrics_revenue ON publisher_metrics(revenue_estimate_cents DESC);
CREATE INDEX idx_publisher_metrics_trending ON publisher_metrics(games_trending_up DESC);
CREATE INDEX idx_publisher_metrics_developers ON publisher_metrics(unique_developers DESC);
CREATE INDEX idx_publisher_metrics_name ON publisher_metrics(publisher_name);
CREATE INDEX idx_publisher_metrics_genre_ids ON publisher_metrics USING GIN(genre_ids);
CREATE INDEX idx_publisher_metrics_tag_ids ON publisher_metrics USING GIN(tag_ids);
CREATE INDEX idx_publisher_metrics_category_ids ON publisher_metrics USING GIN(category_ids);
CREATE INDEX idx_publisher_metrics_steam_deck ON publisher_metrics(best_steam_deck_category);
CREATE INDEX idx_publisher_metrics_platforms ON publisher_metrics USING GIN(platform_array);
CREATE INDEX idx_publisher_metrics_growth_7d ON publisher_metrics(ccu_growth_7d_percent DESC NULLS LAST);
CREATE INDEX idx_publisher_metrics_growth_30d ON publisher_metrics(ccu_growth_30d_percent DESC NULLS LAST);
CREATE INDEX idx_publisher_metrics_velocity_7d ON publisher_metrics(review_velocity_7d DESC NULLS LAST);
CREATE INDEX idx_publisher_metrics_velocity_30d ON publisher_metrics(review_velocity_30d DESC NULLS LAST);

COMMENT ON MATERIALIZED VIEW publisher_metrics IS
  'Pre-computed publisher metrics with 3-day growth windows and review velocity. Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY publisher_metrics';


-- ============================================================================
-- STEP 2: Recreate developer_metrics with 3-day growth windows + velocity
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS developer_metrics CASCADE;

CREATE MATERIALIZED VIEW developer_metrics AS
WITH latest_metrics AS (
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
  SELECT
    appid,
    SUM(ccu_peak) AS ccu_7d_sum
  FROM daily_metrics
  WHERE metric_date >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY appid
),
developer_apps AS (
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
),
developer_genres AS (
  SELECT
    ad.developer_id,
    ARRAY_AGG(DISTINCT ag.genre_id ORDER BY ag.genre_id) AS genre_ids
  FROM app_developers ad
  JOIN apps a ON a.appid = ad.appid AND a.type = 'game' AND a.is_delisted = FALSE
  JOIN app_genres ag ON ag.appid = ad.appid
  GROUP BY ad.developer_id
),
developer_tags AS (
  SELECT
    ad.developer_id,
    ARRAY_AGG(DISTINCT ast.tag_id ORDER BY ast.tag_id) AS tag_ids
  FROM app_developers ad
  JOIN apps a ON a.appid = ad.appid AND a.type = 'game' AND a.is_delisted = FALSE
  JOIN app_steam_tags ast ON ast.appid = ad.appid
  GROUP BY ad.developer_id
),
developer_categories AS (
  SELECT
    ad.developer_id,
    ARRAY_AGG(DISTINCT ac.category_id ORDER BY ac.category_id) AS category_ids
  FROM app_developers ad
  JOIN apps a ON a.appid = ad.appid AND a.type = 'game' AND a.is_delisted = FALSE
  JOIN app_categories ac ON ac.appid = ad.appid
  GROUP BY ad.developer_id
),
developer_steam_deck AS (
  SELECT DISTINCT ON (ad.developer_id)
    ad.developer_id,
    asd.category AS best_steam_deck_category
  FROM app_developers ad
  JOIN apps a ON a.appid = ad.appid AND a.type = 'game' AND a.is_delisted = FALSE
  JOIN app_steam_deck asd ON asd.appid = ad.appid
  WHERE asd.category IN ('verified', 'playable')
  ORDER BY ad.developer_id,
    CASE asd.category WHEN 'verified' THEN 1 WHEN 'playable' THEN 2 END
),
developer_platforms AS (
  SELECT
    ad.developer_id,
    ARRAY_AGG(DISTINCT platform ORDER BY platform) FILTER (WHERE platform IS NOT NULL AND platform != '') AS platform_array
  FROM app_developers ad
  JOIN apps a ON a.appid = ad.appid AND a.type = 'game' AND a.is_delisted = FALSE
  CROSS JOIN LATERAL UNNEST(STRING_TO_ARRAY(a.platforms, ',')) AS platform
  WHERE a.platforms IS NOT NULL AND a.platforms != ''
  GROUP BY ad.developer_id
),
-- 3-DAY GROWTH WINDOWS (works with ~6 days of CCU data)
developer_growth AS (
  SELECT
    ad.developer_id,
    -- 3-day growth: compare last 3 days vs prior 3 days
    AVG(cs.player_count) FILTER (WHERE cs.snapshot_time > NOW() - INTERVAL '3 days') AS current_3d_avg,
    AVG(cs.player_count) FILTER (
      WHERE cs.snapshot_time > NOW() - INTERVAL '6 days'
        AND cs.snapshot_time <= NOW() - INTERVAL '3 days'
    ) AS prior_3d_avg,
    -- 7-day baseline for 30-day growth
    AVG(cs.player_count) FILTER (WHERE cs.snapshot_time > NOW() - INTERVAL '7 days') AS baseline_7d_avg
  FROM app_developers ad
  JOIN apps a ON a.appid = ad.appid AND a.type = 'game' AND a.is_delisted = FALSE
  LEFT JOIN ccu_snapshots cs ON cs.appid = ad.appid AND cs.snapshot_time > NOW() - INTERVAL '7 days'
  GROUP BY ad.developer_id
),
-- VELOCITY: Aggregate from review_velocity_stats
developer_velocity AS (
  SELECT
    ad.developer_id,
    SUM(rvs.velocity_7d)::DECIMAL(10,4) AS review_velocity_7d,
    SUM(rvs.velocity_30d)::DECIMAL(10,4) AS review_velocity_30d
  FROM app_developers ad
  JOIN apps a ON a.appid = ad.appid AND a.type = 'game' AND a.is_delisted = FALSE
  LEFT JOIN review_velocity_stats rvs ON rvs.appid = ad.appid
  GROUP BY ad.developer_id
)
SELECT
  da.developer_id,
  d.name AS developer_name,
  d.game_count,
  COALESCE((SUM(da.owners_min) + SUM(da.owners_max)) / 2, 0)::BIGINT AS total_owners,
  COALESCE(SUM(da.ccu_peak), 0)::BIGINT AS total_ccu,
  COALESCE(SUM(
    COALESCE(da.ccu_7d_sum, 0) * COALESCE(da.average_playtime_2weeks, 0) / 2.0 / 60.0
  ), 0)::BIGINT AS estimated_weekly_hours,
  COALESCE(SUM(da.total_reviews), 0)::BIGINT AS total_reviews,
  COALESCE(SUM(da.positive_reviews), 0)::BIGINT AS positive_reviews,
  CASE
    WHEN SUM(da.total_reviews) > 0
    THEN ROUND((SUM(da.positive_reviews)::DECIMAL / SUM(da.total_reviews)) * 100)::SMALLINT
    ELSE NULL
  END AS avg_review_score,
  COALESCE(SUM(
    ((COALESCE(da.owners_min, 0) + COALESCE(da.owners_max, 0)) / 2.0) *
    COALESCE(da.current_price_cents, 0)
  ), 0)::BIGINT AS revenue_estimate_cents,
  (COUNT(*) FILTER (WHERE da.trend_30d_direction = 'up') > 0) AS is_trending,
  COUNT(*) FILTER (WHERE da.trend_30d_direction = 'up')::INTEGER AS games_trending_up,
  COUNT(*) FILTER (WHERE da.trend_30d_direction = 'down')::INTEGER AS games_trending_down,
  COUNT(*) FILTER (WHERE da.trend_30d_direction = 'stable')::INTEGER AS games_trending_stable,
  COUNT(*) FILTER (WHERE da.release_date >= CURRENT_DATE - INTERVAL '1 year')::INTEGER AS games_released_last_year,
  -- Content arrays
  dg.genre_ids,
  dt.tag_ids,
  dc.category_ids,
  dsd.best_steam_deck_category,
  dp.platform_array,
  -- 3-day growth (labeled as 7d for API compatibility)
  CASE
    WHEN dgr.prior_3d_avg > 0
    THEN ROUND(((dgr.current_3d_avg - dgr.prior_3d_avg) / dgr.prior_3d_avg) * 100, 2)
    ELSE NULL
  END::DECIMAL AS ccu_growth_7d_percent,
  -- 30-day growth: compare current 3d vs 7d baseline
  CASE
    WHEN dgr.baseline_7d_avg > 0
    THEN ROUND(((dgr.current_3d_avg - dgr.baseline_7d_avg) / dgr.baseline_7d_avg) * 100, 2)
    ELSE NULL
  END::DECIMAL AS ccu_growth_30d_percent,
  -- Velocity columns
  COALESCE(dv.review_velocity_7d, 0)::DECIMAL AS review_velocity_7d,
  COALESCE(dv.review_velocity_30d, 0)::DECIMAL AS review_velocity_30d,
  NOW() AS computed_at

FROM developer_apps da
JOIN developers d ON d.id = da.developer_id
LEFT JOIN developer_genres dg ON dg.developer_id = da.developer_id
LEFT JOIN developer_tags dt ON dt.developer_id = da.developer_id
LEFT JOIN developer_categories dc ON dc.developer_id = da.developer_id
LEFT JOIN developer_steam_deck dsd ON dsd.developer_id = da.developer_id
LEFT JOIN developer_platforms dp ON dp.developer_id = da.developer_id
LEFT JOIN developer_growth dgr ON dgr.developer_id = da.developer_id
LEFT JOIN developer_velocity dv ON dv.developer_id = da.developer_id
GROUP BY da.developer_id, d.name, d.game_count,
         dg.genre_ids, dt.tag_ids, dc.category_ids, dsd.best_steam_deck_category,
         dp.platform_array, dgr.current_3d_avg, dgr.prior_3d_avg, dgr.baseline_7d_avg,
         dv.review_velocity_7d, dv.review_velocity_30d;

-- Indexes for developer_metrics
CREATE UNIQUE INDEX idx_developer_metrics_pk ON developer_metrics(developer_id);
CREATE INDEX idx_developer_metrics_owners ON developer_metrics(total_owners DESC);
CREATE INDEX idx_developer_metrics_ccu ON developer_metrics(total_ccu DESC);
CREATE INDEX idx_developer_metrics_weekly_hours ON developer_metrics(estimated_weekly_hours DESC);
CREATE INDEX idx_developer_metrics_score ON developer_metrics(avg_review_score DESC NULLS LAST);
CREATE INDEX idx_developer_metrics_revenue ON developer_metrics(revenue_estimate_cents DESC);
CREATE INDEX idx_developer_metrics_trending ON developer_metrics(games_trending_up DESC);
CREATE INDEX idx_developer_metrics_name ON developer_metrics(developer_name);
CREATE INDEX idx_developer_metrics_genre_ids ON developer_metrics USING GIN(genre_ids);
CREATE INDEX idx_developer_metrics_tag_ids ON developer_metrics USING GIN(tag_ids);
CREATE INDEX idx_developer_metrics_category_ids ON developer_metrics USING GIN(category_ids);
CREATE INDEX idx_developer_metrics_steam_deck ON developer_metrics(best_steam_deck_category);
CREATE INDEX idx_developer_metrics_platforms ON developer_metrics USING GIN(platform_array);
CREATE INDEX idx_developer_metrics_growth_7d ON developer_metrics(ccu_growth_7d_percent DESC NULLS LAST);
CREATE INDEX idx_developer_metrics_growth_30d ON developer_metrics(ccu_growth_30d_percent DESC NULLS LAST);
CREATE INDEX idx_developer_metrics_velocity_7d ON developer_metrics(review_velocity_7d DESC NULLS LAST);
CREATE INDEX idx_developer_metrics_velocity_30d ON developer_metrics(review_velocity_30d DESC NULLS LAST);

COMMENT ON MATERIALIZED VIEW developer_metrics IS
  'Pre-computed developer metrics with 3-day growth windows and review velocity. Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY developer_metrics';

-- Grant permissions
GRANT SELECT ON publisher_metrics TO anon, authenticated, service_role;
GRANT SELECT ON developer_metrics TO anon, authenticated, service_role;


-- ============================================================================
-- STEP 3: Update get_companies_with_filters to use velocity columns
-- ============================================================================

DROP FUNCTION IF EXISTS get_companies_with_filters(
  TEXT, TEXT, TEXT, TEXT, INT, INT,
  INT, INT, BIGINT, BIGINT, INT, INT, BIGINT, BIGINT, BIGINT, BIGINT, INT, INT, INT, INT,
  DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT,
  INT[], TEXT, INT[], INT[], TEXT, TEXT[], TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION get_companies_with_filters(
  p_type TEXT DEFAULT 'all',
  p_search TEXT DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'estimated_weekly_hours',
  p_sort_order TEXT DEFAULT 'desc',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_min_games INT DEFAULT NULL,
  p_max_games INT DEFAULT NULL,
  p_min_owners BIGINT DEFAULT NULL,
  p_max_owners BIGINT DEFAULT NULL,
  p_min_ccu INT DEFAULT NULL,
  p_max_ccu INT DEFAULT NULL,
  p_min_hours BIGINT DEFAULT NULL,
  p_max_hours BIGINT DEFAULT NULL,
  p_min_revenue BIGINT DEFAULT NULL,
  p_max_revenue BIGINT DEFAULT NULL,
  p_min_score INT DEFAULT NULL,
  p_max_score INT DEFAULT NULL,
  p_min_reviews INT DEFAULT NULL,
  p_max_reviews INT DEFAULT NULL,
  p_min_growth_7d DECIMAL DEFAULT NULL,
  p_max_growth_7d DECIMAL DEFAULT NULL,
  p_min_growth_30d DECIMAL DEFAULT NULL,
  p_max_growth_30d DECIMAL DEFAULT NULL,
  p_period TEXT DEFAULT 'all',
  p_genres INT[] DEFAULT NULL,
  p_genre_mode TEXT DEFAULT 'any',
  p_tags INT[] DEFAULT NULL,
  p_categories INT[] DEFAULT NULL,
  p_steam_deck TEXT DEFAULT NULL,
  p_platforms TEXT[] DEFAULT NULL,
  p_platform_mode TEXT DEFAULT 'any',
  p_status TEXT DEFAULT NULL,
  p_relationship TEXT DEFAULT NULL
)
RETURNS TABLE (
  id INT,
  name TEXT,
  type TEXT,
  game_count INT,
  total_owners BIGINT,
  total_ccu BIGINT,
  estimated_weekly_hours BIGINT,
  total_reviews BIGINT,
  positive_reviews BIGINT,
  avg_review_score SMALLINT,
  revenue_estimate_cents BIGINT,
  games_trending_up INT,
  games_trending_down INT,
  ccu_growth_7d_percent DECIMAL,
  ccu_growth_30d_percent DECIMAL,
  review_velocity_7d DECIMAL,
  review_velocity_30d DECIMAL,
  is_self_published BOOLEAN,
  works_with_external_devs BOOLEAN,
  external_partner_count INT,
  first_release_date DATE,
  latest_release_date DATE,
  years_active INT,
  steam_vanity_url TEXT,
  unique_developers INT,
  data_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_needs_relationship BOOLEAN;
BEGIN
  v_needs_relationship := (p_relationship IS NOT NULL);

  -- Fast path: Use pre-computed metrics from materialized views
  IF NOT v_needs_relationship THEN
    RETURN QUERY
    WITH base_companies AS (
      SELECT
        p.id,
        p.name,
        'publisher'::TEXT AS type,
        p.game_count,
        COALESCE(pm.total_owners, 0)::BIGINT AS total_owners,
        COALESCE(pm.total_ccu, 0)::BIGINT AS total_ccu,
        COALESCE(pm.estimated_weekly_hours, 0)::BIGINT AS estimated_weekly_hours,
        COALESCE(pm.total_reviews, 0)::BIGINT AS total_reviews,
        COALESCE(pm.positive_reviews, 0)::BIGINT AS positive_reviews,
        pm.avg_review_score,
        COALESCE(pm.revenue_estimate_cents, 0)::BIGINT AS revenue_estimate_cents,
        COALESCE(pm.games_trending_up, 0)::INT AS games_trending_up,
        COALESCE(pm.games_trending_down, 0)::INT AS games_trending_down,
        COALESCE(pm.games_released_last_year, 0)::INT AS games_released_last_year,
        p.first_game_release_date,
        p.steam_vanity_url,
        COALESCE(pm.unique_developers, 0)::INT AS unique_developers,
        pm.computed_at AS data_updated_at,
        pm.genre_ids,
        pm.tag_ids,
        pm.category_ids,
        pm.best_steam_deck_category,
        pm.platform_array,
        pm.ccu_growth_7d_percent,
        pm.ccu_growth_30d_percent,
        pm.review_velocity_7d,
        pm.review_velocity_30d
      FROM publishers p
      LEFT JOIN publisher_metrics pm ON pm.publisher_id = p.id
      WHERE (p_type = 'all' OR p_type = 'publisher')
        AND p.game_count > 0

      UNION ALL

      SELECT
        d.id,
        d.name,
        'developer'::TEXT AS type,
        d.game_count,
        COALESCE(dm.total_owners, 0)::BIGINT AS total_owners,
        COALESCE(dm.total_ccu, 0)::BIGINT AS total_ccu,
        COALESCE(dm.estimated_weekly_hours, 0)::BIGINT AS estimated_weekly_hours,
        COALESCE(dm.total_reviews, 0)::BIGINT AS total_reviews,
        COALESCE(dm.positive_reviews, 0)::BIGINT AS positive_reviews,
        dm.avg_review_score,
        COALESCE(dm.revenue_estimate_cents, 0)::BIGINT AS revenue_estimate_cents,
        COALESCE(dm.games_trending_up, 0)::INT AS games_trending_up,
        COALESCE(dm.games_trending_down, 0)::INT AS games_trending_down,
        COALESCE(dm.games_released_last_year, 0)::INT AS games_released_last_year,
        d.first_game_release_date,
        d.steam_vanity_url,
        0::INT AS unique_developers,
        dm.computed_at AS data_updated_at,
        dm.genre_ids,
        dm.tag_ids,
        dm.category_ids,
        dm.best_steam_deck_category,
        dm.platform_array,
        dm.ccu_growth_7d_percent,
        dm.ccu_growth_30d_percent,
        dm.review_velocity_7d,
        dm.review_velocity_30d
      FROM developers d
      LEFT JOIN developer_metrics dm ON dm.developer_id = d.id
      WHERE (p_type = 'all' OR p_type = 'developer')
        AND d.game_count > 0
    ),
    filtered AS (
      SELECT bc.*
      FROM base_companies bc
      WHERE
        (p_search IS NULL OR bc.name ILIKE '%' || p_search || '%')
        AND (p_min_games IS NULL OR bc.game_count >= p_min_games)
        AND (p_max_games IS NULL OR bc.game_count <= p_max_games)
        AND (p_min_owners IS NULL OR bc.total_owners >= p_min_owners)
        AND (p_max_owners IS NULL OR bc.total_owners <= p_max_owners)
        AND (p_min_ccu IS NULL OR bc.total_ccu >= p_min_ccu)
        AND (p_max_ccu IS NULL OR bc.total_ccu <= p_max_ccu)
        AND (p_min_hours IS NULL OR bc.estimated_weekly_hours >= p_min_hours)
        AND (p_max_hours IS NULL OR bc.estimated_weekly_hours <= p_max_hours)
        AND (p_min_revenue IS NULL OR bc.revenue_estimate_cents >= p_min_revenue)
        AND (p_max_revenue IS NULL OR bc.revenue_estimate_cents <= p_max_revenue)
        AND (p_min_score IS NULL OR bc.avg_review_score >= p_min_score)
        AND (p_max_score IS NULL OR bc.avg_review_score <= p_max_score)
        AND (p_min_reviews IS NULL OR bc.total_reviews >= p_min_reviews)
        AND (p_max_reviews IS NULL OR bc.total_reviews <= p_max_reviews)
        AND (p_status IS NULL
             OR (p_status = 'active' AND bc.games_released_last_year > 0)
             OR (p_status = 'dormant' AND bc.games_released_last_year = 0))
        AND (p_genres IS NULL OR (
          CASE p_genre_mode
            WHEN 'all' THEN bc.genre_ids @> p_genres
            ELSE bc.genre_ids && p_genres
          END
        ))
        AND (p_tags IS NULL OR bc.tag_ids && p_tags)
        AND (p_categories IS NULL OR bc.category_ids && p_categories)
        AND (p_steam_deck IS NULL OR (
          CASE p_steam_deck
            WHEN 'verified' THEN bc.best_steam_deck_category = 'verified'
            WHEN 'playable' THEN bc.best_steam_deck_category IN ('verified', 'playable')
            ELSE bc.best_steam_deck_category IS NOT NULL
          END
        ))
        AND (p_platforms IS NULL OR (
          CASE p_platform_mode
            WHEN 'all' THEN bc.platform_array @> p_platforms
            ELSE bc.platform_array && p_platforms
          END
        ))
        AND (p_min_growth_7d IS NULL OR bc.ccu_growth_7d_percent >= p_min_growth_7d)
        AND (p_max_growth_7d IS NULL OR bc.ccu_growth_7d_percent <= p_max_growth_7d)
        AND (p_min_growth_30d IS NULL OR bc.ccu_growth_30d_percent >= p_min_growth_30d)
        AND (p_max_growth_30d IS NULL OR bc.ccu_growth_30d_percent <= p_max_growth_30d)
    ),
    sorted_paginated AS (
      SELECT f.*
      FROM filtered f
      ORDER BY
        CASE WHEN p_sort_order = 'asc' THEN
          CASE p_sort_by WHEN 'name' THEN f.name ELSE NULL END
        END ASC NULLS LAST,
        CASE WHEN p_sort_order = 'desc' THEN
          CASE p_sort_by WHEN 'name' THEN f.name ELSE NULL END
        END DESC NULLS LAST,
        CASE WHEN p_sort_order = 'asc' THEN
          CASE p_sort_by
            WHEN 'estimated_weekly_hours' THEN f.estimated_weekly_hours
            WHEN 'game_count' THEN f.game_count
            WHEN 'total_owners' THEN f.total_owners
            WHEN 'total_ccu' THEN f.total_ccu
            WHEN 'avg_review_score' THEN f.avg_review_score
            WHEN 'total_reviews' THEN f.total_reviews
            WHEN 'revenue_estimate_cents' THEN f.revenue_estimate_cents
            WHEN 'games_trending_up' THEN f.games_trending_up
            WHEN 'ccu_growth_7d' THEN f.ccu_growth_7d_percent
            WHEN 'ccu_growth_30d' THEN f.ccu_growth_30d_percent
            ELSE f.estimated_weekly_hours
          END
        END ASC NULLS LAST,
        CASE WHEN p_sort_order = 'desc' THEN
          CASE p_sort_by
            WHEN 'estimated_weekly_hours' THEN f.estimated_weekly_hours
            WHEN 'game_count' THEN f.game_count
            WHEN 'total_owners' THEN f.total_owners
            WHEN 'total_ccu' THEN f.total_ccu
            WHEN 'avg_review_score' THEN f.avg_review_score
            WHEN 'total_reviews' THEN f.total_reviews
            WHEN 'revenue_estimate_cents' THEN f.revenue_estimate_cents
            WHEN 'games_trending_up' THEN f.games_trending_up
            WHEN 'ccu_growth_7d' THEN f.ccu_growth_7d_percent
            WHEN 'ccu_growth_30d' THEN f.ccu_growth_30d_percent
            ELSE f.estimated_weekly_hours
          END
        END DESC NULLS LAST
      LIMIT p_limit OFFSET p_offset
    )
    SELECT
      sp.id,
      sp.name,
      sp.type,
      sp.game_count,
      sp.total_owners,
      sp.total_ccu,
      sp.estimated_weekly_hours,
      sp.total_reviews,
      sp.positive_reviews,
      sp.avg_review_score,
      sp.revenue_estimate_cents,
      sp.games_trending_up,
      sp.games_trending_down,
      sp.ccu_growth_7d_percent,
      sp.ccu_growth_30d_percent,
      sp.review_velocity_7d,
      sp.review_velocity_30d,
      NULL::BOOLEAN AS is_self_published,
      NULL::BOOLEAN AS works_with_external_devs,
      NULL::INT AS external_partner_count,
      sp.first_game_release_date AS first_release_date,
      NULL::DATE AS latest_release_date,
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, sp.first_game_release_date))::INT AS years_active,
      sp.steam_vanity_url,
      sp.unique_developers,
      sp.data_updated_at
    FROM sorted_paginated sp;

  -- Slow path: Only for relationship filters
  ELSE
    RETURN QUERY
    WITH base_companies AS (
      SELECT
        p.id AS id,
        p.name AS name,
        'publisher'::TEXT AS type,
        p.game_count AS game_count,
        COALESCE(pm.total_owners, 0)::BIGINT AS total_owners,
        COALESCE(pm.total_ccu, 0)::BIGINT AS total_ccu,
        COALESCE(pm.estimated_weekly_hours, 0)::BIGINT AS estimated_weekly_hours,
        COALESCE(pm.total_reviews, 0)::BIGINT AS total_reviews,
        COALESCE(pm.positive_reviews, 0)::BIGINT AS positive_reviews,
        pm.avg_review_score AS avg_review_score,
        COALESCE(pm.revenue_estimate_cents, 0)::BIGINT AS revenue_estimate_cents,
        COALESCE(pm.games_trending_up, 0)::INT AS games_trending_up,
        COALESCE(pm.games_trending_down, 0)::INT AS games_trending_down,
        COALESCE(pm.games_released_last_year, 0)::INT AS games_released_last_year,
        p.first_game_release_date AS first_game_release_date,
        p.steam_vanity_url AS steam_vanity_url,
        COALESCE(pm.unique_developers, 0)::INT AS unique_developers,
        pm.computed_at AS data_updated_at,
        pm.genre_ids AS genre_ids,
        pm.tag_ids AS tag_ids,
        pm.category_ids AS category_ids,
        pm.best_steam_deck_category AS best_steam_deck_category,
        pm.platform_array AS platform_array,
        pm.ccu_growth_7d_percent AS ccu_growth_7d_percent,
        pm.ccu_growth_30d_percent AS ccu_growth_30d_percent,
        pm.review_velocity_7d AS review_velocity_7d,
        pm.review_velocity_30d AS review_velocity_30d
      FROM publishers p
      LEFT JOIN publisher_metrics pm ON pm.publisher_id = p.id
      WHERE (p_type = 'all' OR p_type = 'publisher') AND p.game_count > 0

      UNION ALL

      SELECT
        d.id AS id,
        d.name AS name,
        'developer'::TEXT AS type,
        d.game_count AS game_count,
        COALESCE(dm.total_owners, 0)::BIGINT AS total_owners,
        COALESCE(dm.total_ccu, 0)::BIGINT AS total_ccu,
        COALESCE(dm.estimated_weekly_hours, 0)::BIGINT AS estimated_weekly_hours,
        COALESCE(dm.total_reviews, 0)::BIGINT AS total_reviews,
        COALESCE(dm.positive_reviews, 0)::BIGINT AS positive_reviews,
        dm.avg_review_score AS avg_review_score,
        COALESCE(dm.revenue_estimate_cents, 0)::BIGINT AS revenue_estimate_cents,
        COALESCE(dm.games_trending_up, 0)::INT AS games_trending_up,
        COALESCE(dm.games_trending_down, 0)::INT AS games_trending_down,
        COALESCE(dm.games_released_last_year, 0)::INT AS games_released_last_year,
        d.first_game_release_date AS first_game_release_date,
        d.steam_vanity_url AS steam_vanity_url,
        0::INT AS unique_developers,
        dm.computed_at AS data_updated_at,
        dm.genre_ids AS genre_ids,
        dm.tag_ids AS tag_ids,
        dm.category_ids AS category_ids,
        dm.best_steam_deck_category AS best_steam_deck_category,
        dm.platform_array AS platform_array,
        dm.ccu_growth_7d_percent AS ccu_growth_7d_percent,
        dm.ccu_growth_30d_percent AS ccu_growth_30d_percent,
        dm.review_velocity_7d AS review_velocity_7d,
        dm.review_velocity_30d AS review_velocity_30d
      FROM developers d
      LEFT JOIN developer_metrics dm ON dm.developer_id = d.id
      WHERE (p_type = 'all' OR p_type = 'developer') AND d.game_count > 0
    ),
    filtered AS (
      SELECT bc.* FROM base_companies bc
      WHERE (p_search IS NULL OR bc.name ILIKE '%' || p_search || '%')
        AND (p_min_games IS NULL OR bc.game_count >= p_min_games)
        AND (p_max_games IS NULL OR bc.game_count <= p_max_games)
        AND (p_min_owners IS NULL OR bc.total_owners >= p_min_owners)
        AND (p_max_owners IS NULL OR bc.total_owners <= p_max_owners)
        AND (p_min_ccu IS NULL OR bc.total_ccu >= p_min_ccu)
        AND (p_max_ccu IS NULL OR bc.total_ccu <= p_max_ccu)
        AND (p_min_hours IS NULL OR bc.estimated_weekly_hours >= p_min_hours)
        AND (p_max_hours IS NULL OR bc.estimated_weekly_hours <= p_max_hours)
        AND (p_min_revenue IS NULL OR bc.revenue_estimate_cents >= p_min_revenue)
        AND (p_max_revenue IS NULL OR bc.revenue_estimate_cents <= p_max_revenue)
        AND (p_min_score IS NULL OR bc.avg_review_score >= p_min_score)
        AND (p_max_score IS NULL OR bc.avg_review_score <= p_max_score)
        AND (p_min_reviews IS NULL OR bc.total_reviews >= p_min_reviews)
        AND (p_max_reviews IS NULL OR bc.total_reviews <= p_max_reviews)
        AND (p_status IS NULL
             OR (p_status = 'active' AND bc.games_released_last_year > 0)
             OR (p_status = 'dormant' AND bc.games_released_last_year = 0))
        AND (p_genres IS NULL OR (
          CASE p_genre_mode
            WHEN 'all' THEN bc.genre_ids @> p_genres
            ELSE bc.genre_ids && p_genres
          END
        ))
        AND (p_tags IS NULL OR bc.tag_ids && p_tags)
        AND (p_categories IS NULL OR bc.category_ids && p_categories)
        AND (p_steam_deck IS NULL OR (
          CASE p_steam_deck
            WHEN 'verified' THEN bc.best_steam_deck_category = 'verified'
            WHEN 'playable' THEN bc.best_steam_deck_category IN ('verified', 'playable')
            ELSE bc.best_steam_deck_category IS NOT NULL
          END
        ))
        AND (p_platforms IS NULL OR (
          CASE p_platform_mode
            WHEN 'all' THEN bc.platform_array @> p_platforms
            ELSE bc.platform_array && p_platforms
          END
        ))
        AND (p_min_growth_7d IS NULL OR bc.ccu_growth_7d_percent >= p_min_growth_7d)
        AND (p_max_growth_7d IS NULL OR bc.ccu_growth_7d_percent <= p_max_growth_7d)
        AND (p_min_growth_30d IS NULL OR bc.ccu_growth_30d_percent >= p_min_growth_30d)
        AND (p_max_growth_30d IS NULL OR bc.ccu_growth_30d_percent <= p_max_growth_30d)
    ),
    with_relationships AS (
      SELECT f.*,
        CASE WHEN f.type = 'publisher' THEN
          NOT EXISTS (SELECT 1 FROM app_publishers ap JOIN publishers pub ON pub.id = ap.publisher_id
                      WHERE ap.publisher_id = f.id AND NOT EXISTS (
                        SELECT 1 FROM app_developers ad JOIN developers dev ON dev.id = ad.developer_id
                        WHERE ad.appid = ap.appid AND LOWER(TRIM(dev.name)) = LOWER(TRIM(pub.name))))
        ELSE NOT EXISTS (SELECT 1 FROM app_developers ad JOIN developers dev ON dev.id = ad.developer_id
                         WHERE ad.developer_id = f.id AND NOT EXISTS (
                           SELECT 1 FROM app_publishers ap JOIN publishers pub ON pub.id = ap.publisher_id
                           WHERE ap.appid = ad.appid AND LOWER(TRIM(pub.name)) = LOWER(TRIM(dev.name))))
        END AS is_self_pub,
        CASE WHEN f.type = 'publisher' THEN
          (SELECT COUNT(DISTINCT dev.id) FROM app_publishers ap
           JOIN app_developers ad ON ad.appid = ap.appid JOIN developers dev ON dev.id = ad.developer_id
           JOIN publishers pub ON pub.id = ap.publisher_id
           WHERE ap.publisher_id = f.id AND LOWER(TRIM(dev.name)) != LOWER(TRIM(pub.name)))::INT
        ELSE (SELECT COUNT(DISTINCT pub.id) FROM app_developers ad
              JOIN app_publishers ap ON ap.appid = ad.appid JOIN publishers pub ON pub.id = ap.publisher_id
              JOIN developers dev ON dev.id = ad.developer_id
              WHERE ad.developer_id = f.id AND LOWER(TRIM(pub.name)) != LOWER(TRIM(dev.name)))::INT
        END AS ext_partner_count,
        CASE WHEN f.type = 'publisher' THEN
          (SELECT MAX(a.release_date) FROM app_publishers ap JOIN apps a ON a.appid = ap.appid WHERE ap.publisher_id = f.id AND a.release_date IS NOT NULL)
        ELSE (SELECT MAX(a.release_date) FROM app_developers ad JOIN apps a ON a.appid = ad.appid WHERE ad.developer_id = f.id AND a.release_date IS NOT NULL)
        END AS latest_rel_date
      FROM filtered f
    ),
    final_filtered AS (
      SELECT * FROM with_relationships wr
      WHERE (p_relationship IS NULL
             OR (p_relationship = 'self_published' AND wr.is_self_pub = TRUE)
             OR (p_relationship = 'external_devs' AND wr.is_self_pub = FALSE AND wr.type = 'publisher')
             OR (p_relationship = 'multi_publisher' AND wr.ext_partner_count > 1 AND wr.type = 'developer'))
    )
    SELECT ff.id, ff.name, ff.type, ff.game_count, ff.total_owners, ff.total_ccu, ff.estimated_weekly_hours,
      ff.total_reviews, ff.positive_reviews, ff.avg_review_score, ff.revenue_estimate_cents,
      ff.games_trending_up, ff.games_trending_down, ff.ccu_growth_7d_percent, ff.ccu_growth_30d_percent,
      ff.review_velocity_7d, ff.review_velocity_30d,
      ff.is_self_pub, (ff.ext_partner_count > 0),
      ff.ext_partner_count, ff.first_game_release_date, ff.latest_rel_date,
      EXTRACT(YEAR FROM AGE(COALESCE(ff.latest_rel_date, CURRENT_DATE), ff.first_game_release_date))::INT,
      ff.steam_vanity_url, ff.unique_developers, ff.data_updated_at
    FROM final_filtered ff
    ORDER BY
      CASE WHEN p_sort_order = 'asc' THEN CASE p_sort_by WHEN 'name' THEN ff.name ELSE NULL END END ASC NULLS LAST,
      CASE WHEN p_sort_order = 'desc' THEN CASE p_sort_by WHEN 'name' THEN ff.name ELSE NULL END END DESC NULLS LAST,
      CASE WHEN p_sort_order = 'asc' THEN
        CASE p_sort_by
          WHEN 'estimated_weekly_hours' THEN ff.estimated_weekly_hours WHEN 'game_count' THEN ff.game_count
          WHEN 'total_owners' THEN ff.total_owners WHEN 'total_ccu' THEN ff.total_ccu
          WHEN 'avg_review_score' THEN ff.avg_review_score WHEN 'total_reviews' THEN ff.total_reviews
          WHEN 'revenue_estimate_cents' THEN ff.revenue_estimate_cents WHEN 'games_trending_up' THEN ff.games_trending_up
          WHEN 'ccu_growth_7d' THEN ff.ccu_growth_7d_percent WHEN 'ccu_growth_30d' THEN ff.ccu_growth_30d_percent
          ELSE ff.estimated_weekly_hours END
      END ASC NULLS LAST,
      CASE WHEN p_sort_order = 'desc' THEN
        CASE p_sort_by
          WHEN 'estimated_weekly_hours' THEN ff.estimated_weekly_hours WHEN 'game_count' THEN ff.game_count
          WHEN 'total_owners' THEN ff.total_owners WHEN 'total_ccu' THEN ff.total_ccu
          WHEN 'avg_review_score' THEN ff.avg_review_score WHEN 'total_reviews' THEN ff.total_reviews
          WHEN 'revenue_estimate_cents' THEN ff.revenue_estimate_cents WHEN 'games_trending_up' THEN ff.games_trending_up
          WHEN 'ccu_growth_7d' THEN ff.ccu_growth_7d_percent WHEN 'ccu_growth_30d' THEN ff.ccu_growth_30d_percent
          ELSE ff.estimated_weekly_hours END
      END DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_companies_with_filters IS
'Unified RPC for /companies page with 3-day growth windows and velocity metrics.';
