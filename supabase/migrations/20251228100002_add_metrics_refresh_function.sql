-- Migration: Add refresh function for entity metrics materialized views
-- Purpose: Provide a single function to refresh both developer and publisher metrics
-- Can be called from admin panel or scheduled via GitHub Actions

-- =============================================
-- REFRESH FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION refresh_entity_metrics()
RETURNS void AS $$
BEGIN
  -- Use CONCURRENTLY to avoid locking reads during refresh
  REFRESH MATERIALIZED VIEW CONCURRENTLY developer_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY publisher_metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION refresh_entity_metrics() TO service_role;

-- =============================================
-- RPC FUNCTION: Get developers with metrics
-- =============================================

-- This function provides server-side filtering and sorting on metrics
-- which is more efficient than client-side filtering after JOIN
CREATE OR REPLACE FUNCTION get_developers_with_metrics(
  p_search TEXT DEFAULT NULL,
  p_min_owners BIGINT DEFAULT NULL,
  p_min_ccu BIGINT DEFAULT NULL,
  p_min_score SMALLINT DEFAULT NULL,
  p_min_games INTEGER DEFAULT NULL,
  p_status TEXT DEFAULT NULL,  -- 'active', 'dormant', or NULL for all
  p_sort_field TEXT DEFAULT 'game_count',
  p_sort_order TEXT DEFAULT 'desc',
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  normalized_name TEXT,
  steam_vanity_url TEXT,
  first_game_release_date DATE,
  game_count INTEGER,
  total_owners_min BIGINT,
  total_owners_max BIGINT,
  total_ccu_peak BIGINT,
  max_ccu_peak INTEGER,
  total_reviews BIGINT,
  weighted_review_score SMALLINT,
  estimated_revenue_usd BIGINT,
  games_trending_up INTEGER,
  games_trending_down INTEGER,
  games_released_last_year INTEGER,
  computed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.name,
    d.normalized_name,
    d.steam_vanity_url,
    d.first_game_release_date,
    d.game_count,
    COALESCE(dm.total_owners_min, 0)::BIGINT,
    COALESCE(dm.total_owners_max, 0)::BIGINT,
    COALESCE(dm.total_ccu_peak, 0)::BIGINT,
    COALESCE(dm.max_ccu_peak, 0)::INTEGER,
    COALESCE(dm.total_reviews, 0)::BIGINT,
    dm.weighted_review_score,
    COALESCE(dm.estimated_revenue_usd, 0)::BIGINT,
    COALESCE(dm.games_trending_up, 0)::INTEGER,
    COALESCE(dm.games_trending_down, 0)::INTEGER,
    COALESCE(dm.games_released_last_year, 0)::INTEGER,
    dm.computed_at
  FROM developers d
  LEFT JOIN developer_metrics dm ON dm.developer_id = d.id
  WHERE
    -- Search filter
    (p_search IS NULL OR d.name ILIKE '%' || p_search || '%')
    -- Metric threshold filters
    AND (p_min_owners IS NULL OR COALESCE(dm.total_owners_max, 0) >= p_min_owners)
    AND (p_min_ccu IS NULL OR COALESCE(dm.total_ccu_peak, 0) >= p_min_ccu)
    AND (p_min_score IS NULL OR COALESCE(dm.weighted_review_score, 0) >= p_min_score)
    AND (p_min_games IS NULL OR d.game_count >= p_min_games)
    -- Activity status filter
    AND (
      p_status IS NULL
      OR (p_status = 'active' AND COALESCE(dm.games_released_last_year, 0) > 0)
      OR (p_status = 'dormant' AND COALESCE(dm.games_released_last_year, 0) = 0)
    )
  ORDER BY
    CASE WHEN p_sort_order = 'asc' THEN
      CASE p_sort_field
        WHEN 'name' THEN d.name
        ELSE NULL
      END
    END ASC NULLS LAST,
    CASE WHEN p_sort_order = 'desc' THEN
      CASE p_sort_field
        WHEN 'name' THEN d.name
        ELSE NULL
      END
    END DESC NULLS LAST,
    CASE WHEN p_sort_order = 'asc' THEN
      CASE p_sort_field
        WHEN 'game_count' THEN d.game_count
        WHEN 'total_owners_max' THEN COALESCE(dm.total_owners_max, 0)
        WHEN 'total_ccu_peak' THEN COALESCE(dm.total_ccu_peak, 0)
        WHEN 'weighted_review_score' THEN COALESCE(dm.weighted_review_score, 0)
        WHEN 'estimated_revenue_usd' THEN COALESCE(dm.estimated_revenue_usd, 0)
        WHEN 'games_trending_up' THEN COALESCE(dm.games_trending_up, 0)
        ELSE d.game_count
      END
    END ASC NULLS LAST,
    CASE WHEN p_sort_order = 'desc' THEN
      CASE p_sort_field
        WHEN 'game_count' THEN d.game_count
        WHEN 'total_owners_max' THEN COALESCE(dm.total_owners_max, 0)
        WHEN 'total_ccu_peak' THEN COALESCE(dm.total_ccu_peak, 0)
        WHEN 'weighted_review_score' THEN COALESCE(dm.weighted_review_score, 0)
        WHEN 'estimated_revenue_usd' THEN COALESCE(dm.estimated_revenue_usd, 0)
        WHEN 'games_trending_up' THEN COALESCE(dm.games_trending_up, 0)
        ELSE d.game_count
      END
    END DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- RPC FUNCTION: Get publishers with metrics
-- =============================================

CREATE OR REPLACE FUNCTION get_publishers_with_metrics(
  p_search TEXT DEFAULT NULL,
  p_min_owners BIGINT DEFAULT NULL,
  p_min_ccu BIGINT DEFAULT NULL,
  p_min_score SMALLINT DEFAULT NULL,
  p_min_games INTEGER DEFAULT NULL,
  p_min_developers INTEGER DEFAULT NULL,
  p_status TEXT DEFAULT NULL,  -- 'active', 'dormant', or NULL for all
  p_sort_field TEXT DEFAULT 'game_count',
  p_sort_order TEXT DEFAULT 'desc',
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  normalized_name TEXT,
  steam_vanity_url TEXT,
  first_game_release_date DATE,
  game_count INTEGER,
  total_owners_min BIGINT,
  total_owners_max BIGINT,
  total_ccu_peak BIGINT,
  max_ccu_peak INTEGER,
  total_reviews BIGINT,
  weighted_review_score SMALLINT,
  estimated_revenue_usd BIGINT,
  games_trending_up INTEGER,
  games_trending_down INTEGER,
  games_released_last_year INTEGER,
  unique_developers INTEGER,
  computed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.normalized_name,
    p.steam_vanity_url,
    p.first_game_release_date,
    p.game_count,
    COALESCE(pm.total_owners_min, 0)::BIGINT,
    COALESCE(pm.total_owners_max, 0)::BIGINT,
    COALESCE(pm.total_ccu_peak, 0)::BIGINT,
    COALESCE(pm.max_ccu_peak, 0)::INTEGER,
    COALESCE(pm.total_reviews, 0)::BIGINT,
    pm.weighted_review_score,
    COALESCE(pm.estimated_revenue_usd, 0)::BIGINT,
    COALESCE(pm.games_trending_up, 0)::INTEGER,
    COALESCE(pm.games_trending_down, 0)::INTEGER,
    COALESCE(pm.games_released_last_year, 0)::INTEGER,
    COALESCE(pm.unique_developers, 0)::INTEGER,
    pm.computed_at
  FROM publishers p
  LEFT JOIN publisher_metrics pm ON pm.publisher_id = p.id
  WHERE
    -- Search filter
    (p_search IS NULL OR p.name ILIKE '%' || p_search || '%')
    -- Metric threshold filters
    AND (p_min_owners IS NULL OR COALESCE(pm.total_owners_max, 0) >= p_min_owners)
    AND (p_min_ccu IS NULL OR COALESCE(pm.total_ccu_peak, 0) >= p_min_ccu)
    AND (p_min_score IS NULL OR COALESCE(pm.weighted_review_score, 0) >= p_min_score)
    AND (p_min_games IS NULL OR p.game_count >= p_min_games)
    AND (p_min_developers IS NULL OR COALESCE(pm.unique_developers, 0) >= p_min_developers)
    -- Activity status filter
    AND (
      p_status IS NULL
      OR (p_status = 'active' AND COALESCE(pm.games_released_last_year, 0) > 0)
      OR (p_status = 'dormant' AND COALESCE(pm.games_released_last_year, 0) = 0)
    )
  ORDER BY
    CASE WHEN p_sort_order = 'asc' THEN
      CASE p_sort_field
        WHEN 'name' THEN p.name
        ELSE NULL
      END
    END ASC NULLS LAST,
    CASE WHEN p_sort_order = 'desc' THEN
      CASE p_sort_field
        WHEN 'name' THEN p.name
        ELSE NULL
      END
    END DESC NULLS LAST,
    CASE WHEN p_sort_order = 'asc' THEN
      CASE p_sort_field
        WHEN 'game_count' THEN p.game_count
        WHEN 'total_owners_max' THEN COALESCE(pm.total_owners_max, 0)
        WHEN 'total_ccu_peak' THEN COALESCE(pm.total_ccu_peak, 0)
        WHEN 'weighted_review_score' THEN COALESCE(pm.weighted_review_score, 0)
        WHEN 'estimated_revenue_usd' THEN COALESCE(pm.estimated_revenue_usd, 0)
        WHEN 'games_trending_up' THEN COALESCE(pm.games_trending_up, 0)
        WHEN 'unique_developers' THEN COALESCE(pm.unique_developers, 0)
        ELSE p.game_count
      END
    END ASC NULLS LAST,
    CASE WHEN p_sort_order = 'desc' THEN
      CASE p_sort_field
        WHEN 'game_count' THEN p.game_count
        WHEN 'total_owners_max' THEN COALESCE(pm.total_owners_max, 0)
        WHEN 'total_ccu_peak' THEN COALESCE(pm.total_ccu_peak, 0)
        WHEN 'weighted_review_score' THEN COALESCE(pm.weighted_review_score, 0)
        WHEN 'estimated_revenue_usd' THEN COALESCE(pm.estimated_revenue_usd, 0)
        WHEN 'games_trending_up' THEN COALESCE(pm.games_trending_up, 0)
        WHEN 'unique_developers' THEN COALESCE(pm.unique_developers, 0)
        ELSE p.game_count
      END
    END DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

GRANT EXECUTE ON FUNCTION get_developers_with_metrics TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_publishers_with_metrics TO anon, authenticated, service_role;

-- =============================================
-- STATS FUNCTIONS (Single query for all counts)
-- =============================================

-- Get developer stats in a single query instead of 4 separate COUNT queries
CREATE OR REPLACE FUNCTION get_developer_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
  one_year_ago DATE := CURRENT_DATE - INTERVAL '1 year';
BEGIN
  SELECT json_build_object(
    'total', COUNT(*),
    'prolific', COUNT(*) FILTER (WHERE game_count >= 5),
    'recentlyActive', COUNT(*) FILTER (WHERE first_game_release_date >= one_year_ago)
  ) INTO result
  FROM developers;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Get publisher stats in a single query instead of 4 separate COUNT queries
CREATE OR REPLACE FUNCTION get_publisher_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
  one_year_ago DATE := CURRENT_DATE - INTERVAL '1 year';
BEGIN
  SELECT json_build_object(
    'total', COUNT(*),
    'major', COUNT(*) FILTER (WHERE game_count >= 10),
    'recentlyActive', COUNT(*) FILTER (WHERE first_game_release_date >= one_year_ago)
  ) INTO result
  FROM publishers;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_developer_stats() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_publisher_stats() TO anon, authenticated, service_role;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON FUNCTION refresh_entity_metrics IS
  'Refreshes both developer_metrics and publisher_metrics materialized views concurrently';

COMMENT ON FUNCTION get_developers_with_metrics IS
  'Fetches developers with aggregated metrics, supporting server-side filtering and sorting';

COMMENT ON FUNCTION get_publishers_with_metrics IS
  'Fetches publishers with aggregated metrics, supporting server-side filtering and sorting';

COMMENT ON FUNCTION get_developer_stats IS
  'Returns developer counts (total, prolific, recently active) in a single query';

COMMENT ON FUNCTION get_publisher_stats IS
  'Returns publisher counts (total, major, recently active) in a single query';
