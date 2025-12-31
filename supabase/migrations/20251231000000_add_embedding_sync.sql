-- Add embedding sync tracking to sync_status
-- Tracks when each app was last embedded and a hash of the source data

-- Add columns for embedding sync tracking
ALTER TABLE sync_status
ADD COLUMN IF NOT EXISTS last_embedding_sync TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS embedding_hash TEXT;

-- Add comment for documentation
COMMENT ON COLUMN sync_status.last_embedding_sync IS 'Timestamp of last successful embedding sync to Qdrant';
COMMENT ON COLUMN sync_status.embedding_hash IS 'Hash of embedding source text to detect changes';

-- Create partial index for finding apps that need embedding
-- Only indexes syncable apps, ordered by priority
CREATE INDEX IF NOT EXISTS idx_sync_status_embedding_needed
ON sync_status(priority_score DESC, last_embedding_sync NULLS FIRST)
WHERE is_syncable = TRUE;

-- Function to get apps that need embedding (new or updated since last embedding)
CREATE OR REPLACE FUNCTION get_apps_for_embedding(p_limit INT DEFAULT 1000)
RETURNS TABLE (
    appid INT,
    name TEXT,
    type TEXT,
    is_free BOOLEAN,
    current_price_cents INT,
    release_date DATE,
    platforms TEXT,
    controller_support TEXT,
    pics_review_score SMALLINT,
    pics_review_percentage SMALLINT,
    steam_deck_category TEXT,
    is_released BOOLEAN,
    is_delisted BOOLEAN,
    developers TEXT[],
    publishers TEXT[],
    genres TEXT[],
    tags TEXT[],
    categories TEXT[],
    franchise_ids INT[],
    developer_ids INT[],
    publisher_ids INT[],
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.appid,
        a.name,
        a.type::TEXT,
        a.is_free,
        a.current_price_cents,
        a.release_date,
        a.platforms,
        a.controller_support,
        a.pics_review_score,
        a.pics_review_percentage,
        asd.category::TEXT as steam_deck_category,
        a.is_released,
        a.is_delisted,
        -- Developers array
        ARRAY(
            SELECT d.name
            FROM developers d
            JOIN app_developers ad ON d.id = ad.developer_id
            WHERE ad.appid = a.appid
            ORDER BY d.name
        ) as developers,
        -- Publishers array
        ARRAY(
            SELECT p.name
            FROM publishers p
            JOIN app_publishers ap ON p.id = ap.publisher_id
            WHERE ap.appid = a.appid
            ORDER BY p.name
        ) as publishers,
        -- Genres array
        ARRAY(
            SELECT sg.name
            FROM steam_genres sg
            JOIN app_genres ag ON sg.genre_id = ag.genre_id
            WHERE ag.appid = a.appid
            ORDER BY ag.is_primary DESC, sg.name
        ) as genres,
        -- Tags array (top 15 by rank)
        ARRAY(
            SELECT st.name
            FROM steam_tags st
            JOIN app_steam_tags ast ON st.tag_id = ast.tag_id
            WHERE ast.appid = a.appid
            ORDER BY ast.rank
            LIMIT 15
        ) as tags,
        -- Categories array
        ARRAY(
            SELECT sc.name
            FROM steam_categories sc
            JOIN app_categories ac ON sc.category_id = ac.category_id
            WHERE ac.appid = a.appid
            ORDER BY sc.name
        ) as categories,
        -- Franchise IDs
        ARRAY(
            SELECT af.franchise_id
            FROM app_franchises af
            WHERE af.appid = a.appid
        ) as franchise_ids,
        -- Developer IDs
        ARRAY(
            SELECT ad.developer_id
            FROM app_developers ad
            WHERE ad.appid = a.appid
        ) as developer_ids,
        -- Publisher IDs
        ARRAY(
            SELECT ap.publisher_id
            FROM app_publishers ap
            WHERE ap.appid = a.appid
        ) as publisher_ids,
        a.updated_at
    FROM apps a
    JOIN sync_status s ON a.appid = s.appid
    LEFT JOIN app_steam_deck asd ON a.appid = asd.appid
    WHERE s.is_syncable = TRUE
      AND a.type = 'game'
      AND a.is_delisted = FALSE
      -- Only games that haven't been embedded or have been updated since last embedding
      AND (
        s.last_embedding_sync IS NULL
        OR a.updated_at > s.last_embedding_sync
      )
      -- Only games with minimum metadata (at least has name and some tags/genres)
      AND a.name IS NOT NULL
      AND (
        EXISTS (SELECT 1 FROM app_steam_tags WHERE appid = a.appid)
        OR EXISTS (SELECT 1 FROM app_genres WHERE appid = a.appid)
      )
    ORDER BY
      -- Prioritize never-embedded apps
      CASE WHEN s.last_embedding_sync IS NULL THEN 0 ELSE 1 END,
      -- Then by priority score
      s.priority_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get apps by ID for embedding (for batch processing)
CREATE OR REPLACE FUNCTION get_apps_for_embedding_by_ids(p_appids INT[])
RETURNS TABLE (
    appid INT,
    name TEXT,
    type TEXT,
    is_free BOOLEAN,
    current_price_cents INT,
    release_date DATE,
    platforms TEXT,
    controller_support TEXT,
    pics_review_score SMALLINT,
    pics_review_percentage SMALLINT,
    steam_deck_category TEXT,
    is_released BOOLEAN,
    is_delisted BOOLEAN,
    developers TEXT[],
    publishers TEXT[],
    genres TEXT[],
    tags TEXT[],
    categories TEXT[],
    franchise_ids INT[],
    developer_ids INT[],
    publisher_ids INT[],
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.appid,
        a.name,
        a.type::TEXT,
        a.is_free,
        a.current_price_cents,
        a.release_date,
        a.platforms,
        a.controller_support,
        a.pics_review_score,
        a.pics_review_percentage,
        asd.category::TEXT as steam_deck_category,
        a.is_released,
        a.is_delisted,
        ARRAY(
            SELECT d.name FROM developers d
            JOIN app_developers ad ON d.id = ad.developer_id
            WHERE ad.appid = a.appid ORDER BY d.name
        ) as developers,
        ARRAY(
            SELECT p.name FROM publishers p
            JOIN app_publishers ap ON p.id = ap.publisher_id
            WHERE ap.appid = a.appid ORDER BY p.name
        ) as publishers,
        ARRAY(
            SELECT sg.name FROM steam_genres sg
            JOIN app_genres ag ON sg.genre_id = ag.genre_id
            WHERE ag.appid = a.appid ORDER BY ag.is_primary DESC, sg.name
        ) as genres,
        ARRAY(
            SELECT st.name FROM steam_tags st
            JOIN app_steam_tags ast ON st.tag_id = ast.tag_id
            WHERE ast.appid = a.appid ORDER BY ast.rank LIMIT 15
        ) as tags,
        ARRAY(
            SELECT sc.name FROM steam_categories sc
            JOIN app_categories ac ON sc.category_id = ac.category_id
            WHERE ac.appid = a.appid ORDER BY sc.name
        ) as categories,
        ARRAY(SELECT af.franchise_id FROM app_franchises af WHERE af.appid = a.appid) as franchise_ids,
        ARRAY(SELECT ad.developer_id FROM app_developers ad WHERE ad.appid = a.appid) as developer_ids,
        ARRAY(SELECT ap.publisher_id FROM app_publishers ap WHERE ap.appid = a.appid) as publisher_ids,
        a.updated_at
    FROM apps a
    LEFT JOIN app_steam_deck asd ON a.appid = asd.appid
    WHERE a.appid = ANY(p_appids);
END;
$$ LANGUAGE plpgsql;

-- Function to mark apps as embedded (batch update)
CREATE OR REPLACE FUNCTION mark_apps_embedded(
    p_appids INT[],
    p_hashes TEXT[]
)
RETURNS void AS $$
BEGIN
    -- Update sync_status for all apps
    UPDATE sync_status s
    SET
        last_embedding_sync = NOW(),
        embedding_hash = p_hashes[array_position(p_appids, s.appid)]
    WHERE s.appid = ANY(p_appids);
END;
$$ LANGUAGE plpgsql;

-- Function to get publisher data for embedding
CREATE OR REPLACE FUNCTION get_publishers_for_embedding(p_limit INT DEFAULT 500)
RETURNS TABLE (
    id INT,
    name TEXT,
    game_count INT,
    first_game_release_date DATE,
    top_genres TEXT[],
    top_tags TEXT[],
    platforms_supported TEXT[],
    total_reviews BIGINT,
    avg_review_percentage NUMERIC,
    top_game_names TEXT[],
    top_game_appids INT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.game_count,
        p.first_game_release_date,
        -- Top genres across portfolio
        ARRAY(
            SELECT sg.name
            FROM steam_genres sg
            JOIN app_genres ag ON sg.genre_id = ag.genre_id
            JOIN app_publishers ap ON ag.appid = ap.appid
            WHERE ap.publisher_id = p.id
            GROUP BY sg.name
            ORDER BY COUNT(*) DESC
            LIMIT 5
        ) as top_genres,
        -- Top tags across portfolio
        ARRAY(
            SELECT st.name
            FROM steam_tags st
            JOIN app_steam_tags ast ON st.tag_id = ast.tag_id
            JOIN app_publishers ap ON ast.appid = ap.appid
            WHERE ap.publisher_id = p.id
            GROUP BY st.name
            ORDER BY COUNT(*) DESC
            LIMIT 10
        ) as top_tags,
        -- Platforms supported
        ARRAY(
            SELECT DISTINCT unnest(string_to_array(a.platforms, ','))
            FROM apps a
            JOIN app_publishers ap ON a.appid = ap.appid
            WHERE ap.publisher_id = p.id AND a.platforms IS NOT NULL
        ) as platforms_supported,
        -- Total reviews
        COALESCE((
            SELECT SUM(COALESCE(dm.total_reviews, 0))
            FROM app_publishers ap
            JOIN apps a ON ap.appid = a.appid
            LEFT JOIN LATERAL (
                SELECT total_reviews FROM daily_metrics
                WHERE appid = a.appid
                ORDER BY metric_date DESC LIMIT 1
            ) dm ON TRUE
            WHERE ap.publisher_id = p.id
        ), 0) as total_reviews,
        -- Average review percentage
        (
            SELECT AVG(a.pics_review_percentage)
            FROM app_publishers ap
            JOIN apps a ON ap.appid = a.appid
            WHERE ap.publisher_id = p.id AND a.pics_review_percentage IS NOT NULL
        ) as avg_review_percentage,
        -- Top games by reviews
        ARRAY(
            SELECT a.name
            FROM app_publishers ap
            JOIN apps a ON ap.appid = a.appid
            LEFT JOIN LATERAL (
                SELECT total_reviews FROM daily_metrics
                WHERE appid = a.appid ORDER BY metric_date DESC LIMIT 1
            ) dm ON TRUE
            WHERE ap.publisher_id = p.id AND a.type = 'game'
            ORDER BY COALESCE(dm.total_reviews, 0) DESC
            LIMIT 10
        ) as top_game_names,
        ARRAY(
            SELECT a.appid
            FROM app_publishers ap
            JOIN apps a ON ap.appid = a.appid
            LEFT JOIN LATERAL (
                SELECT total_reviews FROM daily_metrics
                WHERE appid = a.appid ORDER BY metric_date DESC LIMIT 1
            ) dm ON TRUE
            WHERE ap.publisher_id = p.id AND a.type = 'game'
            ORDER BY COALESCE(dm.total_reviews, 0) DESC
            LIMIT 10
        ) as top_game_appids
    FROM publishers p
    WHERE p.game_count > 0
    ORDER BY p.game_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get developer data for embedding
CREATE OR REPLACE FUNCTION get_developers_for_embedding(p_limit INT DEFAULT 500)
RETURNS TABLE (
    id INT,
    name TEXT,
    game_count INT,
    first_game_release_date DATE,
    is_indie BOOLEAN,
    top_genres TEXT[],
    top_tags TEXT[],
    platforms_supported TEXT[],
    total_reviews BIGINT,
    avg_review_percentage NUMERIC,
    top_game_names TEXT[],
    top_game_appids INT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.name,
        d.game_count,
        d.first_game_release_date,
        -- Check if self-published (indie)
        EXISTS (
            SELECT 1
            FROM app_developers ad
            JOIN app_publishers ap ON ad.appid = ap.appid
            JOIN publishers p ON ap.publisher_id = p.id
            WHERE ad.developer_id = d.id AND p.name = d.name
        ) as is_indie,
        -- Top genres
        ARRAY(
            SELECT sg.name
            FROM steam_genres sg
            JOIN app_genres ag ON sg.genre_id = ag.genre_id
            JOIN app_developers ad ON ag.appid = ad.appid
            WHERE ad.developer_id = d.id
            GROUP BY sg.name
            ORDER BY COUNT(*) DESC
            LIMIT 5
        ) as top_genres,
        -- Top tags
        ARRAY(
            SELECT st.name
            FROM steam_tags st
            JOIN app_steam_tags ast ON st.tag_id = ast.tag_id
            JOIN app_developers ad ON ast.appid = ad.appid
            WHERE ad.developer_id = d.id
            GROUP BY st.name
            ORDER BY COUNT(*) DESC
            LIMIT 10
        ) as top_tags,
        -- Platforms
        ARRAY(
            SELECT DISTINCT unnest(string_to_array(a.platforms, ','))
            FROM apps a
            JOIN app_developers ad ON a.appid = ad.appid
            WHERE ad.developer_id = d.id AND a.platforms IS NOT NULL
        ) as platforms_supported,
        -- Total reviews
        COALESCE((
            SELECT SUM(COALESCE(dm.total_reviews, 0))
            FROM app_developers ad
            JOIN apps a ON ad.appid = a.appid
            LEFT JOIN LATERAL (
                SELECT total_reviews FROM daily_metrics
                WHERE appid = a.appid ORDER BY metric_date DESC LIMIT 1
            ) dm ON TRUE
            WHERE ad.developer_id = d.id
        ), 0) as total_reviews,
        -- Avg review percentage
        (
            SELECT AVG(a.pics_review_percentage)
            FROM app_developers ad
            JOIN apps a ON ad.appid = a.appid
            WHERE ad.developer_id = d.id AND a.pics_review_percentage IS NOT NULL
        ) as avg_review_percentage,
        -- Top games
        ARRAY(
            SELECT a.name
            FROM app_developers ad
            JOIN apps a ON ad.appid = a.appid
            LEFT JOIN LATERAL (
                SELECT total_reviews FROM daily_metrics
                WHERE appid = a.appid ORDER BY metric_date DESC LIMIT 1
            ) dm ON TRUE
            WHERE ad.developer_id = d.id AND a.type = 'game'
            ORDER BY COALESCE(dm.total_reviews, 0) DESC
            LIMIT 10
        ) as top_game_names,
        ARRAY(
            SELECT a.appid
            FROM app_developers ad
            JOIN apps a ON ad.appid = a.appid
            LEFT JOIN LATERAL (
                SELECT total_reviews FROM daily_metrics
                WHERE appid = a.appid ORDER BY metric_date DESC LIMIT 1
            ) dm ON TRUE
            WHERE ad.developer_id = d.id AND a.type = 'game'
            ORDER BY COALESCE(dm.total_reviews, 0) DESC
            LIMIT 10
        ) as top_game_appids
    FROM developers d
    WHERE d.game_count > 0
    ORDER BY d.game_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
