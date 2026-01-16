-- =============================================================================
-- Migration: Apps Page RPC Bug Fixes & Performance Optimizations
-- Fixes:
--   BUG-006: Workshop "No Workshop" filter (FALSE case not handled)
--   BUG-007: Early Access "Released" filter (FALSE case not handled)
--   PERF-001: Replace N+1 publisher/developer subqueries with LATERAL JOINs
--   PERF-002: Add trigram index for text search performance
-- =============================================================================

-- ============================================================================
-- PERF-002: Add trigram index for faster text search
-- ============================================================================

-- Enable pg_trgm extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index for trigram-based name search
-- This dramatically speeds up ILIKE '%search%' queries
CREATE INDEX IF NOT EXISTS idx_apps_name_trgm ON apps USING gin(name gin_trgm_ops);

COMMENT ON INDEX idx_apps_name_trgm IS 'Trigram index for fast ILIKE text search on app names';


-- ============================================================================
-- Replace get_apps_with_filters with bug fixes and performance improvements
-- ============================================================================

CREATE OR REPLACE FUNCTION get_apps_with_filters(
  -- Type filter
  p_type TEXT DEFAULT 'game',              -- 'all', 'game', 'dlc', 'demo'
  -- Text search
  p_search TEXT DEFAULT NULL,
  -- Metric ranges (min/max)
  p_min_ccu INT DEFAULT NULL,
  p_max_ccu INT DEFAULT NULL,
  p_min_owners BIGINT DEFAULT NULL,
  p_max_owners BIGINT DEFAULT NULL,
  p_min_reviews INT DEFAULT NULL,
  p_max_reviews INT DEFAULT NULL,
  p_min_score INT DEFAULT NULL,
  p_max_score INT DEFAULT NULL,
  p_min_price INT DEFAULT NULL,            -- cents
  p_max_price INT DEFAULT NULL,            -- cents
  p_min_playtime INT DEFAULT NULL,         -- minutes (forever)
  p_max_playtime INT DEFAULT NULL,         -- minutes (forever)
  -- Growth filters
  p_min_growth_7d DECIMAL DEFAULT NULL,
  p_max_growth_7d DECIMAL DEFAULT NULL,
  p_min_growth_30d DECIMAL DEFAULT NULL,
  p_max_growth_30d DECIMAL DEFAULT NULL,
  p_min_momentum DECIMAL DEFAULT NULL,
  p_max_momentum DECIMAL DEFAULT NULL,
  -- Sentiment filters
  p_min_sentiment_delta DECIMAL DEFAULT NULL,
  p_max_sentiment_delta DECIMAL DEFAULT NULL,
  p_velocity_tier TEXT DEFAULT NULL,       -- 'high', 'medium', 'low', 'dormant'
  -- Engagement filters
  p_min_active_pct DECIMAL DEFAULT NULL,
  p_min_review_rate DECIMAL DEFAULT NULL,
  p_min_value_score DECIMAL DEFAULT NULL,
  -- Content filters
  p_genres INT[] DEFAULT NULL,
  p_genre_mode TEXT DEFAULT 'any',         -- 'any' or 'all'
  p_tags INT[] DEFAULT NULL,
  p_tag_mode TEXT DEFAULT 'any',           -- 'any' or 'all'
  p_categories INT[] DEFAULT NULL,
  p_has_workshop BOOLEAN DEFAULT NULL,
  -- Platform filters
  p_platforms TEXT[] DEFAULT NULL,         -- 'windows', 'macos', 'linux'
  p_platform_mode TEXT DEFAULT 'any',      -- 'any' or 'all'
  p_steam_deck TEXT DEFAULT NULL,          -- 'verified', 'playable', 'any'
  p_controller TEXT DEFAULT NULL,          -- 'full', 'partial', 'any'
  -- Release filters
  p_min_age INT DEFAULT NULL,              -- days
  p_max_age INT DEFAULT NULL,              -- days
  p_release_year INT DEFAULT NULL,
  p_early_access BOOLEAN DEFAULT NULL,
  p_min_hype INT DEFAULT NULL,             -- days (hype duration)
  p_max_hype INT DEFAULT NULL,             -- days
  -- Relationship filters
  p_publisher_search TEXT DEFAULT NULL,
  p_developer_search TEXT DEFAULT NULL,
  p_self_published BOOLEAN DEFAULT NULL,
  p_min_vs_publisher DECIMAL DEFAULT NULL,
  p_publisher_size TEXT DEFAULT NULL,      -- 'indie' (<5), 'mid' (5-20), 'major' (20+)
  -- Activity filters
  p_ccu_tier INT DEFAULT NULL,             -- 1, 2, or 3
  -- Sort and pagination
  p_sort_field TEXT DEFAULT 'ccu_peak',
  p_sort_order TEXT DEFAULT 'desc',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  appid INT,
  name TEXT,
  type TEXT,
  is_free BOOLEAN,
  -- Core metrics
  ccu_peak INT,
  owners_min BIGINT,
  owners_max BIGINT,
  owners_midpoint BIGINT,
  total_reviews INT,
  positive_reviews INT,
  review_score INT,
  positive_percentage DECIMAL,
  price_cents INT,
  current_discount_percent INT,
  average_playtime_forever INT,
  average_playtime_2weeks INT,
  -- Growth metrics (pre-computed)
  ccu_growth_7d_percent DECIMAL,
  ccu_growth_30d_percent DECIMAL,
  ccu_tier INT,
  -- Velocity metrics
  velocity_7d DECIMAL,
  velocity_30d DECIMAL,
  velocity_tier TEXT,
  -- Computed metrics
  sentiment_delta DECIMAL,
  momentum_score DECIMAL,
  velocity_acceleration DECIMAL,
  active_player_pct DECIMAL,
  review_rate DECIMAL,
  value_score DECIMAL,
  vs_publisher_avg DECIMAL,
  -- Release info
  release_date DATE,
  days_live INT,
  hype_duration INT,
  release_state TEXT,
  -- Platform info
  platforms TEXT,
  steam_deck_category TEXT,
  controller_support TEXT,
  -- Relationship info
  publisher_id INT,
  publisher_name TEXT,
  publisher_game_count INT,
  developer_id INT,
  developer_name TEXT,
  -- Timestamps
  metric_date DATE,
  data_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_needs_slow_path BOOLEAN;
BEGIN
  -- Slow path needed when filtering/sorting by vs_publisher_avg
  -- (requires expensive JOIN to publisher_metrics)
  v_needs_slow_path := (p_min_vs_publisher IS NOT NULL OR p_sort_field = 'vs_publisher_avg');

  IF NOT v_needs_slow_path THEN
    -- FAST PATH: Skip publisher_metrics JOIN, return NULL for vs_publisher_avg
    -- PERF-001: Uses LATERAL JOINs instead of N+1 subqueries
    RETURN QUERY
    WITH base_apps AS (
      SELECT
        a.appid,
        a.name,
        a.type::TEXT,
        a.is_free,
        COALESCE(ldm.ccu_peak, 0)::INT AS ccu_peak,
        COALESCE(ldm.owners_min, 0)::BIGINT AS owners_min,
        COALESCE(ldm.owners_max, 0)::BIGINT AS owners_max,
        COALESCE(ldm.owners_midpoint, 0)::BIGINT AS owners_midpoint,
        COALESCE(ldm.total_reviews, 0)::INT AS total_reviews,
        COALESCE(ldm.positive_reviews, 0)::INT AS positive_reviews,
        ldm.review_score::INT,
        ldm.positive_percentage::DECIMAL,
        ldm.price_cents::INT,
        COALESCE(a.current_discount_percent, 0)::INT AS current_discount_percent,
        dm_playtime.average_playtime_forever::INT,
        dm_playtime.average_playtime_2weeks::INT,
        -- Growth (pre-computed)
        ct.ccu_growth_7d_percent::DECIMAL,
        ct.ccu_growth_30d_percent::DECIMAL,
        ct.ccu_tier::INT,
        -- Velocity
        COALESCE(rvs.velocity_7d, 0)::DECIMAL AS velocity_7d,
        COALESCE(rvs.velocity_30d, 0)::DECIMAL AS velocity_30d,
        rvs.velocity_tier::TEXT,
        -- Sentiment (for sentiment_delta calc)
        atr.current_positive_ratio,
        atr.previous_positive_ratio,
        -- Release info
        a.release_date,
        a.release_state,
        -- Platform info
        a.platforms,
        asd.category::TEXT AS steam_deck_category,
        a.controller_support,
        -- Timestamps
        ldm.metric_date,
        ct.updated_at AS data_updated_at,
        -- Store asset mtime for hype duration
        a.store_asset_mtime,
        -- PERF-001: Publisher info via LATERAL JOIN (replaces 3 correlated subqueries)
        pub_data.publisher_id,
        pub_data.publisher_name,
        pub_data.publisher_game_count,
        -- PERF-001: Developer info via LATERAL JOIN (replaces 2 correlated subqueries)
        dev_data.developer_id,
        dev_data.developer_name
      FROM apps a
      LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
      LEFT JOIN ccu_tier_assignments ct ON ct.appid = a.appid
      LEFT JOIN review_velocity_stats rvs ON rvs.appid = a.appid
      LEFT JOIN app_trends atr ON atr.appid = a.appid
      LEFT JOIN app_steam_deck asd ON asd.appid = a.appid
      LEFT JOIN LATERAL (
        SELECT dm.average_playtime_forever, dm.average_playtime_2weeks
        FROM daily_metrics dm
        WHERE dm.appid = a.appid
        ORDER BY dm.metric_date DESC
        LIMIT 1
      ) dm_playtime ON true
      -- PERF-001: Single LATERAL JOIN for publisher data (replaces 3 subqueries)
      LEFT JOIN LATERAL (
        SELECT
          ap.publisher_id,
          p.name AS publisher_name,
          p.game_count AS publisher_game_count
        FROM app_publishers ap
        JOIN publishers p ON p.id = ap.publisher_id
        WHERE ap.appid = a.appid
        LIMIT 1
      ) pub_data ON true
      -- PERF-001: Single LATERAL JOIN for developer data (replaces 2 subqueries)
      LEFT JOIN LATERAL (
        SELECT
          ad.developer_id,
          d.name AS developer_name
        FROM app_developers ad
        JOIN developers d ON d.id = ad.developer_id
        WHERE ad.appid = a.appid
        LIMIT 1
      ) dev_data ON true
      WHERE a.is_released = TRUE AND a.is_delisted = FALSE
        AND (p_type = 'all' OR a.type::TEXT = p_type)
    ),
    computed AS (
      SELECT
        ba.*,
        -- Sentiment delta
        CASE
          WHEN ba.current_positive_ratio IS NOT NULL AND ba.previous_positive_ratio IS NOT NULL
          THEN ROUND((ba.current_positive_ratio - ba.previous_positive_ratio) * 100, 2)
          ELSE NULL
        END AS sentiment_delta,
        -- Velocity acceleration
        CASE
          WHEN ba.velocity_7d IS NOT NULL AND ba.velocity_30d IS NOT NULL
          THEN ROUND(ba.velocity_7d - ba.velocity_30d, 4)
          ELSE NULL
        END AS velocity_acceleration,
        -- Momentum score: (growth_7d + velocity_acceleration) / 2
        CASE
          WHEN ba.ccu_growth_7d_percent IS NOT NULL
          THEN ROUND((ba.ccu_growth_7d_percent + COALESCE(ba.velocity_7d - ba.velocity_30d, 0)) / 2, 2)
          ELSE NULL
        END AS momentum_score,
        -- Active player percentage
        CASE
          WHEN ba.owners_midpoint IS NULL OR ba.owners_midpoint = 0 THEN NULL
          ELSE ROUND((ba.ccu_peak::DECIMAL / ba.owners_midpoint) * 100, 2)
        END AS active_player_pct,
        -- Review rate (per 1K owners)
        CASE
          WHEN ba.owners_midpoint IS NULL OR ba.owners_midpoint = 0 THEN NULL
          ELSE ROUND((ba.total_reviews::DECIMAL / ba.owners_midpoint) * 1000, 2)
        END AS review_rate,
        -- Value score (hours per dollar) - NULL for free games
        CASE
          WHEN ba.is_free OR ba.price_cents IS NULL OR ba.price_cents = 0 THEN NULL
          WHEN ba.average_playtime_forever IS NULL OR ba.average_playtime_forever = 0 THEN NULL
          ELSE ROUND((ba.average_playtime_forever::DECIMAL / 60) / (ba.price_cents::DECIMAL / 100), 2)
        END AS value_score,
        -- Days live (DATE - DATE returns integer days in PostgreSQL)
        CASE
          WHEN ba.release_date IS NOT NULL
          THEN (CURRENT_DATE - ba.release_date)::INT
          ELSE NULL
        END AS days_live,
        -- Hype duration
        CASE
          WHEN ba.release_date IS NOT NULL AND ba.store_asset_mtime IS NOT NULL
          THEN (ba.release_date - ba.store_asset_mtime::DATE)::INT
          ELSE NULL
        END AS hype_duration
      FROM base_apps ba
    ),
    filtered AS (
      SELECT c.*
      FROM computed c
      WHERE
        -- Text search
        (p_search IS NULL OR c.name ILIKE '%' || p_search || '%')
        -- Metric ranges
        AND (p_min_ccu IS NULL OR c.ccu_peak >= p_min_ccu)
        AND (p_max_ccu IS NULL OR c.ccu_peak <= p_max_ccu)
        AND (p_min_owners IS NULL OR c.owners_midpoint >= p_min_owners)
        AND (p_max_owners IS NULL OR c.owners_midpoint <= p_max_owners)
        AND (p_min_reviews IS NULL OR c.total_reviews >= p_min_reviews)
        AND (p_max_reviews IS NULL OR c.total_reviews <= p_max_reviews)
        AND (p_min_score IS NULL OR c.review_score >= p_min_score)
        AND (p_max_score IS NULL OR c.review_score <= p_max_score)
        AND (p_min_price IS NULL OR c.price_cents >= p_min_price)
        AND (p_max_price IS NULL OR c.price_cents <= p_max_price)
        AND (p_min_playtime IS NULL OR c.average_playtime_forever >= p_min_playtime)
        AND (p_max_playtime IS NULL OR c.average_playtime_forever <= p_max_playtime)
        -- Growth filters
        AND (p_min_growth_7d IS NULL OR c.ccu_growth_7d_percent >= p_min_growth_7d)
        AND (p_max_growth_7d IS NULL OR c.ccu_growth_7d_percent <= p_max_growth_7d)
        AND (p_min_growth_30d IS NULL OR c.ccu_growth_30d_percent >= p_min_growth_30d)
        AND (p_max_growth_30d IS NULL OR c.ccu_growth_30d_percent <= p_max_growth_30d)
        AND (p_min_momentum IS NULL OR c.momentum_score >= p_min_momentum)
        AND (p_max_momentum IS NULL OR c.momentum_score <= p_max_momentum)
        -- Sentiment filters
        AND (p_min_sentiment_delta IS NULL OR c.sentiment_delta >= p_min_sentiment_delta)
        AND (p_max_sentiment_delta IS NULL OR c.sentiment_delta <= p_max_sentiment_delta)
        AND (p_velocity_tier IS NULL OR c.velocity_tier = p_velocity_tier)
        -- Engagement filters
        AND (p_min_active_pct IS NULL OR c.active_player_pct >= p_min_active_pct)
        AND (p_min_review_rate IS NULL OR c.review_rate >= p_min_review_rate)
        AND (p_min_value_score IS NULL OR c.value_score >= p_min_value_score)
        -- Content filters
        AND (p_genres IS NULL OR EXISTS (
          SELECT 1 FROM app_genres ag
          WHERE ag.appid = c.appid
          AND (p_genre_mode = 'any' AND ag.genre_id = ANY(p_genres)
               OR p_genre_mode = 'all' AND NOT EXISTS (
                 SELECT 1 FROM unnest(p_genres) g WHERE NOT EXISTS (
                   SELECT 1 FROM app_genres ag2 WHERE ag2.appid = c.appid AND ag2.genre_id = g
                 )
               ))
        ))
        AND (p_tags IS NULL OR EXISTS (
          SELECT 1 FROM app_steam_tags ast
          WHERE ast.appid = c.appid
          AND (p_tag_mode = 'any' AND ast.tag_id = ANY(p_tags)
               OR p_tag_mode = 'all' AND NOT EXISTS (
                 SELECT 1 FROM unnest(p_tags) t WHERE NOT EXISTS (
                   SELECT 1 FROM app_steam_tags ast2 WHERE ast2.appid = c.appid AND ast2.tag_id = t
                 )
               ))
        ))
        AND (p_categories IS NULL OR EXISTS (
          SELECT 1 FROM app_categories ac
          WHERE ac.appid = c.appid AND ac.category_id = ANY(p_categories)
        ))
        -- BUG-006: Fix Workshop filter to handle both TRUE and FALSE
        AND (p_has_workshop IS NULL
             OR (p_has_workshop = TRUE AND EXISTS (
               SELECT 1 FROM app_categories ac WHERE ac.appid = c.appid AND ac.category_id = 30
             ))
             OR (p_has_workshop = FALSE AND NOT EXISTS (
               SELECT 1 FROM app_categories ac WHERE ac.appid = c.appid AND ac.category_id = 30
             ))
        )
        -- Platform filters
        AND (p_platforms IS NULL OR (
          p_platform_mode = 'any' AND (
            ('windows' = ANY(p_platforms) AND c.platforms LIKE '%windows%')
            OR ('macos' = ANY(p_platforms) AND c.platforms LIKE '%macos%')
            OR ('linux' = ANY(p_platforms) AND c.platforms LIKE '%linux%')
          )
          OR p_platform_mode = 'all' AND (
            (NOT 'windows' = ANY(p_platforms) OR c.platforms LIKE '%windows%')
            AND (NOT 'macos' = ANY(p_platforms) OR c.platforms LIKE '%macos%')
            AND (NOT 'linux' = ANY(p_platforms) OR c.platforms LIKE '%linux%')
          )
        ))
        AND (p_steam_deck IS NULL
             OR (p_steam_deck = 'verified' AND c.steam_deck_category = 'verified')
             OR (p_steam_deck = 'playable' AND c.steam_deck_category IN ('verified', 'playable'))
             OR (p_steam_deck = 'any' AND c.steam_deck_category IS NOT NULL))
        AND (p_controller IS NULL
             OR (p_controller = 'full' AND c.controller_support = 'full')
             OR (p_controller = 'partial' AND c.controller_support IN ('full', 'partial'))
             OR (p_controller = 'any' AND c.controller_support IS NOT NULL))
        -- Release filters
        AND (p_min_age IS NULL OR c.days_live >= p_min_age)
        AND (p_max_age IS NULL OR c.days_live <= p_max_age)
        AND (p_release_year IS NULL OR EXTRACT(YEAR FROM c.release_date) = p_release_year)
        -- BUG-007: Fix Early Access filter to handle both TRUE and FALSE
        AND (p_early_access IS NULL
             OR (p_early_access = TRUE AND c.release_state = 'prerelease')
             OR (p_early_access = FALSE AND c.release_state != 'prerelease')
        )
        AND (p_min_hype IS NULL OR c.hype_duration >= p_min_hype)
        AND (p_max_hype IS NULL OR c.hype_duration <= p_max_hype)
        -- Relationship filters
        AND (p_publisher_search IS NULL OR c.publisher_name ILIKE '%' || p_publisher_search || '%')
        AND (p_developer_search IS NULL OR c.developer_name ILIKE '%' || p_developer_search || '%')
        AND (p_self_published IS NULL OR (p_self_published = TRUE AND LOWER(TRIM(c.publisher_name)) = LOWER(TRIM(c.developer_name))))
        AND (p_publisher_size IS NULL
             OR (p_publisher_size = 'indie' AND c.publisher_game_count < 5)
             OR (p_publisher_size = 'mid' AND c.publisher_game_count >= 5 AND c.publisher_game_count < 20)
             OR (p_publisher_size = 'major' AND c.publisher_game_count >= 20))
        -- Activity filters
        AND (p_ccu_tier IS NULL OR c.ccu_tier = p_ccu_tier)
    ),
    sorted AS (
      SELECT f.*
      FROM filtered f
      ORDER BY
        CASE WHEN p_sort_order = 'desc' THEN
          CASE p_sort_field
            WHEN 'ccu_peak' THEN f.ccu_peak
            WHEN 'owners_midpoint' THEN f.owners_midpoint
            WHEN 'total_reviews' THEN f.total_reviews
            WHEN 'review_score' THEN f.review_score
            WHEN 'price_cents' THEN f.price_cents
            WHEN 'ccu_growth_7d_percent' THEN f.ccu_growth_7d_percent
            WHEN 'ccu_growth_30d_percent' THEN f.ccu_growth_30d_percent
            WHEN 'momentum_score' THEN f.momentum_score
            WHEN 'sentiment_delta' THEN f.sentiment_delta
            WHEN 'velocity_7d' THEN f.velocity_7d
            WHEN 'active_player_pct' THEN f.active_player_pct
            WHEN 'review_rate' THEN f.review_rate
            WHEN 'value_score' THEN f.value_score
            WHEN 'days_live' THEN f.days_live
            ELSE f.ccu_peak
          END
        END DESC NULLS LAST,
        CASE WHEN p_sort_order = 'asc' THEN
          CASE p_sort_field
            WHEN 'ccu_peak' THEN f.ccu_peak
            WHEN 'owners_midpoint' THEN f.owners_midpoint
            WHEN 'total_reviews' THEN f.total_reviews
            WHEN 'review_score' THEN f.review_score
            WHEN 'price_cents' THEN f.price_cents
            WHEN 'ccu_growth_7d_percent' THEN f.ccu_growth_7d_percent
            WHEN 'ccu_growth_30d_percent' THEN f.ccu_growth_30d_percent
            WHEN 'momentum_score' THEN f.momentum_score
            WHEN 'sentiment_delta' THEN f.sentiment_delta
            WHEN 'velocity_7d' THEN f.velocity_7d
            WHEN 'active_player_pct' THEN f.active_player_pct
            WHEN 'review_rate' THEN f.review_rate
            WHEN 'value_score' THEN f.value_score
            WHEN 'days_live' THEN f.days_live
            ELSE f.ccu_peak
          END
        END ASC NULLS LAST,
        -- Secondary sort for release_date
        CASE WHEN p_sort_field = 'release_date' AND p_sort_order = 'desc' THEN f.release_date END DESC NULLS LAST,
        CASE WHEN p_sort_field = 'release_date' AND p_sort_order = 'asc' THEN f.release_date END ASC NULLS LAST,
        -- Tertiary sort by name
        f.name ASC
      LIMIT p_limit OFFSET p_offset
    )
    SELECT
      s.appid,
      s.name,
      s.type,
      s.is_free,
      s.ccu_peak,
      s.owners_min,
      s.owners_max,
      s.owners_midpoint,
      s.total_reviews,
      s.positive_reviews,
      s.review_score,
      s.positive_percentage,
      s.price_cents,
      s.current_discount_percent,
      s.average_playtime_forever,
      s.average_playtime_2weeks,
      s.ccu_growth_7d_percent,
      s.ccu_growth_30d_percent,
      s.ccu_tier,
      s.velocity_7d,
      s.velocity_30d,
      s.velocity_tier,
      s.sentiment_delta,
      s.momentum_score,
      s.velocity_acceleration,
      s.active_player_pct,
      s.review_rate,
      s.value_score,
      NULL::DECIMAL AS vs_publisher_avg,  -- Not computed in fast path
      s.release_date,
      s.days_live,
      s.hype_duration,
      s.release_state,
      s.platforms,
      s.steam_deck_category,
      s.controller_support,
      s.publisher_id,
      s.publisher_name,
      s.publisher_game_count,
      s.developer_id,
      s.developer_name,
      s.metric_date,
      s.data_updated_at
    FROM sorted s;

  ELSE
    -- SLOW PATH: Compute vs_publisher_avg
    -- PERF-001: Uses efficient JOINs (already optimized in original)
    RETURN QUERY
    WITH base_apps AS (
      SELECT
        a.appid,
        a.name,
        a.type::TEXT,
        a.is_free,
        COALESCE(ldm.ccu_peak, 0)::INT AS ccu_peak,
        COALESCE(ldm.owners_min, 0)::BIGINT AS owners_min,
        COALESCE(ldm.owners_max, 0)::BIGINT AS owners_max,
        COALESCE(ldm.owners_midpoint, 0)::BIGINT AS owners_midpoint,
        COALESCE(ldm.total_reviews, 0)::INT AS total_reviews,
        COALESCE(ldm.positive_reviews, 0)::INT AS positive_reviews,
        ldm.review_score::INT,
        ldm.positive_percentage::DECIMAL,
        ldm.price_cents::INT,
        COALESCE(a.current_discount_percent, 0)::INT AS current_discount_percent,
        dm_playtime.average_playtime_forever::INT,
        dm_playtime.average_playtime_2weeks::INT,
        ct.ccu_growth_7d_percent::DECIMAL,
        ct.ccu_growth_30d_percent::DECIMAL,
        ct.ccu_tier::INT,
        COALESCE(rvs.velocity_7d, 0)::DECIMAL AS velocity_7d,
        COALESCE(rvs.velocity_30d, 0)::DECIMAL AS velocity_30d,
        rvs.velocity_tier::TEXT,
        atr.current_positive_ratio,
        atr.previous_positive_ratio,
        a.release_date,
        a.release_state,
        a.platforms,
        asd.category::TEXT AS steam_deck_category,
        a.controller_support,
        ldm.metric_date,
        ct.updated_at AS data_updated_at,
        a.store_asset_mtime,
        -- Publisher info
        ap.publisher_id,
        pub.name AS publisher_name,
        pub.game_count AS publisher_game_count,
        pm.avg_review_score AS publisher_avg_score,
        -- Developer info
        ad.developer_id,
        dev.name AS developer_name
      FROM apps a
      LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
      LEFT JOIN ccu_tier_assignments ct ON ct.appid = a.appid
      LEFT JOIN review_velocity_stats rvs ON rvs.appid = a.appid
      LEFT JOIN app_trends atr ON atr.appid = a.appid
      LEFT JOIN app_steam_deck asd ON asd.appid = a.appid
      LEFT JOIN LATERAL (
        SELECT dm.average_playtime_forever, dm.average_playtime_2weeks
        FROM daily_metrics dm WHERE dm.appid = a.appid ORDER BY dm.metric_date DESC LIMIT 1
      ) dm_playtime ON true
      -- Publisher JOIN for vs_publisher_avg
      LEFT JOIN LATERAL (
        SELECT ap2.publisher_id FROM app_publishers ap2 WHERE ap2.appid = a.appid LIMIT 1
      ) ap ON true
      LEFT JOIN publishers pub ON pub.id = ap.publisher_id
      LEFT JOIN publisher_metrics pm ON pm.publisher_id = ap.publisher_id
      -- Developer JOIN
      LEFT JOIN LATERAL (
        SELECT ad2.developer_id FROM app_developers ad2 WHERE ad2.appid = a.appid LIMIT 1
      ) ad ON true
      LEFT JOIN developers dev ON dev.id = ad.developer_id
      WHERE a.is_released = TRUE AND a.is_delisted = FALSE
        AND (p_type = 'all' OR a.type::TEXT = p_type)
    ),
    computed AS (
      SELECT
        ba.*,
        CASE
          WHEN ba.current_positive_ratio IS NOT NULL AND ba.previous_positive_ratio IS NOT NULL
          THEN ROUND((ba.current_positive_ratio - ba.previous_positive_ratio) * 100, 2)
          ELSE NULL
        END AS sentiment_delta,
        CASE
          WHEN ba.velocity_7d IS NOT NULL AND ba.velocity_30d IS NOT NULL
          THEN ROUND(ba.velocity_7d - ba.velocity_30d, 4)
          ELSE NULL
        END AS velocity_acceleration,
        CASE
          WHEN ba.ccu_growth_7d_percent IS NOT NULL
          THEN ROUND((ba.ccu_growth_7d_percent + COALESCE(ba.velocity_7d - ba.velocity_30d, 0)) / 2, 2)
          ELSE NULL
        END AS momentum_score,
        CASE
          WHEN ba.owners_midpoint IS NULL OR ba.owners_midpoint = 0 THEN NULL
          ELSE ROUND((ba.ccu_peak::DECIMAL / ba.owners_midpoint) * 100, 2)
        END AS active_player_pct,
        CASE
          WHEN ba.owners_midpoint IS NULL OR ba.owners_midpoint = 0 THEN NULL
          ELSE ROUND((ba.total_reviews::DECIMAL / ba.owners_midpoint) * 1000, 2)
        END AS review_rate,
        CASE
          WHEN ba.is_free OR ba.price_cents IS NULL OR ba.price_cents = 0 THEN NULL
          WHEN ba.average_playtime_forever IS NULL OR ba.average_playtime_forever = 0 THEN NULL
          ELSE ROUND((ba.average_playtime_forever::DECIMAL / 60) / (ba.price_cents::DECIMAL / 100), 2)
        END AS value_score,
        -- vs_publisher_avg: game score - publisher avg score
        CASE
          WHEN ba.review_score IS NOT NULL AND ba.publisher_avg_score IS NOT NULL
          THEN (ba.review_score - ba.publisher_avg_score)::DECIMAL
          ELSE NULL
        END AS vs_publisher_avg,
        CASE
          WHEN ba.release_date IS NOT NULL
          THEN (CURRENT_DATE - ba.release_date)::INT
          ELSE NULL
        END AS days_live,
        CASE
          WHEN ba.release_date IS NOT NULL AND ba.store_asset_mtime IS NOT NULL
          THEN (ba.release_date - ba.store_asset_mtime::DATE)::INT
          ELSE NULL
        END AS hype_duration
      FROM base_apps ba
    ),
    filtered AS (
      SELECT c.*
      FROM computed c
      WHERE
        (p_search IS NULL OR c.name ILIKE '%' || p_search || '%')
        AND (p_min_ccu IS NULL OR c.ccu_peak >= p_min_ccu)
        AND (p_max_ccu IS NULL OR c.ccu_peak <= p_max_ccu)
        AND (p_min_owners IS NULL OR c.owners_midpoint >= p_min_owners)
        AND (p_max_owners IS NULL OR c.owners_midpoint <= p_max_owners)
        AND (p_min_reviews IS NULL OR c.total_reviews >= p_min_reviews)
        AND (p_max_reviews IS NULL OR c.total_reviews <= p_max_reviews)
        AND (p_min_score IS NULL OR c.review_score >= p_min_score)
        AND (p_max_score IS NULL OR c.review_score <= p_max_score)
        AND (p_min_price IS NULL OR c.price_cents >= p_min_price)
        AND (p_max_price IS NULL OR c.price_cents <= p_max_price)
        AND (p_min_playtime IS NULL OR c.average_playtime_forever >= p_min_playtime)
        AND (p_max_playtime IS NULL OR c.average_playtime_forever <= p_max_playtime)
        AND (p_min_growth_7d IS NULL OR c.ccu_growth_7d_percent >= p_min_growth_7d)
        AND (p_max_growth_7d IS NULL OR c.ccu_growth_7d_percent <= p_max_growth_7d)
        AND (p_min_growth_30d IS NULL OR c.ccu_growth_30d_percent >= p_min_growth_30d)
        AND (p_max_growth_30d IS NULL OR c.ccu_growth_30d_percent <= p_max_growth_30d)
        AND (p_min_momentum IS NULL OR c.momentum_score >= p_min_momentum)
        AND (p_max_momentum IS NULL OR c.momentum_score <= p_max_momentum)
        AND (p_min_sentiment_delta IS NULL OR c.sentiment_delta >= p_min_sentiment_delta)
        AND (p_max_sentiment_delta IS NULL OR c.sentiment_delta <= p_max_sentiment_delta)
        AND (p_velocity_tier IS NULL OR c.velocity_tier = p_velocity_tier)
        AND (p_min_active_pct IS NULL OR c.active_player_pct >= p_min_active_pct)
        AND (p_min_review_rate IS NULL OR c.review_rate >= p_min_review_rate)
        AND (p_min_value_score IS NULL OR c.value_score >= p_min_value_score)
        -- vs_publisher filter (slow path only)
        AND (p_min_vs_publisher IS NULL OR c.vs_publisher_avg >= p_min_vs_publisher)
        -- Content filters
        AND (p_genres IS NULL OR EXISTS (
          SELECT 1 FROM app_genres ag WHERE ag.appid = c.appid
          AND (p_genre_mode = 'any' AND ag.genre_id = ANY(p_genres)
               OR p_genre_mode = 'all' AND NOT EXISTS (
                 SELECT 1 FROM unnest(p_genres) g WHERE NOT EXISTS (
                   SELECT 1 FROM app_genres ag2 WHERE ag2.appid = c.appid AND ag2.genre_id = g
                 )
               ))
        ))
        AND (p_tags IS NULL OR EXISTS (
          SELECT 1 FROM app_steam_tags ast WHERE ast.appid = c.appid
          AND (p_tag_mode = 'any' AND ast.tag_id = ANY(p_tags)
               OR p_tag_mode = 'all' AND NOT EXISTS (
                 SELECT 1 FROM unnest(p_tags) t WHERE NOT EXISTS (
                   SELECT 1 FROM app_steam_tags ast2 WHERE ast2.appid = c.appid AND ast2.tag_id = t
                 )
               ))
        ))
        AND (p_categories IS NULL OR EXISTS (
          SELECT 1 FROM app_categories ac WHERE ac.appid = c.appid AND ac.category_id = ANY(p_categories)
        ))
        -- BUG-006: Fix Workshop filter to handle both TRUE and FALSE
        AND (p_has_workshop IS NULL
             OR (p_has_workshop = TRUE AND EXISTS (
               SELECT 1 FROM app_categories ac WHERE ac.appid = c.appid AND ac.category_id = 30
             ))
             OR (p_has_workshop = FALSE AND NOT EXISTS (
               SELECT 1 FROM app_categories ac WHERE ac.appid = c.appid AND ac.category_id = 30
             ))
        )
        AND (p_platforms IS NULL OR (
          p_platform_mode = 'any' AND (
            ('windows' = ANY(p_platforms) AND c.platforms LIKE '%windows%')
            OR ('macos' = ANY(p_platforms) AND c.platforms LIKE '%macos%')
            OR ('linux' = ANY(p_platforms) AND c.platforms LIKE '%linux%')
          )
          OR p_platform_mode = 'all' AND (
            (NOT 'windows' = ANY(p_platforms) OR c.platforms LIKE '%windows%')
            AND (NOT 'macos' = ANY(p_platforms) OR c.platforms LIKE '%macos%')
            AND (NOT 'linux' = ANY(p_platforms) OR c.platforms LIKE '%linux%')
          )
        ))
        AND (p_steam_deck IS NULL
             OR (p_steam_deck = 'verified' AND c.steam_deck_category = 'verified')
             OR (p_steam_deck = 'playable' AND c.steam_deck_category IN ('verified', 'playable'))
             OR (p_steam_deck = 'any' AND c.steam_deck_category IS NOT NULL))
        AND (p_controller IS NULL
             OR (p_controller = 'full' AND c.controller_support = 'full')
             OR (p_controller = 'partial' AND c.controller_support IN ('full', 'partial'))
             OR (p_controller = 'any' AND c.controller_support IS NOT NULL))
        AND (p_min_age IS NULL OR c.days_live >= p_min_age)
        AND (p_max_age IS NULL OR c.days_live <= p_max_age)
        AND (p_release_year IS NULL OR EXTRACT(YEAR FROM c.release_date) = p_release_year)
        -- BUG-007: Fix Early Access filter to handle both TRUE and FALSE
        AND (p_early_access IS NULL
             OR (p_early_access = TRUE AND c.release_state = 'prerelease')
             OR (p_early_access = FALSE AND c.release_state != 'prerelease')
        )
        AND (p_min_hype IS NULL OR c.hype_duration >= p_min_hype)
        AND (p_max_hype IS NULL OR c.hype_duration <= p_max_hype)
        AND (p_publisher_search IS NULL OR c.publisher_name ILIKE '%' || p_publisher_search || '%')
        AND (p_developer_search IS NULL OR c.developer_name ILIKE '%' || p_developer_search || '%')
        AND (p_self_published IS NULL OR (p_self_published = TRUE AND LOWER(TRIM(c.publisher_name)) = LOWER(TRIM(c.developer_name))))
        AND (p_publisher_size IS NULL
             OR (p_publisher_size = 'indie' AND c.publisher_game_count < 5)
             OR (p_publisher_size = 'mid' AND c.publisher_game_count >= 5 AND c.publisher_game_count < 20)
             OR (p_publisher_size = 'major' AND c.publisher_game_count >= 20))
        AND (p_ccu_tier IS NULL OR c.ccu_tier = p_ccu_tier)
    ),
    sorted AS (
      SELECT f.*
      FROM filtered f
      ORDER BY
        CASE WHEN p_sort_order = 'desc' THEN
          CASE p_sort_field
            WHEN 'ccu_peak' THEN f.ccu_peak
            WHEN 'owners_midpoint' THEN f.owners_midpoint
            WHEN 'total_reviews' THEN f.total_reviews
            WHEN 'review_score' THEN f.review_score
            WHEN 'price_cents' THEN f.price_cents
            WHEN 'ccu_growth_7d_percent' THEN f.ccu_growth_7d_percent
            WHEN 'ccu_growth_30d_percent' THEN f.ccu_growth_30d_percent
            WHEN 'momentum_score' THEN f.momentum_score
            WHEN 'sentiment_delta' THEN f.sentiment_delta
            WHEN 'velocity_7d' THEN f.velocity_7d
            WHEN 'active_player_pct' THEN f.active_player_pct
            WHEN 'review_rate' THEN f.review_rate
            WHEN 'value_score' THEN f.value_score
            WHEN 'vs_publisher_avg' THEN f.vs_publisher_avg
            WHEN 'days_live' THEN f.days_live
            ELSE f.ccu_peak
          END
        END DESC NULLS LAST,
        CASE WHEN p_sort_order = 'asc' THEN
          CASE p_sort_field
            WHEN 'ccu_peak' THEN f.ccu_peak
            WHEN 'owners_midpoint' THEN f.owners_midpoint
            WHEN 'total_reviews' THEN f.total_reviews
            WHEN 'review_score' THEN f.review_score
            WHEN 'price_cents' THEN f.price_cents
            WHEN 'ccu_growth_7d_percent' THEN f.ccu_growth_7d_percent
            WHEN 'ccu_growth_30d_percent' THEN f.ccu_growth_30d_percent
            WHEN 'momentum_score' THEN f.momentum_score
            WHEN 'sentiment_delta' THEN f.sentiment_delta
            WHEN 'velocity_7d' THEN f.velocity_7d
            WHEN 'active_player_pct' THEN f.active_player_pct
            WHEN 'review_rate' THEN f.review_rate
            WHEN 'value_score' THEN f.value_score
            WHEN 'vs_publisher_avg' THEN f.vs_publisher_avg
            WHEN 'days_live' THEN f.days_live
            ELSE f.ccu_peak
          END
        END ASC NULLS LAST,
        CASE WHEN p_sort_field = 'release_date' AND p_sort_order = 'desc' THEN f.release_date END DESC NULLS LAST,
        CASE WHEN p_sort_field = 'release_date' AND p_sort_order = 'asc' THEN f.release_date END ASC NULLS LAST,
        f.name ASC
      LIMIT p_limit OFFSET p_offset
    )
    SELECT
      s.appid,
      s.name,
      s.type,
      s.is_free,
      s.ccu_peak,
      s.owners_min,
      s.owners_max,
      s.owners_midpoint,
      s.total_reviews,
      s.positive_reviews,
      s.review_score,
      s.positive_percentage,
      s.price_cents,
      s.current_discount_percent,
      s.average_playtime_forever,
      s.average_playtime_2weeks,
      s.ccu_growth_7d_percent,
      s.ccu_growth_30d_percent,
      s.ccu_tier,
      s.velocity_7d,
      s.velocity_30d,
      s.velocity_tier,
      s.sentiment_delta,
      s.momentum_score,
      s.velocity_acceleration,
      s.active_player_pct,
      s.review_rate,
      s.value_score,
      s.vs_publisher_avg,
      s.release_date,
      s.days_live,
      s.hype_duration,
      s.release_state,
      s.platforms,
      s.steam_deck_category,
      s.controller_support,
      s.publisher_id,
      s.publisher_name,
      s.publisher_game_count,
      s.developer_id,
      s.developer_name,
      s.metric_date,
      s.data_updated_at
    FROM sorted s;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_apps_with_filters IS 'Main query for Apps page with all filters and computed metrics. Uses fast path unless filtering by vs_publisher_avg. Bug fixes: BUG-006 (Workshop FALSE), BUG-007 (Early Access FALSE). Performance: LATERAL JOINs for publisher/developer data.';


-- ============================================================================
-- BUG-005: Expand context filters for get_apps_filter_option_counts
-- Add p_min_score and p_min_owners parameters
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
BEGIN
  IF p_filter_type = 'genre' THEN
    RETURN QUERY
    SELECT
      sg.genre_id::INT AS option_id,
      sg.name::TEXT AS option_name,
      COUNT(DISTINCT ag.appid)::BIGINT AS app_count
    FROM steam_genres sg
    JOIN app_genres ag ON ag.genre_id = sg.genre_id
    JOIN apps a ON a.appid = ag.appid
    LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
    WHERE a.is_released = TRUE AND a.is_delisted = FALSE
      AND (p_type = 'all' OR a.type::TEXT = p_type)
      AND (p_min_ccu IS NULL OR ldm.ccu_peak >= p_min_ccu)
      AND (p_min_reviews IS NULL OR ldm.total_reviews >= p_min_reviews)
      AND (p_min_score IS NULL OR ldm.review_score >= p_min_score)
      AND (p_min_owners IS NULL OR ldm.owners_midpoint >= p_min_owners)
    GROUP BY sg.genre_id, sg.name
    ORDER BY app_count DESC, option_name;

  ELSIF p_filter_type = 'tag' THEN
    RETURN QUERY
    SELECT
      st.tag_id::INT AS option_id,
      st.name::TEXT AS option_name,
      COUNT(DISTINCT ast.appid)::BIGINT AS app_count
    FROM steam_tags st
    JOIN app_steam_tags ast ON ast.tag_id = st.tag_id
    JOIN apps a ON a.appid = ast.appid
    LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
    WHERE a.is_released = TRUE AND a.is_delisted = FALSE
      AND (p_type = 'all' OR a.type::TEXT = p_type)
      AND (p_min_ccu IS NULL OR ldm.ccu_peak >= p_min_ccu)
      AND (p_min_reviews IS NULL OR ldm.total_reviews >= p_min_reviews)
      AND (p_min_score IS NULL OR ldm.review_score >= p_min_score)
      AND (p_min_owners IS NULL OR ldm.owners_midpoint >= p_min_owners)
    GROUP BY st.tag_id, st.name
    ORDER BY app_count DESC, option_name
    LIMIT 150;  -- Increased from 100 to 150 for better coverage (PERF-005)

  ELSIF p_filter_type = 'category' THEN
    RETURN QUERY
    SELECT
      sc.category_id::INT AS option_id,
      sc.name::TEXT AS option_name,
      COUNT(DISTINCT ac.appid)::BIGINT AS app_count
    FROM steam_categories sc
    JOIN app_categories ac ON ac.category_id = sc.category_id
    JOIN apps a ON a.appid = ac.appid
    LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
    WHERE a.is_released = TRUE AND a.is_delisted = FALSE
      AND (p_type = 'all' OR a.type::TEXT = p_type)
      AND (p_min_ccu IS NULL OR ldm.ccu_peak >= p_min_ccu)
      AND (p_min_reviews IS NULL OR ldm.total_reviews >= p_min_reviews)
      AND (p_min_score IS NULL OR ldm.review_score >= p_min_score)
      AND (p_min_owners IS NULL OR ldm.owners_midpoint >= p_min_owners)
    GROUP BY sc.category_id, sc.name
    ORDER BY app_count DESC, option_name;

  ELSIF p_filter_type = 'steam_deck' THEN
    RETURN QUERY
    SELECT
      ROW_NUMBER() OVER (ORDER BY asd.category)::INT AS option_id,
      asd.category::TEXT AS option_name,
      COUNT(DISTINCT asd.appid)::BIGINT AS app_count
    FROM app_steam_deck asd
    JOIN apps a ON a.appid = asd.appid
    LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
    WHERE a.is_released = TRUE AND a.is_delisted = FALSE
      AND (p_type = 'all' OR a.type::TEXT = p_type)
      AND (p_min_ccu IS NULL OR ldm.ccu_peak >= p_min_ccu)
      AND (p_min_reviews IS NULL OR ldm.total_reviews >= p_min_reviews)
      AND (p_min_score IS NULL OR ldm.review_score >= p_min_score)
      AND (p_min_owners IS NULL OR ldm.owners_midpoint >= p_min_owners)
      AND asd.category IS NOT NULL
    GROUP BY asd.category
    ORDER BY app_count DESC;

  ELSIF p_filter_type = 'ccu_tier' THEN
    RETURN QUERY
    SELECT
      ct.ccu_tier::INT AS option_id,
      CASE ct.ccu_tier
        WHEN 1 THEN 'Hot (Tier 1)'
        WHEN 2 THEN 'Active (Tier 2)'
        WHEN 3 THEN 'Quiet (Tier 3)'
      END::TEXT AS option_name,
      COUNT(DISTINCT ct.appid)::BIGINT AS app_count
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

  ELSIF p_filter_type = 'velocity_tier' THEN
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
      COUNT(DISTINCT rvs.appid)::BIGINT AS app_count
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
    -- Unknown filter type, return empty
    RETURN;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_apps_filter_option_counts IS 'Returns filter option counts for dynamic dropdowns. BUG-005: Now supports p_min_score and p_min_owners context filters. PERF-005: Tag limit increased to 150.';
