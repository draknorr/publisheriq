/**
 * Review Histogram Sync Worker
 *
 * Fetches review histograms for trend analysis.
 *
 * Run with: pnpm --filter @publisheriq/ingestion histogram-sync
 */

import { getServiceClient } from '@publisheriq/database';
import { logger, BATCH_SIZES } from '@publisheriq/shared';
import { fetchReviewHistogram } from '../apis/reviews.js';

const log = logger.child({ worker: 'histogram-sync' });

async function main(): Promise<void> {
  const startTime = Date.now();
  const githubRunId = process.env.GITHUB_RUN_ID;
  const batchSize = parseInt(process.env.BATCH_SIZE || String(BATCH_SIZES.HISTOGRAM_BATCH), 10);

  log.info('Starting Histogram sync', { githubRunId, batchSize });

  const supabase = getServiceClient();

  const { data: job } = await supabase
    .from('sync_jobs')
    .insert({
      job_type: 'histogram',
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
    // Get apps due for histogram sync
    const { data: appsToSync } = await supabase.rpc('get_apps_for_sync', {
      p_source: 'histogram',
      p_limit: batchSize,
    });

    if (!appsToSync || appsToSync.length === 0) {
      log.info('No apps due for histogram sync');

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

    log.info('Found apps to sync', { count: appsToSync.length });

    for (const { appid } of appsToSync) {
      processed++;

      try {
        const histogram = await fetchReviewHistogram(appid);

        if (!histogram || histogram.length === 0) {
          failed++;
          continue;
        }

        // Insert histogram entries
        for (const entry of histogram) {
          const monthStart = entry.monthStart.toISOString().split('T')[0];

          await supabase.from('review_histogram').upsert(
            {
              appid,
              month_start: monthStart,
              recommendations_up: entry.recommendationsUp,
              recommendations_down: entry.recommendationsDown,
            },
            { onConflict: 'appid,month_start' }
          );
        }

        // Update sync status
        await supabase
          .from('sync_status')
          .update({
            last_histogram_sync: new Date().toISOString(),
          })
          .eq('appid', appid);

        succeeded++;
      } catch (error) {
        log.error('Error processing app', { appid, error });
        failed++;
      }

      if (processed % 100 === 0) {
        log.info('Sync progress', { processed, succeeded, failed });
      }
    }

    // Note: histogram only updates existing apps, so items_created is always 0
    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          items_processed: processed,
          items_succeeded: succeeded,
          items_failed: failed,
          items_created: 0,
          items_updated: succeeded,
        })
        .eq('id', job.id);
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    log.info('Histogram sync completed', { processed, succeeded, failed, durationMinutes: duration });
  } catch (error) {
    log.error('Histogram sync failed', { error });

    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : String(error),
          items_processed: processed,
          items_succeeded: succeeded,
          items_failed: failed,
          items_created: 0,
          items_updated: succeeded,
        })
        .eq('id', job.id);
    }

    process.exit(1);
  }
}

main();
