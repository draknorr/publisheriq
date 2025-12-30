-- Migration: Add partitioned sync function for parallel initial sync
-- Uses row-number partitioning for even distribution (appid modulo doesn't work well with this dataset)
-- Used by storefront-initial-sync.yml workflow to speed up first-pass sync

-- Drop if exists to allow re-running
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
           ROW_NUMBER() OVER (ORDER BY s.priority_score DESC, s.next_sync_after ASC) as rn
    FROM sync_status s
    WHERE s.is_syncable = TRUE
      AND s.next_sync_after <= NOW()
      AND CASE p_source
          WHEN 'steamspy' THEN s.last_steamspy_sync IS NULL OR s.last_steamspy_sync < NOW() - INTERVAL '1 day'
          WHEN 'storefront' THEN
            (s.last_storefront_sync IS NULL OR s.last_storefront_sync < NOW() - INTERVAL '1 day')
            AND (s.storefront_accessible IS NULL OR s.storefront_accessible = TRUE)
          WHEN 'reviews' THEN s.last_reviews_sync IS NULL OR s.last_reviews_sync < NOW() - INTERVAL '1 day'
          WHEN 'histogram' THEN s.last_histogram_sync IS NULL OR s.last_histogram_sync < NOW() - INTERVAL '7 days'
          WHEN 'scraper' THEN s.needs_page_creation_scrape = TRUE
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
  'Returns apps due for sync, partitioned by row number for even distribution. Each partition gets every Nth app.';
