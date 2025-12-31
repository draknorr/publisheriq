-- Add total_reviews to get_apps_for_embedding function for popularity comparison
-- This fetches the latest review count from daily_metrics

-- Must drop first because we're changing the return type (adding total_reviews column)
DROP FUNCTION IF EXISTS get_apps_for_embedding(INT);
DROP FUNCTION IF EXISTS get_apps_for_embedding_by_ids(INT[]);

-- Recreate function with total_reviews column
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
    updated_at TIMESTAMPTZ,
    total_reviews INT  -- NEW: for popularity comparison
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
        a.updated_at,
        -- Get latest total_reviews from daily_metrics
        (
            SELECT dm.total_reviews
            FROM daily_metrics dm
            WHERE dm.appid = a.appid
            ORDER BY dm.metric_date DESC
            LIMIT 1
        ) as total_reviews
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

-- Also update get_apps_for_embedding_by_ids to include total_reviews
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
    updated_at TIMESTAMPTZ,
    total_reviews INT  -- NEW: for popularity comparison
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
        a.updated_at,
        -- Get latest total_reviews from daily_metrics
        (
            SELECT dm.total_reviews
            FROM daily_metrics dm
            WHERE dm.appid = a.appid
            ORDER BY dm.metric_date DESC
            LIMIT 1
        ) as total_reviews
    FROM apps a
    LEFT JOIN app_steam_deck asd ON a.appid = asd.appid
    WHERE a.appid = ANY(p_appids);
END;
$$ LANGUAGE plpgsql;
