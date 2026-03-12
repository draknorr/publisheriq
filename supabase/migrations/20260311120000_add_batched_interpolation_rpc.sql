-- Migration: Add batched interpolation RPC for review_deltas
-- Purpose: Keep each interpolation RPC call under the Supabase statement timeout

CREATE OR REPLACE FUNCTION interpolate_review_deltas_batch(
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    p_end_date DATE DEFAULT CURRENT_DATE,
    p_after_appid INTEGER DEFAULT 0,
    p_app_limit INTEGER DEFAULT 2000
)
RETURNS TABLE(
    total_interpolated INTEGER,
    apps_processed INTEGER,
    last_appid INTEGER,
    has_more BOOLEAN
) AS $$
DECLARE
    v_total_interpolated INTEGER := 0;
    v_apps_processed INTEGER := 0;
    v_last_appid INTEGER;
    v_has_more BOOLEAN := FALSE;
BEGIN
    WITH batch_appids AS (
        SELECT DISTINCT rd.appid
        FROM review_deltas rd
        WHERE rd.is_interpolated = FALSE
          AND rd.delta_date BETWEEN p_start_date AND p_end_date
          AND rd.appid > COALESCE(p_after_appid, 0)
        ORDER BY rd.appid
        LIMIT GREATEST(COALESCE(p_app_limit, 2000), 1)
    ),

    actual_syncs AS (
        SELECT
            rd.appid,
            rd.delta_date,
            rd.total_reviews,
            rd.positive_reviews
        FROM review_deltas rd
        JOIN batch_appids ba ON ba.appid = rd.appid
        WHERE rd.is_interpolated = FALSE
          AND rd.delta_date BETWEEN p_start_date AND p_end_date
    ),

    with_next AS (
        SELECT
            appid,
            delta_date AS prev_date,
            total_reviews AS prev_total,
            positive_reviews AS prev_positive,
            LEAD(delta_date) OVER (PARTITION BY appid ORDER BY delta_date) AS next_date,
            LEAD(total_reviews) OVER (PARTITION BY appid ORDER BY delta_date) AS next_total,
            LEAD(positive_reviews) OVER (PARTITION BY appid ORDER BY delta_date) AS next_positive
        FROM actual_syncs
    ),

    gaps AS (
        SELECT
            appid,
            prev_date,
            prev_total,
            prev_positive,
            next_date,
            next_total,
            next_positive,
            (next_date - prev_date) AS days_gap,
            (next_total - prev_total)::DECIMAL / (next_date - prev_date) AS daily_total_change,
            (next_positive - prev_positive)::DECIMAL / (next_date - prev_date) AS daily_positive_change
        FROM with_next
        WHERE next_date IS NOT NULL
          AND (next_date - prev_date) > 1
    ),

    interpolated_rows AS (
        SELECT
            g.appid,
            gap_date::DATE AS delta_date,
            LEAST(
                2147483647,
                GREATEST(0, g.prev_total + ROUND(g.daily_total_change * (gap_date::DATE - g.prev_date)))
            )::INTEGER AS total_reviews,
            LEAST(
                2147483647,
                GREATEST(0, g.prev_positive + ROUND(g.daily_positive_change * (gap_date::DATE - g.prev_date)))
            )::INTEGER AS positive_reviews,
            LEAST(9999, GREATEST(0, ROUND(g.daily_total_change)))::INTEGER AS reviews_added,
            CASE
                WHEN g.daily_total_change > 0 THEN
                    LEAST(9999, GREATEST(0, ROUND(g.daily_positive_change)))::INTEGER
                ELSE 0
            END AS positive_added,
            CASE
                WHEN g.daily_total_change > 0 THEN
                    LEAST(9999, GREATEST(0, ROUND(g.daily_total_change - g.daily_positive_change)))::INTEGER
                ELSE 0
            END AS negative_added
        FROM gaps g
        CROSS JOIN LATERAL generate_series(
            g.prev_date + 1,
            g.next_date - 1,
            '1 day'::INTERVAL
        ) AS gap_date
    ),

    missing_rows AS (
        SELECT ir.*
        FROM interpolated_rows ir
        WHERE NOT EXISTS (
            SELECT 1
            FROM review_deltas existing
            WHERE existing.appid = ir.appid
              AND existing.delta_date = ir.delta_date
        )
    ),

    inserted AS (
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
            NULL,
            reviews_added,
            positive_added,
            negative_added,
            24.0,
            TRUE
        FROM missing_rows
        ON CONFLICT (appid, delta_date) DO NOTHING
        RETURNING 1
    )

    SELECT
        COALESCE((SELECT COUNT(*)::INTEGER FROM inserted), 0),
        COALESCE((SELECT COUNT(*)::INTEGER FROM batch_appids), 0),
        (SELECT MAX(appid) FROM batch_appids)
    INTO v_total_interpolated, v_apps_processed, v_last_appid;

    IF v_last_appid IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM review_deltas rd
            WHERE rd.is_interpolated = FALSE
              AND rd.delta_date BETWEEN p_start_date AND p_end_date
              AND rd.appid > v_last_appid
        )
        INTO v_has_more;
    END IF;

    RETURN QUERY
    SELECT v_total_interpolated, v_apps_processed, v_last_appid, v_has_more;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION interpolate_review_deltas_batch IS
    'Interpolate review_deltas in appid batches to stay within Supabase RPC statement timeout';
