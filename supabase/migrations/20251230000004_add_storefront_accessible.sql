-- Add storefront_accessible column to track apps with no public storefront data
-- Apps where Steam returns success=false (private, removed, age-gated) will be marked FALSE

ALTER TABLE sync_status ADD COLUMN storefront_accessible BOOLEAN DEFAULT TRUE;

-- Update get_apps_for_sync to exclude inaccessible apps from storefront sync
CREATE OR REPLACE FUNCTION get_apps_for_sync(
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
          WHEN 'steamspy' THEN s.last_steamspy_sync IS NULL OR s.last_steamspy_sync < NOW() - INTERVAL '1 day'
          WHEN 'storefront' THEN
            (s.last_storefront_sync IS NULL OR s.last_storefront_sync < NOW() - INTERVAL '1 day')
            AND (s.storefront_accessible IS NULL OR s.storefront_accessible = TRUE)
          WHEN 'reviews' THEN s.last_reviews_sync IS NULL OR s.last_reviews_sync < NOW() - INTERVAL '1 day'
          WHEN 'histogram' THEN s.last_histogram_sync IS NULL OR s.last_histogram_sync < NOW() - INTERVAL '7 days'
          WHEN 'scraper' THEN s.needs_page_creation_scrape = TRUE
          ELSE TRUE
      END
    ORDER BY s.priority_score DESC, s.next_sync_after ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
