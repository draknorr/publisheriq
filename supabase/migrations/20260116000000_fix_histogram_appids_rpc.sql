-- Fix histogram appids RPC to support pagination
-- Supabase/PostgREST has a ~1000 row limit for RPC responses
-- We need to paginate server-side to get all 112K+ appids

CREATE OR REPLACE FUNCTION get_histogram_appids(
  p_limit INTEGER DEFAULT 50000,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(appid INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT appid
  FROM review_histogram
  ORDER BY appid
  LIMIT p_limit
  OFFSET p_offset;
$$;

COMMENT ON FUNCTION get_histogram_appids(INTEGER, INTEGER) IS
  'Returns distinct appids from review_histogram with pagination for trends calculation';
