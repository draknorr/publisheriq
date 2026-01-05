-- Migration: Use tiered sync intervals based on sync_interval_hours
--
-- Previously all apps used a hardcoded 1-day interval. Now apps sync based on their
-- priority tier via the sync_interval_hours column:
-- - Active (priority >= 100): 6-12 hours
-- - Moderate (priority >= 25): 24-48 hours
-- - Dormant (priority < 25): 168 hours (weekly)
--
-- This reduces daily sync volume by ~70% while keeping important apps fresh.

-- Drop and recreate get_apps_for_sync with tiered intervals
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
      AND s.next_sync_after <= NOW()
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
      s.priority_score DESC,
      s.next_sync_after ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_apps_for_sync IS
  'Returns apps due for sync based on their individual sync_interval_hours. High-priority apps sync more frequently.';

-- Drop and recreate partitioned version with same tiered intervals
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
             s.priority_score DESC,
             s.next_sync_after ASC
           ) as rn
    FROM sync_status s
    WHERE s.is_syncable = TRUE
      AND s.next_sync_after <= NOW()
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
  'Returns apps due for sync using tiered intervals, partitioned by row number for parallel processing.';

-- Add index to optimize the tiered interval query
CREATE INDEX IF NOT EXISTS idx_sync_status_interval_storefront
ON sync_status (sync_interval_hours, last_storefront_sync, priority_score DESC)
WHERE is_syncable = TRUE AND (storefront_accessible IS NULL OR storefront_accessible = TRUE);
