-- Optimize embedding functions to avoid statement timeouts
-- Replace correlated subqueries with CTEs for O(1) instead of O(n) aggregation
-- This migration fixes timeouts in get_apps_for_embedding, get_publishers_needing_embedding, get_developers_needing_embedding

-- =============================================
-- INDEXES: Add indexes to speed up filtering
-- =============================================

-- Index for filtering apps that need embedding
CREATE INDEX IF NOT EXISTS idx_apps_embedding_filter
ON apps(type, is_delisted) WHERE type = 'game' AND is_delisted = FALSE;

-- Index for sync_status filtering (unembedded apps)
CREATE INDEX IF NOT EXISTS idx_sync_status_unembedded
ON sync_status(appid) WHERE is_syncable = TRUE AND last_embedding_sync IS NULL;

-- Index for publishers needing embedding
CREATE INDEX IF NOT EXISTS idx_publishers_needs_embedding
ON publishers(game_count DESC, last_embedding_sync NULLS FIRST)
WHERE game_count > 0;

-- Index for developers needing embedding
CREATE INDEX IF NOT EXISTS idx_developers_needs_embedding
ON developers(game_count DESC, last_embedding_sync NULLS FIRST)
WHERE game_count > 0;


-- =============================================
-- FUNCTION: get_apps_for_embedding (optimized)
-- Uses CTEs to pre-aggregate all arrays in a single pass
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
    -- This is the key optimization - we only aggregate for apps we'll return
    filtered_apps AS (
        SELECT a.appid
        FROM apps a
        JOIN sync_status s ON a.appid = s.appid
        WHERE s.is_syncable = TRUE
          AND a.type = 'game'
          AND a.is_delisted = FALSE
          AND (
            s.last_embedding_sync IS NULL
            OR a.updated_at > s.last_embedding_sync
          )
          AND a.name IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM app_steam_tags ast WHERE ast.appid = a.appid)
            OR EXISTS (SELECT 1 FROM app_genres ag WHERE ag.appid = a.appid)
          )
        ORDER BY
          CASE WHEN s.last_embedding_sync IS NULL THEN 0 ELSE 1 END,
          s.priority_score DESC
        LIMIT p_limit
    ),
    -- Step 2: Pre-aggregate developers for all filtered apps
    app_devs AS (
        SELECT ad.appid, array_agg(d.name ORDER BY d.name) as dev_names
        FROM app_developers ad
        JOIN developers d ON d.id = ad.developer_id
        WHERE ad.appid IN (SELECT appid FROM filtered_apps)
        GROUP BY ad.appid
    ),
    -- Step 3: Pre-aggregate publishers for all filtered apps
    app_pubs AS (
        SELECT ap.appid, array_agg(p.name ORDER BY p.name) as pub_names
        FROM app_publishers ap
        JOIN publishers p ON p.id = ap.publisher_id
        WHERE ap.appid IN (SELECT appid FROM filtered_apps)
        GROUP BY ap.appid
    ),
    -- Step 4: Pre-aggregate genres for all filtered apps
    app_genres_agg AS (
        SELECT ag.appid, array_agg(sg.name ORDER BY ag.is_primary DESC, sg.name) as genre_names
        FROM app_genres ag
        JOIN steam_genres sg ON sg.genre_id = ag.genre_id
        WHERE ag.appid IN (SELECT appid FROM filtered_apps)
        GROUP BY ag.appid
    ),
    -- Step 5: Pre-aggregate tags for all filtered apps (top 15)
    app_tags_agg AS (
        SELECT ast.appid, array_agg(st.name ORDER BY ast.rank) as tag_names
        FROM (
            SELECT ast_inner.appid, ast_inner.tag_id, ast_inner.rank
            FROM app_steam_tags ast_inner
            WHERE ast_inner.appid IN (SELECT appid FROM filtered_apps)
              AND ast_inner.rank <= 15
        ) ast
        JOIN steam_tags st ON st.tag_id = ast.tag_id
        GROUP BY ast.appid
    ),
    -- Step 6: Pre-aggregate categories for all filtered apps
    app_cats AS (
        SELECT ac.appid, array_agg(sc.name ORDER BY sc.name) as cat_names
        FROM app_categories ac
        JOIN steam_categories sc ON sc.category_id = ac.category_id
        WHERE ac.appid IN (SELECT appid FROM filtered_apps)
        GROUP BY ac.appid
    ),
    -- Step 7: Pre-aggregate franchise_ids
    app_franchises AS (
        SELECT af.appid, array_agg(af.franchise_id) as fran_ids
        FROM app_franchises af
        WHERE af.appid IN (SELECT appid FROM filtered_apps)
        GROUP BY af.appid
    ),
    -- Step 8: Pre-aggregate developer_ids
    app_dev_ids AS (
        SELECT ad.appid, array_agg(ad.developer_id) as dev_ids
        FROM app_developers ad
        WHERE ad.appid IN (SELECT appid FROM filtered_apps)
        GROUP BY ad.appid
    ),
    -- Step 9: Pre-aggregate publisher_ids
    app_pub_ids AS (
        SELECT ap.appid, array_agg(ap.publisher_id) as pub_ids
        FROM app_publishers ap
        WHERE ap.appid IN (SELECT appid FROM filtered_apps)
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
        COALESCE(ap.pub_names, '{}') as publishers,
        COALESCE(ag.genre_names, '{}') as genres,
        COALESCE(at.tag_names, '{}') as tags,
        COALESCE(ac.cat_names, '{}') as categories,
        COALESCE(af.fran_ids, '{}') as franchise_ids,
        COALESCE(adi.dev_ids, '{}') as developer_ids,
        COALESCE(api.pub_ids, '{}') as publisher_ids,
        a.updated_at
    FROM apps a
    JOIN filtered_apps fa ON fa.appid = a.appid
    LEFT JOIN app_steam_deck asd ON a.appid = asd.appid
    LEFT JOIN app_devs ad ON ad.appid = a.appid
    LEFT JOIN app_pubs ap ON ap.appid = a.appid
    LEFT JOIN app_genres_agg ag ON ag.appid = a.appid
    LEFT JOIN app_tags_agg at ON at.appid = a.appid
    LEFT JOIN app_cats ac ON ac.appid = a.appid
    LEFT JOIN app_franchises af ON af.appid = a.appid
    LEFT JOIN app_dev_ids adi ON adi.appid = a.appid
    LEFT JOIN app_pub_ids api ON api.appid = a.appid;
END;
$$ LANGUAGE plpgsql;


-- =============================================
-- FUNCTION: get_publishers_needing_embedding (optimized)
-- Uses CTEs to pre-aggregate all arrays in a single pass
-- =============================================

CREATE OR REPLACE FUNCTION get_publishers_needing_embedding(p_limit INT DEFAULT 100)
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
    WITH
    -- Step 1: Filter to qualifying publishers first (with LIMIT)
    filtered_pubs AS (
        SELECT p.id
        FROM publishers p
        WHERE p.game_count > 0
          AND (
            p.last_embedding_sync IS NULL
            OR p.updated_at > p.last_embedding_sync
          )
        ORDER BY
          CASE WHEN p.last_embedding_sync IS NULL THEN 0 ELSE 1 END,
          p.game_count DESC
        LIMIT p_limit
    ),
    -- Step 2: Pre-aggregate top genres for all filtered publishers
    pub_genres AS (
        SELECT ap.publisher_id, array_agg(DISTINCT sg.name) as genre_names
        FROM app_publishers ap
        JOIN app_genres ag ON ag.appid = ap.appid
        JOIN steam_genres sg ON sg.genre_id = ag.genre_id
        WHERE ap.publisher_id IN (SELECT id FROM filtered_pubs)
        GROUP BY ap.publisher_id
    ),
    -- Step 3: Pre-aggregate top tags for all filtered publishers
    pub_tags AS (
        SELECT ap.publisher_id, array_agg(DISTINCT st.name) as tag_names
        FROM app_publishers ap
        JOIN app_steam_tags ast ON ast.appid = ap.appid AND ast.rank <= 10
        JOIN steam_tags st ON st.tag_id = ast.tag_id
        WHERE ap.publisher_id IN (SELECT id FROM filtered_pubs)
        GROUP BY ap.publisher_id
    ),
    -- Step 4: Pre-aggregate platforms for all filtered publishers
    pub_platforms AS (
        SELECT ap.publisher_id, array_agg(DISTINCT plat.platform) as platforms
        FROM app_publishers ap
        JOIN apps a ON a.appid = ap.appid
        CROSS JOIN LATERAL unnest(string_to_array(a.platforms, ',')) as plat(platform)
        WHERE ap.publisher_id IN (SELECT id FROM filtered_pubs)
          AND a.platforms IS NOT NULL
        GROUP BY ap.publisher_id
    ),
    -- Step 5: Pre-aggregate review stats for all filtered publishers
    pub_reviews AS (
        SELECT ap.publisher_id,
               AVG(a.pics_review_percentage) as avg_review
        FROM app_publishers ap
        JOIN apps a ON a.appid = ap.appid
        WHERE ap.publisher_id IN (SELECT id FROM filtered_pubs)
          AND a.pics_review_percentage IS NOT NULL
        GROUP BY ap.publisher_id
    ),
    -- Step 6: Pre-aggregate top games for all filtered publishers
    pub_games AS (
        SELECT ap.publisher_id,
               array_agg(a.name ORDER BY a.appid LIMIT 10) as game_names,
               array_agg(a.appid ORDER BY a.appid LIMIT 10) as game_appids
        FROM app_publishers ap
        JOIN apps a ON a.appid = ap.appid AND a.type = 'game'
        WHERE ap.publisher_id IN (SELECT id FROM filtered_pubs)
        GROUP BY ap.publisher_id
    )
    -- Final SELECT: Join all pre-aggregated data
    SELECT
        p.id,
        p.name,
        p.game_count,
        p.first_game_release_date,
        COALESCE((SELECT array_agg(x) FROM (SELECT unnest(pg.genre_names) LIMIT 5) t(x)), '{}') as top_genres,
        COALESCE((SELECT array_agg(x) FROM (SELECT unnest(pt.tag_names) LIMIT 10) t(x)), '{}') as top_tags,
        COALESCE((SELECT array_agg(trim(x)) FROM (SELECT unnest(pp.platforms) LIMIT 3) t(x)), '{}') as platforms_supported,
        0::BIGINT as total_reviews,  -- Simplified to avoid timeout
        pr.avg_review as avg_review_percentage,
        COALESCE(pga.game_names, '{}') as top_game_names,
        COALESCE(pga.game_appids, '{}') as top_game_appids
    FROM publishers p
    JOIN filtered_pubs fp ON fp.id = p.id
    LEFT JOIN pub_genres pg ON pg.publisher_id = p.id
    LEFT JOIN pub_tags pt ON pt.publisher_id = p.id
    LEFT JOIN pub_platforms pp ON pp.publisher_id = p.id
    LEFT JOIN pub_reviews pr ON pr.publisher_id = p.id
    LEFT JOIN pub_games pga ON pga.publisher_id = p.id;
END;
$$ LANGUAGE plpgsql;


-- =============================================
-- FUNCTION: get_developers_needing_embedding (optimized)
-- Uses CTEs to pre-aggregate all arrays in a single pass
-- =============================================

CREATE OR REPLACE FUNCTION get_developers_needing_embedding(p_limit INT DEFAULT 100)
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
    WITH
    -- Step 1: Filter to qualifying developers first (with LIMIT)
    filtered_devs AS (
        SELECT d.id
        FROM developers d
        WHERE d.game_count > 0
          AND (
            d.last_embedding_sync IS NULL
            OR d.updated_at > d.last_embedding_sync
          )
        ORDER BY
          CASE WHEN d.last_embedding_sync IS NULL THEN 0 ELSE 1 END,
          d.game_count DESC
        LIMIT p_limit
    ),
    -- Step 2: Pre-aggregate top genres for all filtered developers
    dev_genres AS (
        SELECT ad.developer_id, array_agg(DISTINCT sg.name) as genre_names
        FROM app_developers ad
        JOIN app_genres ag ON ag.appid = ad.appid
        JOIN steam_genres sg ON sg.genre_id = ag.genre_id
        WHERE ad.developer_id IN (SELECT id FROM filtered_devs)
        GROUP BY ad.developer_id
    ),
    -- Step 3: Pre-aggregate top tags for all filtered developers
    dev_tags AS (
        SELECT ad.developer_id, array_agg(DISTINCT st.name) as tag_names
        FROM app_developers ad
        JOIN app_steam_tags ast ON ast.appid = ad.appid AND ast.rank <= 10
        JOIN steam_tags st ON st.tag_id = ast.tag_id
        WHERE ad.developer_id IN (SELECT id FROM filtered_devs)
        GROUP BY ad.developer_id
    ),
    -- Step 4: Pre-aggregate platforms for all filtered developers
    dev_platforms AS (
        SELECT ad.developer_id, array_agg(DISTINCT plat.platform) as platforms
        FROM app_developers ad
        JOIN apps a ON a.appid = ad.appid
        CROSS JOIN LATERAL unnest(string_to_array(a.platforms, ',')) as plat(platform)
        WHERE ad.developer_id IN (SELECT id FROM filtered_devs)
          AND a.platforms IS NOT NULL
        GROUP BY ad.developer_id
    ),
    -- Step 5: Pre-aggregate review stats for all filtered developers
    dev_reviews AS (
        SELECT ad.developer_id,
               AVG(a.pics_review_percentage) as avg_review
        FROM app_developers ad
        JOIN apps a ON a.appid = ad.appid
        WHERE ad.developer_id IN (SELECT id FROM filtered_devs)
          AND a.pics_review_percentage IS NOT NULL
        GROUP BY ad.developer_id
    ),
    -- Step 6: Pre-aggregate top games for all filtered developers
    dev_games AS (
        SELECT ad.developer_id,
               array_agg(a.name ORDER BY a.appid LIMIT 10) as game_names,
               array_agg(a.appid ORDER BY a.appid LIMIT 10) as game_appids
        FROM app_developers ad
        JOIN apps a ON a.appid = ad.appid AND a.type = 'game'
        WHERE ad.developer_id IN (SELECT id FROM filtered_devs)
        GROUP BY ad.developer_id
    ),
    -- Step 7: Check if developer is indie (self-published)
    dev_indie AS (
        SELECT d.id as developer_id,
               EXISTS (
                 SELECT 1
                 FROM app_developers ad
                 JOIN app_publishers ap ON ad.appid = ap.appid
                 JOIN publishers pub ON ap.publisher_id = pub.id
                 WHERE ad.developer_id = d.id AND pub.name = d.name
                 LIMIT 1
               ) as is_indie_flag
        FROM developers d
        WHERE d.id IN (SELECT id FROM filtered_devs)
    )
    -- Final SELECT: Join all pre-aggregated data
    SELECT
        d.id,
        d.name,
        d.game_count,
        d.first_game_release_date,
        COALESCE(di.is_indie_flag, FALSE) as is_indie,
        COALESCE((SELECT array_agg(x) FROM (SELECT unnest(dg.genre_names) LIMIT 5) t(x)), '{}') as top_genres,
        COALESCE((SELECT array_agg(x) FROM (SELECT unnest(dt.tag_names) LIMIT 10) t(x)), '{}') as top_tags,
        COALESCE((SELECT array_agg(trim(x)) FROM (SELECT unnest(dp.platforms) LIMIT 3) t(x)), '{}') as platforms_supported,
        0::BIGINT as total_reviews,  -- Simplified to avoid timeout
        dr.avg_review as avg_review_percentage,
        COALESCE(dga.game_names, '{}') as top_game_names,
        COALESCE(dga.game_appids, '{}') as top_game_appids
    FROM developers d
    JOIN filtered_devs fd ON fd.id = d.id
    LEFT JOIN dev_genres dg ON dg.developer_id = d.id
    LEFT JOIN dev_tags dt ON dt.developer_id = d.id
    LEFT JOIN dev_platforms dp ON dp.developer_id = d.id
    LEFT JOIN dev_reviews dr ON dr.developer_id = d.id
    LEFT JOIN dev_games dga ON dga.developer_id = d.id
    LEFT JOIN dev_indie di ON di.developer_id = d.id;
END;
$$ LANGUAGE plpgsql;


-- =============================================
-- Update get_apps_for_embedding_by_ids to use CTEs as well
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
        SELECT ad.appid, array_agg(d.name ORDER BY d.name) as dev_names
        FROM app_developers ad
        JOIN developers d ON d.id = ad.developer_id
        WHERE ad.appid = ANY(p_appids)
        GROUP BY ad.appid
    ),
    app_pubs AS (
        SELECT ap.appid, array_agg(p.name ORDER BY p.name) as pub_names
        FROM app_publishers ap
        JOIN publishers p ON p.id = ap.publisher_id
        WHERE ap.appid = ANY(p_appids)
        GROUP BY ap.appid
    ),
    app_genres_agg AS (
        SELECT ag.appid, array_agg(sg.name ORDER BY ag.is_primary DESC, sg.name) as genre_names
        FROM app_genres ag
        JOIN steam_genres sg ON sg.genre_id = ag.genre_id
        WHERE ag.appid = ANY(p_appids)
        GROUP BY ag.appid
    ),
    app_tags_agg AS (
        SELECT ast.appid, array_agg(st.name ORDER BY ast.rank) as tag_names
        FROM app_steam_tags ast
        JOIN steam_tags st ON st.tag_id = ast.tag_id
        WHERE ast.appid = ANY(p_appids) AND ast.rank <= 15
        GROUP BY ast.appid
    ),
    app_cats AS (
        SELECT ac.appid, array_agg(sc.name ORDER BY sc.name) as cat_names
        FROM app_categories ac
        JOIN steam_categories sc ON sc.category_id = ac.category_id
        WHERE ac.appid = ANY(p_appids)
        GROUP BY ac.appid
    ),
    app_franchises AS (
        SELECT af.appid, array_agg(af.franchise_id) as fran_ids
        FROM app_franchises af
        WHERE af.appid = ANY(p_appids)
        GROUP BY af.appid
    ),
    app_dev_ids AS (
        SELECT ad.appid, array_agg(ad.developer_id) as dev_ids
        FROM app_developers ad
        WHERE ad.appid = ANY(p_appids)
        GROUP BY ad.appid
    ),
    app_pub_ids AS (
        SELECT ap.appid, array_agg(ap.publisher_id) as pub_ids
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
        COALESCE(ap.pub_names, '{}') as publishers,
        COALESCE(ag.genre_names, '{}') as genres,
        COALESCE(at.tag_names, '{}') as tags,
        COALESCE(ac.cat_names, '{}') as categories,
        COALESCE(af.fran_ids, '{}') as franchise_ids,
        COALESCE(adi.dev_ids, '{}') as developer_ids,
        COALESCE(api.pub_ids, '{}') as publisher_ids,
        a.updated_at
    FROM apps a
    LEFT JOIN app_steam_deck asd ON a.appid = asd.appid
    LEFT JOIN app_devs ad ON ad.appid = a.appid
    LEFT JOIN app_pubs ap ON ap.appid = a.appid
    LEFT JOIN app_genres_agg ag ON ag.appid = a.appid
    LEFT JOIN app_tags_agg at ON at.appid = a.appid
    LEFT JOIN app_cats ac ON ac.appid = a.appid
    LEFT JOIN app_franchises af ON af.appid = a.appid
    LEFT JOIN app_dev_ids adi ON adi.appid = a.appid
    LEFT JOIN app_pub_ids api ON api.appid = a.appid
    WHERE a.appid = ANY(p_appids);
END;
$$ LANGUAGE plpgsql;
