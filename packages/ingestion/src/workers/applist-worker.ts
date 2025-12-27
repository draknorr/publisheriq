/**
 * Steam App List Sync Worker
 *
 * Fetches the full list of apps from Steam Web API and syncs new apps to database.
 *
 * Run with: pnpm --filter @publisheriq/ingestion applist-sync
 */

import { getServiceClient } from '@publisheriq/database';
import { logger } from '@publisheriq/shared';
import { fetchSteamAppList } from '../apis/steam-web.js';

const log = logger.child({ worker: 'applist-sync' });

async function main(): Promise<void> {
  const startTime = Date.now();
  const githubRunId = process.env.GITHUB_RUN_ID;

  log.info('Starting App List sync', { githubRunId });

  const supabase = getServiceClient();

  const { data: job } = await supabase
    .from('sync_jobs')
    .insert({
      job_type: 'applist',
      github_run_id: githubRunId,
      status: 'running',
    })
    .select()
    .single();

  let newApps = 0;
  let existingApps = 0;
  let errors = 0;

  try {
    // Fetch full app list from Steam
    const apps = await fetchSteamAppList();
    log.info('Fetched app list', { count: apps.length });

    // Get existing app IDs for comparison
    const { data: existingIds } = await supabase.from('apps').select('appid');
    const existingSet = new Set((existingIds || []).map((a) => a.appid));

    log.info('Existing apps in database', { count: existingSet.size });

    // Filter to new apps only
    const newAppsList = apps.filter((app) => !existingSet.has(app.appid));
    log.info('New apps to insert', { count: newAppsList.length });

    // Batch insert new apps
    const batchSize = 500;
    for (let i = 0; i < newAppsList.length; i += batchSize) {
      const batch = newAppsList.slice(i, i + batchSize);

      const { error } = await supabase.from('apps').insert(
        batch.map((app) => ({
          appid: app.appid,
          name: app.name,
        }))
      );

      if (error) {
        log.error('Failed to insert batch', { batchStart: i, error });
        errors += batch.length;
      } else {
        newApps += batch.length;

        // Also create sync_status entries for new apps
        await supabase.from('sync_status').insert(
          batch.map((app) => ({
            appid: app.appid,
            priority_score: 0,
            needs_page_creation_scrape: true,
          }))
        );
      }

      if ((i + batchSize) % 5000 === 0) {
        log.info('Insert progress', { processed: i + batchSize, newApps, errors });
      }
    }

    existingApps = existingSet.size;

    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          items_processed: apps.length,
          items_succeeded: newApps,
          items_failed: errors,
        })
        .eq('id', job.id);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log.info('App List sync completed', {
      totalApps: apps.length,
      existingApps,
      newApps,
      errors,
      durationSeconds: duration,
    });
  } catch (error) {
    log.error('App List sync failed', { error });

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
