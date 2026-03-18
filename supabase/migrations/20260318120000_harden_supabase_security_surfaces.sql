-- Compatibility-first Supabase security hardening.
-- This migration closes exposed table/function surfaces without changing
-- current app routes or RPC response shapes.

-- ---------------------------------------------------------------------------
-- Fix stale apps filter counts RPC compatibility without mutating the
-- underlying app_steam_deck table shape.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_apps_filter_option_counts(
  p_filter_type TEXT,
  p_type TEXT DEFAULT 'game',
  p_min_ccu INT DEFAULT NULL,
  p_min_reviews INT DEFAULT NULL,
  p_min_score INT DEFAULT NULL,
  p_min_owners BIGINT DEFAULT NULL
)
RETURNS TABLE (
  option_id INT,
  option_name TEXT,
  app_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_has_metric_filters BOOLEAN;
BEGIN
  v_has_metric_filters := (
    p_min_ccu IS NOT NULL
    OR p_min_reviews IS NOT NULL
    OR p_min_score IS NOT NULL
    OR p_min_owners IS NOT NULL
  );

  IF p_filter_type = 'genre' THEN
    IF v_has_metric_filters THEN
      RETURN QUERY
      SELECT
        ag.genre_id::INT AS option_id,
        sg.name::TEXT AS option_name,
        COUNT(*)::BIGINT AS app_count
      FROM public.app_genres ag
      JOIN public.steam_genres sg ON sg.genre_id = ag.genre_id
      JOIN public.apps a ON a.appid = ag.appid
      LEFT JOIN public.latest_daily_metrics ldm ON ldm.appid = a.appid
      WHERE a.is_released = TRUE
        AND a.is_delisted = FALSE
        AND (p_type = 'all' OR a.type::TEXT = p_type)
        AND (p_min_ccu IS NULL OR ldm.ccu_peak >= p_min_ccu)
        AND (p_min_reviews IS NULL OR ldm.total_reviews >= p_min_reviews)
        AND (p_min_score IS NULL OR ldm.review_score >= p_min_score)
        AND (p_min_owners IS NULL OR ldm.owners_midpoint >= p_min_owners)
      GROUP BY ag.genre_id, sg.name
      ORDER BY app_count DESC, option_name;
    ELSE
      IF p_type = 'all' THEN
        RETURN QUERY
        SELECT
          mv.genre_id::INT AS option_id,
          mv.genre_name::TEXT AS option_name,
          SUM(mv.app_count)::BIGINT AS app_count
        FROM public.mv_genre_counts mv
        GROUP BY mv.genre_id, mv.genre_name
        ORDER BY app_count DESC, option_name;
      ELSE
        RETURN QUERY
        SELECT
          mv.genre_id::INT AS option_id,
          mv.genre_name::TEXT AS option_name,
          mv.app_count::BIGINT
        FROM public.mv_genre_counts mv
        WHERE mv.app_type = p_type
        ORDER BY mv.app_count DESC, mv.genre_name;
      END IF;
    END IF;

  ELSIF p_filter_type = 'tag' THEN
    IF v_has_metric_filters THEN
      RETURN QUERY
      SELECT
        ast.tag_id::INT AS option_id,
        st.name::TEXT AS option_name,
        COUNT(*)::BIGINT AS app_count
      FROM public.app_steam_tags ast
      JOIN public.steam_tags st ON st.tag_id = ast.tag_id
      JOIN public.apps a ON a.appid = ast.appid
      LEFT JOIN public.latest_daily_metrics ldm ON ldm.appid = a.appid
      WHERE a.is_released = TRUE
        AND a.is_delisted = FALSE
        AND (p_type = 'all' OR a.type::TEXT = p_type)
        AND (p_min_ccu IS NULL OR ldm.ccu_peak >= p_min_ccu)
        AND (p_min_reviews IS NULL OR ldm.total_reviews >= p_min_reviews)
        AND (p_min_score IS NULL OR ldm.review_score >= p_min_score)
        AND (p_min_owners IS NULL OR ldm.owners_midpoint >= p_min_owners)
      GROUP BY ast.tag_id, st.name
      ORDER BY app_count DESC, option_name
      LIMIT 150;
    ELSE
      IF p_type = 'all' THEN
        RETURN QUERY
        SELECT
          mv.tag_id::INT AS option_id,
          mv.tag_name::TEXT AS option_name,
          SUM(mv.app_count)::BIGINT AS app_count
        FROM public.mv_tag_counts mv
        GROUP BY mv.tag_id, mv.tag_name
        ORDER BY app_count DESC, option_name
        LIMIT 150;
      ELSE
        RETURN QUERY
        SELECT
          mv.tag_id::INT AS option_id,
          mv.tag_name::TEXT AS option_name,
          mv.app_count::BIGINT
        FROM public.mv_tag_counts mv
        WHERE mv.app_type = p_type
        ORDER BY mv.app_count DESC, mv.tag_name
        LIMIT 150;
      END IF;
    END IF;

  ELSIF p_filter_type = 'category' THEN
    IF v_has_metric_filters THEN
      RETURN QUERY
      SELECT
        ac.category_id::INT AS option_id,
        sc.name::TEXT AS option_name,
        COUNT(*)::BIGINT AS app_count
      FROM public.app_categories ac
      JOIN public.steam_categories sc ON sc.category_id = ac.category_id
      JOIN public.apps a ON a.appid = ac.appid
      LEFT JOIN public.latest_daily_metrics ldm ON ldm.appid = a.appid
      WHERE a.is_released = TRUE
        AND a.is_delisted = FALSE
        AND (p_type = 'all' OR a.type::TEXT = p_type)
        AND (p_min_ccu IS NULL OR ldm.ccu_peak >= p_min_ccu)
        AND (p_min_reviews IS NULL OR ldm.total_reviews >= p_min_reviews)
        AND (p_min_score IS NULL OR ldm.review_score >= p_min_score)
        AND (p_min_owners IS NULL OR ldm.owners_midpoint >= p_min_owners)
      GROUP BY ac.category_id, sc.name
      ORDER BY app_count DESC, option_name;
    ELSE
      IF p_type = 'all' THEN
        RETURN QUERY
        SELECT
          mv.category_id::INT AS option_id,
          mv.category_name::TEXT AS option_name,
          SUM(mv.app_count)::BIGINT AS app_count
        FROM public.mv_category_counts mv
        GROUP BY mv.category_id, mv.category_name
        ORDER BY app_count DESC, option_name;
      ELSE
        RETURN QUERY
        SELECT
          mv.category_id::INT AS option_id,
          mv.category_name::TEXT AS option_name,
          mv.app_count::BIGINT
        FROM public.mv_category_counts mv
        WHERE mv.app_type = p_type
        ORDER BY mv.app_count DESC, mv.category_name;
      END IF;
    END IF;

  ELSIF p_filter_type = 'steam_deck' THEN
    IF v_has_metric_filters THEN
      RETURN QUERY
      SELECT
        ROW_NUMBER() OVER (ORDER BY asd.category)::INT AS option_id,
        asd.category::TEXT AS option_name,
        COUNT(*)::BIGINT AS app_count
      FROM public.app_steam_deck asd
      JOIN public.apps a ON a.appid = asd.appid
      LEFT JOIN public.latest_daily_metrics ldm ON ldm.appid = a.appid
      WHERE a.is_released = TRUE
        AND a.is_delisted = FALSE
        AND (p_type = 'all' OR a.type::TEXT = p_type)
        AND (p_min_ccu IS NULL OR ldm.ccu_peak >= p_min_ccu)
        AND (p_min_reviews IS NULL OR ldm.total_reviews >= p_min_reviews)
        AND (p_min_score IS NULL OR ldm.review_score >= p_min_score)
        AND (p_min_owners IS NULL OR ldm.owners_midpoint >= p_min_owners)
        AND asd.category IS NOT NULL
      GROUP BY asd.category
      ORDER BY app_count DESC;
    ELSE
      IF p_type = 'all' THEN
        RETURN QUERY
        SELECT
          ROW_NUMBER() OVER (ORDER BY mv.steam_deck_category)::INT AS option_id,
          mv.steam_deck_category::TEXT AS option_name,
          SUM(mv.app_count)::BIGINT AS app_count
        FROM public.mv_steam_deck_counts mv
        GROUP BY mv.steam_deck_category
        ORDER BY app_count DESC;
      ELSE
        RETURN QUERY
        SELECT
          ROW_NUMBER() OVER (ORDER BY mv.steam_deck_category)::INT AS option_id,
          mv.steam_deck_category::TEXT AS option_name,
          mv.app_count::BIGINT
        FROM public.mv_steam_deck_counts mv
        WHERE mv.app_type = p_type
        ORDER BY mv.app_count DESC;
      END IF;
    END IF;

  ELSIF p_filter_type = 'ccu_tier' THEN
    IF v_has_metric_filters THEN
      RETURN QUERY
      SELECT
        ct.ccu_tier::INT AS option_id,
        CASE ct.ccu_tier
          WHEN 1 THEN 'Hot (Tier 1)'
          WHEN 2 THEN 'Active (Tier 2)'
          WHEN 3 THEN 'Quiet (Tier 3)'
        END::TEXT AS option_name,
        COUNT(*)::BIGINT AS app_count
      FROM public.ccu_tier_assignments ct
      JOIN public.apps a ON a.appid = ct.appid
      LEFT JOIN public.latest_daily_metrics ldm ON ldm.appid = a.appid
      WHERE a.is_released = TRUE
        AND a.is_delisted = FALSE
        AND (p_type = 'all' OR a.type::TEXT = p_type)
        AND (p_min_ccu IS NULL OR ldm.ccu_peak >= p_min_ccu)
        AND (p_min_reviews IS NULL OR ldm.total_reviews >= p_min_reviews)
        AND (p_min_score IS NULL OR ldm.review_score >= p_min_score)
        AND (p_min_owners IS NULL OR ldm.owners_midpoint >= p_min_owners)
      GROUP BY ct.ccu_tier
      ORDER BY ct.ccu_tier;
    ELSE
      IF p_type = 'all' THEN
        RETURN QUERY
        SELECT
          mv.ccu_tier::INT AS option_id,
          CASE mv.ccu_tier
            WHEN 1 THEN 'Hot (Tier 1)'
            WHEN 2 THEN 'Active (Tier 2)'
            WHEN 3 THEN 'Quiet (Tier 3)'
          END::TEXT AS option_name,
          SUM(mv.app_count)::BIGINT AS app_count
        FROM public.mv_ccu_tier_counts mv
        GROUP BY mv.ccu_tier
        ORDER BY mv.ccu_tier;
      ELSE
        RETURN QUERY
        SELECT
          mv.ccu_tier::INT AS option_id,
          CASE mv.ccu_tier
            WHEN 1 THEN 'Hot (Tier 1)'
            WHEN 2 THEN 'Active (Tier 2)'
            WHEN 3 THEN 'Quiet (Tier 3)'
          END::TEXT AS option_name,
          mv.app_count::BIGINT
        FROM public.mv_ccu_tier_counts mv
        WHERE mv.app_type = p_type
        ORDER BY mv.ccu_tier;
      END IF;
    END IF;

  ELSIF p_filter_type = 'velocity_tier' THEN
    IF v_has_metric_filters THEN
      RETURN QUERY
      SELECT
        ROW_NUMBER() OVER (
          ORDER BY CASE rvs.velocity_tier
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
            WHEN 'dormant' THEN 4
          END
        )::INT AS option_id,
        rvs.velocity_tier::TEXT AS option_name,
        COUNT(*)::BIGINT AS app_count
      FROM public.review_velocity_stats rvs
      JOIN public.apps a ON a.appid = rvs.appid
      LEFT JOIN public.latest_daily_metrics ldm ON ldm.appid = a.appid
      WHERE a.is_released = TRUE
        AND a.is_delisted = FALSE
        AND (p_type = 'all' OR a.type::TEXT = p_type)
        AND (p_min_ccu IS NULL OR ldm.ccu_peak >= p_min_ccu)
        AND (p_min_reviews IS NULL OR ldm.total_reviews >= p_min_reviews)
        AND (p_min_score IS NULL OR ldm.review_score >= p_min_score)
        AND (p_min_owners IS NULL OR ldm.owners_midpoint >= p_min_owners)
        AND rvs.velocity_tier IS NOT NULL
      GROUP BY rvs.velocity_tier
      ORDER BY CASE rvs.velocity_tier
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
        WHEN 'dormant' THEN 4
      END;
    ELSE
      IF p_type = 'all' THEN
        RETURN QUERY
        SELECT
          ROW_NUMBER() OVER (
            ORDER BY CASE mv.velocity_tier
              WHEN 'high' THEN 1
              WHEN 'medium' THEN 2
              WHEN 'low' THEN 3
              WHEN 'dormant' THEN 4
            END
          )::INT AS option_id,
          mv.velocity_tier::TEXT AS option_name,
          SUM(mv.app_count)::BIGINT AS app_count
        FROM public.mv_velocity_tier_counts mv
        GROUP BY mv.velocity_tier
        ORDER BY CASE mv.velocity_tier
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          WHEN 'dormant' THEN 4
        END;
      ELSE
        RETURN QUERY
        SELECT
          ROW_NUMBER() OVER (
            ORDER BY CASE mv.velocity_tier
              WHEN 'high' THEN 1
              WHEN 'medium' THEN 2
              WHEN 'low' THEN 3
              WHEN 'dormant' THEN 4
            END
          )::INT AS option_id,
          mv.velocity_tier::TEXT AS option_name,
          mv.app_count::BIGINT
        FROM public.mv_velocity_tier_counts mv
        WHERE mv.app_type = p_type
        ORDER BY CASE mv.velocity_tier
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          WHEN 'dormant' THEN 4
        END;
      END IF;
    END IF;

  ELSE
    RETURN;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_apps_filter_option_counts(TEXT, TEXT, INTEGER, INTEGER, INTEGER, BIGINT) IS
  'Optimized filter option counts with a direct Steam Deck slow-path fix for app_steam_deck.category.';

-- ---------------------------------------------------------------------------
-- Fix stale company metrics RPCs against the current materialized view schema
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_developers_with_metrics(
  p_search TEXT DEFAULT NULL,
  p_min_owners BIGINT DEFAULT NULL,
  p_min_ccu BIGINT DEFAULT NULL,
  p_min_score SMALLINT DEFAULT NULL,
  p_min_games INTEGER DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_sort_field TEXT DEFAULT 'game_count',
  p_sort_order TEXT DEFAULT 'desc',
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  normalized_name TEXT,
  steam_vanity_url TEXT,
  first_game_release_date DATE,
  game_count INTEGER,
  total_owners_min BIGINT,
  total_owners_max BIGINT,
  total_ccu_peak BIGINT,
  max_ccu_peak INTEGER,
  total_reviews BIGINT,
  weighted_review_score SMALLINT,
  estimated_revenue_usd BIGINT,
  games_trending_up INTEGER,
  games_trending_down INTEGER,
  games_released_last_year INTEGER,
  computed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.name,
    d.normalized_name,
    d.steam_vanity_url,
    d.first_game_release_date,
    d.game_count,
    COALESCE(dm.total_owners, 0)::BIGINT AS total_owners_min,
    COALESCE(dm.total_owners, 0)::BIGINT AS total_owners_max,
    COALESCE(dm.total_ccu, 0)::BIGINT AS total_ccu_peak,
    COALESCE(dm.total_ccu, 0)::INTEGER AS max_ccu_peak,
    COALESCE(dm.total_reviews, 0)::BIGINT,
    CASE
      WHEN dm.avg_review_score IS NULL THEN NULL
      ELSE ROUND(dm.avg_review_score)::SMALLINT
    END AS weighted_review_score,
    COALESCE(ROUND(dm.revenue_estimate_cents::NUMERIC / 100), 0)::BIGINT AS estimated_revenue_usd,
    COALESCE(dm.games_trending_up, 0)::INTEGER,
    COALESCE(dm.games_trending_down, 0)::INTEGER,
    COALESCE(dm.games_released_last_year, 0)::INTEGER,
    dm.computed_at
  FROM public.developers d
  LEFT JOIN public.developer_metrics dm ON dm.developer_id = d.id
  WHERE
    (p_search IS NULL OR d.name ILIKE '%' || p_search || '%')
    AND (p_min_owners IS NULL OR COALESCE(dm.total_owners, 0) >= p_min_owners)
    AND (p_min_ccu IS NULL OR COALESCE(dm.total_ccu, 0) >= p_min_ccu)
    AND (
      p_min_score IS NULL
      OR COALESCE(ROUND(dm.avg_review_score), 0) >= p_min_score
    )
    AND (p_min_games IS NULL OR d.game_count >= p_min_games)
    AND (
      p_status IS NULL
      OR (p_status = 'active' AND COALESCE(dm.games_released_last_year, 0) > 0)
      OR (p_status = 'dormant' AND COALESCE(dm.games_released_last_year, 0) = 0)
    )
  ORDER BY
    CASE
      WHEN p_sort_order = 'asc' AND p_sort_field = 'name' THEN d.name
      ELSE NULL
    END ASC NULLS LAST,
    CASE
      WHEN p_sort_order = 'desc' AND p_sort_field = 'name' THEN d.name
      ELSE NULL
    END DESC NULLS LAST,
    CASE
      WHEN p_sort_order = 'asc' AND p_sort_field = 'first_game_release_date' THEN d.first_game_release_date
      ELSE NULL
    END ASC NULLS LAST,
    CASE
      WHEN p_sort_order = 'desc' AND p_sort_field = 'first_game_release_date' THEN d.first_game_release_date
      ELSE NULL
    END DESC NULLS LAST,
    CASE
      WHEN p_sort_order = 'asc' THEN
        CASE p_sort_field
          WHEN 'game_count' THEN d.game_count::NUMERIC
          WHEN 'total_owners_max' THEN COALESCE(dm.total_owners, 0)::NUMERIC
          WHEN 'total_ccu_peak' THEN COALESCE(dm.total_ccu, 0)::NUMERIC
          WHEN 'weighted_review_score' THEN COALESCE(ROUND(dm.avg_review_score), 0)::NUMERIC
          WHEN 'estimated_revenue_usd' THEN COALESCE(ROUND(dm.revenue_estimate_cents::NUMERIC / 100), 0)
          WHEN 'games_trending_up' THEN COALESCE(dm.games_trending_up, 0)::NUMERIC
          ELSE d.game_count::NUMERIC
        END
      ELSE NULL
    END ASC NULLS LAST,
    CASE
      WHEN p_sort_order = 'desc' THEN
        CASE p_sort_field
          WHEN 'game_count' THEN d.game_count::NUMERIC
          WHEN 'total_owners_max' THEN COALESCE(dm.total_owners, 0)::NUMERIC
          WHEN 'total_ccu_peak' THEN COALESCE(dm.total_ccu, 0)::NUMERIC
          WHEN 'weighted_review_score' THEN COALESCE(ROUND(dm.avg_review_score), 0)::NUMERIC
          WHEN 'estimated_revenue_usd' THEN COALESCE(ROUND(dm.revenue_estimate_cents::NUMERIC / 100), 0)
          WHEN 'games_trending_up' THEN COALESCE(dm.games_trending_up, 0)::NUMERIC
          ELSE d.game_count::NUMERIC
        END
      ELSE NULL
    END DESC NULLS LAST,
    d.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_publishers_with_metrics(
  p_search TEXT DEFAULT NULL,
  p_min_owners BIGINT DEFAULT NULL,
  p_min_ccu BIGINT DEFAULT NULL,
  p_min_score SMALLINT DEFAULT NULL,
  p_min_games INTEGER DEFAULT NULL,
  p_min_developers INTEGER DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_sort_field TEXT DEFAULT 'game_count',
  p_sort_order TEXT DEFAULT 'desc',
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  normalized_name TEXT,
  steam_vanity_url TEXT,
  first_game_release_date DATE,
  game_count INTEGER,
  total_owners_min BIGINT,
  total_owners_max BIGINT,
  total_ccu_peak BIGINT,
  max_ccu_peak INTEGER,
  total_reviews BIGINT,
  weighted_review_score SMALLINT,
  estimated_revenue_usd BIGINT,
  games_trending_up INTEGER,
  games_trending_down INTEGER,
  games_released_last_year INTEGER,
  unique_developers INTEGER,
  computed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.normalized_name,
    p.steam_vanity_url,
    p.first_game_release_date,
    p.game_count,
    COALESCE(pm.total_owners, 0)::BIGINT AS total_owners_min,
    COALESCE(pm.total_owners, 0)::BIGINT AS total_owners_max,
    COALESCE(pm.total_ccu, 0)::BIGINT AS total_ccu_peak,
    COALESCE(pm.total_ccu, 0)::INTEGER AS max_ccu_peak,
    COALESCE(pm.total_reviews, 0)::BIGINT,
    CASE
      WHEN pm.avg_review_score IS NULL THEN NULL
      ELSE ROUND(pm.avg_review_score)::SMALLINT
    END AS weighted_review_score,
    COALESCE(ROUND(pm.revenue_estimate_cents::NUMERIC / 100), 0)::BIGINT AS estimated_revenue_usd,
    COALESCE(pm.games_trending_up, 0)::INTEGER,
    COALESCE(pm.games_trending_down, 0)::INTEGER,
    COALESCE(pm.games_released_last_year, 0)::INTEGER,
    COALESCE(pm.unique_developers, 0)::INTEGER,
    pm.computed_at
  FROM public.publishers p
  LEFT JOIN public.publisher_metrics pm ON pm.publisher_id = p.id
  WHERE
    (p_search IS NULL OR p.name ILIKE '%' || p_search || '%')
    AND (p_min_owners IS NULL OR COALESCE(pm.total_owners, 0) >= p_min_owners)
    AND (p_min_ccu IS NULL OR COALESCE(pm.total_ccu, 0) >= p_min_ccu)
    AND (
      p_min_score IS NULL
      OR COALESCE(ROUND(pm.avg_review_score), 0) >= p_min_score
    )
    AND (p_min_games IS NULL OR p.game_count >= p_min_games)
    AND (p_min_developers IS NULL OR COALESCE(pm.unique_developers, 0) >= p_min_developers)
    AND (
      p_status IS NULL
      OR (p_status = 'active' AND COALESCE(pm.games_released_last_year, 0) > 0)
      OR (p_status = 'dormant' AND COALESCE(pm.games_released_last_year, 0) = 0)
    )
  ORDER BY
    CASE
      WHEN p_sort_order = 'asc' AND p_sort_field = 'name' THEN p.name
      ELSE NULL
    END ASC NULLS LAST,
    CASE
      WHEN p_sort_order = 'desc' AND p_sort_field = 'name' THEN p.name
      ELSE NULL
    END DESC NULLS LAST,
    CASE
      WHEN p_sort_order = 'asc' AND p_sort_field = 'first_game_release_date' THEN p.first_game_release_date
      ELSE NULL
    END ASC NULLS LAST,
    CASE
      WHEN p_sort_order = 'desc' AND p_sort_field = 'first_game_release_date' THEN p.first_game_release_date
      ELSE NULL
    END DESC NULLS LAST,
    CASE
      WHEN p_sort_order = 'asc' THEN
        CASE p_sort_field
          WHEN 'game_count' THEN p.game_count::NUMERIC
          WHEN 'total_owners_max' THEN COALESCE(pm.total_owners, 0)::NUMERIC
          WHEN 'total_ccu_peak' THEN COALESCE(pm.total_ccu, 0)::NUMERIC
          WHEN 'weighted_review_score' THEN COALESCE(ROUND(pm.avg_review_score), 0)::NUMERIC
          WHEN 'estimated_revenue_usd' THEN COALESCE(ROUND(pm.revenue_estimate_cents::NUMERIC / 100), 0)
          WHEN 'games_trending_up' THEN COALESCE(pm.games_trending_up, 0)::NUMERIC
          WHEN 'unique_developers' THEN COALESCE(pm.unique_developers, 0)::NUMERIC
          ELSE p.game_count::NUMERIC
        END
      ELSE NULL
    END ASC NULLS LAST,
    CASE
      WHEN p_sort_order = 'desc' THEN
        CASE p_sort_field
          WHEN 'game_count' THEN p.game_count::NUMERIC
          WHEN 'total_owners_max' THEN COALESCE(pm.total_owners, 0)::NUMERIC
          WHEN 'total_ccu_peak' THEN COALESCE(pm.total_ccu, 0)::NUMERIC
          WHEN 'weighted_review_score' THEN COALESCE(ROUND(pm.avg_review_score), 0)::NUMERIC
          WHEN 'estimated_revenue_usd' THEN COALESCE(ROUND(pm.revenue_estimate_cents::NUMERIC / 100), 0)
          WHEN 'games_trending_up' THEN COALESCE(pm.games_trending_up, 0)::NUMERIC
          WHEN 'unique_developers' THEN COALESCE(pm.unique_developers, 0)::NUMERIC
          ELSE p.game_count::NUMERIC
        END
      ELSE NULL
    END DESC NULLS LAST,
    p.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ---------------------------------------------------------------------------
-- Fix stale admin dashboard source completion RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_source_completion_stats()
RETURNS TABLE(
  source TEXT,
  total_apps BIGINT,
  synced_apps BIGINT,
  stale_apps BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total BIGINT;
  v_steamspy_total BIGINT;
  v_one_day_ago TIMESTAMPTZ := NOW() - INTERVAL '1 day';
  v_seven_days_ago TIMESTAMPTZ := NOW() - INTERVAL '7 days';
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM public.sync_status
  WHERE is_syncable = TRUE;

  SELECT COUNT(*) INTO v_steamspy_total
  FROM public.sync_status
  WHERE is_syncable = TRUE
    AND (steamspy_available IS NULL OR steamspy_available = TRUE);

  RETURN QUERY
  SELECT
    'steamspy'::TEXT,
    v_steamspy_total,
    (
      SELECT COUNT(*)
      FROM public.sync_status
      WHERE is_syncable = TRUE
        AND (steamspy_available IS NULL OR steamspy_available = TRUE)
        AND last_steamspy_sync IS NOT NULL
    ),
    (
      SELECT COUNT(*)
      FROM public.sync_status
      WHERE is_syncable = TRUE
        AND (steamspy_available IS NULL OR steamspy_available = TRUE)
        AND last_steamspy_sync IS NOT NULL
        AND last_steamspy_sync < v_one_day_ago
    )
  UNION ALL
  SELECT
    'storefront'::TEXT,
    v_total,
    (
      SELECT COUNT(*)
      FROM public.sync_status
      WHERE is_syncable = TRUE
        AND last_storefront_sync IS NOT NULL
    ),
    (
      SELECT COUNT(*)
      FROM public.sync_status
      WHERE is_syncable = TRUE
        AND last_storefront_sync IS NOT NULL
        AND last_storefront_sync < v_one_day_ago
    )
  UNION ALL
  SELECT
    'reviews'::TEXT,
    v_total,
    (
      SELECT COUNT(*)
      FROM public.sync_status
      WHERE is_syncable = TRUE
        AND last_reviews_sync IS NOT NULL
    ),
    (
      SELECT COUNT(*)
      FROM public.sync_status
      WHERE is_syncable = TRUE
        AND last_reviews_sync IS NOT NULL
        AND last_reviews_sync < v_one_day_ago
    )
  UNION ALL
  SELECT
    'histogram'::TEXT,
    v_total,
    (
      SELECT COUNT(*)
      FROM public.sync_status
      WHERE is_syncable = TRUE
        AND last_histogram_sync IS NOT NULL
    ),
    (
      SELECT COUNT(*)
      FROM public.sync_status
      WHERE is_syncable = TRUE
        AND last_histogram_sync IS NOT NULL
        AND last_histogram_sync < v_seven_days_ago
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- Harden pin and credit RPCs without changing response contracts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_pins_with_metrics(p_user_id UUID)
RETURNS TABLE (
  pin_id UUID,
  entity_type entity_type,
  entity_id INTEGER,
  display_name TEXT,
  pin_order INTEGER,
  pinned_at TIMESTAMPTZ,
  ccu_current INTEGER,
  ccu_change_pct DECIMAL,
  total_reviews INTEGER,
  positive_pct DECIMAL,
  review_velocity DECIMAL,
  trend_direction TEXT,
  price_cents INTEGER,
  discount_percent INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN;
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id != v_caller_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id AS pin_id,
    p.entity_type,
    p.entity_id,
    p.display_name,
    p.pin_order,
    p.pinned_at,
    ldm.ccu_peak AS ccu_current,
    at.trend_30d_change_pct AS ccu_change_pct,
    ldm.total_reviews,
    CASE
      WHEN ldm.total_reviews > 0
        THEN (ldm.positive_reviews::DECIMAL / ldm.total_reviews * 100)::DECIMAL(5,2)
      ELSE NULL
    END AS positive_pct,
    at.review_velocity_7d AS review_velocity,
    at.trend_30d_direction::TEXT AS trend_direction,
    a.current_price_cents AS price_cents,
    a.current_discount_percent AS discount_percent
  FROM public.user_pins p
  LEFT JOIN public.apps a ON p.entity_type = 'game' AND p.entity_id = a.appid
  LEFT JOIN public.latest_daily_metrics ldm ON p.entity_type = 'game' AND p.entity_id = ldm.appid
  LEFT JOIN public.app_trends at ON p.entity_type = 'game' AND p.entity_id = at.appid
  WHERE p.user_id = v_caller_id
  ORDER BY p.pin_order ASC, p.pinned_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_user_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT
)
RETURNS TABLE (success BOOLEAN, new_balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_role user_role;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_type credit_transaction_type;
BEGIN
  v_admin_id := auth.uid();

  IF v_admin_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0::INTEGER;
    RETURN;
  END IF;

  SELECT role INTO v_admin_role
  FROM public.user_profiles
  WHERE id = v_admin_id;

  IF v_admin_role IS NULL OR v_admin_role != 'admin' THEN
    RETURN QUERY SELECT FALSE, 0::INTEGER;
    RETURN;
  END IF;

  SELECT credit_balance INTO v_current_balance
  FROM public.user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN QUERY SELECT FALSE, 0::INTEGER;
    RETURN;
  END IF;

  v_new_balance := GREATEST(0, v_current_balance + p_amount);
  v_type := CASE
    WHEN p_amount >= 0 THEN 'admin_grant'::credit_transaction_type
    ELSE 'admin_deduct'::credit_transaction_type
  END;

  UPDATE public.user_profiles
  SET credit_balance = v_new_balance,
      updated_at = NOW()
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (
    user_id, amount, balance_after, transaction_type, description, admin_user_id
  )
  VALUES (
    p_user_id,
    p_amount,
    v_new_balance,
    v_type,
    p_description,
    v_admin_id
  );

  RETURN QUERY SELECT TRUE, v_new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_credits(
  p_admin_id UUID,
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT
)
RETURNS TABLE (success BOOLEAN, new_balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL OR v_caller_id != p_admin_id THEN
    RETURN QUERY SELECT FALSE, 0::INTEGER;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.admin_adjust_user_credits(p_user_id, p_amount, p_description);
END;
$$;

CREATE OR REPLACE FUNCTION public.execute_readonly_query(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  normalized_query TEXT;
BEGIN
  normalized_query := UPPER(TRIM(query_text));

  IF NOT (normalized_query LIKE 'SELECT%') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  IF normalized_query ~ '\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXECUTE|CALL|COPY|VACUUM|ANALYZE|LOCK)\b' THEN
    RAISE EXCEPTION 'Query contains forbidden keywords';
  END IF;

  IF normalized_query ~ '\b(INFORMATION_SCHEMA|PG_CATALOG)\b'
     OR normalized_query ~ '\bAUTH\.'
     OR normalized_query ~ '\bSTORAGE\.'
     OR normalized_query ~ '\b(USER_PROFILES|WAITLIST|CREDIT_TRANSACTIONS|CREDIT_RESERVATIONS|RATE_LIMIT_STATE|CHAT_QUERY_LOGS|USER_PINS|USER_ALERTS|USER_ALERT_PREFERENCES|USER_PIN_ALERT_SETTINGS|ALERT_DETECTION_STATE)\b' THEN
    RAISE EXCEPTION 'Query references restricted relations';
  END IF;

  EXECUTE
    'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) ' ||
    'FROM (SELECT * FROM (' || query_text || ') AS q LIMIT 50) AS t'
    INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.admin_adjust_user_credits(UUID, INTEGER, TEXT) IS
  'Adjust user credits for the authenticated admin caller only. Uses auth.uid() internally.';

COMMENT ON FUNCTION public.execute_readonly_query(TEXT) IS
  'Safely execute read-only SQL queries for the chat feature behind a server-only service-role boundary.';

-- ---------------------------------------------------------------------------
-- Tighten direct table access to internal/operational surfaces
-- ---------------------------------------------------------------------------

REVOKE ALL PRIVILEGES ON TABLE public.alert_detection_state FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.app_dlc FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.ccu_snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.ccu_tier_assignments FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.dashboard_stats_cache FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.pics_sync_state FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.review_deltas FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.sync_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.sync_status FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.chat_query_logs FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_query_logs FROM anon;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_profiles FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profiles FROM anon;

REVOKE SELECT, UPDATE, DELETE ON TABLE public.waitlist FROM anon;

GRANT SELECT ON TABLE public.chat_query_logs TO authenticated;
GRANT SELECT ON TABLE public.user_profiles TO authenticated;
GRANT INSERT, SELECT, UPDATE ON TABLE public.waitlist TO authenticated;
GRANT INSERT ON TABLE public.waitlist TO anon;

DROP POLICY IF EXISTS "Public can update own pending waitlist entry" ON public.waitlist;

-- ---------------------------------------------------------------------------
-- Convert browser-facing sparkline/filter RPCs to SECURITY DEFINER so the
-- underlying operational tables can remain private.
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.get_app_sparkline_data(INTEGER[], INTEGER) SECURITY DEFINER;
ALTER FUNCTION public.get_app_sparkline_data(INTEGER[], INTEGER) SET search_path = public;

ALTER FUNCTION public.get_company_sparkline_data(INTEGER, TEXT, INTEGER) SECURITY DEFINER;
ALTER FUNCTION public.get_company_sparkline_data(INTEGER, TEXT, INTEGER) SET search_path = public;

ALTER FUNCTION public.get_apps_filter_option_counts(TEXT, TEXT, INTEGER, INTEGER, INTEGER, BIGINT) SECURITY DEFINER;
ALTER FUNCTION public.get_apps_filter_option_counts(TEXT, TEXT, INTEGER, INTEGER, INTEGER, BIGINT) SET search_path = public;

-- ---------------------------------------------------------------------------
-- Harden remaining SECURITY DEFINER functions with explicit search_path
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.get_pinned_entities_with_metrics() SET search_path = public;
ALTER FUNCTION public.get_credit_balance(UUID) SET search_path = public;
ALTER FUNCTION public.update_user_profile(TEXT, TEXT) SET search_path = public;
ALTER FUNCTION public.refresh_materialized_view(TEXT) SET search_path = public;
ALTER FUNCTION public.refresh_entity_metrics() SET search_path = public;
ALTER FUNCTION public.refresh_latest_daily_metrics() SET search_path = public;
ALTER FUNCTION public.refresh_monthly_game_metrics() SET search_path = public;
ALTER FUNCTION public.update_alert_detection_state(entity_type, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, INTEGER, INTEGER, INTEGER, TEXT) SET search_path = public;

-- ---------------------------------------------------------------------------
-- Function grant cleanup
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_readonly_query(TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_pinned_entities_with_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pinned_entities_with_metrics() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_pins_with_metrics(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_pins_with_metrics(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_adjust_credits(UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(UUID, UUID, INTEGER, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_adjust_user_credits(UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_user_credits(UUID, INTEGER, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_credit_balance(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_credit_balance(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_user_profile(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile(TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.refresh_materialized_view(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_materialized_view(TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.refresh_entity_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_entity_metrics() TO service_role;

REVOKE EXECUTE ON FUNCTION public.refresh_latest_daily_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_latest_daily_metrics() TO service_role;

REVOKE EXECUTE ON FUNCTION public.refresh_monthly_game_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_monthly_game_metrics() TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_alert_detection_state(entity_type, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_alert_detection_state(entity_type, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, INTEGER, INTEGER, INTEGER, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.recalculate_ccu_tiers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_ccu_tiers() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_priority_distribution() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_priority_distribution() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_queue_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_queue_status() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_source_completion_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_source_completion_stats() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_pics_data_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pics_data_stats() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_app_sparkline_data(INTEGER[], INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_sparkline_data(INTEGER[], INTEGER) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_company_sparkline_data(INTEGER, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_sparkline_data(INTEGER, TEXT, INTEGER) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_apps_filter_option_counts(TEXT, TEXT, INTEGER, INTEGER, INTEGER, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_apps_filter_option_counts(TEXT, TEXT, INTEGER, INTEGER, INTEGER, BIGINT) TO authenticated, service_role;
