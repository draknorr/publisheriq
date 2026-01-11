/**
 * Unified Search Service
 *
 * Searches games, publishers, and developers in parallel.
 * Used by the global spotlight search.
 */

import { getSupabase } from '@/lib/supabase';
import type {
  GameSearchResult,
  PublisherSearchResult,
  DeveloperSearchResult,
  SearchResults,
} from '@/components/search/types';

/**
 * Search for games by name with metrics
 */
async function searchGames(query: string, limit: number): Promise<GameSearchResult[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('apps')
    .select(
      `
      appid,
      name,
      release_date,
      is_free,
      latest_daily_metrics!left(
        positive_percentage,
        total_reviews
      )
    `
    )
    .eq('type', 'game')
    .eq('is_delisted', false)
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(limit);

  if (error) {
    console.error('Game search error:', error);
    return [];
  }

  return (
    data?.map((g) => {
      const metrics = g.latest_daily_metrics;
      return {
        appid: g.appid,
        name: g.name,
        releaseYear: g.release_date ? new Date(g.release_date).getFullYear() : null,
        reviewScore: metrics?.[0]?.positive_percentage ?? null,
        totalReviews: metrics?.[0]?.total_reviews ?? null,
        isFree: g.is_free ?? false,
      };
    }) || []
  );
}

/**
 * Search for publishers by name
 */
async function searchPublishers(query: string, limit: number): Promise<PublisherSearchResult[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('publishers')
    .select('id, name, game_count')
    .ilike('name', `%${query}%`)
    .order('game_count', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error('Publisher search error:', error);
    return [];
  }

  return (
    data?.map((p) => ({
      id: p.id,
      name: p.name,
      gameCount: p.game_count ?? 0,
    })) || []
  );
}

/**
 * Search for developers by name
 */
async function searchDevelopers(query: string, limit: number): Promise<DeveloperSearchResult[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('developers')
    .select('id, name, game_count')
    .ilike('name', `%${query}%`)
    .order('game_count', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error('Developer search error:', error);
    return [];
  }

  return (
    data?.map((d) => ({
      id: d.id,
      name: d.name,
      gameCount: d.game_count ?? 0,
    })) || []
  );
}

/**
 * Search all entity types in parallel
 */
export async function unifiedSearch(query: string, limit = 5): Promise<SearchResults> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery || trimmedQuery.length < 2) {
    return {
      games: [],
      publishers: [],
      developers: [],
    };
  }

  const [games, publishers, developers] = await Promise.all([
    searchGames(trimmedQuery, limit),
    searchPublishers(trimmedQuery, limit),
    searchDevelopers(trimmedQuery, limit),
  ]);

  return { games, publishers, developers };
}
