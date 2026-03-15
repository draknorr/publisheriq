-- Migration: Optimize Change Feed news RPC
-- Purpose:
--   1. Make recent news keyset pagination use an indexable sort key
--   2. Stop scanning the full steam_news_versions table on every request

CREATE INDEX IF NOT EXISTS idx_steam_news_items_sort_time_gid
  ON steam_news_items ((COALESCE(published_at, first_seen_at)) DESC, gid DESC);

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
  WITH recent_news AS (
    SELECT
      n.gid,
      n.appid,
      n.published_at,
      n.first_seen_at,
      n.feedlabel,
      n.feedname,
      n.url,
      COALESCE(n.published_at, n.first_seen_at) AS sort_time
    FROM steam_news_items n
    WHERE COALESCE(n.published_at, n.first_seen_at) >= NOW() - make_interval(days => GREATEST(COALESCE(p_days, 7), 1))
      AND (
        p_cursor_time IS NULL
        OR p_cursor_gid IS NULL
        OR (COALESCE(n.published_at, n.first_seen_at), n.gid) < (p_cursor_time, p_cursor_gid)
      )
  )
  SELECT
    rn.gid,
    rn.appid,
    a.name AS app_name,
    a.type::TEXT AS app_type,
    rn.published_at,
    rn.first_seen_at,
    lv.title,
    rn.feedlabel,
    rn.feedname,
    COALESCE(lv.url, rn.url) AS url
  FROM recent_news rn
  JOIN apps a ON a.appid = rn.appid
  LEFT JOIN LATERAL (
    SELECT
      v.title,
      v.url
    FROM steam_news_versions v
    WHERE v.gid = rn.gid
    ORDER BY v.first_seen_at DESC
    LIMIT 1
  ) lv ON TRUE
  WHERE (
    p_app_types IS NULL
    OR a.type::TEXT = ANY (p_app_types)
  )
    AND (
      p_search IS NULL
      OR a.name ILIKE '%' || p_search || '%'
      OR COALESCE(lv.title, '') ILIKE '%' || p_search || '%'
    )
  ORDER BY rn.sort_time DESC, rn.gid DESC
  LIMIT LEAST(COALESCE(p_limit, 50), 100);
$$;
