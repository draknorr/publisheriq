/**
 * Price Sync Worker
 *
 * Fetches only price data from Steam Storefront API using batch requests.
 * This is much faster than full storefront sync because:
 * 1. Uses filters=price_overview to get minimal data
 * 2. Can request 20-50 appids per API call
 * 3. Uses batch_update_prices RPC for efficient DB updates
 *
 * Run with: pnpm --filter @publisheriq/ingestion price-sync
 */

import { getServiceClient } from '@publisheriq/database';
import { logger, BATCH_SIZES } from '@publisheriq/shared';
import { fetchStorefrontPrices } from '../apis/storefront.js';

const log = logger.child({ worker: 'price-sync' });

// Number of appids to request per API call
// Steam allows up to ~50 but we use 30 for safety
const BATCH_SIZE_PER_REQUEST = 30;

// Total apps to process per worker run
const TOTAL_BATCH_SIZE = parseInt(
  process.env.BATCH_SIZE || String(BATCH_SIZES.STOREFRONT_BATCH),
  10
);

interface SyncStats {
  appsProcessed: number;
  appsUpdated: number;
  appsFailed: number;
  batchesMade: number;
}

type SupabaseClient = ReturnType<typeof getServiceClient>;

/**
 * Fetch apps that need price updates
 * Prioritizes apps that:
 * 1. Have never had price sync
 * 2. Have high priority scores
 * 3. Haven't been updated in 6+ hours
 */
async function getAppsForPriceSync(
  supabase: SupabaseClient,
  limit: number
): Promise<number[]> {
  // Get apps that need price updates
  // Prioritize high-CCU games and those not updated recently
  const { data, error } = await supabase
    .from('sync_status')
    .select('appid, priority_score')
    .eq('is_syncable', true)
    .or('storefront_accessible.is.null,storefront_accessible.eq.true')
    .or('last_price_sync.is.null,last_price_sync.lt.' + new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
    .order('priority_score', { ascending: false })
    .order('last_price_sync', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get apps for price sync: ${error.message}`);
  }

  return (data || []).map((row) => row.appid);
}

/**
 * Process a batch of apps - fetch prices and update database
 */
async function processBatch(
  appids: number[],
  supabase: SupabaseClient,
  stats: SyncStats
): Promise<void> {
  try {
    // Fetch prices from Steam API
    const priceResults = await fetchStorefrontPrices(appids);

    // Prepare arrays for batch update
    const updateAppids: number[] = [];
    const updatePrices: (number | null)[] = [];
    const updateDiscounts: number[] = [];

    for (const [appid, priceInfo] of priceResults) {
      updateAppids.push(appid);
      updatePrices.push(priceInfo.priceCents);
      updateDiscounts.push(priceInfo.discountPercent);
    }

    if (updateAppids.length > 0) {
      // Call batch update RPC
      const { data: updated, error: updateError } = await supabase.rpc('batch_update_prices', {
        p_appids: updateAppids,
        p_prices: updatePrices,
        p_discounts: updateDiscounts,
      });

      if (updateError) {
        log.error('Failed to batch update prices', { error: updateError });
        stats.appsFailed += updateAppids.length;
        return;
      }

      stats.appsUpdated += typeof updated === 'number' ? updated : updateAppids.length;
    }

    stats.appsProcessed += appids.length;
    stats.batchesMade++;

    log.debug('Processed price batch', {
      batchSize: appids.length,
      updated: updateAppids.length,
    });
  } catch (error) {
    log.error('Error processing price batch', { error, appids });
    stats.appsFailed += appids.length;
  }
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const githubRunId = process.env.GITHUB_RUN_ID;

  log.info('Starting Price sync', {
    githubRunId,
    totalBatchSize: TOTAL_BATCH_SIZE,
    batchSizePerRequest: BATCH_SIZE_PER_REQUEST,
  });

  const supabase = getServiceClient();

  // Create sync job record
  const { data: job, error: jobError } = await supabase
    .from('sync_jobs')
    .insert({
      job_type: 'price',
      github_run_id: githubRunId,
      status: 'running',
      batch_size: TOTAL_BATCH_SIZE,
    })
    .select()
    .single();

  if (jobError) {
    log.error('Failed to create sync job record', { error: jobError });
  }

  const stats: SyncStats = {
    appsProcessed: 0,
    appsUpdated: 0,
    appsFailed: 0,
    batchesMade: 0,
  };

  try {
    // Get apps that need price updates
    const appids = await getAppsForPriceSync(supabase, TOTAL_BATCH_SIZE);

    if (appids.length === 0) {
      log.info('No apps due for price sync');

      if (job) {
        await supabase
          .from('sync_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            items_processed: 0,
            items_succeeded: 0,
            items_failed: 0,
          })
          .eq('id', job.id);
      }
      return;
    }

    log.info('Found apps to sync prices', { count: appids.length });

    // Log progress every 10 seconds
    const progressInterval = setInterval(() => {
      log.info('Price sync progress', { ...stats });
    }, 10000);

    try {
      // Process apps in batches of BATCH_SIZE_PER_REQUEST
      for (let i = 0; i < appids.length; i += BATCH_SIZE_PER_REQUEST) {
        const batchAppids = appids.slice(i, i + BATCH_SIZE_PER_REQUEST);
        await processBatch(batchAppids, supabase, stats);
      }
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
          items_succeeded: stats.appsUpdated,
          items_failed: stats.appsFailed,
        })
        .eq('id', job.id);
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    log.info('Price sync completed', {
      ...stats,
      durationMinutes: duration,
      appsPerMinute: (stats.appsProcessed / parseFloat(duration)).toFixed(1),
    });
  } catch (error) {
    log.error('Price sync failed', { error });

    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : String(error),
          items_processed: stats.appsProcessed,
          items_succeeded: stats.appsUpdated,
          items_failed: stats.appsFailed,
        })
        .eq('id', job.id);
    }

    process.exit(1);
  }
}

main();
