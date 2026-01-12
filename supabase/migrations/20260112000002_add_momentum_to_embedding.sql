-- Migration: Add momentum and sentiment data to embedding RPC
-- Sprint 2.3: Enhance embedding text with temporal metrics
--
-- Adds new columns to get_apps_for_embedding for momentum signals:
-- - ccu_growth_7d: Week-over-week CCU % change
-- - ccu_growth_30d: Deviation from 30-day baseline
-- - velocity_7d: Reviews per day (7-day avg)
-- - velocity_acceleration: velocity_7d - velocity_30d
-- - recent_review_pct: Recent 30-day positive %
-- - historical_review_pct: All-time positive %
-- - sentiment_delta: recent - historical

-- Drop existing functions to recreate with new columns
DROP FUNCTION IF EXISTS get_apps_for_embedding(INT);
DROP FUNCTION IF EXISTS get_apps_for_embedding_by_ids(INT[]);

-- =============================================
-- FUNCTION: get_apps_for_embedding (with momentum)
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
    updated_at TIMESTAMPTZ,
    total_reviews INT,
    owners_min INT,
    ccu_peak INT,
    average_playtime_forever INT,
    metacritic_score SMALLINT,
    content_descriptors JSONB,
    language_count INT,
    trend_30d_direction TEXT,
    velocity_tier TEXT,
    franchise_names TEXT[],
    steamspy_tags TEXT[],
    primary_genre TEXT,
    -- NEW: Momentum metrics
    ccu_growth_7d NUMERIC,
    ccu_growth_30d NUMERIC,
    velocity_7d NUMERIC,
    velocity_acceleration NUMERIC,
    -- NEW: Sentiment trajectory
    recent_review_pct NUMERIC,
    historical_review_pct NUMERIC,
    sentiment_delta NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH
    filtered_apps AS (
        SELECT a.appid as aid
        FROM apps a
        JOIN sync_status s ON a.appid = s.appid
        WHERE s.is_syncable = TRUE
          AND a.type IN ('game', 'dlc', 'demo', 'mod')
          AND a.is_delisted = FALSE
          AND (
            s.last_embedding_sync IS NULL
            OR a.updated_at > s.last_embedding_sync
          )
          AND a.name IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM app_steam_tags ast WHERE ast.appid = a.appid)
            OR EXISTS (SELECT 1 FROM app_genres ag WHERE ag.appid = a.appid)
            OR a.type != 'game'
          )
        ORDER BY
          CASE WHEN s.last_embedding_sync IS NULL THEN 0 ELSE 1 END,
          s.priority_score DESC
        LIMIT p_limit
    ),
    app_devs AS (
        SELECT ad.appid as aid, array_agg(d.name ORDER BY d.name) as dev_names
        FROM app_developers ad
        JOIN developers d ON d.id = ad.developer_id
        WHERE ad.appid IN (SELECT fa.aid FROM filtered_apps fa)
        GROUP BY ad.appid
    ),
    app_pubs AS (
        SELECT ap.appid as aid, array_agg(p.name ORDER BY p.name) as pub_names
        FROM app_publishers ap
        JOIN publishers p ON p.id = ap.publisher_id
        WHERE ap.appid IN (SELECT fa.aid FROM filtered_apps fa)
        GROUP BY ap.appid
    ),
    app_genres_agg AS (
        SELECT ag.appid as aid, array_agg(sg.name ORDER BY ag.is_primary DESC, sg.name) as genre_names
        FROM app_genres ag
        JOIN steam_genres sg ON sg.genre_id = ag.genre_id
        WHERE ag.appid IN (SELECT fa.aid FROM filtered_apps fa)
        GROUP BY ag.appid
    ),
    app_primary_genre AS (
        SELECT ag.appid as aid, sg.name as primary_genre_name
        FROM app_genres ag
        JOIN steam_genres sg ON sg.genre_id = ag.genre_id
        WHERE ag.appid IN (SELECT fa.aid FROM filtered_apps fa)
          AND ag.is_primary = TRUE
    ),
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
    app_steamspy_tags AS (
        SELECT at.appid as aid, array_agg(at.tag ORDER BY at.vote_count DESC) as ss_tags
        FROM (
            SELECT app_tags.appid, app_tags.tag, app_tags.vote_count,
                   ROW_NUMBER() OVER (PARTITION BY app_tags.appid ORDER BY app_tags.vote_count DESC) as rn
            FROM app_tags
            WHERE app_tags.appid IN (SELECT fa.aid FROM filtered_apps fa)
        ) at
        WHERE at.rn <= 10
        GROUP BY at.appid
    ),
    app_cats AS (
        SELECT ac.appid as aid, array_agg(sc.name ORDER BY sc.name) as cat_names
        FROM app_categories ac
        JOIN steam_categories sc ON sc.category_id = ac.category_id
        WHERE ac.appid IN (SELECT fa.aid FROM filtered_apps fa)
        GROUP BY ac.appid
    ),
    app_franchises_ids AS (
        SELECT af.appid as aid, array_agg(af.franchise_id) as fran_ids
        FROM app_franchises af
        WHERE af.appid IN (SELECT fa.aid FROM filtered_apps fa)
        GROUP BY af.appid
    ),
    app_franchise_names AS (
        SELECT af.appid as aid, array_agg(DISTINCT f.name) as fran_names
        FROM app_franchises af
        JOIN franchises f ON f.id = af.franchise_id
        WHERE af.appid IN (SELECT fa.aid FROM filtered_apps fa)
        GROUP BY af.appid
    ),
    app_dev_ids AS (
        SELECT ad.appid as aid, array_agg(ad.developer_id) as dev_ids
        FROM app_developers ad
        WHERE ad.appid IN (SELECT fa.aid FROM filtered_apps fa)
        GROUP BY ad.appid
    ),
    app_pub_ids AS (
        SELECT ap.appid as aid, array_agg(ap.publisher_id) as pub_ids
        FROM app_publishers ap
        WHERE ap.appid IN (SELECT fa.aid FROM filtered_apps fa)
        GROUP BY ap.appid
    ),
    app_metrics AS (
        SELECT
            ldm.appid as aid,
            ldm.total_reviews,
            ldm.owners_min,
            ldm.ccu_peak
        FROM latest_daily_metrics ldm
        WHERE ldm.appid IN (SELECT fa.aid FROM filtered_apps fa)
    ),
    app_playtime AS (
        SELECT DISTINCT ON (dm.appid)
            dm.appid as aid,
            dm.average_playtime_forever
        FROM daily_metrics dm
        WHERE dm.appid IN (SELECT fa.aid FROM filtered_apps fa)
        ORDER BY dm.appid, dm.metric_date DESC
    ),
    app_trend AS (
        SELECT
            at.appid as aid,
            at.trend_30d_direction::TEXT as trend_dir
        FROM app_trends at
        WHERE at.appid IN (SELECT fa.aid FROM filtered_apps fa)
    ),
    app_velocity AS (
        SELECT
            rvs.appid as aid,
            rvs.velocity_tier,
            rvs.velocity_7d as vel_7d,
            rvs.velocity_30d as vel_30d
        FROM review_velocity_stats rvs
        WHERE rvs.appid IN (SELECT fa.aid FROM filtered_apps fa)
    ),
    -- NEW: CCU momentum calculations (inline for batch efficiency)
    ccu_7d_avg AS (
        SELECT cs.appid as aid, AVG(cs.player_count)::NUMERIC as avg_ccu
        FROM ccu_snapshots cs
        WHERE cs.appid IN (SELECT fa.aid FROM filtered_apps fa)
          AND cs.snapshot_time > NOW() - INTERVAL '7 days'
        GROUP BY cs.appid
    ),
    ccu_prev_7d_avg AS (
        SELECT cs.appid as aid, AVG(cs.player_count)::NUMERIC as avg_ccu
        FROM ccu_snapshots cs
        WHERE cs.appid IN (SELECT fa.aid FROM filtered_apps fa)
          AND cs.snapshot_time > NOW() - INTERVAL '14 days'
          AND cs.snapshot_time <= NOW() - INTERVAL '7 days'
        GROUP BY cs.appid
    ),
    ccu_30d_avg AS (
        SELECT cs.appid as aid, AVG(cs.player_count)::NUMERIC as avg_ccu
        FROM ccu_snapshots cs
        WHERE cs.appid IN (SELECT fa.aid FROM filtered_apps fa)
          AND cs.snapshot_time > NOW() - INTERVAL '30 days'
        GROUP BY cs.appid
    ),
    app_momentum AS (
        SELECT
            fa.aid,
            -- CCU growth 7d: week-over-week change
            CASE
                WHEN p7.avg_ccu IS NOT NULL AND p7.avg_ccu > 0
                THEN ROUND(((c7.avg_ccu - p7.avg_ccu) / p7.avg_ccu) * 100, 1)
                ELSE NULL
            END AS ccu_growth_7d,
            -- CCU growth 30d: deviation from 30-day baseline
            CASE
                WHEN c30.avg_ccu IS NOT NULL AND c30.avg_ccu > 0
                THEN ROUND(((c7.avg_ccu - c30.avg_ccu) / c30.avg_ccu) * 100, 1)
                ELSE NULL
            END AS ccu_growth_30d
        FROM filtered_apps fa
        LEFT JOIN ccu_7d_avg c7 ON c7.aid = fa.aid
        LEFT JOIN ccu_prev_7d_avg p7 ON p7.aid = fa.aid
        LEFT JOIN ccu_30d_avg c30 ON c30.aid = fa.aid
    ),
    -- NEW: Sentiment trajectory calculations
    app_sentiment AS (
        SELECT
            dm.appid as aid,
            -- Recent review percentage (30-day)
            CASE
                WHEN dm.recent_total_reviews IS NOT NULL AND dm.recent_total_reviews > 0
                THEN ROUND((dm.recent_positive::NUMERIC / dm.recent_total_reviews) * 100, 1)
                ELSE NULL
            END AS recent_review_pct,
            -- Historical review percentage (all-time)
            CASE
                WHEN dm.total_reviews IS NOT NULL AND dm.total_reviews > 0
                THEN ROUND((dm.positive_reviews::NUMERIC / dm.total_reviews) * 100, 1)
                ELSE NULL
            END AS historical_review_pct
        FROM (
            SELECT DISTINCT ON (dm_inner.appid)
                dm_inner.appid,
                dm_inner.recent_positive,
                dm_inner.recent_total_reviews,
                dm_inner.positive_reviews,
                dm_inner.total_reviews
            FROM daily_metrics dm_inner
            WHERE dm_inner.appid IN (SELECT fa.aid FROM filtered_apps fa)
            ORDER BY dm_inner.appid, dm_inner.metric_date DESC
        ) dm
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
        a.updated_at,
        am.total_reviews,
        am.owners_min,
        am.ccu_peak,
        apt.average_playtime_forever,
        a.metacritic_score,
        a.content_descriptors,
        COALESCE((SELECT COUNT(*) FROM jsonb_object_keys(a.languages)), 0)::INT as language_count,
        atr.trend_dir as trend_30d_direction,
        av.velocity_tier,
        COALESCE(afn.fran_names, '{}') as franchise_names,
        COALESCE(asst.ss_tags, '{}') as steamspy_tags,
        apg.primary_genre_name as primary_genre,
        -- NEW: Momentum metrics
        mom.ccu_growth_7d,
        mom.ccu_growth_30d,
        av.vel_7d as velocity_7d,
        CASE
            WHEN av.vel_7d IS NOT NULL AND av.vel_30d IS NOT NULL
            THEN ROUND(av.vel_7d - av.vel_30d, 2)
            ELSE NULL
        END AS velocity_acceleration,
        -- NEW: Sentiment trajectory
        sent.recent_review_pct,
        sent.historical_review_pct,
        CASE
            WHEN sent.recent_review_pct IS NOT NULL AND sent.historical_review_pct IS NOT NULL
            THEN ROUND(sent.recent_review_pct - sent.historical_review_pct, 1)
            ELSE NULL
        END AS sentiment_delta
    FROM apps a
    JOIN filtered_apps fa ON fa.aid = a.appid
    LEFT JOIN app_steam_deck asd ON a.appid = asd.appid
    LEFT JOIN app_devs ad ON ad.aid = a.appid
    LEFT JOIN app_pubs apub ON apub.aid = a.appid
    LEFT JOIN app_genres_agg ag ON ag.aid = a.appid
    LEFT JOIN app_primary_genre apg ON apg.aid = a.appid
    LEFT JOIN app_tags_agg atag ON atag.aid = a.appid
    LEFT JOIN app_steamspy_tags asst ON asst.aid = a.appid
    LEFT JOIN app_cats ac ON ac.aid = a.appid
    LEFT JOIN app_franchises_ids afr ON afr.aid = a.appid
    LEFT JOIN app_franchise_names afn ON afn.aid = a.appid
    LEFT JOIN app_dev_ids adi ON adi.aid = a.appid
    LEFT JOIN app_pub_ids api ON api.aid = a.appid
    LEFT JOIN app_metrics am ON am.aid = a.appid
    LEFT JOIN app_playtime apt ON apt.aid = a.appid
    LEFT JOIN app_trend atr ON atr.aid = a.appid
    LEFT JOIN app_velocity av ON av.aid = a.appid
    LEFT JOIN app_momentum mom ON mom.aid = a.appid
    LEFT JOIN app_sentiment sent ON sent.aid = a.appid;
END;
$$ LANGUAGE plpgsql;


-- =============================================
-- FUNCTION: get_apps_for_embedding_by_ids (with momentum)
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
    updated_at TIMESTAMPTZ,
    total_reviews INT,
    owners_min INT,
    ccu_peak INT,
    average_playtime_forever INT,
    metacritic_score SMALLINT,
    content_descriptors JSONB,
    language_count INT,
    trend_30d_direction TEXT,
    velocity_tier TEXT,
    franchise_names TEXT[],
    steamspy_tags TEXT[],
    primary_genre TEXT,
    -- NEW: Momentum metrics
    ccu_growth_7d NUMERIC,
    ccu_growth_30d NUMERIC,
    velocity_7d NUMERIC,
    velocity_acceleration NUMERIC,
    -- NEW: Sentiment trajectory
    recent_review_pct NUMERIC,
    historical_review_pct NUMERIC,
    sentiment_delta NUMERIC
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
    app_primary_genre AS (
        SELECT ag.appid as aid, sg.name as primary_genre_name
        FROM app_genres ag
        JOIN steam_genres sg ON sg.genre_id = ag.genre_id
        WHERE ag.appid = ANY(p_appids)
          AND ag.is_primary = TRUE
    ),
    app_tags_agg AS (
        SELECT ast.appid as aid, array_agg(st.name ORDER BY ast.rank) as tag_names
        FROM app_steam_tags ast
        JOIN steam_tags st ON st.tag_id = ast.tag_id
        WHERE ast.appid = ANY(p_appids) AND ast.rank <= 15
        GROUP BY ast.appid
    ),
    app_steamspy_tags AS (
        SELECT at.appid as aid, array_agg(at.tag ORDER BY at.vote_count DESC) as ss_tags
        FROM (
            SELECT app_tags.appid, app_tags.tag, app_tags.vote_count,
                   ROW_NUMBER() OVER (PARTITION BY app_tags.appid ORDER BY app_tags.vote_count DESC) as rn
            FROM app_tags
            WHERE app_tags.appid = ANY(p_appids)
        ) at
        WHERE at.rn <= 10
        GROUP BY at.appid
    ),
    app_cats AS (
        SELECT ac.appid as aid, array_agg(sc.name ORDER BY sc.name) as cat_names
        FROM app_categories ac
        JOIN steam_categories sc ON sc.category_id = ac.category_id
        WHERE ac.appid = ANY(p_appids)
        GROUP BY ac.appid
    ),
    app_franchises_ids AS (
        SELECT af.appid as aid, array_agg(af.franchise_id) as fran_ids
        FROM app_franchises af
        WHERE af.appid = ANY(p_appids)
        GROUP BY af.appid
    ),
    app_franchise_names AS (
        SELECT af.appid as aid, array_agg(DISTINCT f.name) as fran_names
        FROM app_franchises af
        JOIN franchises f ON f.id = af.franchise_id
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
    ),
    app_metrics AS (
        SELECT
            ldm.appid as aid,
            ldm.total_reviews,
            ldm.owners_min,
            ldm.ccu_peak
        FROM latest_daily_metrics ldm
        WHERE ldm.appid = ANY(p_appids)
    ),
    app_playtime AS (
        SELECT DISTINCT ON (dm.appid)
            dm.appid as aid,
            dm.average_playtime_forever
        FROM daily_metrics dm
        WHERE dm.appid = ANY(p_appids)
        ORDER BY dm.appid, dm.metric_date DESC
    ),
    app_trend AS (
        SELECT
            at.appid as aid,
            at.trend_30d_direction::TEXT as trend_dir
        FROM app_trends at
        WHERE at.appid = ANY(p_appids)
    ),
    app_velocity AS (
        SELECT
            rvs.appid as aid,
            rvs.velocity_tier,
            rvs.velocity_7d as vel_7d,
            rvs.velocity_30d as vel_30d
        FROM review_velocity_stats rvs
        WHERE rvs.appid = ANY(p_appids)
    ),
    -- NEW: CCU momentum calculations
    ccu_7d_avg AS (
        SELECT cs.appid as aid, AVG(cs.player_count)::NUMERIC as avg_ccu
        FROM ccu_snapshots cs
        WHERE cs.appid = ANY(p_appids)
          AND cs.snapshot_time > NOW() - INTERVAL '7 days'
        GROUP BY cs.appid
    ),
    ccu_prev_7d_avg AS (
        SELECT cs.appid as aid, AVG(cs.player_count)::NUMERIC as avg_ccu
        FROM ccu_snapshots cs
        WHERE cs.appid = ANY(p_appids)
          AND cs.snapshot_time > NOW() - INTERVAL '14 days'
          AND cs.snapshot_time <= NOW() - INTERVAL '7 days'
        GROUP BY cs.appid
    ),
    ccu_30d_avg AS (
        SELECT cs.appid as aid, AVG(cs.player_count)::NUMERIC as avg_ccu
        FROM ccu_snapshots cs
        WHERE cs.appid = ANY(p_appids)
          AND cs.snapshot_time > NOW() - INTERVAL '30 days'
        GROUP BY cs.appid
    ),
    app_momentum AS (
        SELECT
            ta.aid,
            CASE
                WHEN p7.avg_ccu IS NOT NULL AND p7.avg_ccu > 0
                THEN ROUND(((c7.avg_ccu - p7.avg_ccu) / p7.avg_ccu) * 100, 1)
                ELSE NULL
            END AS ccu_growth_7d,
            CASE
                WHEN c30.avg_ccu IS NOT NULL AND c30.avg_ccu > 0
                THEN ROUND(((c7.avg_ccu - c30.avg_ccu) / c30.avg_ccu) * 100, 1)
                ELSE NULL
            END AS ccu_growth_30d
        FROM target_apps ta
        LEFT JOIN ccu_7d_avg c7 ON c7.aid = ta.aid
        LEFT JOIN ccu_prev_7d_avg p7 ON p7.aid = ta.aid
        LEFT JOIN ccu_30d_avg c30 ON c30.aid = ta.aid
    ),
    -- NEW: Sentiment trajectory calculations
    app_sentiment AS (
        SELECT
            dm.appid as aid,
            CASE
                WHEN dm.recent_total_reviews IS NOT NULL AND dm.recent_total_reviews > 0
                THEN ROUND((dm.recent_positive::NUMERIC / dm.recent_total_reviews) * 100, 1)
                ELSE NULL
            END AS recent_review_pct,
            CASE
                WHEN dm.total_reviews IS NOT NULL AND dm.total_reviews > 0
                THEN ROUND((dm.positive_reviews::NUMERIC / dm.total_reviews) * 100, 1)
                ELSE NULL
            END AS historical_review_pct
        FROM (
            SELECT DISTINCT ON (dm_inner.appid)
                dm_inner.appid,
                dm_inner.recent_positive,
                dm_inner.recent_total_reviews,
                dm_inner.positive_reviews,
                dm_inner.total_reviews
            FROM daily_metrics dm_inner
            WHERE dm_inner.appid = ANY(p_appids)
            ORDER BY dm_inner.appid, dm_inner.metric_date DESC
        ) dm
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
        a.updated_at,
        am.total_reviews,
        am.owners_min,
        am.ccu_peak,
        apt.average_playtime_forever,
        a.metacritic_score,
        a.content_descriptors,
        COALESCE((SELECT COUNT(*) FROM jsonb_object_keys(a.languages)), 0)::INT as language_count,
        atr.trend_dir as trend_30d_direction,
        av.velocity_tier,
        COALESCE(afn.fran_names, '{}') as franchise_names,
        COALESCE(asst.ss_tags, '{}') as steamspy_tags,
        apg.primary_genre_name as primary_genre,
        -- NEW: Momentum metrics
        mom.ccu_growth_7d,
        mom.ccu_growth_30d,
        av.vel_7d as velocity_7d,
        CASE
            WHEN av.vel_7d IS NOT NULL AND av.vel_30d IS NOT NULL
            THEN ROUND(av.vel_7d - av.vel_30d, 2)
            ELSE NULL
        END AS velocity_acceleration,
        -- NEW: Sentiment trajectory
        sent.recent_review_pct,
        sent.historical_review_pct,
        CASE
            WHEN sent.recent_review_pct IS NOT NULL AND sent.historical_review_pct IS NOT NULL
            THEN ROUND(sent.recent_review_pct - sent.historical_review_pct, 1)
            ELSE NULL
        END AS sentiment_delta
    FROM apps a
    LEFT JOIN app_steam_deck asd ON a.appid = asd.appid
    LEFT JOIN app_devs ad ON ad.aid = a.appid
    LEFT JOIN app_pubs apub ON apub.aid = a.appid
    LEFT JOIN app_genres_agg ag ON ag.aid = a.appid
    LEFT JOIN app_primary_genre apg ON apg.aid = a.appid
    LEFT JOIN app_tags_agg atag ON atag.aid = a.appid
    LEFT JOIN app_steamspy_tags asst ON asst.aid = a.appid
    LEFT JOIN app_cats ac ON ac.aid = a.appid
    LEFT JOIN app_franchises_ids afr ON afr.aid = a.appid
    LEFT JOIN app_franchise_names afn ON afn.aid = a.appid
    LEFT JOIN app_dev_ids adi ON adi.aid = a.appid
    LEFT JOIN app_pub_ids api ON api.aid = a.appid
    LEFT JOIN app_metrics am ON am.aid = a.appid
    LEFT JOIN app_playtime apt ON apt.aid = a.appid
    LEFT JOIN app_trend atr ON atr.aid = a.appid
    LEFT JOIN app_velocity av ON av.aid = a.appid
    LEFT JOIN app_momentum mom ON mom.aid = a.appid
    LEFT JOIN app_sentiment sent ON sent.aid = a.appid
    WHERE a.appid = ANY(p_appids);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_apps_for_embedding(INT) TO service_role;
GRANT EXECUTE ON FUNCTION get_apps_for_embedding_by_ids(INT[]) TO service_role;

COMMENT ON FUNCTION get_apps_for_embedding IS
'Fetches apps needing embedding with enhanced metadata including momentum metrics and sentiment trajectory.
Sprint 2.3: Added ccu_growth_7d/30d, velocity_7d, velocity_acceleration, recent/historical_review_pct, sentiment_delta.';
