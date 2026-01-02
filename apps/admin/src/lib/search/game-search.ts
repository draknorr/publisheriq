/**
 * Game Search Service
 *
 * Provides flexible game discovery with tag, genre, category, and PICS data filtering.
 * Uses EXISTS subqueries for efficient filtering without row multiplication.
 */

import { getSupabase } from '@/lib/supabase';

/**
 * Arguments for search_games tool
 */
export interface SearchGamesArgs {
  tags?: string[];
  genres?: string[];
  categories?: string[];
  platforms?: ('windows' | 'macos' | 'linux')[];
  controller_support?: 'full' | 'partial' | 'any';
  steam_deck?: ('verified' | 'playable')[];
  release_year?: { gte?: number; lte?: number };
  review_percentage?: { gte?: number };
  metacritic_score?: { gte?: number };
  is_free?: boolean;
  limit?: number;
  order_by?: 'reviews' | 'score' | 'release_date' | 'owners';
}

/**
 * Game result from search
 */
export interface GameSearchResult {
  appid: number;
  name: string;
  platforms: string | null;
  controller_support: string | null;
  steam_deck_category: string | null;
  release_year: number | null;
  review_percentage: number | null;
  metacritic_score: number | null;
  total_reviews: number | null;
  is_free: boolean;
}

/**
 * Debug info for search tracing
 */
export interface SearchDebugInfo {
  input_args: SearchGamesArgs;
  steps: string[];
  tag_candidates?: number;
  genre_candidates?: number;
  category_candidates?: number;
  steam_deck_candidates?: number;
  final_candidates?: number | null;
  query_rows_returned?: number;
  after_release_filter?: number;
  after_review_filter?: number;
  final_count?: number;
}

/**
 * Result from search_games
 */
export interface SearchGamesResult {
  success: boolean;
  results?: GameSearchResult[];
  total_found?: number;
  filters_applied?: string[];
  debug?: SearchDebugInfo;
  error?: string;
}

// Maximum results to prevent expensive queries
const MAX_RESULTS = 50;
const DEFAULT_RESULTS = 20;

/**
 * Search for games matching the specified criteria
 */
export async function searchGames(args: SearchGamesArgs): Promise<SearchGamesResult> {
  const {
    tags,
    genres,
    categories,
    platforms,
    controller_support,
    steam_deck,
    release_year,
    review_percentage,
    metacritic_score,
    is_free,
    limit = DEFAULT_RESULTS,
    order_by = 'reviews',
  } = args;

  // Debug logging
  const debug: SearchDebugInfo = {
    input_args: args,
    steps: [],
  };

  const filtersApplied: string[] = [];
  const actualLimit = Math.min(limit, MAX_RESULTS);
  debug.steps.push(`Starting search with limit=${actualLimit}`);

  try {
    const supabase = getSupabase();

    // Track which filters were applied
    if (tags && tags.length > 0) {
      filtersApplied.push(`tags: ${tags.join(', ')}`);
    }
    if (genres && genres.length > 0) {
      filtersApplied.push(`genres: ${genres.join(', ')}`);
    }
    if (categories && categories.length > 0) {
      filtersApplied.push(`categories: ${categories.join(', ')}`);
    }
    if (platforms && platforms.length > 0) {
      filtersApplied.push(`platforms: ${platforms.join(', ')}`);
    }
    if (controller_support) {
      filtersApplied.push(`controller_support: ${controller_support}`);
    }
    if (steam_deck && steam_deck.length > 0) {
      filtersApplied.push(`steam_deck: ${steam_deck.join(', ')}`);
    }
    if (release_year?.gte !== undefined) {
      filtersApplied.push(`release_year >= ${release_year.gte}`);
    }
    if (release_year?.lte !== undefined) {
      filtersApplied.push(`release_year <= ${release_year.lte}`);
    }
    if (review_percentage?.gte !== undefined) {
      filtersApplied.push(`review_percentage >= ${review_percentage.gte}`);
    }
    if (metacritic_score?.gte !== undefined) {
      filtersApplied.push(`metacritic_score >= ${metacritic_score.gte}`);
    }
    if (is_free !== undefined) {
      filtersApplied.push(`is_free: ${is_free}`);
    }

    // We use a hybrid approach:
    // 1. Get candidate appids from tag/genre/category filters (can't do complex JOINs in Supabase)
    // 2. Use Supabase query builder for remaining filters

    // Step 1: Get candidate appids from tag/genre/category filters
    let candidateAppids: number[] | null = null;

    if (tags && tags.length > 0) {
      // Get appids matching ALL specified tags
      debug.steps.push(`Filtering by ${tags.length} tags: ${tags.join(', ')}`);
      const tagAppids = await getAppidsMatchingTags(supabase, tags);
      debug.tag_candidates = tagAppids.length;
      debug.steps.push(`Tags filter returned ${tagAppids.length} candidate appids`);
      candidateAppids = tagAppids;
    }

    if (genres && genres.length > 0) {
      debug.steps.push(`Filtering by ${genres.length} genres: ${genres.join(', ')}`);
      let genreAppids = await getAppidsMatchingGenres(supabase, genres);
      debug.genre_candidates = genreAppids.length;
      debug.steps.push(`Genres filter returned ${genreAppids.length} candidate appids`);

      // Fallback: if genres returned nothing, try the same terms as tags
      if (genreAppids.length === 0) {
        debug.steps.push('Genres returned 0, trying as tags fallback');
        const tagFallback = await getAppidsMatchingTags(supabase, genres);
        if (tagFallback.length > 0) {
          debug.steps.push(`Tag fallback found ${tagFallback.length} results`);
          genreAppids = tagFallback;
          debug.genre_candidates = tagFallback.length;
        }
      }

      if (candidateAppids) {
        const before = candidateAppids.length;
        candidateAppids = candidateAppids.filter((id) => genreAppids.includes(id));
        debug.steps.push(`After genre intersection: ${candidateAppids.length} (was ${before})`);
      } else {
        candidateAppids = genreAppids;
      }
    }

    if (categories && categories.length > 0) {
      debug.steps.push(`Filtering by ${categories.length} categories: ${categories.join(', ')}`);
      const categoryAppids = await getAppidsMatchingCategories(supabase, categories);
      debug.category_candidates = categoryAppids.length;
      debug.steps.push(`Categories filter returned ${categoryAppids.length} candidate appids`);
      if (candidateAppids) {
        const before = candidateAppids.length;
        candidateAppids = candidateAppids.filter((id) => categoryAppids.includes(id));
        debug.steps.push(`After category intersection: ${candidateAppids.length} (was ${before})`);
      } else {
        candidateAppids = categoryAppids;
      }
    }

    // Steam Deck filtering - do this at database level, not post-process
    if (steam_deck && steam_deck.length > 0) {
      debug.steps.push(`Filtering by Steam Deck: ${steam_deck.join(', ')}`);
      const { data: deckApps } = await supabase
        .from('app_steam_deck')
        .select('appid')
        .in('category', steam_deck);

      const deckAppids = deckApps?.map((a) => a.appid) || [];
      debug.steam_deck_candidates = deckAppids.length;
      debug.steps.push(`Steam Deck filter returned ${deckAppids.length} candidate appids`);

      if (candidateAppids) {
        const before = candidateAppids.length;
        candidateAppids = candidateAppids.filter((id) => deckAppids.includes(id));
        debug.steps.push(`After Steam Deck intersection: ${candidateAppids.length} (was ${before})`);
      } else {
        candidateAppids = deckAppids;
      }
    }

    // If we have candidate appids from tag/genre/category/steam_deck filtering but none match, return early
    debug.final_candidates = candidateAppids?.length ?? null;
    if (candidateAppids !== null && candidateAppids.length === 0) {
      debug.steps.push('No candidates remain after filtering, returning empty');
      return {
        success: true,
        results: [],
        total_found: 0,
        filters_applied: filtersApplied,
        debug,
      };
    }
    debug.steps.push(`Final candidate count before main query: ${candidateAppids?.length ?? 'unlimited'}`);

    // Step 2: Build main query with remaining filters
    let queryBuilder = supabase
      .from('apps')
      .select(
        `
        appid,
        name,
        platforms,
        controller_support,
        is_free,
        release_date,
        pics_review_percentage,
        metacritic_score,
        app_steam_deck!left(category),
        latest_daily_metrics!left(total_reviews, positive_percentage, owners_midpoint)
      `
      )
      .eq('type', 'game')
      .eq('is_delisted', false)
      .eq('is_released', true);

    // Apply appid filter if we have candidates from tag/genre/category
    if (candidateAppids !== null) {
      // Limit candidates to prevent oversized IN clause
      const limitedCandidates = candidateAppids.slice(0, 1000);
      queryBuilder = queryBuilder.in('appid', limitedCandidates);
    }

    // Platform filters
    if (platforms && platforms.length > 0) {
      const platformFilters = platforms.map((p) => `platforms.ilike.%${p}%`);
      queryBuilder = queryBuilder.or(platformFilters.join(','));
    }

    // Controller support
    if (controller_support) {
      if (controller_support === 'any') {
        queryBuilder = queryBuilder.in('controller_support', ['full', 'partial']);
      } else {
        queryBuilder = queryBuilder.eq('controller_support', controller_support);
      }
    }

    // Free to play
    if (is_free !== undefined) {
      queryBuilder = queryBuilder.eq('is_free', is_free);
    }

    // Release year filtering (needs to be done post-query for complex operators)
    // Metacritic score
    if (metacritic_score?.gte !== undefined) {
      queryBuilder = queryBuilder.gte('metacritic_score', metacritic_score.gte);
    }

    // Execute query
    const { data, error } = await queryBuilder.limit(actualLimit * 2); // Get extra for filtering

    if (error) {
      debug.steps.push(`Query error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        debug,
      };
    }

    debug.query_rows_returned = data?.length ?? 0;
    debug.steps.push(`Main query returned ${data?.length ?? 0} rows`);

    // Define the row type for proper typing
    interface QueryRow {
      appid: number;
      name: string;
      platforms: string | null;
      controller_support: string | null;
      is_free: boolean;
      release_date: string | null;
      pics_review_percentage: number | null;
      metacritic_score: number | null;
      app_steam_deck: { category: string }[] | null;
      latest_daily_metrics: {
        total_reviews: number;
        positive_percentage: number;
        owners_midpoint: number;
      }[] | null;
    }

    // Post-process results - map first
    const mappedResults = ((data || []) as QueryRow[])
      .map((row) => {
        const steamDeck = row.app_steam_deck;
        const metrics = row.latest_daily_metrics;
        const releaseYear = row.release_date ? new Date(row.release_date).getFullYear() : null;
        const reviewPct =
          metrics?.[0]?.positive_percentage ?? row.pics_review_percentage ?? null;

        return {
          appid: row.appid,
          name: row.name,
          platforms: row.platforms,
          controller_support: row.controller_support,
          steam_deck_category: steamDeck?.[0]?.category ?? null,
          release_year: releaseYear,
          review_percentage: reviewPct,
          metacritic_score: row.metacritic_score,
          total_reviews: metrics?.[0]?.total_reviews ?? null,
          is_free: row.is_free,
          _owners_midpoint: metrics?.[0]?.owners_midpoint ?? null,
        };
      });

    debug.steps.push(`Mapped ${mappedResults.length} results`);

    // Filter by release year (can't do complex date extraction in Supabase)
    const afterReleaseFilter = mappedResults.filter((r) => {
      if (release_year?.gte !== undefined && (r.release_year === null || r.release_year < release_year.gte)) {
        return false;
      }
      if (release_year?.lte !== undefined && (r.release_year === null || r.release_year > release_year.lte)) {
        return false;
      }
      return true;
    });

    debug.after_release_filter = afterReleaseFilter.length;
    if (release_year?.gte !== undefined || release_year?.lte !== undefined) {
      debug.steps.push(`After release year filter: ${afterReleaseFilter.length} (from ${mappedResults.length})`);
    }

    // Filter by review percentage
    const results = afterReleaseFilter.filter((r) => {
      if (review_percentage?.gte !== undefined) {
        return r.review_percentage !== null && r.review_percentage >= review_percentage.gte;
      }
      return true;
    });

    debug.after_review_filter = results.length;
    if (review_percentage?.gte !== undefined) {
      debug.steps.push(`After review % filter (>=${review_percentage.gte}): ${results.length} (from ${afterReleaseFilter.length})`);
    }
    // Steam Deck filtering is now done at database level (candidate appids)

    // Sort results
    results.sort((a, b) => {
      switch (order_by) {
        case 'score':
          return (b.review_percentage ?? 0) - (a.review_percentage ?? 0);
        case 'release_date':
          return (b.release_year ?? 0) - (a.release_year ?? 0);
        case 'owners':
          return ((b as unknown as { _owners_midpoint: number })._owners_midpoint ?? 0) -
            ((a as unknown as { _owners_midpoint: number })._owners_midpoint ?? 0);
        case 'reviews':
        default:
          return (b.total_reviews ?? 0) - (a.total_reviews ?? 0);
      }
    });

    // Remove internal field and limit results
    const finalResults = results.slice(0, actualLimit).map((r) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _owners_midpoint, ...rest } = r as typeof r & { _owners_midpoint?: number };
      return rest as GameSearchResult;
    });

    debug.final_count = finalResults.length;
    debug.steps.push(`Final result count: ${finalResults.length}`);

    return {
      success: true,
      results: finalResults,
      total_found: finalResults.length,
      filters_applied: filtersApplied,
      debug,
    };
  } catch (error) {
    debug.steps.push(`Exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
      debug,
    };
  }
}

/**
 * Get appids matching all specified tags (fuzzy match)
 */
async function getAppidsMatchingTags(
  supabase: ReturnType<typeof getSupabase>,
  tags: string[]
): Promise<number[]> {
  // For each tag, get matching appids, then intersect
  const appidSets: Set<number>[] = [];

  for (const tag of tags) {
    // Get tag IDs matching the fuzzy pattern
    const { data: matchingTags } = await supabase
      .from('steam_tags')
      .select('tag_id')
      .ilike('name', `%${tag}%`);

    if (!matchingTags || matchingTags.length === 0) {
      return []; // No matching tags means no results
    }

    const tagIds = matchingTags.map((t) => t.tag_id);

    // Get appids with these tags
    const { data: appTags } = await supabase
      .from('app_steam_tags')
      .select('appid')
      .in('tag_id', tagIds);

    if (!appTags || appTags.length === 0) {
      return [];
    }

    appidSets.push(new Set(appTags.map((a) => a.appid)));
  }

  // Intersect all sets
  if (appidSets.length === 0) return [];
  let result = appidSets[0];
  for (let i = 1; i < appidSets.length; i++) {
    result = new Set([...result].filter((id) => appidSets[i].has(id)));
  }

  return [...result];
}

/**
 * Get appids matching all specified genres (fuzzy match)
 */
async function getAppidsMatchingGenres(
  supabase: ReturnType<typeof getSupabase>,
  genres: string[]
): Promise<number[]> {
  const appidSets: Set<number>[] = [];

  for (const genre of genres) {
    const { data: matchingGenres } = await supabase
      .from('steam_genres')
      .select('genre_id')
      .ilike('name', `%${genre}%`);

    if (!matchingGenres || matchingGenres.length === 0) {
      return [];
    }

    const genreIds = matchingGenres.map((g) => g.genre_id);

    const { data: appGenres } = await supabase
      .from('app_genres')
      .select('appid')
      .in('genre_id', genreIds);

    if (!appGenres || appGenres.length === 0) {
      return [];
    }

    appidSets.push(new Set(appGenres.map((a) => a.appid)));
  }

  if (appidSets.length === 0) return [];
  let result = appidSets[0];
  for (let i = 1; i < appidSets.length; i++) {
    result = new Set([...result].filter((id) => appidSets[i].has(id)));
  }

  return [...result];
}

/**
 * Get appids matching all specified categories (fuzzy match)
 */
async function getAppidsMatchingCategories(
  supabase: ReturnType<typeof getSupabase>,
  categories: string[]
): Promise<number[]> {
  const appidSets: Set<number>[] = [];

  for (const category of categories) {
    const { data: matchingCategories } = await supabase
      .from('steam_categories')
      .select('category_id')
      .ilike('name', `%${category}%`);

    if (!matchingCategories || matchingCategories.length === 0) {
      return [];
    }

    const categoryIds = matchingCategories.map((c) => c.category_id);

    const { data: appCategories } = await supabase
      .from('app_categories')
      .select('appid')
      .in('category_id', categoryIds);

    if (!appCategories || appCategories.length === 0) {
      return [];
    }

    appidSets.push(new Set(appCategories.map((a) => a.appid)));
  }

  if (appidSets.length === 0) return [];
  let result = appidSets[0];
  for (let i = 1; i < appidSets.length; i++) {
    result = new Set([...result].filter((id) => appidSets[i].has(id)));
  }

  return [...result];
}
