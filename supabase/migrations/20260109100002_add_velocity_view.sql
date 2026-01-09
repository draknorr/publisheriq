-- Migration: Add review_velocity_stats materialized view
-- Purpose: Pre-computed velocity stats for fast Cube.js queries and sync scheduling

-- Create materialized view for velocity stats
CREATE MATERIALIZED VIEW review_velocity_stats AS
WITH recent_deltas AS (
    SELECT
        appid,
        delta_date,
        reviews_added,
        daily_velocity,
        is_interpolated,
        ROW_NUMBER() OVER (PARTITION BY appid ORDER BY delta_date DESC) as rn
    FROM review_deltas
    WHERE delta_date >= CURRENT_DATE - INTERVAL '30 days'
),
velocity_calcs AS (
    SELECT
        appid,
        -- 7-day velocity (only actual syncs, not interpolated)
        AVG(daily_velocity) FILTER (WHERE rn <= 7 AND NOT is_interpolated) as velocity_7d,
        -- 30-day velocity
        AVG(daily_velocity) FILTER (WHERE NOT is_interpolated) as velocity_30d,
        -- Total reviews added
        SUM(reviews_added) FILTER (WHERE rn <= 7) as reviews_added_7d,
        SUM(reviews_added) as reviews_added_30d,
        -- Data freshness
        MAX(delta_date) as last_delta_date,
        COUNT(*) FILTER (WHERE NOT is_interpolated) as actual_sync_count
    FROM recent_deltas
    GROUP BY appid
)
SELECT
    vc.appid,
    COALESCE(vc.velocity_7d, 0)::DECIMAL(8,4) as velocity_7d,
    COALESCE(vc.velocity_30d, 0)::DECIMAL(8,4) as velocity_30d,
    COALESCE(vc.reviews_added_7d, 0)::INTEGER as reviews_added_7d,
    COALESCE(vc.reviews_added_30d, 0)::INTEGER as reviews_added_30d,
    vc.last_delta_date,
    vc.actual_sync_count,
    -- Velocity tier classification
    CASE
        WHEN vc.velocity_7d >= 5 THEN 'high'
        WHEN vc.velocity_7d >= 1 THEN 'medium'
        WHEN vc.velocity_7d >= 0.1 THEN 'low'
        ELSE 'dormant'
    END as velocity_tier
FROM velocity_calcs vc;

-- Unique index for fast lookups and concurrent refresh
CREATE UNIQUE INDEX idx_review_velocity_stats_appid
    ON review_velocity_stats(appid);

-- Index for tier-based queries
CREATE INDEX idx_review_velocity_stats_tier
    ON review_velocity_stats(velocity_tier, velocity_7d DESC);

-- Function to refresh the materialized view (called by velocity-calculator worker)
CREATE OR REPLACE FUNCTION refresh_review_velocity_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY review_velocity_stats;
END;
$$ LANGUAGE plpgsql;

-- Function to update sync_status from velocity stats
CREATE OR REPLACE FUNCTION update_review_velocity_tiers()
RETURNS TABLE(count INTEGER) AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE sync_status s
    SET
        velocity_7d = rvs.velocity_7d,
        review_velocity_tier = rvs.velocity_tier,
        reviews_interval_hours = CASE rvs.velocity_tier
            WHEN 'high' THEN 4
            WHEN 'medium' THEN 12
            WHEN 'low' THEN 24
            ELSE 72
        END,
        velocity_calculated_at = NOW()
    FROM review_velocity_stats rvs
    WHERE s.appid = rvs.appid
      AND (s.velocity_7d IS DISTINCT FROM rvs.velocity_7d
           OR s.review_velocity_tier IS DISTINCT FROM rvs.velocity_tier);

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN QUERY SELECT updated_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON MATERIALIZED VIEW review_velocity_stats IS 'Pre-computed review velocity stats for fast queries';
COMMENT ON FUNCTION refresh_review_velocity_stats IS 'Refresh velocity stats view (concurrent, non-blocking)';
COMMENT ON FUNCTION update_review_velocity_tiers IS 'Sync velocity tiers to sync_status table';
