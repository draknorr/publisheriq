import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import type { AppsFilterParams } from '@/app/(main)/apps/lib/apps-types';

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
  };

  try {
    const supabase = getSupabase();

    // Fetch apps data
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
    });

    if (error) {
      console.error('Error fetching apps:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    console.error('Error in apps API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
