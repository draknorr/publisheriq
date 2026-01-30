/**
 * Shared CCU (Concurrent Users) data fetching utilities
 * Used across entity detail pages (apps, publishers, developers)
 *
 * NOTE: ccu_snapshots table is new in v2.2.
 * TypeScript types may not include it yet - we use type assertions where needed.
 */

import { getSupabase } from '@/lib/supabase';

// ============================================================================
// Types
// ============================================================================

export type TimeRange = '24h' | '7d' | '30d';

export interface CCUSparklineData {
  dataPoints: number[];
  trend: 'up' | 'down' | 'stable';
  growthPct: number | null;
  peakCCU: number | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Downsamples CCU data points to target count, preserving peaks
 */
function downsampleToPoints(
  points: { time: Date; ccu: number }[],
  targetCount: number
): number[] {
  if (points.length === 0) return [];
  if (points.length <= targetCount) return points.map(p => p.ccu);

  const step = points.length / targetCount;
  const result: number[] = [];

  for (let i = 0; i < targetCount; i++) {
    const startIdx = Math.floor(i * step);
    const endIdx = Math.floor((i + 1) * step);
    const bucket = points.slice(startIdx, endIdx);
    // Take max CCU in each bucket (preserves peaks)
    const maxCcu = Math.max(...bucket.map(p => p.ccu));
    result.push(maxCcu);
  }

  return result;
}

/**
 * Calculates trend direction from sparkline data
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
 * Calculates growth percentage from sparkline data
 */
function calculateGrowthPct(dataPoints: number[]): number | null {
  if (dataPoints.length < 2) return null;

  const midpoint = Math.floor(dataPoints.length / 2);
  const firstHalf = dataPoints.slice(0, midpoint);
  const secondHalf = dataPoints.slice(midpoint);

  const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;

  if (avgFirst === 0) return null;
  return Math.round(((avgSecond - avgFirst) / avgFirst) * 100);
}

/**
 * Gets cutoff time and target points for a time range
 */
function getTimeRangeParams(timeRange: TimeRange): { cutoffTime: Date; targetPoints: number } {
  const cutoffTime = new Date();
  let targetPoints: number;

  if (timeRange === '24h') {
    cutoffTime.setHours(cutoffTime.getHours() - 24);
    targetPoints = 12;
  } else if (timeRange === '7d') {
    cutoffTime.setDate(cutoffTime.getDate() - 7);
    targetPoints = 14;
  } else {
    cutoffTime.setDate(cutoffTime.getDate() - 30);
    targetPoints = 15;
  }

  return { cutoffTime, targetPoints };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch CCU sparkline data for a single app
 */
export async function getCCUSparkline(
  appid: number,
  timeRange: TimeRange = '7d'
): Promise<CCUSparklineData> {
  const result = await getCCUSparklinesBatch([appid], timeRange);
  return result.get(appid) ?? {
    dataPoints: [],
    trend: 'stable',
    growthPct: null,
    peakCCU: null,
  };
}

/**
 * Fetch daily peak CCU data via the get_app_sparkline_data RPC.
 *
 * This is used by the game detail page to standardize sparklines with the /apps list.
 */
export async function getAppDailyPeakSparkline(
  appid: number,
  days: 7 | 30 = 7
): Promise<CCUSparklineData> {
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc('get_app_sparkline_data', {
    p_appids: [appid],
    p_days: days,
  });

  if (error || !data || data.length === 0) {
    return {
      dataPoints: [],
      trend: 'stable',
      growthPct: null,
      peakCCU: null,
    };
  }

  const row = data[0];
  const points = Array.isArray(row.sparkline_data) ? row.sparkline_data : [];

  const dataPoints: number[] = points
    .map((p) => {
      if (!p || typeof p !== 'object') return null;
      const ccu = (p as { ccu?: unknown }).ccu;
      return typeof ccu === 'number' ? ccu : typeof ccu === 'string' ? Number(ccu) : null;
    })
    .filter((v): v is number => v !== null && !Number.isNaN(v));

  const peakCCU = dataPoints.length > 0 ? Math.max(...dataPoints) : null;

  return {
    dataPoints,
    trend: calculateTrend(dataPoints),
    growthPct: calculateGrowthPct(dataPoints),
    peakCCU,
  };
}

/**
 * Batch fetch sparkline data for multiple apps
 */
export async function getCCUSparklinesBatch(
  appIds: number[],
  timeRange: TimeRange = '7d'
): Promise<Map<number, CCUSparklineData>> {
  const supabase = getSupabase();
  const { cutoffTime, targetPoints } = getTimeRangeParams(timeRange);

  const result = new Map<number, CCUSparklineData>();

  // Return empty data for empty input
  if (appIds.length === 0) {
    return result;
  }

  // Fetch all snapshots for all apps in one query
  const { data, error } = await (supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        in: (col: string, vals: number[]) => {
          gte: (col: string, val: string) => {
            order: (col: string, opts: { ascending: boolean }) => Promise<{
              data: { appid: number; snapshot_time: string; player_count: number }[] | null;
              error: Error | null;
            }>;
          };
        };
      };
    };
  })
    .from('ccu_snapshots')
    .select('appid, snapshot_time, player_count')
    .in('appid', appIds)
    .gte('snapshot_time', cutoffTime.toISOString())
    .order('snapshot_time', { ascending: true });

  if (error || !data) {
    // Return empty sparklines for all apps
    for (const appid of appIds) {
      result.set(appid, {
        dataPoints: [],
        trend: 'stable',
        growthPct: null,
        peakCCU: null,
      });
    }
    return result;
  }

  // Group by appid and track peaks
  const byApp = new Map<number, { time: Date; ccu: number }[]>();
  const peakByApp = new Map<number, number>();

  for (const row of data) {
    // Group points for sparkline
    if (!byApp.has(row.appid)) byApp.set(row.appid, []);
    byApp.get(row.appid)!.push({
      time: new Date(row.snapshot_time),
      ccu: row.player_count,
    });

    // Track peak
    const currentPeak = peakByApp.get(row.appid) ?? 0;
    if (row.player_count > currentPeak) {
      peakByApp.set(row.appid, row.player_count);
    }
  }

  // Process each app's data
  for (const appid of appIds) {
    const points = byApp.get(appid) ?? [];
    const dataPoints = downsampleToPoints(points, targetPoints);
    const trend = calculateTrend(dataPoints);
    const growthPct = calculateGrowthPct(dataPoints);
    const peakCCU = peakByApp.get(appid) ?? null;

    result.set(appid, { dataPoints, trend, growthPct, peakCCU });
  }

  return result;
}

/**
 * Fetch aggregated portfolio CCU sparkline for a publisher or developer
 * Aggregates CCU across all games in the portfolio
 */
export async function getPortfolioCCUSparkline(
  appIds: number[],
  timeRange: TimeRange = '7d'
): Promise<CCUSparklineData> {
  const supabase = getSupabase();
  const { cutoffTime, targetPoints } = getTimeRangeParams(timeRange);

  // Return empty data for empty input
  if (appIds.length === 0) {
    return {
      dataPoints: [],
      trend: 'stable',
      growthPct: null,
      peakCCU: null,
    };
  }

  // Fetch all snapshots for all apps
  const { data, error } = await (supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        in: (col: string, vals: number[]) => {
          gte: (col: string, val: string) => {
            order: (col: string, opts: { ascending: boolean }) => Promise<{
              data: { appid: number; snapshot_time: string; player_count: number }[] | null;
              error: Error | null;
            }>;
          };
        };
      };
    };
  })
    .from('ccu_snapshots')
    .select('appid, snapshot_time, player_count')
    .in('appid', appIds)
    .gte('snapshot_time', cutoffTime.toISOString())
    .order('snapshot_time', { ascending: true });

  if (error || !data || data.length === 0) {
    return {
      dataPoints: [],
      trend: 'stable',
      growthPct: null,
      peakCCU: null,
    };
  }

  // Group by time bucket and aggregate CCU across all apps
  // Round to nearest hour for aggregation
  const byTimeBucket = new Map<string, number>();
  let overallPeak = 0;

  for (const row of data) {
    const time = new Date(row.snapshot_time);
    // Round to nearest hour
    time.setMinutes(0, 0, 0);
    const bucket = time.toISOString();

    const current = byTimeBucket.get(bucket) ?? 0;
    byTimeBucket.set(bucket, current + row.player_count);

    // Track overall peak (single snapshot, not aggregated)
    if (row.player_count > overallPeak) {
      overallPeak = row.player_count;
    }
  }

  // Convert to sorted array of points
  const sortedBuckets = Array.from(byTimeBucket.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([time, ccu]) => ({ time: new Date(time), ccu }));

  // Downsample and calculate trend
  const dataPoints = downsampleToPoints(sortedBuckets, targetPoints);
  const trend = calculateTrend(dataPoints);
  const growthPct = calculateGrowthPct(dataPoints);

  // Peak CCU for portfolio is the max of individual peaks, not aggregated
  // (Games are rarely played simultaneously by the same users)
  const peakCCU = overallPeak;

  return { dataPoints, trend, growthPct, peakCCU };
}
