import 'server-only';

import { runTigerQuery } from '@publisheriq/database';
import type { AggregateStats, Company, CompaniesFilterParams, CompanyIdentifier, SortField } from './companies-types';

type SqlValue = string | number | boolean | readonly number[] | readonly string[];

type CompanyRow = Record<string, unknown> & {
  id: number;
  name: string;
  type: 'publisher' | 'developer';
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 250;
const AGGREGATE_STATS_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_AGGREGATE_STATS_CACHE_ENTRIES = 128;

const aggregateStatsCache = new Map<string, { data: AggregateStats; timestamp: number }>();

const SORT_SQL: Record<SortField, string> = {
  avg_review_score: 'avg_review_score',
  ccu_growth_7d: 'ccu_growth_7d_percent',
  estimated_weekly_hours: 'estimated_weekly_hours',
  game_count: 'game_count',
  games_trending_up: 'games_trending_up',
  growth_30d: 'ccu_growth_30d_percent',
  name: 'name',
  owners_per_game: 'owners_per_game',
  revenue_estimate_cents: 'revenue_estimate_cents',
  revenue_per_game: 'revenue_per_game',
  review_velocity: 'review_velocity_7d',
  reviews_per_1k_owners: 'reviews_per_1k_owners',
  total_ccu: 'total_ccu',
  total_owners: 'total_owners',
  total_reviews: 'total_reviews',
};

function addParam(values: SqlValue[], value: SqlValue): string {
  values.push(value);
  return `$${values.length}`;
}

function hasItems<T>(items: readonly T[] | undefined): items is readonly T[] {
  return Array.isArray(items) && items.length > 0;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeLimit(limit: number | undefined): number {
  return Math.min(Math.max(Math.floor(limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
}

function normalizeOffset(offset: number | undefined): number {
  return Math.max(Math.floor(offset ?? 0), 0);
}

export function isTigerReadConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.TIGER_PRIMARY_URL || env.CHANGE_INTEL_TIGER_URL);
}

function projectionPeriodPredicate(params: CompaniesFilterParams, values: SqlValue[]): string | null {
  switch (params.period) {
    case '2025':
    case '2024':
    case '2023':
      return `release_years @> ARRAY[${addParam(values, Number(params.period))}]::int[]`;
    case 'last_12mo':
      return `latest_release_date >= CURRENT_DATE - INTERVAL '12 months'`;
    case 'last_6mo':
      return `latest_release_date >= CURRENT_DATE - INTERVAL '6 months'`;
    case 'last_90d':
      return `latest_release_date >= CURRENT_DATE - INTERVAL '90 days'`;
    case 'last_30d':
      return `latest_release_date >= CURRENT_DATE - INTERVAL '30 days'`;
    default:
      return null;
  }
}

function buildProjectionWhere(params: CompaniesFilterParams, values: SqlValue[], options: { ids?: CompanyIdentifier[] } = {}): string {
  const where: string[] = ['game_count > 0'];

  if (params.type === 'publisher') {
    where.push(`type = 'publisher'`);
  } else if (params.type === 'developer') {
    where.push(`type = 'developer'`);
  }

  if (options.ids && options.ids.length > 0) {
    const publisherIds = options.ids.filter((id) => id.type === 'publisher').map((id) => id.id);
    const developerIds = options.ids.filter((id) => id.type === 'developer').map((id) => id.id);
    const idClauses: string[] = [];
    if (publisherIds.length > 0) idClauses.push(`(type = 'publisher' AND id = ANY(${addParam(values, publisherIds)}::int[]))`);
    if (developerIds.length > 0) idClauses.push(`(type = 'developer' AND id = ANY(${addParam(values, developerIds)}::int[]))`);
    where.push(`(${idClauses.join(' OR ')})`);
  }

  if (params.search) {
    where.push(`name ILIKE ${addParam(values, `%${params.search.trim()}%`)}`);
  }

  const periodPredicate = projectionPeriodPredicate(params, values);
  if (periodPredicate) where.push(periodPredicate);

  const ranges: Array<[unknown, string, string]> = [
    [params.minGames, 'game_count', '>='],
    [params.maxGames, 'game_count', '<='],
    [params.minOwners, 'total_owners', '>='],
    [params.maxOwners, 'total_owners', '<='],
    [params.minCcu, 'total_ccu', '>='],
    [params.maxCcu, 'total_ccu', '<='],
    [params.minHours, 'estimated_weekly_hours', '>='],
    [params.maxHours, 'estimated_weekly_hours', '<='],
    [params.minRevenue, 'revenue_estimate_cents', '>='],
    [params.maxRevenue, 'revenue_estimate_cents', '<='],
    [params.minScore, 'avg_review_score', '>='],
    [params.maxScore, 'avg_review_score', '<='],
    [params.minReviews, 'total_reviews', '>='],
    [params.maxReviews, 'total_reviews', '<='],
    [params.minGrowth7d, 'ccu_growth_7d_percent', '>='],
    [params.maxGrowth7d, 'ccu_growth_7d_percent', '<='],
    [params.minGrowth30d, 'ccu_growth_30d_percent', '>='],
    [params.maxGrowth30d, 'ccu_growth_30d_percent', '<='],
  ];

  for (const [value, column, operator] of ranges) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      where.push(`${column} ${operator} ${addParam(values, value)}`);
    }
  }

  if (params.status === 'active') where.push('games_released_last_year > 0');
  if (params.status === 'dormant') where.push('games_released_last_year = 0');

  if (hasItems(params.genres)) {
    const placeholder = addParam(values, params.genres);
    where.push(params.genreMode === 'all'
      ? `genre_ids @> ${placeholder}::int[]`
      : `genre_ids && ${placeholder}::int[]`);
  }
  if (hasItems(params.tags)) where.push(`tag_ids && ${addParam(values, params.tags)}::int[]`);
  if (hasItems(params.categories)) where.push(`category_ids && ${addParam(values, params.categories)}::int[]`);

  if (params.steamDeck === 'verified') {
    where.push(`best_steam_deck_category = 'verified'`);
  } else if (params.steamDeck === 'playable') {
    where.push(`best_steam_deck_category IN ('verified', 'playable')`);
  }

  if (hasItems(params.platforms)) {
    const placeholder = addParam(values, params.platforms);
    where.push(params.platformMode === 'all'
      ? `platform_array @> ${placeholder}::text[]`
      : `platform_array && ${placeholder}::text[]`);
  }

  if (params.relationship === 'self_published') {
    where.push('is_self_published = true');
  } else if (params.relationship === 'external_devs') {
    where.push(`type = 'publisher' AND works_with_external_devs = true`);
  } else if (params.relationship === 'multi_publisher') {
    where.push(`type = 'developer' AND COALESCE(external_partner_count, 0) > 1`);
  }

  return where.length ? `WHERE ${where.join(' AND ')}` : '';
}

function mapCompanyRow(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    game_count: toNumber(row.game_count) ?? 0,
    total_owners: toNumber(row.total_owners) ?? 0,
    total_ccu: toNumber(row.total_ccu) ?? 0,
    estimated_weekly_hours: toNumber(row.estimated_weekly_hours) ?? 0,
    total_reviews: toNumber(row.total_reviews) ?? 0,
    positive_reviews: toNumber(row.positive_reviews) ?? 0,
    avg_review_score: toNumber(row.avg_review_score),
    revenue_estimate_cents: toNumber(row.revenue_estimate_cents) ?? 0,
    games_trending_up: toNumber(row.games_trending_up) ?? 0,
    games_trending_down: toNumber(row.games_trending_down) ?? 0,
    ccu_growth_7d_percent: toNumber(row.ccu_growth_7d_percent),
    ccu_growth_30d_percent: toNumber(row.ccu_growth_30d_percent),
    review_velocity_7d: toNumber(row.review_velocity_7d),
    review_velocity_30d: toNumber(row.review_velocity_30d),
    is_self_published: (row.is_self_published as boolean | null | undefined) ?? null,
    works_with_external_devs: (row.works_with_external_devs as boolean | null | undefined) ?? null,
    external_partner_count: toNumber(row.external_partner_count),
    first_release_date: toIsoDate(row.first_release_date),
    latest_release_date: toIsoDate(row.latest_release_date),
    years_active: toNumber(row.years_active),
    steam_vanity_url: (row.steam_vanity_url as string | null | undefined) ?? null,
    unique_developers: toNumber(row.unique_developers) ?? 0,
    data_updated_at: toIsoDate(row.data_updated_at),
  };
}

/**
 * Fetch companies from TigerData.
 */
export async function getCompanies(params: CompaniesFilterParams): Promise<Company[]> {
  const rows = await queryCompanies(params);
  return rows.map(mapCompanyRow);
}

function getAggregateStatsCacheKey(params: CompaniesFilterParams): string {
  const statsParams: CompaniesFilterParams = {
    ...params,
    sort: 'estimated_weekly_hours',
    order: 'desc',
    limit: undefined,
    offset: undefined,
  };
  const entries = Object.entries(statsParams)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

function readAggregateStatsCache(key: string): AggregateStats | null {
  const cached = aggregateStatsCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > AGGREGATE_STATS_CACHE_TTL_MS) {
    aggregateStatsCache.delete(key);
    return null;
  }
  return cached.data;
}

function writeAggregateStatsCache(key: string, data: AggregateStats): void {
  if (aggregateStatsCache.size >= MAX_AGGREGATE_STATS_CACHE_ENTRIES) {
    const oldestKey = aggregateStatsCache.keys().next().value as string | undefined;
    if (oldestKey) aggregateStatsCache.delete(oldestKey);
  }
  aggregateStatsCache.set(key, { data, timestamp: Date.now() });
}

async function queryCompanies(params: CompaniesFilterParams): Promise<CompanyRow[]> {
  const values: SqlValue[] = [];
  const whereSql = buildProjectionWhere(params, values);
  const sortColumn = SORT_SQL[params.sort] ?? SORT_SQL.estimated_weekly_hours;
  const limitPlaceholder = addParam(values, normalizeLimit(params.limit));
  const offsetPlaceholder = addParam(values, normalizeOffset(params.offset));
  const direction = params.order === 'asc' ? 'ASC' : 'DESC';

  const { rows } = await runTigerQuery<CompanyRow>(
    `
      SELECT
        id,
        name,
        type,
        game_count,
        total_owners,
        total_ccu,
        estimated_weekly_hours,
        total_reviews,
        positive_reviews,
        avg_review_score,
        revenue_estimate_cents,
        games_trending_up,
        games_trending_down,
        ccu_growth_7d_percent,
        ccu_growth_30d_percent,
        review_velocity_7d,
        review_velocity_30d,
        is_self_published,
        works_with_external_devs,
        external_partner_count,
        revenue_per_game,
        owners_per_game,
        reviews_per_1k_owners,
        first_release_date,
        latest_release_date,
        CASE
          WHEN first_release_date IS NOT NULL
            THEN EXTRACT(YEAR FROM AGE(COALESCE(latest_release_date, CURRENT_DATE), first_release_date))::integer
          ELSE NULL
        END AS years_active,
        steam_vanity_url,
        unique_developers,
        data_updated_at
      FROM metrics.companies_page_projection
      ${whereSql}
      ORDER BY ${sortColumn} ${direction} NULLS LAST, name ASC, type ASC, id ASC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `,
    values
  );

  return rows;
}

/**
 * Fetch aggregate statistics for filtered companies from TigerData.
 */
export async function getAggregateStats(
  params: CompaniesFilterParams
): Promise<AggregateStats> {
  const cacheKey = getAggregateStatsCacheKey(params);
  const cached = readAggregateStatsCache(cacheKey);
  if (cached) return cached;

  const values: SqlValue[] = [];
  const whereSql = buildProjectionWhere(params, values);

  const { rows } = await runTigerQuery<Record<string, unknown>>(
    `
      SELECT
        COUNT(*)::integer AS total_companies,
        COALESCE(SUM(game_count), 0)::bigint AS total_games,
        COALESCE(SUM(total_owners), 0)::bigint AS total_owners,
        COALESCE(SUM(revenue_estimate_cents), 0)::bigint AS total_revenue,
        CASE WHEN SUM(total_reviews) > 0 THEN ROUND((SUM(positive_reviews)::numeric / SUM(total_reviews)) * 100, 2) ELSE NULL END AS avg_review_score,
        COALESCE(SUM(total_ccu), 0)::bigint AS total_ccu
      FROM metrics.companies_page_projection
      ${whereSql}
    `,
    values
  );

  const row = rows[0] ?? {};
  const stats: AggregateStats = {
    total_companies: toNumber(row.total_companies) ?? 0,
    total_games: toNumber(row.total_games) ?? 0,
    total_owners: toNumber(row.total_owners) ?? 0,
    total_revenue: toNumber(row.total_revenue) ?? 0,
    avg_review_score: toNumber(row.avg_review_score),
    total_ccu: toNumber(row.total_ccu) ?? 0,
  };
  writeAggregateStatsCache(cacheKey, stats);
  return stats;
}

/**
 * Fetch specific companies by their IDs for comparison from TigerData.
 */
export async function getCompaniesByIds(
  ids: CompanyIdentifier[]
): Promise<Company[]> {
  if (ids.length === 0) return [];

  const type: CompaniesFilterParams['type'] =
    ids.every((id) => id.type === 'publisher') ? 'publisher' :
    ids.every((id) => id.type === 'developer') ? 'developer' :
    'all';

  const params: CompaniesFilterParams = {
    type,
    sort: 'estimated_weekly_hours',
    order: 'desc',
    limit: ids.length,
  };
  const values: SqlValue[] = [];
  const whereSql = buildProjectionWhere(params, values, { ids });

  const { rows } = await runTigerQuery<CompanyRow>(
    `
      SELECT
        id,
        name,
        type,
        game_count,
        total_owners,
        total_ccu,
        estimated_weekly_hours,
        total_reviews,
        positive_reviews,
        avg_review_score,
        revenue_estimate_cents,
        games_trending_up,
        games_trending_down,
        ccu_growth_7d_percent,
        ccu_growth_30d_percent,
        review_velocity_7d,
        review_velocity_30d,
        is_self_published,
        works_with_external_devs,
        external_partner_count,
        revenue_per_game,
        owners_per_game,
        reviews_per_1k_owners,
        first_release_date,
        latest_release_date,
        CASE
          WHEN first_release_date IS NOT NULL
            THEN EXTRACT(YEAR FROM AGE(COALESCE(latest_release_date, CURRENT_DATE), first_release_date))::integer
          ELSE NULL
        END AS years_active,
        steam_vanity_url,
        unique_developers,
        data_updated_at
      FROM metrics.companies_page_projection
      ${whereSql}
    `,
    values
  );

  const companyMap = new Map(rows.map((row) => [`${row.type}-${row.id}`, mapCompanyRow(row)]));
  return ids
    .map((id) => companyMap.get(`${id.type}-${id.id}`))
    .filter((company): company is Company => company !== undefined);
}
