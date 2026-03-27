-- Migration: Add coalesced dirty-state work tracking for change-intelligence capture
-- This keeps one live work item per app/source while preserving the historical
-- app_capture_queue table for previously recorded backlog analysis.

CREATE TABLE IF NOT EXISTS app_capture_work_state (
  id BIGSERIAL PRIMARY KEY,
  appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
  source app_capture_source NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  latest_trigger_reason TEXT NOT NULL,
  latest_trigger_cursor TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  dirty_since TIMESTAMPTZ,
  last_dirty_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  worker_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_completed_at TIMESTAMPTZ,
  last_error TEXT,
  dead_lettered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_capture_work_state_appid_source_key UNIQUE (appid, source)
);

CREATE INDEX IF NOT EXISTS idx_app_capture_work_state_claimable
  ON app_capture_work_state(source, priority DESC, next_available_at ASC, dirty_since ASC, id ASC)
  WHERE dirty_since IS NOT NULL
    AND claimed_at IS NULL
    AND dead_lettered_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_app_capture_work_state_claimed
  ON app_capture_work_state(source, claimed_at ASC, id ASC)
  WHERE claimed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_capture_work_state_dirty
  ON app_capture_work_state(source, dirty_since ASC, id ASC)
  WHERE dirty_since IS NOT NULL
    AND dead_lettered_at IS NULL;

COMMENT ON TABLE app_capture_work_state IS
  'Coalesced dirty-state work tracker for storefront/news/projection_refresh/hero_asset capture. One live row per app/source.';

CREATE OR REPLACE FUNCTION mark_app_capture_work_dirty(
  p_jobs JSONB DEFAULT '[]'::jsonb,
  p_cooldown_hours INTEGER DEFAULT 6
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_cooldown INTERVAL := make_interval(hours => GREATEST(COALESCE(p_cooldown_hours, 6), 1));
  v_affected INTEGER;
BEGIN
  WITH normalized_jobs AS (
    SELECT
      (job->>'appid')::INTEGER AS appid,
      (job->>'source')::app_capture_source AS source,
      job->>'trigger_reason' AS trigger_reason,
      COALESCE(job->>'trigger_cursor', '') AS trigger_cursor,
      COALESCE((job->>'priority')::INTEGER, 100) AS priority,
      COALESCE(job->'payload', '{}'::jsonb) AS payload
    FROM jsonb_array_elements(COALESCE(p_jobs, '[]'::jsonb)) AS job
  ),
  upserted AS (
    INSERT INTO app_capture_work_state (
      appid,
      source,
      priority,
      latest_trigger_reason,
      latest_trigger_cursor,
      payload,
      dirty_since,
      last_dirty_at,
      next_available_at,
      dead_lettered_at,
      last_error,
      created_at,
      updated_at
    )
    SELECT
      appid,
      source,
      priority,
      trigger_reason,
      trigger_cursor,
      payload,
      v_now,
      v_now,
      v_now,
      NULL,
      NULL,
      v_now,
      v_now
    FROM normalized_jobs
    WHERE appid IS NOT NULL
      AND source IS NOT NULL
      AND trigger_reason IS NOT NULL
    ON CONFLICT (appid, source)
    DO UPDATE
    SET priority = GREATEST(app_capture_work_state.priority, EXCLUDED.priority),
        latest_trigger_reason = EXCLUDED.latest_trigger_reason,
        latest_trigger_cursor = EXCLUDED.latest_trigger_cursor,
        payload = EXCLUDED.payload,
        dirty_since = COALESCE(app_capture_work_state.dirty_since, v_now),
        last_dirty_at = v_now,
        next_available_at = CASE
          WHEN app_capture_work_state.dirty_since IS NULL THEN GREATEST(
            v_now,
            COALESCE(app_capture_work_state.last_completed_at + v_cooldown, v_now)
          )
          ELSE app_capture_work_state.next_available_at
        END,
        dead_lettered_at = NULL,
        last_error = NULL,
        attempts = CASE
          WHEN app_capture_work_state.dead_lettered_at IS NOT NULL THEN 0
          ELSE app_capture_work_state.attempts
        END,
        worker_id = CASE
          WHEN app_capture_work_state.dead_lettered_at IS NOT NULL THEN NULL
          ELSE app_capture_work_state.worker_id
        END,
        claimed_at = CASE
          WHEN app_capture_work_state.dead_lettered_at IS NOT NULL THEN NULL
          ELSE app_capture_work_state.claimed_at
        END,
        updated_at = v_now
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_affected
  FROM upserted;

  RETURN COALESCE(v_affected, 0);
END;
$$;

CREATE OR REPLACE FUNCTION claim_app_capture_work(
  p_sources app_capture_source[],
  p_worker_id TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id BIGINT,
  appid INTEGER,
  source app_capture_source,
  priority INTEGER,
  trigger_reason TEXT,
  trigger_cursor TEXT,
  payload JSONB,
  attempts INTEGER,
  available_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT w.id
    FROM app_capture_work_state w
    WHERE w.source = ANY (p_sources)
      AND w.dirty_since IS NOT NULL
      AND w.claimed_at IS NULL
      AND w.dead_lettered_at IS NULL
      AND w.next_available_at <= NOW()
    ORDER BY w.priority DESC, w.dirty_since ASC, w.last_dirty_at ASC, w.id ASC
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(COALESCE(p_limit, 50), 500)
  )
  UPDATE app_capture_work_state w
  SET claimed_at = NOW(),
      worker_id = p_worker_id,
      attempts = w.attempts + 1,
      updated_at = NOW()
  FROM candidates c
  WHERE w.id = c.id
  RETURNING
    w.id,
    w.appid,
    w.source,
    w.priority,
    w.latest_trigger_reason,
    w.latest_trigger_cursor,
    w.payload,
    w.attempts,
    w.next_available_at;
END;
$$;

CREATE OR REPLACE FUNCTION complete_app_capture_work(
  p_ids BIGINT[],
  p_status app_capture_status DEFAULT 'completed',
  p_error TEXT DEFAULT NULL,
  p_cooldown_hours INTEGER DEFAULT 6
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_cooldown INTERVAL := make_interval(hours => GREATEST(COALESCE(p_cooldown_hours, 6), 1));
  v_updated INTEGER;
BEGIN
  IF p_status NOT IN ('completed', 'failed', 'queued', 'dead_letter') THEN
    RAISE EXCEPTION 'Unsupported work completion status: %', p_status;
  END IF;

  UPDATE app_capture_work_state
  SET last_error = CASE WHEN p_status = 'completed' THEN NULL ELSE p_error END,
      worker_id = NULL,
      claimed_at = NULL,
      dead_lettered_at = CASE
        WHEN p_status = 'dead_letter' THEN v_now
        WHEN p_status IN ('completed', 'queued') THEN NULL
        ELSE dead_lettered_at
      END,
      last_completed_at = CASE
        WHEN p_status = 'completed' THEN v_now
        ELSE last_completed_at
      END,
      next_available_at = CASE
        WHEN p_status = 'completed' THEN v_now + v_cooldown
        WHEN p_status = 'queued' THEN v_now
        ELSE next_available_at
      END,
      dirty_since = CASE
        WHEN p_status = 'completed'
          AND last_dirty_at IS NOT NULL
          AND claimed_at IS NOT NULL
          AND last_dirty_at > claimed_at
          THEN last_dirty_at
        WHEN p_status IN ('completed', 'dead_letter', 'failed')
          THEN NULL
        ELSE dirty_since
      END,
      last_dirty_at = CASE
        WHEN p_status = 'completed'
          AND last_dirty_at IS NOT NULL
          AND claimed_at IS NOT NULL
          AND last_dirty_at > claimed_at
          THEN last_dirty_at
        WHEN p_status IN ('completed', 'dead_letter', 'failed')
          THEN NULL
        ELSE last_dirty_at
      END,
      attempts = CASE
        WHEN p_status = 'completed' THEN 0
        ELSE attempts
      END,
      updated_at = v_now
  WHERE id = ANY (p_ids);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION requeue_stale_app_capture_work(
  p_sources app_capture_source[],
  p_claimed_before TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 500
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  WITH stale AS (
    SELECT w.id
    FROM app_capture_work_state w
    WHERE w.source = ANY (p_sources)
      AND w.claimed_at IS NOT NULL
      AND w.dead_lettered_at IS NULL
      AND w.claimed_at < p_claimed_before
    ORDER BY w.claimed_at ASC, w.id ASC
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(COALESCE(p_limit, 500), 500)
  )
  UPDATE app_capture_work_state w
  SET claimed_at = NULL,
      worker_id = NULL,
      next_available_at = NOW(),
      last_error = 'stale_claim_requeued',
      updated_at = NOW()
  FROM stale s
  WHERE w.id = s.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN COALESCE(v_updated, 0);
END;
$$;

ALTER TABLE app_capture_work_state ENABLE ROW LEVEL SECURITY;

REVOKE EXECUTE ON FUNCTION mark_app_capture_work_dirty(JSONB, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION mark_app_capture_work_dirty(JSONB, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION mark_app_capture_work_dirty(JSONB, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION mark_app_capture_work_dirty(JSONB, INTEGER) TO service_role;

REVOKE EXECUTE ON FUNCTION claim_app_capture_work(app_capture_source[], TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION claim_app_capture_work(app_capture_source[], TEXT, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION claim_app_capture_work(app_capture_source[], TEXT, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_app_capture_work(app_capture_source[], TEXT, INTEGER) TO service_role;

REVOKE EXECUTE ON FUNCTION complete_app_capture_work(BIGINT[], app_capture_status, TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION complete_app_capture_work(BIGINT[], app_capture_status, TEXT, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION complete_app_capture_work(BIGINT[], app_capture_status, TEXT, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION complete_app_capture_work(BIGINT[], app_capture_status, TEXT, INTEGER) TO service_role;

REVOKE EXECUTE ON FUNCTION requeue_stale_app_capture_work(app_capture_source[], TIMESTAMPTZ, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION requeue_stale_app_capture_work(app_capture_source[], TIMESTAMPTZ, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION requeue_stale_app_capture_work(app_capture_source[], TIMESTAMPTZ, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION requeue_stale_app_capture_work(app_capture_source[], TIMESTAMPTZ, INTEGER) TO service_role;
