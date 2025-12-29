/**
 * SteamSpy Full Catalog Sync Worker
 *
 * Fetches all apps from SteamSpy's paginated API and syncs to database.
 * Rate limited to 1 request per 60 seconds for the "all" endpoint.
 *
 * NOTE: SteamSpy is used ONLY for enrichment data (CCU, owners, playtime, metrics).
 * Developers and publishers should come from Steam Storefront API, not SteamSpy.
 *
 * Run with: pnpm --filter @publisheriq/ingestion steamspy-sync
 */

import { getServiceClient } from '@publisheriq/database';
import { logger } from '@publisheriq/shared';
import { fetchAllSteamSpyApps, parseOwnerEstimate, type SteamSpyAppSummary } from '../apis/steamspy.js';

const log = logger.child({ worker: 'steamspy-sync' });

interface SyncStats {
  appsProcessed: number;
  errors: number;
}

async function processBatch(
  supabase: ReturnType<typeof getServiceClient>,
  apps: SteamSpyAppSummary[],
  stats: SyncStats
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  // Build arrays for batch upserts
  const appsToUpsert = apps.map((app) => ({
    appid: app.appid,
    name: app.name,
    is_free: parseInt(app.price, 10) === 0,
    current_price_cents: parseInt(app.price, 10) || null,
    current_discount_percent: parseInt(app.discount, 10) || 0,
  }));

  const syncStatusToUpsert = apps.map((app) => ({
    appid: app.appid,
    last_steamspy_sync: now,
    is_syncable: true,
  }));

  const metricsToUpsert = apps.map((app) => {
    const owners = parseOwnerEstimate(app.owners);
    return {
      appid: app.appid,
      metric_date: today,
      owners_min: owners.min,
      owners_max: owners.max,
      ccu_peak: app.ccu,
      average_playtime_forever: app.average_forever,
      average_playtime_2weeks: app.average_2weeks,
      positive_reviews: app.positive,
      negative_reviews: app.negative,
      total_reviews: app.positive + app.negative,
      price_cents: parseInt(app.price, 10) || null,
      discount_percent: parseInt(app.discount, 10) || 0,
    };
  });

  // Apps must complete first (sync_status and daily_metrics have FK to apps)
  const appsResult = await supabase.from('apps').upsert(appsToUpsert, { onConflict: 'appid' });
  if (appsResult.error) {
    log.error('Batch apps upsert failed', { error: appsResult.error });
    stats.errors += apps.length;
    return;
  }

  // Now sync_status and daily_metrics can run in parallel
  const [syncResult, metricsResult] = await Promise.all([
    supabase.from('sync_status').upsert(syncStatusToUpsert, { onConflict: 'appid' }),
    supabase.from('daily_metrics').upsert(metricsToUpsert, { onConflict: 'appid,metric_date' }),
  ]);

  if (syncResult.error) {
    log.error('Batch sync_status upsert failed', { error: syncResult.error });
    stats.errors += apps.length;
  } else if (metricsResult.error) {
    log.error('Batch metrics upsert failed', { error: metricsResult.error });
    stats.errors += apps.length;
  } else {
    stats.appsProcessed += apps.length;
  }
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const githubRunId = process.env.GITHUB_RUN_ID;
  const maxPages = parseInt(process.env.PAGES_LIMIT || '0', 10);

  log.info('Starting SteamSpy sync', { githubRunId, maxPages: maxPages || 'all' });

  const supabase = getServiceClient();

  // Create sync job record
  const { data: job, error: jobError } = await supabase
    .from('sync_jobs')
    .insert({
      job_type: 'steamspy',
      github_run_id: githubRunId,
      status: 'running',
    })
    .select()
    .single();

  if (jobError) {
    log.error('Failed to create sync job record', { error: jobError });
  }

  const stats: SyncStats = {
    appsProcessed: 0,
    errors: 0,
  };

  try {
    await fetchAllSteamSpyApps(maxPages, async (apps, page) => {
      log.info('Processing SteamSpy page', { page, appsCount: apps.length });
      await processBatch(supabase, apps, stats);
      log.info('Completed SteamSpy page', {
        page,
        processed: stats.appsProcessed,
        errors: stats.errors,
      });
    });

    // Update sync job as completed
    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          items_processed: stats.appsProcessed,
          items_succeeded: stats.appsProcessed,
          items_failed: stats.errors,
        })
        .eq('id', job.id);
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    log.info('SteamSpy sync completed', {
      durationMinutes: duration,
      appsProcessed: stats.appsProcessed,
      errors: stats.errors,
    });
  } catch (error) {
    log.error('SteamSpy sync failed', { error });

    // Update sync job as failed
    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : String(error),
          items_processed: stats.appsProcessed,
          items_succeeded: stats.appsProcessed,
          items_failed: stats.errors,
        })
        .eq('id', job.id);
    }

    process.exit(1);
  }
}

main();
