/**
 * Reviews Sync Worker
 *
 * Fetches review summaries from Steam Reviews API for apps due for sync.
 * Uses velocity-based scheduling to prioritize high-activity games.
 *
 * Run with: pnpm --filter @publisheriq/ingestion reviews-sync
 */

import { getServiceClient } from '@publisheriq/database';
import { logger, BATCH_SIZES } from '@publisheriq/shared';
import pLimit from 'p-limit';
import { fetchReviewSummary } from '../apis/reviews.js';

const log = logger.child({ worker: 'reviews-sync' });

// Process this many apps concurrently
// Rate limiter handles API throttling, this controls DB operation parallelism
const CONCURRENCY = 8;

interface SyncStats {
  appsProcessed: number;
  appsCreated: number; // First-time enrichment
  appsUpdated: number; // Refresh of existing data
  appsFailed: number;
}

interface PreviousSyncData {
  totalReviews: number;
  positiveReviews: number;
  lastSync: Date | null;
}

interface VelocityTierResult {
  tier: string;
  intervalHours: number;
}

type SupabaseClient = ReturnType<typeof getServiceClient>;

/**
 * Calculate velocity tier based on daily review rate
 */
function calculateVelocityTier(dailyVelocity: number): VelocityTierResult {
  if (dailyVelocity >= 5) {
    return { tier: 'high', intervalHours: 4 }; // ~5+ reviews/day: sync every 4 hours
  } else if (dailyVelocity >= 1) {
    return { tier: 'medium', intervalHours: 12 }; // 1-5 reviews/day: sync every 12 hours
  } else if (dailyVelocity >= 0.1) {
    return { tier: 'low', intervalHours: 24 }; // 0.1-1 reviews/day: sync daily
  } else {
    return { tier: 'dormant', intervalHours: 72 }; // <0.1 reviews/day: sync every 3 days
  }
}

/**
 * Process a single app - fetch review summary, track delta, update database
 */
async function processApp(
  appid: number,
  supabase: SupabaseClient,
  today: string,
  previousSyncData: Map<number, PreviousSyncData>,
  neverSyncedSet: Set<number>,
  stats: SyncStats
): Promise<void> {
  // Increment processed count synchronously (before any await) to avoid race conditions
  stats.appsProcessed++;

  try {
    const summary = await fetchReviewSummary(appid);

    if (!summary) {
      stats.appsFailed++;
      return;
    }

    const previous = previousSyncData.get(appid);
    const previousTotal = previous?.totalReviews ?? 0;
    const previousPositive = previous?.positiveReviews ?? 0;
    const lastSyncTime = previous?.lastSync;

    // Calculate deltas
    const reviewsAdded = Math.max(0, summary.totalReviews - previousTotal);
    const positiveAdded = Math.max(0, summary.positiveReviews - previousPositive);
    const negativeAdded = Math.max(0, reviewsAdded - positiveAdded);

    // Calculate hours since last sync
    const hoursSinceLastSync = lastSyncTime
      ? (Date.now() - lastSyncTime.getTime()) / (1000 * 60 * 60)
      : null;

    // Calculate daily velocity (normalized to 24h)
    const dailyVelocity =
      hoursSinceLastSync && hoursSinceLastSync > 0
        ? (reviewsAdded * 24) / hoursSinceLastSync
        : 0;

    // Determine velocity tier and next sync interval
    const { tier, intervalHours } = calculateVelocityTier(dailyVelocity);
    const nextSync = new Date(Date.now() + intervalHours * 60 * 60 * 1000);

    // Check if app has new reviews (indicates activity)
    const hasNewReviews = reviewsAdded > 0;

    // 1. Insert into review_deltas table (new tracking)
    await supabase.from('review_deltas').upsert(
      {
        appid,
        delta_date: today,
        total_reviews: summary.totalReviews,
        positive_reviews: summary.positiveReviews,
        review_score: summary.reviewScore,
        review_score_desc: summary.reviewScoreDesc,
        reviews_added: reviewsAdded,
        positive_added: positiveAdded,
        negative_added: negativeAdded,
        hours_since_last_sync: hoursSinceLastSync,
        is_interpolated: false,
      },
      { onConflict: 'appid,delta_date' }
    );

    // 2. Update daily_metrics (existing behavior for backward compatibility)
    await supabase.from('daily_metrics').upsert(
      {
        appid,
        metric_date: today,
        total_reviews: summary.totalReviews,
        positive_reviews: summary.positiveReviews,
        negative_reviews: summary.negativeReviews,
        review_score: summary.reviewScore,
        review_score_desc: summary.reviewScoreDesc,
      },
      { onConflict: 'appid,metric_date' }
    );

    // 3. Update sync_status with velocity info and next sync time
    const syncUpdate: Record<string, unknown> = {
      last_reviews_sync: new Date().toISOString(),
      next_reviews_sync: nextSync.toISOString(),
      reviews_interval_hours: intervalHours,
      review_velocity_tier: tier,
      last_known_total_reviews: summary.totalReviews,
      consecutive_errors: 0,
    };

    if (hasNewReviews) {
      syncUpdate.last_activity_at = new Date().toISOString();
    }

    await supabase.from('sync_status').update(syncUpdate).eq('appid', appid);

    // Track as first-time enrichment or refresh (synchronous to avoid race)
    if (neverSyncedSet.has(appid)) {
      stats.appsCreated++;
    } else {
      stats.appsUpdated++;
    }
  } catch (error) {
    log.error('Error processing app', { appid, error });
    stats.appsFailed++;
  }
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const githubRunId = process.env.GITHUB_RUN_ID;
  const batchSize = parseInt(process.env.BATCH_SIZE || String(BATCH_SIZES.REVIEWS_BATCH), 10);

  log.info('Starting Reviews sync', { githubRunId, batchSize });

  const supabase = getServiceClient();

  // Create sync job record
  const { data: job } = await supabase
    .from('sync_jobs')
    .insert({
      job_type: 'reviews',
      github_run_id: githubRunId,
      status: 'running',
      batch_size: batchSize,
    })
    .select()
    .single();

  const stats: SyncStats = {
    appsProcessed: 0,
    appsCreated: 0,
    appsUpdated: 0,
    appsFailed: 0,
  };

  try {
    // Get apps due for sync using velocity-based scheduling
    const { data: appsToSync, error: fetchError } = await supabase.rpc(
      'get_apps_for_reviews_sync',
      { p_limit: batchSize }
    );

    if (fetchError) {
      throw new Error(`Failed to get apps for sync: ${fetchError.message}`);
    }

    if (!appsToSync || appsToSync.length === 0) {
      log.info('No apps due for reviews sync');

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
            items_created: 0,
            items_updated: 0,
          })
          .eq('id', job.id);
      }
      return;
    }

    // Log velocity tier breakdown
    const tierCounts = appsToSync.reduce(
      (acc: Record<string, number>, app: { velocity_tier: string }) => {
        acc[app.velocity_tier] = (acc[app.velocity_tier] || 0) + 1;
        return acc;
      },
      {}
    );
    log.info('Found apps to sync', { count: appsToSync.length, tierCounts });

    const today = new Date().toISOString().split('T')[0];

    // Fetch previous sync data including timestamps and review counts
    const appIds = appsToSync.map(
      (a: { appid: number; last_known_total_reviews: number | null }) => a.appid
    );
    const { data: syncStatuses } = await supabase
      .from('sync_status')
      .select('appid, last_reviews_sync, last_known_total_reviews')
      .in('appid', appIds);

    // Fetch positive reviews from daily_metrics for delta calculation
    const { data: previousMetrics } = await supabase
      .from('daily_metrics')
      .select('appid, total_reviews, positive_reviews')
      .in('appid', appIds)
      .order('metric_date', { ascending: false });

    // Build map of previous sync data
    const previousSyncData = new Map<number, PreviousSyncData>();

    // First, populate from sync_status (has last_known_total_reviews)
    for (const s of syncStatuses || []) {
      previousSyncData.set(s.appid, {
        totalReviews: s.last_known_total_reviews ?? 0,
        positiveReviews: 0, // Will be updated from daily_metrics
        lastSync: s.last_reviews_sync ? new Date(s.last_reviews_sync) : null,
      });
    }

    // Then, update with positive reviews from daily_metrics
    if (previousMetrics) {
      for (const m of previousMetrics) {
        const existing = previousSyncData.get(m.appid);
        if (existing && existing.positiveReviews === 0) {
          existing.positiveReviews = m.positive_reviews ?? 0;
          // Also use daily_metrics total if sync_status doesn't have it
          if (existing.totalReviews === 0) {
            existing.totalReviews = m.total_reviews ?? 0;
          }
        }
      }
    }

    // Build set of apps that have never been synced (first-time enrichment)
    const neverSyncedSet = new Set(
      (syncStatuses || [])
        .filter((s) => s.last_reviews_sync === null)
        .map((s) => s.appid)
    );

    log.info('First-time vs refresh breakdown', {
      firstTime: neverSyncedSet.size,
      refresh: appsToSync.length - neverSyncedSet.size,
    });

    // Process apps with controlled concurrency
    // Rate limiter handles API throttling, p-limit controls parallelism
    const limit = pLimit(CONCURRENCY);

    // Log progress every 10 seconds
    const progressInterval = setInterval(() => {
      log.info('Sync progress', { ...stats });
    }, 10000);

    try {
      await Promise.all(
        appsToSync.map(({ appid }: { appid: number }) =>
          limit(() =>
            processApp(appid, supabase, today, previousSyncData, neverSyncedSet, stats)
          )
        )
      );
    } finally {
      clearInterval(progressInterval);
    }

    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          items_processed: stats.appsProcessed,
          items_succeeded: stats.appsCreated + stats.appsUpdated,
          items_failed: stats.appsFailed,
          items_created: stats.appsCreated,
          items_updated: stats.appsUpdated,
        })
        .eq('id', job.id);
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    log.info('Reviews sync completed', { ...stats, durationMinutes: duration });
  } catch (error) {
    log.error('Reviews sync failed', { error });

    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : String(error),
          items_processed: stats.appsProcessed,
          items_succeeded: stats.appsCreated + stats.appsUpdated,
          items_failed: stats.appsFailed,
          items_created: stats.appsCreated,
          items_updated: stats.appsUpdated,
        })
        .eq('id', job.id);
    }

    process.exit(1);
  }
}

main();
