-- Returns suspicious-zero appids for CCU workers without row-heavy PostgREST scans.
-- The worker only needs existence by appid, so return a single integer array.

CREATE OR REPLACE FUNCTION public.get_suspicious_zero_appids(p_appids INTEGER[])
RETURNS INTEGER[]
LANGUAGE sql
STABLE
AS $$
  WITH selected_appids AS (
    SELECT DISTINCT unnest(COALESCE(p_appids, ARRAY[]::INTEGER[])) AS appid
  ),
  suspicious AS (
    SELECT sa.appid
    FROM selected_appids sa
    JOIN public.apps a ON a.appid = sa.appid
    WHERE a.release_date IS NOT NULL
      AND a.release_date >= CURRENT_DATE - 180

    UNION

    SELECT sa.appid
    FROM selected_appids sa
    JOIN public.latest_daily_metrics ldm ON ldm.appid = sa.appid
    WHERE COALESCE(ldm.total_reviews, 0) >= 1000

    UNION

    SELECT sa.appid
    FROM selected_appids sa
    WHERE EXISTS (
      SELECT 1
      FROM public.daily_metrics dm
      WHERE dm.appid = sa.appid
        AND dm.metric_date >= CURRENT_DATE - 30
        AND dm.ccu_peak > 0
      LIMIT 1
    )

    UNION

    SELECT sa.appid
    FROM selected_appids sa
    WHERE EXISTS (
      SELECT 1
      FROM public.ccu_snapshots cs
      WHERE cs.appid = sa.appid
        AND cs.snapshot_time >= NOW() - INTERVAL '30 days'
        AND cs.player_count > 0
      LIMIT 1
    )
  )
  SELECT COALESCE(array_agg(appid ORDER BY appid), ARRAY[]::INTEGER[])
  FROM suspicious;
$$;

COMMENT ON FUNCTION public.get_suspicious_zero_appids(INTEGER[]) IS
  'Returns suspicious-zero appids for CCU workers using existence checks over recent activity.';

REVOKE EXECUTE ON FUNCTION public.get_suspicious_zero_appids(INTEGER[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_suspicious_zero_appids(INTEGER[]) TO service_role;
