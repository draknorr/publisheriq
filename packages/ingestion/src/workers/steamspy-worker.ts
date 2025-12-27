/**
 * SteamSpy Full Catalog Sync Worker
 *
 * Fetches all apps from SteamSpy's paginated API and syncs to database.
 * Rate limited to 1 request per 60 seconds for the "all" endpoint.
 *
 * Run with: pnpm --filter @publisheriq/ingestion steamspy-sync
 */

import { getServiceClient } from '@publisheriq/database';
import { logger } from '@publisheriq/shared';
import { fetchAllSteamSpyApps, parseOwnerEstimate, type SteamSpyAppSummary } from '../apis/steamspy.js';

const log = logger.child({ worker: 'steamspy-sync' });

interface SyncStats {
  appsProcessed: number;
  appsInserted: number;
  appsUpdated: number;
  developersUpserted: number;
  publishersUpserted: number;
  errors: number;
}

async function processBatch(
  supabase: ReturnType<typeof getServiceClient>,
  apps: SteamSpyAppSummary[],
  stats: SyncStats
): Promise<void> {
  for (const app of apps) {
    try {
      stats.appsProcessed++;

      // Parse owner estimate
      const owners = parseOwnerEstimate(app.owners);

      // Upsert app
      const { error: appError } = await supabase.from('apps').upsert(
        {
          appid: app.appid,
          name: app.name,
          is_free: parseInt(app.price, 10) === 0,
          current_price_cents: parseInt(app.price, 10) || null,
          current_discount_percent: parseInt(app.discount, 10) || 0,
        },
        { onConflict: 'appid' }
      );

      if (appError) {
        log.error('Failed to upsert app', { appid: app.appid, error: appError });
        stats.errors++;
        continue;
      }

      // Upsert developer if exists
      if (app.developer && app.developer.trim()) {
        const { data: devData, error: devError } = await supabase.rpc('upsert_developer', {
          p_name: app.developer.trim(),
        });

        if (devError) {
          log.error('Failed to upsert developer', { developer: app.developer, error: devError });
        } else if (devData) {
          stats.developersUpserted++;

          // Link app to developer
          await supabase.from('app_developers').upsert(
            { appid: app.appid, developer_id: devData },
            { onConflict: 'appid,developer_id' }
          );
        }
      }

      // Upsert publisher if exists
      if (app.publisher && app.publisher.trim()) {
        const { data: pubData, error: pubError } = await supabase.rpc('upsert_publisher', {
          p_name: app.publisher.trim(),
        });

        if (pubError) {
          log.error('Failed to upsert publisher', { publisher: app.publisher, error: pubError });
        } else if (pubData) {
          stats.publishersUpserted++;

          // Link app to publisher
          await supabase.from('app_publishers').upsert(
            { appid: app.appid, publisher_id: pubData },
            { onConflict: 'appid,publisher_id' }
          );
        }
      }

      // Upsert sync_status
      await supabase.from('sync_status').upsert(
        {
          appid: app.appid,
          last_steamspy_sync: new Date().toISOString(),
          is_syncable: true,
        },
        { onConflict: 'appid' }
      );

      // Insert daily metrics
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('daily_metrics').upsert(
        {
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
        },
        { onConflict: 'appid,metric_date' }
      );

      stats.appsInserted++;
    } catch (error) {
      log.error('Error processing app', { appid: app.appid, error });
      stats.errors++;
    }
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
    appsInserted: 0,
    appsUpdated: 0,
    developersUpserted: 0,
    publishersUpserted: 0,
    errors: 0,
  };

  try {
    await fetchAllSteamSpyApps(maxPages, async (apps, page) => {
      log.info('Processing SteamSpy page', { page, appsCount: apps.length });
      await processBatch(supabase, apps, stats);
      log.info('Completed SteamSpy page', { page, stats });
    });

    // Update sync job as completed
    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          items_processed: stats.appsProcessed,
          items_succeeded: stats.appsInserted,
          items_failed: stats.errors,
        })
        .eq('id', job.id);
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    log.info('SteamSpy sync completed', { ...stats, durationMinutes: duration });
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
          items_succeeded: stats.appsInserted,
          items_failed: stats.errors,
        })
        .eq('id', job.id);
    }

    process.exit(1);
  }
}

main();
