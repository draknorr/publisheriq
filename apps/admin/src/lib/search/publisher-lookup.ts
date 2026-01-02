/**
 * Publisher/Developer Lookup Service
 *
 * Provides fast in-memory cached lookups for publisher and developer names.
 * Cache is loaded on first request and refreshed every hour.
 */

import { getSupabase } from '@/lib/supabase';

// Cache structure
interface EntityCache {
  publishers: Array<{ id: number; name: string }>;
  developers: Array<{ id: number; name: string }>;
  loadedAt: number;
}

let entityCache: EntityCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Load or return cached publisher/developer data
 */
async function getEntityCache(): Promise<EntityCache> {
  // Return cached data if still valid
  if (entityCache && Date.now() - entityCache.loadedAt < CACHE_TTL_MS) {
    return entityCache;
  }

  const supabase = getSupabase();

  // Load all in parallel - use high limit to get all entities (Supabase default is 1000)
  const [publishersResult, developersResult] = await Promise.all([
    supabase.from('publishers').select('id, name').order('name').limit(50000),
    supabase.from('developers').select('id, name').order('name').limit(50000),
  ]);

  // Log errors if queries failed
  if (publishersResult.error) {
    console.error('Publisher lookup cache error:', publishersResult.error);
  }
  if (developersResult.error) {
    console.error('Developer lookup cache error:', developersResult.error);
  }

  // Log cache stats for debugging
  console.log(`Lookup cache loaded: ${publishersResult.data?.length ?? 0} publishers, ${developersResult.data?.length ?? 0} developers`);

  entityCache = {
    publishers: (publishersResult.data || []).map((p) => ({ id: p.id, name: p.name })),
    developers: (developersResult.data || []).map((d) => ({ id: d.id, name: d.name })),
    loadedAt: Date.now(),
  };

  return entityCache;
}

/**
 * Arguments for lookup_publishers tool
 */
export interface LookupPublishersArgs {
  query: string;
  limit?: number;
}

/**
 * Result from lookup_publishers
 */
export interface LookupPublishersResult {
  success: boolean;
  query: string;
  results: Array<{ id: number; name: string }>;
  error?: string;
}

/**
 * Search for matching publisher names
 */
export async function lookupPublishers(args: LookupPublishersArgs): Promise<LookupPublishersResult> {
  const { query, limit = 10 } = args;

  if (!query || query.trim().length === 0) {
    return {
      success: false,
      query,
      results: [],
      error: 'Query is required',
    };
  }

  try {
    const cache = await getEntityCache();
    const queryLower = query.toLowerCase().trim();
    const maxResults = Math.min(limit, 20); // Hard cap at 20

    // Filter function - case-insensitive contains
    const results = cache.publishers
      .filter((p) => p.name.toLowerCase().includes(queryLower))
      .slice(0, maxResults);

    return {
      success: true,
      query,
      results,
    };
  } catch (error) {
    return {
      success: false,
      query,
      results: [],
      error: error instanceof Error ? error.message : 'Failed to lookup publishers',
    };
  }
}

/**
 * Arguments for lookup_developers tool
 */
export interface LookupDevelopersArgs {
  query: string;
  limit?: number;
}

/**
 * Result from lookup_developers
 */
export interface LookupDevelopersResult {
  success: boolean;
  query: string;
  results: Array<{ id: number; name: string }>;
  error?: string;
}

/**
 * Search for matching developer names
 */
export async function lookupDevelopers(args: LookupDevelopersArgs): Promise<LookupDevelopersResult> {
  const { query, limit = 10 } = args;

  if (!query || query.trim().length === 0) {
    return {
      success: false,
      query,
      results: [],
      error: 'Query is required',
    };
  }

  try {
    const cache = await getEntityCache();
    const queryLower = query.toLowerCase().trim();
    const maxResults = Math.min(limit, 20); // Hard cap at 20

    // Filter function - case-insensitive contains
    const results = cache.developers
      .filter((d) => d.name.toLowerCase().includes(queryLower))
      .slice(0, maxResults);

    return {
      success: true,
      query,
      results,
    };
  } catch (error) {
    return {
      success: false,
      query,
      results: [],
      error: error instanceof Error ? error.message : 'Failed to lookup developers',
    };
  }
}
