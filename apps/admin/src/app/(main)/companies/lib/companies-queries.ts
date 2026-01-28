import { getSupabase } from '@/lib/supabase';
import type { Company, CompaniesFilterParams, CompanyIdentifier } from './companies-types';

/**
 * Fetch companies from the database using the unified RPC
 */
export async function getCompanies(params: CompaniesFilterParams): Promise<Company[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc('get_companies_with_filters', {
    p_type: params.type,
    p_sort_by: params.sort,
    p_sort_order: params.order,
    p_limit: params.limit ?? 50,
    p_offset: params.offset ?? 0,
    p_search: params.search,
    // Metric filters
    p_min_games: params.minGames,
    p_max_games: params.maxGames,
    p_min_owners: params.minOwners,
    p_max_owners: params.maxOwners,
    p_min_ccu: params.minCcu,
    p_max_ccu: params.maxCcu,
    p_min_hours: params.minHours,
    p_max_hours: params.maxHours,
    p_min_revenue: params.minRevenue,
    p_max_revenue: params.maxRevenue,
    p_min_score: params.minScore,
    p_max_score: params.maxScore,
    p_min_reviews: params.minReviews,
    p_max_reviews: params.maxReviews,
    // Growth filters
    p_min_growth_7d: params.minGrowth7d,
    p_max_growth_7d: params.maxGrowth7d,
    p_min_growth_30d: params.minGrowth30d,
    p_max_growth_30d: params.maxGrowth30d,
    // Time period (UI only - backend not yet implemented)
    p_period: params.period,
    // Content filters (M4b)
    p_genres: params.genres,
    p_genre_mode: params.genreMode ?? 'any',
    p_tags: params.tags,
    p_categories: params.categories,
    p_steam_deck: params.steamDeck ?? undefined,
    p_platforms: params.platforms,
    p_platform_mode: params.platformMode ?? 'any',
    // Status filter
    p_status: params.status ?? undefined,
    // Relationship filter (M4b)
    p_relationship: params.relationship ?? undefined,
  });

  if (error) {
    console.error('Error fetching companies:', error);
    throw new Error(`Failed to fetch companies: ${error.message}`);
  }

  return (data ?? []) as Company[];
}

/**
 * Format large numbers compactly (e.g., 1.2M, 5.6K)
 */
export function formatCompactNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n === 0) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * Format revenue in cents to USD string (e.g., $1.2M)
 */
export function formatRevenue(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  if (cents === 0) return '$0';
  const usd = cents / 100;
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${usd.toLocaleString()}`;
}

/**
 * Format hours (e.g., 15.2M hrs)
 */
export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '—';
  if (hours === 0) return '0 hrs';
  if (hours >= 1_000_000) return `${(hours / 1_000_000).toFixed(1)}M hrs`;
  if (hours >= 1_000) return `${(hours / 1_000).toFixed(1)}K hrs`;
  return `${hours.toLocaleString()} hrs`;
}

/**
 * Calculate review percentage
 */
export function getReviewPercentage(
  positive: number | null | undefined,
  total: number | null | undefined
): number | null {
  if (positive === null || positive === undefined ||
      total === null || total === undefined || total === 0) return null;
  return Math.round((positive / total) * 100);
}

/**
 * Aggregate statistics for filtered companies
 */
export interface AggregateStats {
  total_companies: number;
  total_games: number;
  total_owners: number;
  total_revenue: number;
  avg_review_score: number | null;
  total_ccu: number;
}

/**
 * Fetch aggregate statistics for filtered companies
 */
export async function getAggregateStats(
  params: CompaniesFilterParams
): Promise<AggregateStats> {
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc('get_companies_aggregate_stats', {
    p_type: params.type,
    p_search: params.search,
    p_min_games: params.minGames,
    p_max_games: params.maxGames,
    p_min_owners: params.minOwners,
    p_max_owners: params.maxOwners,
    p_min_ccu: params.minCcu,
    p_max_ccu: params.maxCcu,
    p_min_hours: params.minHours,
    p_max_hours: params.maxHours,
    p_min_revenue: params.minRevenue,
    p_max_revenue: params.maxRevenue,
    p_min_score: params.minScore,
    p_max_score: params.maxScore,
    p_min_reviews: params.minReviews,
    p_max_reviews: params.maxReviews,
    p_status: params.status ?? undefined,
    p_genres: params.genres,
    p_genre_mode: params.genreMode ?? 'any',
    p_tags: params.tags,
    p_categories: params.categories,
    p_steam_deck: params.steamDeck ?? undefined,
    p_platforms: params.platforms,
    p_platform_mode: params.platformMode ?? 'any',
    // Growth filters
    p_min_growth_7d: params.minGrowth7d,
    p_max_growth_7d: params.maxGrowth7d,
    p_min_growth_30d: params.minGrowth30d,
    p_max_growth_30d: params.maxGrowth30d,
    // Relationship filter
    p_relationship: params.relationship ?? undefined,
  });

  if (error) {
    console.error('Error fetching aggregate stats:', error);
    return {
      total_companies: 0,
      total_games: 0,
      total_owners: 0,
      total_revenue: 0,
      avg_review_score: null,
      total_ccu: 0,
    };
  }

  // RPC returns a single row
  const row = data?.[0] ?? {};
  return {
    total_companies: Number(row.total_companies) || 0,
    total_games: Number(row.total_games) || 0,
    total_owners: Number(row.total_owners) || 0,
    total_revenue: Number(row.total_revenue) || 0,
    avg_review_score: row.avg_review_score ? Number(row.avg_review_score) : null,
    total_ccu: Number(row.total_ccu) || 0,
  };
}

/**
 * Fetch specific companies by their IDs for comparison
 * Queries the materialized views directly since the RPC doesn't support ID filters
 */
export async function getCompaniesByIds(
  ids: CompanyIdentifier[]
): Promise<Company[]> {
  if (ids.length === 0) return [];

  const supabase = getSupabase();

  const publisherIds = ids
    .filter((id) => id.type === 'publisher')
    .map((id) => id.id);
  const developerIds = ids
    .filter((id) => id.type === 'developer')
    .map((id) => id.id);

  // Query materialized views directly
  // Note: Views use publisher_id/developer_id and publisher_name/developer_name
  // Some fields from the RPC aren't available in the materialized views
  const fetchPublishers = async (): Promise<Company[]> => {
    if (publisherIds.length === 0) return [];
    const { data, error } = await supabase
      .from('publisher_metrics')
      .select(`
        publisher_id,
        publisher_name,
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
        unique_developers
      `)
      .in('publisher_id', publisherIds);
    if (error) {
      console.error('Error fetching publishers by ID:', error);
      return [];
    }
    // Map to Company interface with null for missing fields
    return (data ?? []).map((p) => ({
      id: p.publisher_id!,
      name: p.publisher_name!,
      type: 'publisher' as const,
      game_count: p.game_count ?? 0,
      total_owners: p.total_owners ?? 0,
      total_ccu: p.total_ccu ?? 0,
      estimated_weekly_hours: p.estimated_weekly_hours ?? 0,
      total_reviews: p.total_reviews ?? 0,
      positive_reviews: p.positive_reviews ?? 0,
      avg_review_score: p.avg_review_score,
      revenue_estimate_cents: p.revenue_estimate_cents ?? 0,
      games_trending_up: p.games_trending_up ?? 0,
      games_trending_down: p.games_trending_down ?? 0,
      unique_developers: p.unique_developers ?? 0,
      // Fields not available in materialized view
      ccu_growth_7d_percent: null,
      ccu_growth_30d_percent: null,
      review_velocity_7d: null,
      review_velocity_30d: null,
      is_self_published: null,
      works_with_external_devs: null,
      external_partner_count: null,
      first_release_date: null,
      latest_release_date: null,
      years_active: null,
      steam_vanity_url: null,
      data_updated_at: null,
    }));
  };

  const fetchDevelopers = async (): Promise<Company[]> => {
    if (developerIds.length === 0) return [];
    const { data, error } = await supabase
      .from('developer_metrics')
      .select(`
        developer_id,
        developer_name,
        game_count,
        total_owners,
        total_ccu,
        estimated_weekly_hours,
        total_reviews,
        positive_reviews,
        avg_review_score,
        revenue_estimate_cents,
        games_trending_up,
        games_trending_down
      `)
      .in('developer_id', developerIds);
    if (error) {
      console.error('Error fetching developers by ID:', error);
      return [];
    }
    // Map to Company interface with null for missing fields
    return (data ?? []).map((d) => ({
      id: d.developer_id!,
      name: d.developer_name!,
      type: 'developer' as const,
      game_count: d.game_count ?? 0,
      total_owners: d.total_owners ?? 0,
      total_ccu: d.total_ccu ?? 0,
      estimated_weekly_hours: d.estimated_weekly_hours ?? 0,
      total_reviews: d.total_reviews ?? 0,
      positive_reviews: d.positive_reviews ?? 0,
      avg_review_score: d.avg_review_score,
      revenue_estimate_cents: d.revenue_estimate_cents ?? 0,
      games_trending_up: d.games_trending_up ?? 0,
      games_trending_down: d.games_trending_down ?? 0,
      unique_developers: 0, // Not available for developers
      // Fields not available in materialized view
      ccu_growth_7d_percent: null,
      ccu_growth_30d_percent: null,
      review_velocity_7d: null,
      review_velocity_30d: null,
      is_self_published: null,
      works_with_external_devs: null,
      external_partner_count: null,
      first_release_date: null,
      latest_release_date: null,
      years_active: null,
      steam_vanity_url: null,
      data_updated_at: null,
    }));
  };

  const results = await Promise.all([fetchPublishers(), fetchDevelopers()]);
  const allCompanies = results.flat();

  // Preserve original order from input IDs
  const companyMap = new Map(
    allCompanies.map((c) => [`${c.type}-${c.id}`, c])
  );

  return ids
    .map((id) => companyMap.get(`${id.type}-${id.id}`))
    .filter((c): c is Company => c !== undefined);
}
