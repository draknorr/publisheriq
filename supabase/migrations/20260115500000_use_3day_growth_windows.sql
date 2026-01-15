-- Migration: Use 3-day growth windows instead of 7-day
-- Date: 2026-01-14
--
-- REASON:
--   1. CCU data only has 5 days of history currently
--   2. 3-day windows are more responsive to recent momentum
--   3. Better for detecting breakouts and new game trends
--
-- CHANGE: Growth calculation uses 3-day vs prior 3-day (instead of 7-day vs prior 7-day)

-- ============================================================================
-- STEP 1: Recreate publisher_metrics with 3-day growth windows
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
-- UPDATED: Use 3-day windows for more responsive growth detection
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
  -- UPDATED: 3-day growth (labeled as 7d for API compatibility)
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
GROUP BY pa.publisher_id, p.name, p.game_count, pd.unique_developers,
         pg.genre_ids, pt.tag_ids, pc.category_ids, psd.best_steam_deck_category,
         pp.platform_array, pgr.current_3d_avg, pgr.prior_3d_avg, pgr.baseline_7d_avg;

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

COMMENT ON MATERIALIZED VIEW publisher_metrics IS
  'Pre-computed publisher metrics with 3-day growth windows for responsive trend detection. Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY publisher_metrics';


-- ============================================================================
-- STEP 2: Recreate developer_metrics with 3-day growth windows
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
-- UPDATED: Use 3-day windows for more responsive growth detection
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
  -- UPDATED: 3-day growth (labeled as 7d for API compatibility)
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
  NOW() AS computed_at

FROM developer_apps da
JOIN developers d ON d.id = da.developer_id
LEFT JOIN developer_genres dg ON dg.developer_id = da.developer_id
LEFT JOIN developer_tags dt ON dt.developer_id = da.developer_id
LEFT JOIN developer_categories dc ON dc.developer_id = da.developer_id
LEFT JOIN developer_steam_deck dsd ON dsd.developer_id = da.developer_id
LEFT JOIN developer_platforms dp ON dp.developer_id = da.developer_id
LEFT JOIN developer_growth dgr ON dgr.developer_id = da.developer_id
GROUP BY da.developer_id, d.name, d.game_count,
         dg.genre_ids, dt.tag_ids, dc.category_ids, dsd.best_steam_deck_category,
         dp.platform_array, dgr.current_3d_avg, dgr.prior_3d_avg, dgr.baseline_7d_avg;

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

COMMENT ON MATERIALIZED VIEW developer_metrics IS
  'Pre-computed developer metrics with 3-day growth windows for responsive trend detection. Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY developer_metrics';

-- Grant permissions
GRANT SELECT ON publisher_metrics TO anon, authenticated, service_role;
GRANT SELECT ON developer_metrics TO anon, authenticated, service_role;
