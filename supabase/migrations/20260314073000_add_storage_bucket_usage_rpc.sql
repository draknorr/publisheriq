-- Migration: Add storage bucket usage RPC for hero asset archival guardrails
-- The JS data client cannot reliably query the storage schema through PostgREST,
-- so expose a supported aggregate through a SECURITY DEFINER RPC.

CREATE OR REPLACE FUNCTION get_storage_bucket_usage_bytes(
  p_bucket_id TEXT
)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT COALESCE(SUM(((o.metadata->>'size'))::BIGINT), 0)
  FROM storage.objects o
  WHERE o.bucket_id = p_bucket_id;
$$;

REVOKE EXECUTE ON FUNCTION get_storage_bucket_usage_bytes(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_storage_bucket_usage_bytes(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION get_storage_bucket_usage_bytes(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION get_storage_bucket_usage_bytes(TEXT) TO service_role;
