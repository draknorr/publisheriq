-- Migration: Add unified Change Feed activity read surface
-- Purpose:
--   1. Provide one card-ready activity stream for /changes
--   2. Hide internal source naming from the page contract
--   3. Support server-side scoring and keyset pagination for activity cards

CREATE OR REPLACE FUNCTION get_change_feed_activity(
  p_days INTEGER DEFAULT 7,
  p_view TEXT DEFAULT 'overview',
  p_mode TEXT DEFAULT 'all',
  p_app_types TEXT[] DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_signal_families TEXT[] DEFAULT NULL,
  p_sort TEXT DEFAULT 'relevant',
  p_cursor_score DOUBLE PRECISION DEFAULT NULL,
  p_cursor_time TIMESTAMPTZ DEFAULT NULL,
  p_cursor_activity_id TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  activity_id TEXT,
  activity_kind TEXT,
  story_kind TEXT,
  appid INTEGER,
  app_name TEXT,
  app_type TEXT,
  is_released BOOLEAN,
  release_date DATE,
  occurred_at TIMESTAMPTZ,
  headline TEXT,
  summary TEXT,
  facts TEXT[],
  highlight_labels TEXT[],
  signal_families TEXT[],
  has_before_after BOOLEAN,
  related_announcement_count INTEGER,
  external_url TEXT,
  sort_score DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered_change_events AS (
    SELECT
      e.appid,
      e.change_type::TEXT AS change_type,
      e.occurred_at
    FROM app_change_events e
    JOIN apps a ON a.appid = e.appid
    WHERE e.source IN ('storefront', 'pics', 'media')
      AND e.occurred_at >= NOW() - make_interval(days => GREATEST(COALESCE(p_days, 7), 1))
      AND (
        p_app_types IS NULL
        OR a.type::TEXT = ANY (p_app_types)
      )
      AND (
        p_search IS NULL
        OR a.name ILIKE '%' || p_search || '%'
      )
  ),
  sequenced_changes AS (
    SELECT
      fce.*,
      CASE
        WHEN LAG(fce.occurred_at) OVER app_window IS NULL THEN 1
        WHEN fce.occurred_at - LAG(fce.occurred_at) OVER app_window > INTERVAL '90 minutes' THEN 1
        ELSE 0
      END AS starts_new_burst
    FROM filtered_change_events fce
    WINDOW app_window AS (PARTITION BY fce.appid ORDER BY fce.occurred_at)
  ),
  burst_members AS (
    SELECT
      sc.*,
      SUM(sc.starts_new_burst) OVER (
        PARTITION BY sc.appid
        ORDER BY sc.occurred_at
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS burst_number
    FROM sequenced_changes sc
  ),
  change_core AS (
    SELECT
      bm.appid,
      a.name AS app_name,
      a.type::TEXT AS app_type,
      a.is_released,
      a.release_date,
      MIN(bm.occurred_at) AS burst_started_at,
      MAX(bm.occurred_at) AS occurred_at,
      COUNT(*)::INTEGER AS event_count,
      COUNT(DISTINCT bm.change_type)::INTEGER AS change_type_count,
      ARRAY(
        SELECT DISTINCT bm_type.change_type
        FROM burst_members bm_type
        WHERE bm_type.appid = bm.appid
          AND bm_type.burst_number = bm.burst_number
        ORDER BY 1
      ) AS change_types
    FROM burst_members bm
    JOIN apps a ON a.appid = bm.appid
    GROUP BY
      bm.appid,
      bm.burst_number,
      a.name,
      a.type,
      a.is_released,
      a.release_date
  ),
  change_enriched AS (
    SELECT
      'change:' ||
        FORMAT(
          '%s:%s:%s',
          cc.appid,
          TO_CHAR(cc.burst_started_at AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS.MS"Z"'),
          TO_CHAR(cc.occurred_at AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS.MS"Z"')
        ) AS activity_id,
      'change'::TEXT AS activity_kind,
      cc.appid,
      cc.app_name,
      cc.app_type,
      cc.is_released,
      cc.release_date,
      cc.occurred_at,
      cc.event_count,
      cc.change_type_count,
      cc.change_types,
      ARRAY_REMOVE(ARRAY[
        CASE
          WHEN cc.change_types && ARRAY['release_date_text_change']::TEXT[] THEN 'release'
        END,
        CASE
          WHEN cc.change_types && ARRAY[
            'price_change',
            'discount_start',
            'discount_end',
            'dlc_references_changed',
            'package_references_changed'
          ]::TEXT[] THEN 'pricing'
        END,
        CASE
          WHEN cc.change_types && ARRAY[
            'description_rewrite',
            'short_description_rewrite'
          ]::TEXT[] THEN 'store-page'
        END,
        CASE
          WHEN cc.change_types && ARRAY[
            'capsule_url_changed',
            'header_url_changed',
            'background_url_changed',
            'screenshot_added',
            'screenshot_removed',
            'screenshot_reordered',
            'trailer_added',
            'trailer_removed',
            'trailer_reordered',
            'trailer_thumbnail_changed'
          ]::TEXT[] THEN 'media'
        END,
        CASE
          WHEN cc.change_types && ARRAY[
            'tags_added',
            'tags_removed',
            'genres_changed',
            'categories_changed',
            'publisher_association_changed',
            'developer_association_changed'
          ]::TEXT[] THEN 'taxonomy'
        END,
        CASE
          WHEN cc.change_types && ARRAY[
            'languages_changed',
            'platforms_changed',
            'controller_support_changed',
            'steam_deck_status_changed'
          ]::TEXT[] THEN 'platform'
        END,
        CASE
          WHEN cc.change_types && ARRAY[
            'build_id_changed',
            'last_content_update_changed'
          ]::TEXT[] THEN 'build'
        END
      ], NULL) AS signal_families,
      ARRAY(
        SELECT DISTINCT
          CASE bm_type
            WHEN 'description_rewrite' THEN 'Store description'
            WHEN 'short_description_rewrite' THEN 'Short description'
            WHEN 'release_date_text_change' THEN 'Release timing'
            WHEN 'price_change' THEN 'Price'
            WHEN 'discount_start' THEN 'Discount'
            WHEN 'discount_end' THEN 'Discount'
            WHEN 'tags_added' THEN 'Tags'
            WHEN 'tags_removed' THEN 'Tags'
            WHEN 'genres_changed' THEN 'Genres'
            WHEN 'categories_changed' THEN 'Categories'
            WHEN 'languages_changed' THEN 'Languages'
            WHEN 'platforms_changed' THEN 'Platforms'
            WHEN 'controller_support_changed' THEN 'Controller support'
            WHEN 'steam_deck_status_changed' THEN 'Steam Deck'
            WHEN 'publisher_association_changed' THEN 'Publisher'
            WHEN 'developer_association_changed' THEN 'Developer'
            WHEN 'dlc_references_changed' THEN 'DLC'
            WHEN 'package_references_changed' THEN 'Packages'
            WHEN 'build_id_changed' THEN 'Build'
            WHEN 'last_content_update_changed' THEN 'Content update'
            WHEN 'capsule_url_changed' THEN 'Capsule art'
            WHEN 'header_url_changed' THEN 'Header art'
            WHEN 'background_url_changed' THEN 'Background art'
            WHEN 'screenshot_added' THEN 'Screenshots'
            WHEN 'screenshot_removed' THEN 'Screenshots'
            WHEN 'screenshot_reordered' THEN 'Screenshots'
            WHEN 'trailer_added' THEN 'Trailer'
            WHEN 'trailer_removed' THEN 'Trailer'
            WHEN 'trailer_reordered' THEN 'Trailer'
            WHEN 'trailer_thumbnail_changed' THEN 'Trailer art'
            ELSE INITCAP(REPLACE(bm_type, '_', ' '))
          END
        FROM unnest(cc.change_types) AS bm_type
        ORDER BY 1
        LIMIT 4
      ) AS highlight_labels
    FROM change_core cc
  ),
  change_activity AS (
    SELECT
      ce.activity_id,
      ce.activity_kind,
      CASE
        WHEN ce.signal_families && ARRAY['release']::TEXT[]
          OR ce.is_released = FALSE
          OR (ce.release_date IS NOT NULL AND ce.release_date >= CURRENT_DATE - 30)
          THEN 'release-prep'
        WHEN ce.signal_families && ARRAY['pricing']::TEXT[]
          THEN 'commercial-move'
        WHEN ce.signal_families && ARRAY['store-page', 'media']::TEXT[]
          THEN 'store-refresh'
        WHEN ce.signal_families && ARRAY['taxonomy']::TEXT[]
          THEN 'positioning-shift'
        WHEN ce.signal_families && ARRAY['platform']::TEXT[]
          THEN 'platform-expansion'
        WHEN ce.signal_families && ARRAY['build']::TEXT[]
          THEN 'build-activity'
        ELSE 'general-update'
      END AS story_kind,
      ce.appid,
      ce.app_name,
      ce.app_type,
      ce.is_released,
      ce.release_date,
      ce.occurred_at,
      CASE
        WHEN ce.change_types && ARRAY['release_date_text_change']::TEXT[]
          THEN 'Locked in more precise release timing'
        WHEN ce.signal_families && ARRAY['pricing']::TEXT[]
          THEN 'Adjusted pricing, packages, or monetization setup'
        WHEN ce.signal_families && ARRAY['store-page', 'media']::TEXT[]
          THEN 'Refreshed store presentation and merchandising'
        WHEN ce.signal_families && ARRAY['taxonomy']::TEXT[]
          THEN 'Shifted tags, genres, or positioning signals'
        WHEN ce.signal_families && ARRAY['platform']::TEXT[]
          THEN 'Expanded platform, language, or audience reach'
        WHEN ce.signal_families && ARRAY['build']::TEXT[]
          THEN 'Shipped a new build or content update'
        WHEN ce.change_type_count > 1
          THEN 'Multiple Steam changes landed together'
        ELSE 'Single Steam change detected'
      END AS headline,
      CASE
        WHEN ce.signal_families && ARRAY['build']::TEXT[]
          AND NOT (ce.signal_families && ARRAY['pricing', 'store-page', 'media', 'taxonomy', 'platform', 'release']::TEXT[])
          THEN 'Grouped technical updates into one readable activity card.'
        ELSE 'Grouped recent Steam changes into one readable activity card.'
      END AS summary,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN ce.is_released = FALSE THEN 'Upcoming title' END,
        CASE WHEN ce.release_date IS NOT NULL AND ce.release_date >= CURRENT_DATE - 30 THEN 'Released in the last 30 days' END,
        ce.event_count::TEXT || ' grouped updates',
        ce.change_type_count::TEXT || ' change types'
      ], NULL) AS facts,
      ce.highlight_labels,
      ce.signal_families,
      TRUE AS has_before_after,
      0::INTEGER AS related_announcement_count,
      NULL::TEXT AS external_url,
      (
        CASE
          WHEN ce.signal_families && ARRAY['release']::TEXT[]
            OR ce.is_released = FALSE
            OR (ce.release_date IS NOT NULL AND ce.release_date >= CURRENT_DATE - 30)
            THEN 42
          WHEN ce.signal_families && ARRAY['pricing']::TEXT[] THEN 38
          WHEN ce.signal_families && ARRAY['store-page', 'media']::TEXT[] THEN 32
          WHEN ce.signal_families && ARRAY['taxonomy']::TEXT[] THEN 30
          WHEN ce.signal_families && ARRAY['platform']::TEXT[] THEN 28
          WHEN ce.signal_families && ARRAY['build']::TEXT[] THEN 14
          ELSE 20
        END
        + ce.event_count * 6
        + ce.change_type_count * 4
      )::DOUBLE PRECISION AS relevance_score,
      (
        ce.event_count * 6
        + ce.change_type_count * 8
        + COALESCE(CARDINALITY(ce.highlight_labels), 0) * 4
      )::DOUBLE PRECISION AS magnitude_score,
      (
        CASE WHEN ce.signal_families && ARRAY['pricing']::TEXT[] THEN 80 ELSE 0 END
        + ce.event_count * 6
        + ce.change_type_count * 4
      )::DOUBLE PRECISION AS commercial_score,
      (
        CASE
          WHEN ce.signal_families && ARRAY['release']::TEXT[]
            OR ce.is_released = FALSE
            OR (ce.release_date IS NOT NULL AND ce.release_date >= CURRENT_DATE - 30)
            THEN 90
          ELSE 0
        END
        + ce.event_count * 4
      )::DOUBLE PRECISION AS launch_score
    FROM change_enriched ce
  ),
  announcement_activity AS (
    SELECT
      'announcement:' || n.gid AS activity_id,
      'announcement'::TEXT AS activity_kind,
      'announcement'::TEXT AS story_kind,
      n.appid,
      a.name AS app_name,
      a.type::TEXT AS app_type,
      a.is_released,
      a.release_date,
      COALESCE(n.published_at, n.first_seen_at) AS occurred_at,
      COALESCE(lv.title, 'New Steam announcement published') AS headline,
      CASE
        WHEN n.feedlabel IS NOT NULL AND n.feedname IS NOT NULL
          THEN a.name || ' published a Steam announcement in ' || n.feedlabel || ' / ' || n.feedname || '.'
        WHEN n.feedlabel IS NOT NULL
          THEN a.name || ' published a Steam announcement in ' || n.feedlabel || '.'
        WHEN n.feedname IS NOT NULL
          THEN a.name || ' published a Steam announcement in ' || n.feedname || '.'
        ELSE a.name || ' published a new Steam announcement.'
      END AS summary,
      ARRAY_REMOVE(ARRAY[n.feedlabel, n.feedname], NULL) AS facts,
      ARRAY_REMOVE(ARRAY[n.feedlabel, n.feedname], NULL) AS highlight_labels,
      ARRAY['announcement']::TEXT[] AS signal_families,
      FALSE AS has_before_after,
      0::INTEGER AS related_announcement_count,
      COALESCE(lv.url, n.url) AS external_url,
      16::DOUBLE PRECISION AS relevance_score,
      8::DOUBLE PRECISION AS magnitude_score,
      6::DOUBLE PRECISION AS commercial_score,
      CASE
        WHEN a.is_released = FALSE OR (a.release_date IS NOT NULL AND a.release_date >= CURRENT_DATE - 30)
          THEN 24::DOUBLE PRECISION
        ELSE 6::DOUBLE PRECISION
      END AS launch_score
    FROM steam_news_items n
    JOIN apps a ON a.appid = n.appid
    LEFT JOIN LATERAL (
      SELECT
        v.title,
        v.url
      FROM steam_news_versions v
      WHERE v.gid = n.gid
      ORDER BY v.first_seen_at DESC
      LIMIT 1
    ) lv ON TRUE
    WHERE COALESCE(n.published_at, n.first_seen_at) >= NOW() - make_interval(days => GREATEST(COALESCE(p_days, 7), 1))
      AND (
        p_app_types IS NULL
        OR a.type::TEXT = ANY (p_app_types)
      )
      AND (
        p_search IS NULL
        OR a.name ILIKE '%' || p_search || '%'
        OR COALESCE(lv.title, '') ILIKE '%' || p_search || '%'
      )
  ),
  combined AS (
    SELECT
      ca.activity_id,
      ca.activity_kind,
      ca.story_kind,
      ca.appid,
      ca.app_name,
      ca.app_type,
      ca.is_released,
      ca.release_date,
      ca.occurred_at,
      ca.headline,
      ca.summary,
      ca.facts,
      ca.highlight_labels,
      ca.signal_families,
      ca.has_before_after,
      ca.related_announcement_count,
      ca.external_url,
      CASE COALESCE(p_sort, 'relevant')
        WHEN 'newest' THEN EXTRACT(EPOCH FROM ca.occurred_at)
        WHEN 'biggest-change' THEN ca.magnitude_score
        WHEN 'most-commercial' THEN ca.commercial_score
        WHEN 'most-launch-relevant' THEN ca.launch_score
        ELSE ca.relevance_score
      END AS sort_score
    FROM change_activity ca
    WHERE p_mode IN ('all', 'changes')

    UNION ALL

    SELECT
      aa.activity_id,
      aa.activity_kind,
      aa.story_kind,
      aa.appid,
      aa.app_name,
      aa.app_type,
      aa.is_released,
      aa.release_date,
      aa.occurred_at,
      aa.headline,
      aa.summary,
      aa.facts,
      aa.highlight_labels,
      aa.signal_families,
      aa.has_before_after,
      aa.related_announcement_count,
      aa.external_url,
      CASE COALESCE(p_sort, 'relevant')
        WHEN 'newest' THEN EXTRACT(EPOCH FROM aa.occurred_at)
        WHEN 'biggest-change' THEN aa.magnitude_score
        WHEN 'most-commercial' THEN aa.commercial_score
        WHEN 'most-launch-relevant' THEN aa.launch_score
        ELSE aa.relevance_score
      END AS sort_score
    FROM announcement_activity aa
    WHERE p_mode IN ('all', 'announcements')
  ),
  view_filtered AS (
    SELECT *
    FROM combined c
    WHERE (
      p_signal_families IS NULL
      OR c.signal_families && p_signal_families
    )
      AND CASE COALESCE(p_view, 'overview')
        WHEN 'launch-watch' THEN
          c.story_kind = 'release-prep'
          OR c.is_released = FALSE
          OR (c.release_date IS NOT NULL AND c.release_date >= CURRENT_DATE - 30)
        WHEN 'commercial-moves' THEN
          c.story_kind = 'commercial-move'
          OR c.signal_families && ARRAY['pricing']::TEXT[]
        WHEN 'store-refreshes' THEN
          c.story_kind IN ('store-refresh', 'positioning-shift', 'platform-expansion')
          OR c.signal_families && ARRAY['store-page', 'media', 'taxonomy', 'platform']::TEXT[]
        ELSE TRUE
      END
  )
  SELECT
    vf.activity_id,
    vf.activity_kind,
    vf.story_kind,
    vf.appid,
    vf.app_name,
    vf.app_type,
    vf.is_released,
    vf.release_date,
    vf.occurred_at,
    vf.headline,
    vf.summary,
    vf.facts,
    vf.highlight_labels,
    vf.signal_families,
    vf.has_before_after,
    vf.related_announcement_count,
    vf.external_url,
    vf.sort_score
  FROM view_filtered vf
  WHERE (
    p_cursor_score IS NULL
    OR p_cursor_time IS NULL
    OR p_cursor_activity_id IS NULL
    OR (vf.sort_score, vf.occurred_at, vf.activity_id) < (p_cursor_score, p_cursor_time, p_cursor_activity_id)
  )
  ORDER BY vf.sort_score DESC, vf.occurred_at DESC, vf.activity_id DESC
  LIMIT LEAST(COALESCE(p_limit, 50), 100);
$$;

COMMENT ON FUNCTION get_change_feed_activity(INTEGER, TEXT, TEXT, TEXT[], TEXT, TEXT[], TEXT, DOUBLE PRECISION, TIMESTAMPTZ, TEXT, INTEGER) IS
  'Returns a unified activity-card stream for /changes, combining change bursts and announcements with user-facing scoring.';

REVOKE EXECUTE ON FUNCTION get_change_feed_activity(INTEGER, TEXT, TEXT, TEXT[], TEXT, TEXT[], TEXT, DOUBLE PRECISION, TIMESTAMPTZ, TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_change_feed_activity(INTEGER, TEXT, TEXT, TEXT[], TEXT, TEXT[], TEXT, DOUBLE PRECISION, TIMESTAMPTZ, TEXT, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION get_change_feed_activity(INTEGER, TEXT, TEXT, TEXT[], TEXT, TEXT[], TEXT, DOUBLE PRECISION, TIMESTAMPTZ, TEXT, INTEGER) TO authenticated, service_role;
