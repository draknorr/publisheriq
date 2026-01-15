/**
 * Trends Calculation Worker
 *
 * Calculates 30d and 90d review trends from histogram data.
 *
 * Run with: pnpm --filter @publisheriq/ingestion calculate-trends
 */

import { getServiceClient } from '@publisheriq/database';
import { logger, BATCH_SIZES } from '@publisheriq/shared';

const log = logger.child({ worker: 'trends-sync' });

interface HistogramEntry {
  appid: number;
  month_start: string;
  recommendations_up: number;
  recommendations_down: number;
}

interface TrendResult {
  appid: number;
  trend_30d_direction: 'up' | 'down' | 'stable';
  trend_30d_change_pct: number;
  trend_90d_direction: 'up' | 'down' | 'stable';
  trend_90d_change_pct: number;
  current_positive_ratio: number;
  previous_positive_ratio: number;
  review_velocity_7d: number;
  review_velocity_30d: number;
}

function calculateTrendForApp(histogram: HistogramEntry[]): Omit<TrendResult, 'appid'> | null {
  if (histogram.length < 2) {
    return null;
  }

  // Sort by date descending (newest first)
  const sorted = [...histogram].sort(
    (a, b) => new Date(b.month_start).getTime() - new Date(a.month_start).getTime()
  );

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Split into periods
  const recent: HistogramEntry[] = [];
  const mid: HistogramEntry[] = [];
  const old: HistogramEntry[] = [];

  for (const entry of sorted) {
    const date = new Date(entry.month_start);
    if (date >= thirtyDaysAgo) {
      recent.push(entry);
    } else if (date >= ninetyDaysAgo) {
      mid.push(entry);
    } else if (old.length < 3) {
      old.push(entry);
    }
  }

  // Calculate 30-day trend
  const recentUp = recent.reduce((sum, e) => sum + e.recommendations_up, 0);
  const recentDown = recent.reduce((sum, e) => sum + e.recommendations_down, 0);
  const recentTotal = recentUp + recentDown;
  const currentPositiveRatio = recentTotal > 0 ? recentUp / recentTotal : 0;

  // Previous period for comparison (use mid period)
  const midUp = mid.reduce((sum, e) => sum + e.recommendations_up, 0);
  const midDown = mid.reduce((sum, e) => sum + e.recommendations_down, 0);
  const midTotal = midUp + midDown;
  const previousPositiveRatio = midTotal > 0 ? midUp / midTotal : 0;

  // Calculate 30d change
  let trend30dChangePct = 0;
  if (previousPositiveRatio > 0) {
    trend30dChangePct = ((currentPositiveRatio - previousPositiveRatio) / previousPositiveRatio) * 100;
  }

  // Determine 30d direction
  let trend30dDirection: 'up' | 'down' | 'stable' = 'stable';
  if (trend30dChangePct > 2) {
    trend30dDirection = 'up';
  } else if (trend30dChangePct < -2) {
    trend30dDirection = 'down';
  }

  // Calculate 90-day trend (compare recent+mid vs old)
  const recentMidUp = recentUp + midUp;
  const recentMidDown = recentDown + midDown;
  const recentMidTotal = recentMidUp + recentMidDown;
  const recentMidRatio = recentMidTotal > 0 ? recentMidUp / recentMidTotal : 0;

  const oldUp = old.reduce((sum, e) => sum + e.recommendations_up, 0);
  const oldDown = old.reduce((sum, e) => sum + e.recommendations_down, 0);
  const oldTotal = oldUp + oldDown;
  const oldRatio = oldTotal > 0 ? oldUp / oldTotal : 0;

  let trend90dChangePct = 0;
  if (oldRatio > 0) {
    trend90dChangePct = ((recentMidRatio - oldRatio) / oldRatio) * 100;
  }

  let trend90dDirection: 'up' | 'down' | 'stable' = 'stable';
  if (trend90dChangePct > 2) {
    trend90dDirection = 'up';
  } else if (trend90dChangePct < -2) {
    trend90dDirection = 'down';
  }

  // Calculate review velocity
  const reviewVelocity7d = recentTotal > 0 ? recentTotal / 7 : 0;
  const reviewVelocity30d = recentTotal > 0 ? recentTotal / 30 : 0;

  return {
    trend_30d_direction: trend30dDirection,
    trend_30d_change_pct: Math.round(trend30dChangePct * 100) / 100,
    trend_90d_direction: trend90dDirection,
    trend_90d_change_pct: Math.round(trend90dChangePct * 100) / 100,
    current_positive_ratio: Math.round(currentPositiveRatio * 10000) / 10000,
    previous_positive_ratio: Math.round(previousPositiveRatio * 10000) / 10000,
    review_velocity_7d: Math.round(reviewVelocity7d * 100) / 100,
    review_velocity_30d: Math.round(reviewVelocity30d * 100) / 100,
  };
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const githubRunId = process.env.GITHUB_RUN_ID;
  const batchSize = parseInt(process.env.BATCH_SIZE || String(BATCH_SIZES.TRENDS_BATCH), 10);

  log.info('Starting Trends calculation', { githubRunId, batchSize });

  const supabase = getServiceClient();

  const { data: job } = await supabase
    .from('sync_jobs')
    .insert({
      job_type: 'trends',
      github_run_id: githubRunId,
      status: 'running',
      batch_size: batchSize,
    })
    .select()
    .single();

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    // Get distinct appids using RPC (much faster than paginating 2.9M rows)
    log.info('Fetching distinct appids from review_histogram via RPC...');

    const { data: appidRows, error: appidError } = await supabase
      .rpc('get_histogram_appids')
      .limit(200000); // Override Supabase's default 1000 row limit

    if (appidError) {
      log.error('Failed to fetch appids via RPC', { error: appidError });
      throw appidError;
    }

    const uniqueAppids = (appidRows || []).map((row: { appid: number }) => row.appid);

    if (uniqueAppids.length === 0) {
      log.info('No apps with histogram data');

      // Mark job as completed with 0 items
      if (job) {
        await supabase
          .from('sync_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            items_processed: 0,
            items_succeeded: 0,
            items_failed: 0,
          })
          .eq('id', job.id);
      }
      return;
    }
    log.info('Found apps with histogram data', { count: uniqueAppids.length });

    // Process in batches
    for (let i = 0; i < uniqueAppids.length; i += batchSize) {
      const batch = uniqueAppids.slice(i, i + batchSize);

      // Fetch histogram data for batch
      const { data: histogramData } = await supabase
        .from('review_histogram')
        .select('*')
        .in('appid', batch)
        .order('month_start', { ascending: false });

      if (!histogramData) continue;

      // Group by appid
      const byAppid = new Map<number, HistogramEntry[]>();
      for (const entry of histogramData) {
        if (!byAppid.has(entry.appid)) {
          byAppid.set(entry.appid, []);
        }
        byAppid.get(entry.appid)!.push(entry);
      }

      // Calculate trends for each app
      const trendsToUpsert: TrendResult[] = [];

      for (const [appid, histogram] of byAppid) {
        processed++;
        const trend = calculateTrendForApp(histogram);

        if (trend) {
          trendsToUpsert.push({
            appid,
            ...trend,
          });
          succeeded++;
        } else {
          failed++;
        }
      }

      // Upsert trends
      if (trendsToUpsert.length > 0) {
        const { error } = await supabase.from('app_trends').upsert(
          trendsToUpsert.map((t) => ({
            ...t,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'appid' }
        );

        if (error) {
          log.error('Failed to upsert trends', { error });
        }
      }

      log.info('Trends batch progress', {
        processed,
        succeeded,
        failed,
        batchIndex: Math.floor(i / batchSize) + 1,
      });
    }

    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          items_processed: processed,
          items_succeeded: succeeded,
          items_failed: failed,
        })
        .eq('id', job.id);
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    log.info('Trends calculation completed', { processed, succeeded, failed, durationMinutes: duration });
  } catch (error) {
    log.error('Trends calculation failed', { error });

    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : String(error),
        })
        .eq('id', job.id);
    }

    process.exit(1);
  }
}

main();
