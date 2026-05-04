-- Tiger read accelerator for the admin /companies page.
--
-- The /companies UI filters, sorts, and aggregates publisher/developer
-- portfolios. Rebuilding those company-level metrics from normalized
-- app-company edges at request time is too slow for broad list and growth
-- sorts, so this materialized view precomputes the row shape used by the page.
--
-- Apply only during an approved Tiger maintenance window. The initial refresh
-- scans legacy company/app relationship tables, latest metrics, taxonomy, and
-- growth/trend assignments. Follow-up refreshes may use CONCURRENTLY after the
-- initial population.

DROP MATERIALIZED VIEW IF EXISTS metrics.companies_page_projection;

CREATE MATERIALIZED VIEW metrics.companies_page_projection AS
WITH company_apps AS (
  SELECT
    'publisher'::text AS type,
    p.id,
    p.name,
    lower(p.name) AS name_lower,
    p.steam_vanity_url,
    p.first_game_release_date,
    ap.appid,
    a.release_date,
    a.current_price_cents,
    a.platforms,
    a.updated_at AS app_updated_at
  FROM legacy.publishers p
  JOIN legacy.app_publishers ap ON ap.publisher_id = p.id
  JOIN legacy.apps a ON a.appid = ap.appid
  WHERE COALESCE(a.type, 'game') = 'game'
    AND COALESCE(a.is_released, true) = true
    AND COALESCE(a.is_delisted, false) = false

  UNION ALL

  SELECT
    'developer'::text AS type,
    d.id,
    d.name,
    lower(d.name) AS name_lower,
    d.steam_vanity_url,
    d.first_game_release_date,
    ad.appid,
    a.release_date,
    a.current_price_cents,
    a.platforms,
    a.updated_at AS app_updated_at
  FROM legacy.developers d
  JOIN legacy.app_developers ad ON ad.developer_id = d.id
  JOIN legacy.apps a ON a.appid = ad.appid
  WHERE COALESCE(a.type, 'game') = 'game'
    AND COALESCE(a.is_released, true) = true
    AND COALESCE(a.is_delisted, false) = false
),
app_metric_rows AS (
  SELECT
    ca.type,
    ca.id,
    ca.name,
    ca.name_lower,
    ca.steam_vanity_url,
    ca.first_game_release_date,
    ca.appid,
    ca.release_date,
    COALESCE(ldm.owners_min, 0) AS owners_min,
    COALESCE(ldm.owners_max, 0) AS owners_max,
    COALESCE(ldm.owners_midpoint, ((COALESCE(ldm.owners_min, 0)::bigint + COALESCE(ldm.owners_max, 0)::bigint) / 2)) AS owners_midpoint,
    COALESCE(ldm.ccu_peak, 0) AS ccu_peak,
    COALESCE(ldm.total_reviews, 0) AS total_reviews,
    COALESCE(ldm.positive_reviews, 0) AS positive_reviews,
    COALESCE(ldm.estimated_weekly_hours, 0) AS estimated_weekly_hours,
    COALESCE(ldm.price_cents, ca.current_price_cents, 0) AS price_cents,
    atr.trend_30d_direction,
    atr.review_velocity_7d,
    atr.review_velocity_30d,
    cta.ccu_growth_7d_percent,
    cta.ccu_growth_30d_percent,
    GREATEST(ca.app_updated_at, COALESCE(cta.updated_at, ca.app_updated_at), COALESCE(atr.updated_at, ca.app_updated_at)) AS data_updated_at
  FROM company_apps ca
  LEFT JOIN legacy.latest_daily_metrics ldm ON ldm.appid = ca.appid
  LEFT JOIN metrics.app_trends atr ON atr.appid = ca.appid
  LEFT JOIN ops.ccu_tier_assignments cta ON cta.appid = ca.appid
),
core AS (
  SELECT
    type,
    id,
    name,
    name_lower,
    steam_vanity_url,
    COUNT(*)::integer AS game_count,
    COALESCE(SUM(owners_midpoint), 0)::bigint AS total_owners,
    COALESCE(SUM(ccu_peak), 0)::bigint AS total_ccu,
    COALESCE(SUM(estimated_weekly_hours), 0)::bigint AS estimated_weekly_hours,
    COALESCE(SUM(total_reviews), 0)::bigint AS total_reviews,
    COALESCE(SUM(positive_reviews), 0)::bigint AS positive_reviews,
    CASE WHEN SUM(total_reviews) > 0 THEN ROUND((SUM(positive_reviews)::numeric / SUM(total_reviews)) * 100)::integer ELSE NULL END AS avg_review_score,
    COALESCE(SUM(owners_midpoint::numeric * COALESCE(price_cents, 0)), 0)::bigint AS revenue_estimate_cents,
    COUNT(*) FILTER (WHERE trend_30d_direction = 'up')::integer AS games_trending_up,
    COUNT(*) FILTER (WHERE trend_30d_direction = 'down')::integer AS games_trending_down,
    AVG(ccu_growth_7d_percent) FILTER (WHERE ccu_growth_7d_percent IS NOT NULL)::numeric AS ccu_growth_7d_percent,
    AVG(ccu_growth_30d_percent) FILTER (WHERE ccu_growth_30d_percent IS NOT NULL)::numeric AS ccu_growth_30d_percent,
    SUM(review_velocity_7d) FILTER (WHERE review_velocity_7d IS NOT NULL)::numeric AS review_velocity_7d,
    SUM(review_velocity_30d) FILTER (WHERE review_velocity_30d IS NOT NULL)::numeric AS review_velocity_30d,
    MIN(first_game_release_date) AS first_release_date,
    MAX(release_date) AS latest_release_date,
    array_agg(DISTINCT EXTRACT(YEAR FROM release_date)::integer ORDER BY EXTRACT(YEAR FROM release_date)::integer) FILTER (WHERE release_date IS NOT NULL) AS release_years,
    MAX(data_updated_at) AS data_updated_at,
    COUNT(*) FILTER (WHERE release_date >= CURRENT_DATE - INTERVAL '1 year')::integer AS games_released_last_year
  FROM app_metric_rows
  GROUP BY type, id, name, name_lower, steam_vanity_url
),
publisher_relationships AS (
  SELECT
    ap.publisher_id AS id,
    COUNT(DISTINCT ad.developer_id)::integer AS external_partner_count,
    COUNT(DISTINCT ad.developer_id)::integer AS unique_developers
  FROM legacy.app_publishers ap
  JOIN legacy.app_developers ad ON ad.appid = ap.appid
  GROUP BY ap.publisher_id
),
developer_relationships AS (
  SELECT
    ad.developer_id AS id,
    COUNT(DISTINCT ap.publisher_id)::integer AS external_partner_count
  FROM legacy.app_developers ad
  JOIN legacy.app_publishers ap ON ap.appid = ad.appid
  GROUP BY ad.developer_id
),
self_published AS (
  SELECT 'publisher'::text AS type, p.id
  FROM legacy.publishers p
  JOIN legacy.developers d ON d.normalized_name = p.normalized_name
  UNION
  SELECT 'developer'::text AS type, d.id
  FROM legacy.developers d
  JOIN legacy.publishers p ON p.normalized_name = d.normalized_name
),
company_genres AS (
  SELECT ca.type, ca.id, array_agg(DISTINCT ag.genre_id ORDER BY ag.genre_id) AS genre_ids
  FROM company_apps ca
  JOIN legacy.app_genres ag ON ag.appid = ca.appid
  GROUP BY ca.type, ca.id
),
company_tags AS (
  SELECT ca.type, ca.id, array_agg(DISTINCT ast.tag_id ORDER BY ast.tag_id) AS tag_ids
  FROM company_apps ca
  JOIN legacy.app_steam_tags ast ON ast.appid = ca.appid
  GROUP BY ca.type, ca.id
),
company_categories AS (
  SELECT ca.type, ca.id, array_agg(DISTINCT ac.category_id ORDER BY ac.category_id) AS category_ids
  FROM company_apps ca
  JOIN legacy.app_categories ac ON ac.appid = ca.appid
  GROUP BY ca.type, ca.id
),
company_steam_deck AS (
  SELECT
    ca.type,
    ca.id,
    CASE MIN(
      CASE sd.category
        WHEN 'verified' THEN 1
        WHEN 'playable' THEN 2
        WHEN 'unsupported' THEN 3
        ELSE 4
      END
    )
      WHEN 1 THEN 'verified'
      WHEN 2 THEN 'playable'
      WHEN 3 THEN 'unsupported'
      ELSE NULL
    END AS best_steam_deck_category
  FROM company_apps ca
  LEFT JOIN legacy.app_steam_deck sd ON sd.appid = ca.appid
  GROUP BY ca.type, ca.id
),
company_platforms AS (
  SELECT
    ca.type,
    ca.id,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN BOOL_OR(ca.platforms ILIKE '%windows%') THEN 'windows' END,
      CASE WHEN BOOL_OR(ca.platforms ILIKE '%mac%') THEN 'mac' END,
      CASE WHEN BOOL_OR(ca.platforms ILIKE '%linux%') THEN 'linux' END
    ], NULL) AS platform_array
  FROM company_apps ca
  GROUP BY ca.type, ca.id
)
SELECT
  c.type,
  c.id,
  c.name,
  c.name_lower,
  c.game_count,
  c.total_owners,
  c.total_ccu,
  c.estimated_weekly_hours,
  c.total_reviews,
  c.positive_reviews,
  c.avg_review_score,
  c.revenue_estimate_cents,
  c.games_trending_up,
  c.games_trending_down,
  c.ccu_growth_7d_percent,
  c.ccu_growth_30d_percent,
  c.review_velocity_7d,
  c.review_velocity_30d,
  COALESCE(pr.unique_developers, 0)::integer AS unique_developers,
  CASE WHEN sp.id IS NOT NULL THEN true ELSE false END AS is_self_published,
  COALESCE(pr.external_partner_count, dr.external_partner_count)::integer AS external_partner_count,
  CASE WHEN c.type = 'publisher' THEN COALESCE(pr.external_partner_count, 0) > 1 ELSE NULL END AS works_with_external_devs,
  CASE WHEN c.game_count > 0 THEN c.revenue_estimate_cents::numeric / c.game_count ELSE NULL END AS revenue_per_game,
  CASE WHEN c.game_count > 0 THEN c.total_owners::numeric / c.game_count ELSE NULL END AS owners_per_game,
  CASE WHEN c.total_owners > 0 THEN c.total_reviews::numeric / (c.total_owners::numeric / 1000) ELSE NULL END AS reviews_per_1k_owners,
  c.first_release_date,
  c.latest_release_date,
  COALESCE(c.release_years, ARRAY[]::integer[]) AS release_years,
  CASE
    WHEN c.first_release_date IS NOT NULL
      THEN EXTRACT(YEAR FROM AGE(COALESCE(c.latest_release_date, CURRENT_DATE), c.first_release_date))::integer
    ELSE NULL
  END AS years_active,
  c.games_released_last_year,
  c.steam_vanity_url,
  COALESCE(cg.genre_ids, ARRAY[]::integer[]) AS genre_ids,
  COALESCE(ct.tag_ids, ARRAY[]::integer[]) AS tag_ids,
  COALESCE(cc.category_ids, ARRAY[]::integer[]) AS category_ids,
  csd.best_steam_deck_category,
  COALESCE(cp.platform_array, ARRAY[]::text[]) AS platform_array,
  c.data_updated_at
FROM core c
LEFT JOIN publisher_relationships pr ON c.type = 'publisher' AND pr.id = c.id
LEFT JOIN developer_relationships dr ON c.type = 'developer' AND dr.id = c.id
LEFT JOIN self_published sp ON sp.type = c.type AND sp.id = c.id
LEFT JOIN company_genres cg ON cg.type = c.type AND cg.id = c.id
LEFT JOIN company_tags ct ON ct.type = c.type AND ct.id = c.id
LEFT JOIN company_categories cc ON cc.type = c.type AND cc.id = c.id
LEFT JOIN company_steam_deck csd ON csd.type = c.type AND csd.id = c.id
LEFT JOIN company_platforms cp ON cp.type = c.type AND cp.id = c.id
WITH NO DATA;

CREATE UNIQUE INDEX idx_metrics_companies_page_projection_pk
  ON metrics.companies_page_projection (type, id);

CREATE INDEX idx_metrics_companies_page_projection_name
  ON metrics.companies_page_projection USING gin (name public.gin_trgm_ops);
CREATE INDEX idx_metrics_companies_page_projection_name_lower
  ON metrics.companies_page_projection USING gin (name_lower public.gin_trgm_ops);

CREATE INDEX idx_metrics_companies_page_projection_hours
  ON metrics.companies_page_projection (type, estimated_weekly_hours DESC NULLS LAST, name, id);
CREATE INDEX idx_metrics_companies_page_projection_game_count
  ON metrics.companies_page_projection (type, game_count DESC NULLS LAST, name, id);
CREATE INDEX idx_metrics_companies_page_projection_owners
  ON metrics.companies_page_projection (type, total_owners DESC NULLS LAST, name, id);
CREATE INDEX idx_metrics_companies_page_projection_ccu
  ON metrics.companies_page_projection (type, total_ccu DESC NULLS LAST, name, id);
CREATE INDEX idx_metrics_companies_page_projection_reviews
  ON metrics.companies_page_projection (type, total_reviews DESC NULLS LAST, name, id);
CREATE INDEX idx_metrics_companies_page_projection_score
  ON metrics.companies_page_projection (type, avg_review_score DESC NULLS LAST, name, id);
CREATE INDEX idx_metrics_companies_page_projection_revenue
  ON metrics.companies_page_projection (type, revenue_estimate_cents DESC NULLS LAST, name, id);
CREATE INDEX idx_metrics_companies_page_projection_trending
  ON metrics.companies_page_projection (type, games_trending_up DESC NULLS LAST, name, id);
CREATE INDEX idx_metrics_companies_page_projection_growth_7d
  ON metrics.companies_page_projection (type, ccu_growth_7d_percent DESC NULLS LAST, name, id);
CREATE INDEX idx_metrics_companies_page_projection_growth_30d
  ON metrics.companies_page_projection (type, ccu_growth_30d_percent DESC NULLS LAST, name, id);
CREATE INDEX idx_metrics_companies_page_projection_velocity
  ON metrics.companies_page_projection (type, review_velocity_7d DESC NULLS LAST, name, id);
CREATE INDEX idx_metrics_companies_page_projection_latest_release
  ON metrics.companies_page_projection (type, latest_release_date DESC NULLS LAST, name, id);
CREATE INDEX idx_metrics_companies_page_projection_release_years
  ON metrics.companies_page_projection USING gin (release_years);

CREATE INDEX idx_metrics_companies_page_projection_genres
  ON metrics.companies_page_projection USING gin (genre_ids);
CREATE INDEX idx_metrics_companies_page_projection_tags
  ON metrics.companies_page_projection USING gin (tag_ids);
CREATE INDEX idx_metrics_companies_page_projection_categories
  ON metrics.companies_page_projection USING gin (category_ids);
CREATE INDEX idx_metrics_companies_page_projection_platforms
  ON metrics.companies_page_projection USING gin (platform_array);
CREATE INDEX idx_metrics_companies_page_projection_steam_deck
  ON metrics.companies_page_projection (best_steam_deck_category);
CREATE INDEX idx_metrics_companies_page_projection_relationships
  ON metrics.companies_page_projection (type, is_self_published, works_with_external_devs, external_partner_count);

COMMENT ON MATERIALIZED VIEW metrics.companies_page_projection IS
  'Precomputed publisher/developer portfolio metrics for the admin /companies page. Refresh after Tiger legacy/metrics sync batches.';

REFRESH MATERIALIZED VIEW metrics.companies_page_projection;

-- Follow-up refreshes may use:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY metrics.companies_page_projection;
