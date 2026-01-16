-- =============================================================================
-- Migration: App Filter Data Materialized View
-- Performance optimization for Games page content filters (genres, tags, categories)
--
-- Problem: EXISTS subqueries scanning junction tables (140K+ rows each) per row
-- Solution: Pre-compute content arrays into a materialized view with GIN indexes
--
-- Expected performance improvement: 90%+ speedup for content filter queries
-- Refresh strategy: Every 6 hours via GitHub Action (content changes rarely)
-- =============================================================================

-- ============================================================================
-- Create materialized view: app_filter_data
-- Pre-computes expensive junction table data into array columns
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS app_filter_data AS
SELECT
  a.appid,

  -- Content arrays (eliminates junction table JOINs)
  COALESCE(
    ARRAY_AGG(DISTINCT ag.genre_id) FILTER (WHERE ag.genre_id IS NOT NULL),
    ARRAY[]::INT[]
  ) AS genre_ids,

  COALESCE(
    ARRAY_AGG(DISTINCT ast.tag_id) FILTER (WHERE ast.tag_id IS NOT NULL),
    ARRAY[]::INT[]
  ) AS tag_ids,

  COALESCE(
    ARRAY_AGG(DISTINCT ac.category_id) FILTER (WHERE ac.category_id IS NOT NULL),
    ARRAY[]::INT[]
  ) AS category_ids,

  -- Pre-computed booleans for common filters
  30 = ANY(ARRAY_AGG(DISTINCT ac.category_id) FILTER (WHERE ac.category_id IS NOT NULL)) AS has_workshop,

  -- Platform array for fast filtering (derived from apps.platforms text field)
  ARRAY_REMOVE(ARRAY[
    CASE WHEN a.platforms LIKE '%windows%' THEN 'windows' END,
    CASE WHEN a.platforms LIKE '%macos%' THEN 'macos' END,
    CASE WHEN a.platforms LIKE '%linux%' THEN 'linux' END
  ], NULL) AS platform_array,

  -- Steam Deck category (from app_steam_deck)
  asd.category AS steam_deck_category,

  -- Publisher data (eliminates LATERAL subqueries)
  pub_data.publisher_id,
  pub_data.publisher_name,
  pub_data.publisher_game_count,

  -- Developer data (eliminates LATERAL subqueries)
  dev_data.developer_id,
  dev_data.developer_name

FROM apps a

-- Junction tables for content arrays
LEFT JOIN app_genres ag ON ag.appid = a.appid
LEFT JOIN app_steam_tags ast ON ast.appid = a.appid
LEFT JOIN app_categories ac ON ac.appid = a.appid

-- Steam Deck compatibility
LEFT JOIN app_steam_deck asd ON asd.appid = a.appid

-- Publisher data via LATERAL (executed once during materialization, not per query)
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

-- Developer data via LATERAL
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

GROUP BY
  a.appid,
  a.platforms,
  asd.category,
  pub_data.publisher_id,
  pub_data.publisher_name,
  pub_data.publisher_game_count,
  dev_data.developer_id,
  dev_data.developer_name;


-- ============================================================================
-- Create indexes for fast lookups
-- ============================================================================

-- Primary key for CONCURRENTLY refresh and fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_filter_data_appid
  ON app_filter_data(appid);

-- GIN indexes for array containment operators (&&, @>)
CREATE INDEX IF NOT EXISTS idx_app_filter_data_genre_ids
  ON app_filter_data USING gin(genre_ids);

CREATE INDEX IF NOT EXISTS idx_app_filter_data_tag_ids
  ON app_filter_data USING gin(tag_ids);

CREATE INDEX IF NOT EXISTS idx_app_filter_data_category_ids
  ON app_filter_data USING gin(category_ids);

CREATE INDEX IF NOT EXISTS idx_app_filter_data_platform_array
  ON app_filter_data USING gin(platform_array);

-- B-tree indexes for scalar lookups
CREATE INDEX IF NOT EXISTS idx_app_filter_data_steam_deck
  ON app_filter_data(steam_deck_category)
  WHERE steam_deck_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_filter_data_has_workshop
  ON app_filter_data(has_workshop)
  WHERE has_workshop = TRUE;

CREATE INDEX IF NOT EXISTS idx_app_filter_data_publisher_id
  ON app_filter_data(publisher_id)
  WHERE publisher_id IS NOT NULL;


-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON MATERIALIZED VIEW app_filter_data IS
  'Pre-computed content filter data for Games page. Eliminates expensive junction table JOINs. Refresh every 6 hours.';

COMMENT ON INDEX idx_app_filter_data_genre_ids IS
  'GIN index for genre array containment - enables fast && and @> operators';

COMMENT ON INDEX idx_app_filter_data_tag_ids IS
  'GIN index for tag array containment - enables fast && and @> operators';

COMMENT ON INDEX idx_app_filter_data_category_ids IS
  'GIN index for category array containment - enables fast && and @> operators';


-- ============================================================================
-- Grant permissions
-- ============================================================================

GRANT SELECT ON app_filter_data TO anon, authenticated, service_role;
