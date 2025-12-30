-- Migration: Add partitioned sync function for parallel initial sync
-- Allows multiple workers to process disjoint sets of apps using modulo partitioning
-- Used by storefront-initial-sync.yml workflow to speed up first-pass sync

CREATE FUNCTION get_apps_for_sync_partitioned(
  p_source sync_source,
  p_limit INTEGER,
  p_partition_count INTEGER,
  p_partition_id INTEGER
)
RETURNS TABLE(appid INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT s.appid
  FROM sync_status s
  JOIN apps a ON s.appid = a.appid
  WHERE s.is_syncable = TRUE
    AND s.next_sync_after <= NOW()
    -- Partition by appid modulo - each worker gets a disjoint set
    AND s.appid % p_partition_count = p_partition_id
    AND (
      (p_source = 'storefront' AND (s.last_storefront_sync IS NULL OR s.last_storefront_sync < NOW() - INTERVAL '1 day'))
      OR (p_source = 'reviews' AND (s.last_reviews_sync IS NULL OR s.last_reviews_sync < NOW() - INTERVAL '1 day'))
      OR (p_source = 'histogram' AND (s.last_histogram_sync IS NULL OR s.last_histogram_sync < NOW() - INTERVAL '1 day'))
      OR (p_source = 'steamspy' AND (s.last_steamspy_sync IS NULL OR s.last_steamspy_sync < NOW() - INTERVAL '1 day'))
      OR (p_source = 'scraper' AND s.needs_page_creation_scrape = TRUE)
    )
  ORDER BY
    -- FIRST: Prioritize apps that have NEVER been synced for this source
    CASE
      WHEN p_source = 'storefront' AND s.last_storefront_sync IS NULL THEN 0
      WHEN p_source = 'reviews' AND s.last_reviews_sync IS NULL THEN 0
      WHEN p_source = 'histogram' AND s.last_histogram_sync IS NULL THEN 0
      WHEN p_source = 'steamspy' AND s.last_steamspy_sync IS NULL THEN 0
      WHEN p_source = 'scraper' AND s.last_page_creation_scrape IS NULL THEN 0
      ELSE 1
    END,
    -- SECOND: For storefront, prioritize apps missing developer info
    CASE WHEN p_source = 'storefront' AND a.has_developer_info = FALSE THEN 0 ELSE 1 END,
    -- THIRD: By priority score
    s.priority_score DESC,
    -- FINALLY: By when they're due
    s.next_sync_after ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_apps_for_sync_partitioned IS
  'Returns apps due for sync, partitioned by appid modulo for parallel processing. Used for initial bulk sync with multiple workers.';
