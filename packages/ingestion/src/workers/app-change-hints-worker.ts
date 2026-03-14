/**
 * Steam App Change Hints Worker
 *
 * Fetches `last_modified` and `price_change_number` hints from
 * IStoreService/GetAppList and enqueues storefront recaptures when they change.
 *
 * Run with: pnpm --filter @publisheriq/ingestion app-change-hints
 */

import { getServiceClient } from '@publisheriq/database';
import { logger } from '@publisheriq/shared';
import { fetchSteamAppChangeHints } from '../apis/steam-web.js';
import { partitionHintRows, type ExistingHintStatusRow, type HintRow } from '../change-intel/hints.js';
import { enqueueCaptureJobs } from '../change-intel/repository.js';
import { buildHintCursor } from '../workers-support/change-intel.js';

const log = logger.child({ worker: 'app-change-hints' });

type SupabaseClient = ReturnType<typeof getServiceClient>;

async function processHintBatch(
  supabase: SupabaseClient,
  batch: HintRow[]
): Promise<{ changed: number; enqueued: number; skipped: number }> {
  const appids = batch.map((row) => row.appid);
  const db = supabase as any;
  const { data: knownApps, error: knownAppsError } = await db
    .from('apps')
    .select('appid')
    .in('appid', appids);

  if (knownAppsError) {
    throw new Error(`Failed to fetch known app rows: ${knownAppsError.message}`);
  }

  const knownAppids = new Set<number>((knownApps ?? []).map((row: { appid: number }) => row.appid));
  if (knownAppids.size === 0) {
    return {
      changed: 0,
      enqueued: 0,
      skipped: batch.length,
    };
  }

  const knownRows = batch.filter((row) => knownAppids.has(row.appid));
  const { data: existingRows, error: existingError } = await db
    .from('sync_status')
    .select('appid, steam_last_modified, steam_price_change_number')
    .in('appid', knownRows.map((row) => row.appid));

  if (existingError) {
    throw new Error(`Failed to fetch existing hint rows: ${existingError.message}`);
  }

  const existingByAppid = new Map<number, ExistingHintStatusRow>(
    (existingRows ?? []).map((row: ExistingHintStatusRow) => [row.appid, row])
  );

  const partitioned = partitionHintRows(batch, knownAppids, existingByAppid);

  const { error: updateError } = await db.from('sync_status').upsert(
    partitioned.knownRows.map((row) => ({
      appid: row.appid,
      steam_last_modified: row.lastModified,
      steam_price_change_number: row.priceChangeNumber,
    })),
    { onConflict: 'appid' }
  );

  if (updateError) {
    throw new Error(`Failed to upsert hint rows: ${updateError.message}`);
  }

  const enqueued = await enqueueCaptureJobs(
    supabase,
    partitioned.changedRows.map((row) => ({
      appid: row.appid,
      source: 'storefront',
      triggerReason: 'steam_app_change_hint',
      triggerCursor: buildHintCursor(row.lastModified, row.priceChangeNumber),
      priority: 100,
    }))
  );

  return {
    changed: partitioned.changedRows.length,
    enqueued,
    skipped: partitioned.skippedRows.length,
  };
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const githubRunId = process.env.GITHUB_RUN_ID;
  const batchSize = parseInt(process.env.HINT_BATCH_SIZE || '1000', 10);
  const supabase = getServiceClient();

  const { data: job } = await supabase
    .from('sync_jobs')
    .insert({
      job_type: 'change_hints',
      github_run_id: githubRunId,
      status: 'running',
      batch_size: batchSize,
    })
    .select()
    .single();

  try {
    const hints = await fetchSteamAppChangeHints();
    let changed = 0;
    let enqueued = 0;
    let skipped = 0;

    for (let index = 0; index < hints.length; index += batchSize) {
      const batch = hints.slice(index, index + batchSize);
      const result = await processHintBatch(
        supabase,
        batch.map((row) => ({
          appid: row.appid,
          lastModified: row.lastModified,
          priceChangeNumber: row.priceChangeNumber,
        }))
      );
      changed += result.changed;
      enqueued += result.enqueued;
      skipped += result.skipped;
    }

    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          items_processed: hints.length,
          items_succeeded: changed,
          items_created: enqueued,
          items_skipped: skipped,
        })
        .eq('id', job.id);
    }

    log.info('App change hints completed', {
      totalHints: hints.length,
      changed,
      enqueued,
      skippedUnknownApps: skipped,
      durationSeconds: ((Date.now() - startTime) / 1000).toFixed(1),
    });
  } catch (error) {
    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : String(error),
          items_skipped: 0,
        })
        .eq('id', job.id);
    }

    throw error;
  }
}

main().catch((error) => {
  log.error('App change hints failed', { error });
  process.exit(1);
});
