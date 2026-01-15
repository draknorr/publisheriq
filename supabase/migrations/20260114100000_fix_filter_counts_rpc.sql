-- Fix get_filter_option_counts RPC - Optimized with aggregate approach
-- Performance: Uses GROUP BY aggregation instead of correlated subqueries
-- ~2-4 seconds instead of 11+ seconds

CREATE OR REPLACE FUNCTION get_filter_option_counts(
  p_filter_type TEXT,
  p_company_type TEXT DEFAULT 'all',
  p_min_games INT DEFAULT NULL,
  p_min_revenue BIGINT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (option_id INT, option_name TEXT, company_count BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
BEGIN
  -- GENRE filter
  IF p_filter_type = 'genre' THEN
    RETURN QUERY
    WITH valid_publishers AS (
      SELECT p.id FROM publishers p
      LEFT JOIN publisher_metrics pm ON pm.publisher_id = p.id
      WHERE p_company_type IN ('all', 'publisher')
        AND (p_min_games IS NULL OR p.game_count >= p_min_games)
        AND (p_min_revenue IS NULL OR COALESCE(pm.revenue_estimate_cents, 0) >= p_min_revenue)
        AND (p_status IS NULL
             OR (p_status = 'active' AND COALESCE(pm.games_released_last_year, 0) > 0)
             OR (p_status = 'dormant' AND COALESCE(pm.games_released_last_year, 0) = 0))
    ),
    valid_developers AS (
      SELECT d.id FROM developers d
      LEFT JOIN developer_metrics dm ON dm.developer_id = d.id
      WHERE p_company_type IN ('all', 'developer')
        AND (p_min_games IS NULL OR d.game_count >= p_min_games)
        AND (p_min_revenue IS NULL OR COALESCE(dm.revenue_estimate_cents, 0) >= p_min_revenue)
        AND (p_status IS NULL
             OR (p_status = 'active' AND COALESCE(dm.games_released_last_year, 0) > 0)
             OR (p_status = 'dormant' AND COALESCE(dm.games_released_last_year, 0) = 0))
    ),
    pub_counts AS (
      SELECT ag.genre_id, COUNT(DISTINCT ap.publisher_id) as cnt
      FROM app_genres ag
      JOIN app_publishers ap ON ap.appid = ag.appid
      WHERE ap.publisher_id IN (SELECT id FROM valid_publishers)
      GROUP BY ag.genre_id
    ),
    dev_counts AS (
      SELECT ag.genre_id, COUNT(DISTINCT ad.developer_id) as cnt
      FROM app_genres ag
      JOIN app_developers ad ON ad.appid = ag.appid
      WHERE ad.developer_id IN (SELECT id FROM valid_developers)
      GROUP BY ag.genre_id
    )
    SELECT sg.genre_id, sg.name, (COALESCE(pc.cnt, 0) + COALESCE(dc.cnt, 0))::BIGINT
    FROM steam_genres sg
    LEFT JOIN pub_counts pc ON pc.genre_id = sg.genre_id
    LEFT JOIN dev_counts dc ON dc.genre_id = sg.genre_id
    WHERE EXISTS (SELECT 1 FROM app_genres ag WHERE ag.genre_id = sg.genre_id)
    ORDER BY 3 DESC, 2;

  -- TAG filter
  ELSIF p_filter_type = 'tag' THEN
    RETURN QUERY
    WITH valid_publishers AS (
      SELECT p.id FROM publishers p
      LEFT JOIN publisher_metrics pm ON pm.publisher_id = p.id
      WHERE p_company_type IN ('all', 'publisher')
        AND (p_min_games IS NULL OR p.game_count >= p_min_games)
        AND (p_min_revenue IS NULL OR COALESCE(pm.revenue_estimate_cents, 0) >= p_min_revenue)
        AND (p_status IS NULL
             OR (p_status = 'active' AND COALESCE(pm.games_released_last_year, 0) > 0)
             OR (p_status = 'dormant' AND COALESCE(pm.games_released_last_year, 0) = 0))
    ),
    valid_developers AS (
      SELECT d.id FROM developers d
      LEFT JOIN developer_metrics dm ON dm.developer_id = d.id
      WHERE p_company_type IN ('all', 'developer')
        AND (p_min_games IS NULL OR d.game_count >= p_min_games)
        AND (p_min_revenue IS NULL OR COALESCE(dm.revenue_estimate_cents, 0) >= p_min_revenue)
        AND (p_status IS NULL
             OR (p_status = 'active' AND COALESCE(dm.games_released_last_year, 0) > 0)
             OR (p_status = 'dormant' AND COALESCE(dm.games_released_last_year, 0) = 0))
    ),
    pub_counts AS (
      SELECT ast.tag_id, COUNT(DISTINCT ap.publisher_id) as cnt
      FROM app_steam_tags ast
      JOIN app_publishers ap ON ap.appid = ast.appid
      WHERE ap.publisher_id IN (SELECT id FROM valid_publishers)
      GROUP BY ast.tag_id
    ),
    dev_counts AS (
      SELECT ast.tag_id, COUNT(DISTINCT ad.developer_id) as cnt
      FROM app_steam_tags ast
      JOIN app_developers ad ON ad.appid = ast.appid
      WHERE ad.developer_id IN (SELECT id FROM valid_developers)
      GROUP BY ast.tag_id
    )
    SELECT st.tag_id, st.name, (COALESCE(pc.cnt, 0) + COALESCE(dc.cnt, 0))::BIGINT
    FROM steam_tags st
    LEFT JOIN pub_counts pc ON pc.tag_id = st.tag_id
    LEFT JOIN dev_counts dc ON dc.tag_id = st.tag_id
    WHERE EXISTS (SELECT 1 FROM app_steam_tags ast WHERE ast.tag_id = st.tag_id)
    ORDER BY 3 DESC, 2
    LIMIT 50;

  -- CATEGORY filter
  ELSIF p_filter_type = 'category' THEN
    RETURN QUERY
    WITH valid_publishers AS (
      SELECT p.id FROM publishers p
      LEFT JOIN publisher_metrics pm ON pm.publisher_id = p.id
      WHERE p_company_type IN ('all', 'publisher')
        AND (p_min_games IS NULL OR p.game_count >= p_min_games)
        AND (p_min_revenue IS NULL OR COALESCE(pm.revenue_estimate_cents, 0) >= p_min_revenue)
        AND (p_status IS NULL
             OR (p_status = 'active' AND COALESCE(pm.games_released_last_year, 0) > 0)
             OR (p_status = 'dormant' AND COALESCE(pm.games_released_last_year, 0) = 0))
    ),
    valid_developers AS (
      SELECT d.id FROM developers d
      LEFT JOIN developer_metrics dm ON dm.developer_id = d.id
      WHERE p_company_type IN ('all', 'developer')
        AND (p_min_games IS NULL OR d.game_count >= p_min_games)
        AND (p_min_revenue IS NULL OR COALESCE(dm.revenue_estimate_cents, 0) >= p_min_revenue)
        AND (p_status IS NULL
             OR (p_status = 'active' AND COALESCE(dm.games_released_last_year, 0) > 0)
             OR (p_status = 'dormant' AND COALESCE(dm.games_released_last_year, 0) = 0))
    ),
    pub_counts AS (
      SELECT ac.category_id, COUNT(DISTINCT ap.publisher_id) as cnt
      FROM app_categories ac
      JOIN app_publishers ap ON ap.appid = ac.appid
      WHERE ap.publisher_id IN (SELECT id FROM valid_publishers)
      GROUP BY ac.category_id
    ),
    dev_counts AS (
      SELECT ac.category_id, COUNT(DISTINCT ad.developer_id) as cnt
      FROM app_categories ac
      JOIN app_developers ad ON ad.appid = ac.appid
      WHERE ad.developer_id IN (SELECT id FROM valid_developers)
      GROUP BY ac.category_id
    )
    SELECT sc.category_id, sc.name, (COALESCE(pc.cnt, 0) + COALESCE(dc.cnt, 0))::BIGINT
    FROM steam_categories sc
    LEFT JOIN pub_counts pc ON pc.category_id = sc.category_id
    LEFT JOIN dev_counts dc ON dc.category_id = sc.category_id
    WHERE EXISTS (SELECT 1 FROM app_categories ac WHERE ac.category_id = sc.category_id)
    ORDER BY 3 DESC, 2;

  -- STEAM_DECK filter
  ELSIF p_filter_type = 'steam_deck' THEN
    RETURN QUERY
    WITH valid_publishers AS (
      SELECT p.id FROM publishers p
      LEFT JOIN publisher_metrics pm ON pm.publisher_id = p.id
      WHERE p_company_type IN ('all', 'publisher')
        AND (p_min_games IS NULL OR p.game_count >= p_min_games)
        AND (p_min_revenue IS NULL OR COALESCE(pm.revenue_estimate_cents, 0) >= p_min_revenue)
        AND (p_status IS NULL
             OR (p_status = 'active' AND COALESCE(pm.games_released_last_year, 0) > 0)
             OR (p_status = 'dormant' AND COALESCE(pm.games_released_last_year, 0) = 0))
    ),
    valid_developers AS (
      SELECT d.id FROM developers d
      LEFT JOIN developer_metrics dm ON dm.developer_id = d.id
      WHERE p_company_type IN ('all', 'developer')
        AND (p_min_games IS NULL OR d.game_count >= p_min_games)
        AND (p_min_revenue IS NULL OR COALESCE(dm.revenue_estimate_cents, 0) >= p_min_revenue)
        AND (p_status IS NULL
             OR (p_status = 'active' AND COALESCE(dm.games_released_last_year, 0) > 0)
             OR (p_status = 'dormant' AND COALESCE(dm.games_released_last_year, 0) = 0))
    ),
    pub_counts AS (
      SELECT asd.category, COUNT(DISTINCT ap.publisher_id) as cnt
      FROM app_steam_deck asd
      JOIN app_publishers ap ON ap.appid = asd.appid
      WHERE ap.publisher_id IN (SELECT id FROM valid_publishers)
        AND asd.category IS NOT NULL
      GROUP BY asd.category
    ),
    dev_counts AS (
      SELECT asd.category, COUNT(DISTINCT ad.developer_id) as cnt
      FROM app_steam_deck asd
      JOIN app_developers ad ON ad.appid = asd.appid
      WHERE ad.developer_id IN (SELECT id FROM valid_developers)
        AND asd.category IS NOT NULL
      GROUP BY asd.category
    )
    SELECT
      CASE cat.category WHEN 'verified' THEN 1 WHEN 'playable' THEN 2 WHEN 'unsupported' THEN 3 ELSE 4 END,
      cat.category::TEXT,
      (COALESCE(pc.cnt, 0) + COALESCE(dc.cnt, 0))::BIGINT
    FROM (SELECT DISTINCT category FROM app_steam_deck WHERE category IS NOT NULL) cat
    LEFT JOIN pub_counts pc ON pc.category = cat.category
    LEFT JOIN dev_counts dc ON dc.category = cat.category
    ORDER BY 1;

  ELSE
    RETURN;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_filter_option_counts IS 'Returns counts for filter dropdowns - optimized with aggregate queries';
