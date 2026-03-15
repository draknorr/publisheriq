-- Migration: Add Change Feed read surfaces
-- Creates read-only SQL functions for grouped change bursts, burst detail,
-- and news feed rows used by the admin Change Feed page.

CREATE INDEX IF NOT EXISTS idx_steam_news_items_published_gid
  ON steam_news_items(published_at DESC NULLS LAST, gid DESC);

CREATE OR REPLACE FUNCTION get_change_feed_bursts(
  p_days INTEGER DEFAULT 7,
  p_preset TEXT DEFAULT 'high_signal',
  p_app_types TEXT[] DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_source_filter TEXT[] DEFAULT NULL,
  p_cursor_time TIMESTAMPTZ DEFAULT NULL,
  p_cursor_burst_id TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  burst_id TEXT,
  appid INTEGER,
  app_name TEXT,
  app_type TEXT,
  is_released BOOLEAN,
  release_date DATE,
  effective_at TIMESTAMPTZ,
  burst_started_at TIMESTAMPTZ,
  burst_ended_at TIMESTAMPTZ,
  event_count INTEGER,
  source_set TEXT[],
  headline_change_types TEXT[],
  change_type_count INTEGER,
  has_related_news BOOLEAN,
  related_news_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered_events AS (
    SELECT
      e.id,
      e.appid,
      e.source,
      e.change_type,
      e.occurred_at
    FROM app_change_events e
    WHERE e.source IN ('storefront', 'pics', 'media')
      AND e.occurred_at >= NOW() - make_interval(days => GREATEST(COALESCE(p_days, 7), 1))
      AND (
        p_source_filter IS NULL
        OR e.source::TEXT = ANY (p_source_filter)
      )
  ),
  sequenced AS (
    SELECT
      fe.*,
      CASE
        WHEN LAG(fe.occurred_at) OVER app_window IS NULL THEN 1
        WHEN fe.occurred_at - LAG(fe.occurred_at) OVER app_window > INTERVAL '90 minutes' THEN 1
        ELSE 0
      END AS starts_new_burst
    FROM filtered_events fe
    WINDOW app_window AS (PARTITION BY fe.appid ORDER BY fe.occurred_at)
  ),
  burst_members AS (
    SELECT
      s.*,
      SUM(s.starts_new_burst) OVER (
        PARTITION BY s.appid
        ORDER BY s.occurred_at
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS burst_number
    FROM sequenced s
  ),
  burst_core AS (
    SELECT
      bm.appid,
      bm.burst_number,
      MIN(bm.occurred_at) AS burst_started_at,
      MAX(bm.occurred_at) AS burst_ended_at,
      COUNT(*)::INTEGER AS event_count,
      COUNT(DISTINCT bm.change_type)::INTEGER AS change_type_count,
      BOOL_OR(bm.change_type::TEXT NOT IN ('build_id_changed', 'last_content_update_changed')) AS has_non_technical,
      ARRAY(
        SELECT DISTINCT bm_source.source::TEXT
        FROM burst_members bm_source
        WHERE bm_source.appid = bm.appid
          AND bm_source.burst_number = bm.burst_number
        ORDER BY 1
      ) AS source_set,
      ARRAY(
        SELECT DISTINCT bm_type.change_type::TEXT
        FROM burst_members bm_type
        WHERE bm_type.appid = bm.appid
          AND bm_type.burst_number = bm.burst_number
        ORDER BY 1
        LIMIT 3
      ) AS headline_change_types
    FROM burst_members bm
    GROUP BY bm.appid, bm.burst_number
  ),
  enriched AS (
    SELECT
      bc.appid,
      a.name AS app_name,
      a.type::TEXT AS app_type,
      a.is_released,
      a.release_date,
      bc.burst_started_at,
      bc.burst_ended_at,
      bc.burst_ended_at AS effective_at,
      bc.event_count,
      bc.source_set,
      bc.headline_change_types,
      bc.change_type_count,
      bc.has_non_technical,
      COALESCE(ldm.total_reviews, 0) AS total_reviews,
      COALESCE(ldm.ccu_peak, 0) AS ccu_peak
    FROM burst_core bc
    JOIN apps a ON a.appid = bc.appid
    LEFT JOIN latest_daily_metrics ldm ON ldm.appid = bc.appid
    WHERE (
      p_app_types IS NULL
      OR a.type::TEXT = ANY (p_app_types)
    )
      AND (
        p_search IS NULL
        OR a.name ILIKE '%' || p_search || '%'
      )
  ),
  with_related_news AS (
    SELECT
      e.*,
      COALESCE(news_match.related_news_count, 0)::INTEGER AS related_news_count,
      COALESCE(news_match.related_news_count, 0) > 0 AS has_related_news
    FROM enriched e
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS related_news_count
      FROM steam_news_items n
      WHERE n.appid = e.appid
        AND COALESCE(n.published_at, n.first_seen_at) >= e.burst_started_at - INTERVAL '24 hours'
        AND COALESCE(n.published_at, n.first_seen_at) <= e.burst_ended_at + INTERVAL '24 hours'
    ) news_match ON TRUE
  ),
  with_burst_id AS (
    SELECT
      wrn.*,
      FORMAT(
        '%s:%s:%s',
        wrn.appid,
        TO_CHAR(wrn.burst_started_at AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS.MS"Z"'),
        TO_CHAR(wrn.burst_ended_at AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS.MS"Z"')
      ) AS burst_id,
      CASE
        WHEN wrn.has_non_technical THEN TRUE
        WHEN wrn.is_released = FALSE THEN TRUE
        WHEN wrn.release_date IS NOT NULL AND wrn.release_date >= CURRENT_DATE - INTERVAL '30 days' THEN TRUE
        WHEN wrn.has_related_news THEN TRUE
        WHEN wrn.total_reviews >= 250 THEN TRUE
        WHEN wrn.ccu_peak >= 100 THEN TRUE
        ELSE FALSE
      END AS include_in_high_signal
    FROM with_related_news wrn
  ),
  preset_filtered AS (
    SELECT wbi.*
    FROM with_burst_id wbi
    WHERE CASE COALESCE(p_preset, 'high_signal')
      WHEN 'high_signal' THEN wbi.include_in_high_signal
      WHEN 'upcoming_radar' THEN
        wbi.include_in_high_signal
        AND (
          wbi.is_released = FALSE
          OR (
            wbi.release_date IS NOT NULL
            AND wbi.release_date >= CURRENT_DATE - INTERVAL '30 days'
          )
        )
      WHEN 'all_changes' THEN TRUE
      ELSE wbi.include_in_high_signal
    END
  )
  SELECT
    pf.burst_id,
    pf.appid,
    pf.app_name,
    pf.app_type,
    pf.is_released,
    pf.release_date,
    pf.effective_at,
    pf.burst_started_at,
    pf.burst_ended_at,
    pf.event_count,
    pf.source_set,
    pf.headline_change_types,
    pf.change_type_count,
    pf.has_related_news,
    pf.related_news_count
  FROM preset_filtered pf
  WHERE (
    p_cursor_time IS NULL
    OR p_cursor_burst_id IS NULL
    OR (pf.effective_at, pf.burst_id) < (p_cursor_time, p_cursor_burst_id)
  )
  ORDER BY pf.effective_at DESC, pf.burst_id DESC
  LIMIT LEAST(COALESCE(p_limit, 50), 100);
$$;

CREATE OR REPLACE FUNCTION get_change_feed_burst_detail(
  p_burst_id TEXT
)
RETURNS TABLE (
  burst_id TEXT,
  appid INTEGER,
  app_name TEXT,
  app_type TEXT,
  is_released BOOLEAN,
  release_date DATE,
  burst_started_at TIMESTAMPTZ,
  burst_ended_at TIMESTAMPTZ,
  effective_at TIMESTAMPTZ,
  event_count INTEGER,
  source_set TEXT[],
  headline_change_types TEXT[],
  change_type_count INTEGER,
  has_related_news BOOLEAN,
  related_news_count INTEGER,
  events JSONB,
  related_news JSONB,
  impact JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH parsed AS (
    SELECT
      split_part(p_burst_id, ':', 1)::INTEGER AS appid,
      to_timestamp(split_part(p_burst_id, ':', 2), 'YYYYMMDD"T"HH24MISS.MS"Z"') AS burst_started_at,
      to_timestamp(split_part(p_burst_id, ':', 3), 'YYYYMMDD"T"HH24MISS.MS"Z"') AS burst_ended_at
  ),
  burst_events AS (
    SELECT
      e.id,
      e.appid,
      e.source,
      e.change_type,
      e.occurred_at,
      e.before_value,
      e.after_value,
      e.context,
      e.source_snapshot_id,
      e.related_snapshot_id,
      e.media_version_id,
      e.news_item_gid
    FROM app_change_events e
    JOIN parsed p ON p.appid = e.appid
    WHERE e.source IN ('storefront', 'pics', 'media')
      AND e.occurred_at >= p.burst_started_at
      AND e.occurred_at <= p.burst_ended_at
    ORDER BY e.occurred_at ASC, e.id ASC
  ),
  latest_news_versions AS (
    SELECT DISTINCT ON (v.gid)
      v.gid,
      v.title,
      v.contents,
      v.url,
      v.normalized_payload,
      v.first_seen_at
    FROM steam_news_versions v
    ORDER BY v.gid, v.first_seen_at DESC
  ),
  related_news_rows AS (
    SELECT
      n.gid,
      n.url,
      n.author,
      n.feedlabel,
      n.feedname,
      n.published_at,
      n.first_seen_at,
      lnv.title,
      lnv.contents,
      lnv.normalized_payload
    FROM steam_news_items n
    JOIN parsed p ON p.appid = n.appid
    LEFT JOIN latest_news_versions lnv ON lnv.gid = n.gid
    WHERE COALESCE(n.published_at, n.first_seen_at) >= p.burst_started_at - INTERVAL '24 hours'
      AND COALESCE(n.published_at, n.first_seen_at) <= p.burst_ended_at + INTERVAL '24 hours'
    ORDER BY COALESCE(n.published_at, n.first_seen_at) DESC, n.gid DESC
  )
  SELECT
    p_burst_id AS burst_id,
    a.appid,
    a.name AS app_name,
    a.type::TEXT AS app_type,
    a.is_released,
    a.release_date,
    p.burst_started_at,
    p.burst_ended_at,
    p.burst_ended_at AS effective_at,
    COUNT(be.id)::INTEGER AS event_count,
    ARRAY(
      SELECT DISTINCT be_source.source::TEXT
      FROM burst_events be_source
      ORDER BY 1
    ) AS source_set,
    ARRAY(
      SELECT DISTINCT be_type.change_type::TEXT
      FROM burst_events be_type
      ORDER BY 1
      LIMIT 3
    ) AS headline_change_types,
    COUNT(DISTINCT be.change_type)::INTEGER AS change_type_count,
    EXISTS(SELECT 1 FROM related_news_rows) AS has_related_news,
    (SELECT COUNT(*)::INTEGER FROM related_news_rows) AS related_news_count,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'event_id', be.id,
          'source', be.source::TEXT,
          'change_type', be.change_type::TEXT,
          'occurred_at', be.occurred_at,
          'before_value', be.before_value,
          'after_value', be.after_value,
          'context', be.context,
          'source_snapshot_id', be.source_snapshot_id,
          'related_snapshot_id', be.related_snapshot_id,
          'media_version_id', be.media_version_id,
          'news_item_gid', be.news_item_gid
        )
        ORDER BY be.occurred_at ASC, be.id ASC
      ) FILTER (WHERE be.id IS NOT NULL),
      '[]'::JSONB
    ) AS events,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'gid', rnr.gid,
            'url', rnr.url,
            'author', rnr.author,
            'feedlabel', rnr.feedlabel,
            'feedname', rnr.feedname,
            'published_at', rnr.published_at,
            'first_seen_at', rnr.first_seen_at,
            'title', rnr.title,
            'contents', rnr.contents,
            'normalized_payload', rnr.normalized_payload
          )
          ORDER BY COALESCE(rnr.published_at, rnr.first_seen_at) DESC, rnr.gid DESC
        )
        FROM related_news_rows rnr
      ),
      '[]'::JSONB
    ) AS related_news,
    jsonb_build_object(
      'baseline_7d', get_change_window_metrics(a.appid, p.burst_started_at - INTERVAL '7 days', p.burst_started_at),
      'response_1d', get_change_window_metrics(a.appid, p.burst_ended_at, p.burst_ended_at + INTERVAL '1 day'),
      'response_7d', get_change_window_metrics(a.appid, p.burst_ended_at, p.burst_ended_at + INTERVAL '7 days')
    ) AS impact
  FROM parsed p
  JOIN apps a ON a.appid = p.appid
  LEFT JOIN burst_events be ON TRUE
  GROUP BY
    a.appid,
    a.name,
    a.type,
    a.is_released,
    a.release_date,
    p.burst_started_at,
    p.burst_ended_at;
$$;

CREATE OR REPLACE FUNCTION get_change_feed_news(
  p_days INTEGER DEFAULT 7,
  p_app_types TEXT[] DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_cursor_time TIMESTAMPTZ DEFAULT NULL,
  p_cursor_gid TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  gid TEXT,
  appid INTEGER,
  app_name TEXT,
  app_type TEXT,
  published_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ,
  title TEXT,
  feedlabel TEXT,
  feedname TEXT,
  url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest_versions AS (
    SELECT DISTINCT ON (v.gid)
      v.gid,
      v.title,
      v.url,
      v.first_seen_at
    FROM steam_news_versions v
    ORDER BY v.gid, v.first_seen_at DESC
  ),
  filtered_news AS (
    SELECT
      n.gid,
      n.appid,
      a.name AS app_name,
      a.type::TEXT AS app_type,
      n.published_at,
      n.first_seen_at,
      lv.title,
      n.feedlabel,
      n.feedname,
      COALESCE(lv.url, n.url) AS url,
      COALESCE(n.published_at, n.first_seen_at) AS sort_time
    FROM steam_news_items n
    JOIN apps a ON a.appid = n.appid
    LEFT JOIN latest_versions lv ON lv.gid = n.gid
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
  )
  SELECT
    fn.gid,
    fn.appid,
    fn.app_name,
    fn.app_type,
    fn.published_at,
    fn.first_seen_at,
    fn.title,
    fn.feedlabel,
    fn.feedname,
    fn.url
  FROM filtered_news fn
  WHERE (
    p_cursor_time IS NULL
    OR p_cursor_gid IS NULL
    OR (fn.sort_time, fn.gid) < (p_cursor_time, p_cursor_gid)
  )
  ORDER BY fn.sort_time DESC, fn.gid DESC
  LIMIT LEAST(COALESCE(p_limit, 50), 100);
$$;

COMMENT ON FUNCTION get_change_feed_bursts(INTEGER, TEXT, TEXT[], TEXT, TEXT[], TIMESTAMPTZ, TEXT, INTEGER) IS
  'Returns grouped non-news Steam change bursts for the admin Change Feed.';

COMMENT ON FUNCTION get_change_feed_burst_detail(TEXT) IS
  'Returns atomic events, related news, and lazy impact metrics for one grouped Change Feed burst.';

COMMENT ON FUNCTION get_change_feed_news(INTEGER, TEXT[], TEXT, TIMESTAMPTZ, TEXT, INTEGER) IS
  'Returns one row per Steam news item gid for the admin Change Feed news tab.';

REVOKE EXECUTE ON FUNCTION get_change_feed_bursts(INTEGER, TEXT, TEXT[], TEXT, TEXT[], TIMESTAMPTZ, TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_change_feed_bursts(INTEGER, TEXT, TEXT[], TEXT, TEXT[], TIMESTAMPTZ, TEXT, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION get_change_feed_bursts(INTEGER, TEXT, TEXT[], TEXT, TEXT[], TIMESTAMPTZ, TEXT, INTEGER) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION get_change_feed_burst_detail(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_change_feed_burst_detail(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION get_change_feed_burst_detail(TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION get_change_feed_news(INTEGER, TEXT[], TEXT, TIMESTAMPTZ, TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_change_feed_news(INTEGER, TEXT[], TEXT, TIMESTAMPTZ, TEXT, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION get_change_feed_news(INTEGER, TEXT[], TEXT, TIMESTAMPTZ, TEXT, INTEGER) TO authenticated, service_role;
