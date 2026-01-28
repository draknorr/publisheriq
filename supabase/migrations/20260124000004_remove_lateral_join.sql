-- =============================================================================
-- Migration: Remove Unnecessary LATERAL JOIN
--
-- Problem:
--   The momentum formula fix (20260124000003) added a LATERAL JOIN to
--   daily_metrics to get playtime columns. But latest_daily_metrics ALREADY
--   has these columns via the latest_owners CTE:
--   - o.average_playtime_forever
--   - o.average_playtime_2weeks
--
--   The LATERAL JOIN executes per-row for ~119K apps, scanning 2.4M rows
--   in daily_metrics. This adds ~400-600ms to EVERY query.
--
-- Fix:
--   Remove the LATERAL JOIN and read directly from ldm.average_playtime_forever
--   and ldm.average_playtime_2weeks which are already joined via latest_daily_metrics.
--
-- Expected improvement: ~500ms faster per query (1.0s → ~0.5s)
-- =============================================================================

-- ============================================================================
-- Replace get_apps_with_filters - REMOVE LATERAL JOIN
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
  -- (requires JOIN to publisher_metrics for the avg score calculation)
  v_needs_slow_path := (p_min_vs_publisher IS NOT NULL OR p_sort_field = 'vs_publisher_avg');

  IF NOT v_needs_slow_path THEN
    -- FAST PATH: Uses app_filter_data materialized view for content filters
    -- NO LATERAL JOIN - playtime comes from latest_daily_metrics directly
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
        -- Playtime from latest_daily_metrics (NOT from LATERAL join)
        ldm.average_playtime_forever::INT,
        ldm.average_playtime_2weeks::INT,
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
        a.controller_support,
        -- Timestamps
        ldm.metric_date,
        ct.updated_at AS data_updated_at,
        -- Store asset mtime for hype duration
        a.store_asset_mtime,
        -- From materialized view: content filter data
        afd.genre_ids,
        afd.tag_ids,
        afd.category_ids,
        afd.has_workshop AS afd_has_workshop,
        afd.platform_array,
        afd.steam_deck_category::TEXT,
        afd.publisher_id,
        afd.publisher_name,
        afd.publisher_game_count,
        afd.developer_id,
        afd.developer_name
      FROM apps a
      -- JOIN materialized view for content filter data
      INNER JOIN app_filter_data afd ON afd.appid = a.appid
      -- Real-time metric data (not cached)
      LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
      LEFT JOIN ccu_tier_assignments ct ON ct.appid = a.appid
      LEFT JOIN review_velocity_stats rvs ON rvs.appid = a.appid
      LEFT JOIN app_trends atr ON atr.appid = a.appid
      -- NO LATERAL JOIN - removed for performance
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
        -- Velocity acceleration: now percentage-based for comparability
        -- ((velocity_7d - velocity_30d) / velocity_30d) * 100
        CASE
          WHEN ba.velocity_7d IS NOT NULL AND ba.velocity_30d IS NOT NULL AND ba.velocity_30d > 0
          THEN ROUND(((ba.velocity_7d - ba.velocity_30d) / ba.velocity_30d) * 100, 2)
          ELSE NULL
        END AS velocity_acceleration,
        -- Momentum score: (growth_7d % + velocity_change %) / 2
        -- Both components are now percentages, making values comparable across all games
        CASE
          WHEN ba.ccu_growth_7d_percent IS NOT NULL
          THEN ROUND((ba.ccu_growth_7d_percent + COALESCE(
            CASE
              WHEN ba.velocity_30d IS NOT NULL AND ba.velocity_30d > 0
              THEN ((ba.velocity_7d - ba.velocity_30d) / ba.velocity_30d) * 100
              ELSE 0
            END, 0)) / 2, 2)
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
        -- Days live
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
        -- Text search (uses trigram index)
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

        -- ============================================
        -- CONTENT FILTERS: Uses array operators (FAST)
        -- && = overlap (any), @> = contains (all)
        -- ============================================

        -- Genres: array containment instead of EXISTS subquery
        AND (p_genres IS NULL
          OR (p_genre_mode = 'any' AND c.genre_ids && p_genres)
          OR (p_genre_mode = 'all' AND c.genre_ids @> p_genres)
        )

        -- Tags: array containment instead of EXISTS subquery
        AND (p_tags IS NULL
          OR (p_tag_mode = 'any' AND c.tag_ids && p_tags)
          OR (p_tag_mode = 'all' AND c.tag_ids @> p_tags)
        )

        -- Categories: array overlap
        AND (p_categories IS NULL OR c.category_ids && p_categories)

        -- Workshop: pre-computed boolean
        AND (p_has_workshop IS NULL
          OR (p_has_workshop = TRUE AND c.afd_has_workshop = TRUE)
          OR (p_has_workshop = FALSE AND (c.afd_has_workshop = FALSE OR c.afd_has_workshop IS NULL))
        )

        -- ============================================
        -- PLATFORM FILTERS: Uses array operators
        -- ============================================

        AND (p_platforms IS NULL
          OR (p_platform_mode = 'any' AND c.platform_array && p_platforms)
          OR (p_platform_mode = 'all' AND c.platform_array @> p_platforms)
        )

        AND (p_steam_deck IS NULL
          OR (p_steam_deck = 'verified' AND c.steam_deck_category = 'verified')
          OR (p_steam_deck = 'playable' AND c.steam_deck_category IN ('verified', 'playable'))
          OR (p_steam_deck = 'any' AND c.steam_deck_category IS NOT NULL)
        )

        AND (p_controller IS NULL
          OR (p_controller = 'full' AND c.controller_support = 'full')
          OR (p_controller = 'partial' AND c.controller_support IN ('full', 'partial'))
          OR (p_controller = 'any' AND c.controller_support IS NOT NULL)
        )

        -- Release filters
        AND (p_min_age IS NULL OR c.days_live >= p_min_age)
        AND (p_max_age IS NULL OR c.days_live <= p_max_age)
        AND (p_release_year IS NULL OR EXTRACT(YEAR FROM c.release_date) = p_release_year)
        AND (p_early_access IS NULL
          OR (p_early_access = TRUE AND c.release_state = 'prerelease')
          OR (p_early_access = FALSE AND c.release_state != 'prerelease')
        )
        AND (p_min_hype IS NULL OR c.hype_duration >= p_min_hype)
        AND (p_max_hype IS NULL OR c.hype_duration <= p_max_hype)

        -- Relationship filters (uses pre-computed data from materialized view)
        AND (p_publisher_search IS NULL OR c.publisher_name ILIKE '%' || p_publisher_search || '%')
        AND (p_developer_search IS NULL OR c.developer_name ILIKE '%' || p_developer_search || '%')
        AND (p_self_published IS NULL
          OR (p_self_published = TRUE AND LOWER(TRIM(c.publisher_name)) = LOWER(TRIM(c.developer_name)))
        )
        AND (p_publisher_size IS NULL
          OR (p_publisher_size = 'indie' AND c.publisher_game_count < 5)
          OR (p_publisher_size = 'mid' AND c.publisher_game_count >= 5 AND c.publisher_game_count < 20)
          OR (p_publisher_size = 'major' AND c.publisher_game_count >= 20)
        )

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
    -- SLOW PATH: Compute vs_publisher_avg (requires publisher_metrics JOIN)
    -- Still uses app_filter_data for content filters
    -- NO LATERAL JOIN - playtime comes from latest_daily_metrics directly
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
        -- Playtime from latest_daily_metrics (NOT from LATERAL join)
        ldm.average_playtime_forever::INT,
        ldm.average_playtime_2weeks::INT,
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
        a.controller_support,
        ldm.metric_date,
        ct.updated_at AS data_updated_at,
        a.store_asset_mtime,
        -- From materialized view
        afd.genre_ids,
        afd.tag_ids,
        afd.category_ids,
        afd.has_workshop AS afd_has_workshop,
        afd.platform_array,
        afd.steam_deck_category::TEXT,
        afd.publisher_id,
        afd.publisher_name,
        afd.publisher_game_count,
        afd.developer_id,
        afd.developer_name,
        -- Additional: publisher avg score for vs_publisher_avg
        pm.avg_review_score AS publisher_avg_score
      FROM apps a
      INNER JOIN app_filter_data afd ON afd.appid = a.appid
      LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
      LEFT JOIN ccu_tier_assignments ct ON ct.appid = a.appid
      LEFT JOIN review_velocity_stats rvs ON rvs.appid = a.appid
      LEFT JOIN app_trends atr ON atr.appid = a.appid
      -- Additional JOIN for vs_publisher_avg calculation
      LEFT JOIN publisher_metrics pm ON pm.publisher_id = afd.publisher_id
      -- NO LATERAL JOIN - removed for performance
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
        -- Velocity acceleration: now percentage-based for comparability
        CASE
          WHEN ba.velocity_7d IS NOT NULL AND ba.velocity_30d IS NOT NULL AND ba.velocity_30d > 0
          THEN ROUND(((ba.velocity_7d - ba.velocity_30d) / ba.velocity_30d) * 100, 2)
          ELSE NULL
        END AS velocity_acceleration,
        -- Momentum score: (growth_7d % + velocity_change %) / 2
        CASE
          WHEN ba.ccu_growth_7d_percent IS NOT NULL
          THEN ROUND((ba.ccu_growth_7d_percent + COALESCE(
            CASE
              WHEN ba.velocity_30d IS NOT NULL AND ba.velocity_30d > 0
              THEN ((ba.velocity_7d - ba.velocity_30d) / ba.velocity_30d) * 100
              ELSE 0
            END, 0)) / 2, 2)
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
        -- Content filters using array operators
        AND (p_genres IS NULL
          OR (p_genre_mode = 'any' AND c.genre_ids && p_genres)
          OR (p_genre_mode = 'all' AND c.genre_ids @> p_genres)
        )
        AND (p_tags IS NULL
          OR (p_tag_mode = 'any' AND c.tag_ids && p_tags)
          OR (p_tag_mode = 'all' AND c.tag_ids @> p_tags)
        )
        AND (p_categories IS NULL OR c.category_ids && p_categories)
        AND (p_has_workshop IS NULL
          OR (p_has_workshop = TRUE AND c.afd_has_workshop = TRUE)
          OR (p_has_workshop = FALSE AND (c.afd_has_workshop = FALSE OR c.afd_has_workshop IS NULL))
        )
        AND (p_platforms IS NULL
          OR (p_platform_mode = 'any' AND c.platform_array && p_platforms)
          OR (p_platform_mode = 'all' AND c.platform_array @> p_platforms)
        )
        AND (p_steam_deck IS NULL
          OR (p_steam_deck = 'verified' AND c.steam_deck_category = 'verified')
          OR (p_steam_deck = 'playable' AND c.steam_deck_category IN ('verified', 'playable'))
          OR (p_steam_deck = 'any' AND c.steam_deck_category IS NOT NULL)
        )
        AND (p_controller IS NULL
          OR (p_controller = 'full' AND c.controller_support = 'full')
          OR (p_controller = 'partial' AND c.controller_support IN ('full', 'partial'))
          OR (p_controller = 'any' AND c.controller_support IS NOT NULL)
        )
        AND (p_min_age IS NULL OR c.days_live >= p_min_age)
        AND (p_max_age IS NULL OR c.days_live <= p_max_age)
        AND (p_release_year IS NULL OR EXTRACT(YEAR FROM c.release_date) = p_release_year)
        AND (p_early_access IS NULL
          OR (p_early_access = TRUE AND c.release_state = 'prerelease')
          OR (p_early_access = FALSE AND c.release_state != 'prerelease')
        )
        AND (p_min_hype IS NULL OR c.hype_duration >= p_min_hype)
        AND (p_max_hype IS NULL OR c.hype_duration <= p_max_hype)
        AND (p_publisher_search IS NULL OR c.publisher_name ILIKE '%' || p_publisher_search || '%')
        AND (p_developer_search IS NULL OR c.developer_name ILIKE '%' || p_developer_search || '%')
        AND (p_self_published IS NULL
          OR (p_self_published = TRUE AND LOWER(TRIM(c.publisher_name)) = LOWER(TRIM(c.developer_name)))
        )
        AND (p_publisher_size IS NULL
          OR (p_publisher_size = 'indie' AND c.publisher_game_count < 5)
          OR (p_publisher_size = 'mid' AND c.publisher_game_count >= 5 AND c.publisher_game_count < 20)
          OR (p_publisher_size = 'major' AND c.publisher_game_count >= 20)
        )
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

COMMENT ON FUNCTION get_apps_with_filters IS
  'Optimized Games page query. Removed LATERAL JOIN - playtime now from latest_daily_metrics directly. Expected query time: ~500ms (was ~1s).';


-- ============================================================================
-- Update get_apps_aggregate_stats - REMOVE LATERAL JOIN
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
BEGIN
  RETURN QUERY
  WITH base_apps AS (
    SELECT
      a.appid,
      COALESCE(ldm.ccu_peak, 0)::INT AS ccu_peak,
      ldm.review_score::INT,
      ct.ccu_growth_7d_percent,
      -- Velocity acceleration as percentage (for momentum calc)
      CASE
        WHEN rvs.velocity_30d IS NOT NULL AND rvs.velocity_30d > 0
        THEN ((COALESCE(rvs.velocity_7d, 0) - rvs.velocity_30d) / rvs.velocity_30d) * 100
        ELSE 0
      END AS velocity_pct_change,
      atr.current_positive_ratio,
      atr.previous_positive_ratio,
      a.is_free,
      ldm.price_cents,
      -- Playtime from latest_daily_metrics (NOT from LATERAL join)
      ldm.average_playtime_forever,
      -- From materialized view for content filtering
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
    -- NO LATERAL JOIN - removed for performance
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
      -- Content filters using array operators
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
      -- Momentum: (ccu_growth % + velocity_change %) / 2
      CASE
        WHEN ba.ccu_growth_7d_percent IS NOT NULL
        THEN (ba.ccu_growth_7d_percent + COALESCE(ba.velocity_pct_change, 0)) / 2
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
END;
$$;

COMMENT ON FUNCTION get_apps_aggregate_stats IS
  'Aggregate stats - removed LATERAL JOIN. Playtime now from latest_daily_metrics directly. Expected ~1s faster.';
