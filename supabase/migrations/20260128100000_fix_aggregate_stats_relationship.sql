-- Migration: Add relationship filter to aggregate stats
-- Date: 2026-01-28
--
-- Fixes:
--   BUG #2: Aggregate stats missing relationship filter parameter
--           (aggregate stats don't match list results when relationship filter active)
--
-- Also adds missing parameters from the main RPC:
--   - p_platforms (placeholder)
--   - p_platform_mode (placeholder)
--   - p_min_growth_7d, p_max_growth_7d
--   - p_min_growth_30d, p_max_growth_30d
--   - p_relationship

-- ============================================================================
-- Drop existing function overloads
-- ============================================================================

-- Drop older version from 20260115200000 migration (22 params, no platforms/growth)
DROP FUNCTION IF EXISTS get_companies_aggregate_stats(
  TEXT, TEXT, INT, INT, BIGINT, BIGINT, INT, INT, BIGINT, BIGINT, BIGINT, BIGINT, INT, INT, INT, INT, TEXT, INT[], TEXT, INT[], INT[], TEXT
);

-- Drop version without p_relationship (28 params)
DROP FUNCTION IF EXISTS get_companies_aggregate_stats(
  TEXT, TEXT, INT, INT, BIGINT, BIGINT, INT, INT, BIGINT, BIGINT, BIGINT, BIGINT, INT, INT, INT, INT, TEXT, INT[], TEXT, INT[], INT[], TEXT, TEXT[], TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL
);

-- Drop this migration's version if re-running (29 params with p_relationship)
DROP FUNCTION IF EXISTS get_companies_aggregate_stats(
  TEXT, TEXT, INT, INT, BIGINT, BIGINT, INT, INT, BIGINT, BIGINT, BIGINT, BIGINT, INT, INT, INT, INT, TEXT, INT[], TEXT, INT[], INT[], TEXT, TEXT[], TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT
);

-- ============================================================================
-- Recreate with relationship filter support
-- ============================================================================

CREATE OR REPLACE FUNCTION get_companies_aggregate_stats(
  p_type TEXT DEFAULT 'all',
  p_search TEXT DEFAULT NULL,
  p_min_games INT DEFAULT NULL,
  p_max_games INT DEFAULT NULL,
  p_min_owners BIGINT DEFAULT NULL,
  p_max_owners BIGINT DEFAULT NULL,
  p_min_ccu INT DEFAULT NULL,
  p_max_ccu INT DEFAULT NULL,
  p_min_hours BIGINT DEFAULT NULL,
  p_max_hours BIGINT DEFAULT NULL,
  p_min_revenue BIGINT DEFAULT NULL,
  p_max_revenue BIGINT DEFAULT NULL,
  p_min_score INT DEFAULT NULL,
  p_max_score INT DEFAULT NULL,
  p_min_reviews INT DEFAULT NULL,
  p_max_reviews INT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_genres INT[] DEFAULT NULL,
  p_genre_mode TEXT DEFAULT 'any',
  p_tags INT[] DEFAULT NULL,
  p_categories INT[] DEFAULT NULL,
  p_steam_deck TEXT DEFAULT NULL,
  p_platforms TEXT[] DEFAULT NULL,        -- Placeholder for future implementation
  p_platform_mode TEXT DEFAULT 'any',     -- Placeholder for future implementation
  p_min_growth_7d DECIMAL DEFAULT NULL,   -- Placeholder (aggregate doesn't compute growth)
  p_max_growth_7d DECIMAL DEFAULT NULL,
  p_min_growth_30d DECIMAL DEFAULT NULL,
  p_max_growth_30d DECIMAL DEFAULT NULL,
  p_relationship TEXT DEFAULT NULL        -- NEW: Relationship filter
)
RETURNS TABLE (
  total_companies BIGINT,
  total_games BIGINT,
  total_owners BIGINT,
  total_revenue BIGINT,
  avg_review_score DECIMAL,
  total_ccu BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_needs_relationship BOOLEAN;
BEGIN
  v_needs_relationship := (p_relationship IS NOT NULL);

  -- Fast path: No relationship filter
  IF NOT v_needs_relationship THEN
    RETURN QUERY
    WITH base AS (
      SELECT pm.game_count, pm.total_owners, pm.revenue_estimate_cents, pm.avg_review_score, pm.total_ccu,
             pm.estimated_weekly_hours, pm.total_reviews,
             pm.games_released_last_year, p.id, p.name, 'publisher'::TEXT AS type,
             pm.genre_ids, pm.tag_ids, pm.category_ids, pm.best_steam_deck_category
      FROM publishers p LEFT JOIN publisher_metrics pm ON pm.publisher_id = p.id
      WHERE (p_type = 'all' OR p_type = 'publisher') AND p.game_count > 0
      UNION ALL
      SELECT dm.game_count, dm.total_owners, dm.revenue_estimate_cents, dm.avg_review_score, dm.total_ccu,
             dm.estimated_weekly_hours, dm.total_reviews,
             dm.games_released_last_year, d.id, d.name, 'developer'::TEXT,
             dm.genre_ids, dm.tag_ids, dm.category_ids, dm.best_steam_deck_category
      FROM developers d LEFT JOIN developer_metrics dm ON dm.developer_id = d.id
      WHERE (p_type = 'all' OR p_type = 'developer') AND d.game_count > 0
    ),
    filtered AS (
      SELECT b.* FROM base b
      WHERE (p_search IS NULL OR b.name ILIKE '%' || p_search || '%')
        AND (p_min_games IS NULL OR b.game_count >= p_min_games)
        AND (p_max_games IS NULL OR b.game_count <= p_max_games)
        AND (p_min_owners IS NULL OR b.total_owners >= p_min_owners)
        AND (p_max_owners IS NULL OR b.total_owners <= p_max_owners)
        AND (p_min_ccu IS NULL OR b.total_ccu >= p_min_ccu)
        AND (p_max_ccu IS NULL OR b.total_ccu <= p_max_ccu)
        AND (p_min_hours IS NULL OR b.estimated_weekly_hours >= p_min_hours)
        AND (p_max_hours IS NULL OR b.estimated_weekly_hours <= p_max_hours)
        AND (p_min_revenue IS NULL OR b.revenue_estimate_cents >= p_min_revenue)
        AND (p_max_revenue IS NULL OR b.revenue_estimate_cents <= p_max_revenue)
        AND (p_min_score IS NULL OR b.avg_review_score >= p_min_score)
        AND (p_max_score IS NULL OR b.avg_review_score <= p_max_score)
        AND (p_min_reviews IS NULL OR b.total_reviews >= p_min_reviews)
        AND (p_max_reviews IS NULL OR b.total_reviews <= p_max_reviews)
        AND (p_status IS NULL
             OR (p_status = 'active' AND b.games_released_last_year > 0)
             OR (p_status = 'dormant' AND COALESCE(b.games_released_last_year, 0) = 0))
        AND (p_genres IS NULL OR (
          CASE p_genre_mode
            WHEN 'all' THEN b.genre_ids @> p_genres
            ELSE b.genre_ids && p_genres
          END
        ))
        AND (p_tags IS NULL OR b.tag_ids && p_tags)
        AND (p_categories IS NULL OR b.category_ids && p_categories)
        AND (p_steam_deck IS NULL OR (
          CASE p_steam_deck
            WHEN 'verified' THEN b.best_steam_deck_category = 'verified'
            WHEN 'playable' THEN b.best_steam_deck_category IN ('verified', 'playable')
            ELSE b.best_steam_deck_category IS NOT NULL
          END
        ))
    )
    SELECT COUNT(*)::BIGINT, COALESCE(SUM(f.game_count), 0)::BIGINT, COALESCE(SUM(f.total_owners), 0)::BIGINT,
           COALESCE(SUM(f.revenue_estimate_cents), 0)::BIGINT, ROUND(AVG(f.avg_review_score), 1)::DECIMAL,
           COALESCE(SUM(f.total_ccu), 0)::BIGINT
    FROM filtered f;

  -- Slow path: Relationship filter requires computing is_self_published per company
  ELSE
    RETURN QUERY
    WITH base AS (
      SELECT pm.game_count, pm.total_owners, pm.revenue_estimate_cents, pm.avg_review_score, pm.total_ccu,
             pm.estimated_weekly_hours, pm.total_reviews,
             pm.games_released_last_year, p.id, p.name, 'publisher'::TEXT AS type,
             pm.genre_ids, pm.tag_ids, pm.category_ids, pm.best_steam_deck_category
      FROM publishers p LEFT JOIN publisher_metrics pm ON pm.publisher_id = p.id
      WHERE (p_type = 'all' OR p_type = 'publisher') AND p.game_count > 0
      UNION ALL
      SELECT dm.game_count, dm.total_owners, dm.revenue_estimate_cents, dm.avg_review_score, dm.total_ccu,
             dm.estimated_weekly_hours, dm.total_reviews,
             dm.games_released_last_year, d.id, d.name, 'developer'::TEXT,
             dm.genre_ids, dm.tag_ids, dm.category_ids, dm.best_steam_deck_category
      FROM developers d LEFT JOIN developer_metrics dm ON dm.developer_id = d.id
      WHERE (p_type = 'all' OR p_type = 'developer') AND d.game_count > 0
    ),
    filtered AS (
      SELECT b.* FROM base b
      WHERE (p_search IS NULL OR b.name ILIKE '%' || p_search || '%')
        AND (p_min_games IS NULL OR b.game_count >= p_min_games)
        AND (p_max_games IS NULL OR b.game_count <= p_max_games)
        AND (p_min_owners IS NULL OR b.total_owners >= p_min_owners)
        AND (p_max_owners IS NULL OR b.total_owners <= p_max_owners)
        AND (p_min_ccu IS NULL OR b.total_ccu >= p_min_ccu)
        AND (p_max_ccu IS NULL OR b.total_ccu <= p_max_ccu)
        AND (p_min_hours IS NULL OR b.estimated_weekly_hours >= p_min_hours)
        AND (p_max_hours IS NULL OR b.estimated_weekly_hours <= p_max_hours)
        AND (p_min_revenue IS NULL OR b.revenue_estimate_cents >= p_min_revenue)
        AND (p_max_revenue IS NULL OR b.revenue_estimate_cents <= p_max_revenue)
        AND (p_min_score IS NULL OR b.avg_review_score >= p_min_score)
        AND (p_max_score IS NULL OR b.avg_review_score <= p_max_score)
        AND (p_min_reviews IS NULL OR b.total_reviews >= p_min_reviews)
        AND (p_max_reviews IS NULL OR b.total_reviews <= p_max_reviews)
        AND (p_status IS NULL
             OR (p_status = 'active' AND b.games_released_last_year > 0)
             OR (p_status = 'dormant' AND COALESCE(b.games_released_last_year, 0) = 0))
        AND (p_genres IS NULL OR (
          CASE p_genre_mode
            WHEN 'all' THEN b.genre_ids @> p_genres
            ELSE b.genre_ids && p_genres
          END
        ))
        AND (p_tags IS NULL OR b.tag_ids && p_tags)
        AND (p_categories IS NULL OR b.category_ids && p_categories)
        AND (p_steam_deck IS NULL OR (
          CASE p_steam_deck
            WHEN 'verified' THEN b.best_steam_deck_category = 'verified'
            WHEN 'playable' THEN b.best_steam_deck_category IN ('verified', 'playable')
            ELSE b.best_steam_deck_category IS NOT NULL
          END
        ))
    ),
    -- Compute relationship flags (same logic as main RPC slow path)
    with_relationships AS (
      SELECT f.*,
        CASE WHEN f.type = 'publisher' THEN
          NOT EXISTS (SELECT 1 FROM app_publishers ap JOIN publishers pub ON pub.id = ap.publisher_id
                      WHERE ap.publisher_id = f.id AND NOT EXISTS (
                        SELECT 1 FROM app_developers ad JOIN developers dev ON dev.id = ad.developer_id
                        WHERE ad.appid = ap.appid AND LOWER(TRIM(dev.name)) = LOWER(TRIM(pub.name))))
        ELSE NOT EXISTS (SELECT 1 FROM app_developers ad JOIN developers dev ON dev.id = ad.developer_id
                         WHERE ad.developer_id = f.id AND NOT EXISTS (
                           SELECT 1 FROM app_publishers ap JOIN publishers pub ON pub.id = ap.publisher_id
                           WHERE ap.appid = ad.appid AND LOWER(TRIM(pub.name)) = LOWER(TRIM(dev.name))))
        END AS is_self_pub,
        CASE WHEN f.type = 'publisher' THEN
          (SELECT COUNT(DISTINCT dev.id) FROM app_publishers ap
           JOIN app_developers ad ON ad.appid = ap.appid JOIN developers dev ON dev.id = ad.developer_id
           JOIN publishers pub ON pub.id = ap.publisher_id
           WHERE ap.publisher_id = f.id AND LOWER(TRIM(dev.name)) != LOWER(TRIM(pub.name)))::INT
        ELSE (SELECT COUNT(DISTINCT pub.id) FROM app_developers ad
              JOIN app_publishers ap ON ap.appid = ad.appid JOIN publishers pub ON pub.id = ap.publisher_id
              JOIN developers dev ON dev.id = ad.developer_id
              WHERE ad.developer_id = f.id AND LOWER(TRIM(pub.name)) != LOWER(TRIM(dev.name)))::INT
        END AS ext_partner_count
      FROM filtered f
    ),
    final_filtered AS (
      SELECT * FROM with_relationships wr
      WHERE (p_relationship = 'self_published' AND wr.is_self_pub = TRUE)
         OR (p_relationship = 'external_devs' AND wr.is_self_pub = FALSE AND wr.type = 'publisher')
         OR (p_relationship = 'multi_publisher' AND wr.ext_partner_count > 1 AND wr.type = 'developer')
    )
    SELECT COUNT(*)::BIGINT, COALESCE(SUM(ff.game_count), 0)::BIGINT, COALESCE(SUM(ff.total_owners), 0)::BIGINT,
           COALESCE(SUM(ff.revenue_estimate_cents), 0)::BIGINT, ROUND(AVG(ff.avg_review_score), 1)::DECIMAL,
           COALESCE(SUM(ff.total_ccu), 0)::BIGINT
    FROM final_filtered ff;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_companies_aggregate_stats(
  TEXT, TEXT, INT, INT, BIGINT, BIGINT, INT, INT, BIGINT, BIGINT, BIGINT, BIGINT, INT, INT, INT, INT, TEXT, INT[], TEXT, INT[], INT[], TEXT, TEXT[], TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT
) IS 'Returns aggregate stats for filtered companies. Added relationship filter support (BUG #2 fix).
Note: Growth filters are placeholders - aggregate stats do not compute per-company growth.';
