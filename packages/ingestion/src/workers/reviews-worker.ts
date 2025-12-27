/**
 * Reviews Sync Worker
 *
 * Fetches review summaries from Steam Reviews API for apps due for sync.
 *
 * Run with: pnpm --filter @publisheriq/ingestion reviews-sync
 */

import { getServiceClient } from '@publisheriq/database';
import { logger, BATCH_SIZES } from '@publisheriq/shared';
import { fetchReviewSummary } from '../apis/reviews.js';

const log = logger.child({ worker: 'reviews-sync' });

interface SyncStats {
  appsProcessed: number;
  appsSucceeded: number;
  appsFailed: number;
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
    appsSucceeded: 0,
    appsFailed: 0,
  };

  try {
    // Get apps due for sync
    const { data: appsToSync, error: fetchError } = await supabase.rpc('get_apps_for_sync', {
      p_source: 'reviews',
      p_limit: batchSize,
    });

    if (fetchError) {
      throw new Error(`Failed to get apps for sync: ${fetchError.message}`);
    }

    if (!appsToSync || appsToSync.length === 0) {
      log.info('No apps due for reviews sync');
      return;
    }

    log.info('Found apps to sync', { count: appsToSync.length });
    const today = new Date().toISOString().split('T')[0];

    for (const { appid } of appsToSync) {
      stats.appsProcessed++;

      try {
        const summary = await fetchReviewSummary(appid);

        if (!summary) {
          stats.appsFailed++;
          continue;
        }

        // Update daily metrics with review data
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

        // Update sync status
        await supabase
          .from('sync_status')
          .update({
            last_reviews_sync: new Date().toISOString(),
            consecutive_errors: 0,
          })
          .eq('appid', appid);

        stats.appsSucceeded++;
      } catch (error) {
        log.error('Error processing app', { appid, error });
        stats.appsFailed++;
      }

      if (stats.appsProcessed % 50 === 0) {
        log.info('Sync progress', { ...stats });
      }
    }

    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          items_processed: stats.appsProcessed,
          items_succeeded: stats.appsSucceeded,
          items_failed: stats.appsFailed,
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
        })
        .eq('id', job.id);
    }

    process.exit(1);
  }
}

main();
