-- Migration: Add fuzzy search RPC functions for spotlight search
-- Uses pg_trgm extension with GIN indexes for fast similarity matching
-- Filters out low-quality data (storefront_accessible=false, <10 reviews)

-- Ensure pg_trgm extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram indexes on LOWER(name) for fast % operator queries
CREATE INDEX IF NOT EXISTS idx_apps_name_lower_trgm ON apps USING GIN (LOWER(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_publishers_name_lower_trgm ON publishers USING GIN (LOWER(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_developers_name_lower_trgm ON developers USING GIN (LOWER(name) gin_trgm_ops);

-- Index on sync_status.storefront_accessible for efficient join
CREATE INDEX IF NOT EXISTS idx_sync_status_storefront_accessible
  ON sync_status(storefront_accessible)
  WHERE storefront_accessible = false;

-- ============================================================================
-- RPC: Search games with fuzzy matching and quality filtering
-- Uses % operator for GIN index scan, space-stripped similarity for ranking
-- ============================================================================
CREATE OR REPLACE FUNCTION search_games_fuzzy(
  p_query TEXT,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  appid INTEGER,
  name TEXT,
  release_date DATE,
  is_free BOOLEAN,
  positive_percentage NUMERIC,
  total_reviews INTEGER,
  similarity_score REAL,
  is_exact_match BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query TEXT;
  v_query_nospace TEXT;
BEGIN
  v_query := LOWER(TRIM(p_query));
  v_query_nospace := REPLACE(v_query, ' ', '');

  -- Set similarity threshold for % operator (uses GIN index)
  PERFORM set_config('pg_trgm.similarity_threshold', '0.3', true);

  RETURN QUERY
  SELECT
    a.appid,
    a.name,
    a.release_date,
    a.is_free,
    m.positive_percentage,
    m.total_reviews::INTEGER,
    -- Score includes space-stripped matching for "from software" -> "FromSoftware"
    GREATEST(
      similarity(LOWER(a.name), v_query),
      similarity(LOWER(REPLACE(a.name, ' ', '')), v_query_nospace)
    ) AS similarity_score,
    LOWER(a.name) ILIKE '%' || v_query || '%' AS is_exact_match
  FROM apps a
  LEFT JOIN latest_daily_metrics m ON m.appid = a.appid
  LEFT JOIN sync_status ss ON ss.appid = a.appid
  WHERE
    a.type = 'game'
    AND a.is_delisted = FALSE
    AND (ss.storefront_accessible IS NULL OR ss.storefront_accessible = TRUE)
    -- Quality filter: 10+ reviews or exact match
    AND (COALESCE(m.total_reviews, 0) >= 10 OR LOWER(a.name) ILIKE '%' || v_query || '%')
    -- Use % operator for index scan (fast), plus ILIKE for exact substring
    AND (LOWER(a.name) % v_query OR LOWER(a.name) ILIKE '%' || v_query || '%')
  ORDER BY
    is_exact_match DESC,
    similarity_score DESC,
    COALESCE(m.total_reviews, 0) DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- RPC: Search publishers with fuzzy matching
-- ============================================================================
CREATE OR REPLACE FUNCTION search_publishers_fuzzy(
  p_query TEXT,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  game_count INTEGER,
  similarity_score REAL,
  is_exact_match BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query TEXT;
  v_query_nospace TEXT;
BEGIN
  v_query := LOWER(TRIM(p_query));
  v_query_nospace := REPLACE(v_query, ' ', '');

  PERFORM set_config('pg_trgm.similarity_threshold', '0.3', true);

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.game_count,
    GREATEST(
      similarity(LOWER(p.name), v_query),
      similarity(LOWER(REPLACE(p.name, ' ', '')), v_query_nospace)
    ) AS similarity_score,
    LOWER(p.name) ILIKE '%' || v_query || '%' AS is_exact_match
  FROM publishers p
  WHERE
    p.game_count > 0
    AND (LOWER(p.name) % v_query OR LOWER(p.name) ILIKE '%' || v_query || '%')
  ORDER BY
    is_exact_match DESC,
    similarity_score DESC,
    p.game_count DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- RPC: Search developers with fuzzy matching
-- ============================================================================
CREATE OR REPLACE FUNCTION search_developers_fuzzy(
  p_query TEXT,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  game_count INTEGER,
  similarity_score REAL,
  is_exact_match BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query TEXT;
  v_query_nospace TEXT;
BEGIN
  v_query := LOWER(TRIM(p_query));
  v_query_nospace := REPLACE(v_query, ' ', '');

  PERFORM set_config('pg_trgm.similarity_threshold', '0.3', true);

  RETURN QUERY
  SELECT
    d.id,
    d.name,
    d.game_count,
    GREATEST(
      similarity(LOWER(d.name), v_query),
      similarity(LOWER(REPLACE(d.name, ' ', '')), v_query_nospace)
    ) AS similarity_score,
    LOWER(d.name) ILIKE '%' || v_query || '%' AS is_exact_match
  FROM developers d
  WHERE
    d.game_count > 0
    AND (LOWER(d.name) % v_query OR LOWER(d.name) ILIKE '%' || v_query || '%')
  ORDER BY
    is_exact_match DESC,
    similarity_score DESC,
    d.game_count DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_games_fuzzy(TEXT, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION search_publishers_fuzzy(TEXT, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION search_developers_fuzzy(TEXT, INTEGER) TO anon, authenticated, service_role;
