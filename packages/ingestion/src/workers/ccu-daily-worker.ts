/**
 * Daily CCU Sync Worker (Tier 3)
 *
 * Fetches concurrent player counts from Steam's official API for all games
 * that are NOT in Tier 1 or Tier 2 (the "long tail" of games).
 *
 * This runs once daily and covers the ~60k+ games not tracked hourly.
 *
 * Run with: pnpm --filter @publisheriq/ingestion ccu-daily-sync
 */

import { getServiceClient } from '@publisheriq/database';
import { logger } from '@publisheriq/shared';
import { fetchSteamCCUBatch } from '../apis/steam-ccu.js';

const log = logger.child({ worker: 'ccu-daily-sync' });

// Default batch size - can be overridden via env
const DEFAULT_BATCH_SIZE = 50000;

interface SyncStats {
  appsProcessed: number;
  appsSucceeded: number;
  appsFailed: number;
}

/**
 * Get all Tier 3 games (those not in Tier 1 or 2)
 * Falls back to priority-based selection if tier assignments don't exist
 */
async function getTier3Games(
  supabase: ReturnType<typeof getServiceClient>,
  limit: number
): Promise<number[]> {
  // First, try to get Tier 3 from assignments
  const { data: tier3Data, error: tier3Error } = await supabase
    .from('ccu_tier_assignments')
    .select('appid')
    .eq('ccu_tier', 3)
    .limit(limit);

  if (!tier3Error && tier3Data && tier3Data.length > 0) {
    log.info('Using tier assignments for Tier 3 games', { count: tier3Data.length });
    return tier3Data.map((d) => d.appid);
  }

  // Fallback: get all released games not in Tier 1 or 2
  log.info('No tier assignments found, falling back to direct query');

  // Get Tier 1 and 2 appids to exclude
  const { data: excludeData } = await supabase
    .from('ccu_tier_assignments')
    .select('appid')
    .in('ccu_tier', [1, 2]);

  const excludeSet = new Set(excludeData?.map((d) => d.appid) ?? []);

  // Get all released games
  const { data: allGames, error: allError } = await supabase
    .from('apps')
    .select('appid')
    .eq('type', 'game')
    .eq('is_released', true)
    .eq('is_delisted', false)
    .limit(limit);

  if (allError) {
    throw new Error(`Failed to get Tier 3 games: ${allError.message}`);
  }

  // Filter out Tier 1 and 2
  const tier3 = allGames?.filter((g) => !excludeSet.has(g.appid)).map((g) => g.appid) ?? [];

  log.info('Got Tier 3 games via fallback', { count: tier3.length, excluded: excludeSet.size });
  return tier3;
}

/**
 * Upsert CCU data to daily_metrics
 */
async function upsertDailyMetrics(
  supabase: ReturnType<typeof getServiceClient>,
  ccuData: Map<number, number>,
  today: string
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;

  const entries = Array.from(ccuData.entries());
  const batchSize = 100;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const appids = batch.map(([appid]) => appid);

    // Get existing CCU values for today
    const { data: existing } = await supabase
      .from('daily_metrics')
      .select('appid, ccu_peak')
      .in('appid', appids)
      .eq('metric_date', today);

    const existingMap = new Map(existing?.map((e) => [e.appid, e.ccu_peak ?? 0]) ?? []);

    // Filter to only include records where new CCU is higher or doesn't exist
    const toUpsert = batch
      .filter(([appid, newCCU]) => newCCU >= (existingMap.get(appid) ?? 0))
      .map(([appid, ccu]) => ({
        appid,
        metric_date: today,
        ccu_peak: ccu,
        ccu_source: 'steam_api' as const,
      }));

    if (toUpsert.length === 0) {
      succeeded += batch.length;
      continue;
    }

    const { error } = await supabase.from('daily_metrics').upsert(toUpsert, {
      onConflict: 'appid,metric_date',
      ignoreDuplicates: false,
    });

    if (error) {
      log.error('Failed to upsert daily metrics batch', { error, batchStart: i });
      failed += batch.length;
    } else {
      succeeded += batch.length;
    }
  }

  return { succeeded, failed };
}

/**
 * Insert snapshots for Tier 3 games (for consistency)
 */
async function insertTier3Snapshots(
  supabase: ReturnType<typeof getServiceClient>,
  ccuData: Map<number, number>
): Promise<void> {
  const snapshots = Array.from(ccuData.entries()).map(([appid, playerCount]) => ({
    appid,
    player_count: playerCount,
    ccu_tier: 3,
  }));

  if (snapshots.length === 0) return;

  // Insert in batches
  const batchSize = 500;
  for (let i = 0; i < snapshots.length; i += batchSize) {
    const batch = snapshots.slice(i, i + batchSize);
    const { error } = await supabase.from('ccu_snapshots').insert(batch);

    if (error) {
      log.warn('Failed to insert Tier 3 snapshots batch', { error, batchStart: i });
      // Don't fail the job for snapshot errors - daily_metrics is the primary store for Tier 3
    }
  }
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const githubRunId = process.env.GITHUB_RUN_ID;
  const batchLimit = parseInt(process.env.CCU_DAILY_LIMIT || String(DEFAULT_BATCH_SIZE), 10);

  log.info('Starting daily CCU sync (Tier 3)', { githubRunId, batchLimit });

  const supabase = getServiceClient();

  // Create sync job record
  const { data: job } = await supabase
    .from('sync_jobs')
    .insert({
      job_type: 'ccu-daily',
      github_run_id: githubRunId,
      status: 'running',
      batch_size: batchLimit,
    })
    .select()
    .single();

  const stats: SyncStats = {
    appsProcessed: 0,
    appsSucceeded: 0,
    appsFailed: 0,
  };

  try {
    // Get Tier 3 games
    const appids = await getTier3Games(supabase, batchLimit);

    if (appids.length === 0) {
      log.info('No Tier 3 games found for daily sync');

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

    log.info('Found Tier 3 games for daily sync', { count: appids.length });
    stats.appsProcessed = appids.length;

    // Fetch CCU from Steam API
    const result = await fetchSteamCCUBatch(appids, (processed, total) => {
      if (processed % 1000 === 0) {
        const elapsed = (Date.now() - startTime) / 1000 / 60;
        const rate = processed / elapsed;
        const remaining = (total - processed) / rate;
        log.info('Daily CCU fetch progress', {
          processed,
          total,
          elapsedMinutes: elapsed.toFixed(1),
          estimatedRemainingMinutes: remaining.toFixed(1),
        });
      }
    });

    // Upsert to daily_metrics
    const today = new Date().toISOString().split('T')[0];
    const { succeeded, failed } = await upsertDailyMetrics(supabase, result.data, today);

    stats.appsSucceeded = succeeded;
    stats.appsFailed = failed + result.failedCount;

    // Optionally insert snapshots for Tier 3 (for querying consistency)
    await insertTier3Snapshots(supabase, result.data);

    // Log some interesting stats
    const ccuValues = Array.from(result.data.values());
    if (ccuValues.length > 0) {
      const maxCCU = Math.max(...ccuValues);
      const avgCCU = Math.round(ccuValues.reduce((a, b) => a + b, 0) / ccuValues.length);
      const gamesWithPlayers = ccuValues.filter((c) => c > 0).length;
      const gamesWithZero = ccuValues.filter((c) => c === 0).length;

      log.info('Daily CCU statistics', {
        gamesWithData: result.data.size,
        gamesWithPlayers,
        gamesWithZero,
        maxCCU,
        avgCCU,
      });
    }

    // Update sync job
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
    log.info('Daily CCU sync completed', { ...stats, durationMinutes: duration });
  } catch (error) {
    log.error('Daily CCU sync failed', { error });

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
