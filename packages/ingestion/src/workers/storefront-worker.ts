/**
 * Storefront Details Sync Worker
 *
 * Fetches app details from Steam Storefront API for apps due for sync.
 * Prioritizes apps by priority_score.
 *
 * Run with: pnpm --filter @publisheriq/ingestion storefront-sync
 */

import { getServiceClient } from '@publisheriq/database';
import { logger, BATCH_SIZES, APP_TYPES, AppType } from '@publisheriq/shared';
import pLimit from 'p-limit';
import { fetchStorefrontAppDetails } from '../apis/storefront.js';

// Set of valid app types for quick lookup
const VALID_APP_TYPES = new Set<string>(APP_TYPES);

/**
 * Normalize app type from Steam API to a valid database enum value.
 * Falls back to 'game' for unknown types to prevent database errors.
 */
function normalizeAppType(type: string | undefined): AppType {
  if (!type) return 'game';
  const lower = type.toLowerCase();
  return VALID_APP_TYPES.has(lower) ? (lower as AppType) : 'game';
}

const log = logger.child({ worker: 'storefront-sync' });

// Process this many apps concurrently
// Rate limiter handles API throttling, this controls DB operation parallelism
const CONCURRENCY = 8;

interface SyncStats {
  appsProcessed: number;
  appsCreated: number;  // First-time enrichment
  appsUpdated: number;  // Refresh of existing data
  appsSkipped: number;  // Steam returned no data (private/removed/age-gated)
  appsFailed: number;   // Actual API errors
}

type SupabaseClient = ReturnType<typeof getServiceClient>;

/**
 * Process a single app - fetch details and update database
 */
async function processApp(
  appid: number,
  supabase: SupabaseClient,
  neverSyncedSet: Set<number>,
  stats: SyncStats
): Promise<void> {
  // Increment processed count synchronously (before any await) to avoid race conditions
  stats.appsProcessed++;

  try {
    const result = await fetchStorefrontAppDetails(appid);

    // Steam returned no data - app is private, removed, or age-gated
    // Mark as inaccessible so we don't retry every day
    if (result.status === 'no_data') {
      log.debug('No storefront data for app (private/removed)', { appid });
      stats.appsSkipped++;

      await supabase
        .from('sync_status')
        .update({
          storefront_accessible: false,
          last_storefront_sync: new Date().toISOString(),
        })
        .eq('appid', appid);

      return;
    }

    // Actual API error - keep as retryable
    if (result.status === 'error') {
      log.error('API error fetching storefront data', { appid, error: result.error });
      stats.appsFailed++;

      await supabase
        .from('sync_status')
        .update({
          last_error_source: 'storefront',
          last_error_message: result.error,
          last_error_at: new Date().toISOString(),
        })
        .eq('appid', appid);

      return;
    }

    // Success - we have data
    const details = result.data;

    // Single optimized RPC call that handles:
    // - App update
    // - Developer upserts + junction records
    // - Publisher upserts + junction records
    // - Sync status update
    // Reduces 7-11 DB round trips to 1
    const { error: upsertError } = await supabase.rpc('upsert_storefront_app', {
      p_appid: appid,
      p_name: details.name,
      p_type: normalizeAppType(details.type),
      p_is_free: details.isFree,
      p_release_date: details.releaseDate,
      p_release_date_raw: details.releaseDateRaw,
      p_has_workshop: details.hasWorkshop,
      p_current_price_cents: details.priceCents,
      p_current_discount_percent: details.discountPercent,
      p_is_released: !details.comingSoon,
      p_developers: details.developers,
      p_publishers: details.publishers,
      p_dlc_appids: details.dlcAppids.length > 0 ? details.dlcAppids : null,
    });

    if (upsertError) {
      log.error('Failed to upsert app', { appid, error: upsertError });
      stats.appsFailed++;
      return;
    }

    // Track as first-time enrichment or refresh (synchronous to avoid race)
    if (neverSyncedSet.has(appid)) {
      stats.appsCreated++;
    } else {
      stats.appsUpdated++;
    }
    log.debug('Synced app', { appid, name: details.name, firstTime: neverSyncedSet.has(appid) });
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
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const githubRunId = process.env.GITHUB_RUN_ID;
  const batchSize = parseInt(process.env.BATCH_SIZE || String(BATCH_SIZES.STOREFRONT_BATCH), 10);

  // Partitioning support for parallel initial sync
  const partitionCount = parseInt(process.env.PARTITION_COUNT || '1', 10);
  const partitionId = parseInt(process.env.PARTITION_ID || '0', 10);
  const isPartitioned = partitionCount > 1;

  log.info('Starting Storefront sync', {
    githubRunId,
    batchSize,
    ...(isPartitioned && { partitionCount, partitionId }),
  });

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
    appsCreated: 0,
    appsUpdated: 0,
    appsSkipped: 0,
    appsFailed: 0,
  };

  try {
    // Get apps due for sync using the database function
    // Use partitioned function for parallel initial sync, regular function otherwise
    const { data: appsToSync, error: fetchError } = isPartitioned
      ? await supabase.rpc('get_apps_for_sync_partitioned', {
          p_source: 'storefront',
          p_limit: batchSize,
          p_partition_count: partitionCount,
          p_partition_id: partitionId,
        })
      : await supabase.rpc('get_apps_for_sync', {
          p_source: 'storefront',
          p_limit: batchSize,
        });

    if (fetchError) {
      throw new Error(`Failed to get apps for sync: ${fetchError.message}`);
    }

    if (!appsToSync || appsToSync.length === 0) {
      log.info('No apps due for storefront sync');

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

    // Fetch sync status to determine which are first-time vs refresh
    const appIds = appsToSync.map((a: { appid: number }) => a.appid);
    const { data: syncStatuses } = await supabase
      .from('sync_status')
      .select('appid, last_storefront_sync')
      .in('appid', appIds);

    // Build set of apps that have never been synced (first-time enrichment)
    const neverSyncedSet = new Set(
      (syncStatuses || [])
        .filter((s) => s.last_storefront_sync === null)
        .map((s) => s.appid)
    );

    log.info('First-time vs refresh breakdown', {
      firstTime: neverSyncedSet.size,
      refresh: appsToSync.length - neverSyncedSet.size,
    });

    // Process apps with controlled concurrency
    // Rate limiter handles API throttling, p-limit controls parallelism
    const limit = pLimit(CONCURRENCY);

    // Log progress every 10 seconds
    const progressInterval = setInterval(() => {
      log.info('Sync progress', { ...stats });
    }, 10000);

    try {
      await Promise.all(
        appsToSync.map(({ appid }: { appid: number }) =>
          limit(() => processApp(appid, supabase, neverSyncedSet, stats))
        )
      );
    } finally {
      clearInterval(progressInterval);
    }

    // Update sync job as completed
    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          items_processed: stats.appsProcessed,
          items_succeeded: stats.appsCreated + stats.appsUpdated,
          items_skipped: stats.appsSkipped,
          items_failed: stats.appsFailed,
          items_created: stats.appsCreated,
          items_updated: stats.appsUpdated,
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
          items_succeeded: stats.appsCreated + stats.appsUpdated,
          items_skipped: stats.appsSkipped,
          items_failed: stats.appsFailed,
          items_created: stats.appsCreated,
          items_updated: stats.appsUpdated,
        })
        .eq('id', job.id);
    }

    process.exit(1);
  }
}

main();
