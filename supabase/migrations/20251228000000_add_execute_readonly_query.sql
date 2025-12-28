-- Migration: Create execute_readonly_query function for chat feature
-- This function allows safe execution of SELECT-only queries from the chat interface

CREATE OR REPLACE FUNCTION execute_readonly_query(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  normalized_query TEXT;
BEGIN
  -- Normalize and check query starts with SELECT
  normalized_query := UPPER(TRIM(query_text));

  IF NOT (normalized_query LIKE 'SELECT%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  -- Check for dangerous keywords (double-check server-side)
  IF normalized_query ~ '\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXECUTE)\b' THEN
    RAISE EXCEPTION 'Query contains forbidden keywords';
  END IF;

  -- Execute and return as JSON array
  EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || query_text || ') t'
    INTO result;

  RETURN result;
END;
$$;

-- Grant execute permission to anon role (for Supabase client)
GRANT EXECUTE ON FUNCTION execute_readonly_query(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION execute_readonly_query(TEXT) TO authenticated;

COMMENT ON FUNCTION execute_readonly_query IS 'Safely execute read-only SQL queries for the chat feature. Only SELECT statements are allowed.';
