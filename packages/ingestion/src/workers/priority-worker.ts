/**
 * Priority Calculation Worker
 *
 * Updates priority scores for apps based on CCU, review activity, and trends.
 * Higher priority apps get synced more frequently.
 *
 * Run with: pnpm --filter @publisheriq/ingestion calculate-priority
 */

import { getServiceClient } from '@publisheriq/database';
import { logger, PRIORITY_THRESHOLDS, BATCH_SIZES } from '@publisheriq/shared';

const log = logger.child({ worker: 'priority-sync' });

interface AppForPriority {
  appid: number;
  ccu_peak: number | null;
  review_velocity_7d: number | null;
  review_velocity_30d: number | null;
  trend_30d_change_pct: number | null;
  total_reviews: number | null;
}

function calculatePriorityScore(app: AppForPriority): number {
  let priority = 0;

  // CCU-based priority (popular games get updated more often)
  const ccu = app.ccu_peak ?? 0;
  if (ccu > PRIORITY_THRESHOLDS.CCU_HIGH) {
    priority += 100;
  } else if (ccu > PRIORITY_THRESHOLDS.CCU_MEDIUM) {
    priority += 50;
  } else if (ccu > PRIORITY_THRESHOLDS.CCU_LOW) {
    priority += 25;
  }

  // Review velocity (active games get priority)
  const velocity7d = app.review_velocity_7d ?? 0;
  if (velocity7d > 10) {
    priority += 40;
  } else if (velocity7d > 5) {
    priority += 20;
  } else if (velocity7d > 1) {
    priority += 10;
  }

  // Trending games (either direction indicates activity)
  const trendChange = Math.abs(app.trend_30d_change_pct ?? 0);
  if (trendChange > 10) {
    priority += 25;
  } else if (trendChange > 5) {
    priority += 15;
  }

  // Base priority for games with reviews
  const totalReviews = app.total_reviews ?? 0;
  if (totalReviews > 10000) {
    priority += 20;
  } else if (totalReviews > 1000) {
    priority += 10;
  } else if (totalReviews > 100) {
    priority += 5;
  }

  // Dead game penalty
  if (ccu === 0 && velocity7d < 0.1) {
    priority -= 50;
  }

  // Ensure non-negative
  return Math.max(0, priority);
}

function calculateSyncInterval(priority: number): number {
  // Higher priority = more frequent syncs
  if (priority >= 150) {
    return 6; // Every 6 hours
  } else if (priority >= 100) {
    return 12; // Every 12 hours
  } else if (priority >= 50) {
    return 24; // Daily
  } else if (priority >= 25) {
    return 48; // Every 2 days
  } else {
    return 168; // Weekly
  }
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const githubRunId = process.env.GITHUB_RUN_ID;
  const batchSize = parseInt(process.env.BATCH_SIZE || String(BATCH_SIZES.PRIORITY_BATCH), 10);

  log.info('Starting Priority calculation', { githubRunId, batchSize });

  const supabase = getServiceClient();

  const { data: job } = await supabase
    .from('sync_jobs')
    .insert({
      job_type: 'priority',
      github_run_id: githubRunId,
      status: 'running',
      batch_size: batchSize,
    })
    .select()
    .single();

  let processed = 0;
  let updated = 0;

  try {
    // Get count of apps to process
    const { count } = await supabase
      .from('sync_status')
      .select('*', { count: 'exact', head: true });

    const totalApps = count ?? 0;
    log.info('Found apps to calculate priority', { count: totalApps });

    // Process in batches using offset pagination
    let offset = 0;

    while (offset < totalApps) {
      // Get batch of app IDs
      const { data: syncStatusBatch } = await supabase
        .from('sync_status')
        .select('appid')
        .range(offset, offset + batchSize - 1);

      if (!syncStatusBatch || syncStatusBatch.length === 0) {
        break;
      }

      const appids = syncStatusBatch.map((s) => s.appid);

      // Get latest metrics for these apps
      const { data: metricsData } = await supabase
        .from('daily_metrics')
        .select('appid, ccu_peak, total_reviews')
        .in('appid', appids)
        .order('metric_date', { ascending: false });

      // Get trends for these apps
      const { data: trendsData } = await supabase
        .from('app_trends')
        .select('appid, review_velocity_7d, review_velocity_30d, trend_30d_change_pct')
        .in('appid', appids);

      // Build lookup maps
      const metricsMap = new Map<number, { ccu_peak: number | null; total_reviews: number | null }>();
      if (metricsData) {
        for (const m of metricsData) {
          if (!metricsMap.has(m.appid)) {
            metricsMap.set(m.appid, { ccu_peak: m.ccu_peak, total_reviews: m.total_reviews });
          }
        }
      }

      const trendsMap = new Map<
        number,
        { review_velocity_7d: number | null; review_velocity_30d: number | null; trend_30d_change_pct: number | null }
      >();
      if (trendsData) {
        for (const t of trendsData) {
          trendsMap.set(t.appid, {
            review_velocity_7d: t.review_velocity_7d,
            review_velocity_30d: t.review_velocity_30d,
            trend_30d_change_pct: t.trend_30d_change_pct,
          });
        }
      }

      // Calculate priorities
      const updates: Array<{
        appid: number;
        priority_score: number;
        sync_interval_hours: number;
        priority_calculated_at: string;
        next_sync_after: string;
      }> = [];

      for (const appid of appids) {
        processed++;

        const metrics = metricsMap.get(appid) ?? { ccu_peak: null, total_reviews: null };
        const trends = trendsMap.get(appid) ?? {
          review_velocity_7d: null,
          review_velocity_30d: null,
          trend_30d_change_pct: null,
        };

        const app: AppForPriority = {
          appid,
          ...metrics,
          ...trends,
        };

        const priority = calculatePriorityScore(app);
        const syncInterval = calculateSyncInterval(priority);

        const now = new Date();
        const nextSync = new Date(now.getTime() + syncInterval * 60 * 60 * 1000);

        updates.push({
          appid,
          priority_score: priority,
          sync_interval_hours: syncInterval,
          priority_calculated_at: now.toISOString(),
          next_sync_after: nextSync.toISOString(),
        });
      }

      // Batch update sync_status
      for (const update of updates) {
        const { error } = await supabase
          .from('sync_status')
          .update({
            priority_score: update.priority_score,
            sync_interval_hours: update.sync_interval_hours,
            priority_calculated_at: update.priority_calculated_at,
            next_sync_after: update.next_sync_after,
          })
          .eq('appid', update.appid);

        if (!error) {
          updated++;
        }
      }

      offset += batchSize;

      log.info('Priority batch progress', {
        processed,
        updated,
        offset,
        total: totalApps,
      });
    }

    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          items_processed: processed,
          items_succeeded: updated,
          items_failed: processed - updated,
        })
        .eq('id', job.id);
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    log.info('Priority calculation completed', { processed, updated, durationMinutes: duration });
  } catch (error) {
    log.error('Priority calculation failed', { error });

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
