-- Migration: Harden change-intelligence chat query bounds
-- Purpose:
--   1. Cap raw per-app change windows for chat-friendly timeline queries
--   2. Cap cross-app recent-change windows for large-database safety
--   3. Keep result limits positive and bounded even if a caller passes bad inputs

CREATE OR REPLACE FUNCTION get_app_change_feed(
  p_appid INTEGER,
  p_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_to TIMESTAMPTZ DEFAULT NOW(),
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  appid INTEGER,
  app_name TEXT,
  event_id BIGINT,
  source TEXT,
  change_type app_change_type,
  occurred_at TIMESTAMPTZ,
  before_value JSONB,
  after_value JSONB,
  context JSONB,
  source_snapshot_id BIGINT,
  related_snapshot_id BIGINT,
  media_version_id BIGINT,
  news_item_gid TEXT,
  baseline_7d JSONB,
  baseline_30d JSONB,
  response_1d JSONB,
  response_7d JSONB,
  response_30d JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH request_window AS (
    SELECT
      COALESCE(p_to, NOW()) AS effective_to,
      GREATEST(COALESCE(p_limit, 100), 1) AS requested_limit
  ),
  bounded_window AS (
    SELECT
      GREATEST(
        COALESCE(p_from, rw.effective_to - INTERVAL '30 days'),
        rw.effective_to - INTERVAL '365 days'
      ) AS effective_from,
      rw.effective_to,
      LEAST(rw.requested_limit, 100) AS effective_limit
    FROM request_window rw
  ),
  base AS (
    SELECT
      e.appid,
      a.name AS app_name,
      e.id AS event_id,
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
    FROM bounded_window bw
    JOIN app_change_events e
      ON e.appid = p_appid
     AND e.occurred_at >= bw.effective_from
     AND e.occurred_at <= bw.effective_to
    JOIN apps a ON a.appid = e.appid
    ORDER BY e.occurred_at DESC
    LIMIT (SELECT effective_limit FROM bounded_window)
  )
  SELECT
    b.appid,
    b.app_name,
    b.event_id,
    b.source,
    b.change_type,
    b.occurred_at,
    b.before_value,
    b.after_value,
    b.context,
    b.source_snapshot_id,
    b.related_snapshot_id,
    b.media_version_id,
    b.news_item_gid,
    get_change_window_metrics(b.appid, b.occurred_at - INTERVAL '7 days', b.occurred_at),
    get_change_window_metrics(b.appid, b.occurred_at - INTERVAL '30 days', b.occurred_at),
    get_change_window_metrics(b.appid, b.occurred_at, b.occurred_at + INTERVAL '1 day'),
    get_change_window_metrics(b.appid, b.occurred_at, b.occurred_at + INTERVAL '7 days'),
    get_change_window_metrics(b.appid, b.occurred_at, b.occurred_at + INTERVAL '30 days')
  FROM base b
  ORDER BY b.occurred_at DESC;
$$;

CREATE OR REPLACE FUNCTION get_recent_app_changes(
  p_days INTEGER DEFAULT 30,
  p_types app_change_type[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  appid INTEGER,
  app_name TEXT,
  event_id BIGINT,
  source TEXT,
  change_type app_change_type,
  occurred_at TIMESTAMPTZ,
  before_value JSONB,
  after_value JSONB,
  context JSONB,
  source_snapshot_id BIGINT,
  related_snapshot_id BIGINT,
  media_version_id BIGINT,
  news_item_gid TEXT,
  baseline_7d JSONB,
  baseline_30d JSONB,
  response_1d JSONB,
  response_7d JSONB,
  response_30d JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH request_config AS (
    SELECT
      LEAST(GREATEST(COALESCE(p_days, 30), 1), 180) AS effective_days,
      LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100) AS effective_limit
  ),
  base AS (
    SELECT
      e.appid,
      a.name AS app_name,
      e.id AS event_id,
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
    FROM request_config rc
    JOIN app_change_events e
      ON e.occurred_at >= NOW() - make_interval(days => rc.effective_days)
    JOIN apps a ON a.appid = e.appid
    WHERE p_types IS NULL OR e.change_type = ANY (p_types)
    ORDER BY e.occurred_at DESC
    LIMIT (SELECT effective_limit FROM request_config)
  )
  SELECT
    b.appid,
    b.app_name,
    b.event_id,
    b.source,
    b.change_type,
    b.occurred_at,
    b.before_value,
    b.after_value,
    b.context,
    b.source_snapshot_id,
    b.related_snapshot_id,
    b.media_version_id,
    b.news_item_gid,
    get_change_window_metrics(b.appid, b.occurred_at - INTERVAL '7 days', b.occurred_at),
    get_change_window_metrics(b.appid, b.occurred_at - INTERVAL '30 days', b.occurred_at),
    get_change_window_metrics(b.appid, b.occurred_at, b.occurred_at + INTERVAL '1 day'),
    get_change_window_metrics(b.appid, b.occurred_at, b.occurred_at + INTERVAL '7 days'),
    get_change_window_metrics(b.appid, b.occurred_at, b.occurred_at + INTERVAL '30 days')
  FROM base b
  ORDER BY b.occurred_at DESC;
$$;

COMMENT ON FUNCTION get_app_change_feed(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) IS
  'Returns a bounded per-app change timeline. The effective lookback window is capped at 365 days and the result limit is capped at 100.';

COMMENT ON FUNCTION get_recent_app_changes(INTEGER, app_change_type[], INTEGER) IS
  'Returns bounded recent change events across apps. The effective lookback window is capped at 180 days and the result limit is capped at 100.';
