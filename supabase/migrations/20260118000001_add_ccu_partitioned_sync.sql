-- Migration: Add partitioned Tier 3 CCU sync function
-- Purpose: Enable parallel CCU sync workers by partitioning Tier 3 games
--
-- This function returns a partition's share of Tier 3 games for CCU polling.
-- With 3 partitions, each worker gets ~1/3 of the games.
--
-- The partitioning uses modulo on row number (not appid) to ensure even
-- distribution regardless of appid gaps or ranges.

CREATE OR REPLACE FUNCTION get_tier3_games_partitioned(
  p_limit INTEGER,
  p_partition_count INTEGER,
  p_partition_id INTEGER
) RETURNS TABLE(appid INTEGER) AS $$
BEGIN
  -- Validate partition parameters
  IF p_partition_count < 1 OR p_partition_id < 0 OR p_partition_id >= p_partition_count THEN
    RAISE EXCEPTION 'Invalid partition parameters: count=%, id=%', p_partition_count, p_partition_id;
  END IF;

  RETURN QUERY
  WITH eligible_games AS (
    -- Get all Tier 3 games ordered by last sync time (oldest first)
    -- Exclude games that are temporarily skipped (invalid appids)
    SELECT
      cta.appid,
      ROW_NUMBER() OVER (ORDER BY cta.last_ccu_synced ASC NULLS FIRST, cta.appid) as rn
    FROM ccu_tier_assignments cta
    WHERE cta.ccu_tier = 3
      AND (cta.ccu_skip_until IS NULL OR cta.ccu_skip_until < NOW())
  )
  SELECT e.appid::INTEGER
  FROM eligible_games e
  -- Use modulo to assign each row to a partition
  -- Row 0 → partition 0, Row 1 → partition 1, Row 2 → partition 2, Row 3 → partition 0, etc.
  WHERE ((e.rn - 1) % p_partition_count) = p_partition_id
  ORDER BY e.rn
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute to authenticated and service roles
GRANT EXECUTE ON FUNCTION get_tier3_games_partitioned(INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_tier3_games_partitioned(INTEGER, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION get_tier3_games_partitioned IS
  'Returns a partition slice of Tier 3 games for CCU sync. Used by parallel workers.';
