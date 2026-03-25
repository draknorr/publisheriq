-- Migration: Add app-window pattern projection and rewrite pattern candidate RPC
-- Purpose:
--   1. Replace broad request-time aggregation for find_change_patterns with a shortlist-first app-window projection.
--   2. Keep change-pattern features fresh without denormalizing live metrics into the projection.
--   3. Preserve the existing get_chat_change_pattern_candidates(...) contract used by chat.

CREATE TABLE IF NOT EXISTS public.change_pattern_app_windows (
  appid INTEGER NOT NULL REFERENCES public.apps(appid) ON DELETE CASCADE,
  window_days INTEGER NOT NULL CHECK (window_days IN (7, 30, 90, 180)),
  app_name TEXT NOT NULL,
  app_type public.app_type,
  is_released BOOLEAN,
  release_date DATE,
  latest_occurred_at TIMESTAMPTZ NOT NULL,
  activity_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  signal_families TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  story_kinds TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  announcement_count INTEGER NOT NULL DEFAULT 0,
  change_count INTEGER NOT NULL DEFAULT 0,
  release_count INTEGER NOT NULL DEFAULT 0,
  pricing_count INTEGER NOT NULL DEFAULT 0,
  store_page_count INTEGER NOT NULL DEFAULT 0,
  media_count INTEGER NOT NULL DEFAULT 0,
  taxonomy_count INTEGER NOT NULL DEFAULT 0,
  platform_count INTEGER NOT NULL DEFAULT 0,
  build_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (appid, window_days)
);

CREATE INDEX IF NOT EXISTS idx_change_pattern_app_windows_window_latest
  ON public.change_pattern_app_windows(window_days, app_type, latest_occurred_at DESC, appid DESC);

CREATE INDEX IF NOT EXISTS idx_change_pattern_app_windows_appid_window
  ON public.change_pattern_app_windows(appid, window_days);

CREATE INDEX IF NOT EXISTS idx_change_pattern_app_windows_app_name_trgm
  ON public.change_pattern_app_windows USING GIN (app_name gin_trgm_ops);

COMMENT ON TABLE public.change_pattern_app_windows IS
  'App-window rollup for broad change-pattern candidate shortlisting. Metrics stay live-joined after shortlist.';

CREATE OR REPLACE FUNCTION public.refresh_change_pattern_app_windows_for_app(
  p_appid INTEGER,
  p_lookback_days INTEGER DEFAULT 180
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supported_lookback_days INTEGER := LEAST(GREATEST(COALESCE(p_lookback_days, 180), 1), 180);
  v_inserted INTEGER := 0;
BEGIN
  IF p_appid IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM public.change_pattern_app_windows
  WHERE appid = p_appid
    AND window_days <= v_supported_lookback_days;

  WITH window_config AS (
    SELECT window_days::INTEGER
    FROM UNNEST(ARRAY[7, 30, 90, 180]) AS window_days
    WHERE window_days <= v_supported_lookback_days
  ),
  daily_window AS (
    SELECT
      wc.window_days,
      cpad.*
    FROM window_config wc
    JOIN public.change_pattern_activity_days cpad
      ON cpad.appid = p_appid
     AND cpad.activity_date >= CURRENT_DATE - GREATEST(wc.window_days - 1, 0)
  ),
  window_base AS (
    SELECT
      dw.window_days,
      dw.appid,
      MAX(dw.app_name) AS app_name,
      MAX(dw.app_type) AS app_type,
      BOOL_OR(COALESCE(dw.is_released, FALSE)) AS is_released,
      MAX(dw.release_date) AS release_date,
      MAX(dw.latest_occurred_at) AS latest_occurred_at,
      SUM(dw.announcement_count)::INTEGER AS announcement_count,
      SUM(dw.total_bursts)::INTEGER AS change_count,
      SUM(dw.release_count)::INTEGER AS release_count,
      SUM(dw.pricing_count)::INTEGER AS pricing_count,
      SUM(dw.store_page_count)::INTEGER AS store_page_count,
      SUM(dw.media_count)::INTEGER AS media_count,
      SUM(dw.taxonomy_count)::INTEGER AS taxonomy_count,
      SUM(dw.platform_count)::INTEGER AS platform_count,
      SUM(dw.build_count)::INTEGER AS build_count
    FROM daily_window dw
    GROUP BY dw.window_days, dw.appid
  ),
  ranked_activity_ids AS (
    SELECT
      ranked.window_days,
      ranked.appid,
      ranked.burst_id,
      ROW_NUMBER() OVER (
        PARTITION BY ranked.window_days, ranked.appid
        ORDER BY ranked.latest_occurred_at DESC, ranked.activity_date DESC, ranked.ordinality, ranked.burst_id DESC
      ) AS burst_rank
    FROM (
      SELECT DISTINCT
        dw.window_days,
        dw.appid,
        dw.activity_date,
        dw.latest_occurred_at,
        burst.burst_id,
        burst.ordinality
      FROM daily_window dw
      CROSS JOIN LATERAL UNNEST(dw.burst_ids) WITH ORDINALITY AS burst(burst_id, ordinality)
    ) AS ranked
  ),
  window_activity_ids AS (
    SELECT
      rai.window_days,
      rai.appid,
      ARRAY_AGG(rai.burst_id ORDER BY rai.burst_rank) FILTER (WHERE rai.burst_rank <= 8) AS activity_ids
    FROM ranked_activity_ids rai
    GROUP BY rai.window_days, rai.appid
  ),
  window_signal_families AS (
    SELECT
      ranked.window_days,
      ranked.appid,
      ARRAY_AGG(
        ranked.signal_family
        ORDER BY public.change_signal_sort_rank(ranked.signal_family), ranked.signal_family
      ) AS signal_families
    FROM (
      SELECT DISTINCT
        dw.window_days,
        dw.appid,
        signal_family
      FROM daily_window dw
      CROSS JOIN LATERAL UNNEST(dw.signal_families) AS signal_family
    ) AS ranked
    GROUP BY ranked.window_days, ranked.appid
  ),
  window_story_kinds AS (
    SELECT
      ranked.window_days,
      ranked.appid,
      ARRAY_AGG(ranked.story_kind ORDER BY ranked.story_kind) AS story_kinds
    FROM (
      SELECT DISTINCT
        dw.window_days,
        dw.appid,
        story_kind
      FROM daily_window dw
      CROSS JOIN LATERAL UNNEST(dw.story_kinds) AS story_kind
    ) AS ranked
    GROUP BY ranked.window_days, ranked.appid
  ),
  upserted AS (
    INSERT INTO public.change_pattern_app_windows (
      appid,
      window_days,
      app_name,
      app_type,
      is_released,
      release_date,
      latest_occurred_at,
      activity_ids,
      signal_families,
      story_kinds,
      announcement_count,
      change_count,
      release_count,
      pricing_count,
      store_page_count,
      media_count,
      taxonomy_count,
      platform_count,
      build_count
    )
    SELECT
      wb.appid,
      wb.window_days,
      wb.app_name,
      wb.app_type,
      wb.is_released,
      wb.release_date,
      wb.latest_occurred_at,
      COALESCE(wai.activity_ids, ARRAY[]::TEXT[]),
      COALESCE(wsf.signal_families, ARRAY[]::TEXT[]),
      COALESCE(wsk.story_kinds, ARRAY[]::TEXT[]),
      wb.announcement_count,
      wb.change_count,
      wb.release_count,
      wb.pricing_count,
      wb.store_page_count,
      wb.media_count,
      wb.taxonomy_count,
      wb.platform_count,
      wb.build_count
    FROM window_base wb
    LEFT JOIN window_activity_ids wai
      ON wai.window_days = wb.window_days
     AND wai.appid = wb.appid
    LEFT JOIN window_signal_families wsf
      ON wsf.window_days = wb.window_days
     AND wsf.appid = wb.appid
    LEFT JOIN window_story_kinds wsk
      ON wsk.window_days = wb.window_days
     AND wsk.appid = wb.appid
    ON CONFLICT (appid, window_days) DO UPDATE
    SET
      app_name = EXCLUDED.app_name,
      app_type = EXCLUDED.app_type,
      is_released = EXCLUDED.is_released,
      release_date = EXCLUDED.release_date,
      latest_occurred_at = EXCLUDED.latest_occurred_at,
      activity_ids = EXCLUDED.activity_ids,
      signal_families = EXCLUDED.signal_families,
      story_kinds = EXCLUDED.story_kinds,
      announcement_count = EXCLUDED.announcement_count,
      change_count = EXCLUDED.change_count,
      release_count = EXCLUDED.release_count,
      pricing_count = EXCLUDED.pricing_count,
      store_page_count = EXCLUDED.store_page_count,
      media_count = EXCLUDED.media_count,
      taxonomy_count = EXCLUDED.taxonomy_count,
      platform_count = EXCLUDED.platform_count,
      build_count = EXCLUDED.build_count,
      updated_at = NOW()
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_inserted
  FROM upserted;

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_chat_change_pattern_candidates(
  p_pattern TEXT,
  p_days INTEGER DEFAULT 30,
  p_app_types TEXT[] DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  appid INTEGER,
  app_name TEXT,
  app_type TEXT,
  is_released BOOLEAN,
  release_date DATE,
  latest_occurred_at TIMESTAMPTZ,
  activity_ids TEXT[],
  signal_families TEXT[],
  story_kinds TEXT[],
  announcement_count INTEGER,
  change_count INTEGER,
  positive_percentage DOUBLE PRECISION,
  total_reviews INTEGER,
  ccu_peak INTEGER,
  price_cents INTEGER,
  discount_percent INTEGER,
  review_velocity_7d DOUBLE PRECISION,
  review_velocity_30d DOUBLE PRECISION,
  trend_30d_direction TEXT,
  ccu_trend_7d_pct DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH request_base AS (
    SELECT
      COALESCE(NULLIF(BTRIM(p_pattern), ''), 'generic') AS requested_pattern,
      LEAST(GREATEST(COALESCE(p_days, 30), 1), 180) AS days,
      CASE
        WHEN p_app_types IS NULL OR CARDINALITY(p_app_types) = 0 THEN NULL::TEXT[]
        ELSE p_app_types
      END AS requested_app_types,
      NULLIF(BTRIM(COALESCE(p_search, '')), '') AS requested_search,
      LEAST(GREATEST(COALESCE(p_limit, 10), 1), 120) AS requested_limit
  ),
  request_config AS (
    SELECT
      rb.*,
      CASE
        WHEN rb.days <= 7 THEN 7
        WHEN rb.days <= 30 THEN 30
        WHEN rb.days <= 90 THEN 90
        ELSE 180
      END AS shortlist_window_days,
      CASE
        WHEN rb.requested_pattern = ANY (ARRAY['sustained_response', 'announcement_weak_response']::TEXT[])
          THEN LEAST(GREATEST(rb.requested_limit * 10, 60), 120)
        ELSE LEAST(GREATEST(rb.requested_limit * 20, 120), 300)
      END AS shortlist_limit,
      rb.requested_pattern = ANY (ARRAY['under_marketed', 'signable_candidate', 'rescue_candidate']::TEXT[])
        AS requires_live_metrics
    FROM request_base rb
  ),
  coarse_candidates AS (
    SELECT
      cpaw.*,
      CASE rc.requested_pattern
        WHEN 'marketing_push' THEN
          CASE
            WHEN cpaw.pricing_count > 0
              AND (cpaw.store_page_count + cpaw.media_count) > 0
              AND cpaw.announcement_count > 0
              THEN 170
                + LEAST(cpaw.change_count, 6) * 6
                + LEAST(cpaw.announcement_count, 6) * 8
                + LEAST(cpaw.store_page_count + cpaw.media_count, 6) * 6
            ELSE 0
          END
        WHEN 'relaunch_pattern' THEN
          CASE
            WHEN cpaw.pricing_count > 0
              AND (cpaw.store_page_count + cpaw.media_count) > 0
              AND (cpaw.release_count > 0 OR cpaw.announcement_count > 0)
              THEN 175
                + LEAST(cpaw.change_count, 6) * 6
                + LEAST(cpaw.announcement_count, 6) * 8
                + LEAST(cpaw.release_count, 4) * 10
            ELSE 0
          END
        WHEN 'update_tease' THEN
          CASE
            WHEN cpaw.announcement_count > 0
              AND (cpaw.store_page_count + cpaw.media_count) > 0
              AND cpaw.build_count = 0
              THEN 160
                + LEAST(cpaw.announcement_count, 6) * 8
                + LEAST(cpaw.store_page_count + cpaw.media_count, 6) * 6
            ELSE 0
          END
        WHEN 'under_marketed' THEN
          CASE
            WHEN cpaw.build_count > 0
              AND (cpaw.store_page_count + cpaw.media_count) = 0
              AND cpaw.announcement_count = 0
              THEN 140 + LEAST(cpaw.change_count, 8) * 4
            ELSE 0
          END
        WHEN 'signable_candidate' THEN
          CASE
            WHEN cpaw.build_count > 0
              AND (cpaw.store_page_count + cpaw.media_count) = 0
              THEN 140 + LEAST(cpaw.change_count, 8) * 4
            ELSE 0
          END
        WHEN 'rescue_candidate' THEN
          CASE
            WHEN cpaw.pricing_count > 0
              THEN 135 + LEAST(cpaw.pricing_count, 6) * 8 + LEAST(cpaw.change_count, 8) * 4
            ELSE 0
          END
        WHEN 'sustained_response' THEN
          CASE
            WHEN cpaw.announcement_count > 0 OR cpaw.change_count >= 2
              THEN 135
                + LEAST(cpaw.announcement_count, 6) * 8
                + LEAST(cpaw.change_count, 6) * 6
            ELSE 0
          END
        WHEN 'announcement_weak_response' THEN
          CASE
            WHEN cpaw.announcement_count > 0
              THEN 145
                + LEAST(cpaw.announcement_count, 6) * 8
                + LEAST(cpaw.change_count, 6) * 4
            ELSE 0
          END
        ELSE 100 + LEAST(cpaw.change_count, 8) * 5
      END AS coarse_score
    FROM public.change_pattern_app_windows cpaw
    CROSS JOIN request_config rc
    WHERE cpaw.window_days = rc.shortlist_window_days
      AND (
        rc.requested_app_types IS NULL
        OR cpaw.app_type::TEXT = ANY (rc.requested_app_types)
      )
      AND (
        rc.requested_search IS NULL
        OR cpaw.app_name ILIKE '%' || rc.requested_search || '%'
      )
  ),
  shortlisted AS (
    SELECT
      cc.appid,
      cc.coarse_score
    FROM coarse_candidates cc
    WHERE cc.coarse_score > 0
    ORDER BY cc.coarse_score DESC, cc.latest_occurred_at DESC, cc.appid DESC
    LIMIT (SELECT shortlist_limit FROM request_config)
  ),
  exact_window_rows AS (
    SELECT
      cpad.*
    FROM public.change_pattern_activity_days cpad
    JOIN shortlisted shortlist
      ON shortlist.appid = cpad.appid
    CROSS JOIN request_config rc
    WHERE cpad.activity_date >= CURRENT_DATE - GREATEST(rc.days - 1, 0)
  ),
  exact_base AS (
    SELECT
      ewr.appid,
      MAX(ewr.app_name) AS app_name,
      MAX(ewr.app_type) AS app_type,
      BOOL_OR(COALESCE(ewr.is_released, FALSE)) AS is_released,
      MAX(ewr.release_date) AS release_date,
      MAX(ewr.latest_occurred_at) AS latest_occurred_at,
      SUM(ewr.announcement_count)::INTEGER AS announcement_count,
      SUM(ewr.total_bursts)::INTEGER AS change_count,
      SUM(ewr.release_count)::INTEGER AS release_count,
      SUM(ewr.pricing_count)::INTEGER AS pricing_count,
      SUM(ewr.store_page_count)::INTEGER AS store_page_count,
      SUM(ewr.media_count)::INTEGER AS media_count,
      SUM(ewr.taxonomy_count)::INTEGER AS taxonomy_count,
      SUM(ewr.platform_count)::INTEGER AS platform_count,
      SUM(ewr.build_count)::INTEGER AS build_count,
      MAX(shortlist.coarse_score) AS coarse_score
    FROM exact_window_rows ewr
    JOIN shortlisted shortlist
      ON shortlist.appid = ewr.appid
    GROUP BY ewr.appid
  ),
  ranked_activity_ids AS (
    SELECT
      ranked.appid,
      ranked.burst_id,
      ROW_NUMBER() OVER (
        PARTITION BY ranked.appid
        ORDER BY ranked.latest_occurred_at DESC, ranked.activity_date DESC, ranked.ordinality, ranked.burst_id DESC
      ) AS burst_rank
    FROM (
      SELECT DISTINCT
        ewr.appid,
        ewr.activity_date,
        ewr.latest_occurred_at,
        burst.burst_id,
        burst.ordinality
      FROM exact_window_rows ewr
      CROSS JOIN LATERAL UNNEST(ewr.burst_ids) WITH ORDINALITY AS burst(burst_id, ordinality)
    ) AS ranked
  ),
  grouped_activity_ids AS (
    SELECT
      rai.appid,
      ARRAY_AGG(rai.burst_id ORDER BY rai.burst_rank) FILTER (WHERE rai.burst_rank <= 6) AS activity_ids
    FROM ranked_activity_ids rai
    GROUP BY rai.appid
  ),
  grouped_signal_families AS (
    SELECT
      ranked.appid,
      ARRAY_AGG(
        ranked.signal_family
        ORDER BY public.change_signal_sort_rank(ranked.signal_family), ranked.signal_family
      ) AS signal_families
    FROM (
      SELECT DISTINCT
        ewr.appid,
        signal_family
      FROM exact_window_rows ewr
      CROSS JOIN LATERAL UNNEST(ewr.signal_families) AS signal_family
    ) AS ranked
    GROUP BY ranked.appid
  ),
  grouped_story_kinds AS (
    SELECT
      ranked.appid,
      ARRAY_AGG(ranked.story_kind ORDER BY ranked.story_kind) AS story_kinds
    FROM (
      SELECT DISTINCT
        ewr.appid,
        story_kind
      FROM exact_window_rows ewr
      CROSS JOIN LATERAL UNNEST(ewr.story_kinds) AS story_kind
    ) AS ranked
    GROUP BY ranked.appid
  ),
  exact_grouped AS (
    SELECT
      eb.appid,
      eb.app_name,
      eb.app_type::TEXT AS app_type,
      eb.is_released,
      eb.release_date,
      eb.latest_occurred_at,
      COALESCE(gai.activity_ids, ARRAY[]::TEXT[]) AS activity_ids,
      COALESCE(gsf.signal_families, ARRAY[]::TEXT[]) AS signal_families,
      COALESCE(gsk.story_kinds, ARRAY[]::TEXT[]) AS story_kinds,
      eb.announcement_count,
      eb.change_count,
      eb.release_count,
      eb.pricing_count,
      eb.store_page_count,
      eb.media_count,
      eb.taxonomy_count,
      eb.platform_count,
      eb.build_count,
      eb.coarse_score
    FROM exact_base eb
    LEFT JOIN grouped_activity_ids gai
      ON gai.appid = eb.appid
    LEFT JOIN grouped_signal_families gsf
      ON gsf.appid = eb.appid
    LEFT JOIN grouped_story_kinds gsk
      ON gsk.appid = eb.appid
  ),
  metrics_joined AS (
    SELECT
      eg.*,
      CASE WHEN rc.requires_live_metrics THEN ldm.positive_percentage ELSE NULL END AS positive_percentage,
      CASE WHEN rc.requires_live_metrics THEN ldm.total_reviews ELSE NULL END AS total_reviews,
      CASE WHEN rc.requires_live_metrics THEN ldm.ccu_peak ELSE NULL END AS ccu_peak,
      CASE WHEN rc.requires_live_metrics THEN ldm.price_cents ELSE NULL END AS price_cents,
      CASE WHEN rc.requires_live_metrics THEN ldm.discount_percent ELSE NULL END AS discount_percent,
      CASE WHEN rc.requires_live_metrics THEN trends.review_velocity_7d ELSE NULL END AS review_velocity_7d,
      CASE WHEN rc.requires_live_metrics THEN trends.review_velocity_30d ELSE NULL END AS review_velocity_30d,
      CASE WHEN rc.requires_live_metrics THEN trends.trend_30d_direction ELSE NULL END AS trend_30d_direction,
      CASE WHEN rc.requires_live_metrics THEN trends.ccu_trend_7d_pct ELSE NULL END AS ccu_trend_7d_pct
    FROM exact_grouped eg
    CROSS JOIN request_config rc
    LEFT JOIN public.latest_daily_metrics ldm
      ON rc.requires_live_metrics
     AND ldm.appid = eg.appid
    LEFT JOIN public.app_trends trends
      ON rc.requires_live_metrics
     AND trends.appid = eg.appid
  ),
  scored AS (
    SELECT
      mj.*,
      CASE rc.requested_pattern
        WHEN 'marketing_push' THEN
          CASE
            WHEN mj.pricing_count > 0
              AND (mj.store_page_count + mj.media_count) > 0
              AND mj.announcement_count > 0
              THEN 170
                + LEAST(mj.change_count, 6) * 6
                + LEAST(mj.announcement_count, 6) * 8
                + LEAST(mj.store_page_count + mj.media_count, 6) * 6
            ELSE 0
          END
        WHEN 'relaunch_pattern' THEN
          CASE
            WHEN mj.pricing_count > 0
              AND (mj.store_page_count + mj.media_count) > 0
              AND (mj.release_count > 0 OR mj.announcement_count > 0)
              THEN 175
                + LEAST(mj.change_count, 6) * 6
                + LEAST(mj.announcement_count, 6) * 8
                + LEAST(mj.release_count, 4) * 10
            ELSE 0
          END
        WHEN 'update_tease' THEN
          CASE
            WHEN mj.announcement_count > 0
              AND (mj.store_page_count + mj.media_count) > 0
              AND mj.build_count = 0
              THEN 160
                + LEAST(mj.announcement_count, 6) * 8
                + LEAST(mj.store_page_count + mj.media_count, 6) * 6
            ELSE 0
          END
        WHEN 'under_marketed' THEN
          CASE
            WHEN mj.build_count > 0
              AND (mj.store_page_count + mj.media_count) = 0
              AND mj.announcement_count = 0
              THEN 150
                + CASE WHEN COALESCE(mj.positive_percentage, 0) >= 80 THEN 20 ELSE 0 END
                + CASE WHEN COALESCE(mj.total_reviews, 0) >= 200 THEN 15 ELSE 0 END
                + CASE WHEN COALESCE(mj.review_velocity_30d, 0) >= 1 THEN 10 ELSE 0 END
            ELSE 0
          END
        WHEN 'signable_candidate' THEN
          CASE
            WHEN mj.build_count > 0
              AND (mj.store_page_count + mj.media_count) = 0
              THEN 145
                + CASE WHEN COALESCE(mj.positive_percentage, 0) >= 85 THEN 25 ELSE 0 END
                + CASE WHEN COALESCE(mj.total_reviews, 0) >= 300 THEN 20 ELSE 0 END
                + CASE WHEN COALESCE(mj.review_velocity_30d, 0) >= 1 THEN 10 ELSE 0 END
            ELSE 0
          END
        WHEN 'rescue_candidate' THEN
          CASE
            WHEN mj.pricing_count > 0
              AND (
                mj.trend_30d_direction = 'down'
                OR COALESCE(mj.ccu_trend_7d_pct, 0) < 0
              )
              THEN 145
                + CASE WHEN COALESCE(mj.total_reviews, 0) >= 100 THEN 15 ELSE 0 END
                + CASE WHEN COALESCE(mj.positive_percentage, 0) >= 70 THEN 10 ELSE 0 END
            ELSE 0
          END
        WHEN 'sustained_response' THEN
          CASE
            WHEN mj.announcement_count > 0 OR mj.change_count >= 2
              THEN 135
                + LEAST(mj.announcement_count, 6) * 8
                + LEAST(mj.change_count, 6) * 6
            ELSE 0
          END
        WHEN 'announcement_weak_response' THEN
          CASE
            WHEN mj.announcement_count > 0
              THEN 145
                + LEAST(mj.announcement_count, 6) * 8
                + LEAST(mj.change_count, 6) * 4
            ELSE 0
          END
        ELSE 100 + LEAST(mj.change_count, 8) * 5
      END AS pattern_score
    FROM metrics_joined mj
    CROSS JOIN request_config rc
  )
  SELECT
    s.appid,
    s.app_name,
    s.app_type,
    s.is_released,
    s.release_date,
    s.latest_occurred_at,
    s.activity_ids,
    s.signal_families,
    s.story_kinds,
    s.announcement_count,
    s.change_count,
    s.positive_percentage,
    s.total_reviews,
    s.ccu_peak,
    s.price_cents,
    s.discount_percent,
    s.review_velocity_7d,
    s.review_velocity_30d,
    s.trend_30d_direction,
    s.ccu_trend_7d_pct
  FROM scored s
  WHERE s.pattern_score > 0
  ORDER BY
    s.pattern_score DESC,
    s.coarse_score DESC,
    s.latest_occurred_at DESC,
    COALESCE(s.total_reviews, 0) DESC,
    s.appid DESC
  LIMIT (SELECT requested_limit FROM request_config);
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_change_pattern_app_windows_for_app(INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_chat_change_pattern_candidates(TEXT, INTEGER, TEXT[], TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_chat_change_pattern_candidates(TEXT, INTEGER, TEXT[], TEXT, INTEGER) FROM anon;

GRANT EXECUTE ON FUNCTION public.refresh_change_pattern_app_windows_for_app(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_chat_change_pattern_candidates(TEXT, INTEGER, TEXT[], TEXT, INTEGER) TO authenticated, service_role;
