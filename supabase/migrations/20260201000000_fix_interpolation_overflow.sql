-- Migration: Fix numeric field overflow in interpolation function
-- Problem 1: Games with 2B+ reviews can overflow INTEGER (max 2,147,483,647) during interpolation
-- Problem 2: daily_velocity NUMERIC(8,4) overflows when reviews_added > 9999
-- Solution: Add LEAST() guards to cap total/positive_reviews at INTEGER max,
--           and cap reviews_added/positive_added/negative_added at 9999
-- Failed since: Jan 19, 2026 (when optimization migration was applied)

-- Drop the existing functions
DROP FUNCTION IF EXISTS interpolate_all_review_deltas(DATE, DATE);
DROP FUNCTION IF EXISTS interpolate_review_deltas(INTEGER, DATE, DATE);

-- Optimized function with overflow protection
-- Uses window functions + generate_series for bulk processing
-- LEAST() guards prevent exceeding INTEGER max (2,147,483,647)
CREATE OR REPLACE FUNCTION interpolate_all_review_deltas(
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(total_interpolated INTEGER, apps_processed INTEGER) AS $$
DECLARE
    v_total_interpolated INTEGER;
    v_apps_processed INTEGER;
BEGIN
    -- Use a CTE to find all gaps and generate interpolated values in a single query
    WITH actual_syncs AS (
        -- Get all actual (non-interpolated) sync points within the date range
        SELECT
            appid,
            delta_date,
            total_reviews,
            positive_reviews
        FROM review_deltas
        WHERE is_interpolated = FALSE
          AND delta_date BETWEEN p_start_date AND p_end_date
    ),

    with_next AS (
        -- Use LEAD to find the next sync point for each record
        SELECT
            appid,
            delta_date as prev_date,
            total_reviews as prev_total,
            positive_reviews as prev_positive,
            LEAD(delta_date) OVER (PARTITION BY appid ORDER BY delta_date) as next_date,
            LEAD(total_reviews) OVER (PARTITION BY appid ORDER BY delta_date) as next_total,
            LEAD(positive_reviews) OVER (PARTITION BY appid ORDER BY delta_date) as next_positive
        FROM actual_syncs
    ),

    gaps AS (
        -- Filter to only pairs with gaps (more than 1 day between syncs)
        SELECT
            appid,
            prev_date,
            prev_total,
            prev_positive,
            next_date,
            next_total,
            next_positive,
            (next_date - prev_date) as days_gap,
            -- Calculate daily change rates
            (next_total - prev_total)::DECIMAL / (next_date - prev_date) as daily_total_change,
            (next_positive - prev_positive)::DECIMAL / (next_date - prev_date) as daily_positive_change
        FROM with_next
        WHERE next_date IS NOT NULL
          AND (next_date - prev_date) > 1  -- Only gaps of 2+ days need interpolation
    ),

    interpolated_rows AS (
        -- Generate all missing dates using generate_series
        SELECT
            g.appid,
            gap_date::DATE as delta_date,
            -- Interpolate total_reviews with overflow protection
            -- LEAST() caps at INTEGER max to prevent overflow
            LEAST(
                2147483647,
                GREATEST(0, g.prev_total + ROUND(g.daily_total_change * (gap_date::DATE - g.prev_date)))
            )::INTEGER as total_reviews,
            -- Interpolate positive_reviews with overflow protection
            LEAST(
                2147483647,
                GREATEST(0, g.prev_positive + ROUND(g.daily_positive_change * (gap_date::DATE - g.prev_date)))
            )::INTEGER as positive_reviews,
            -- Calculate reviews_added (daily increment, clamped to 0-9999)
            -- Capped at 9999 to prevent daily_velocity overflow (NUMERIC(8,4) max)
            LEAST(9999, GREATEST(0, ROUND(g.daily_total_change)))::INTEGER as reviews_added,
            -- Calculate positive/negative added based on ratio (capped at 9999)
            CASE
                WHEN g.daily_total_change > 0 THEN
                    LEAST(9999, GREATEST(0, ROUND(g.daily_positive_change)))::INTEGER
                ELSE 0
            END as positive_added,
            CASE
                WHEN g.daily_total_change > 0 THEN
                    LEAST(9999, GREATEST(0, ROUND(g.daily_total_change - g.daily_positive_change)))::INTEGER
                ELSE 0
            END as negative_added
        FROM gaps g
        CROSS JOIN LATERAL generate_series(
            g.prev_date + 1,  -- Start day after previous sync
            g.next_date - 1,  -- End day before next sync
            '1 day'::INTERVAL
        ) as gap_date
    ),

    inserted AS (
        -- Bulk insert all interpolated rows
        INSERT INTO review_deltas (
            appid,
            delta_date,
            total_reviews,
            positive_reviews,
            review_score,
            reviews_added,
            positive_added,
            negative_added,
            hours_since_last_sync,
            is_interpolated
        )
        SELECT
            appid,
            delta_date,
            total_reviews,
            positive_reviews,
            NULL,  -- No review_score for interpolated
            reviews_added,
            positive_added,
            negative_added,
            24.0,  -- Normalized to 24 hours
            TRUE   -- Mark as interpolated
        FROM interpolated_rows
        ON CONFLICT (appid, delta_date) DO NOTHING
        RETURNING appid
    )

    -- Count results
    SELECT COUNT(*)::INTEGER, COUNT(DISTINCT appid)::INTEGER
    INTO v_total_interpolated, v_apps_processed
    FROM inserted;

    RETURN QUERY SELECT v_total_interpolated, v_apps_processed;
END;
$$ LANGUAGE plpgsql;

-- Keep the single-app function for potential manual use, with same overflow protection
CREATE OR REPLACE FUNCTION interpolate_review_deltas(
    p_appid INTEGER,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
DECLARE
    v_interpolated_count INTEGER;
BEGIN
    WITH actual_syncs AS (
        SELECT
            delta_date,
            total_reviews,
            positive_reviews,
            LEAD(delta_date) OVER (ORDER BY delta_date) as next_date,
            LEAD(total_reviews) OVER (ORDER BY delta_date) as next_total,
            LEAD(positive_reviews) OVER (ORDER BY delta_date) as next_positive
        FROM review_deltas
        WHERE appid = p_appid
          AND is_interpolated = FALSE
          AND delta_date BETWEEN p_start_date AND p_end_date
    ),

    gaps AS (
        SELECT
            delta_date as prev_date,
            total_reviews as prev_total,
            positive_reviews as prev_positive,
            next_date,
            next_total,
            next_positive,
            (next_date - delta_date) as days_gap,
            (next_total - total_reviews)::DECIMAL / (next_date - delta_date) as daily_total_change,
            (next_positive - positive_reviews)::DECIMAL / (next_date - delta_date) as daily_positive_change
        FROM actual_syncs
        WHERE next_date IS NOT NULL
          AND (next_date - delta_date) > 1
    ),

    interpolated_rows AS (
        SELECT
            gap_date::DATE as delta_date,
            -- Overflow protection with LEAST()
            LEAST(
                2147483647,
                GREATEST(0, g.prev_total + ROUND(g.daily_total_change * (gap_date::DATE - g.prev_date)))
            )::INTEGER as total_reviews,
            LEAST(
                2147483647,
                GREATEST(0, g.prev_positive + ROUND(g.daily_positive_change * (gap_date::DATE - g.prev_date)))
            )::INTEGER as positive_reviews,
            -- Capped at 9999 to prevent daily_velocity overflow
            LEAST(9999, GREATEST(0, ROUND(g.daily_total_change)))::INTEGER as reviews_added,
            CASE WHEN g.daily_total_change > 0 THEN LEAST(9999, GREATEST(0, ROUND(g.daily_positive_change)))::INTEGER ELSE 0 END as positive_added,
            CASE WHEN g.daily_total_change > 0 THEN LEAST(9999, GREATEST(0, ROUND(g.daily_total_change - g.daily_positive_change)))::INTEGER ELSE 0 END as negative_added
        FROM gaps g
        CROSS JOIN LATERAL generate_series(g.prev_date + 1, g.next_date - 1, '1 day'::INTERVAL) as gap_date
    ),

    inserted AS (
        INSERT INTO review_deltas (
            appid, delta_date, total_reviews, positive_reviews, review_score,
            reviews_added, positive_added, negative_added, hours_since_last_sync, is_interpolated
        )
        SELECT
            p_appid, delta_date, total_reviews, positive_reviews, NULL,
            reviews_added, positive_added, negative_added, 24.0, TRUE
        FROM interpolated_rows
        ON CONFLICT (appid, delta_date) DO NOTHING
        RETURNING 1
    )

    SELECT COUNT(*)::INTEGER INTO v_interpolated_count FROM inserted;

    RETURN v_interpolated_count;
END;
$$ LANGUAGE plpgsql;

-- Update comments
COMMENT ON FUNCTION interpolate_all_review_deltas IS 'Optimized bulk interpolation with INTEGER overflow protection (caps at 2,147,483,647)';
COMMENT ON FUNCTION interpolate_review_deltas IS 'Fill gaps in review_deltas with interpolated values for a single app (with overflow protection)';
