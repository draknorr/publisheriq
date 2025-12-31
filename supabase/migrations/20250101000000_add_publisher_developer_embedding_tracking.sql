-- Add embedding sync tracking to publishers and developers tables
-- This mirrors the games pattern: track when each entity was last embedded
-- so the worker can loop through all entities without OFFSET pagination

-- 1. Add tracking columns to publishers table
ALTER TABLE publishers
ADD COLUMN IF NOT EXISTS last_embedding_sync TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS embedding_hash TEXT;

COMMENT ON COLUMN publishers.last_embedding_sync IS 'Timestamp of last successful embedding sync to Qdrant';
COMMENT ON COLUMN publishers.embedding_hash IS 'Hash of embedding source text to detect changes';

-- 2. Add tracking columns to developers table
ALTER TABLE developers
ADD COLUMN IF NOT EXISTS last_embedding_sync TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS embedding_hash TEXT;

COMMENT ON COLUMN developers.last_embedding_sync IS 'Timestamp of last successful embedding sync to Qdrant';
COMMENT ON COLUMN developers.embedding_hash IS 'Hash of embedding source text to detect changes';

-- 3. Create efficient indexes for finding unembedded entities
-- NULLS FIRST ensures unembedded entities come first
CREATE INDEX IF NOT EXISTS idx_publishers_embedding_needed
ON publishers(game_count DESC, last_embedding_sync NULLS FIRST)
WHERE game_count > 0;

CREATE INDEX IF NOT EXISTS idx_developers_embedding_needed
ON developers(game_count DESC, last_embedding_sync NULLS FIRST)
WHERE game_count > 0;

-- 4. NEW function for publishers (different name to avoid PostgREST schema cache issues)
-- Uses state-based filtering: only returns publishers that haven't been embedded
-- or have been updated since last embedding
CREATE OR REPLACE FUNCTION get_publishers_needing_embedding(p_limit INT DEFAULT 200)
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
        -- Top genres across portfolio (simplified to avoid timeout)
        ARRAY(
            SELECT DISTINCT sg.name
            FROM steam_genres sg
            JOIN app_genres ag_inner ON sg.genre_id = ag_inner.genre_id
            JOIN app_publishers ap_inner ON ag_inner.appid = ap_inner.appid
            WHERE ap_inner.publisher_id = p.id
            LIMIT 5
        ) as top_genres,
        -- Top tags across portfolio (simplified)
        ARRAY(
            SELECT DISTINCT st.name
            FROM steam_tags st
            JOIN app_steam_tags ast_inner ON st.tag_id = ast_inner.tag_id
            JOIN app_publishers ap_inner ON ast_inner.appid = ap_inner.appid
            WHERE ap_inner.publisher_id = p.id
            LIMIT 10
        ) as top_tags,
        -- Platforms supported (simplified)
        ARRAY(
            SELECT DISTINCT unnest(string_to_array(apps_inner.platforms, ','))
            FROM apps apps_inner
            JOIN app_publishers ap_inner ON apps_inner.appid = ap_inner.appid
            WHERE ap_inner.publisher_id = p.id AND apps_inner.platforms IS NOT NULL
            LIMIT 3
        ) as platforms_supported,
        -- Total reviews (simplified - hardcoded 0 to avoid timeout)
        0::BIGINT as total_reviews,
        -- Average review percentage
        (
            SELECT AVG(apps_sub.pics_review_percentage)
            FROM app_publishers ap_sub
            JOIN apps apps_sub ON ap_sub.appid = apps_sub.appid
            WHERE ap_sub.publisher_id = p.id AND apps_sub.pics_review_percentage IS NOT NULL
        ) as avg_review_percentage,
        -- Top games by name (simplified)
        ARRAY(
            SELECT apps_sub.name
            FROM app_publishers ap_sub
            JOIN apps apps_sub ON ap_sub.appid = apps_sub.appid
            WHERE ap_sub.publisher_id = p.id AND apps_sub.type = 'game'
            ORDER BY apps_sub.appid
            LIMIT 10
        ) as top_game_names,
        -- Top game appids
        ARRAY(
            SELECT apps_sub.appid
            FROM app_publishers ap_sub
            JOIN apps apps_sub ON ap_sub.appid = apps_sub.appid
            WHERE ap_sub.publisher_id = p.id AND apps_sub.type = 'game'
            ORDER BY apps_sub.appid
            LIMIT 10
        ) as top_game_appids
    FROM publishers p
    WHERE p.game_count > 0
      -- STATE-BASED FILTERING: Only return publishers needing embedding
      AND (
        p.last_embedding_sync IS NULL
        OR p.updated_at > p.last_embedding_sync
      )
    ORDER BY
      -- Prioritize never-embedded publishers
      CASE WHEN p.last_embedding_sync IS NULL THEN 0 ELSE 1 END,
      -- Then by game count (most important first)
      p.game_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 5. NEW function for developers (different name to avoid PostgREST schema cache issues)
CREATE OR REPLACE FUNCTION get_developers_needing_embedding(p_limit INT DEFAULT 200)
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
        -- Check if self-published (indie) - simplified to avoid timeout
        FALSE as is_indie,
        -- Top genres (simplified)
        ARRAY(
            SELECT DISTINCT sg.name
            FROM steam_genres sg
            JOIN app_genres ag_inner ON sg.genre_id = ag_inner.genre_id
            JOIN app_developers ad_inner ON ag_inner.appid = ad_inner.appid
            WHERE ad_inner.developer_id = d.id
            LIMIT 5
        ) as top_genres,
        -- Top tags (simplified)
        ARRAY(
            SELECT DISTINCT st.name
            FROM steam_tags st
            JOIN app_steam_tags ast_inner ON st.tag_id = ast_inner.tag_id
            JOIN app_developers ad_inner ON ast_inner.appid = ad_inner.appid
            WHERE ad_inner.developer_id = d.id
            LIMIT 10
        ) as top_tags,
        -- Platforms (simplified)
        ARRAY(
            SELECT DISTINCT unnest(string_to_array(apps_inner.platforms, ','))
            FROM apps apps_inner
            JOIN app_developers ad_inner ON apps_inner.appid = ad_inner.appid
            WHERE ad_inner.developer_id = d.id AND apps_inner.platforms IS NOT NULL
            LIMIT 3
        ) as platforms_supported,
        -- Total reviews (simplified)
        0::BIGINT as total_reviews,
        -- Avg review percentage
        (
            SELECT AVG(apps_sub.pics_review_percentage)
            FROM app_developers ad_sub
            JOIN apps apps_sub ON ad_sub.appid = apps_sub.appid
            WHERE ad_sub.developer_id = d.id AND apps_sub.pics_review_percentage IS NOT NULL
        ) as avg_review_percentage,
        -- Top games (simplified)
        ARRAY(
            SELECT apps_sub.name
            FROM app_developers ad_sub
            JOIN apps apps_sub ON ad_sub.appid = apps_sub.appid
            WHERE ad_sub.developer_id = d.id AND apps_sub.type = 'game'
            ORDER BY apps_sub.appid
            LIMIT 10
        ) as top_game_names,
        ARRAY(
            SELECT apps_sub.appid
            FROM app_developers ad_sub
            JOIN apps apps_sub ON ad_sub.appid = apps_sub.appid
            WHERE ad_sub.developer_id = d.id AND apps_sub.type = 'game'
            ORDER BY apps_sub.appid
            LIMIT 10
        ) as top_game_appids
    FROM developers d
    WHERE d.game_count > 0
      -- STATE-BASED FILTERING: Only return developers needing embedding
      AND (
        d.last_embedding_sync IS NULL
        OR d.updated_at > d.last_embedding_sync
      )
    ORDER BY
      -- Prioritize never-embedded developers
      CASE WHEN d.last_embedding_sync IS NULL THEN 0 ELSE 1 END,
      -- Then by game count (most important first)
      d.game_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 6. Mark publishers as embedded (batch update)
CREATE OR REPLACE FUNCTION mark_publishers_embedded(
    p_ids INT[],
    p_hashes TEXT[]
) RETURNS void AS $$
BEGIN
    UPDATE publishers
    SET
        last_embedding_sync = NOW(),
        embedding_hash = p_hashes[array_position(p_ids, id)]
    WHERE id = ANY(p_ids);
END;
$$ LANGUAGE plpgsql;

-- 7. Mark developers as embedded (batch update)
CREATE OR REPLACE FUNCTION mark_developers_embedded(
    p_ids INT[],
    p_hashes TEXT[]
) RETURNS void AS $$
BEGIN
    UPDATE developers
    SET
        last_embedding_sync = NOW(),
        embedding_hash = p_hashes[array_position(p_ids, id)]
    WHERE id = ANY(p_ids);
END;
$$ LANGUAGE plpgsql;
