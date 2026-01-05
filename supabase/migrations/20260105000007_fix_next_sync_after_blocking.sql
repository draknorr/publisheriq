-- Migration: Remove next_sync_after blocking condition
--
-- The next_sync_after column was blocking 85,921 apps from syncing because it was set
-- to a future date. Since we now use sync_interval_hours to determine when apps need
-- syncing, the next_sync_after check is redundant and causing issues.
--
-- This migration:
-- 1. Updates get_apps_for_sync to remove the next_sync_after condition
-- 2. Updates get_apps_for_sync_partitioned to remove the next_sync_after condition
-- 3. Resets next_sync_after for apps that need syncing

-- Update get_apps_for_sync - remove next_sync_after condition
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
          WHEN 'scraper' THEN
            s.needs_page_creation_scrape = TRUE
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
  'Returns apps due for sync based on their individual sync_interval_hours. Removed next_sync_after blocking.';

-- Update partitioned version - remove next_sync_after condition
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
          WHEN 'scraper' THEN
            s.needs_page_creation_scrape = TRUE
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
  'Returns apps due for sync using tiered intervals, partitioned for parallel processing. Removed next_sync_after blocking.';

-- =============================================================================
-- Update get_queue_status to calculate "due" based on last_storefront_sync + interval
-- instead of next_sync_after (which is no longer the source of truth)
-- =============================================================================
CREATE OR REPLACE FUNCTION get_queue_status()
RETURNS TABLE(
  overdue BIGINT,
  due_in_1_hour BIGINT,
  due_in_6_hours BIGINT,
  due_in_24_hours BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Overdue: last sync + interval has elapsed
    COUNT(*) FILTER (
      WHERE last_storefront_sync IS NULL
      OR last_storefront_sync < NOW() - (COALESCE(sync_interval_hours, 24) || ' hours')::INTERVAL
    ) as overdue,
    -- Due in 1 hour: will become overdue within 1 hour
    COUNT(*) FILTER (
      WHERE last_storefront_sync IS NOT NULL
      AND last_storefront_sync >= NOW() - (COALESCE(sync_interval_hours, 24) || ' hours')::INTERVAL
      AND last_storefront_sync < NOW() - (COALESCE(sync_interval_hours, 24) || ' hours')::INTERVAL + INTERVAL '1 hour'
    ) as due_in_1_hour,
    -- Due in 6 hours: will become overdue within 6 hours
    COUNT(*) FILTER (
      WHERE last_storefront_sync IS NOT NULL
      AND last_storefront_sync >= NOW() - (COALESCE(sync_interval_hours, 24) || ' hours')::INTERVAL
      AND last_storefront_sync < NOW() - (COALESCE(sync_interval_hours, 24) || ' hours')::INTERVAL + INTERVAL '6 hours'
    ) as due_in_6_hours,
    -- Due in 24 hours: will become overdue within 24 hours
    COUNT(*) FILTER (
      WHERE last_storefront_sync IS NOT NULL
      AND last_storefront_sync >= NOW() - (COALESCE(sync_interval_hours, 24) || ' hours')::INTERVAL
      AND last_storefront_sync < NOW() - (COALESCE(sync_interval_hours, 24) || ' hours')::INTERVAL + INTERVAL '24 hours'
    ) as due_in_24_hours
  FROM sync_status
  WHERE is_syncable = TRUE
    AND (storefront_accessible IS NULL OR storefront_accessible = TRUE);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_queue_status IS
  'Returns count of apps due for storefront sync based on last_storefront_sync + sync_interval_hours.';
