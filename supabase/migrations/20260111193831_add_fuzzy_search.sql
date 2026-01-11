-- Migration: Add fuzzy search RPC functions for spotlight search
-- Uses pg_trgm extension (already enabled) for similarity matching
-- Filters out low-quality data (storefront_accessible=false, <10 reviews)

-- Ensure pg_trgm extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram indexes for fast fuzzy search
CREATE INDEX IF NOT EXISTS idx_apps_name_trgm ON apps USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_publishers_name_trgm ON publishers USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_developers_name_trgm ON developers USING GIN (name gin_trgm_ops);

-- Index on sync_status.storefront_accessible for efficient join
CREATE INDEX IF NOT EXISTS idx_sync_status_storefront_accessible
  ON sync_status(storefront_accessible)
  WHERE storefront_accessible = false;

-- ============================================================================
-- RPC: Search games with fuzzy matching and quality filtering
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
  v_normalized_query TEXT;
  v_space_stripped_query TEXT;
BEGIN
  -- Normalize query: trim and lowercase
  v_normalized_query := LOWER(TRIM(p_query));
  -- Create space-stripped version for "from software" -> "fromsoftware" matching
  v_space_stripped_query := REPLACE(v_normalized_query, ' ', '');

  RETURN QUERY
  WITH candidates AS (
    SELECT
      a.appid,
      a.name,
      a.release_date,
      a.is_free,
      m.positive_percentage,
      m.total_reviews,
      -- Calculate similarity scores - take max of normal and space-stripped
      GREATEST(
        similarity(LOWER(a.name), v_normalized_query),
        similarity(LOWER(REPLACE(a.name, ' ', '')), v_space_stripped_query)
      ) AS sim_score,
      -- Check for exact substring match (case-insensitive)
      LOWER(a.name) ILIKE '%' || v_normalized_query || '%' AS exact_match
    FROM apps a
    LEFT JOIN latest_daily_metrics m ON m.appid = a.appid
    LEFT JOIN sync_status ss ON ss.appid = a.appid
    WHERE
      a.type = 'game'
      AND a.is_delisted = FALSE
      -- Filter out inaccessible apps (NULL means not synced yet, allow those)
      AND (ss.storefront_accessible IS NULL OR ss.storefront_accessible = TRUE)
      -- Quality filter: at least 10 reviews (or be an exact/fuzzy match override)
      AND (
        COALESCE(m.total_reviews, 0) >= 10
        OR LOWER(a.name) ILIKE '%' || v_normalized_query || '%'
        OR similarity(LOWER(REPLACE(a.name, ' ', '')), v_space_stripped_query) > 0.6
      )
      -- Fuzzy match threshold OR exact substring match
      AND (
        similarity(LOWER(a.name), v_normalized_query) > 0.3
        OR similarity(LOWER(REPLACE(a.name, ' ', '')), v_space_stripped_query) > 0.5
        OR LOWER(a.name) ILIKE '%' || v_normalized_query || '%'
      )
  )
  SELECT
    c.appid,
    c.name,
    c.release_date,
    c.is_free,
    c.positive_percentage,
    c.total_reviews::INTEGER,
    c.sim_score AS similarity_score,
    c.exact_match AS is_exact_match
  FROM candidates c
  ORDER BY
    -- Exact matches first
    c.exact_match DESC,
    -- Then by similarity score
    c.sim_score DESC,
    -- Then by review count (popularity)
    COALESCE(c.total_reviews, 0) DESC
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
  v_normalized_query TEXT;
  v_space_stripped_query TEXT;
BEGIN
  v_normalized_query := LOWER(TRIM(p_query));
  v_space_stripped_query := REPLACE(v_normalized_query, ' ', '');

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.game_count,
    GREATEST(
      similarity(LOWER(p.name), v_normalized_query),
      similarity(LOWER(REPLACE(p.name, ' ', '')), v_space_stripped_query)
    ) AS similarity_score,
    LOWER(p.name) ILIKE '%' || v_normalized_query || '%' AS is_exact_match
  FROM publishers p
  WHERE
    -- Must have at least 1 game
    p.game_count > 0
    AND (
      similarity(LOWER(p.name), v_normalized_query) > 0.3
      OR similarity(LOWER(REPLACE(p.name, ' ', '')), v_space_stripped_query) > 0.5
      OR LOWER(p.name) ILIKE '%' || v_normalized_query || '%'
    )
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
  v_normalized_query TEXT;
  v_space_stripped_query TEXT;
BEGIN
  v_normalized_query := LOWER(TRIM(p_query));
  v_space_stripped_query := REPLACE(v_normalized_query, ' ', '');

  RETURN QUERY
  SELECT
    d.id,
    d.name,
    d.game_count,
    GREATEST(
      similarity(LOWER(d.name), v_normalized_query),
      similarity(LOWER(REPLACE(d.name, ' ', '')), v_space_stripped_query)
    ) AS similarity_score,
    LOWER(d.name) ILIKE '%' || v_normalized_query || '%' AS is_exact_match
  FROM developers d
  WHERE
    d.game_count > 0
    AND (
      similarity(LOWER(d.name), v_normalized_query) > 0.3
      OR similarity(LOWER(REPLACE(d.name, ' ', '')), v_space_stripped_query) > 0.5
      OR LOWER(d.name) ILIKE '%' || v_normalized_query || '%'
    )
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
