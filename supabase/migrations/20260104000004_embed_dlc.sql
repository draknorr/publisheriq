-- Update embedding functions to include DLC, demos, and mods
-- This allows semantic search to find similar DLC/demos/mods

-- =============================================
-- Update index to include more app types
-- =============================================

DROP INDEX IF EXISTS idx_apps_embedding_filter;
CREATE INDEX idx_apps_embedding_filter
ON apps(type, is_delisted) WHERE type IN ('game', 'dlc', 'demo', 'mod') AND is_delisted = FALSE;

-- =============================================
-- FUNCTION: get_apps_for_embedding (updated)
-- Now includes DLC, demos, and mods alongside games
-- =============================================

CREATE OR REPLACE FUNCTION get_apps_for_embedding(p_limit INT DEFAULT 100)
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
    WITH
    -- Step 1: Filter to qualifying apps first (with LIMIT)
    -- Now includes game, dlc, demo, mod types
    filtered_apps AS (
        SELECT a.appid as aid
        FROM apps a
        JOIN sync_status s ON a.appid = s.appid
        WHERE s.is_syncable = TRUE
          AND a.type IN ('game', 'dlc', 'demo', 'mod')  -- CHANGED: Include more types
          AND a.is_delisted = FALSE
          AND (
            s.last_embedding_sync IS NULL
            OR a.updated_at > s.last_embedding_sync
          )
          AND a.name IS NOT NULL
          AND (
            -- DLC/demos/mods can have fewer tags - be more lenient
            EXISTS (SELECT 1 FROM app_steam_tags ast WHERE ast.appid = a.appid)
            OR EXISTS (SELECT 1 FROM app_genres ag WHERE ag.appid = a.appid)
            OR a.type != 'game'  -- Allow non-games with less metadata
          )
        ORDER BY
          CASE WHEN s.last_embedding_sync IS NULL THEN 0 ELSE 1 END,
          s.priority_score DESC
        LIMIT p_limit
    ),
    -- Step 2: Pre-aggregate developers for all filtered apps
    app_devs AS (
        SELECT ad.appid as aid, array_agg(d.name ORDER BY d.name) as dev_names
        FROM app_developers ad
        JOIN developers d ON d.id = ad.developer_id
        WHERE ad.appid IN (SELECT fa.aid FROM filtered_apps fa)
        GROUP BY ad.appid
    ),
    -- Step 3: Pre-aggregate publishers for all filtered apps
    app_pubs AS (
        SELECT ap.appid as aid, array_agg(p.name ORDER BY p.name) as pub_names
        FROM app_publishers ap
        JOIN publishers p ON p.id = ap.publisher_id
        WHERE ap.appid IN (SELECT fa.aid FROM filtered_apps fa)
        GROUP BY ap.appid
    ),
    -- Step 4: Pre-aggregate genres for all filtered apps
    app_genres_agg AS (
        SELECT ag.appid as aid, array_agg(sg.name ORDER BY ag.is_primary DESC, sg.name) as genre_names
        FROM app_genres ag
        JOIN steam_genres sg ON sg.genre_id = ag.genre_id
        WHERE ag.appid IN (SELECT fa.aid FROM filtered_apps fa)
        GROUP BY ag.appid
    ),
    -- Step 5: Pre-aggregate tags for all filtered apps (top 15)
    app_tags_agg AS (
        SELECT ast.appid as aid, array_agg(st.name ORDER BY ast.rank) as tag_names
        FROM (
            SELECT ast_inner.appid, ast_inner.tag_id, ast_inner.rank
            FROM app_steam_tags ast_inner
            WHERE ast_inner.appid IN (SELECT fa.aid FROM filtered_apps fa)
              AND ast_inner.rank <= 15
        ) ast
        JOIN steam_tags st ON st.tag_id = ast.tag_id
        GROUP BY ast.appid
    ),
    -- Step 6: Pre-aggregate categories for all filtered apps
    app_cats AS (
        SELECT ac.appid as aid, array_agg(sc.name ORDER BY sc.name) as cat_names
        FROM app_categories ac
        JOIN steam_categories sc ON sc.category_id = ac.category_id
        WHERE ac.appid IN (SELECT fa.aid FROM filtered_apps fa)
        GROUP BY ac.appid
    ),
    -- Step 7: Pre-aggregate franchise_ids
    app_franchises_cte AS (
        SELECT af.appid as aid, array_agg(af.franchise_id) as fran_ids
        FROM app_franchises af
        WHERE af.appid IN (SELECT fa.aid FROM filtered_apps fa)
        GROUP BY af.appid
    ),
    -- Step 8: Pre-aggregate developer_ids
    app_dev_ids AS (
        SELECT ad.appid as aid, array_agg(ad.developer_id) as dev_ids
        FROM app_developers ad
        WHERE ad.appid IN (SELECT fa.aid FROM filtered_apps fa)
        GROUP BY ad.appid
    ),
    -- Step 9: Pre-aggregate publisher_ids
    app_pub_ids AS (
        SELECT ap.appid as aid, array_agg(ap.publisher_id) as pub_ids
        FROM app_publishers ap
        WHERE ap.appid IN (SELECT fa.aid FROM filtered_apps fa)
        GROUP BY ap.appid
    )
    -- Final SELECT: Join all pre-aggregated data
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
        COALESCE(ad.dev_names, '{}') as developers,
        COALESCE(apub.pub_names, '{}') as publishers,
        COALESCE(ag.genre_names, '{}') as genres,
        COALESCE(atag.tag_names, '{}') as tags,
        COALESCE(ac.cat_names, '{}') as categories,
        COALESCE(afr.fran_ids, '{}') as franchise_ids,
        COALESCE(adi.dev_ids, '{}') as developer_ids,
        COALESCE(api.pub_ids, '{}') as publisher_ids,
        a.updated_at
    FROM apps a
    JOIN filtered_apps fa ON fa.aid = a.appid
    LEFT JOIN app_steam_deck asd ON a.appid = asd.appid
    LEFT JOIN app_devs ad ON ad.aid = a.appid
    LEFT JOIN app_pubs apub ON apub.aid = a.appid
    LEFT JOIN app_genres_agg ag ON ag.aid = a.appid
    LEFT JOIN app_tags_agg atag ON atag.aid = a.appid
    LEFT JOIN app_cats ac ON ac.aid = a.appid
    LEFT JOIN app_franchises_cte afr ON afr.aid = a.appid
    LEFT JOIN app_dev_ids adi ON adi.aid = a.appid
    LEFT JOIN app_pub_ids api ON api.aid = a.appid;
END;
$$ LANGUAGE plpgsql;


-- =============================================
-- Update get_apps_for_embedding_by_ids to include more types
-- =============================================

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
    WITH
    target_apps AS (
        SELECT unnest(p_appids) as aid
    ),
    app_devs AS (
        SELECT ad.appid as aid, array_agg(d.name ORDER BY d.name) as dev_names
        FROM app_developers ad
        JOIN developers d ON d.id = ad.developer_id
        WHERE ad.appid = ANY(p_appids)
        GROUP BY ad.appid
    ),
    app_pubs AS (
        SELECT ap.appid as aid, array_agg(p.name ORDER BY p.name) as pub_names
        FROM app_publishers ap
        JOIN publishers p ON p.id = ap.publisher_id
        WHERE ap.appid = ANY(p_appids)
        GROUP BY ap.appid
    ),
    app_genres_agg AS (
        SELECT ag.appid as aid, array_agg(sg.name ORDER BY ag.is_primary DESC, sg.name) as genre_names
        FROM app_genres ag
        JOIN steam_genres sg ON sg.genre_id = ag.genre_id
        WHERE ag.appid = ANY(p_appids)
        GROUP BY ag.appid
    ),
    app_tags_agg AS (
        SELECT ast.appid as aid, array_agg(st.name ORDER BY ast.rank) as tag_names
        FROM app_steam_tags ast
        JOIN steam_tags st ON st.tag_id = ast.tag_id
        WHERE ast.appid = ANY(p_appids) AND ast.rank <= 15
        GROUP BY ast.appid
    ),
    app_cats AS (
        SELECT ac.appid as aid, array_agg(sc.name ORDER BY sc.name) as cat_names
        FROM app_categories ac
        JOIN steam_categories sc ON sc.category_id = ac.category_id
        WHERE ac.appid = ANY(p_appids)
        GROUP BY ac.appid
    ),
    app_franchises_cte AS (
        SELECT af.appid as aid, array_agg(af.franchise_id) as fran_ids
        FROM app_franchises af
        WHERE af.appid = ANY(p_appids)
        GROUP BY af.appid
    ),
    app_dev_ids AS (
        SELECT ad.appid as aid, array_agg(ad.developer_id) as dev_ids
        FROM app_developers ad
        WHERE ad.appid = ANY(p_appids)
        GROUP BY ad.appid
    ),
    app_pub_ids AS (
        SELECT ap.appid as aid, array_agg(ap.publisher_id) as pub_ids
        FROM app_publishers ap
        WHERE ap.appid = ANY(p_appids)
        GROUP BY ap.appid
    )
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
        COALESCE(ad.dev_names, '{}') as developers,
        COALESCE(apub.pub_names, '{}') as publishers,
        COALESCE(ag.genre_names, '{}') as genres,
        COALESCE(atag.tag_names, '{}') as tags,
        COALESCE(ac.cat_names, '{}') as categories,
        COALESCE(afr.fran_ids, '{}') as franchise_ids,
        COALESCE(adi.dev_ids, '{}') as developer_ids,
        COALESCE(api.pub_ids, '{}') as publisher_ids,
        a.updated_at
    FROM apps a
    LEFT JOIN app_steam_deck asd ON a.appid = asd.appid
    LEFT JOIN app_devs ad ON ad.aid = a.appid
    LEFT JOIN app_pubs apub ON apub.aid = a.appid
    LEFT JOIN app_genres_agg ag ON ag.aid = a.appid
    LEFT JOIN app_tags_agg atag ON atag.aid = a.appid
    LEFT JOIN app_cats ac ON ac.aid = a.appid
    LEFT JOIN app_franchises_cte afr ON afr.aid = a.appid
    LEFT JOIN app_dev_ids adi ON adi.aid = a.appid
    LEFT JOIN app_pub_ids api ON api.aid = a.appid
    WHERE a.appid = ANY(p_appids);
END;
$$ LANGUAGE plpgsql;
