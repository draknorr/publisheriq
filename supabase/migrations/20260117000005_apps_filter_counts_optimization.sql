-- =============================================================================
-- Migration: Optimize get_apps_filter_option_counts for Tags
--
-- Problem:
--   Tag counts query using array join (ANY(afd.tag_ids)) is very slow (~5s)
--   causing statement timeouts.
--
-- Fix:
--   Pre-compute tag/genre/category counts in materialized views.
--   Query time: <10ms (down from ~5s)
-- =============================================================================

-- ============================================================================
-- Materialized views for filter option counts (pre-computed)
-- ============================================================================

-- Tag counts by app type
DROP MATERIALIZED VIEW IF EXISTS mv_tag_counts;
CREATE MATERIALIZED VIEW mv_tag_counts AS
SELECT
  a.type::TEXT AS app_type,
  ast.tag_id,
  st.name AS tag_name,
  COUNT(*)::BIGINT AS app_count
FROM app_steam_tags ast
JOIN steam_tags st ON st.tag_id = ast.tag_id
JOIN apps a ON a.appid = ast.appid
WHERE a.is_released = TRUE AND a.is_delisted = FALSE
GROUP BY a.type, ast.tag_id, st.name;

CREATE UNIQUE INDEX idx_mv_tag_counts_pk ON mv_tag_counts (app_type, tag_id);
CREATE INDEX idx_mv_tag_counts_type ON mv_tag_counts (app_type);

-- Genre counts by app type
DROP MATERIALIZED VIEW IF EXISTS mv_genre_counts;
CREATE MATERIALIZED VIEW mv_genre_counts AS
SELECT
  a.type::TEXT AS app_type,
  ag.genre_id,
  sg.name AS genre_name,
  COUNT(*)::BIGINT AS app_count
FROM app_genres ag
JOIN steam_genres sg ON sg.genre_id = ag.genre_id
JOIN apps a ON a.appid = ag.appid
WHERE a.is_released = TRUE AND a.is_delisted = FALSE
GROUP BY a.type, ag.genre_id, sg.name;

CREATE UNIQUE INDEX idx_mv_genre_counts_pk ON mv_genre_counts (app_type, genre_id);
CREATE INDEX idx_mv_genre_counts_type ON mv_genre_counts (app_type);

-- Category counts by app type
DROP MATERIALIZED VIEW IF EXISTS mv_category_counts;
CREATE MATERIALIZED VIEW mv_category_counts AS
SELECT
  a.type::TEXT AS app_type,
  ac.category_id,
  sc.name AS category_name,
  COUNT(*)::BIGINT AS app_count
FROM app_categories ac
JOIN steam_categories sc ON sc.category_id = ac.category_id
JOIN apps a ON a.appid = ac.appid
WHERE a.is_released = TRUE AND a.is_delisted = FALSE
GROUP BY a.type, ac.category_id, sc.name;

CREATE UNIQUE INDEX idx_mv_category_counts_pk ON mv_category_counts (app_type, category_id);
CREATE INDEX idx_mv_category_counts_type ON mv_category_counts (app_type);

-- Steam Deck counts by app type (note: column is 'category' in app_steam_deck table)
DROP MATERIALIZED VIEW IF EXISTS mv_steam_deck_counts;
CREATE MATERIALIZED VIEW mv_steam_deck_counts AS
SELECT
  a.type::TEXT AS app_type,
  asd.category::TEXT AS steam_deck_category,
  COUNT(*)::BIGINT AS app_count
FROM app_steam_deck asd
JOIN apps a ON a.appid = asd.appid
WHERE a.is_released = TRUE AND a.is_delisted = FALSE
  AND asd.category IS NOT NULL
GROUP BY a.type, asd.category;

CREATE UNIQUE INDEX idx_mv_steam_deck_counts_pk ON mv_steam_deck_counts (app_type, steam_deck_category);

-- CCU tier counts by app type
DROP MATERIALIZED VIEW IF EXISTS mv_ccu_tier_counts;
CREATE MATERIALIZED VIEW mv_ccu_tier_counts AS
SELECT
  a.type::TEXT AS app_type,
  ct.ccu_tier,
  COUNT(*)::BIGINT AS app_count
FROM ccu_tier_assignments ct
JOIN apps a ON a.appid = ct.appid
WHERE a.is_released = TRUE AND a.is_delisted = FALSE
GROUP BY a.type, ct.ccu_tier;

CREATE UNIQUE INDEX idx_mv_ccu_tier_counts_pk ON mv_ccu_tier_counts (app_type, ccu_tier);

-- Velocity tier counts by app type
DROP MATERIALIZED VIEW IF EXISTS mv_velocity_tier_counts;
CREATE MATERIALIZED VIEW mv_velocity_tier_counts AS
SELECT
  a.type::TEXT AS app_type,
  rvs.velocity_tier,
  COUNT(*)::BIGINT AS app_count
FROM review_velocity_stats rvs
JOIN apps a ON a.appid = rvs.appid
WHERE a.is_released = TRUE AND a.is_delisted = FALSE
  AND rvs.velocity_tier IS NOT NULL
GROUP BY a.type, rvs.velocity_tier;

CREATE UNIQUE INDEX idx_mv_velocity_tier_counts_pk ON mv_velocity_tier_counts (app_type, velocity_tier);

-- ============================================================================
-- Aggregate stats by app type (pre-computed for fast page loads)
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_apps_aggregate_stats;
CREATE MATERIALIZED VIEW mv_apps_aggregate_stats AS
WITH base_data AS (
  SELECT
    a.type::TEXT AS app_type,
    COALESCE(ldm.ccu_peak, 0) AS ccu_peak,
    ldm.review_score,
    ct.ccu_growth_7d_percent,
    COALESCE(rvs.velocity_7d, 0) - COALESCE(rvs.velocity_30d, 0) AS velocity_acceleration,
    atr.current_positive_ratio,
    atr.previous_positive_ratio,
    a.is_free,
    ldm.price_cents,
    dm_playtime.average_playtime_forever
  FROM apps a
  LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
  LEFT JOIN ccu_tier_assignments ct ON ct.appid = a.appid
  LEFT JOIN review_velocity_stats rvs ON rvs.appid = a.appid
  LEFT JOIN app_trends atr ON atr.appid = a.appid
  LEFT JOIN LATERAL (
    SELECT dm.average_playtime_forever
    FROM daily_metrics dm
    WHERE dm.appid = a.appid
    ORDER BY dm.metric_date DESC
    LIMIT 1
  ) dm_playtime ON true
  WHERE a.is_released = TRUE AND a.is_delisted = FALSE
),
computed AS (
  SELECT
    bd.*,
    CASE
      WHEN bd.ccu_growth_7d_percent IS NOT NULL
      THEN (bd.ccu_growth_7d_percent + COALESCE(bd.velocity_acceleration, 0)) / 2
      ELSE NULL
    END AS momentum_score,
    CASE
      WHEN bd.current_positive_ratio IS NOT NULL AND bd.previous_positive_ratio IS NOT NULL
      THEN (bd.current_positive_ratio - bd.previous_positive_ratio) * 100
      ELSE NULL
    END AS sentiment_delta,
    CASE
      WHEN bd.is_free OR bd.price_cents IS NULL OR bd.price_cents = 0 THEN NULL
      WHEN bd.average_playtime_forever IS NULL OR bd.average_playtime_forever = 0 THEN NULL
      ELSE (bd.average_playtime_forever::DECIMAL / 60) / (bd.price_cents::DECIMAL / 100)
    END AS value_score
  FROM base_data bd
)
SELECT
  c.app_type,
  COUNT(*)::BIGINT AS total_games,
  ROUND(AVG(c.ccu_peak), 0)::DECIMAL AS avg_ccu,
  ROUND(AVG(c.review_score), 1)::DECIMAL AS avg_score,
  ROUND(AVG(c.momentum_score), 2)::DECIMAL AS avg_momentum,
  COUNT(*) FILTER (WHERE c.ccu_growth_7d_percent >= 10)::INT AS trending_up_count,
  COUNT(*) FILTER (WHERE c.ccu_growth_7d_percent <= -10)::INT AS trending_down_count,
  COUNT(*) FILTER (WHERE c.sentiment_delta >= 3)::INT AS sentiment_improving_count,
  COUNT(*) FILTER (WHERE c.sentiment_delta <= -3)::INT AS sentiment_declining_count,
  ROUND(AVG(c.value_score), 2)::DECIMAL AS avg_value_score
FROM computed c
GROUP BY c.app_type;

CREATE UNIQUE INDEX idx_mv_apps_aggregate_stats_pk ON mv_apps_aggregate_stats (app_type);

-- ============================================================================
-- Function to refresh all filter count materialized views
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_filter_count_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tag_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_genre_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_steam_deck_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ccu_tier_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_velocity_tier_counts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_apps_aggregate_stats;
END;
$$;

-- ============================================================================
-- Optimized filter counts function using materialized views
-- ============================================================================

CREATE OR REPLACE FUNCTION get_apps_filter_option_counts(
  p_filter_type TEXT,  -- 'genre', 'tag', 'category', 'steam_deck', 'platform', 'ccu_tier', 'velocity_tier'
  p_type TEXT DEFAULT 'game',
  p_min_ccu INT DEFAULT NULL,
  p_min_reviews INT DEFAULT NULL,
  p_min_score INT DEFAULT NULL,
  p_min_owners BIGINT DEFAULT NULL
)
RETURNS TABLE (
  option_id INT,
  option_name TEXT,
  app_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_has_metric_filters BOOLEAN;
BEGIN
  -- Check if any metric filters are applied
  v_has_metric_filters := (p_min_ccu IS NOT NULL OR p_min_reviews IS NOT NULL
                           OR p_min_score IS NOT NULL OR p_min_owners IS NOT NULL);

  -- ============================================
  -- GENRE
  -- ============================================
  IF p_filter_type = 'genre' THEN
    IF v_has_metric_filters THEN
      -- Slow path with metric filters
      RETURN QUERY
      SELECT
        ag.genre_id::INT AS option_id,
        sg.name::TEXT AS option_name,
        COUNT(*)::BIGINT AS app_count
      FROM app_genres ag
      JOIN steam_genres sg ON sg.genre_id = ag.genre_id
      JOIN apps a ON a.appid = ag.appid
      LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
      WHERE a.is_released = TRUE AND a.is_delisted = FALSE
        AND (p_type = 'all' OR a.type::TEXT = p_type)
        AND (p_min_ccu IS NULL OR ldm.ccu_peak >= p_min_ccu)
        AND (p_min_reviews IS NULL OR ldm.total_reviews >= p_min_reviews)
        AND (p_min_score IS NULL OR ldm.review_score >= p_min_score)
        AND (p_min_owners IS NULL OR ldm.owners_midpoint >= p_min_owners)
      GROUP BY ag.genre_id, sg.name
      ORDER BY app_count DESC, option_name;
    ELSE
      -- FAST PATH: Use materialized view (<10ms)
      IF p_type = 'all' THEN
        RETURN QUERY
        SELECT
          mv.genre_id::INT AS option_id,
          mv.genre_name::TEXT AS option_name,
          SUM(mv.app_count)::BIGINT AS app_count
        FROM mv_genre_counts mv
        GROUP BY mv.genre_id, mv.genre_name
        ORDER BY app_count DESC, option_name;
      ELSE
        RETURN QUERY
        SELECT
          mv.genre_id::INT AS option_id,
          mv.genre_name::TEXT AS option_name,
          mv.app_count::BIGINT
        FROM mv_genre_counts mv
        WHERE mv.app_type = p_type
        ORDER BY mv.app_count DESC, mv.genre_name;
      END IF;
    END IF;

  -- ============================================
  -- TAG
  -- ============================================
  ELSIF p_filter_type = 'tag' THEN
    IF v_has_metric_filters THEN
      -- Slow path with metric filters
      RETURN QUERY
      SELECT
        ast.tag_id::INT AS option_id,
        st.name::TEXT AS option_name,
        COUNT(*)::BIGINT AS app_count
      FROM app_steam_tags ast
      JOIN steam_tags st ON st.tag_id = ast.tag_id
      JOIN apps a ON a.appid = ast.appid
      LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
      WHERE a.is_released = TRUE AND a.is_delisted = FALSE
        AND (p_type = 'all' OR a.type::TEXT = p_type)
        AND (p_min_ccu IS NULL OR ldm.ccu_peak >= p_min_ccu)
        AND (p_min_reviews IS NULL OR ldm.total_reviews >= p_min_reviews)
        AND (p_min_score IS NULL OR ldm.review_score >= p_min_score)
        AND (p_min_owners IS NULL OR ldm.owners_midpoint >= p_min_owners)
      GROUP BY ast.tag_id, st.name
      ORDER BY app_count DESC, option_name
      LIMIT 150;
    ELSE
      -- FAST PATH: Use materialized view (<10ms)
      IF p_type = 'all' THEN
        RETURN QUERY
        SELECT
          mv.tag_id::INT AS option_id,
          mv.tag_name::TEXT AS option_name,
          SUM(mv.app_count)::BIGINT AS app_count
        FROM mv_tag_counts mv
        GROUP BY mv.tag_id, mv.tag_name
        ORDER BY app_count DESC, option_name
        LIMIT 150;
      ELSE
        RETURN QUERY
        SELECT
          mv.tag_id::INT AS option_id,
          mv.tag_name::TEXT AS option_name,
          mv.app_count::BIGINT
        FROM mv_tag_counts mv
        WHERE mv.app_type = p_type
        ORDER BY mv.app_count DESC, mv.tag_name
        LIMIT 150;
      END IF;
    END IF;

  -- ============================================
  -- CATEGORY
  -- ============================================
  ELSIF p_filter_type = 'category' THEN
    IF v_has_metric_filters THEN
      RETURN QUERY
      SELECT
        ac.category_id::INT AS option_id,
        sc.name::TEXT AS option_name,
        COUNT(*)::BIGINT AS app_count
      FROM app_categories ac
      JOIN steam_categories sc ON sc.category_id = ac.category_id
      JOIN apps a ON a.appid = ac.appid
      LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
      WHERE a.is_released = TRUE AND a.is_delisted = FALSE
        AND (p_type = 'all' OR a.type::TEXT = p_type)
        AND (p_min_ccu IS NULL OR ldm.ccu_peak >= p_min_ccu)
        AND (p_min_reviews IS NULL OR ldm.total_reviews >= p_min_reviews)
        AND (p_min_score IS NULL OR ldm.review_score >= p_min_score)
        AND (p_min_owners IS NULL OR ldm.owners_midpoint >= p_min_owners)
      GROUP BY ac.category_id, sc.name
      ORDER BY app_count DESC, option_name;
    ELSE
      -- FAST PATH: Use materialized view (<10ms)
      IF p_type = 'all' THEN
        RETURN QUERY
        SELECT
          mv.category_id::INT AS option_id,
          mv.category_name::TEXT AS option_name,
          SUM(mv.app_count)::BIGINT AS app_count
        FROM mv_category_counts mv
        GROUP BY mv.category_id, mv.category_name
        ORDER BY app_count DESC, option_name;
      ELSE
        RETURN QUERY
        SELECT
          mv.category_id::INT AS option_id,
          mv.category_name::TEXT AS option_name,
          mv.app_count::BIGINT
        FROM mv_category_counts mv
        WHERE mv.app_type = p_type
        ORDER BY mv.app_count DESC, mv.category_name;
      END IF;
    END IF;

  -- ============================================
  -- STEAM DECK
  -- ============================================
  ELSIF p_filter_type = 'steam_deck' THEN
    IF v_has_metric_filters THEN
      RETURN QUERY
      SELECT
        ROW_NUMBER() OVER (ORDER BY asd.steam_deck_category)::INT AS option_id,
        asd.steam_deck_category::TEXT AS option_name,
        COUNT(*)::BIGINT AS app_count
      FROM app_steam_deck asd
      JOIN apps a ON a.appid = asd.appid
      LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
      WHERE a.is_released = TRUE AND a.is_delisted = FALSE
        AND (p_type = 'all' OR a.type::TEXT = p_type)
        AND (p_min_ccu IS NULL OR ldm.ccu_peak >= p_min_ccu)
        AND (p_min_reviews IS NULL OR ldm.total_reviews >= p_min_reviews)
        AND (p_min_score IS NULL OR ldm.review_score >= p_min_score)
        AND (p_min_owners IS NULL OR ldm.owners_midpoint >= p_min_owners)
        AND asd.steam_deck_category IS NOT NULL
      GROUP BY asd.steam_deck_category
      ORDER BY app_count DESC;
    ELSE
      -- FAST PATH: Use materialized view (<10ms)
      IF p_type = 'all' THEN
        RETURN QUERY
        SELECT
          ROW_NUMBER() OVER (ORDER BY mv.steam_deck_category)::INT AS option_id,
          mv.steam_deck_category::TEXT AS option_name,
          SUM(mv.app_count)::BIGINT AS app_count
        FROM mv_steam_deck_counts mv
        GROUP BY mv.steam_deck_category
        ORDER BY app_count DESC;
      ELSE
        RETURN QUERY
        SELECT
          ROW_NUMBER() OVER (ORDER BY mv.steam_deck_category)::INT AS option_id,
          mv.steam_deck_category::TEXT AS option_name,
          mv.app_count::BIGINT
        FROM mv_steam_deck_counts mv
        WHERE mv.app_type = p_type
        ORDER BY mv.app_count DESC;
      END IF;
    END IF;

  -- ============================================
  -- CCU TIER
  -- ============================================
  ELSIF p_filter_type = 'ccu_tier' THEN
    IF v_has_metric_filters THEN
      RETURN QUERY
      SELECT
        ct.ccu_tier::INT AS option_id,
        CASE ct.ccu_tier
          WHEN 1 THEN 'Hot (Tier 1)'
          WHEN 2 THEN 'Active (Tier 2)'
          WHEN 3 THEN 'Quiet (Tier 3)'
        END::TEXT AS option_name,
        COUNT(*)::BIGINT AS app_count
      FROM ccu_tier_assignments ct
      JOIN apps a ON a.appid = ct.appid
      LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
      WHERE a.is_released = TRUE AND a.is_delisted = FALSE
        AND (p_type = 'all' OR a.type::TEXT = p_type)
        AND (p_min_ccu IS NULL OR ldm.ccu_peak >= p_min_ccu)
        AND (p_min_reviews IS NULL OR ldm.total_reviews >= p_min_reviews)
        AND (p_min_score IS NULL OR ldm.review_score >= p_min_score)
        AND (p_min_owners IS NULL OR ldm.owners_midpoint >= p_min_owners)
      GROUP BY ct.ccu_tier
      ORDER BY ct.ccu_tier;
    ELSE
      -- FAST PATH: Use materialized view (<10ms)
      IF p_type = 'all' THEN
        RETURN QUERY
        SELECT
          mv.ccu_tier::INT AS option_id,
          CASE mv.ccu_tier
            WHEN 1 THEN 'Hot (Tier 1)'
            WHEN 2 THEN 'Active (Tier 2)'
            WHEN 3 THEN 'Quiet (Tier 3)'
          END::TEXT AS option_name,
          SUM(mv.app_count)::BIGINT AS app_count
        FROM mv_ccu_tier_counts mv
        GROUP BY mv.ccu_tier
        ORDER BY mv.ccu_tier;
      ELSE
        RETURN QUERY
        SELECT
          mv.ccu_tier::INT AS option_id,
          CASE mv.ccu_tier
            WHEN 1 THEN 'Hot (Tier 1)'
            WHEN 2 THEN 'Active (Tier 2)'
            WHEN 3 THEN 'Quiet (Tier 3)'
          END::TEXT AS option_name,
          mv.app_count::BIGINT
        FROM mv_ccu_tier_counts mv
        WHERE mv.app_type = p_type
        ORDER BY mv.ccu_tier;
      END IF;
    END IF;

  -- ============================================
  -- VELOCITY TIER
  -- ============================================
  ELSIF p_filter_type = 'velocity_tier' THEN
    IF v_has_metric_filters THEN
      RETURN QUERY
      SELECT
        ROW_NUMBER() OVER (ORDER BY
          CASE rvs.velocity_tier
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
            WHEN 'dormant' THEN 4
          END
        )::INT AS option_id,
        rvs.velocity_tier::TEXT AS option_name,
        COUNT(*)::BIGINT AS app_count
      FROM review_velocity_stats rvs
      JOIN apps a ON a.appid = rvs.appid
      LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
      WHERE a.is_released = TRUE AND a.is_delisted = FALSE
        AND (p_type = 'all' OR a.type::TEXT = p_type)
        AND (p_min_ccu IS NULL OR ldm.ccu_peak >= p_min_ccu)
        AND (p_min_reviews IS NULL OR ldm.total_reviews >= p_min_reviews)
        AND (p_min_score IS NULL OR ldm.review_score >= p_min_score)
        AND (p_min_owners IS NULL OR ldm.owners_midpoint >= p_min_owners)
        AND rvs.velocity_tier IS NOT NULL
      GROUP BY rvs.velocity_tier
      ORDER BY
        CASE rvs.velocity_tier
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          WHEN 'dormant' THEN 4
        END;
    ELSE
      -- FAST PATH: Use materialized view (<10ms)
      IF p_type = 'all' THEN
        RETURN QUERY
        SELECT
          ROW_NUMBER() OVER (ORDER BY
            CASE mv.velocity_tier
              WHEN 'high' THEN 1
              WHEN 'medium' THEN 2
              WHEN 'low' THEN 3
              WHEN 'dormant' THEN 4
            END
          )::INT AS option_id,
          mv.velocity_tier::TEXT AS option_name,
          SUM(mv.app_count)::BIGINT AS app_count
        FROM mv_velocity_tier_counts mv
        GROUP BY mv.velocity_tier
        ORDER BY
          CASE mv.velocity_tier
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
            WHEN 'dormant' THEN 4
          END;
      ELSE
        RETURN QUERY
        SELECT
          ROW_NUMBER() OVER (ORDER BY
            CASE mv.velocity_tier
              WHEN 'high' THEN 1
              WHEN 'medium' THEN 2
              WHEN 'low' THEN 3
              WHEN 'dormant' THEN 4
            END
          )::INT AS option_id,
          mv.velocity_tier::TEXT AS option_name,
          mv.app_count::BIGINT
        FROM mv_velocity_tier_counts mv
        WHERE mv.app_type = p_type
        ORDER BY
          CASE mv.velocity_tier
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
            WHEN 'dormant' THEN 4
          END;
      END IF;
    END IF;

  ELSE
    -- Unknown filter type, return empty
    RETURN;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_apps_filter_option_counts IS
  'Optimized filter option counts using materialized views. Fast path (<10ms) when no metric filters, slow path (~4s) with filters. Refresh views via refresh_filter_count_views().';


-- ============================================================================
-- Optimized aggregate stats function using materialized view
-- ============================================================================

CREATE OR REPLACE FUNCTION get_apps_aggregate_stats(
  p_type TEXT DEFAULT 'game',
  p_search TEXT DEFAULT NULL,
  p_min_ccu INT DEFAULT NULL,
  p_max_ccu INT DEFAULT NULL,
  p_min_owners BIGINT DEFAULT NULL,
  p_max_owners BIGINT DEFAULT NULL,
  p_min_reviews INT DEFAULT NULL,
  p_max_reviews INT DEFAULT NULL,
  p_min_score INT DEFAULT NULL,
  p_max_score INT DEFAULT NULL,
  p_min_price INT DEFAULT NULL,
  p_max_price INT DEFAULT NULL,
  p_min_growth_7d DECIMAL DEFAULT NULL,
  p_max_growth_7d DECIMAL DEFAULT NULL,
  p_genres INT[] DEFAULT NULL,
  p_tags INT[] DEFAULT NULL,
  p_categories INT[] DEFAULT NULL,
  p_steam_deck TEXT DEFAULT NULL,
  p_ccu_tier INT DEFAULT NULL
)
RETURNS TABLE (
  total_games BIGINT,
  avg_ccu DECIMAL,
  avg_score DECIMAL,
  avg_momentum DECIMAL,
  trending_up_count INT,
  trending_down_count INT,
  sentiment_improving_count INT,
  sentiment_declining_count INT,
  avg_value_score DECIMAL
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_has_filters BOOLEAN;
BEGIN
  -- Check if any filters are applied (besides p_type)
  v_has_filters := (
    p_search IS NOT NULL OR
    p_min_ccu IS NOT NULL OR p_max_ccu IS NOT NULL OR
    p_min_owners IS NOT NULL OR p_max_owners IS NOT NULL OR
    p_min_reviews IS NOT NULL OR p_max_reviews IS NOT NULL OR
    p_min_score IS NOT NULL OR p_max_score IS NOT NULL OR
    p_min_price IS NOT NULL OR p_max_price IS NOT NULL OR
    p_min_growth_7d IS NOT NULL OR p_max_growth_7d IS NOT NULL OR
    p_genres IS NOT NULL OR p_tags IS NOT NULL OR p_categories IS NOT NULL OR
    p_steam_deck IS NOT NULL OR p_ccu_tier IS NOT NULL
  );

  IF NOT v_has_filters THEN
    -- FAST PATH: Use pre-computed materialized view (<10ms)
    IF p_type = 'all' THEN
      RETURN QUERY
      SELECT
        SUM(mv.total_games)::BIGINT,
        ROUND(SUM(mv.avg_ccu * mv.total_games) / NULLIF(SUM(mv.total_games), 0), 0)::DECIMAL,
        ROUND(SUM(mv.avg_score * mv.total_games) / NULLIF(SUM(mv.total_games), 0), 1)::DECIMAL,
        ROUND(SUM(mv.avg_momentum * mv.total_games) / NULLIF(SUM(mv.total_games), 0), 2)::DECIMAL,
        SUM(mv.trending_up_count)::INT,
        SUM(mv.trending_down_count)::INT,
        SUM(mv.sentiment_improving_count)::INT,
        SUM(mv.sentiment_declining_count)::INT,
        ROUND(SUM(mv.avg_value_score * mv.total_games) / NULLIF(SUM(mv.total_games), 0), 2)::DECIMAL
      FROM mv_apps_aggregate_stats mv;
    ELSE
      RETURN QUERY
      SELECT
        mv.total_games,
        mv.avg_ccu,
        mv.avg_score,
        mv.avg_momentum,
        mv.trending_up_count,
        mv.trending_down_count,
        mv.sentiment_improving_count,
        mv.sentiment_declining_count,
        mv.avg_value_score
      FROM mv_apps_aggregate_stats mv
      WHERE mv.app_type = p_type;
    END IF;
  ELSE
    -- SLOW PATH: Compute on-the-fly when filters are applied
    RETURN QUERY
    WITH base_apps AS (
      SELECT
        a.appid,
        COALESCE(ldm.ccu_peak, 0)::INT AS ccu_peak,
        ldm.review_score::INT,
        ct.ccu_growth_7d_percent,
        COALESCE(rvs.velocity_7d, 0) - COALESCE(rvs.velocity_30d, 0) AS velocity_acceleration,
        atr.current_positive_ratio,
        atr.previous_positive_ratio,
        a.is_free,
        ldm.price_cents,
        dm_playtime.average_playtime_forever,
        afd.genre_ids,
        afd.tag_ids,
        afd.category_ids,
        afd.steam_deck_category
      FROM apps a
      INNER JOIN app_filter_data afd ON afd.appid = a.appid
      LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
      LEFT JOIN ccu_tier_assignments ct ON ct.appid = a.appid
      LEFT JOIN review_velocity_stats rvs ON rvs.appid = a.appid
      LEFT JOIN app_trends atr ON atr.appid = a.appid
      LEFT JOIN LATERAL (
        SELECT dm.average_playtime_forever
        FROM daily_metrics dm
        WHERE dm.appid = a.appid
        ORDER BY dm.metric_date DESC
        LIMIT 1
      ) dm_playtime ON true
      WHERE a.is_released = TRUE AND a.is_delisted = FALSE
        AND (p_type = 'all' OR a.type::TEXT = p_type)
        AND (p_search IS NULL OR a.name ILIKE '%' || p_search || '%')
        AND (p_min_ccu IS NULL OR ldm.ccu_peak >= p_min_ccu)
        AND (p_max_ccu IS NULL OR ldm.ccu_peak <= p_max_ccu)
        AND (p_min_owners IS NULL OR ldm.owners_midpoint >= p_min_owners)
        AND (p_max_owners IS NULL OR ldm.owners_midpoint <= p_max_owners)
        AND (p_min_reviews IS NULL OR ldm.total_reviews >= p_min_reviews)
        AND (p_max_reviews IS NULL OR ldm.total_reviews <= p_max_reviews)
        AND (p_min_score IS NULL OR ldm.review_score >= p_min_score)
        AND (p_max_score IS NULL OR ldm.review_score <= p_max_score)
        AND (p_min_price IS NULL OR ldm.price_cents >= p_min_price)
        AND (p_max_price IS NULL OR ldm.price_cents <= p_max_price)
        AND (p_min_growth_7d IS NULL OR ct.ccu_growth_7d_percent >= p_min_growth_7d)
        AND (p_max_growth_7d IS NULL OR ct.ccu_growth_7d_percent <= p_max_growth_7d)
        AND (p_genres IS NULL OR afd.genre_ids && p_genres)
        AND (p_tags IS NULL OR afd.tag_ids && p_tags)
        AND (p_categories IS NULL OR afd.category_ids && p_categories)
        AND (p_steam_deck IS NULL
          OR (p_steam_deck = 'verified' AND afd.steam_deck_category = 'verified')
          OR (p_steam_deck = 'playable' AND afd.steam_deck_category IN ('verified', 'playable'))
          OR (p_steam_deck = 'any' AND afd.steam_deck_category IS NOT NULL)
        )
        AND (p_ccu_tier IS NULL OR ct.ccu_tier = p_ccu_tier)
    ),
    computed AS (
      SELECT
        ba.*,
        CASE
          WHEN ba.ccu_growth_7d_percent IS NOT NULL
          THEN (ba.ccu_growth_7d_percent + COALESCE(ba.velocity_acceleration, 0)) / 2
          ELSE NULL
        END AS momentum_score,
        CASE
          WHEN ba.current_positive_ratio IS NOT NULL AND ba.previous_positive_ratio IS NOT NULL
          THEN (ba.current_positive_ratio - ba.previous_positive_ratio) * 100
          ELSE NULL
        END AS sentiment_delta,
        CASE
          WHEN ba.is_free OR ba.price_cents IS NULL OR ba.price_cents = 0 THEN NULL
          WHEN ba.average_playtime_forever IS NULL OR ba.average_playtime_forever = 0 THEN NULL
          ELSE (ba.average_playtime_forever::DECIMAL / 60) / (ba.price_cents::DECIMAL / 100)
        END AS value_score
      FROM base_apps ba
    )
    SELECT
      COUNT(*)::BIGINT AS total_games,
      ROUND(AVG(c.ccu_peak), 0)::DECIMAL AS avg_ccu,
      ROUND(AVG(c.review_score), 1)::DECIMAL AS avg_score,
      ROUND(AVG(c.momentum_score), 2)::DECIMAL AS avg_momentum,
      COUNT(*) FILTER (WHERE c.ccu_growth_7d_percent >= 10)::INT AS trending_up_count,
      COUNT(*) FILTER (WHERE c.ccu_growth_7d_percent <= -10)::INT AS trending_down_count,
      COUNT(*) FILTER (WHERE c.sentiment_delta >= 3)::INT AS sentiment_improving_count,
      COUNT(*) FILTER (WHERE c.sentiment_delta <= -3)::INT AS sentiment_declining_count,
      ROUND(AVG(c.value_score), 2)::DECIMAL AS avg_value_score
    FROM computed c;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_apps_aggregate_stats IS
  'Optimized aggregate stats using materialized view. Fast path (<10ms) when no filters, slow path (~4s) with filters.';
