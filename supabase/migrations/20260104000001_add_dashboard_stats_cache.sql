-- Migration: Add dashboard stats cache table
-- Solves: Homepage and admin dashboard showing "0" counts on cold start
-- The cache table stores pre-computed counts that persist across server restarts

-- =============================================================================
-- Create the cache table
-- =============================================================================
CREATE TABLE IF NOT EXISTS dashboard_stats_cache (
  id TEXT PRIMARY KEY DEFAULT 'main',
  apps_count BIGINT DEFAULT 0,
  publishers_count BIGINT DEFAULT 0,
  developers_count BIGINT DEFAULT 0,
  pics_synced BIGINT DEFAULT 0,
  categories_count BIGINT DEFAULT 0,
  genres_count BIGINT DEFAULT 0,
  tags_count BIGINT DEFAULT 0,
  franchises_count BIGINT DEFAULT 0,
  parent_app_count BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Create refresh function
-- This function updates all cached stats in a single transaction
-- =============================================================================
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
  -- Upsert to handle both initial insert and updates
  INSERT INTO dashboard_stats_cache (
    id,
    apps_count,
    publishers_count,
    developers_count,
    pics_synced,
    categories_count,
    genres_count,
    tags_count,
    franchises_count,
    parent_app_count,
    updated_at
  )
  SELECT
    'main',
    (SELECT COUNT(*) FROM apps),
    (SELECT COUNT(*) FROM publishers),
    (SELECT COUNT(*) FROM developers),
    (SELECT COUNT(*) FROM sync_status WHERE is_syncable = TRUE AND last_pics_sync IS NOT NULL),
    (SELECT COUNT(DISTINCT appid) FROM app_categories),
    (SELECT COUNT(DISTINCT appid) FROM app_genres),
    (SELECT COUNT(DISTINCT appid) FROM app_steam_tags),
    (SELECT COUNT(DISTINCT appid) FROM app_franchises),
    (SELECT COUNT(*) FROM apps WHERE parent_appid IS NOT NULL),
    NOW()
  ON CONFLICT (id) DO UPDATE SET
    apps_count = EXCLUDED.apps_count,
    publishers_count = EXCLUDED.publishers_count,
    developers_count = EXCLUDED.developers_count,
    pics_synced = EXCLUDED.pics_synced,
    categories_count = EXCLUDED.categories_count,
    genres_count = EXCLUDED.genres_count,
    tags_count = EXCLUDED.tags_count,
    franchises_count = EXCLUDED.franchises_count,
    parent_app_count = EXCLUDED.parent_app_count,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Grant permissions
-- =============================================================================
GRANT SELECT ON dashboard_stats_cache TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION refresh_dashboard_stats() TO service_role;

-- =============================================================================
-- Initialize the cache with actual data
-- NOTE: This runs 9 COUNT queries. On large databases, this may take 10-30 seconds.
-- If you prefer, comment out this line and run it manually during off-peak hours.
-- =============================================================================
SELECT refresh_dashboard_stats();

-- =============================================================================
-- Update get_pics_data_stats to use cache table
-- This replaces the expensive COUNT queries with a simple cache lookup
-- =============================================================================
CREATE OR REPLACE FUNCTION get_pics_data_stats()
RETURNS TABLE(
  total_apps BIGINT,
  with_pics_sync BIGINT,
  with_categories BIGINT,
  with_genres BIGINT,
  with_tags BIGINT,
  with_franchises BIGINT,
  with_parent_app BIGINT
) AS $$
DECLARE
  cached_data RECORD;
BEGIN
  -- Try to get data from cache first
  SELECT * INTO cached_data FROM dashboard_stats_cache WHERE id = 'main';

  -- If cache exists and has valid data, use it
  IF cached_data IS NOT NULL AND cached_data.apps_count > 0 THEN
    RETURN QUERY
    SELECT
      cached_data.apps_count,
      cached_data.pics_synced,
      cached_data.categories_count,
      cached_data.genres_count,
      cached_data.tags_count,
      cached_data.franchises_count,
      cached_data.parent_app_count;
    RETURN;
  END IF;

  -- Fallback to direct queries if cache is empty
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM sync_status WHERE is_syncable = TRUE),
    (SELECT COUNT(*) FROM sync_status WHERE is_syncable = TRUE AND last_pics_sync IS NOT NULL),
    (SELECT COUNT(DISTINCT appid) FROM app_categories),
    (SELECT COUNT(DISTINCT appid) FROM app_genres),
    (SELECT COUNT(DISTINCT appid) FROM app_steam_tags),
    (SELECT COUNT(DISTINCT appid) FROM app_franchises),
    (SELECT COUNT(*) FROM apps WHERE parent_appid IS NOT NULL);
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- MANUAL STEP REQUIRED: Set up Supabase cron job
-- Run this in the Supabase SQL Editor after the migration:
--
-- SELECT cron.schedule(
--   'refresh-dashboard-stats',
--   '*/30 * * * *',
--   $$ SELECT refresh_dashboard_stats() $$
-- );
-- =============================================================================
