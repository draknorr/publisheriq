-- Add offset parameter to publisher/developer embedding functions for pagination

-- Function to get publisher data for embedding with offset
CREATE OR REPLACE FUNCTION get_publishers_for_embedding(p_limit INT DEFAULT 200, p_offset INT DEFAULT 0)
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
        -- Top genres across portfolio (simplified - just get from publisher's games)
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
        -- Total reviews (simplified - just use 0 for now to avoid timeout)
        0::BIGINT as total_reviews,
        -- Average review percentage
        (
            SELECT AVG(apps_sub.pics_review_percentage)
            FROM app_publishers ap_sub
            JOIN apps apps_sub ON ap_sub.appid = apps_sub.appid
            WHERE ap_sub.publisher_id = p.id AND apps_sub.pics_review_percentage IS NOT NULL
        ) as avg_review_percentage,
        -- Top games by name (simplified - just get first 10)
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
    ORDER BY p.game_count DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to get developer data for embedding with offset
CREATE OR REPLACE FUNCTION get_developers_for_embedding(p_limit INT DEFAULT 200, p_offset INT DEFAULT 0)
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
        -- Check if self-published (indie) - simplified
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
    ORDER BY d.game_count DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
