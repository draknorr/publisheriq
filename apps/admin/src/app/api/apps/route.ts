import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import type { AppsFilterParams, AggregateStats } from '@/app/(main)/apps/lib/apps-types';

/**
 * Default aggregate stats (used as fallback when stats query fails)
 */
const DEFAULT_STATS: AggregateStats = {
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

/**
 * In-memory cache for default view results.
 * When no filters are applied, the database must scan all ~200K apps which takes 5+ seconds.
 * Caching the default view (Top 50 by CCU) provides instant response when clearing filters.
 */
const defaultViewCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Check if this is a default view request (no filters applied).
 * Default view = type filter only + default sort (ccu_peak desc) + first page
 */
function isDefaultView(params: AppsFilterParams): boolean {
  return (
    // No search
    !params.search &&
    // No metric filters
    params.minCcu === undefined &&
    params.maxCcu === undefined &&
    params.minOwners === undefined &&
    params.maxOwners === undefined &&
    params.minReviews === undefined &&
    params.maxReviews === undefined &&
    params.minScore === undefined &&
    params.maxScore === undefined &&
    params.minPrice === undefined &&
    params.maxPrice === undefined &&
    params.minPlaytime === undefined &&
    params.maxPlaytime === undefined &&
    // No growth filters
    params.minGrowth7d === undefined &&
    params.maxGrowth7d === undefined &&
    params.minGrowth30d === undefined &&
    params.maxGrowth30d === undefined &&
    params.minMomentum === undefined &&
    params.maxMomentum === undefined &&
    // No sentiment filters
    params.minSentimentDelta === undefined &&
    params.maxSentimentDelta === undefined &&
    params.velocityTier === undefined &&
    // No engagement filters
    params.minActivePct === undefined &&
    params.minReviewRate === undefined &&
    params.minValueScore === undefined &&
    // No content filters
    !params.genres?.length &&
    !params.tags?.length &&
    !params.categories?.length &&
    params.hasWorkshop === undefined &&
    // No platform filters
    !params.platforms?.length &&
    params.steamDeck === undefined &&
    params.controller === undefined &&
    // No release filters
    params.minAge === undefined &&
    params.maxAge === undefined &&
    params.releaseYear === undefined &&
    params.earlyAccess === undefined &&
    params.minHype === undefined &&
    params.maxHype === undefined &&
    // No relationship filters
    !params.publisherSearch &&
    !params.developerSearch &&
    params.selfPublished === undefined &&
    params.minVsPublisher === undefined &&
    params.publisherSize === undefined &&
    // No activity filters
    params.ccuTier === undefined &&
    // No boolean filters
    params.isFree === undefined &&
    // Default sort and first page
    params.sort === 'ccu_peak' &&
    params.order === 'desc' &&
    (params.offset ?? 0) === 0
  );
}

/**
 * API route for fetching apps data
 * Used by client-side React Query for data fetching
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Parse query parameters
  const parseNumber = (val: string | null): number | undefined => {
    if (!val) return undefined;
    const n = parseFloat(val);
    return isNaN(n) ? undefined : n;
  };

  const parseBoolean = (val: string | null): boolean | undefined => {
    if (!val) return undefined;
    return val === 'true';
  };

  const parseNumberArray = (val: string | null): number[] | undefined => {
    if (!val) return undefined;
    return val
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
  };

  const parseStringArray = (val: string | null): string[] | undefined => {
    if (!val) return undefined;
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  };

  // Build filter params
  const params: AppsFilterParams = {
    type: (searchParams.get('type') as AppsFilterParams['type']) || 'game',
    sort: (searchParams.get('sort') as AppsFilterParams['sort']) || 'ccu_peak',
    order: (searchParams.get('order') as AppsFilterParams['order']) || 'desc',
    limit: parseNumber(searchParams.get('limit')) ?? 50,
    offset: parseNumber(searchParams.get('offset')) ?? 0,
    search: searchParams.get('search') || undefined,

    // Metric filters
    minCcu: parseNumber(searchParams.get('minCcu')),
    maxCcu: parseNumber(searchParams.get('maxCcu')),
    minOwners: parseNumber(searchParams.get('minOwners')),
    maxOwners: parseNumber(searchParams.get('maxOwners')),
    minReviews: parseNumber(searchParams.get('minReviews')),
    maxReviews: parseNumber(searchParams.get('maxReviews')),
    minScore: parseNumber(searchParams.get('minScore')),
    maxScore: parseNumber(searchParams.get('maxScore')),
    minPrice: parseNumber(searchParams.get('minPrice')),
    maxPrice: parseNumber(searchParams.get('maxPrice')),
    minPlaytime: parseNumber(searchParams.get('minPlaytime')),
    maxPlaytime: parseNumber(searchParams.get('maxPlaytime')),

    // Growth filters
    minGrowth7d: parseNumber(searchParams.get('minGrowth7d')),
    maxGrowth7d: parseNumber(searchParams.get('maxGrowth7d')),
    minGrowth30d: parseNumber(searchParams.get('minGrowth30d')),
    maxGrowth30d: parseNumber(searchParams.get('maxGrowth30d')),
    minMomentum: parseNumber(searchParams.get('minMomentum')),
    maxMomentum: parseNumber(searchParams.get('maxMomentum')),

    // Sentiment filters
    minSentimentDelta: parseNumber(searchParams.get('minSentimentDelta')),
    maxSentimentDelta: parseNumber(searchParams.get('maxSentimentDelta')),
    velocityTier: searchParams.get('velocityTier') as AppsFilterParams['velocityTier'],

    // Engagement filters
    minActivePct: parseNumber(searchParams.get('minActivePct')),
    minReviewRate: parseNumber(searchParams.get('minReviewRate')),
    minValueScore: parseNumber(searchParams.get('minValueScore')),

    // Content filters
    genres: parseNumberArray(searchParams.get('genres')),
    genreMode: (searchParams.get('genreMode') as 'any' | 'all') || 'all', // Default 'all' so adding tags narrows results
    tags: parseNumberArray(searchParams.get('tags')),
    tagMode: (searchParams.get('tagMode') as 'any' | 'all') || 'all', // Default 'all' so adding tags narrows results
    categories: parseNumberArray(searchParams.get('categories')),
    hasWorkshop: parseBoolean(searchParams.get('hasWorkshop')),

    // Platform filters
    platforms: parseStringArray(searchParams.get('platforms')),
    platformMode: (searchParams.get('platformMode') as 'any' | 'all') || 'all', // Default 'all' so adding platforms narrows results
    steamDeck: searchParams.get('steamDeck') || undefined,
    controller: searchParams.get('controller') || undefined,

    // Release filters
    minAge: parseNumber(searchParams.get('minAge')),
    maxAge: parseNumber(searchParams.get('maxAge')),
    releaseYear: parseNumber(searchParams.get('releaseYear')),
    earlyAccess: parseBoolean(searchParams.get('earlyAccess')),
    minHype: parseNumber(searchParams.get('minHype')),
    maxHype: parseNumber(searchParams.get('maxHype')),

    // Relationship filters
    publisherSearch: searchParams.get('publisherSearch') || undefined,
    developerSearch: searchParams.get('developerSearch') || undefined,
    selfPublished: parseBoolean(searchParams.get('selfPublished')),
    minVsPublisher: parseNumber(searchParams.get('minVsPublisher')),
    publisherSize: searchParams.get('publisherSize') as AppsFilterParams['publisherSize'],

    // Activity filters
    ccuTier: parseNumber(searchParams.get('ccuTier')) as AppsFilterParams['ccuTier'],

    // Boolean filters
    isFree: parseBoolean(searchParams.get('isFree')),
  };

  // NOTE: isFree filter requires adding p_is_free parameter to get_apps_with_filters RPC
  // For now, the isFree filter is parsed but not applied at the database level
  // TODO: Add p_is_free parameter to database function to filter on apps.is_free column

  // Check cache for default view (no filters = expensive full table scan)
  const cacheKey = `default-${params.type}`;
  if (isDefaultView(params)) {
    const cached = defaultViewCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }
  }

  try {
    const supabase = getSupabase();

    // Fetch apps data and aggregate stats in parallel
    const [appsResult, statsResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.rpc as any)('get_apps_with_filters', {
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
        p_genre_mode: params.genreMode ?? 'all', // Default 'all' so adding tags narrows results
        p_tags: params.tags,
        p_tag_mode: params.tagMode ?? 'all', // Default 'all' so adding tags narrows results
        p_categories: params.categories,
        p_has_workshop: params.hasWorkshop,
        // Platform filters
        p_platforms: params.platforms,
        p_platform_mode: params.platformMode ?? 'all', // Default 'all' so adding platforms narrows results
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
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.rpc as any)('get_apps_aggregate_stats', {
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
      }),
    ]);

    if (appsResult.error) {
      console.error('Error fetching apps:', appsResult.error);
      return NextResponse.json(
        { error: appsResult.error.message },
        { status: 500 }
      );
    }

    // Parse stats result (returns array with single row)
    let stats: AggregateStats = DEFAULT_STATS;
    if (!statsResult.error && statsResult.data && statsResult.data.length > 0) {
      const row = statsResult.data[0];
      stats = {
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
    } else if (statsResult.error) {
      console.error('Error fetching aggregate stats:', statsResult.error);
      // Continue with default stats - don't fail the whole request
    }

    const result = { data: appsResult.data ?? [], stats };

    // Cache default view results for fast subsequent loads
    if (isDefaultView(params)) {
      defaultViewCache.set(cacheKey, { data: result, timestamp: Date.now() });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in apps API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
