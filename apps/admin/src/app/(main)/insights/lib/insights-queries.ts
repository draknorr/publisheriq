/**
 * Data fetching functions for the Insights dashboard
 * Uses Supabase client to query CCU data from ccu_snapshots and related tables
 *
 * NOTE: ccu_snapshots and ccu_tier_assignments tables are new in v2.2.
 * TypeScript types may not include them yet - we use type assertions where needed.
 * Run `pnpm --filter database generate` after applying migrations to fix types.
 */

import { getSupabase } from '@/lib/supabase';
import type { TimeRange, GameInsight, TimeRangeConfig } from './insights-types';

// Type for snapshot row (not yet in generated types)
interface CCUSnapshotRow {
  appid: number;
  player_count: number;
  snapshot_time: string;
  ccu_tier: number;
}

// Type for tier assignment row (not yet in generated types)
interface CCUTierAssignmentRow {
  appid: number;
  ccu_tier: number;
  tier_reason: string | null;
  release_rank: number | null;
  recent_peak_ccu: number | null;
}

/**
 * Time range configurations
 */
export const TIME_RANGE_CONFIG: Record<TimeRange, TimeRangeConfig> = {
  '24h': {
    interval: '24 hours',
    priorInterval: '48 hours',
    granularity: 'hour',
    chartPoints: 24,
    label: '24 hours',
  },
  '7d': {
    interval: '7 days',
    priorInterval: '14 days',
    granularity: 'day',
    chartPoints: 7,
    label: '7 days',
  },
  '30d': {
    interval: '30 days',
    priorInterval: '60 days',
    granularity: 'day',
    chartPoints: 30,
    label: '30 days',
  },
};

/**
 * Get top games by peak CCU in the given time range
 */
export async function getTopGames(timeRange: TimeRange): Promise<GameInsight[]> {
  const supabase = getSupabase();

  // Calculate the cutoff time
  const cutoffTime = new Date();
  if (timeRange === '24h') {
    cutoffTime.setHours(cutoffTime.getHours() - 24);
  } else if (timeRange === '7d') {
    cutoffTime.setDate(cutoffTime.getDate() - 7);
  } else {
    cutoffTime.setDate(cutoffTime.getDate() - 30);
  }

  // Get peak CCU from snapshots (using type assertion for new table)
  const { data: snapshotData, error: snapshotError } = await (supabase as any)
    .from('ccu_snapshots')
    .select('appid, player_count')
    .gte('snapshot_time', cutoffTime.toISOString())
    .order('player_count', { ascending: false }) as {
      data: Pick<CCUSnapshotRow, 'appid' | 'player_count'>[] | null;
      error: Error | null;
    };

  if (snapshotError || !snapshotData) {
    console.error('Snapshot query error:', snapshotError);
    return [];
  }

  // Aggregate to get peak per app
  const peakByApp = new Map<number, number>();
  for (const row of snapshotData) {
    const current = peakByApp.get(row.appid) ?? 0;
    if (row.player_count > current) {
      peakByApp.set(row.appid, row.player_count);
    }
  }

  // Sort and take top 50
  const topAppIds = Array.from(peakByApp.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([appid]) => appid);

  if (topAppIds.length === 0) return [];

  // Get app details
  const { data: apps, error: appsError } = await supabase
    .from('apps')
    .select('appid, name, release_date')
    .in('appid', topAppIds);

  if (appsError || !apps) {
    console.error('Apps query error:', appsError);
    return [];
  }

  // Get tier assignments (using type assertion for new table)
  const { data: tiers } = await (supabase as any)
    .from('ccu_tier_assignments')
    .select('appid, ccu_tier, tier_reason')
    .in('appid', topAppIds) as {
      data: Pick<CCUTierAssignmentRow, 'appid' | 'ccu_tier' | 'tier_reason'>[] | null;
    };

  const tierMap = new Map(tiers?.map(t => [t.appid, t]) ?? []);
  const appMap = new Map(apps.map(a => [a.appid, a]));

  // Build results
  return topAppIds.map(appid => {
    const app = appMap.get(appid);
    const tier = tierMap.get(appid);
    const peakCcu = peakByApp.get(appid) ?? 0;

    return {
      appid,
      name: app?.name ?? `App ${appid}`,
      releaseDate: app?.release_date ?? null,
      currentCcu: peakCcu,
      peakCcu,
      ccuTier: tier?.ccu_tier as 1 | 2 | 3 | undefined,
      tierReason: tier?.tier_reason ?? undefined,
    };
  });
}

/**
 * Get newest games (released in past year) with CCU data
 */
export async function getNewestGames(timeRange: TimeRange): Promise<GameInsight[]> {
  const supabase = getSupabase();

  // Get games released in the past year
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const { data: apps, error: appsError } = await supabase
    .from('apps')
    .select('appid, name, release_date')
    .eq('type', 'game')
    .eq('is_released', true)
    .gte('release_date', oneYearAgo.toISOString().split('T')[0])
    .order('release_date', { ascending: false })
    .limit(100);

  if (appsError || !apps || apps.length === 0) {
    console.error('Newest games query error:', appsError);
    return [];
  }

  const appIds = apps.map(a => a.appid);

  // Calculate cutoff time for CCU data
  const cutoffTime = new Date();
  if (timeRange === '24h') {
    cutoffTime.setHours(cutoffTime.getHours() - 24);
  } else if (timeRange === '7d') {
    cutoffTime.setDate(cutoffTime.getDate() - 7);
  } else {
    cutoffTime.setDate(cutoffTime.getDate() - 30);
  }

  // Get CCU data from snapshots (using type assertion for new table)
  const { data: snapshotData } = await (supabase as any)
    .from('ccu_snapshots')
    .select('appid, player_count')
    .in('appid', appIds)
    .gte('snapshot_time', cutoffTime.toISOString()) as {
      data: Pick<CCUSnapshotRow, 'appid' | 'player_count'>[] | null;
    };

  // Aggregate peak CCU per app
  const peakByApp = new Map<number, number>();
  if (snapshotData) {
    for (const row of snapshotData) {
      const current = peakByApp.get(row.appid) ?? 0;
      if (row.player_count > current) {
        peakByApp.set(row.appid, row.player_count);
      }
    }
  }

  // Get tier assignments (using type assertion for new table)
  const { data: tiers } = await (supabase as any)
    .from('ccu_tier_assignments')
    .select('appid, ccu_tier, tier_reason, release_rank')
    .in('appid', appIds) as {
      data: Pick<CCUTierAssignmentRow, 'appid' | 'ccu_tier' | 'tier_reason' | 'release_rank'>[] | null;
    };

  const tierMap = new Map(tiers?.map(t => [t.appid, t]) ?? []);

  // Build results - filter to those with CCU data and sort by release date
  const results = apps
    .map(app => {
      const tier = tierMap.get(app.appid);
      const peakCcu = peakByApp.get(app.appid) ?? 0;

      return {
        appid: app.appid,
        name: app.name,
        releaseDate: app.release_date,
        currentCcu: peakCcu,
        peakCcu,
        ccuTier: tier?.ccu_tier as 1 | 2 | 3 | undefined,
        tierReason: tier?.tier_reason ?? undefined,
        releaseRank: tier?.release_rank ?? undefined,
      };
    })
    .filter(g => g.currentCcu > 0)
    .slice(0, 50);

  return results;
}

/**
 * Get trending games by CCU growth percentage
 */
export async function getTrendingGames(timeRange: TimeRange): Promise<GameInsight[]> {
  const supabase = getSupabase();

  // Calculate time boundaries
  const now = new Date();
  const recentStart = new Date();
  const priorStart = new Date();
  const priorEnd = new Date();

  if (timeRange === '24h') {
    recentStart.setHours(now.getHours() - 24);
    priorStart.setHours(now.getHours() - 48);
    priorEnd.setHours(now.getHours() - 24);
  } else if (timeRange === '7d') {
    recentStart.setDate(now.getDate() - 7);
    priorStart.setDate(now.getDate() - 14);
    priorEnd.setDate(now.getDate() - 7);
  } else {
    recentStart.setDate(now.getDate() - 30);
    priorStart.setDate(now.getDate() - 60);
    priorEnd.setDate(now.getDate() - 30);
  }

  // Get recent period CCU (using type assertion for new table)
  const { data: recentData, error: recentError } = await (supabase as any)
    .from('ccu_snapshots')
    .select('appid, player_count')
    .gte('snapshot_time', recentStart.toISOString())
    .lte('snapshot_time', now.toISOString()) as {
      data: Pick<CCUSnapshotRow, 'appid' | 'player_count'>[] | null;
      error: Error | null;
    };

  if (recentError) {
    console.error('Recent CCU query error:', recentError);
    return [];
  }

  // Get prior period CCU (using type assertion for new table)
  const { data: priorData, error: priorError } = await (supabase as any)
    .from('ccu_snapshots')
    .select('appid, player_count')
    .gte('snapshot_time', priorStart.toISOString())
    .lte('snapshot_time', priorEnd.toISOString()) as {
      data: Pick<CCUSnapshotRow, 'appid' | 'player_count'>[] | null;
      error: Error | null;
    };

  if (priorError) {
    console.error('Prior CCU query error:', priorError);
    return [];
  }

  // Calculate average CCU for each period
  const recentAvg = new Map<number, { sum: number; count: number }>();
  const priorAvg = new Map<number, { sum: number; count: number }>();

  for (const row of recentData ?? []) {
    const existing = recentAvg.get(row.appid) ?? { sum: 0, count: 0 };
    existing.sum += row.player_count;
    existing.count += 1;
    recentAvg.set(row.appid, existing);
  }

  for (const row of priorData ?? []) {
    const existing = priorAvg.get(row.appid) ?? { sum: 0, count: 0 };
    existing.sum += row.player_count;
    existing.count += 1;
    priorAvg.set(row.appid, existing);
  }

  // Calculate growth for apps that have data in both periods
  const growthData: Array<{
    appid: number;
    recentAvg: number;
    priorAvg: number;
    growthPct: number;
  }> = [];

  for (const [appid, recent] of recentAvg) {
    const prior = priorAvg.get(appid);
    if (!prior) continue;

    const recentAvgValue = recent.sum / recent.count;
    const priorAvgValue = prior.sum / prior.count;

    // Filter out noise: require minimum 10 avg CCU in both periods
    if (recentAvgValue < 10 || priorAvgValue < 10) continue;

    const growthPct = ((recentAvgValue - priorAvgValue) / priorAvgValue) * 100;

    growthData.push({
      appid,
      recentAvg: Math.round(recentAvgValue),
      priorAvg: Math.round(priorAvgValue),
      growthPct: Math.round(growthPct * 10) / 10, // 1 decimal place
    });
  }

  // Sort by growth and take top 50 gainers
  growthData.sort((a, b) => b.growthPct - a.growthPct);
  const topGainers = growthData.slice(0, 50);

  if (topGainers.length === 0) return [];

  const appIds = topGainers.map(g => g.appid);

  // Get app details
  const { data: apps } = await supabase
    .from('apps')
    .select('appid, name, release_date')
    .in('appid', appIds);

  // Get tier assignments (using type assertion for new table)
  const { data: tiers } = await (supabase as any)
    .from('ccu_tier_assignments')
    .select('appid, ccu_tier, tier_reason')
    .in('appid', appIds) as {
      data: Pick<CCUTierAssignmentRow, 'appid' | 'ccu_tier' | 'tier_reason'>[] | null;
    };

  const appMap = new Map(apps?.map(a => [a.appid, a]) ?? []);
  const tierMap = new Map(tiers?.map(t => [t.appid, t]) ?? []);

  // Build results
  return topGainers.map(g => {
    const app = appMap.get(g.appid);
    const tier = tierMap.get(g.appid);

    return {
      appid: g.appid,
      name: app?.name ?? `App ${g.appid}`,
      releaseDate: app?.release_date ?? null,
      currentCcu: g.recentAvg,
      avgCcu: g.recentAvg,
      priorAvgCcu: g.priorAvg,
      growthPct: g.growthPct,
      ccuTier: tier?.ccu_tier as 1 | 2 | 3 | undefined,
      tierReason: tier?.tier_reason ?? undefined,
    };
  });
}

/**
 * Get summary stats for the insights header
 */
export async function getInsightsSummary(_timeRange: TimeRange): Promise<{
  totalGamesTracked: number;
  tier1Count: number;
  tier2Count: number;
  avgCcu: number;
}> {
  const supabase = getSupabase();

  // Get tier stats (using type assertion for new table)
  const { data: tierData, count: totalGamesTracked } = await (supabase as any)
    .from('ccu_tier_assignments')
    .select('ccu_tier', { count: 'exact' }) as {
      data: Pick<CCUTierAssignmentRow, 'ccu_tier'>[] | null;
      count: number | null;
    };

  // Get recent CCU stats (using type assertion for new table)
  const { data: ccuData } = await (supabase as any)
    .from('ccu_snapshots')
    .select('player_count')
    .gte('snapshot_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(10000) as {
      data: Pick<CCUSnapshotRow, 'player_count'>[] | null;
    };

  // Count tiers
  let tier1Count = 0;
  let tier2Count = 0;

  if (tierData) {
    for (const row of tierData) {
      if (row.ccu_tier === 1) tier1Count++;
      else if (row.ccu_tier === 2) tier2Count++;
    }
  }

  // Calculate average CCU from recent snapshots
  let avgCcu = 0;
  if (ccuData && ccuData.length > 0) {
    const sum = ccuData.reduce((acc, row) => acc + row.player_count, 0);
    avgCcu = Math.round(sum / ccuData.length);
  }

  return {
    totalGamesTracked: totalGamesTracked ?? 0,
    tier1Count,
    tier2Count,
    avgCcu,
  };
}
