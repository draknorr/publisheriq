-- Add RPC function to get distinct appids from review_histogram efficiently
-- This replaces slow pagination through 2.9M rows with a single SQL query

CREATE OR REPLACE FUNCTION get_histogram_appids()
RETURNS TABLE(appid INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT appid FROM review_histogram ORDER BY appid;
$$;

COMMENT ON FUNCTION get_histogram_appids IS 'Returns distinct appids from review_histogram for trends calculation';
