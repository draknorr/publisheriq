import { getSupabase } from '@/lib/supabase';
import type { App, AppsFilterParams, AggregateStats } from './apps-types';

/**
 * Aggregate stats row shape from RPC
 * Typed here until database types are regenerated after migration
 */
interface AggregateStatsRow {
  total_games: number;
  avg_ccu: number | null;
  avg_score: number | null;
  avg_momentum: number | null;
  trending_up_count: number;
  trending_down_count: number;
  sentiment_improving_count: number;
  sentiment_declining_count: number;
  avg_value_score: number | null;
}

/**
 * Fetch apps from the database using the unified RPC
 * Note: Uses type assertion until database types are regenerated after migration
 */
export async function getApps(params: AppsFilterParams): Promise<App[]> {
  const supabase = getSupabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('get_apps_with_filters', {
    p_type: params.type,
    p_sort_field: params.sort,
    p_sort_order: params.order,
    p_limit: params.limit ?? 50,
    p_offset: params.offset ?? 0,
    p_search: params.search,
    // Metric filters
    p_min_ccu: params.minCcu,
    p_max_ccu: params.maxCcu,
    p_min_owners: params.minOwners,
    p_max_owners: params.maxOwners,
    p_min_reviews: params.minReviews,
    p_max_reviews: params.maxReviews,
    p_min_score: params.minScore,
    p_max_score: params.maxScore,
    p_min_price: params.minPrice,
    p_max_price: params.maxPrice,
    p_min_playtime: params.minPlaytime,
    p_max_playtime: params.maxPlaytime,
    // Growth filters
    p_min_growth_7d: params.minGrowth7d,
    p_max_growth_7d: params.maxGrowth7d,
    p_min_growth_30d: params.minGrowth30d,
    p_max_growth_30d: params.maxGrowth30d,
    p_min_momentum: params.minMomentum,
    p_max_momentum: params.maxMomentum,
    // Sentiment filters
    p_min_sentiment_delta: params.minSentimentDelta,
    p_max_sentiment_delta: params.maxSentimentDelta,
    p_velocity_tier: params.velocityTier,
    // Engagement filters
    p_min_active_pct: params.minActivePct,
    p_min_review_rate: params.minReviewRate,
    p_min_value_score: params.minValueScore,
    // Content filters
    p_genres: params.genres,
    p_genre_mode: params.genreMode ?? 'any',
    p_tags: params.tags,
    p_tag_mode: params.tagMode ?? 'any',
    p_categories: params.categories,
    p_has_workshop: params.hasWorkshop,
    // Platform filters
    p_platforms: params.platforms,
    p_platform_mode: params.platformMode ?? 'any',
    p_steam_deck: params.steamDeck,
    p_controller: params.controller,
    // Release filters
    p_min_age: params.minAge,
    p_max_age: params.maxAge,
    p_release_year: params.releaseYear,
    p_early_access: params.earlyAccess,
    p_min_hype: params.minHype,
    p_max_hype: params.maxHype,
    // Relationship filters
    p_publisher_search: params.publisherSearch,
    p_developer_search: params.developerSearch,
    p_self_published: params.selfPublished,
    p_min_vs_publisher: params.minVsPublisher,
    p_publisher_size: params.publisherSize,
    // Activity filters
    p_ccu_tier: params.ccuTier,
  });

  if (error) {
    console.error('Error fetching apps:', error);
    throw new Error(`Failed to fetch apps: ${error.message}`);
  }

  return (data ?? []) as App[];
}

/**
 * Fetch aggregate statistics for filtered apps
 * Note: Uses type assertion until database types are regenerated after migration
 */
export async function getAggregateStats(
  params: AppsFilterParams
): Promise<AggregateStats> {
  const supabase = getSupabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('get_apps_aggregate_stats', {
    p_type: params.type,
    p_search: params.search,
    p_min_ccu: params.minCcu,
    p_max_ccu: params.maxCcu,
    p_min_owners: params.minOwners,
    p_max_owners: params.maxOwners,
    p_min_reviews: params.minReviews,
    p_max_reviews: params.maxReviews,
    p_min_score: params.minScore,
    p_max_score: params.maxScore,
    p_min_price: params.minPrice,
    p_max_price: params.maxPrice,
    p_min_growth_7d: params.minGrowth7d,
    p_max_growth_7d: params.maxGrowth7d,
    p_genres: params.genres,
    p_tags: params.tags,
    p_categories: params.categories,
    p_steam_deck: params.steamDeck,
    p_ccu_tier: params.ccuTier,
  });

  if (error) {
    console.error('Error fetching aggregate stats:', error);
    return {
      total_games: 0,
      avg_ccu: null,
      avg_score: null,
      avg_momentum: null,
      trending_up_count: 0,
      trending_down_count: 0,
      sentiment_improving_count: 0,
      sentiment_declining_count: 0,
      avg_value_score: null,
    };
  }

  // RPC returns a single row
  const rows = (data ?? []) as AggregateStatsRow[];
  const row = rows[0];
  if (!row) {
    return {
      total_games: 0,
      avg_ccu: null,
      avg_score: null,
      avg_momentum: null,
      trending_up_count: 0,
      trending_down_count: 0,
      sentiment_improving_count: 0,
      sentiment_declining_count: 0,
      avg_value_score: null,
    };
  }
  return {
    total_games: Number(row.total_games) || 0,
    avg_ccu: row.avg_ccu ? Number(row.avg_ccu) : null,
    avg_score: row.avg_score ? Number(row.avg_score) : null,
    avg_momentum: row.avg_momentum ? Number(row.avg_momentum) : null,
    trending_up_count: Number(row.trending_up_count) || 0,
    trending_down_count: Number(row.trending_down_count) || 0,
    sentiment_improving_count: Number(row.sentiment_improving_count) || 0,
    sentiment_declining_count: Number(row.sentiment_declining_count) || 0,
    avg_value_score: row.avg_value_score ? Number(row.avg_value_score) : null,
  };
}

/**
 * Format large numbers compactly (e.g., 1.2M, 5.6K)
 */
export function formatCompactNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || n === 0) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * Format price in cents to USD string (e.g., $19.99)
 */
export function formatPrice(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  if (cents === 0) return 'Free';
  const usd = cents / 100;
  return `$${usd.toFixed(2)}`;
}

/**
 * Format percentage (e.g., 85%)
 */
export function formatPercentage(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${Math.round(n)}%`;
}

/**
 * Format playtime from minutes to hours
 */
export function formatPlaytime(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes === 0) return '—';
  const hours = minutes / 60;
  if (hours >= 100) return `${Math.round(hours)}h`;
  return `${hours.toFixed(1)}h`;
}

/**
 * Get user-facing label for app type
 */
export function getAppTypeLabel(type: string): string {
  switch (type) {
    case 'game':
      return 'Game';
    case 'dlc':
      return 'DLC';
    case 'demo':
      return 'Demo';
    case 'mod':
      return 'Mod';
    case 'video':
      return 'Video';
    case 'hardware':
      return 'Hardware';
    case 'music':
      return 'Music';
    default:
      return type;
  }
}
