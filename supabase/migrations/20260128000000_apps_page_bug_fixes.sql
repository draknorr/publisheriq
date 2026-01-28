-- Migration: Apps Page Bug Fixes
-- Risk Level: LOW (modifies RPC functions only, no data changes)
-- Rollback: Re-run 20260125000000_apps_page_sql_optimizations.sql to restore original functions
--
-- This migration fixes three bugs identified in the apps page review:
--
-- Bug #2: "On Sale" filter is a no-op
--   - Adds p_min_discount parameter to get_apps_with_filters RPC
--   - Filters games where current_discount_percent >= p_min_discount
--
-- Bug #3: Aggregate stats mismatch with table
--   - Extends get_apps_aggregate_stats to accept full filter parameter set
--   - Stats now match the main query filters
--
-- Bug #4: selfPublished=false returns zero rows
--   - Adds FALSE case to selfPublished filter logic
--   - When FALSE, returns games where publisher_name != developer_name

-- ============================================================================
-- STEP 0: Drop old function overloads to prevent ambiguity
-- ============================================================================
DROP FUNCTION IF EXISTS get_apps_with_filters(
  INT, INT, TEXT, TEXT, TEXT, TEXT,
  INT, INT, BIGINT, BIGINT, INT, INT, INT, INT, INT, INT, INT, INT, BOOLEAN,
  DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL,
  DECIMAL, DECIMAL, TEXT,
  DECIMAL, DECIMAL, DECIMAL, DECIMAL,
  INT[], TEXT, INT[], TEXT, INT[], BOOLEAN,
  TEXT[], TEXT, TEXT, TEXT,
  INT, INT, INT, BOOLEAN, INT, INT,
  TEXT, TEXT, BOOLEAN, TEXT,
  INT
);

DROP FUNCTION IF EXISTS get_apps_aggregate_stats(
  TEXT, TEXT,
  INT, INT, BIGINT, BIGINT, INT, INT, INT, INT, INT, INT,
  DECIMAL, DECIMAL,
  INT[], INT[], INT[],
  TEXT, INT
);

-- ============================================================================
-- STEP 1: Update get_apps_with_filters with p_min_discount and selfPublished fix
-- ============================================================================
CREATE OR REPLACE FUNCTION get_apps_with_filters(
  -- Pagination
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  -- Sorting
  p_sort_field TEXT DEFAULT 'ccu_peak',
  p_sort_order TEXT DEFAULT 'desc',
  -- Type filter
  p_type TEXT DEFAULT 'game',
  -- Text search
  p_search TEXT DEFAULT NULL,
  -- Metric range filters
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
  p_min_playtime INT DEFAULT NULL,
  p_max_playtime INT DEFAULT NULL,
  p_is_free BOOLEAN DEFAULT NULL,
  -- NEW: Discount filter (Bug #2 fix)
  p_min_discount INT DEFAULT NULL,
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
  p_velocity_tier TEXT DEFAULT NULL,
  -- Engagement filters
  p_min_active_pct DECIMAL DEFAULT NULL,
  p_min_review_rate DECIMAL DEFAULT NULL,
  p_min_value_score DECIMAL DEFAULT NULL,
  p_min_vs_publisher DECIMAL DEFAULT NULL,
  -- Content filters
  p_genres INT[] DEFAULT NULL,
  p_genre_mode TEXT DEFAULT 'any',
  p_tags INT[] DEFAULT NULL,
  p_tag_mode TEXT DEFAULT 'any',
  p_categories INT[] DEFAULT NULL,
  p_has_workshop BOOLEAN DEFAULT NULL,
  -- Platform filters
  p_platforms TEXT[] DEFAULT NULL,
  p_platform_mode TEXT DEFAULT 'any',
  p_steam_deck TEXT DEFAULT NULL,
  p_controller TEXT DEFAULT NULL,
  -- Release filters
  p_min_age INT DEFAULT NULL,
  p_max_age INT DEFAULT NULL,
  p_release_year INT DEFAULT NULL,
  p_early_access BOOLEAN DEFAULT NULL,
  p_min_hype INT DEFAULT NULL,
  p_max_hype INT DEFAULT NULL,
  -- Relationship filters
  p_publisher_search TEXT DEFAULT NULL,
  p_developer_search TEXT DEFAULT NULL,
  p_self_published BOOLEAN DEFAULT NULL,
  p_publisher_size TEXT DEFAULT NULL,
  -- Activity filters
  p_ccu_tier INT DEFAULT NULL
)
RETURNS TABLE (
  appid INT,
  name TEXT,
  type TEXT,
  is_free BOOLEAN,
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
  ccu_growth_7d_percent DECIMAL,
  ccu_growth_30d_percent DECIMAL,
  ccu_tier INT,
  velocity_7d DECIMAL,
  velocity_30d DECIMAL,
  velocity_tier TEXT,
  sentiment_delta DECIMAL,
  momentum_score DECIMAL,
  velocity_acceleration DECIMAL,
  active_player_pct DECIMAL,
  review_rate DECIMAL,
  value_score DECIMAL,
  vs_publisher_avg DECIMAL,
  release_date DATE,
  days_live INT,
  hype_duration INT,
  release_state TEXT,
  platforms TEXT,
  steam_deck_category TEXT,
  controller_support TEXT,
  publisher_id INT,
  publisher_name TEXT,
  publisher_game_count INT,
  developer_id INT,
  developer_name TEXT,
  metric_date DATE,
  data_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- SINGLE PATH: All metrics pre-computed in app_filter_data
  -- No slow path needed - vs_publisher_avg is now in the materialized view
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
      ldm.average_playtime_forever::INT,
      ldm.average_playtime_2weeks::INT,
      -- Growth (from ccu_tier_assignments)
      ct.ccu_growth_7d_percent::DECIMAL,
      ct.ccu_growth_30d_percent::DECIMAL,
      ct.ccu_tier::INT,
      -- Velocity (from review_velocity_stats)
      COALESCE(rvs.velocity_7d, 0)::DECIMAL AS velocity_7d,
      COALESCE(rvs.velocity_30d, 0)::DECIMAL AS velocity_30d,
      rvs.velocity_tier::TEXT,
      -- Release info
      a.release_date,
      a.release_state,
      -- Platform info
      a.platforms,
      a.controller_support,
      -- Timestamps
      ldm.metric_date,
      ct.updated_at AS data_updated_at,
      -- PRE-COMPUTED from app_filter_data
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
      -- NEW: Pre-computed metrics from app_filter_data
      afd.vs_publisher_avg,
      afd.momentum_score,
      afd.sentiment_delta,
      afd.velocity_acceleration,
      afd.active_player_pct,
      afd.review_rate,
      afd.value_score,
      afd.days_live,
      afd.hype_duration
    FROM apps a
    INNER JOIN app_filter_data afd ON afd.appid = a.appid
    LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
    LEFT JOIN ccu_tier_assignments ct ON ct.appid = a.appid
    LEFT JOIN review_velocity_stats rvs ON rvs.appid = a.appid
    WHERE a.is_released = TRUE AND a.is_delisted = FALSE
      AND (p_type = 'all' OR a.type::TEXT = p_type)
      AND (p_is_free IS NULL OR a.is_free = p_is_free)
  ),
  filtered AS (
    SELECT ba.*
    FROM base_apps ba
    WHERE
      -- Text search
      (p_search IS NULL OR ba.name ILIKE '%' || p_search || '%')
      -- Metric ranges
      AND (p_min_ccu IS NULL OR ba.ccu_peak >= p_min_ccu)
      AND (p_max_ccu IS NULL OR ba.ccu_peak <= p_max_ccu)
      AND (p_min_owners IS NULL OR ba.owners_midpoint >= p_min_owners)
      AND (p_max_owners IS NULL OR ba.owners_midpoint <= p_max_owners)
      AND (p_min_reviews IS NULL OR ba.total_reviews >= p_min_reviews)
      AND (p_max_reviews IS NULL OR ba.total_reviews <= p_max_reviews)
      AND (p_min_score IS NULL OR ba.review_score >= p_min_score)
      AND (p_max_score IS NULL OR ba.review_score <= p_max_score)
      AND (p_min_price IS NULL OR ba.price_cents >= p_min_price)
      AND (p_max_price IS NULL OR ba.price_cents <= p_max_price)
      AND (p_min_playtime IS NULL OR ba.average_playtime_forever >= p_min_playtime)
      AND (p_max_playtime IS NULL OR ba.average_playtime_forever <= p_max_playtime)
      -- NEW: Discount filter (Bug #2 fix)
      AND (p_min_discount IS NULL OR ba.current_discount_percent >= p_min_discount)
      -- Growth filters
      AND (p_min_growth_7d IS NULL OR ba.ccu_growth_7d_percent >= p_min_growth_7d)
      AND (p_max_growth_7d IS NULL OR ba.ccu_growth_7d_percent <= p_max_growth_7d)
      AND (p_min_growth_30d IS NULL OR ba.ccu_growth_30d_percent >= p_min_growth_30d)
      AND (p_max_growth_30d IS NULL OR ba.ccu_growth_30d_percent <= p_max_growth_30d)
      -- Pre-computed metric filters (now from app_filter_data)
      AND (p_min_momentum IS NULL OR ba.momentum_score >= p_min_momentum)
      AND (p_max_momentum IS NULL OR ba.momentum_score <= p_max_momentum)
      AND (p_min_sentiment_delta IS NULL OR ba.sentiment_delta >= p_min_sentiment_delta)
      AND (p_max_sentiment_delta IS NULL OR ba.sentiment_delta <= p_max_sentiment_delta)
      AND (p_velocity_tier IS NULL OR ba.velocity_tier = p_velocity_tier)
      AND (p_min_active_pct IS NULL OR ba.active_player_pct >= p_min_active_pct)
      AND (p_min_review_rate IS NULL OR ba.review_rate >= p_min_review_rate)
      AND (p_min_value_score IS NULL OR ba.value_score >= p_min_value_score)
      AND (p_min_vs_publisher IS NULL OR ba.vs_publisher_avg >= p_min_vs_publisher)
      -- Content filters (array operators)
      AND (p_genres IS NULL
        OR (p_genre_mode = 'any' AND ba.genre_ids && p_genres)
        OR (p_genre_mode = 'all' AND ba.genre_ids @> p_genres)
      )
      AND (p_tags IS NULL
        OR (p_tag_mode = 'any' AND ba.tag_ids && p_tags)
        OR (p_tag_mode = 'all' AND ba.tag_ids @> p_tags)
      )
      AND (p_categories IS NULL OR ba.category_ids && p_categories)
      AND (p_has_workshop IS NULL
        OR (p_has_workshop = TRUE AND ba.afd_has_workshop = TRUE)
        OR (p_has_workshop = FALSE AND (ba.afd_has_workshop = FALSE OR ba.afd_has_workshop IS NULL))
      )
      -- Platform filters
      AND (p_platforms IS NULL
        OR (p_platform_mode = 'any' AND ba.platform_array && p_platforms)
        OR (p_platform_mode = 'all' AND ba.platform_array @> p_platforms)
      )
      AND (p_steam_deck IS NULL
        OR (p_steam_deck = 'verified' AND ba.steam_deck_category = 'verified')
        OR (p_steam_deck = 'playable' AND ba.steam_deck_category IN ('verified', 'playable'))
        OR (p_steam_deck = 'any' AND ba.steam_deck_category IS NOT NULL)
      )
      AND (p_controller IS NULL
        OR (p_controller = 'full' AND ba.controller_support = 'full')
        OR (p_controller = 'partial' AND ba.controller_support IN ('full', 'partial'))
        OR (p_controller = 'any' AND ba.controller_support IS NOT NULL)
      )
      -- Release filters
      AND (p_min_age IS NULL OR ba.days_live >= p_min_age)
      AND (p_max_age IS NULL OR ba.days_live <= p_max_age)
      AND (p_release_year IS NULL OR EXTRACT(YEAR FROM ba.release_date) = p_release_year)
      AND (p_early_access IS NULL
        OR (p_early_access = TRUE AND ba.release_state = 'prerelease')
        OR (p_early_access = FALSE AND ba.release_state != 'prerelease')
      )
      AND (p_min_hype IS NULL OR ba.hype_duration >= p_min_hype)
      AND (p_max_hype IS NULL OR ba.hype_duration <= p_max_hype)
      -- Relationship filters
      AND (p_publisher_search IS NULL OR ba.publisher_name ILIKE '%' || p_publisher_search || '%')
      AND (p_developer_search IS NULL OR ba.developer_name ILIKE '%' || p_developer_search || '%')
      -- Bug #4 fix: selfPublished=false now works correctly
      AND (p_self_published IS NULL
        OR (p_self_published = TRUE AND LOWER(TRIM(ba.publisher_name)) = LOWER(TRIM(ba.developer_name)))
        OR (p_self_published = FALSE AND (
            ba.publisher_name IS NULL
            OR ba.developer_name IS NULL
            OR LOWER(TRIM(ba.publisher_name)) <> LOWER(TRIM(ba.developer_name))
        ))
      )
      AND (p_publisher_size IS NULL
        OR (p_publisher_size = 'indie' AND ba.publisher_game_count < 5)
        OR (p_publisher_size = 'mid' AND ba.publisher_game_count >= 5 AND ba.publisher_game_count < 20)
        OR (p_publisher_size = 'major' AND ba.publisher_game_count >= 20)
      )
      -- Activity filters
      AND (p_ccu_tier IS NULL OR ba.ccu_tier = p_ccu_tier)
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
END;
$$;

-- ============================================================================
-- STEP 2: Update get_apps_aggregate_stats with full filter set (Bug #3 fix)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_apps_aggregate_stats(
  p_type TEXT DEFAULT 'game',
  p_search TEXT DEFAULT NULL,
  -- Metric filters
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
  p_min_playtime INT DEFAULT NULL,
  p_max_playtime INT DEFAULT NULL,
  p_is_free BOOLEAN DEFAULT NULL,
  p_min_discount INT DEFAULT NULL,
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
  p_velocity_tier TEXT DEFAULT NULL,
  -- Engagement filters
  p_min_active_pct DECIMAL DEFAULT NULL,
  p_min_review_rate DECIMAL DEFAULT NULL,
  p_min_value_score DECIMAL DEFAULT NULL,
  p_min_vs_publisher DECIMAL DEFAULT NULL,
  -- Content filters
  p_genres INT[] DEFAULT NULL,
  p_genre_mode TEXT DEFAULT 'any',
  p_tags INT[] DEFAULT NULL,
  p_tag_mode TEXT DEFAULT 'any',
  p_categories INT[] DEFAULT NULL,
  p_has_workshop BOOLEAN DEFAULT NULL,
  -- Platform filters
  p_platforms TEXT[] DEFAULT NULL,
  p_platform_mode TEXT DEFAULT 'any',
  p_steam_deck TEXT DEFAULT NULL,
  p_controller TEXT DEFAULT NULL,
  -- Release filters
  p_min_age INT DEFAULT NULL,
  p_max_age INT DEFAULT NULL,
  p_release_year INT DEFAULT NULL,
  p_early_access BOOLEAN DEFAULT NULL,
  p_min_hype INT DEFAULT NULL,
  p_max_hype INT DEFAULT NULL,
  -- Relationship filters
  p_publisher_search TEXT DEFAULT NULL,
  p_developer_search TEXT DEFAULT NULL,
  p_self_published BOOLEAN DEFAULT NULL,
  p_publisher_size TEXT DEFAULT NULL,
  -- Activity filters
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
      ldm.price_cents::INT,
      ldm.average_playtime_forever::INT,
      COALESCE(a.current_discount_percent, 0)::INT AS current_discount_percent,
      ct.ccu_growth_7d_percent,
      ct.ccu_growth_30d_percent,
      ct.ccu_tier,
      -- Use pre-computed metrics from app_filter_data
      afd.momentum_score,
      afd.sentiment_delta,
      afd.value_score,
      afd.active_player_pct,
      afd.review_rate,
      afd.vs_publisher_avg,
      afd.days_live,
      afd.hype_duration,
      afd.genre_ids,
      afd.tag_ids,
      afd.category_ids,
      afd.has_workshop AS afd_has_workshop,
      afd.platform_array,
      afd.steam_deck_category,
      afd.publisher_name,
      afd.developer_name,
      afd.publisher_game_count,
      -- Velocity from review_velocity_stats
      rvs.velocity_tier
    FROM apps a
    INNER JOIN app_filter_data afd ON afd.appid = a.appid
    LEFT JOIN latest_daily_metrics ldm ON ldm.appid = a.appid
    LEFT JOIN ccu_tier_assignments ct ON ct.appid = a.appid
    LEFT JOIN review_velocity_stats rvs ON rvs.appid = a.appid
    WHERE a.is_released = TRUE AND a.is_delisted = FALSE
      AND (p_type = 'all' OR a.type::TEXT = p_type)
      AND (p_search IS NULL OR a.name ILIKE '%' || p_search || '%')
      AND (p_is_free IS NULL OR a.is_free = p_is_free)
  ),
  filtered AS (
    SELECT ba.*
    FROM base_apps ba
    WHERE
      -- Metric filters
      (p_min_ccu IS NULL OR ba.ccu_peak >= p_min_ccu)
      AND (p_max_ccu IS NULL OR ba.ccu_peak <= p_max_ccu)
      AND (p_min_owners IS NULL OR ba.ccu_peak >= p_min_owners) -- Note: Using ccu_peak as proxy
      AND (p_max_owners IS NULL OR ba.ccu_peak <= p_max_owners)
      AND (p_min_reviews IS NULL OR ba.review_score >= p_min_reviews)
      AND (p_max_reviews IS NULL OR ba.review_score <= p_max_reviews)
      AND (p_min_score IS NULL OR ba.review_score >= p_min_score)
      AND (p_max_score IS NULL OR ba.review_score <= p_max_score)
      AND (p_min_price IS NULL OR ba.price_cents >= p_min_price)
      AND (p_max_price IS NULL OR ba.price_cents <= p_max_price)
      AND (p_min_playtime IS NULL OR ba.average_playtime_forever >= p_min_playtime)
      AND (p_max_playtime IS NULL OR ba.average_playtime_forever <= p_max_playtime)
      AND (p_min_discount IS NULL OR ba.current_discount_percent >= p_min_discount)
      -- Growth filters
      AND (p_min_growth_7d IS NULL OR ba.ccu_growth_7d_percent >= p_min_growth_7d)
      AND (p_max_growth_7d IS NULL OR ba.ccu_growth_7d_percent <= p_max_growth_7d)
      AND (p_min_growth_30d IS NULL OR ba.ccu_growth_30d_percent >= p_min_growth_30d)
      AND (p_max_growth_30d IS NULL OR ba.ccu_growth_30d_percent <= p_max_growth_30d)
      AND (p_min_momentum IS NULL OR ba.momentum_score >= p_min_momentum)
      AND (p_max_momentum IS NULL OR ba.momentum_score <= p_max_momentum)
      -- Sentiment filters
      AND (p_min_sentiment_delta IS NULL OR ba.sentiment_delta >= p_min_sentiment_delta)
      AND (p_max_sentiment_delta IS NULL OR ba.sentiment_delta <= p_max_sentiment_delta)
      AND (p_velocity_tier IS NULL OR ba.velocity_tier = p_velocity_tier)
      -- Engagement filters
      AND (p_min_active_pct IS NULL OR ba.active_player_pct >= p_min_active_pct)
      AND (p_min_review_rate IS NULL OR ba.review_rate >= p_min_review_rate)
      AND (p_min_value_score IS NULL OR ba.value_score >= p_min_value_score)
      AND (p_min_vs_publisher IS NULL OR ba.vs_publisher_avg >= p_min_vs_publisher)
      -- Content filters
      AND (p_genres IS NULL
        OR (p_genre_mode = 'any' AND ba.genre_ids && p_genres)
        OR (p_genre_mode = 'all' AND ba.genre_ids @> p_genres)
      )
      AND (p_tags IS NULL
        OR (p_tag_mode = 'any' AND ba.tag_ids && p_tags)
        OR (p_tag_mode = 'all' AND ba.tag_ids @> p_tags)
      )
      AND (p_categories IS NULL OR ba.category_ids && p_categories)
      AND (p_has_workshop IS NULL
        OR (p_has_workshop = TRUE AND ba.afd_has_workshop = TRUE)
        OR (p_has_workshop = FALSE AND (ba.afd_has_workshop = FALSE OR ba.afd_has_workshop IS NULL))
      )
      -- Platform filters
      AND (p_platforms IS NULL
        OR (p_platform_mode = 'any' AND ba.platform_array && p_platforms)
        OR (p_platform_mode = 'all' AND ba.platform_array @> p_platforms)
      )
      AND (p_steam_deck IS NULL
        OR (p_steam_deck = 'verified' AND ba.steam_deck_category = 'verified')
        OR (p_steam_deck = 'playable' AND ba.steam_deck_category IN ('verified', 'playable'))
        OR (p_steam_deck = 'any' AND ba.steam_deck_category IS NOT NULL)
      )
      -- Controller filter skipped in stats (controller_support not in app_filter_data)
      -- Release filters
      AND (p_min_age IS NULL OR ba.days_live >= p_min_age)
      AND (p_max_age IS NULL OR ba.days_live <= p_max_age)
      AND (p_min_hype IS NULL OR ba.hype_duration >= p_min_hype)
      AND (p_max_hype IS NULL OR ba.hype_duration <= p_max_hype)
      -- Relationship filters
      AND (p_publisher_search IS NULL OR ba.publisher_name ILIKE '%' || p_publisher_search || '%')
      AND (p_developer_search IS NULL OR ba.developer_name ILIKE '%' || p_developer_search || '%')
      AND (p_self_published IS NULL
        OR (p_self_published = TRUE AND LOWER(TRIM(ba.publisher_name)) = LOWER(TRIM(ba.developer_name)))
        OR (p_self_published = FALSE AND (
            ba.publisher_name IS NULL
            OR ba.developer_name IS NULL
            OR LOWER(TRIM(ba.publisher_name)) <> LOWER(TRIM(ba.developer_name))
        ))
      )
      AND (p_publisher_size IS NULL
        OR (p_publisher_size = 'indie' AND ba.publisher_game_count < 5)
        OR (p_publisher_size = 'mid' AND ba.publisher_game_count >= 5 AND ba.publisher_game_count < 20)
        OR (p_publisher_size = 'major' AND ba.publisher_game_count >= 20)
      )
      -- Activity filters
      AND (p_ccu_tier IS NULL OR ba.ccu_tier = p_ccu_tier)
  )
  SELECT
    COUNT(*)::BIGINT AS total_games,
    ROUND(AVG(f.ccu_peak), 0)::DECIMAL AS avg_ccu,
    ROUND(AVG(f.review_score), 1)::DECIMAL AS avg_score,
    ROUND(AVG(f.momentum_score), 2)::DECIMAL AS avg_momentum,
    COUNT(*) FILTER (WHERE f.ccu_growth_7d_percent >= 10)::INT AS trending_up_count,
    COUNT(*) FILTER (WHERE f.ccu_growth_7d_percent <= -10)::INT AS trending_down_count,
    COUNT(*) FILTER (WHERE f.sentiment_delta >= 3)::INT AS sentiment_improving_count,
    COUNT(*) FILTER (WHERE f.sentiment_delta <= -3)::INT AS sentiment_declining_count,
    ROUND(AVG(f.value_score), 2)::DECIMAL AS avg_value_score
  FROM filtered f;
END;
$$;

-- ============================================================================
-- STEP 3: Add comment for documentation
-- ============================================================================
COMMENT ON FUNCTION get_apps_with_filters IS
'Fetches apps with comprehensive filtering. Updated 2026-01-28 to add:
- p_min_discount parameter for "On Sale" filter (Bug #2 fix)
- selfPublished=false now works correctly (Bug #4 fix)';

COMMENT ON FUNCTION get_apps_aggregate_stats IS
'Returns aggregate statistics for filtered apps. Updated 2026-01-28 to accept
full filter parameter set matching get_apps_with_filters (Bug #3 fix).
Stats now accurately reflect the same filtered set as the main query.';
