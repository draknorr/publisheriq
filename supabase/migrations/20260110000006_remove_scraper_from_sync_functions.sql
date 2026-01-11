-- Migration: Remove 'scraper' case from sync functions
--
-- The page creation date scraper is being removed because PICS now provides
-- store_asset_mtime. Remove the 'scraper' case from sync functions since
-- the needs_page_creation_scrape column no longer exists.

-- Update get_apps_for_sync - remove scraper case
DROP FUNCTION IF EXISTS get_apps_for_sync(sync_source, INTEGER);

CREATE FUNCTION get_apps_for_sync(
    p_source sync_source,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (appid INTEGER, priority_score INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT s.appid, s.priority_score
    FROM sync_status s
    WHERE s.is_syncable = TRUE
      AND CASE p_source
          WHEN 'steamspy' THEN
            s.last_steamspy_sync IS NULL
            OR s.last_steamspy_sync < NOW() - (COALESCE(s.sync_interval_hours, 24) || ' hours')::INTERVAL
          WHEN 'storefront' THEN
            (s.last_storefront_sync IS NULL
             OR s.last_storefront_sync < NOW() - (COALESCE(s.sync_interval_hours, 24) || ' hours')::INTERVAL)
            AND (s.storefront_accessible IS NULL OR s.storefront_accessible = TRUE)
          WHEN 'reviews' THEN
            s.last_reviews_sync IS NULL
            OR s.last_reviews_sync < NOW() - (COALESCE(s.sync_interval_hours, 24) || ' hours')::INTERVAL
          WHEN 'histogram' THEN
            s.last_histogram_sync IS NULL
            OR s.last_histogram_sync < NOW() - INTERVAL '7 days'
          -- 'scraper' case removed - PICS now provides store_asset_mtime
          ELSE TRUE
      END
    ORDER BY
      -- Prioritize never-synced apps first
      CASE WHEN
        (p_source = 'storefront' AND s.last_storefront_sync IS NULL) OR
        (p_source = 'reviews' AND s.last_reviews_sync IS NULL) OR
        (p_source = 'steamspy' AND s.last_steamspy_sync IS NULL) OR
        (p_source = 'histogram' AND s.last_histogram_sync IS NULL)
      THEN 0 ELSE 1 END,
      s.priority_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_apps_for_sync IS
  'Returns apps due for sync. Scraper case removed - PICS now provides store_asset_mtime.';

-- Update partitioned version - remove scraper case
DROP FUNCTION IF EXISTS get_apps_for_sync_partitioned(sync_source, INTEGER, INTEGER, INTEGER);

CREATE FUNCTION get_apps_for_sync_partitioned(
  p_source sync_source,
  p_limit INTEGER,
  p_partition_count INTEGER,
  p_partition_id INTEGER
)
RETURNS TABLE(appid INTEGER, priority_score INTEGER) AS $$
BEGIN
  RETURN QUERY
  WITH eligible_apps AS (
    SELECT s.appid, s.priority_score,
           ROW_NUMBER() OVER (ORDER BY
             -- Prioritize never-synced apps first
             CASE WHEN
               (p_source = 'storefront' AND s.last_storefront_sync IS NULL) OR
               (p_source = 'reviews' AND s.last_reviews_sync IS NULL) OR
               (p_source = 'steamspy' AND s.last_steamspy_sync IS NULL) OR
               (p_source = 'histogram' AND s.last_histogram_sync IS NULL)
             THEN 0 ELSE 1 END,
             s.priority_score DESC
           ) as rn
    FROM sync_status s
    WHERE s.is_syncable = TRUE
      AND CASE p_source
          WHEN 'steamspy' THEN
            s.last_steamspy_sync IS NULL
            OR s.last_steamspy_sync < NOW() - (COALESCE(s.sync_interval_hours, 24) || ' hours')::INTERVAL
          WHEN 'storefront' THEN
            (s.last_storefront_sync IS NULL
             OR s.last_storefront_sync < NOW() - (COALESCE(s.sync_interval_hours, 24) || ' hours')::INTERVAL)
            AND (s.storefront_accessible IS NULL OR s.storefront_accessible = TRUE)
          WHEN 'reviews' THEN
            s.last_reviews_sync IS NULL
            OR s.last_reviews_sync < NOW() - (COALESCE(s.sync_interval_hours, 24) || ' hours')::INTERVAL
          WHEN 'histogram' THEN
            s.last_histogram_sync IS NULL
            OR s.last_histogram_sync < NOW() - INTERVAL '7 days'
          -- 'scraper' case removed - PICS now provides store_asset_mtime
          ELSE TRUE
      END
  )
  SELECT e.appid, e.priority_score
  FROM eligible_apps e
  WHERE (e.rn - 1) % p_partition_count = p_partition_id
  ORDER BY e.priority_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_apps_for_sync_partitioned IS
  'Returns apps due for sync, partitioned. Scraper case removed - PICS now provides store_asset_mtime.';
