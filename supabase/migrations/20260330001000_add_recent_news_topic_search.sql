-- Migration: Add latest-news projection and recent news topic search for chat
-- Purpose:
--   1. Materialize the latest stored Steam news body per gid for indexed topic search
--   2. Support fast recent topic prompts like developer diaries, roadmaps, demos, playtests, and patch notes

CREATE OR REPLACE FUNCTION public.normalize_steam_news_search_text(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    BTRIM(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(COALESCE(p_value, ''), 'https?://[^[:space:]]+', ' ', 'gi'),
            '<[^>]+>',
            ' ',
            'g'
          ),
          E'[\\n\\r\\t]+',
          ' ',
          'g'
        ),
        '\s+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

CREATE TABLE IF NOT EXISTS public.steam_news_latest_projection (
  gid TEXT PRIMARY KEY,
  appid INTEGER NOT NULL REFERENCES public.apps(appid) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  app_type TEXT NOT NULL,
  published_at TIMESTAMPTZ NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  sort_time TIMESTAMPTZ NOT NULL,
  feed_scope TEXT NOT NULL,
  feedlabel TEXT NULL,
  feedname TEXT NULL,
  title TEXT NULL,
  url TEXT NULL,
  contents TEXT NULL,
  search_text TEXT NOT NULL,
  search_document tsvector NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.steam_news_latest_projection IS
  'One row per Steam news gid using the latest stored news version, optimized for recent text search in chat.';

CREATE INDEX IF NOT EXISTS idx_steam_news_latest_projection_search_document
  ON public.steam_news_latest_projection USING GIN(search_document);

CREATE INDEX IF NOT EXISTS idx_steam_news_latest_projection_sort_time_gid
  ON public.steam_news_latest_projection(sort_time DESC, gid DESC);

CREATE INDEX IF NOT EXISTS idx_steam_news_latest_projection_feed_scope_sort_time_gid
  ON public.steam_news_latest_projection(feed_scope, sort_time DESC, gid DESC);

CREATE INDEX IF NOT EXISTS idx_steam_news_latest_projection_appid_sort_time
  ON public.steam_news_latest_projection(appid, sort_time DESC);

CREATE OR REPLACE FUNCTION public.refresh_steam_news_latest_projection_for_app(
  p_appid INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  WITH latest_news AS (
    SELECT
      n.gid,
      n.appid,
      a.name AS app_name,
      a.type::TEXT AS app_type,
      n.published_at,
      n.first_seen_at,
      COALESCE(n.published_at, n.first_seen_at) AS sort_time,
      CASE
        WHEN COALESCE(n.feedlabel, '') = 'Community Announcements' THEN 'community_announcements'
        ELSE 'external_coverage'
      END AS feed_scope,
      n.feedlabel,
      n.feedname,
      lv.title AS title,
      COALESCE(lv.url, n.url) AS url,
      lv.contents,
      public.normalize_steam_news_search_text(lv.title) AS title_text,
      public.normalize_steam_news_search_text(lv.contents) AS body_text
    FROM public.steam_news_items n
    JOIN public.apps a ON a.appid = n.appid
    LEFT JOIN LATERAL (
      SELECT
        NULLIF(BTRIM(v.title), '') AS title,
        NULLIF(BTRIM(v.contents), '') AS contents,
        NULLIF(BTRIM(v.url), '') AS url
      FROM public.steam_news_versions v
      WHERE v.gid = n.gid
      ORDER BY v.first_seen_at DESC, v.id DESC
      LIMIT 1
    ) lv ON TRUE
    WHERE n.appid = p_appid
  )
  INSERT INTO public.steam_news_latest_projection (
    gid,
    appid,
    app_name,
    app_type,
    published_at,
    first_seen_at,
    sort_time,
    feed_scope,
    feedlabel,
    feedname,
    title,
    url,
    contents,
    search_text,
    search_document,
    updated_at
  )
  SELECT
    ln.gid,
    ln.appid,
    ln.app_name,
    ln.app_type,
    ln.published_at,
    ln.first_seen_at,
    ln.sort_time,
    ln.feed_scope,
    ln.feedlabel,
    ln.feedname,
    ln.title,
    ln.url,
    ln.body_text,
    COALESCE(CONCAT_WS(' ', ln.title_text, ln.body_text), '') AS search_text,
    setweight(to_tsvector('english', COALESCE(ln.title_text, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(ln.body_text, '')), 'B') AS search_document,
    NOW() AS updated_at
  FROM latest_news ln
  ON CONFLICT (gid) DO UPDATE
  SET
    appid = EXCLUDED.appid,
    app_name = EXCLUDED.app_name,
    app_type = EXCLUDED.app_type,
    published_at = EXCLUDED.published_at,
    first_seen_at = EXCLUDED.first_seen_at,
    sort_time = EXCLUDED.sort_time,
    feed_scope = EXCLUDED.feed_scope,
    feedlabel = EXCLUDED.feedlabel,
    feedname = EXCLUDED.feedname,
    title = EXCLUDED.title,
    url = EXCLUDED.url,
    contents = EXCLUDED.contents,
    search_text = EXCLUDED.search_text,
    search_document = EXCLUDED.search_document,
    updated_at = EXCLUDED.updated_at;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  DELETE FROM public.steam_news_latest_projection projection
  WHERE projection.appid = p_appid
    AND NOT EXISTS (
      SELECT 1
      FROM public.steam_news_items n
      WHERE n.appid = p_appid
        AND n.gid = projection.gid
    );

  RETURN inserted_count;
END;
$$;

COMMENT ON FUNCTION public.refresh_steam_news_latest_projection_for_app(INTEGER) IS
  'Refreshes the latest-news topic-search projection for a single app using the newest stored news version per gid.';

CREATE OR REPLACE FUNCTION public.search_recent_news_topics(
  p_query TEXT,
  p_days INTEGER DEFAULT 30,
  p_limit INTEGER DEFAULT 10,
  p_feed_scope TEXT DEFAULT 'community_announcements',
  p_app_types TEXT[] DEFAULT ARRAY['game'],
  p_appids INTEGER[] DEFAULT NULL,
  p_aliases TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  gid TEXT,
  appid INTEGER,
  app_name TEXT,
  app_type TEXT,
  published_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ,
  sort_time TIMESTAMPTZ,
  feed_scope TEXT,
  feedlabel TEXT,
  feedname TEXT,
  title TEXT,
  url TEXT,
  excerpt TEXT,
  content_preview TEXT,
  match_reason TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_aliases TEXT[];
  query_text TEXT;
BEGIN
  IF NULLIF(BTRIM(COALESCE(p_query, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A recent news topic query is required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.steam_news_latest_projection
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'news topic projection is not available yet. Backfill the latest-news projection first.';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT LOWER(BTRIM(term))
    FROM unnest(COALESCE(p_aliases, ARRAY[]::TEXT[]) || ARRAY[p_query]) AS term
    WHERE NULLIF(BTRIM(term), '') IS NOT NULL
    ORDER BY 1
  )
  INTO normalized_aliases;

  SELECT string_agg(format('"%s"', replace(alias, '"', '')), ' OR ')
  INTO query_text
  FROM unnest(normalized_aliases) AS alias;

  RETURN QUERY
  WITH request_config AS (
    SELECT
      GREATEST(COALESCE(p_days, 30), 1) AS days,
      LEAST(GREATEST(COALESCE(p_limit, 10), 1), 10) AS row_limit,
      CASE
        WHEN COALESCE(p_feed_scope, 'community_announcements') IN ('community_announcements', 'external_coverage', 'all')
          THEN COALESCE(p_feed_scope, 'community_announcements')
        ELSE 'community_announcements'
      END AS feed_scope,
      CASE
        WHEN p_app_types IS NULL OR CARDINALITY(p_app_types) = 0 THEN ARRAY['game']::TEXT[]
        ELSE p_app_types
      END AS app_types,
      normalized_aliases AS aliases,
      websearch_to_tsquery('english', COALESCE(query_text, format('"%s"', replace(BTRIM(p_query), '"', '')))) AS topic_query
  ),
  ranked_matches AS (
    SELECT
      projection.*,
      rc.aliases,
      rc.topic_query,
      ts_rank_cd(projection.search_document, rc.topic_query) AS ts_rank,
      EXISTS (
        SELECT 1
        FROM unnest(rc.aliases) AS alias
        WHERE LOWER(COALESCE(projection.title, '')) LIKE '%' || alias || '%'
      ) AS title_phrase_hit,
      EXISTS (
        SELECT 1
        FROM unnest(rc.aliases) AS alias
        WHERE LOWER(projection.search_text) LIKE '%' || alias || '%'
      ) AS body_phrase_hit
    FROM public.steam_news_latest_projection projection
    CROSS JOIN request_config rc
    WHERE projection.sort_time >= NOW() - make_interval(days => rc.days)
      AND (
        rc.feed_scope = 'all'
        OR projection.feed_scope = rc.feed_scope
      )
      AND (
        rc.app_types IS NULL
        OR projection.app_type = ANY (rc.app_types)
      )
      AND (
        p_appids IS NULL
        OR projection.appid = ANY (p_appids)
      )
      AND projection.search_document @@ rc.topic_query
  )
  SELECT
    rm.gid,
    rm.appid,
    rm.app_name,
    rm.app_type,
    rm.published_at,
    rm.first_seen_at,
    rm.sort_time,
    rm.feed_scope,
    rm.feedlabel,
    rm.feedname,
    rm.title,
    rm.url,
    COALESCE(
      NULLIF(
        BTRIM(
          ts_headline(
            'english',
            rm.search_text,
            rm.topic_query,
            'StartSel=, StopSel=, MaxWords=24, MinWords=10, MaxFragments=2, FragmentDelimiter= … '
          )
        ),
        ''
      ),
      NULLIF(BTRIM(LEFT(rm.search_text, 260)), '')
    ) AS excerpt,
    NULLIF(BTRIM(LEFT(rm.search_text, 420)), '') AS content_preview,
    CASE
      WHEN rm.title_phrase_hit THEN 'matched title phrase'
      WHEN rm.body_phrase_hit THEN 'matched body phrase'
      ELSE 'matched topic terms'
    END AS match_reason
  FROM ranked_matches rm
  ORDER BY
    rm.title_phrase_hit DESC,
    rm.body_phrase_hit DESC,
    rm.ts_rank DESC,
    rm.sort_time DESC,
    rm.gid DESC
  LIMIT (SELECT row_limit FROM request_config);
END;
$$;

COMMENT ON FUNCTION public.search_recent_news_topics(TEXT, INTEGER, INTEGER, TEXT, TEXT[], INTEGER[], TEXT[]) IS
  'Searches recent stored Steam news text across many games for chat topic prompts such as developer diaries, roadmaps, demos, playtests, and patch notes.';

REVOKE EXECUTE ON FUNCTION public.refresh_steam_news_latest_projection_for_app(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_steam_news_latest_projection_for_app(INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.refresh_steam_news_latest_projection_for_app(INTEGER) TO service_role;

REVOKE EXECUTE ON FUNCTION public.search_recent_news_topics(TEXT, INTEGER, INTEGER, TEXT, TEXT[], INTEGER[], TEXT[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_recent_news_topics(TEXT, INTEGER, INTEGER, TEXT, TEXT[], INTEGER[], TEXT[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_recent_news_topics(TEXT, INTEGER, INTEGER, TEXT, TEXT[], INTEGER[], TEXT[]) TO authenticated, service_role;
