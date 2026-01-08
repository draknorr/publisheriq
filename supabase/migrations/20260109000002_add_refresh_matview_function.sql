-- Add function to refresh materialized views concurrently
-- This allows the refresh-views worker to refresh views without locking

-- Create the refresh function with extended timeout
CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  view_exists BOOLEAN;
  old_timeout TEXT;
BEGIN
  -- Save current timeout and set to 5 minutes for refresh operations
  SELECT current_setting('statement_timeout') INTO old_timeout;
  SET LOCAL statement_timeout = '300000'; -- 5 minutes

  -- Check if the view exists
  SELECT EXISTS (
    SELECT 1 FROM pg_matviews WHERE matviewname = view_name
  ) INTO view_exists;

  IF NOT view_exists THEN
    RAISE EXCEPTION 'Materialized view % does not exist', view_name;
  END IF;

  -- Refresh the view concurrently (requires unique index)
  -- Falls back to non-concurrent refresh if concurrent fails
  BEGIN
    EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY ' || quote_ident(view_name);
  EXCEPTION WHEN OTHERS THEN
    -- If concurrent refresh fails (e.g., no unique index), try regular refresh
    EXECUTE 'REFRESH MATERIALIZED VIEW ' || quote_ident(view_name);
  END;

  -- Restore original timeout
  EXECUTE 'SET LOCAL statement_timeout = ' || quote_literal(old_timeout);
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION refresh_materialized_view(TEXT) TO service_role;

-- Add comment
COMMENT ON FUNCTION refresh_materialized_view(TEXT) IS
  'Refreshes a materialized view with 5 minute timeout, preferring concurrent refresh when possible';
