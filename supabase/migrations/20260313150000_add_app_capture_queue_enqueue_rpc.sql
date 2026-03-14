-- Migration: Add dedupe-safe queue enqueue RPC for app_capture_queue
-- PostgREST upsert cannot target the queue's partial unique index, so queue
-- writers must go through this function to use ON CONFLICT ... WHERE ...

CREATE OR REPLACE FUNCTION enqueue_app_capture_queue(
  p_jobs JSONB DEFAULT '[]'::jsonb
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER;
BEGIN
  WITH normalized_jobs AS (
    SELECT
      (job->>'appid')::INTEGER AS appid,
      (job->>'source')::app_capture_source AS source,
      job->>'trigger_reason' AS trigger_reason,
      COALESCE(job->>'trigger_cursor', '') AS trigger_cursor,
      COALESCE((job->>'priority')::INTEGER, 100) AS priority,
      COALESCE(job->'payload', '{}'::jsonb) AS payload,
      COALESCE((job->>'available_at')::TIMESTAMPTZ, NOW()) AS available_at
    FROM jsonb_array_elements(COALESCE(p_jobs, '[]'::jsonb)) AS job
  ),
  inserted AS (
    INSERT INTO app_capture_queue (
      appid,
      source,
      status,
      priority,
      trigger_reason,
      trigger_cursor,
      payload,
      available_at
    )
    SELECT
      appid,
      source,
      'queued',
      priority,
      trigger_reason,
      trigger_cursor,
      payload,
      available_at
    FROM normalized_jobs
    WHERE appid IS NOT NULL
      AND source IS NOT NULL
      AND trigger_reason IS NOT NULL
    ON CONFLICT (appid, source, trigger_cursor)
      WHERE status IN ('queued', 'claimed')
      DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted
  FROM inserted;

  RETURN COALESCE(v_inserted, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION enqueue_app_capture_queue(JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION enqueue_app_capture_queue(JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION enqueue_app_capture_queue(JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION enqueue_app_capture_queue(JSONB) TO service_role;
