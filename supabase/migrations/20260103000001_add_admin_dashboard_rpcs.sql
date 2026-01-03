-- Migration: Add RPC functions for admin dashboard optimization
-- These functions consolidate multiple count queries into single database calls

-- =============================================================================
-- get_priority_distribution: Returns count of apps by priority tier
-- Replaces fetching ALL rows and counting in JavaScript
-- =============================================================================
CREATE OR REPLACE FUNCTION get_priority_distribution()
RETURNS TABLE(
  high BIGINT,
  medium BIGINT,
  normal_priority BIGINT,
  low BIGINT,
  minimal BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE priority_score >= 150) as high,
    COUNT(*) FILTER (WHERE priority_score >= 100 AND priority_score < 150) as medium,
    COUNT(*) FILTER (WHERE priority_score >= 50 AND priority_score < 100) as normal_priority,
    COUNT(*) FILTER (WHERE priority_score >= 25 AND priority_score < 50) as low,
    COUNT(*) FILTER (WHERE priority_score < 25 OR priority_score IS NULL) as minimal
  FROM sync_status
  WHERE is_syncable = TRUE;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- get_queue_status: Returns count of apps due for sync at different intervals
-- Replaces 4 separate count queries
-- =============================================================================
CREATE OR REPLACE FUNCTION get_queue_status()
RETURNS TABLE(
  overdue BIGINT,
  due_in_1_hour BIGINT,
  due_in_6_hours BIGINT,
  due_in_24_hours BIGINT
) AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE next_sync_after < v_now) as overdue,
    COUNT(*) FILTER (WHERE next_sync_after >= v_now AND next_sync_after < v_now + INTERVAL '1 hour') as due_in_1_hour,
    COUNT(*) FILTER (WHERE next_sync_after >= v_now AND next_sync_after < v_now + INTERVAL '6 hours') as due_in_6_hours,
    COUNT(*) FILTER (WHERE next_sync_after >= v_now AND next_sync_after < v_now + INTERVAL '24 hours') as due_in_24_hours
  FROM sync_status
  WHERE is_syncable = TRUE;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- get_source_completion_stats: Returns sync completion stats for all sources
-- Replaces 11 separate count queries
-- =============================================================================
CREATE OR REPLACE FUNCTION get_source_completion_stats()
RETURNS TABLE(
  source TEXT,
  total_apps BIGINT,
  synced_apps BIGINT,
  stale_apps BIGINT
) AS $$
DECLARE
  v_total BIGINT;
  v_steamspy_total BIGINT;
  v_one_day_ago TIMESTAMPTZ := NOW() - INTERVAL '1 day';
  v_seven_days_ago TIMESTAMPTZ := NOW() - INTERVAL '7 days';
BEGIN
  -- Get base totals
  SELECT COUNT(*) INTO v_total
  FROM sync_status WHERE is_syncable = TRUE;

  SELECT COUNT(*) INTO v_steamspy_total
  FROM sync_status
  WHERE is_syncable = TRUE
    AND (steamspy_available IS NULL OR steamspy_available = TRUE);

  RETURN QUERY
  -- SteamSpy
  SELECT
    'steamspy'::TEXT,
    v_steamspy_total,
    (SELECT COUNT(*) FROM sync_status WHERE is_syncable = TRUE AND last_steamspy_sync IS NOT NULL),
    (SELECT COUNT(*) FROM sync_status WHERE is_syncable = TRUE AND last_steamspy_sync IS NOT NULL AND last_steamspy_sync < v_one_day_ago)
  UNION ALL
  -- Storefront
  SELECT
    'storefront'::TEXT,
    v_total,
    (SELECT COUNT(*) FROM sync_status WHERE is_syncable = TRUE AND last_storefront_sync IS NOT NULL),
    (SELECT COUNT(*) FROM sync_status WHERE is_syncable = TRUE AND last_storefront_sync IS NOT NULL AND last_storefront_sync < v_one_day_ago)
  UNION ALL
  -- Reviews
  SELECT
    'reviews'::TEXT,
    v_total,
    (SELECT COUNT(*) FROM sync_status WHERE is_syncable = TRUE AND last_reviews_sync IS NOT NULL),
    (SELECT COUNT(*) FROM sync_status WHERE is_syncable = TRUE AND last_reviews_sync IS NOT NULL AND last_reviews_sync < v_one_day_ago)
  UNION ALL
  -- Histogram
  SELECT
    'histogram'::TEXT,
    v_total,
    (SELECT COUNT(*) FROM sync_status WHERE is_syncable = TRUE AND last_histogram_sync IS NOT NULL),
    (SELECT COUNT(*) FROM sync_status WHERE is_syncable = TRUE AND last_histogram_sync IS NOT NULL AND last_histogram_sync < v_seven_days_ago)
  UNION ALL
  -- Page Creation
  SELECT
    'page_creation'::TEXT,
    v_total,
    (SELECT COUNT(*) FROM sync_status WHERE is_syncable = TRUE AND last_page_creation_scrape IS NOT NULL),
    0::BIGINT;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- get_pics_data_stats: Returns PICS data completion statistics
-- Replaces 7 separate count queries
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
BEGIN
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

-- Grant execute permissions (adjust role as needed for your Supabase setup)
GRANT EXECUTE ON FUNCTION get_priority_distribution() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_queue_status() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_source_completion_stats() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_pics_data_stats() TO authenticated, anon, service_role;
