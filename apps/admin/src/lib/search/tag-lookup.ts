/**
 * Tag/Genre/Category Lookup Service
 *
 * Provides fast in-memory cached lookups for Steam tags, genres, and categories.
 * Cache is loaded on first request and refreshed every hour.
 */

import { getSupabase } from '@/lib/supabase';

// Cache structure
interface TagCache {
  tags: string[];
  genres: string[];
  categories: string[];
  loadedAt: number;
}

let tagCache: TagCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Load or return cached tag/genre/category data
 */
async function getTagCache(): Promise<TagCache> {
  // Return cached data if still valid
  if (tagCache && Date.now() - tagCache.loadedAt < CACHE_TTL_MS) {
    return tagCache;
  }

  const supabase = getSupabase();

  // Load all in parallel
  const [tagsResult, genresResult, categoriesResult] = await Promise.all([
    supabase.from('steam_tags').select('name').order('name'),
    supabase.from('steam_genres').select('name').order('name'),
    supabase.from('steam_categories').select('name').order('name'),
  ]);

  tagCache = {
    tags: (tagsResult.data || []).map((t) => t.name),
    genres: (genresResult.data || []).map((g) => g.name),
    categories: (categoriesResult.data || []).map((c) => c.name),
    loadedAt: Date.now(),
  };

  return tagCache;
}

/**
 * Arguments for lookup_tags tool
 */
export interface LookupTagsArgs {
  query: string;
  type?: 'tags' | 'genres' | 'categories' | 'all';
  limit?: number;
}

/**
 * Result from lookup_tags
 */
export interface LookupTagsResult {
  success: boolean;
  query: string;
  results: {
    tags?: string[];
    genres?: string[];
    categories?: string[];
  };
  error?: string;
}

/**
 * Search for matching tags, genres, and/or categories
 */
export async function lookupTags(args: LookupTagsArgs): Promise<LookupTagsResult> {
  const { query, type = 'all', limit = 10 } = args;

  if (!query || query.trim().length === 0) {
    return {
      success: false,
      query,
      results: {},
      error: 'Query is required',
    };
  }

  try {
    const cache = await getTagCache();
    const queryLower = query.toLowerCase().trim();
    const maxResults = Math.min(limit, 20); // Hard cap at 20

    // Filter function - case-insensitive contains
    const matches = (items: string[]): string[] =>
      items.filter((item) => item.toLowerCase().includes(queryLower)).slice(0, maxResults);

    const results: LookupTagsResult['results'] = {};

    if (type === 'all' || type === 'tags') {
      results.tags = matches(cache.tags);
    }
    if (type === 'all' || type === 'genres') {
      results.genres = matches(cache.genres);
    }
    if (type === 'all' || type === 'categories') {
      results.categories = matches(cache.categories);
    }

    return {
      success: true,
      query,
      results,
    };
  } catch (error) {
    return {
      success: false,
      query,
      results: {},
      error: error instanceof Error ? error.message : 'Failed to lookup tags',
    };
  }
}

/**
 * Get all cached tags (for use in game search validation)
 */
export async function getAllTags(): Promise<string[]> {
  const cache = await getTagCache();
  return cache.tags;
}

/**
 * Get all cached genres
 */
export async function getAllGenres(): Promise<string[]> {
  const cache = await getTagCache();
  return cache.genres;
}

/**
 * Get all cached categories
 */
export async function getAllCategories(): Promise<string[]> {
  const cache = await getTagCache();
  return cache.categories;
}
