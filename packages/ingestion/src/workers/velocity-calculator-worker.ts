/**
 * Velocity Calculator Worker
 *
 * Recalculates review velocity stats and updates sync_status tiers.
 * Refreshes the review_velocity_stats materialized view.
 *
 * Run with: pnpm --filter @publisheriq/ingestion calculate-velocity
 */

import { getServiceClient } from '@publisheriq/database';
import {
  getReviewVelocityTierDistribution,
  refreshReviewVelocityStats,
  updateReviewVelocityTiersBatch,
} from '@publisheriq/database/ingestion';
import { logger } from '@publisheriq/shared';
import { withRetry } from '../utils/retry.js';

const log = logger.child({ worker: 'velocity-calc' });
const DEFAULT_BATCH_SIZE = 1000;
const DEFAULT_EMPTY_BATCH_EXIT_THRESHOLD = 2;
const DEFAULT_IDLE_BATCH_DELAY_MS = 2000;
const DEFAULT_DUPLICATE_GUARD_WINDOW_HOURS = 2;

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    const parts = [
      typeof record.message === 'string' ? record.message : null,
      typeof record.code === 'string' ? `code=${record.code}` : null,
      typeof record.details === 'string' ? `details=${record.details}` : null,
      typeof record.hint === 'string' ? `hint=${record.hint}` : null,
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(' | ');
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

function isDeadlockError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const code = 'code' in error ? error.code : undefined;
  const message = 'message' in error ? error.message : undefined;

  return (
    code === '40P01' ||
    (typeof message === 'string' && message.toLowerCase().includes('deadlock detected'))
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const githubRunId = process.env.GITHUB_RUN_ID;
  const batchSize = parseInt(process.env.VELOCITY_BATCH_SIZE || `${DEFAULT_BATCH_SIZE}`, 10);
  const emptyBatchExitThreshold = parseInt(
    process.env.VELOCITY_EMPTY_BATCH_EXIT_THRESHOLD || `${DEFAULT_EMPTY_BATCH_EXIT_THRESHOLD}`,
    10
  );
  const idleBatchDelayMs = parseInt(
    process.env.VELOCITY_IDLE_BATCH_DELAY_MS || `${DEFAULT_IDLE_BATCH_DELAY_MS}`,
    10
  );
  const duplicateGuardWindowHours = parseInt(
    process.env.VELOCITY_DUPLICATE_GUARD_WINDOW_HOURS ||
      `${DEFAULT_DUPLICATE_GUARD_WINDOW_HOURS}`,
    10
  );

  log.info('Starting velocity calculation', {
    githubRunId,
    batchSize,
    emptyBatchExitThreshold,
  });

  const supabase = getServiceClient();

  const duplicateGuardSince = new Date(
    Date.now() - duplicateGuardWindowHours * 60 * 60 * 1000
  ).toISOString();
  const { count: runningVelocityJobs, error: runningVelocityJobsError } = await supabase
    .from('sync_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('job_type', 'velocity-calc')
    .eq('status', 'running')
    .gte('started_at', duplicateGuardSince);

  if (runningVelocityJobsError) {
    throw new Error(
      `Failed to check for duplicate velocity jobs: ${runningVelocityJobsError.message}`
    );
  }

  if ((runningVelocityJobs ?? 0) > 0) {
    log.warn('Another velocity calculation job is already running, exiting early', {
      runningVelocityJobs,
      duplicateGuardSince,
    });
    return;
  }

  // Create sync job record
  const { data: job } = await supabase
    .from('sync_jobs')
    .insert({
      job_type: 'velocity-calc',
      github_run_id: githubRunId,
      status: 'running',
      batch_size: batchSize,
    })
    .select()
    .single();

  try {
    // 1. Refresh the materialized view
    log.info('Refreshing review_velocity_stats materialized view');
    const refreshStartedAt = Date.now();
    await refreshReviewVelocityStats();
    const refreshDurationMs = Date.now() - refreshStartedAt;

    log.info('Materialized view refreshed successfully', { refreshDurationMs });

    // 2. Update sync_status with new velocity data
    log.info('Updating sync_status with velocity tiers in ordered batches');
    const tierUpdateStartedAt = Date.now();
    let updatedCount = 0;
    let batchCount = 0;
    let emptyBatchCount = 0;
    let deadlockRetries = 0;

    while (emptyBatchCount < emptyBatchExitThreshold) {
      const batchStartedAt = Date.now();
      const batchResult = await withRetry(
        () => updateReviewVelocityTiersBatch(batchSize),
        {
          initialDelayMs: idleBatchDelayMs,
          maxRetries: 3,
          maxDelayMs: 15000,
          shouldRetry: isDeadlockError,
          onRetry: (error, attempt, delayMs) => {
            deadlockRetries += 1;
            log.warn('Velocity batch deadlocked, retrying', {
              attempt,
              delayMs,
              batchSize,
              error: formatUnknownError(error),
            });
          },
        }
      );

      batchCount += 1;

      if (batchResult.updatedCount === 0) {
        emptyBatchCount += 1;
        if (emptyBatchCount < emptyBatchExitThreshold) {
          await sleep(idleBatchDelayMs);
        }
        continue;
      }

      emptyBatchCount = 0;
      updatedCount += batchResult.updatedCount;

      log.info('Velocity tier batch applied', {
        batchCount,
        batchDurationMs: Date.now() - batchStartedAt,
        updatedCount: batchResult.updatedCount,
      });
    }

    const tierUpdateDurationMs = Date.now() - tierUpdateStartedAt;
    log.info('Velocity tiers updated', {
      updatedCount,
      batchCount,
      deadlockRetries,
      tierUpdateDurationMs,
    });

    // 3. Get tier distribution for logging
    const tierDistribution = await getReviewVelocityTierDistribution();

    log.info('Velocity tier distribution', { ...tierDistribution });

    // Update job as completed
    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          items_processed: updatedCount,
          items_succeeded: updatedCount,
          items_failed: 0,
        })
        .eq('id', job.id);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log.info('Velocity calculation completed', {
      durationSeconds: duration,
      appsUpdated: updatedCount,
      tierDistribution,
    });
  } catch (error) {
    const errorMessage = formatUnknownError(error);
    log.error('Velocity calculation failed', { error: errorMessage });

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
