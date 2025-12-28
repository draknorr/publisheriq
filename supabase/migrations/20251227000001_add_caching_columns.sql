-- Migration: Add caching columns for Smart Caching Strategy
-- Purpose: Optimize sync operations by tracking developer info status and refresh tiers

-- =============================================
-- CREATE ENUM TYPE
-- =============================================

-- Refresh tier determines sync frequency based on app activity
CREATE TYPE refresh_tier AS ENUM ('active', 'moderate', 'dormant', 'dead');

-- =============================================
-- ADD NEW COLUMNS
-- =============================================

-- Track whether we've already fetched developer/publisher info from Storefront API
-- This prevents redundant API calls for apps that already have complete data
ALTER TABLE apps ADD COLUMN has_developer_info BOOLEAN DEFAULT FALSE;

-- Explicit refresh tier for dashboard clarity and sync scheduling
ALTER TABLE sync_status ADD COLUMN refresh_tier refresh_tier DEFAULT 'moderate';

-- Track when an app last had activity (new reviews, CCU changes, etc.)
-- Used for dormancy detection
ALTER TABLE sync_status ADD COLUMN last_activity_at TIMESTAMPTZ;

-- =============================================
-- CREATE INDEXES
-- =============================================

-- Index for quickly finding apps that still need developer info
CREATE INDEX idx_apps_needs_dev_info ON apps(appid) WHERE has_developer_info = FALSE;

-- Index for refresh tier queries
CREATE INDEX idx_sync_status_refresh_tier ON sync_status(refresh_tier);

-- =============================================
-- UPDATE FUNCTION: get_apps_for_sync
-- =============================================

-- Replace existing function to prioritize apps missing developer info
CREATE OR REPLACE FUNCTION get_apps_for_sync(p_source sync_source, p_limit INTEGER)
RETURNS TABLE(appid INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT s.appid
  FROM sync_status s
  JOIN apps a ON s.appid = a.appid
  WHERE s.is_syncable = TRUE
    AND s.next_sync_after <= NOW()
    AND (
      (p_source = 'storefront' AND (s.last_storefront_sync IS NULL OR s.last_storefront_sync < NOW() - INTERVAL '1 day'))
      OR (p_source = 'reviews' AND (s.last_reviews_sync IS NULL OR s.last_reviews_sync < NOW() - INTERVAL '1 day'))
      OR (p_source = 'histogram' AND (s.last_histogram_sync IS NULL OR s.last_histogram_sync < NOW() - INTERVAL '1 day'))
      OR (p_source = 'steamspy' AND (s.last_steamspy_sync IS NULL OR s.last_steamspy_sync < NOW() - INTERVAL '1 day'))
      OR (p_source = 'scraper' AND s.needs_page_creation_scrape = TRUE)
    )
  ORDER BY
    -- For storefront source, prioritize apps missing developer info
    CASE WHEN p_source = 'storefront' AND a.has_developer_info = FALSE THEN 0 ELSE 1 END,
    -- Then by priority score (higher priority = sync more often)
    s.priority_score DESC,
    -- Finally by when they're due
    s.next_sync_after ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- BACKFILL: Mark existing apps with developer info
-- =============================================

-- Apps that already have developers/publishers linked are considered complete
UPDATE apps a
SET has_developer_info = TRUE
WHERE EXISTS (
  SELECT 1 FROM app_developers ad WHERE ad.appid = a.appid
) OR EXISTS (
  SELECT 1 FROM app_publishers ap WHERE ap.appid = a.appid
);

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON COLUMN apps.has_developer_info IS
  'True if developer/publisher info has been fetched from Storefront API. Prevents redundant API calls.';

COMMENT ON COLUMN sync_status.refresh_tier IS
  'Sync frequency tier: active (6-12hr), moderate (24-48hr), dormant (weekly), dead (monthly+)';

COMMENT ON COLUMN sync_status.last_activity_at IS
  'Last time app showed activity (new reviews, CCU changes). Used for dormancy detection.';
