/**
 * Materialized View Refresh Worker
 *
 * Refreshes the heavyweight materialized view chain in dependency order.
 * app_filter_data and filter-count views are refreshed on separate schedules.
 *
 * Run with: pnpm --filter @publisheriq/ingestion refresh-views
 */

import { getServiceClient } from '@publisheriq/database';
import { refreshMaterializedView } from '@publisheriq/database/ingestion';
import { logger } from '@publisheriq/shared';

const log = logger.child({ worker: 'refresh-views' });

const DEFAULT_LOCK_TIMEOUT_MS = 15_000;

const MATERIALIZED_VIEWS = [
  { name: 'latest_daily_metrics', timeoutMs: 600_000 },
  { name: 'publisher_metrics', timeoutMs: 600_000 },
  { name: 'developer_metrics', timeoutMs: 600_000 },
  { name: 'publisher_year_metrics', timeoutMs: 600_000 },
  { name: 'developer_year_metrics', timeoutMs: 600_000 },
  { name: 'publisher_game_metrics', timeoutMs: 600_000 },
  { name: 'developer_game_metrics', timeoutMs: 600_000 },
  { name: 'monthly_game_metrics', timeoutMs: 300_000 },
  { name: 'mv_apps_aggregate_stats', timeoutMs: 120_000 },
] as const;

async function refreshView(
  viewName: string,
  timeoutMs: number
): Promise<{ success: boolean; durationMs: number; error?: string }> {
  const startTime = Date.now();

  try {
    await refreshMaterializedView(viewName, {
      lockTimeoutMs: DEFAULT_LOCK_TIMEOUT_MS,
      timeoutMs,
    });

    const durationMs = Date.now() - startTime;
    return { success: true, durationMs };
  } catch (rpcError) {
    const durationMs = Date.now() - startTime;
    let errorMessage: string;

    if (rpcError instanceof Error) {
      errorMessage = rpcError.message;
    } else if (typeof rpcError === 'object' && rpcError !== null) {
      errorMessage = JSON.stringify(rpcError);
    } else {
      errorMessage = String(rpcError);
    }

    return {
      success: false,
      durationMs,
      error: errorMessage,
    };
  }
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const githubRunId = process.env.GITHUB_RUN_ID;

  log.info('Starting materialized view refresh', { githubRunId });

  const supabase = getServiceClient();

  // Create sync job record
  const { data: job } = await supabase
    .from('sync_jobs')
    .insert({
      job_type: 'refresh_views',
      github_run_id: githubRunId,
      status: 'running',
    })
    .select()
    .single();

  const results: Array<{ view: string; success: boolean; durationMs: number; error?: string }> = [];

  try {
    // Refresh each view in order
    for (const { name, timeoutMs } of MATERIALIZED_VIEWS) {
      log.info('Refreshing view', {
        lockTimeoutMs: DEFAULT_LOCK_TIMEOUT_MS,
        statementTimeoutMs: timeoutMs,
        view: name,
      });

      const result = await refreshView(name, timeoutMs);
      results.push({ view: name, ...result });

      if (result.success) {
        log.info('View refreshed', { view: name, durationMs: result.durationMs });
      } else {
        log.error('View refresh failed', { view: name, error: result.error });
        throw new Error(`Failed to refresh ${name}: ${result.error ?? 'unknown error'}`);
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: failed > 0 ? 'completed_with_errors' : 'completed',
          completed_at: new Date().toISOString(),
          items_processed: results.length,
          items_succeeded: succeeded,
          items_failed: failed,
        })
        .eq('id', job.id);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log.info('Materialized view refresh completed', {
      durationSeconds: duration,
      succeeded,
      failed,
      results,
    });

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    log.error('Materialized view refresh failed', { error });

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
