-- Track individual SteamSpy fetch attempts for apps missing from pagination
-- This column tracks when we last tried to fetch via the appdetails endpoint
-- (as opposed to the bulk "all" pagination endpoint)

ALTER TABLE sync_status
ADD COLUMN IF NOT EXISTS last_steamspy_individual_fetch TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN sync_status.last_steamspy_individual_fetch IS
  'When we last attempted individual SteamSpy fetch via appdetails endpoint';

-- Index for finding candidates efficiently
-- This partial index covers apps that are:
-- 1. Not available in SteamSpy's pagination (steamspy_available = FALSE)
-- 2. Haven't been tried via individual fetch yet (last_steamspy_individual_fetch IS NULL)
CREATE INDEX IF NOT EXISTS idx_sync_status_steamspy_individual_candidates
ON sync_status(appid)
WHERE steamspy_available = FALSE
  AND last_steamspy_individual_fetch IS NULL;

-- RPC function to get candidates for individual SteamSpy fetch
-- Returns apps that:
-- 1. Are not in SteamSpy's pagination results
-- 2. Haven't been tried via individual fetch
-- 3. Have significant reviews (indicating they're worth fetching)
-- 4. Are still syncable (not permanently blocked)
CREATE OR REPLACE FUNCTION get_steamspy_individual_fetch_candidates(
    p_limit INTEGER DEFAULT 100,
    p_min_reviews INTEGER DEFAULT 1000
)
RETURNS TABLE (
    appid INTEGER,
    total_reviews INTEGER,
    name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.appid,
        COALESCE(m.total_reviews, 0)::INTEGER as total_reviews,
        a.name
    FROM sync_status s
    JOIN apps a ON a.appid = s.appid
    LEFT JOIN latest_daily_metrics m ON m.appid = s.appid
    WHERE s.steamspy_available = FALSE
      AND s.last_steamspy_individual_fetch IS NULL
      AND s.is_syncable = TRUE
      AND COALESCE(m.total_reviews, 0) >= p_min_reviews
    ORDER BY COALESCE(m.total_reviews, 0) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_steamspy_individual_fetch_candidates IS
  'Returns high-priority apps for individual SteamSpy fetch, ordered by review count';
