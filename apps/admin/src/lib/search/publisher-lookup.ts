/**
 * Publisher/Developer Lookup Service
 *
 * Provides efficient database lookups for publisher and developer names.
 * Prefers trigram-backed fuzzy search RPCs and falls back to ILIKE.
 */

import { getServiceSupabase } from '@/lib/supabase-service';

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
  results: Array<{
    id: number;
    name: string;
    similarityScore?: number;
    isExactMatch?: boolean;
  }>;
  error?: string;
}

/**
 * Search for matching publisher names using direct database query
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
    const supabase = getServiceSupabase();
    const maxResults = Math.min(limit, 20); // Hard cap at 20

    // Prefer fuzzy RPC for natural-language entity resolution.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fuzzyData, error: fuzzyError } = await (supabase as any).rpc('search_publishers_fuzzy', {
      p_query: query,
      p_limit: maxResults,
    }) as {
      data: Array<{
        id: number;
        name: string;
        similarity_score: number | null;
        is_exact_match: boolean | null;
      }> | null;
      error: { message: string } | null;
    };

    if (!fuzzyError && fuzzyData && fuzzyData.length > 0) {
      return {
        success: true,
        query,
        results: fuzzyData.map((p) => ({
          id: p.id,
          name: p.name,
          similarityScore: p.similarity_score ?? undefined,
          isExactMatch: p.is_exact_match ?? undefined,
        })),
      };
    }

    const { data, error } = await supabase
      .from('publishers')
      .select('id, name')
      .ilike('name', `%${query.trim()}%`)
      .order('name')
      .limit(maxResults);

    if (error) {
      console.error('Publisher lookup error:', error);
      return {
        success: false,
        query,
        results: [],
        error: error.message,
      };
    }

    return {
      success: true,
      query,
      results: data?.map((p) => ({ id: p.id, name: p.name })) || [],
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
  results: Array<{
    id: number;
    name: string;
    similarityScore?: number;
    isExactMatch?: boolean;
  }>;
  error?: string;
}

/**
 * Search for matching developer names using direct database query
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
    const supabase = getServiceSupabase();
    const maxResults = Math.min(limit, 20); // Hard cap at 20

    // Prefer fuzzy RPC for natural-language entity resolution.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fuzzyData, error: fuzzyError } = await (supabase as any).rpc('search_developers_fuzzy', {
      p_query: query,
      p_limit: maxResults,
    }) as {
      data: Array<{
        id: number;
        name: string;
        similarity_score: number | null;
        is_exact_match: boolean | null;
      }> | null;
      error: { message: string } | null;
    };

    if (!fuzzyError && fuzzyData && fuzzyData.length > 0) {
      return {
        success: true,
        query,
        results: fuzzyData.map((d) => ({
          id: d.id,
          name: d.name,
          similarityScore: d.similarity_score ?? undefined,
          isExactMatch: d.is_exact_match ?? undefined,
        })),
      };
    }

    const { data, error } = await supabase
      .from('developers')
      .select('id, name')
      .ilike('name', `%${query.trim()}%`)
      .order('name')
      .limit(maxResults);

    if (error) {
      console.error('Developer lookup error:', error);
      return {
        success: false,
        query,
        results: [],
        error: error.message,
      };
    }

    return {
      success: true,
      query,
      results: data?.map((d) => ({ id: d.id, name: d.name })) || [],
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
