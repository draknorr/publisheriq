-- Migration: Prioritize Inconsistent Release States in Storefront Sync
--
-- Games with is_released=TRUE but release_date=NULL need immediate syncing
-- to capture their actual release date. This migration updates the sync
-- ordering to prioritize these games before other eligible apps.

-- Update get_apps_for_sync to prioritize inconsistent release states
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
          ELSE TRUE
      END
    ORDER BY
      -- First priority: Apps with inconsistent release state (is_released but no date)
      -- These need immediate sync to capture release date
      CASE WHEN p_source = 'storefront' AND EXISTS (
        SELECT 1 FROM apps a
        WHERE a.appid = s.appid
          AND a.is_released = TRUE
          AND a.release_date IS NULL
          AND a.type = 'game'
          AND a.is_delisted = FALSE
      ) THEN 0 ELSE 1 END,
      -- Second priority: Never-synced apps
      CASE WHEN
        (p_source = 'storefront' AND s.last_storefront_sync IS NULL) OR
        (p_source = 'reviews' AND s.last_reviews_sync IS NULL) OR
        (p_source = 'steamspy' AND s.last_steamspy_sync IS NULL) OR
        (p_source = 'histogram' AND s.last_histogram_sync IS NULL)
      THEN 0 ELSE 1 END,
      -- Third: By priority score
      s.priority_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_apps_for_sync IS
  'Returns apps due for sync. Prioritizes: 1) inconsistent release states (is_released but no date), 2) never-synced apps, 3) by priority score.';

-- Update partitioned version
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
             -- First priority: Apps with inconsistent release state
             CASE WHEN p_source = 'storefront' AND EXISTS (
               SELECT 1 FROM apps a
               WHERE a.appid = s.appid
                 AND a.is_released = TRUE
                 AND a.release_date IS NULL
                 AND a.type = 'game'
                 AND a.is_delisted = FALSE
             ) THEN 0 ELSE 1 END,
             -- Second priority: Never-synced apps
             CASE WHEN
               (p_source = 'storefront' AND s.last_storefront_sync IS NULL) OR
               (p_source = 'reviews' AND s.last_reviews_sync IS NULL) OR
               (p_source = 'steamspy' AND s.last_steamspy_sync IS NULL) OR
               (p_source = 'histogram' AND s.last_histogram_sync IS NULL)
             THEN 0 ELSE 1 END,
             -- Third: By priority score
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
  'Returns apps due for sync, partitioned. Prioritizes: 1) inconsistent release states, 2) never-synced apps, 3) by priority score.';
