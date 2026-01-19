/**
 * Interpolation Worker
 *
 * Fills gaps in review_deltas with interpolated values for trend visualization.
 * Runs daily to ensure continuous time-series data.
 *
 * Run with: pnpm --filter @publisheriq/ingestion interpolate-reviews
 */

import { getServiceClient } from '@publisheriq/database';
import { logger } from '@publisheriq/shared';

const log = logger.child({ worker: 'interpolation' });

async function main(): Promise<void> {
  const startTime = Date.now();
  const githubRunId = process.env.GITHUB_RUN_ID;

  // Get date range from env or default to last 30 days
  const daysBack = parseInt(process.env.INTERPOLATION_DAYS || '30', 10);
  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];

  log.info('Starting review interpolation', {
    githubRunId,
    startDate,
    endDate,
    daysBack,
  });

  const supabase = getServiceClient();

  // Create sync job record
  const { data: job } = await supabase
    .from('sync_jobs')
    .insert({
      job_type: 'interpolation',
      github_run_id: githubRunId,
      status: 'running',
      batch_size: daysBack,
    })
    .select()
    .single();

  try {
    // Call the batch interpolation function
    log.info('Running batch interpolation');
    const { data: result, error: interpolateError } = await supabase.rpc(
      'interpolate_all_review_deltas',
      {
        p_start_date: startDate,
        p_end_date: endDate,
      }
    );

    if (interpolateError) {
      throw new Error(`Failed to interpolate: ${interpolateError.message}`);
    }

    const totalInterpolated = result?.[0]?.total_interpolated ?? 0;
    const appsProcessed = result?.[0]?.apps_processed ?? 0;

    log.info('Interpolation completed', {
      totalInterpolated,
      appsProcessed,
    });

    // Get stats on interpolated vs actual data
    const { data: deltaStats } = await supabase
      .from('review_deltas')
      .select('is_interpolated')
      .gte('delta_date', startDate);

    const interpolatedCount =
      deltaStats?.filter((d) => d.is_interpolated).length ?? 0;
    const actualCount = deltaStats?.filter((d) => !d.is_interpolated).length ?? 0;

    log.info('Delta stats', {
      totalRecords: deltaStats?.length ?? 0,
      actualSyncs: actualCount,
      interpolatedRecords: interpolatedCount,
      interpolationRatio:
        actualCount > 0 ? (interpolatedCount / actualCount).toFixed(2) : 'N/A',
    });

    // Update job as completed
    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          items_processed: appsProcessed,
          items_succeeded: totalInterpolated,
          items_failed: 0,
          items_created: totalInterpolated,
        })
        .eq('id', job.id);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log.info('Interpolation worker completed', {
      durationSeconds: duration,
      appsProcessed,
      totalInterpolated,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    log.error('Interpolation failed', {
      error: errorMessage,
      stack: errorStack,
      durationSeconds: ((Date.now() - startTime) / 1000).toFixed(2),
    });

    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq('id', job.id);
    }

    process.exit(1);
  }
}

main();
