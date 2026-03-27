-- Migration: Fix reviews claim hot path and batch velocity tier updates
-- Purpose:
--   1. Bound reviews queue claiming to a seeded sync_status working set.
--   2. Avoid reviews claim scans over the full due queue on every batch.
--   3. Introduce an ordered, SKIP LOCKED velocity batch updater to reduce deadlocks.

CREATE INDEX IF NOT EXISTS idx_sync_status_reviews_due_unclaimed
    ON sync_status(next_reviews_sync ASC, priority_score DESC, appid ASC)
    WHERE is_syncable = TRUE
      AND reviews_claim_expires_at IS NULL;

CREATE OR REPLACE FUNCTION claim_apps_for_reviews_sync(
    p_worker_id TEXT,
    p_limit INTEGER DEFAULT 100,
    p_claim_ttl_minutes INTEGER DEFAULT 15,
    p_launch_limit INTEGER DEFAULT 25,
    p_change_limit INTEGER DEFAULT 20,
    p_active_limit INTEGER DEFAULT 35,
    p_backfill_limit INTEGER DEFAULT 19,
    p_unknown_limit INTEGER DEFAULT 1
)
RETURNS TABLE (
    appid INTEGER,
    lane TEXT,
    priority_score INTEGER,
    velocity_tier TEXT,
    hours_overdue DECIMAL,
    last_known_total_reviews INTEGER,
    last_reviews_sync TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_requested_limit INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
    v_claim_ttl_minutes INTEGER := GREATEST(1, LEAST(COALESCE(p_claim_ttl_minutes, 15), 240));
    v_total_weight INTEGER := GREATEST(
        COALESCE(p_launch_limit, 0)
        + COALESCE(p_change_limit, 0)
        + COALESCE(p_active_limit, 0)
        + COALESCE(p_backfill_limit, 0)
        + COALESCE(p_unknown_limit, 0),
        1
    );
    v_launch_quota INTEGER := FLOOR(v_requested_limit::NUMERIC * COALESCE(p_launch_limit, 0) / v_total_weight)::INTEGER;
    v_change_quota INTEGER := FLOOR(v_requested_limit::NUMERIC * COALESCE(p_change_limit, 0) / v_total_weight)::INTEGER;
    v_active_quota INTEGER := FLOOR(v_requested_limit::NUMERIC * COALESCE(p_active_limit, 0) / v_total_weight)::INTEGER;
    v_backfill_quota INTEGER := FLOOR(v_requested_limit::NUMERIC * COALESCE(p_backfill_limit, 0) / v_total_weight)::INTEGER;
    v_unknown_quota INTEGER := FLOOR(v_requested_limit::NUMERIC * COALESCE(p_unknown_limit, 0) / v_total_weight)::INTEGER;
    v_seed_limit INTEGER := LEAST(GREATEST(v_requested_limit * 20, 500), 2000);
    v_override_seed_limit INTEGER := LEAST(GREATEST(v_requested_limit * 4, 100), 400);
    v_expired_seed_limit INTEGER := LEAST(GREATEST((v_seed_limit + 3) / 4, 100), 500);
BEGIN
    RETURN QUERY
    WITH override_seed AS (
        SELECT s.appid
        FROM sync_status s
        WHERE s.is_syncable = TRUE
          AND (s.next_reviews_sync IS NULL OR s.next_reviews_sync <= v_now)
          AND (s.reviews_claim_expires_at IS NULL OR s.reviews_claim_expires_at <= v_now)
          AND s.reviews_priority_override_until IS NOT NULL
          AND s.reviews_priority_override_until > v_now
          AND s.reviews_priority_override_bucket IS NOT NULL
        ORDER BY
            COALESCE(s.reviews_priority_override_score, 0) DESC,
            s.next_reviews_sync ASC NULLS FIRST,
            COALESCE(s.priority_score, 0) DESC,
            s.appid ASC
        LIMIT v_override_seed_limit
    ),
    due_seed_unclaimed AS (
        SELECT s.appid
        FROM sync_status s
        WHERE s.is_syncable = TRUE
          AND s.reviews_claim_expires_at IS NULL
          AND (s.next_reviews_sync IS NULL OR s.next_reviews_sync <= v_now)
        ORDER BY
            s.next_reviews_sync ASC NULLS FIRST,
            COALESCE(s.priority_score, 0) DESC,
            s.appid ASC
        LIMIT v_seed_limit
    ),
    due_seed_expired AS (
        SELECT s.appid
        FROM sync_status s
        WHERE s.is_syncable = TRUE
          AND s.reviews_claim_expires_at <= v_now
          AND (s.next_reviews_sync IS NULL OR s.next_reviews_sync <= v_now)
        ORDER BY
            s.reviews_claim_expires_at ASC,
            s.next_reviews_sync ASC NULLS FIRST,
            COALESCE(s.priority_score, 0) DESC,
            s.appid ASC
        LIMIT v_expired_seed_limit
    ),
    seed_appids AS (
        SELECT appid FROM override_seed
        UNION
        SELECT appid FROM due_seed_unclaimed
        UNION
        SELECT appid FROM due_seed_expired
    ),
    candidate_pool AS (
        SELECT
            s.appid,
            CASE
                WHEN s.reviews_priority_override_until IS NOT NULL
                     AND s.reviews_priority_override_until > v_now
                     AND s.reviews_priority_override_bucket IS NOT NULL
                THEN s.reviews_priority_override_bucket
                WHEN COALESCE(a.is_released, FALSE) = TRUE
                     AND (a.release_date IS NULL OR a.release_date >= CURRENT_DATE - INTERVAL '7 days')
                THEN 'launch_critical'
                WHEN COALESCE(s.review_velocity_tier, 'unknown') IN ('high', 'medium')
                     OR COALESCE(s.velocity_7d, 0) >= 1
                THEN 'active_reviews'
                WHEN COALESCE(s.priority_score, 0) >= 50
                     OR COALESCE(s.last_known_total_reviews, 0) >= 1000
                THEN 'important_backfill'
                ELSE 'unknown_sweep'
            END::TEXT AS lane,
            COALESCE(s.priority_score, 0)::INTEGER AS priority_score,
            COALESCE(s.review_velocity_tier, 'unknown')::TEXT AS velocity_tier,
            (EXTRACT(EPOCH FROM (v_now - COALESCE(s.next_reviews_sync, v_now))) / 3600.0)::DECIMAL AS hours_overdue,
            s.last_known_total_reviews,
            s.last_reviews_sync,
            COALESCE(s.reviews_priority_override_score, 0)::INTEGER AS sort_override_score,
            CASE WHEN s.last_reviews_sync IS NULL THEN 0 ELSE 1 END AS sort_never_synced,
            COALESCE(s.next_reviews_sync, s.last_reviews_sync, v_now) AS sort_due_at,
            COALESCE(s.last_known_total_reviews, 0)::INTEGER AS sort_total_reviews
        FROM sync_status s
        JOIN seed_appids seed ON seed.appid = s.appid
        LEFT JOIN apps a ON a.appid = s.appid
        WHERE s.is_syncable = TRUE
          AND (s.next_reviews_sync IS NULL OR s.next_reviews_sync <= v_now)
          AND (s.reviews_claim_expires_at IS NULL OR s.reviews_claim_expires_at <= v_now)
        FOR UPDATE OF s SKIP LOCKED
    ),
    ranked AS (
        SELECT
            cp.*,
            ROW_NUMBER() OVER (
                PARTITION BY cp.lane
                ORDER BY
                    cp.sort_override_score DESC,
                    cp.sort_never_synced ASC,
                    cp.sort_due_at ASC NULLS FIRST,
                    cp.priority_score DESC,
                    cp.sort_total_reviews DESC,
                    cp.appid ASC
            ) AS lane_rank
        FROM candidate_pool cp
    ),
    primary_claims AS (
        SELECT r.*
        FROM ranked r
        WHERE (r.lane = 'launch_critical' AND r.lane_rank <= v_launch_quota)
           OR (r.lane = 'change_critical' AND r.lane_rank <= v_change_quota)
           OR (r.lane = 'active_reviews' AND r.lane_rank <= v_active_quota)
           OR (r.lane = 'important_backfill' AND r.lane_rank <= v_backfill_quota)
           OR (r.lane = 'unknown_sweep' AND r.lane_rank <= v_unknown_quota)
    ),
    primary_count AS (
        SELECT COUNT(*) AS count
        FROM primary_claims
    ),
    reallocated_claims AS (
        SELECT r.*
        FROM ranked r
        WHERE NOT EXISTS (
            SELECT 1
            FROM primary_claims pc
            WHERE pc.appid = r.appid
        )
        ORDER BY
            CASE r.lane
                WHEN 'launch_critical' THEN 0
                WHEN 'change_critical' THEN 1
                WHEN 'active_reviews' THEN 2
                WHEN 'important_backfill' THEN 3
                ELSE 4
            END,
            r.sort_override_score DESC,
            r.sort_never_synced ASC,
            r.sort_due_at ASC NULLS FIRST,
            r.priority_score DESC,
            r.sort_total_reviews DESC,
            r.appid ASC
        LIMIT GREATEST(v_requested_limit - (SELECT count FROM primary_count), 0)
    ),
    selected AS (
        SELECT * FROM primary_claims
        UNION ALL
        SELECT * FROM reallocated_claims
    )
    UPDATE sync_status s
    SET
        reviews_claimed_by = p_worker_id,
        reviews_claimed_at = v_now,
        reviews_claim_expires_at = v_now + make_interval(mins => v_claim_ttl_minutes)
    FROM selected sel
    WHERE s.appid = sel.appid
    RETURNING
        s.appid,
        sel.lane,
        sel.priority_score,
        sel.velocity_tier,
        sel.hours_overdue,
        sel.last_known_total_reviews,
        sel.last_reviews_sync;
END;
$$;

COMMENT ON FUNCTION claim_apps_for_reviews_sync IS
    'Claim due apps for reviews sync from a bounded sync_status seed with quota reallocation.';

CREATE OR REPLACE FUNCTION update_review_velocity_tiers_batch(
    p_limit INTEGER DEFAULT 1000
)
RETURNS TABLE(updated_count INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
    v_apply_limit INTEGER := GREATEST(1, LEAST(COALESCE(p_limit, 1000), 5000));
    v_candidate_limit INTEGER := LEAST(v_apply_limit * 5, 25000);
BEGIN
    RETURN QUERY
    WITH desired_values AS (
        SELECT
            s.appid,
            s.velocity_7d AS current_velocity_7d,
            s.review_velocity_tier AS current_review_velocity_tier,
            s.reviews_interval_hours AS current_reviews_interval_hours,
            CASE
                WHEN rvs.appid IS NOT NULL THEN rvs.velocity_7d
                WHEN at.appid IS NOT NULL THEN LEAST(GREATEST(COALESCE(at.review_velocity_7d, 0), 0), 9999.9999)
                ELSE 0
            END::NUMERIC(8,4) AS desired_velocity_7d,
            CASE
                WHEN rvs.appid IS NOT NULL THEN rvs.velocity_tier
                WHEN COALESCE(at.review_velocity_7d, 0) >= 5 THEN 'high'
                WHEN COALESCE(at.review_velocity_7d, 0) >= 1 THEN 'medium'
                WHEN COALESCE(at.review_velocity_7d, 0) >= 0.1 THEN 'low'
                ELSE 'dormant'
            END::TEXT AS desired_review_velocity_tier,
            CASE
                WHEN rvs.appid IS NOT NULL AND rvs.velocity_tier = 'high' THEN 4
                WHEN rvs.appid IS NOT NULL AND rvs.velocity_tier = 'medium' THEN 12
                WHEN rvs.appid IS NOT NULL AND rvs.velocity_tier = 'low' THEN 24
                WHEN rvs.appid IS NOT NULL THEN 72
                WHEN COALESCE(at.review_velocity_7d, 0) >= 5 THEN 4
                WHEN COALESCE(at.review_velocity_7d, 0) >= 1 THEN 12
                WHEN COALESCE(at.review_velocity_7d, 0) >= 0.1 THEN 24
                ELSE 72
            END::INTEGER AS desired_reviews_interval_hours
        FROM sync_status s
        LEFT JOIN review_velocity_stats rvs ON rvs.appid = s.appid
        LEFT JOIN app_trends at ON at.appid = s.appid
        WHERE s.last_reviews_sync IS NOT NULL
    ),
    diff_candidates AS (
        SELECT
            dv.appid,
            dv.desired_velocity_7d,
            dv.desired_review_velocity_tier,
            dv.desired_reviews_interval_hours
        FROM desired_values dv
        WHERE dv.current_velocity_7d IS DISTINCT FROM dv.desired_velocity_7d
           OR dv.current_review_velocity_tier IS DISTINCT FROM dv.desired_review_velocity_tier
           OR dv.current_reviews_interval_hours IS DISTINCT FROM dv.desired_reviews_interval_hours
        ORDER BY dv.appid ASC
        LIMIT v_candidate_limit
    ),
    locked_candidates AS (
        SELECT s.appid
        FROM sync_status s
        JOIN diff_candidates dc ON dc.appid = s.appid
        ORDER BY s.appid ASC
        LIMIT v_apply_limit
        FOR UPDATE OF s SKIP LOCKED
    ),
    updated AS (
        UPDATE sync_status s
        SET
            velocity_7d = dc.desired_velocity_7d,
            review_velocity_tier = dc.desired_review_velocity_tier,
            reviews_interval_hours = dc.desired_reviews_interval_hours,
            velocity_calculated_at = NOW()
        FROM diff_candidates dc
        JOIN locked_candidates lc ON lc.appid = dc.appid
        WHERE s.appid = dc.appid
        RETURNING s.appid
    )
    SELECT COUNT(*)::INTEGER AS updated_count
    FROM updated;
END;
$$;

COMMENT ON FUNCTION update_review_velocity_tiers_batch IS
    'Apply derived review velocity fields to sync_status in ordered SKIP LOCKED batches.';
