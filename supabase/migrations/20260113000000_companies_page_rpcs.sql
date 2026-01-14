-- Migration: Add RPC functions for unified /companies page
-- Milestone 1 of Companies Page implementation
--
-- Creates 4 functions:
-- 1. get_companies_with_filters - Main query with all filters, growth metrics, relationship flags
-- 2. get_companies_aggregate_stats - Summary statistics for filtered results
-- 3. get_company_sparkline_data - CCU time-series for sparklines
-- 4. get_filter_option_counts - Dynamic counts for filter dropdowns

-- ============================================================================
-- RPC 1: get_companies_with_filters
-- Unified function for querying both publishers and developers with full filter set
-- OPTIMIZED: Only computes growth/relationships when explicitly needed
-- ============================================================================

CREATE OR REPLACE FUNCTION get_companies_with_filters(
  p_type TEXT DEFAULT 'all',              -- 'all', 'publisher', 'developer'
  p_search TEXT DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'estimated_weekly_hours',
  p_sort_order TEXT DEFAULT 'desc',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  -- Metric filters
  p_min_games INT DEFAULT NULL,
  p_max_games INT DEFAULT NULL,
  p_min_owners BIGINT DEFAULT NULL,
  p_min_ccu INT DEFAULT NULL,
  p_min_hours BIGINT DEFAULT NULL,
  p_min_revenue BIGINT DEFAULT NULL,
  p_min_score INT DEFAULT NULL,
  p_min_reviews INT DEFAULT NULL,
  -- Growth filters
  p_min_growth_7d DECIMAL DEFAULT NULL,
  p_max_growth_7d DECIMAL DEFAULT NULL,
  p_min_growth_30d DECIMAL DEFAULT NULL,
  p_max_growth_30d DECIMAL DEFAULT NULL,
  -- Time period (for future use with year metrics)
  p_period TEXT DEFAULT 'all',
  -- Content filters
  p_genres INT[] DEFAULT NULL,
  p_genre_mode TEXT DEFAULT 'any',        -- 'any' or 'all'
  p_tags INT[] DEFAULT NULL,
  p_categories INT[] DEFAULT NULL,
  p_steam_deck TEXT DEFAULT NULL,         -- 'verified', 'playable', 'any'
  p_platforms TEXT[] DEFAULT NULL,
  p_platform_mode TEXT DEFAULT 'any',
  p_status TEXT DEFAULT NULL,             -- 'active', 'dormant'
  -- Relationship filters
  p_relationship TEXT DEFAULT NULL        -- 'self_published', 'external_devs', 'multi_publisher'
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
  v_needs_growth BOOLEAN;
  v_needs_relationship BOOLEAN;
BEGIN
  -- Check if we need expensive computations
  v_needs_growth := (p_min_growth_7d IS NOT NULL OR p_max_growth_7d IS NOT NULL
                    OR p_min_growth_30d IS NOT NULL OR p_max_growth_30d IS NOT NULL
                    OR p_sort_by IN ('ccu_growth_7d', 'ccu_growth_30d', 'review_velocity_7d'));
  v_needs_relationship := (p_relationship IS NOT NULL);

  -- Fast path: No growth filters, no relationship filters, not sorting by growth
  IF NOT v_needs_growth AND NOT v_needs_relationship THEN
    RETURN QUERY
    WITH base_companies AS (
      -- Publishers
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
        pm.computed_at AS data_updated_at
      FROM publishers p
      LEFT JOIN publisher_metrics pm ON pm.publisher_id = p.id
      WHERE (p_type = 'all' OR p_type = 'publisher')
        AND p.game_count > 0

      UNION ALL

      -- Developers
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
        dm.computed_at AS data_updated_at
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
        AND (p_min_ccu IS NULL OR bc.total_ccu >= p_min_ccu)
        AND (p_min_hours IS NULL OR bc.estimated_weekly_hours >= p_min_hours)
        AND (p_min_revenue IS NULL OR bc.revenue_estimate_cents >= p_min_revenue)
        AND (p_min_score IS NULL OR bc.avg_review_score >= p_min_score)
        AND (p_min_reviews IS NULL OR bc.total_reviews >= p_min_reviews)
        AND (p_status IS NULL
             OR (p_status = 'active' AND bc.games_released_last_year > 0)
             OR (p_status = 'dormant' AND bc.games_released_last_year = 0))
        AND (p_genres IS NULL OR EXISTS (
          SELECT 1 FROM app_genres ag
          JOIN app_publishers ap ON ap.appid = ag.appid
          WHERE ap.publisher_id = bc.id AND bc.type = 'publisher' AND ag.genre_id = ANY(p_genres)
          UNION
          SELECT 1 FROM app_genres ag
          JOIN app_developers ad ON ad.appid = ag.appid
          WHERE ad.developer_id = bc.id AND bc.type = 'developer' AND ag.genre_id = ANY(p_genres)
        ))
        AND (p_tags IS NULL OR EXISTS (
          SELECT 1 FROM app_steam_tags ast
          JOIN app_publishers ap ON ap.appid = ast.appid
          WHERE ap.publisher_id = bc.id AND bc.type = 'publisher' AND ast.tag_id = ANY(p_tags)
          UNION
          SELECT 1 FROM app_steam_tags ast
          JOIN app_developers ad ON ad.appid = ast.appid
          WHERE ad.developer_id = bc.id AND bc.type = 'developer' AND ast.tag_id = ANY(p_tags)
        ))
        AND (p_categories IS NULL OR EXISTS (
          SELECT 1 FROM app_categories ac
          JOIN app_publishers ap ON ap.appid = ac.appid
          WHERE ap.publisher_id = bc.id AND bc.type = 'publisher' AND ac.category_id = ANY(p_categories)
          UNION
          SELECT 1 FROM app_categories ac
          JOIN app_developers ad ON ad.appid = ac.appid
          WHERE ad.developer_id = bc.id AND bc.type = 'developer' AND ac.category_id = ANY(p_categories)
        ))
        AND (p_steam_deck IS NULL OR EXISTS (
          SELECT 1 FROM app_steam_deck asd
          JOIN app_publishers ap ON ap.appid = asd.appid
          WHERE ap.publisher_id = bc.id AND bc.type = 'publisher'
            AND ((p_steam_deck = 'verified' AND asd.category = 'verified')
                 OR (p_steam_deck = 'playable' AND asd.category IN ('verified', 'playable')))
          UNION
          SELECT 1 FROM app_steam_deck asd
          JOIN app_developers ad ON ad.appid = asd.appid
          WHERE ad.developer_id = bc.id AND bc.type = 'developer'
            AND ((p_steam_deck = 'verified' AND asd.category = 'verified')
                 OR (p_steam_deck = 'playable' AND asd.category IN ('verified', 'playable')))
        ))
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
            ELSE f.estimated_weekly_hours
          END
        END DESC NULLS LAST
      LIMIT p_limit OFFSET p_offset
    )
    -- Fast path: Return NULL for expensive calculations (growth, relationships)
    -- UI can request these separately via dedicated endpoint if needed
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
      NULL::DECIMAL AS ccu_growth_7d_percent,
      NULL::DECIMAL AS ccu_growth_30d_percent,
      NULL::DECIMAL AS review_velocity_7d,
      NULL::DECIMAL AS review_velocity_30d,
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

  -- Slow path: Growth/relationship filters or sorting by growth
  ELSE
    RETURN QUERY
    WITH base_companies AS (
      SELECT p.id, p.name, 'publisher'::TEXT AS type, p.game_count,
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
        p.first_game_release_date, p.steam_vanity_url,
        COALESCE(pm.unique_developers, 0)::INT AS unique_developers,
        pm.computed_at AS data_updated_at
      FROM publishers p LEFT JOIN publisher_metrics pm ON pm.publisher_id = p.id
      WHERE (p_type = 'all' OR p_type = 'publisher') AND p.game_count > 0
      UNION ALL
      SELECT d.id, d.name, 'developer'::TEXT, d.game_count,
        COALESCE(dm.total_owners, 0)::BIGINT, COALESCE(dm.total_ccu, 0)::BIGINT,
        COALESCE(dm.estimated_weekly_hours, 0)::BIGINT, COALESCE(dm.total_reviews, 0)::BIGINT,
        COALESCE(dm.positive_reviews, 0)::BIGINT, dm.avg_review_score,
        COALESCE(dm.revenue_estimate_cents, 0)::BIGINT, COALESCE(dm.games_trending_up, 0)::INT,
        COALESCE(dm.games_trending_down, 0)::INT, COALESCE(dm.games_released_last_year, 0)::INT,
        d.first_game_release_date, d.steam_vanity_url, 0::INT, dm.computed_at
      FROM developers d LEFT JOIN developer_metrics dm ON dm.developer_id = d.id
      WHERE (p_type = 'all' OR p_type = 'developer') AND d.game_count > 0
    ),
    filtered AS (
      SELECT bc.* FROM base_companies bc
      WHERE (p_search IS NULL OR bc.name ILIKE '%' || p_search || '%')
        AND (p_min_games IS NULL OR bc.game_count >= p_min_games)
        AND (p_max_games IS NULL OR bc.game_count <= p_max_games)
        AND (p_min_owners IS NULL OR bc.total_owners >= p_min_owners)
        AND (p_min_ccu IS NULL OR bc.total_ccu >= p_min_ccu)
        AND (p_min_hours IS NULL OR bc.estimated_weekly_hours >= p_min_hours)
        AND (p_min_revenue IS NULL OR bc.revenue_estimate_cents >= p_min_revenue)
        AND (p_min_score IS NULL OR bc.avg_review_score >= p_min_score)
        AND (p_min_reviews IS NULL OR bc.total_reviews >= p_min_reviews)
        AND (p_status IS NULL
             OR (p_status = 'active' AND bc.games_released_last_year > 0)
             OR (p_status = 'dormant' AND bc.games_released_last_year = 0))
        AND (p_genres IS NULL OR EXISTS (
          SELECT 1 FROM app_genres ag JOIN app_publishers ap ON ap.appid = ag.appid
          WHERE ap.publisher_id = bc.id AND bc.type = 'publisher' AND ag.genre_id = ANY(p_genres)
          UNION SELECT 1 FROM app_genres ag JOIN app_developers ad ON ad.appid = ag.appid
          WHERE ad.developer_id = bc.id AND bc.type = 'developer' AND ag.genre_id = ANY(p_genres)))
        AND (p_tags IS NULL OR EXISTS (
          SELECT 1 FROM app_steam_tags ast JOIN app_publishers ap ON ap.appid = ast.appid
          WHERE ap.publisher_id = bc.id AND bc.type = 'publisher' AND ast.tag_id = ANY(p_tags)
          UNION SELECT 1 FROM app_steam_tags ast JOIN app_developers ad ON ad.appid = ast.appid
          WHERE ad.developer_id = bc.id AND bc.type = 'developer' AND ast.tag_id = ANY(p_tags)))
        AND (p_categories IS NULL OR EXISTS (
          SELECT 1 FROM app_categories ac JOIN app_publishers ap ON ap.appid = ac.appid
          WHERE ap.publisher_id = bc.id AND bc.type = 'publisher' AND ac.category_id = ANY(p_categories)
          UNION SELECT 1 FROM app_categories ac JOIN app_developers ad ON ad.appid = ac.appid
          WHERE ad.developer_id = bc.id AND bc.type = 'developer' AND ac.category_id = ANY(p_categories)))
        AND (p_steam_deck IS NULL OR EXISTS (
          SELECT 1 FROM app_steam_deck asd JOIN app_publishers ap ON ap.appid = asd.appid
          WHERE ap.publisher_id = bc.id AND bc.type = 'publisher'
            AND ((p_steam_deck = 'verified' AND asd.category = 'verified') OR (p_steam_deck = 'playable' AND asd.category IN ('verified', 'playable')))
          UNION SELECT 1 FROM app_steam_deck asd JOIN app_developers ad ON ad.appid = asd.appid
          WHERE ad.developer_id = bc.id AND bc.type = 'developer'
            AND ((p_steam_deck = 'verified' AND asd.category = 'verified') OR (p_steam_deck = 'playable' AND asd.category IN ('verified', 'playable')))))
    ),
    with_growth AS (
      SELECT f.*,
        (SELECT CASE WHEN prior_avg > 0 THEN ROUND(((current_avg - prior_avg) / prior_avg) * 100, 2) ELSE NULL END
         FROM (SELECT AVG(cs.player_count) FILTER (WHERE cs.snapshot_time > NOW() - INTERVAL '7 days') AS current_avg,
                      AVG(cs.player_count) FILTER (WHERE cs.snapshot_time > NOW() - INTERVAL '14 days'
                                                     AND cs.snapshot_time <= NOW() - INTERVAL '7 days') AS prior_avg
               FROM ccu_snapshots cs WHERE cs.appid IN (
                 SELECT ap.appid FROM app_publishers ap WHERE ap.publisher_id = f.id AND f.type = 'publisher'
                 UNION SELECT ad.appid FROM app_developers ad WHERE ad.developer_id = f.id AND f.type = 'developer')) g)::DECIMAL AS ccu_growth_7d_pct,
        (SELECT CASE WHEN baseline > 0 THEN ROUND(((recent - baseline) / baseline) * 100, 2) ELSE NULL END
         FROM (SELECT AVG(cs.player_count) FILTER (WHERE cs.snapshot_time > NOW() - INTERVAL '7 days') AS recent,
                      AVG(cs.player_count) FILTER (WHERE cs.snapshot_time > NOW() - INTERVAL '30 days') AS baseline
               FROM ccu_snapshots cs WHERE cs.appid IN (
                 SELECT ap.appid FROM app_publishers ap WHERE ap.publisher_id = f.id AND f.type = 'publisher'
                 UNION SELECT ad.appid FROM app_developers ad WHERE ad.developer_id = f.id AND f.type = 'developer')) g)::DECIMAL AS ccu_growth_30d_pct,
        (SELECT COALESCE(SUM(rvs.velocity_7d), 0) FROM review_velocity_stats rvs WHERE rvs.appid IN (
           SELECT ap.appid FROM app_publishers ap WHERE ap.publisher_id = f.id AND f.type = 'publisher'
           UNION SELECT ad.appid FROM app_developers ad WHERE ad.developer_id = f.id AND f.type = 'developer'))::DECIMAL AS review_vel_7d,
        (SELECT COALESCE(SUM(rvs.velocity_30d), 0) FROM review_velocity_stats rvs WHERE rvs.appid IN (
           SELECT ap.appid FROM app_publishers ap WHERE ap.publisher_id = f.id AND f.type = 'publisher'
           UNION SELECT ad.appid FROM app_developers ad WHERE ad.developer_id = f.id AND f.type = 'developer'))::DECIMAL AS review_vel_30d
      FROM filtered f
    ),
    with_relationships AS (
      SELECT wg.*,
        CASE WHEN wg.type = 'publisher' THEN
          NOT EXISTS (SELECT 1 FROM app_publishers ap JOIN publishers pub ON pub.id = ap.publisher_id
                      WHERE ap.publisher_id = wg.id AND NOT EXISTS (
                        SELECT 1 FROM app_developers ad JOIN developers dev ON dev.id = ad.developer_id
                        WHERE ad.appid = ap.appid AND LOWER(TRIM(dev.name)) = LOWER(TRIM(pub.name))))
        ELSE NOT EXISTS (SELECT 1 FROM app_developers ad JOIN developers dev ON dev.id = ad.developer_id
                         WHERE ad.developer_id = wg.id AND NOT EXISTS (
                           SELECT 1 FROM app_publishers ap JOIN publishers pub ON pub.id = ap.publisher_id
                           WHERE ap.appid = ad.appid AND LOWER(TRIM(pub.name)) = LOWER(TRIM(dev.name))))
        END AS is_self_pub,
        CASE WHEN wg.type = 'publisher' THEN
          (SELECT COUNT(DISTINCT dev.id) FROM app_publishers ap
           JOIN app_developers ad ON ad.appid = ap.appid JOIN developers dev ON dev.id = ad.developer_id
           JOIN publishers pub ON pub.id = ap.publisher_id
           WHERE ap.publisher_id = wg.id AND LOWER(TRIM(dev.name)) != LOWER(TRIM(pub.name)))::INT
        ELSE (SELECT COUNT(DISTINCT pub.id) FROM app_developers ad
              JOIN app_publishers ap ON ap.appid = ad.appid JOIN publishers pub ON pub.id = ap.publisher_id
              JOIN developers dev ON dev.id = ad.developer_id
              WHERE ad.developer_id = wg.id AND LOWER(TRIM(pub.name)) != LOWER(TRIM(dev.name)))::INT
        END AS ext_partner_count,
        CASE WHEN wg.type = 'publisher' THEN
          (SELECT MAX(a.release_date) FROM app_publishers ap JOIN apps a ON a.appid = ap.appid WHERE ap.publisher_id = wg.id AND a.release_date IS NOT NULL)
        ELSE (SELECT MAX(a.release_date) FROM app_developers ad JOIN apps a ON a.appid = ad.appid WHERE ad.developer_id = wg.id AND a.release_date IS NOT NULL)
        END AS latest_rel_date
      FROM with_growth wg
    ),
    final_filtered AS (
      SELECT * FROM with_relationships wr
      WHERE (p_min_growth_7d IS NULL OR wr.ccu_growth_7d_pct >= p_min_growth_7d)
        AND (p_max_growth_7d IS NULL OR wr.ccu_growth_7d_pct <= p_max_growth_7d)
        AND (p_min_growth_30d IS NULL OR wr.ccu_growth_30d_pct >= p_min_growth_30d)
        AND (p_max_growth_30d IS NULL OR wr.ccu_growth_30d_pct <= p_max_growth_30d)
        AND (p_relationship IS NULL
             OR (p_relationship = 'self_published' AND wr.is_self_pub = TRUE)
             OR (p_relationship = 'external_devs' AND wr.is_self_pub = FALSE AND wr.type = 'publisher')
             OR (p_relationship = 'multi_publisher' AND wr.ext_partner_count > 1 AND wr.type = 'developer'))
    )
    SELECT ff.id, ff.name, ff.type, ff.game_count, ff.total_owners, ff.total_ccu, ff.estimated_weekly_hours,
      ff.total_reviews, ff.positive_reviews, ff.avg_review_score, ff.revenue_estimate_cents,
      ff.games_trending_up, ff.games_trending_down, ff.ccu_growth_7d_pct, ff.ccu_growth_30d_pct,
      ff.review_vel_7d, ff.review_vel_30d, ff.is_self_pub, (ff.ext_partner_count > 0),
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
          WHEN 'ccu_growth_7d' THEN ff.ccu_growth_7d_pct WHEN 'ccu_growth_30d' THEN ff.ccu_growth_30d_pct
          WHEN 'review_velocity_7d' THEN ff.review_vel_7d ELSE ff.estimated_weekly_hours END
      END ASC NULLS LAST,
      CASE WHEN p_sort_order = 'desc' THEN
        CASE p_sort_by
          WHEN 'estimated_weekly_hours' THEN ff.estimated_weekly_hours WHEN 'game_count' THEN ff.game_count
          WHEN 'total_owners' THEN ff.total_owners WHEN 'total_ccu' THEN ff.total_ccu
          WHEN 'avg_review_score' THEN ff.avg_review_score WHEN 'total_reviews' THEN ff.total_reviews
          WHEN 'revenue_estimate_cents' THEN ff.revenue_estimate_cents WHEN 'games_trending_up' THEN ff.games_trending_up
          WHEN 'ccu_growth_7d' THEN ff.ccu_growth_7d_pct WHEN 'ccu_growth_30d' THEN ff.ccu_growth_30d_pct
          WHEN 'review_velocity_7d' THEN ff.review_vel_7d ELSE ff.estimated_weekly_hours END
      END DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_companies_with_filters IS
'Unified RPC for /companies page. Returns both publishers and developers with metrics.
Optimized with two code paths:
- Fast path: when no growth/relationship filters are applied
- Slow path: when growth filtering or sorting is needed (computes growth for all matches)';

-- ============================================================================
-- RPC 2: get_companies_aggregate_stats
-- Returns aggregate statistics for filtered results
-- ============================================================================

CREATE OR REPLACE FUNCTION get_companies_aggregate_stats(
  p_type TEXT DEFAULT 'all',
  p_search TEXT DEFAULT NULL,
  p_min_games INT DEFAULT NULL,
  p_max_games INT DEFAULT NULL,
  p_min_owners BIGINT DEFAULT NULL,
  p_min_ccu INT DEFAULT NULL,
  p_min_hours BIGINT DEFAULT NULL,
  p_min_revenue BIGINT DEFAULT NULL,
  p_min_score INT DEFAULT NULL,
  p_min_reviews INT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_genres INT[] DEFAULT NULL,
  p_tags INT[] DEFAULT NULL,
  p_categories INT[] DEFAULT NULL
)
RETURNS TABLE (
  total_companies BIGINT,
  total_games BIGINT,
  total_owners BIGINT,
  total_revenue BIGINT,
  avg_review_score DECIMAL,
  total_ccu BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT pm.game_count, pm.total_owners, pm.revenue_estimate_cents, pm.avg_review_score, pm.total_ccu,
           pm.games_released_last_year, p.id, p.name, 'publisher'::TEXT AS type
    FROM publishers p LEFT JOIN publisher_metrics pm ON pm.publisher_id = p.id
    WHERE (p_type = 'all' OR p_type = 'publisher') AND p.game_count > 0
    UNION ALL
    SELECT dm.game_count, dm.total_owners, dm.revenue_estimate_cents, dm.avg_review_score, dm.total_ccu,
           dm.games_released_last_year, d.id, d.name, 'developer'::TEXT
    FROM developers d LEFT JOIN developer_metrics dm ON dm.developer_id = d.id
    WHERE (p_type = 'all' OR p_type = 'developer') AND d.game_count > 0
  ),
  filtered AS (
    SELECT b.* FROM base b
    WHERE (p_search IS NULL OR b.name ILIKE '%' || p_search || '%')
      AND (p_min_games IS NULL OR b.game_count >= p_min_games)
      AND (p_max_games IS NULL OR b.game_count <= p_max_games)
      AND (p_min_owners IS NULL OR b.total_owners >= p_min_owners)
      AND (p_min_ccu IS NULL OR b.total_ccu >= p_min_ccu)
      AND (p_min_revenue IS NULL OR b.revenue_estimate_cents >= p_min_revenue)
      AND (p_min_score IS NULL OR b.avg_review_score >= p_min_score)
      AND (p_status IS NULL
           OR (p_status = 'active' AND b.games_released_last_year > 0)
           OR (p_status = 'dormant' AND COALESCE(b.games_released_last_year, 0) = 0))
      AND (p_genres IS NULL OR EXISTS (
        SELECT 1 FROM app_genres ag JOIN app_publishers ap ON ap.appid = ag.appid
        WHERE ap.publisher_id = b.id AND b.type = 'publisher' AND ag.genre_id = ANY(p_genres)
        UNION SELECT 1 FROM app_genres ag JOIN app_developers ad ON ad.appid = ag.appid
        WHERE ad.developer_id = b.id AND b.type = 'developer' AND ag.genre_id = ANY(p_genres)))
      AND (p_tags IS NULL OR EXISTS (
        SELECT 1 FROM app_steam_tags ast JOIN app_publishers ap ON ap.appid = ast.appid
        WHERE ap.publisher_id = b.id AND b.type = 'publisher' AND ast.tag_id = ANY(p_tags)
        UNION SELECT 1 FROM app_steam_tags ast JOIN app_developers ad ON ad.appid = ast.appid
        WHERE ad.developer_id = b.id AND b.type = 'developer' AND ast.tag_id = ANY(p_tags)))
      AND (p_categories IS NULL OR EXISTS (
        SELECT 1 FROM app_categories ac JOIN app_publishers ap ON ap.appid = ac.appid
        WHERE ap.publisher_id = b.id AND b.type = 'publisher' AND ac.category_id = ANY(p_categories)
        UNION SELECT 1 FROM app_categories ac JOIN app_developers ad ON ad.appid = ac.appid
        WHERE ad.developer_id = b.id AND b.type = 'developer' AND ac.category_id = ANY(p_categories)))
  )
  SELECT COUNT(*)::BIGINT, COALESCE(SUM(f.game_count), 0)::BIGINT, COALESCE(SUM(f.total_owners), 0)::BIGINT,
         COALESCE(SUM(f.revenue_estimate_cents), 0)::BIGINT, ROUND(AVG(f.avg_review_score), 1)::DECIMAL,
         COALESCE(SUM(f.total_ccu), 0)::BIGINT
  FROM filtered f;
END;
$$;

COMMENT ON FUNCTION get_companies_aggregate_stats IS 'Returns aggregate stats for filtered companies';

-- ============================================================================
-- RPC 3: get_company_sparkline_data
-- ============================================================================

CREATE OR REPLACE FUNCTION get_company_sparkline_data(
  p_company_id INT,
  p_company_type TEXT,
  p_days INT DEFAULT 7
)
RETURNS TABLE (day DATE, total_ccu BIGINT, peak_ccu BIGINT)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_company_type = 'publisher' THEN
    RETURN QUERY
    SELECT DATE(cs.snapshot_time), SUM(cs.player_count)::BIGINT, MAX(cs.player_count)::BIGINT
    FROM ccu_snapshots cs JOIN app_publishers ap ON ap.appid = cs.appid
    WHERE ap.publisher_id = p_company_id AND cs.snapshot_time > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY DATE(cs.snapshot_time) ORDER BY DATE(cs.snapshot_time);
  ELSE
    RETURN QUERY
    SELECT DATE(cs.snapshot_time), SUM(cs.player_count)::BIGINT, MAX(cs.player_count)::BIGINT
    FROM ccu_snapshots cs JOIN app_developers ad ON ad.appid = cs.appid
    WHERE ad.developer_id = p_company_id AND cs.snapshot_time > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY DATE(cs.snapshot_time) ORDER BY DATE(cs.snapshot_time);
  END IF;
END;
$$;

COMMENT ON FUNCTION get_company_sparkline_data IS 'Returns daily CCU for sparklines';

-- ============================================================================
-- RPC 4: get_filter_option_counts
-- ============================================================================

CREATE OR REPLACE FUNCTION get_filter_option_counts(
  p_filter_type TEXT,
  p_company_type TEXT DEFAULT 'all',
  p_min_games INT DEFAULT NULL,
  p_min_revenue BIGINT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (option_id INT, option_name TEXT, company_count BIGINT)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_filter_type = 'genre' THEN
    RETURN QUERY
    SELECT sg.genre_id, sg.name,
      (CASE WHEN p_company_type IN ('all', 'publisher') THEN
        (SELECT COUNT(DISTINCT ap.publisher_id) FROM app_genres ag JOIN app_publishers ap ON ap.appid = ag.appid
         JOIN publishers p ON p.id = ap.publisher_id LEFT JOIN publisher_metrics pm ON pm.publisher_id = p.id
         WHERE ag.genre_id = sg.genre_id AND (p_min_games IS NULL OR p.game_count >= p_min_games)
           AND (p_min_revenue IS NULL OR pm.revenue_estimate_cents >= p_min_revenue)
           AND (p_status IS NULL OR (p_status = 'active' AND pm.games_released_last_year > 0)
                OR (p_status = 'dormant' AND COALESCE(pm.games_released_last_year, 0) = 0)))
       ELSE 0 END +
       CASE WHEN p_company_type IN ('all', 'developer') THEN
        (SELECT COUNT(DISTINCT ad.developer_id) FROM app_genres ag JOIN app_developers ad ON ad.appid = ag.appid
         JOIN developers d ON d.id = ad.developer_id LEFT JOIN developer_metrics dm ON dm.developer_id = d.id
         WHERE ag.genre_id = sg.genre_id AND (p_min_games IS NULL OR d.game_count >= p_min_games)
           AND (p_min_revenue IS NULL OR dm.revenue_estimate_cents >= p_min_revenue)
           AND (p_status IS NULL OR (p_status = 'active' AND dm.games_released_last_year > 0)
                OR (p_status = 'dormant' AND COALESCE(dm.games_released_last_year, 0) = 0)))
       ELSE 0 END)::BIGINT
    FROM steam_genres sg WHERE EXISTS (SELECT 1 FROM app_genres ag WHERE ag.genre_id = sg.genre_id)
    ORDER BY 3 DESC, 2;
  ELSIF p_filter_type = 'tag' THEN
    RETURN QUERY
    SELECT st.tag_id, st.name,
      (CASE WHEN p_company_type IN ('all', 'publisher') THEN
        (SELECT COUNT(DISTINCT ap.publisher_id) FROM app_steam_tags ast JOIN app_publishers ap ON ap.appid = ast.appid
         JOIN publishers p ON p.id = ap.publisher_id WHERE ast.tag_id = st.tag_id
           AND (p_min_games IS NULL OR p.game_count >= p_min_games))
       ELSE 0 END +
       CASE WHEN p_company_type IN ('all', 'developer') THEN
        (SELECT COUNT(DISTINCT ad.developer_id) FROM app_steam_tags ast JOIN app_developers ad ON ad.appid = ast.appid
         JOIN developers d ON d.id = ad.developer_id WHERE ast.tag_id = st.tag_id
           AND (p_min_games IS NULL OR d.game_count >= p_min_games))
       ELSE 0 END)::BIGINT
    FROM steam_tags st WHERE EXISTS (SELECT 1 FROM app_steam_tags ast WHERE ast.tag_id = st.tag_id)
    ORDER BY 3 DESC, 2 LIMIT 50;
  ELSIF p_filter_type = 'category' THEN
    RETURN QUERY
    SELECT sc.category_id, sc.name,
      (CASE WHEN p_company_type IN ('all', 'publisher') THEN
        (SELECT COUNT(DISTINCT ap.publisher_id) FROM app_categories ac JOIN app_publishers ap ON ap.appid = ac.appid
         JOIN publishers p ON p.id = ap.publisher_id WHERE ac.category_id = sc.category_id
           AND (p_min_games IS NULL OR p.game_count >= p_min_games))
       ELSE 0 END +
       CASE WHEN p_company_type IN ('all', 'developer') THEN
        (SELECT COUNT(DISTINCT ad.developer_id) FROM app_categories ac JOIN app_developers ad ON ad.appid = ac.appid
         JOIN developers d ON d.id = ad.developer_id WHERE ac.category_id = sc.category_id
           AND (p_min_games IS NULL OR d.game_count >= p_min_games))
       ELSE 0 END)::BIGINT
    FROM steam_categories sc WHERE EXISTS (SELECT 1 FROM app_categories ac WHERE ac.category_id = sc.category_id)
    ORDER BY 3 DESC, 2;
  ELSIF p_filter_type = 'steam_deck' THEN
    RETURN QUERY
    SELECT CASE asd.category WHEN 'verified' THEN 1 WHEN 'playable' THEN 2 WHEN 'unsupported' THEN 3 ELSE 4 END,
           asd.category::TEXT, COUNT(DISTINCT CASE WHEN p_company_type IN ('all', 'publisher') THEN ap.publisher_id END)
                             + COUNT(DISTINCT CASE WHEN p_company_type IN ('all', 'developer') THEN ad.developer_id END)
    FROM app_steam_deck asd
    LEFT JOIN app_publishers ap ON ap.appid = asd.appid
    LEFT JOIN app_developers ad ON ad.appid = asd.appid
    GROUP BY asd.category ORDER BY 1;
  ELSE RETURN;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_filter_option_counts IS 'Returns counts for filter dropdowns';

-- Permissions
GRANT EXECUTE ON FUNCTION get_companies_with_filters TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_companies_aggregate_stats TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_company_sparkline_data TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_filter_option_counts TO anon, authenticated, service_role;
