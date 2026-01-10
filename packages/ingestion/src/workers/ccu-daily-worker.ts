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
import {
  fetchSteamCCUBatchWithStatus,
  type CCUResultWithStatus,
} from '../apis/steam-ccu.js';

const log = logger.child({ worker: 'ccu-daily-sync' });

// Default batch size - can be overridden via env
const DEFAULT_BATCH_SIZE = 50000;

// Supabase/PostgREST default max rows per request
const SUPABASE_PAGE_SIZE = 1000;

// Skip duration for invalid appids (30 days)
const SKIP_DURATION_DAYS = 30;

interface SyncStats {
  appsProcessed: number;
  appsSucceeded: number;
  appsFailed: number;
  appsSkipped: number;
  appsInvalid: number;
}

/**
 * Get all Tier 3 games (those not in Tier 1 or 2), excluding skipped apps
 * Uses pagination to work around Supabase's 1000 row limit
 *
 * @returns Object with appids to poll and count of skipped apps
 */
async function getTier3Games(
  supabase: ReturnType<typeof getServiceClient>,
  limit: number
): Promise<{ appids: number[]; skippedCount: number }> {
  const now = new Date().toISOString();

  // Count how many are being skipped (apps with skip_until in the future)
  const { count: skippedCount } = await (supabase as any)
    .from('ccu_tier_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('ccu_tier', 3)
    .gt('ccu_skip_until', now);

  // Paginate through Tier 3 games, excluding skipped apps
  // Cast to any because ccu_tier_assignments may not be in generated types yet
  const allAppids: number[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore && allAppids.length < limit) {
    const { data: pageData, error: pageError } = await (supabase as any)
      .from('ccu_tier_assignments')
      .select('appid')
      .eq('ccu_tier', 3)
      .or(`ccu_skip_until.is.null,ccu_skip_until.lt.${now}`)
      .range(offset, offset + SUPABASE_PAGE_SIZE - 1);

    if (pageError) {
      throw new Error(`Failed to get Tier 3 games: ${pageError.message}`);
    }

    if (!pageData || pageData.length === 0) {
      hasMore = false;
    } else {
      for (const row of pageData as { appid: number }[]) {
        if (allAppids.length < limit) {
          allAppids.push(row.appid);
        }
      }
      offset += SUPABASE_PAGE_SIZE;
      hasMore = pageData.length === SUPABASE_PAGE_SIZE;

      if (offset % 10000 === 0) {
        log.info('Fetching Tier 3 appids...', { fetched: allAppids.length, offset });
      }
    }
  }

  if (allAppids.length > 0) {
    log.info('Using tier assignments for Tier 3 games', {
      count: allAppids.length,
      skipped: skippedCount ?? 0,
      pages: Math.ceil(offset / SUPABASE_PAGE_SIZE),
    });
    return { appids: allAppids, skippedCount: skippedCount ?? 0 };
  }

  // Fallback: get all released games not in Tier 1 or 2 (also paginated)
  log.info('No tier assignments found, falling back to direct query');

  // Get Tier 1 and 2 appids to exclude (paginated)
  const excludeSet = new Set<number>();
  offset = 0;
  hasMore = true;

  while (hasMore) {
    const { data: excludeData } = await (supabase as any)
      .from('ccu_tier_assignments')
      .select('appid')
      .in('ccu_tier', [1, 2])
      .range(offset, offset + SUPABASE_PAGE_SIZE - 1);

    if (!excludeData || excludeData.length === 0) {
      hasMore = false;
    } else {
      for (const row of excludeData as { appid: number }[]) {
        excludeSet.add(row.appid);
      }
      offset += SUPABASE_PAGE_SIZE;
      hasMore = excludeData.length === SUPABASE_PAGE_SIZE;
    }
  }

  // Get all released games (paginated)
  const tier3: number[] = [];
  offset = 0;
  hasMore = true;

  while (hasMore && tier3.length < limit) {
    const { data: gameData, error: gameError } = await supabase
      .from('apps')
      .select('appid')
      .eq('type', 'game')
      .eq('is_released', true)
      .eq('is_delisted', false)
      .range(offset, offset + SUPABASE_PAGE_SIZE - 1);

    if (gameError) {
      throw new Error(`Failed to get games: ${gameError.message}`);
    }

    if (!gameData || gameData.length === 0) {
      hasMore = false;
    } else {
      for (const g of gameData) {
        if (!excludeSet.has(g.appid) && tier3.length < limit) {
          tier3.push(g.appid);
        }
      }
      offset += SUPABASE_PAGE_SIZE;
      hasMore = gameData.length === SUPABASE_PAGE_SIZE;
    }
  }

  log.info('Got Tier 3 games via fallback', { count: tier3.length, excluded: excludeSet.size });
  return { appids: tier3, skippedCount: 0 };
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
  // Cast to any because ccu_snapshots may not be in generated types yet
  const batchSize = 500;
  for (let i = 0; i < snapshots.length; i += batchSize) {
    const batch = snapshots.slice(i, i + batchSize);
    const { error } = await (supabase as any).from('ccu_snapshots').insert(batch);

    if (error) {
      log.warn('Failed to insert Tier 3 snapshots batch', { error, batchStart: i });
      // Don't fail the job for snapshot errors - daily_metrics is the primary store for Tier 3
    }
  }
}

/**
 * Update CCU fetch status tracking in tier assignments
 *
 * - Valid results: clear skip_until, set status to 'valid'
 * - Invalid results (result:42): set skip_until to 30 days from now, set status to 'invalid'
 * - Error results: no changes (transient failures, will retry next run)
 */
async function updateSkipTracking(
  supabase: ReturnType<typeof getServiceClient>,
  results: Map<number, CCUResultWithStatus>
): Promise<{ validUpdated: number; invalidUpdated: number }> {
  const skipUntil = new Date();
  skipUntil.setDate(skipUntil.getDate() + SKIP_DURATION_DAYS);
  const skipUntilStr = skipUntil.toISOString();

  // Separate valid and invalid results (ignore errors - they'll be retried)
  const validAppids: number[] = [];
  const invalidAppids: number[] = [];

  for (const [appid, result] of results) {
    if (result.status === 'valid') {
      validAppids.push(appid);
    } else if (result.status === 'invalid') {
      invalidAppids.push(appid);
    }
    // 'error' status: no update, will be retried next run
  }

  let validUpdated = 0;
  let invalidUpdated = 0;

  // Update valid apps: clear skip_until, set status
  // Cast to any because ccu_tier_assignments may not be in generated types yet
  const validBatchSize = 500;
  for (let i = 0; i < validAppids.length; i += validBatchSize) {
    const batch = validAppids.slice(i, i + validBatchSize);
    const { error } = await (supabase as any)
      .from('ccu_tier_assignments')
      .update({
        ccu_fetch_status: 'valid',
        ccu_skip_until: null,
      })
      .in('appid', batch);

    if (error) {
      log.warn('Failed to update valid status batch', { error, batchStart: i });
    } else {
      validUpdated += batch.length;
    }
  }

  // Update invalid apps: set skip_until, set status
  for (let i = 0; i < invalidAppids.length; i += validBatchSize) {
    const batch = invalidAppids.slice(i, i + validBatchSize);
    const { error } = await (supabase as any)
      .from('ccu_tier_assignments')
      .update({
        ccu_fetch_status: 'invalid',
        ccu_skip_until: skipUntilStr,
      })
      .in('appid', batch);

    if (error) {
      log.warn('Failed to update invalid status batch', { error, batchStart: i });
    } else {
      invalidUpdated += batch.length;
    }
  }

  log.info('Updated skip tracking', {
    validUpdated,
    invalidUpdated,
    skipUntil: skipUntilStr,
  });

  return { validUpdated, invalidUpdated };
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
    appsSkipped: 0,
    appsInvalid: 0,
  };

  try {
    // Get Tier 3 games (excluding skipped invalid apps)
    const { appids, skippedCount } = await getTier3Games(supabase, batchLimit);
    stats.appsSkipped = skippedCount;

    if (appids.length === 0) {
      log.info('No Tier 3 games found for daily sync', { skipped: skippedCount });

      if (job) {
        await supabase
          .from('sync_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            items_processed: 0,
            items_succeeded: 0,
            items_failed: 0,
            metadata: { skipped: skippedCount },
          })
          .eq('id', job.id);
      }
      return;
    }

    log.info('Found Tier 3 games for daily sync', { count: appids.length, skipped: skippedCount });
    stats.appsProcessed = appids.length;

    // Fetch CCU from Steam API with status tracking
    const result = await fetchSteamCCUBatchWithStatus(appids, (processed, total) => {
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

    stats.appsInvalid = result.invalidCount;

    // Extract valid CCU data for metrics/snapshots
    const validCcuData = new Map<number, number>();
    for (const [appid, r] of result.results) {
      if (r.status === 'valid' && r.playerCount !== undefined) {
        validCcuData.set(appid, r.playerCount);
      }
    }

    // Upsert to daily_metrics (only valid results)
    const today = new Date().toISOString().split('T')[0];
    const { succeeded, failed } = await upsertDailyMetrics(supabase, validCcuData, today);

    stats.appsSucceeded = succeeded;
    stats.appsFailed = failed + result.errorCount;

    // Update skip tracking (mark invalid appids to skip for 30 days)
    await updateSkipTracking(supabase, result.results);

    // Insert snapshots for valid Tier 3 games
    await insertTier3Snapshots(supabase, validCcuData);

    // Log some interesting stats
    const ccuValues = Array.from(validCcuData.values());
    if (ccuValues.length > 0) {
      const maxCCU = Math.max(...ccuValues);
      const avgCCU = Math.round(ccuValues.reduce((a, b) => a + b, 0) / ccuValues.length);
      const gamesWithPlayers = ccuValues.filter((c) => c > 0).length;
      const gamesWithZero = ccuValues.filter((c) => c === 0).length;

      log.info('Daily CCU statistics', {
        gamesWithData: validCcuData.size,
        gamesWithPlayers,
        gamesWithZero,
        maxCCU,
        avgCCU,
        invalidAppids: result.invalidCount,
        erroredAppids: result.errorCount,
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
          metadata: {
            skipped: stats.appsSkipped,
            invalid: stats.appsInvalid,
            valid: result.validCount,
            errors: result.errorCount,
          },
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
          metadata: { skipped: stats.appsSkipped, invalid: stats.appsInvalid },
        })
        .eq('id', job.id);
    }

    process.exit(1);
  }
}

main();
