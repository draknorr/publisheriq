-- Migration: Prioritize never-synced apps for faster first-pass completion
-- This ensures all apps get synced at least once before refreshing already-synced apps
-- After first-pass is complete, falls back to normal priority-based selection

-- Must drop existing function first due to PostgreSQL limitations
DROP FUNCTION IF EXISTS get_apps_for_sync(sync_source, INTEGER);

CREATE FUNCTION get_apps_for_sync(p_source sync_source, p_limit INTEGER)
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
    -- FIRST: Prioritize apps that have NEVER been synced for this source
    -- This ensures first-pass completion before any refreshes
    CASE
      WHEN p_source = 'storefront' AND s.last_storefront_sync IS NULL THEN 0
      WHEN p_source = 'reviews' AND s.last_reviews_sync IS NULL THEN 0
      WHEN p_source = 'histogram' AND s.last_histogram_sync IS NULL THEN 0
      WHEN p_source = 'steamspy' AND s.last_steamspy_sync IS NULL THEN 0
      WHEN p_source = 'scraper' AND s.last_page_creation_scrape IS NULL THEN 0
      ELSE 1  -- Already synced at least once, lower priority
    END,
    -- SECOND: For storefront, prioritize apps missing developer info
    CASE WHEN p_source = 'storefront' AND a.has_developer_info = FALSE THEN 0 ELSE 1 END,
    -- THIRD: By priority score (higher priority = sync more often)
    s.priority_score DESC,
    -- FINALLY: By when they're due
    s.next_sync_after ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_apps_for_sync IS
  'Returns apps due for sync, prioritizing: 1) Never-synced apps (first-pass), 2) Missing developer info (storefront), 3) Priority score, 4) Due date';
