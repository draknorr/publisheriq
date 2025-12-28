/**
 * Storefront Details Sync Worker
 *
 * Fetches app details from Steam Storefront API for apps due for sync.
 * Prioritizes apps by priority_score.
 *
 * Run with: pnpm --filter @publisheriq/ingestion storefront-sync
 */

import { getServiceClient } from '@publisheriq/database';
import { logger, BATCH_SIZES } from '@publisheriq/shared';
import { fetchStorefrontAppDetails } from '../apis/storefront.js';

const log = logger.child({ worker: 'storefront-sync' });

interface SyncStats {
  appsProcessed: number;
  appsSucceeded: number;
  appsFailed: number;
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const githubRunId = process.env.GITHUB_RUN_ID;
  const batchSize = parseInt(process.env.BATCH_SIZE || String(BATCH_SIZES.STOREFRONT_BATCH), 10);

  log.info('Starting Storefront sync', { githubRunId, batchSize });

  const supabase = getServiceClient();

  // Create sync job record
  const { data: job, error: jobError } = await supabase
    .from('sync_jobs')
    .insert({
      job_type: 'storefront',
      github_run_id: githubRunId,
      status: 'running',
      batch_size: batchSize,
    })
    .select()
    .single();

  if (jobError) {
    log.error('Failed to create sync job record', { error: jobError });
  }

  const stats: SyncStats = {
    appsProcessed: 0,
    appsSucceeded: 0,
    appsFailed: 0,
  };

  try {
    // Get apps due for sync using the database function
    const { data: appsToSync, error: fetchError } = await supabase.rpc('get_apps_for_sync', {
      p_source: 'storefront',
      p_limit: batchSize,
    });

    if (fetchError) {
      throw new Error(`Failed to get apps for sync: ${fetchError.message}`);
    }

    if (!appsToSync || appsToSync.length === 0) {
      log.info('No apps due for storefront sync');
      return;
    }

    log.info('Found apps to sync', { count: appsToSync.length });

    for (const { appid } of appsToSync) {
      stats.appsProcessed++;

      try {
        const details = await fetchStorefrontAppDetails(appid);

        if (!details) {
          log.debug('No details returned for app', { appid });
          stats.appsFailed++;

          // Update sync status with error
          await supabase
            .from('sync_status')
            .update({
              last_storefront_sync: new Date().toISOString(),
              consecutive_errors: supabase.rpc('increment_errors', { row_appid: appid }),
              last_error_source: 'storefront',
              last_error_message: 'No data returned',
              last_error_at: new Date().toISOString(),
            })
            .eq('appid', appid);

          continue;
        }

        // Update app with storefront data
        const { error: updateError } = await supabase
          .from('apps')
          .update({
            name: details.name,
            type: details.type as 'game' | 'dlc' | 'demo' | 'mod' | 'video' | 'hardware' | 'music',
            is_free: details.isFree,
            release_date: details.releaseDate,
            release_date_raw: details.releaseDateRaw,
            has_workshop: details.hasWorkshop,
            current_price_cents: details.priceCents,
            current_discount_percent: details.discountPercent,
            is_released: !details.comingSoon,
          })
          .eq('appid', appid);

        if (updateError) {
          log.error('Failed to update app', { appid, error: updateError });
          stats.appsFailed++;
          continue;
        }

        // Upsert developers
        let hasDevOrPub = false;
        for (const devName of details.developers) {
          if (devName.trim()) {
            const { data: devId } = await supabase.rpc('upsert_developer', {
              p_name: devName.trim(),
            });

            if (devId) {
              await supabase.from('app_developers').upsert(
                { appid, developer_id: devId },
                { onConflict: 'appid,developer_id' }
              );
              hasDevOrPub = true;
            }
          }
        }

        // Upsert publishers
        for (const pubName of details.publishers) {
          if (pubName.trim()) {
            const { data: pubId } = await supabase.rpc('upsert_publisher', {
              p_name: pubName.trim(),
            });

            if (pubId) {
              await supabase.from('app_publishers').upsert(
                { appid, publisher_id: pubId },
                { onConflict: 'appid,publisher_id' }
              );
              hasDevOrPub = true;
            }
          }
        }

        // Mark app as having developer info if we successfully linked any
        if (hasDevOrPub) {
          await supabase
            .from('apps')
            .update({ has_developer_info: true })
            .eq('appid', appid);
        }

        // Update sync status
        await supabase
          .from('sync_status')
          .update({
            last_storefront_sync: new Date().toISOString(),
            consecutive_errors: 0,
            last_error_source: null,
            last_error_message: null,
            last_error_at: null,
          })
          .eq('appid', appid);

        stats.appsSucceeded++;
        log.debug('Synced app', { appid, name: details.name });
      } catch (error) {
        log.error('Error processing app', { appid, error });
        stats.appsFailed++;

        // Update sync status with error
        await supabase
          .from('sync_status')
          .update({
            last_error_source: 'storefront',
            last_error_message: error instanceof Error ? error.message : String(error),
            last_error_at: new Date().toISOString(),
          })
          .eq('appid', appid);
      }

      // Log progress every 50 apps
      if (stats.appsProcessed % 50 === 0) {
        log.info('Sync progress', { ...stats });
      }
    }

    // Update sync job as completed
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
    log.info('Storefront sync completed', { ...stats, durationMinutes: duration });
  } catch (error) {
    log.error('Storefront sync failed', { error });

    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : String(error),
          items_processed: stats.appsProcessed,
          items_succeeded: stats.appsSucceeded,
          items_failed: stats.appsFailed,
        })
        .eq('id', job.id);
    }

    process.exit(1);
  }
}

main();
