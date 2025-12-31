-- Fix ambiguous column references in embedding functions
-- The return column names (appid, total_reviews) conflict with table columns

-- Drop and recreate functions with properly qualified column references

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
            JOIN app_developers ad_inner ON d.id = ad_inner.developer_id
            WHERE ad_inner.appid = a.appid
            ORDER BY d.name
        ) as developers,
        -- Publishers array
        ARRAY(
            SELECT pub.name
            FROM publishers pub
            JOIN app_publishers ap_inner ON pub.id = ap_inner.publisher_id
            WHERE ap_inner.appid = a.appid
            ORDER BY pub.name
        ) as publishers,
        -- Genres array
        ARRAY(
            SELECT sg.name
            FROM steam_genres sg
            JOIN app_genres ag_inner ON sg.genre_id = ag_inner.genre_id
            WHERE ag_inner.appid = a.appid
            ORDER BY ag_inner.is_primary DESC, sg.name
        ) as genres,
        -- Tags array (top 15 by rank)
        ARRAY(
            SELECT st.name
            FROM steam_tags st
            JOIN app_steam_tags ast_inner ON st.tag_id = ast_inner.tag_id
            WHERE ast_inner.appid = a.appid
            ORDER BY ast_inner.rank
            LIMIT 15
        ) as tags,
        -- Categories array
        ARRAY(
            SELECT sc.name
            FROM steam_categories sc
            JOIN app_categories ac_inner ON sc.category_id = ac_inner.category_id
            WHERE ac_inner.appid = a.appid
            ORDER BY sc.name
        ) as categories,
        -- Franchise IDs
        ARRAY(SELECT af_inner.franchise_id FROM app_franchises af_inner WHERE af_inner.appid = a.appid) as franchise_ids,
        -- Developer IDs
        ARRAY(SELECT ad_inner.developer_id FROM app_developers ad_inner WHERE ad_inner.appid = a.appid) as developer_ids,
        -- Publisher IDs
        ARRAY(SELECT ap_inner.publisher_id FROM app_publishers ap_inner WHERE ap_inner.appid = a.appid) as publisher_ids,
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
        EXISTS (SELECT 1 FROM app_steam_tags ast_check WHERE ast_check.appid = a.appid)
        OR EXISTS (SELECT 1 FROM app_genres ag_check WHERE ag_check.appid = a.appid)
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
            JOIN app_developers ad_inner ON d.id = ad_inner.developer_id
            WHERE ad_inner.appid = a.appid ORDER BY d.name
        ) as developers,
        ARRAY(
            SELECT pub.name FROM publishers pub
            JOIN app_publishers ap_inner ON pub.id = ap_inner.publisher_id
            WHERE ap_inner.appid = a.appid ORDER BY pub.name
        ) as publishers,
        ARRAY(
            SELECT sg.name FROM steam_genres sg
            JOIN app_genres ag_inner ON sg.genre_id = ag_inner.genre_id
            WHERE ag_inner.appid = a.appid ORDER BY ag_inner.is_primary DESC, sg.name
        ) as genres,
        ARRAY(
            SELECT st.name FROM steam_tags st
            JOIN app_steam_tags ast_inner ON st.tag_id = ast_inner.tag_id
            WHERE ast_inner.appid = a.appid ORDER BY ast_inner.rank LIMIT 15
        ) as tags,
        ARRAY(
            SELECT sc.name FROM steam_categories sc
            JOIN app_categories ac_inner ON sc.category_id = ac_inner.category_id
            WHERE ac_inner.appid = a.appid ORDER BY sc.name
        ) as categories,
        ARRAY(SELECT af_inner.franchise_id FROM app_franchises af_inner WHERE af_inner.appid = a.appid) as franchise_ids,
        ARRAY(SELECT ad_inner.developer_id FROM app_developers ad_inner WHERE ad_inner.appid = a.appid) as developer_ids,
        ARRAY(SELECT ap_inner.publisher_id FROM app_publishers ap_inner WHERE ap_inner.appid = a.appid) as publisher_ids,
        a.updated_at
    FROM apps a
    LEFT JOIN app_steam_deck asd ON a.appid = asd.appid
    WHERE a.appid = ANY(p_appids);
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
            JOIN app_genres ag_inner ON sg.genre_id = ag_inner.genre_id
            JOIN app_publishers ap_inner ON ag_inner.appid = ap_inner.appid
            WHERE ap_inner.publisher_id = p.id
            GROUP BY sg.name
            ORDER BY COUNT(*) DESC
            LIMIT 5
        ) as top_genres,
        -- Top tags across portfolio
        ARRAY(
            SELECT st.name
            FROM steam_tags st
            JOIN app_steam_tags ast_inner ON st.tag_id = ast_inner.tag_id
            JOIN app_publishers ap_inner ON ast_inner.appid = ap_inner.appid
            WHERE ap_inner.publisher_id = p.id
            GROUP BY st.name
            ORDER BY COUNT(*) DESC
            LIMIT 10
        ) as top_tags,
        -- Platforms supported
        ARRAY(
            SELECT DISTINCT unnest(string_to_array(apps_inner.platforms, ','))
            FROM apps apps_inner
            JOIN app_publishers ap_inner ON apps_inner.appid = ap_inner.appid
            WHERE ap_inner.publisher_id = p.id AND apps_inner.platforms IS NOT NULL
        ) as platforms_supported,
        -- Total reviews
        COALESCE((
            SELECT SUM(COALESCE(dm_sub.reviews_total, 0))
            FROM app_publishers ap_sub
            JOIN apps apps_sub ON ap_sub.appid = apps_sub.appid
            LEFT JOIN LATERAL (
                SELECT dm_inner.total_reviews as reviews_total FROM daily_metrics dm_inner
                WHERE dm_inner.appid = apps_sub.appid
                ORDER BY dm_inner.metric_date DESC LIMIT 1
            ) dm_sub ON TRUE
            WHERE ap_sub.publisher_id = p.id
        ), 0) as total_reviews,
        -- Average review percentage
        (
            SELECT AVG(apps_sub.pics_review_percentage)
            FROM app_publishers ap_sub
            JOIN apps apps_sub ON ap_sub.appid = apps_sub.appid
            WHERE ap_sub.publisher_id = p.id AND apps_sub.pics_review_percentage IS NOT NULL
        ) as avg_review_percentage,
        -- Top games by reviews
        ARRAY(
            SELECT apps_sub.name
            FROM app_publishers ap_sub
            JOIN apps apps_sub ON ap_sub.appid = apps_sub.appid
            LEFT JOIN LATERAL (
                SELECT dm_inner.total_reviews as reviews_total FROM daily_metrics dm_inner
                WHERE dm_inner.appid = apps_sub.appid ORDER BY dm_inner.metric_date DESC LIMIT 1
            ) dm_sub ON TRUE
            WHERE ap_sub.publisher_id = p.id AND apps_sub.type = 'game'
            ORDER BY COALESCE(dm_sub.reviews_total, 0) DESC
            LIMIT 10
        ) as top_game_names,
        ARRAY(
            SELECT apps_sub.appid
            FROM app_publishers ap_sub
            JOIN apps apps_sub ON ap_sub.appid = apps_sub.appid
            LEFT JOIN LATERAL (
                SELECT dm_inner.total_reviews as reviews_total FROM daily_metrics dm_inner
                WHERE dm_inner.appid = apps_sub.appid ORDER BY dm_inner.metric_date DESC LIMIT 1
            ) dm_sub ON TRUE
            WHERE ap_sub.publisher_id = p.id AND apps_sub.type = 'game'
            ORDER BY COALESCE(dm_sub.reviews_total, 0) DESC
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
            FROM app_developers ad_check
            JOIN app_publishers ap_check ON ad_check.appid = ap_check.appid
            JOIN publishers pub_check ON ap_check.publisher_id = pub_check.id
            WHERE ad_check.developer_id = d.id AND pub_check.name = d.name
        ) as is_indie,
        -- Top genres
        ARRAY(
            SELECT sg.name
            FROM steam_genres sg
            JOIN app_genres ag_inner ON sg.genre_id = ag_inner.genre_id
            JOIN app_developers ad_inner ON ag_inner.appid = ad_inner.appid
            WHERE ad_inner.developer_id = d.id
            GROUP BY sg.name
            ORDER BY COUNT(*) DESC
            LIMIT 5
        ) as top_genres,
        -- Top tags
        ARRAY(
            SELECT st.name
            FROM steam_tags st
            JOIN app_steam_tags ast_inner ON st.tag_id = ast_inner.tag_id
            JOIN app_developers ad_inner ON ast_inner.appid = ad_inner.appid
            WHERE ad_inner.developer_id = d.id
            GROUP BY st.name
            ORDER BY COUNT(*) DESC
            LIMIT 10
        ) as top_tags,
        -- Platforms
        ARRAY(
            SELECT DISTINCT unnest(string_to_array(apps_inner.platforms, ','))
            FROM apps apps_inner
            JOIN app_developers ad_inner ON apps_inner.appid = ad_inner.appid
            WHERE ad_inner.developer_id = d.id AND apps_inner.platforms IS NOT NULL
        ) as platforms_supported,
        -- Total reviews
        COALESCE((
            SELECT SUM(COALESCE(dm_sub.reviews_total, 0))
            FROM app_developers ad_sub
            JOIN apps apps_sub ON ad_sub.appid = apps_sub.appid
            LEFT JOIN LATERAL (
                SELECT dm_inner.total_reviews as reviews_total FROM daily_metrics dm_inner
                WHERE dm_inner.appid = apps_sub.appid ORDER BY dm_inner.metric_date DESC LIMIT 1
            ) dm_sub ON TRUE
            WHERE ad_sub.developer_id = d.id
        ), 0) as total_reviews,
        -- Avg review percentage
        (
            SELECT AVG(apps_sub.pics_review_percentage)
            FROM app_developers ad_sub
            JOIN apps apps_sub ON ad_sub.appid = apps_sub.appid
            WHERE ad_sub.developer_id = d.id AND apps_sub.pics_review_percentage IS NOT NULL
        ) as avg_review_percentage,
        -- Top games
        ARRAY(
            SELECT apps_sub.name
            FROM app_developers ad_sub
            JOIN apps apps_sub ON ad_sub.appid = apps_sub.appid
            LEFT JOIN LATERAL (
                SELECT dm_inner.total_reviews as reviews_total FROM daily_metrics dm_inner
                WHERE dm_inner.appid = apps_sub.appid ORDER BY dm_inner.metric_date DESC LIMIT 1
            ) dm_sub ON TRUE
            WHERE ad_sub.developer_id = d.id AND apps_sub.type = 'game'
            ORDER BY COALESCE(dm_sub.reviews_total, 0) DESC
            LIMIT 10
        ) as top_game_names,
        ARRAY(
            SELECT apps_sub.appid
            FROM app_developers ad_sub
            JOIN apps apps_sub ON ad_sub.appid = apps_sub.appid
            LEFT JOIN LATERAL (
                SELECT dm_inner.total_reviews as reviews_total FROM daily_metrics dm_inner
                WHERE dm_inner.appid = apps_sub.appid ORDER BY dm_inner.metric_date DESC LIMIT 1
            ) dm_sub ON TRUE
            WHERE ad_sub.developer_id = d.id AND apps_sub.type = 'game'
            ORDER BY COALESCE(dm_sub.reviews_total, 0) DESC
            LIMIT 10
        ) as top_game_appids
    FROM developers d
    WHERE d.game_count > 0
    ORDER BY d.game_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
