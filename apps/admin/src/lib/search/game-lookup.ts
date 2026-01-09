/**
 * Game Lookup Service
 *
 * Provides efficient database lookups for game names.
 * Uses direct ILIKE queries for partial matching.
 */

import { getSupabase } from '@/lib/supabase';

/**
 * Arguments for lookup_games tool
 */
export interface LookupGamesArgs {
  query: string;
  limit?: number;
}

/**
 * Result from lookup_games
 */
export interface LookupGamesResult {
  success: boolean;
  query: string;
  results: Array<{ appid: number; name: string; releaseYear: number | null }>;
  error?: string;
}

/**
 * Search for matching game names using direct database query
 */
export async function lookupGames(args: LookupGamesArgs): Promise<LookupGamesResult> {
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
    const supabase = getSupabase();
    const maxResults = Math.min(limit, 20); // Hard cap at 20

    // Direct ILIKE query - efficient with database index
    const { data, error } = await supabase
      .from('apps')
      .select('appid, name, release_date')
      .eq('type', 'game')
      .eq('is_delisted', false)
      .ilike('name', `%${query.trim()}%`)
      .order('name')
      .limit(maxResults);

    if (error) {
      console.error('Game lookup error:', error);
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
      results:
        data?.map((g) => ({
          appid: g.appid,
          name: g.name,
          releaseYear: g.release_date ? new Date(g.release_date).getFullYear() : null,
        })) || [],
    };
  } catch (error) {
    return {
      success: false,
      query,
      results: [],
      error: error instanceof Error ? error.message : 'Failed to lookup games',
    };
  }
}
