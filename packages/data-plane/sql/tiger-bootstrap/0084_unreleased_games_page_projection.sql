-- Tiger read accelerators for the admin /unreleased page.
--
-- This projection is intentionally separate from metrics.apps_page_projection:
-- /apps is optimized around released games and live-market metrics, while
-- /unreleased is a launch-tracking workspace over storefront availability,
-- release-date quality, change intelligence, news, media readiness, and
-- publisher opportunity signals.
--
-- Apply only during an approved Tiger maintenance window. The initial refresh
-- scans legacy apps, relationships, taxonomy, media snapshots, news, and recent
-- change-intelligence tables.

CREATE MATERIALIZED VIEW IF NOT EXISTS metrics.unreleased_games_projection AS
WITH publisher_primary AS (
  SELECT DISTINCT ON (ap.appid)
    ap.appid,
    p.id AS publisher_id,
    p.name AS publisher_name,
    p.normalized_name AS publisher_normalized_name,
    p.steam_vanity_url AS publisher_steam_vanity_url,
    p.game_count AS publisher_game_count
  FROM legacy.app_publishers ap
  JOIN legacy.publishers p ON p.id = ap.publisher_id
  ORDER BY ap.appid, p.game_count DESC NULLS LAST, p.name
),
developer_primary AS (
  SELECT DISTINCT ON (ad.appid)
    ad.appid,
    d.id AS developer_id,
    d.name AS developer_name,
    d.normalized_name AS developer_normalized_name,
    d.steam_vanity_url AS developer_steam_vanity_url,
    d.game_count AS developer_game_count
  FROM legacy.app_developers ad
  JOIN legacy.developers d ON d.id = ad.developer_id
  ORDER BY ad.appid, d.game_count DESC NULLS LAST, d.name
),
publisher_portfolio AS (
  SELECT
    ap.publisher_id,
    COUNT(DISTINCT ap.appid) FILTER (
      WHERE COALESCE(a.is_released, false) = true
        AND COALESCE(a.is_delisted, false) = false
        AND COALESCE(a.type, 'game') = 'game'
    ) AS released_game_count,
    COALESCE(SUM(ldm.owners_midpoint), 0) AS total_owners,
    COALESCE(MAX(ldm.total_reviews), 0) AS max_game_reviews
  FROM legacy.app_publishers ap
  JOIN legacy.apps a ON a.appid = ap.appid
  LEFT JOIN legacy.latest_daily_metrics ldm ON ldm.appid = ap.appid
  GROUP BY ap.publisher_id
),
self_published AS (
  SELECT DISTINCT ad.appid
  FROM legacy.app_developers ad
  JOIN legacy.developers d ON d.id = ad.developer_id
  JOIN legacy.app_publishers ap ON ap.appid = ad.appid
  JOIN legacy.publishers p ON p.id = ap.publisher_id
  WHERE d.normalized_name = p.normalized_name
),
taxonomy AS (
  SELECT
    a.appid,
    COALESCE(g.genre_ids, ARRAY[]::integer[]) AS genre_ids,
    COALESCE(g.genre_names, ARRAY[]::text[]) AS genre_names,
    COALESCE(t.tag_ids, ARRAY[]::integer[]) AS tag_ids,
    COALESCE(t.tag_names, ARRAY[]::text[]) AS tag_names,
    COALESCE(t.primary_tag_name, NULL) AS primary_tag_name,
    COALESCE(c.category_ids, ARRAY[]::integer[]) AS category_ids,
    COALESCE(c.category_names, ARRAY[]::text[]) AS category_names,
    COALESCE(c.primary_category_name, NULL) AS primary_category_name
  FROM legacy.apps a
  LEFT JOIN LATERAL (
    SELECT
      array_agg(ag.genre_id ORDER BY ag.is_primary DESC NULLS LAST, sg.name) AS genre_ids,
      array_agg(sg.name ORDER BY ag.is_primary DESC NULLS LAST, sg.name) AS genre_names
    FROM legacy.app_genres ag
    JOIN legacy.steam_genres sg ON sg.genre_id = ag.genre_id
    WHERE ag.appid = a.appid
  ) g ON true
  LEFT JOIN LATERAL (
    SELECT
      array_agg(ast.tag_id ORDER BY ast.rank NULLS LAST, st.name) AS tag_ids,
      array_agg(st.name ORDER BY ast.rank NULLS LAST, st.name) AS tag_names,
      (array_agg(st.name ORDER BY ast.rank NULLS LAST, st.name))[1] AS primary_tag_name
    FROM legacy.app_steam_tags ast
    JOIN legacy.steam_tags st ON st.tag_id = ast.tag_id
    WHERE ast.appid = a.appid
  ) t ON true
  LEFT JOIN LATERAL (
    SELECT
      array_agg(ac.category_id ORDER BY sc.name) AS category_ids,
      array_agg(sc.name ORDER BY sc.name) AS category_names,
      (array_agg(sc.name ORDER BY sc.name))[1] AS primary_category_name
    FROM legacy.app_categories ac
    JOIN legacy.steam_categories sc ON sc.category_id = ac.category_id
    WHERE ac.appid = a.appid
  ) c ON true
),
latest_storefront AS (
  SELECT DISTINCT ON (appid)
    appid,
    snapshot_summary,
    first_seen_at AS latest_storefront_snapshot_at
  FROM docs.app_source_snapshots
  WHERE source = 'storefront'
  ORDER BY appid, first_seen_at DESC, id DESC
),
latest_news AS (
  SELECT DISTINCT ON (n.appid)
    n.appid,
    COALESCE(n.published_at, n.first_seen_at) AS latest_news_at,
    sp.title AS latest_news_title,
    n.url AS latest_news_url
  FROM docs.steam_news_items n
  LEFT JOIN docs.steam_news_search_projection sp ON sp.gid = n.gid
  ORDER BY n.appid, COALESCE(n.published_at, n.first_seen_at) DESC, n.gid DESC
),
latest_change AS (
  SELECT DISTINCT ON (e.appid)
    e.appid,
    e.occurred_at AS latest_change_at,
    e.change_type AS latest_change_type,
    COALESCE(
      e.context ->> 'headline',
      e.context ->> 'summary',
      replace(e.change_type, '_', ' ')
    ) AS latest_change_summary
  FROM events.app_change_events e
  ORDER BY e.appid, e.occurred_at DESC, e.id DESC
),
activity_30d AS (
  SELECT
    w.appid,
    w.latest_occurred_at AS latest_activity_at,
    w.activity_ids,
    w.signal_families,
    w.story_kinds,
    w.announcement_count,
    w.change_count,
    w.release_count,
    w.pricing_count,
    w.store_page_count,
    w.media_count,
    w.taxonomy_count,
    w.platform_count,
    w.build_count
  FROM events.change_pattern_app_windows w
  WHERE w.window_days = 30
),
base_rows AS (
  SELECT
    a.*,
    sync.storefront_accessible,
    sync.last_storefront_sync,
    sync.last_news_sync,
    sync.last_media_sync,
    sync.updated_at AS sync_updated_at,
    publisher.publisher_id,
    publisher.publisher_name,
    publisher.publisher_normalized_name,
    publisher.publisher_steam_vanity_url,
    publisher.publisher_game_count,
    developer.developer_id,
    developer.developer_name,
    developer.developer_normalized_name,
    developer.developer_steam_vanity_url,
    developer.developer_game_count,
    COALESCE(portfolio.released_game_count, 0) AS publisher_released_game_count,
    COALESCE(portfolio.total_owners, 0) AS publisher_total_owners,
    COALESCE(portfolio.max_game_reviews, 0) AS publisher_max_game_reviews,
    sp.appid IS NOT NULL AS is_self_published,
    taxonomy.genre_ids,
    taxonomy.genre_names,
    taxonomy.tag_ids,
    taxonomy.tag_names,
    taxonomy.primary_tag_name,
    taxonomy.category_ids,
    taxonomy.category_names,
    taxonomy.primary_category_name,
    storefront.snapshot_summary,
    storefront.latest_storefront_snapshot_at,
    news.latest_news_at,
    news.latest_news_title,
    news.latest_news_url,
    change.latest_change_at,
    change.latest_change_type,
    change.latest_change_summary,
    activity.latest_activity_at,
    COALESCE(activity.activity_ids, ARRAY[]::text[]) AS activity_ids_30d,
    COALESCE(activity.signal_families, ARRAY[]::text[]) AS signal_families_30d,
    COALESCE(activity.story_kinds, ARRAY[]::text[]) AS story_kinds_30d,
    COALESCE(activity.announcement_count, 0) AS announcement_count_30d,
    COALESCE(activity.change_count, 0) AS change_count_30d,
    COALESCE(activity.release_count, 0) AS release_count_30d,
    COALESCE(activity.pricing_count, 0) AS pricing_count_30d,
    COALESCE(activity.store_page_count, 0) AS store_page_count_30d,
    COALESCE(activity.media_count, 0) AS media_count_30d,
    COALESCE(activity.taxonomy_count, 0) AS taxonomy_count_30d,
    COALESCE(activity.platform_count, 0) AS platform_count_30d,
    COALESCE(activity.build_count, 0) AS build_count_30d
  FROM legacy.apps a
  JOIN ops.sync_status sync ON sync.appid = a.appid
  LEFT JOIN publisher_primary publisher ON publisher.appid = a.appid
  LEFT JOIN publisher_portfolio portfolio ON portfolio.publisher_id = publisher.publisher_id
  LEFT JOIN developer_primary developer ON developer.appid = a.appid
  LEFT JOIN self_published sp ON sp.appid = a.appid
  LEFT JOIN taxonomy ON taxonomy.appid = a.appid
  LEFT JOIN latest_storefront storefront ON storefront.appid = a.appid
  LEFT JOIN latest_news news ON news.appid = a.appid
  LEFT JOIN latest_change change ON change.appid = a.appid
  LEFT JOIN activity_30d activity ON activity.appid = a.appid
  WHERE COALESCE(a.type, 'game') = 'game'
    AND COALESCE(a.is_released, false) = false
    AND COALESCE(a.is_delisted, false) = false
    AND COALESCE(sync.storefront_accessible, false) = true
)
SELECT
  b.appid,
  b.name,
  lower(b.name) AS name_lower,
  b.type,
  COALESCE(b.release_date, NULL) AS release_date,
  b.release_date_raw,
  CASE
    WHEN b.release_date IS NULL THEN 'undated'
    WHEN b.release_date < CURRENT_DATE THEN 'stale_past_date'
    ELSE 'dated_future'
  END AS release_status,
  CASE WHEN b.release_date IS NOT NULL THEN b.release_date - CURRENT_DATE ELSE NULL END AS days_until_release,
  COALESCE(b.last_seen_in_steam_applist_at, b.created_at) AS latest_added_at,
  COALESCE(b.is_free, false) AS is_free,
  b.current_price_cents,
  COALESCE(b.current_discount_percent, 0) AS current_discount_percent,
  COALESCE(b.has_purchase_packages, false) AS has_purchase_packages,
  COALESCE(b.has_workshop, false) AS has_workshop,
  b.release_state,
  b.app_state,
  b.platforms,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN b.platforms ILIKE '%windows%' THEN 'windows' END,
    CASE WHEN b.platforms ILIKE '%mac%' THEN 'mac' END,
    CASE WHEN b.platforms ILIKE '%linux%' THEN 'linux' END
  ], NULL) AS platform_array,
  b.controller_support,
  b.languages,
  b.content_descriptors,
  jsonb_path_exists(COALESCE(b.content_descriptors, '{}'::jsonb), '$.* ? (@ == "3")') AS is_adult_content,
  b.publisher_id,
  b.publisher_name,
  b.publisher_steam_vanity_url,
  b.publisher_game_count,
  b.publisher_released_game_count,
  b.publisher_total_owners,
  b.publisher_max_game_reviews,
  b.developer_id,
  b.developer_name,
  b.developer_steam_vanity_url,
  b.developer_game_count,
  b.is_self_published,
  CASE
    WHEN b.publisher_id IS NULL THEN 'no_publisher'
    WHEN b.is_self_published THEN 'self_published'
    WHEN COALESCE(b.publisher_total_owners, 0) <= 200000
      AND COALESCE(b.publisher_released_game_count, 0) <= 5 THEN 'small_publisher'
    ELSE 'established_publisher'
  END AS publisher_status,
  b.genre_ids,
  b.genre_names,
  b.tag_ids,
  b.tag_names,
  b.primary_tag_name,
  b.category_ids,
  b.category_names,
  b.primary_category_name,
  COALESCE((b.snapshot_summary #>> '{counts,screenshots}')::integer, 0) AS screenshot_count,
  COALESCE((b.snapshot_summary #>> '{counts,movies}')::integer, 0) AS movie_count,
  b.latest_storefront_snapshot_at,
  b.latest_news_at,
  b.latest_news_title,
  b.latest_news_url,
  b.latest_change_at,
  b.latest_change_type,
  b.latest_change_summary,
  b.latest_activity_at,
  b.activity_ids_30d,
  b.signal_families_30d,
  b.story_kinds_30d,
  b.announcement_count_30d,
  b.change_count_30d,
  b.release_count_30d,
  b.pricing_count_30d,
  b.store_page_count_30d,
  b.media_count_30d,
  b.taxonomy_count_30d,
  b.platform_count_30d,
  b.build_count_30d,
  (
    CASE
      WHEN b.release_date IS NULL THEN 8
      WHEN b.release_date - CURRENT_DATE <= 30 THEN 20
      WHEN b.release_date - CURRENT_DATE <= 60 THEN 17
      WHEN b.release_date - CURRENT_DATE <= 90 THEN 14
      WHEN b.release_date - CURRENT_DATE <= 180 THEN 10
      ELSE 6
    END
    + LEAST(20, ROUND(COALESCE(b.change_count_30d, 0) * 0.7 + COALESCE(b.announcement_count_30d, 0) * 2)::integer)
    + LEAST(20, ROUND((COALESCE(b.taxonomy_count_30d, 0) + COALESCE(b.media_count_30d, 0) + COALESCE(b.store_page_count_30d, 0)) * 1.2)::integer)
    + LEAST(20,
        CASE WHEN COALESCE((b.snapshot_summary #>> '{counts,screenshots}')::integer, 0) > 0 THEN 5 ELSE 0 END
        + CASE WHEN COALESCE((b.snapshot_summary #>> '{counts,movies}')::integer, 0) > 0 THEN 5 ELSE 0 END
        + CASE WHEN COALESCE(array_length(b.tag_ids, 1), 0) > 0 THEN 3 ELSE 0 END
        + CASE WHEN COALESCE(array_length(b.category_ids, 1), 0) > 0 THEN 3 ELSE 0 END
        + CASE WHEN COALESCE(array_length(b.genre_ids, 1), 0) > 0 THEN 2 ELSE 0 END
        + CASE WHEN b.current_price_cents IS NOT NULL OR COALESCE(b.is_free, false) THEN 2 ELSE 0 END
      )
    + CASE
      WHEN b.publisher_id IS NULL THEN 20
      WHEN b.is_self_published AND COALESCE(b.publisher_total_owners, 0) <= 50000 THEN 18
      WHEN b.is_self_published AND COALESCE(b.publisher_total_owners, 0) <= 200000 THEN 14
      WHEN COALESCE(b.publisher_total_owners, 0) <= 50000 AND COALESCE(b.publisher_released_game_count, 0) <= 2 THEN 16
      WHEN COALESCE(b.publisher_total_owners, 0) <= 200000 AND COALESCE(b.publisher_released_game_count, 0) <= 5 THEN 12
      ELSE 0
    END
  )::integer AS opportunity_score,
  GREATEST(
    b.updated_at,
    COALESCE(b.sync_updated_at, b.updated_at),
    COALESCE(b.latest_storefront_snapshot_at, b.updated_at),
    COALESCE(b.latest_change_at, b.updated_at),
    COALESCE(b.latest_news_at, b.updated_at)
  ) AS data_updated_at,
  now() AS projection_refreshed_at
FROM base_rows b
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_unreleased_games_projection_appid
  ON metrics.unreleased_games_projection (appid);
CREATE INDEX IF NOT EXISTS idx_metrics_unreleased_games_projection_default
  ON metrics.unreleased_games_projection (is_adult_content, opportunity_score DESC NULLS LAST, latest_change_at DESC NULLS LAST, appid);
CREATE INDEX IF NOT EXISTS idx_metrics_unreleased_games_projection_latest_added
  ON metrics.unreleased_games_projection (is_adult_content, latest_added_at DESC NULLS LAST, appid);
CREATE INDEX IF NOT EXISTS idx_metrics_unreleased_games_projection_release_date
  ON metrics.unreleased_games_projection (is_adult_content, release_status, release_date ASC NULLS LAST, appid);
CREATE INDEX IF NOT EXISTS idx_metrics_unreleased_games_projection_latest_news
  ON metrics.unreleased_games_projection (is_adult_content, latest_news_at DESC NULLS LAST, appid);
CREATE INDEX IF NOT EXISTS idx_metrics_unreleased_games_projection_latest_change
  ON metrics.unreleased_games_projection (is_adult_content, latest_change_at DESC NULLS LAST, appid);
CREATE INDEX IF NOT EXISTS idx_metrics_unreleased_games_projection_title
  ON metrics.unreleased_games_projection (name ASC, appid);
CREATE INDEX IF NOT EXISTS idx_metrics_unreleased_games_projection_publisher_status
  ON metrics.unreleased_games_projection (publisher_status, opportunity_score DESC NULLS LAST, appid);

CREATE INDEX IF NOT EXISTS idx_metrics_unreleased_games_projection_genres
  ON metrics.unreleased_games_projection USING gin (genre_ids);
CREATE INDEX IF NOT EXISTS idx_metrics_unreleased_games_projection_tags
  ON metrics.unreleased_games_projection USING gin (tag_ids);
CREATE INDEX IF NOT EXISTS idx_metrics_unreleased_games_projection_categories
  ON metrics.unreleased_games_projection USING gin (category_ids);
CREATE INDEX IF NOT EXISTS idx_metrics_unreleased_games_projection_platforms
  ON metrics.unreleased_games_projection USING gin (platform_array);
CREATE INDEX IF NOT EXISTS idx_metrics_unreleased_games_projection_signal_families
  ON metrics.unreleased_games_projection USING gin (signal_families_30d);

CREATE INDEX IF NOT EXISTS idx_metrics_unreleased_games_projection_name
  ON metrics.unreleased_games_projection USING gin (name_lower public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_metrics_unreleased_games_projection_publisher_name
  ON metrics.unreleased_games_projection USING gin (publisher_name public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_metrics_unreleased_games_projection_developer_name
  ON metrics.unreleased_games_projection USING gin (developer_name public.gin_trgm_ops);

CREATE MATERIALIZED VIEW IF NOT EXISTS metrics.unreleased_filter_counts AS
SELECT 'genre'::text AS filter_type, genre_id AS option_id, COUNT(*)::integer AS app_count
FROM metrics.unreleased_games_projection p
CROSS JOIN LATERAL unnest(p.genre_ids) genre_id
WHERE p.is_adult_content = false
GROUP BY genre_id
UNION ALL
SELECT 'tag'::text AS filter_type, tag_id AS option_id, COUNT(*)::integer AS app_count
FROM metrics.unreleased_games_projection p
CROSS JOIN LATERAL unnest(p.tag_ids) tag_id
WHERE p.is_adult_content = false
GROUP BY tag_id
UNION ALL
SELECT 'category'::text AS filter_type, category_id AS option_id, COUNT(*)::integer AS app_count
FROM metrics.unreleased_games_projection p
CROSS JOIN LATERAL unnest(p.category_ids) category_id
WHERE p.is_adult_content = false
GROUP BY category_id
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_unreleased_filter_counts_type_option
  ON metrics.unreleased_filter_counts (filter_type, option_id);
CREATE INDEX IF NOT EXISTS idx_metrics_unreleased_filter_counts_type_count
  ON metrics.unreleased_filter_counts (filter_type, app_count DESC);

COMMENT ON MATERIALIZED VIEW metrics.unreleased_games_projection IS
  'Precomputed unreleased Steam games projection for the admin /unreleased page. Refresh after Tiger storefront, news, media, and change-intel sync batches.';
COMMENT ON MATERIALIZED VIEW metrics.unreleased_filter_counts IS
  'Precomputed default non-adult taxonomy option counts for the admin /unreleased filter UI.';

-- Initial population. This can be slow; run off peak if applying manually.
REFRESH MATERIALIZED VIEW metrics.unreleased_games_projection;
REFRESH MATERIALIZED VIEW metrics.unreleased_filter_counts;

-- Follow-up refreshes may use CONCURRENTLY after the initial population:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY metrics.unreleased_games_projection;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY metrics.unreleased_filter_counts;
