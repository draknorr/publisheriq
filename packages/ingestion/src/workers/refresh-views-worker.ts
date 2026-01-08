/**
 * Materialized View Refresh Worker
 *
 * Refreshes all materialized views in the correct dependency order.
 * Should be run after sync jobs complete to update aggregated metrics.
 *
 * Run with: pnpm --filter @publisheriq/ingestion refresh-views
 */

import { getServiceClient } from '@publisheriq/database';
import { logger } from '@publisheriq/shared';

const log = logger.child({ worker: 'refresh-views' });

// Materialized views in dependency order (refresh parents before children)
const MATERIALIZED_VIEWS = [
  // Level 1: Depends on daily_metrics
  'latest_daily_metrics',

  // Level 2: Depends on latest_daily_metrics and apps
  'publisher_metrics',
  'developer_metrics',

  // Level 3: Depends on publisher_metrics/developer_metrics or apps directly
  'publisher_year_metrics',
  'developer_year_metrics',
  'publisher_game_metrics',
  'developer_game_metrics',

  // Level 4: Monthly aggregations
  'monthly_game_metrics',
];

async function refreshView(
  supabase: ReturnType<typeof getServiceClient>,
  viewName: string
): Promise<{ success: boolean; durationMs: number; error?: string }> {
  const startTime = Date.now();

  try {
    // Use CONCURRENTLY to avoid locking the view during refresh
    const { error } = await supabase.rpc('refresh_materialized_view', {
      view_name: viewName,
    });

    if (error) {
      // Format the error properly
      const errorMessage = typeof error === 'object' ? JSON.stringify(error) : String(error);
      throw new Error(errorMessage);
    }

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
    // Check if the refresh_materialized_view function exists
    // If not, we'll need to create it or use a different approach
    const { error: checkError } = await supabase.rpc('refresh_materialized_view', {
      view_name: 'latest_daily_metrics',
    });

    if (checkError && checkError.message.includes('function') && checkError.message.includes('does not exist')) {
      log.warn('refresh_materialized_view function not found, creating it...');

      // The function needs to be created via migration
      // For now, skip and log instructions
      log.error(
        'Please create the refresh_materialized_view function. ' +
          'Run: CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name TEXT) RETURNS VOID AS $$ ' +
          "BEGIN EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY ' || quote_ident(view_name); END; $$ LANGUAGE plpgsql;"
      );

      if (job) {
        await supabase
          .from('sync_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: 'refresh_materialized_view function does not exist',
          })
          .eq('id', job.id);
      }

      process.exit(1);
    }

    // Refresh each view in order
    for (const viewName of MATERIALIZED_VIEWS) {
      log.info('Refreshing view', { view: viewName });

      const result = await refreshView(supabase, viewName);
      results.push({ view: viewName, ...result });

      if (result.success) {
        log.info('View refreshed', { view: viewName, durationMs: result.durationMs });
      } else {
        log.error('View refresh failed', { view: viewName, error: result.error });
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
