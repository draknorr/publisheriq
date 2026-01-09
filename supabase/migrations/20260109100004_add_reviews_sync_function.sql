-- Migration: Add reviews-specific sync function
-- Purpose: Velocity-based scheduling for reviews sync

-- New function specifically for reviews sync with velocity-based scheduling
CREATE OR REPLACE FUNCTION get_apps_for_reviews_sync(
    p_limit INTEGER DEFAULT 800
)
RETURNS TABLE (
    appid INTEGER,
    priority_score INTEGER,
    velocity_tier TEXT,
    hours_overdue DECIMAL,
    last_known_total_reviews INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.appid,
        s.priority_score,
        COALESCE(s.review_velocity_tier, 'unknown') as velocity_tier,
        EXTRACT(EPOCH FROM (NOW() - s.next_reviews_sync)) / 3600.0 as hours_overdue,
        s.last_known_total_reviews
    FROM sync_status s
    WHERE s.is_syncable = TRUE
      AND (s.next_reviews_sync IS NULL OR s.next_reviews_sync <= NOW())
    ORDER BY
        -- Prioritize never-synced apps
        CASE WHEN s.last_reviews_sync IS NULL THEN 0 ELSE 1 END,
        -- Then by velocity tier (high-velocity apps first)
        CASE s.review_velocity_tier
            WHEN 'high' THEN 0
            WHEN 'medium' THEN 1
            WHEN 'low' THEN 2
            WHEN 'dormant' THEN 3
            ELSE 4
        END,
        -- Then by how overdue they are
        s.next_reviews_sync ASC NULLS FIRST,
        -- Finally by general priority
        s.priority_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION get_apps_for_reviews_sync IS 'Get apps due for reviews sync, prioritized by velocity tier';
