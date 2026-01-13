/**
 * Game Search Service
 *
 * Provides flexible game discovery with tag, genre, category, and PICS data filtering.
 * Uses EXISTS subqueries for efficient filtering without row multiplication.
 */

import { getSupabase } from '@/lib/supabase';

/**
 * Common tag/category name normalizations
 * Maps user input variants to canonical database names
 */
const TAG_NORMALIZATIONS: Record<string, string> = {
  'coop': 'co-op',
  'coops': 'co-op',
  'cooperative': 'co-op',
};

function normalizeSearchTerm(term: string): string {
  const lower = term.toLowerCase();
  return TAG_NORMALIZATIONS[lower] || term;
}

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
  on_sale?: boolean;
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
  priceDollars: number | null;
  discountPercent: number | null;
  publisherId: number | null;
  publisherName: string | null;
  developerId: number | null;
  developerName: string | null;
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
    on_sale,
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
    if (on_sale === true) {
      filtersApplied.push('on_sale: true');
    }

    // We use a hybrid approach:
    // 1. Get candidate appids from tag/genre/category filters (can't do complex JOINs in Supabase)
    // 2. Use Supabase query builder for remaining filters

    // Step 1: Get candidate appids from tag/genre/category filters
    let candidateAppids: number[] | null = null;

    if (tags && tags.length > 0) {
      // Normalize tag names for common variants (e.g., "coop" -> "co-op")
      const normalizedTags = tags.map(normalizeSearchTerm);
      debug.steps.push(`Filtering by ${normalizedTags.length} tags: ${normalizedTags.join(', ')}`);
      let tagAppids = await getAppidsMatchingTags(supabase, normalizedTags);
      debug.tag_candidates = tagAppids.length;
      debug.steps.push(`Tags filter returned ${tagAppids.length} candidate appids`);

      // Fallback: if tags returned nothing, try the same terms as categories
      if (tagAppids.length === 0) {
        debug.steps.push('Tags returned 0, trying as categories fallback');
        const categoryFallback = await getAppidsMatchingCategories(supabase, normalizedTags);
        if (categoryFallback.length > 0) {
          debug.steps.push(`Category fallback found ${categoryFallback.length} results`);
          tagAppids = categoryFallback;
          debug.tag_candidates = categoryFallback.length;
        }
      }

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
        current_price_cents,
        current_discount_percent,
        pics_review_percentage,
        metacritic_score,
        app_steam_deck!left(category),
        latest_daily_metrics!left(total_reviews, positive_percentage, owners_midpoint),
        app_publishers!left(publishers!left(id, name)),
        app_developers!left(developers!left(id, name))
      `
      )
      .eq('type', 'game')
      .eq('is_delisted', false)
      .eq('is_released', true);

    // Apply appid filter if we have candidates from tag/genre/category
    if (candidateAppids !== null) {
      // Limit candidates to prevent oversized IN clause
      // Use higher limit (3000) since DB-level filters will reduce the result set
      const limitedCandidates = candidateAppids.slice(0, 3000);
      if (candidateAppids.length > 3000) {
        debug.steps.push(`Warning: truncated ${candidateAppids.length} candidates to 3000`);
      }
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

    // On sale - filter to only discounted games
    if (on_sale === true) {
      queryBuilder = queryBuilder.gt('current_discount_percent', 0);
    }

    // Release year filtering - filter at database level for efficiency
    if (release_year?.gte !== undefined) {
      queryBuilder = queryBuilder.gte('release_date', `${release_year.gte}-01-01`);
      debug.steps.push(`Adding release year >= ${release_year.gte} filter`);
    }
    if (release_year?.lte !== undefined) {
      queryBuilder = queryBuilder.lte('release_date', `${release_year.lte}-12-31`);
      debug.steps.push(`Adding release year <= ${release_year.lte} filter`);
    }

    // Metacritic score
    if (metacritic_score?.gte !== undefined) {
      queryBuilder = queryBuilder.gte('metacritic_score', metacritic_score.gte);
    }

    // Review percentage - filter at DB level using pics_review_percentage
    // This is a first-pass filter; we'll refine with latest_daily_metrics in post-processing
    // IMPORTANT: Allow NULLs through since latest_daily_metrics may have the review data
    if (review_percentage?.gte !== undefined) {
      // Use a slightly lower threshold at DB level since latest_daily_metrics might have higher values
      const dbThreshold = Math.max(0, review_percentage.gte - 5);
      // Allow rows where pics_review_percentage >= threshold OR is NULL (post-filter will check latest_daily_metrics)
      queryBuilder = queryBuilder.or(`pics_review_percentage.gte.${dbThreshold},pics_review_percentage.is.null`);
      debug.steps.push(`Adding DB-level review % >= ${dbThreshold} OR NULL filter (target: ${review_percentage.gte})`);
    }

    // Determine fetch limit based on filtering needs
    // If we have post-filters that can't be fully pushed to DB, fetch more rows
    const hasPostFilters = review_percentage?.gte !== undefined;
    const fetchMultiplier = hasPostFilters ? 5 : 2;
    const fetchLimit = actualLimit * fetchMultiplier;

    // Add ordering at DB level to get best candidates first
    // This ensures we fetch the most relevant rows before hitting the limit
    switch (order_by) {
      case 'score':
        queryBuilder = queryBuilder.order('pics_review_percentage', { ascending: false, nullsFirst: false });
        break;
      case 'release_date':
        queryBuilder = queryBuilder.order('release_date', { ascending: false, nullsFirst: false });
        break;
      // For 'reviews' and 'owners', we can't order at DB level (requires join data)
      // Fall back to release_date to get newer games first
      default:
        queryBuilder = queryBuilder.order('release_date', { ascending: false, nullsFirst: false });
    }

    // Execute query
    const { data, error } = await queryBuilder.limit(fetchLimit);

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
      current_price_cents: number | null;
      current_discount_percent: number | null;
      pics_review_percentage: number | null;
      metacritic_score: number | null;
      app_steam_deck: { category: string }[] | null;
      latest_daily_metrics: {
        total_reviews: number;
        positive_percentage: number;
        owners_midpoint: number;
      }[] | null;
      app_publishers: { publishers: { id: number; name: string } | null }[] | null;
      app_developers: { developers: { id: number; name: string } | null }[] | null;
    }

    // Post-process results - map first
    const mappedResults = ((data || []) as QueryRow[])
      .map((row) => {
        const steamDeck = row.app_steam_deck;
        const metrics = row.latest_daily_metrics;
        const releaseYear = row.release_date ? new Date(row.release_date).getFullYear() : null;
        const reviewPct =
          metrics?.[0]?.positive_percentage ?? row.pics_review_percentage ?? null;
        const priceDollars = row.current_price_cents ? row.current_price_cents / 100 : null;

        // Extract first publisher (games can have multiple, take first)
        const firstPublisher = row.app_publishers?.[0]?.publishers;
        const publisherId = firstPublisher?.id ?? null;
        const publisherName = firstPublisher?.name ?? null;

        // Extract first developer
        const firstDeveloper = row.app_developers?.[0]?.developers;
        const developerId = firstDeveloper?.id ?? null;
        const developerName = firstDeveloper?.name ?? null;

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
          priceDollars,
          discountPercent: row.current_discount_percent ?? null,
          publisherId,
          publisherName,
          developerId,
          developerName,
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
