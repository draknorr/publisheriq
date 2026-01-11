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
 * Downsample data points to target count, preserving peaks
 */
function downsampleToPoints(points: number[], targetCount: number): number[] {
  if (points.length === 0) return [];
  if (points.length <= targetCount) return points;

  const step = points.length / targetCount;
  const result: number[] = [];

  for (let i = 0; i < targetCount; i++) {
    const startIdx = Math.floor(i * step);
    const endIdx = Math.floor((i + 1) * step);
    const bucket = points.slice(startIdx, endIdx);
    result.push(Math.max(...bucket));
  }

  return result;
}

/**
 * Calculate trend direction from sparkline data
 */
function calculateTrend(dataPoints: number[]): 'up' | 'down' | 'stable' {
  if (dataPoints.length < 2) return 'stable';

  const midpoint = Math.floor(dataPoints.length / 2);
  const firstHalf = dataPoints.slice(0, midpoint);
  const secondHalf = dataPoints.slice(midpoint);

  const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;

  if (avgFirst === 0) return 'stable';
  const changePercent = ((avgSecond - avgFirst) / avgFirst) * 100;

  if (changePercent > 5) return 'up';
  if (changePercent < -5) return 'down';
  return 'stable';
}

/**
 * Fetch CCU sparkline data for multiple apps (7-day window, ~12 points)
 */
async function getSparklinesBatch(
  appIds: number[]
): Promise<Map<number, { dataPoints: number[]; trend: 'up' | 'down' | 'stable' }>> {
  if (appIds.length === 0) return new Map();

  const supabase = getSupabase();
  const cutoffTime = new Date();
  cutoffTime.setDate(cutoffTime.getDate() - 7);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = (await (supabase as any)
    .from('ccu_snapshots')
    .select('appid, player_count')
    .in('appid', appIds)
    .gte('snapshot_time', cutoffTime.toISOString())
    .order('snapshot_time', { ascending: true })) as {
    data: { appid: number; player_count: number }[] | null;
  };

  const result = new Map<number, { dataPoints: number[]; trend: 'up' | 'down' | 'stable' }>();

  if (!data) {
    for (const appid of appIds) {
      result.set(appid, { dataPoints: [], trend: 'stable' });
    }
    return result;
  }

  // Group by appid
  const byApp = new Map<number, number[]>();
  for (const row of data) {
    if (!byApp.has(row.appid)) byApp.set(row.appid, []);
    byApp.get(row.appid)!.push(row.player_count);
  }

  // Downsample each app's data to 12 points
  for (const appid of appIds) {
    const points = byApp.get(appid) ?? [];
    const dataPoints = downsampleToPoints(points, 12);
    const trend = calculateTrend(dataPoints);
    result.set(appid, { dataPoints, trend });
  }

  return result;
}

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

  if (!data || data.length === 0) return [];

  // Fetch sparklines for the found games
  const appIds = data.map((g) => g.appid);
  const sparklines = await getSparklinesBatch(appIds);

  return data.map((g) => {
    const metrics = g.latest_daily_metrics;
    const sparkline = sparklines.get(g.appid);
    return {
      appid: g.appid,
      name: g.name,
      releaseYear: g.release_date ? new Date(g.release_date).getFullYear() : null,
      reviewScore: metrics?.[0]?.positive_percentage ?? null,
      totalReviews: metrics?.[0]?.total_reviews ?? null,
      isFree: g.is_free ?? false,
      sparkline: sparkline?.dataPoints,
      sparklineTrend: sparkline?.trend,
    };
  });
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
