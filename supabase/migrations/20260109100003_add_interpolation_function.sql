-- Migration: Add interpolation function for review_deltas
-- Purpose: Fill gaps in daily data with interpolated values for trend visualization

-- Function to interpolate missing days for a single app
CREATE OR REPLACE FUNCTION interpolate_review_deltas(
    p_appid INTEGER,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
DECLARE
    v_prev_date DATE;
    v_prev_total INTEGER;
    v_prev_positive INTEGER;
    v_next_date DATE;
    v_next_total INTEGER;
    v_next_positive INTEGER;
    v_current DATE;
    v_interpolated_count INTEGER := 0;
    v_days_gap INTEGER;
    v_daily_reviews DECIMAL;
    v_daily_positive DECIMAL;
    v_positive_ratio DECIMAL;
BEGIN
    -- Find pairs of actual sync points with gaps between them
    FOR v_prev_date, v_prev_total, v_prev_positive, v_next_date, v_next_total, v_next_positive IN
        WITH actuals AS (
            SELECT delta_date, total_reviews, positive_reviews
            FROM review_deltas
            WHERE appid = p_appid
              AND is_interpolated = FALSE
              AND delta_date BETWEEN p_start_date AND p_end_date
            ORDER BY delta_date
        ),
        pairs AS (
            SELECT
                a1.delta_date as prev_date,
                a1.total_reviews as prev_total,
                a1.positive_reviews as prev_positive,
                a2.delta_date as next_date,
                a2.total_reviews as next_total,
                a2.positive_reviews as next_positive
            FROM actuals a1
            JOIN actuals a2 ON a2.delta_date > a1.delta_date
            WHERE NOT EXISTS (
                SELECT 1 FROM actuals a3
                WHERE a3.delta_date > a1.delta_date
                  AND a3.delta_date < a2.delta_date
            )
        )
        SELECT * FROM pairs WHERE next_date - prev_date > 1
    LOOP
        -- Calculate interpolation parameters
        v_days_gap := v_next_date - v_prev_date;
        v_daily_reviews := (v_next_total - v_prev_total)::DECIMAL / v_days_gap;
        v_daily_positive := (v_next_positive - v_prev_positive)::DECIMAL / v_days_gap;

        -- Calculate positive ratio for the period
        IF v_daily_reviews > 0 THEN
            v_positive_ratio := v_daily_positive / v_daily_reviews;
        ELSE
            v_positive_ratio := 0.8; -- Default assumption
        END IF;

        -- Insert interpolated values for each missing day
        v_current := v_prev_date + 1;
        WHILE v_current < v_next_date LOOP
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
            VALUES (
                p_appid,
                v_current,
                v_prev_total + ROUND(v_daily_reviews * (v_current - v_prev_date)),
                v_prev_positive + ROUND(v_daily_positive * (v_current - v_prev_date)),
                NULL, -- No score for interpolated
                GREATEST(0, ROUND(v_daily_reviews)),
                GREATEST(0, ROUND(v_daily_reviews * v_positive_ratio)),
                GREATEST(0, ROUND(v_daily_reviews * (1 - v_positive_ratio))),
                24.0, -- Normalized to 24 hours
                TRUE
            )
            ON CONFLICT (appid, delta_date) DO NOTHING;

            v_interpolated_count := v_interpolated_count + 1;
            v_current := v_current + 1;
        END LOOP;
    END LOOP;

    RETURN v_interpolated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to interpolate all apps with gaps (for batch processing)
CREATE OR REPLACE FUNCTION interpolate_all_review_deltas(
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(total_interpolated INTEGER, apps_processed INTEGER) AS $$
DECLARE
    v_appid INTEGER;
    v_total INTEGER := 0;
    v_app_count INTEGER := 0;
    v_result INTEGER;
BEGIN
    -- Find all apps with review data that may have gaps
    FOR v_appid IN
        SELECT DISTINCT appid
        FROM review_deltas
        WHERE delta_date BETWEEN p_start_date AND p_end_date
          AND is_interpolated = FALSE
    LOOP
        v_result := interpolate_review_deltas(v_appid, p_start_date, p_end_date);
        v_total := v_total + v_result;
        v_app_count := v_app_count + 1;
    END LOOP;

    RETURN QUERY SELECT v_total, v_app_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON FUNCTION interpolate_review_deltas IS 'Fill gaps in review_deltas with interpolated values for a single app';
COMMENT ON FUNCTION interpolate_all_review_deltas IS 'Batch interpolation for all apps with gaps';
