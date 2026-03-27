/**
 * Queue projection refresh jobs for apps with recent grouped change activity.
 *
 * Run with:
 *   LOOKBACK_DAYS=180 pnpm --filter @publisheriq/ingestion change-intel-backfill-projection
 */
import { getServiceClient } from '@publisheriq/database';
import { enqueueCaptureJobs, listRecentChangeActivityAppIds } from '../change-intel/repository.js';

const LOOKBACK_DAYS = Math.max(1, parseInt(process.env.LOOKBACK_DAYS || '180', 10));
const PAGE_SIZE = Math.max(1, Math.min(parseInt(process.env.PAGE_SIZE || '1000', 10), 5000));
const MAX_APPS = Math.max(0, parseInt(process.env.MAX_APPS || '5000', 10));
const SAFE_MAX_APPS = 5000;
const DRY_RUN = !['0', 'false', 'FALSE', 'no', 'NO'].includes(process.env.DRY_RUN || 'true');
const ALLOW_LARGE_BACKFILL = ['1', 'true', 'TRUE', 'yes', 'YES'].includes(process.env.ALLOW_LARGE_BACKFILL || '0');
const PROJECTION_REFRESH_CURSOR = 'recent';

async function main(): Promise<void> {
  if (MAX_APPS > SAFE_MAX_APPS && !ALLOW_LARGE_BACKFILL) {
    throw new Error(
      `MAX_APPS=${MAX_APPS} exceeds the default safety cap of ${SAFE_MAX_APPS}. Set ALLOW_LARGE_BACKFILL=1 to proceed intentionally.`
    );
  }

  const supabase = getServiceClient();
  let afterAppid = 0;
  let processedApps = 0;
  let queuedJobs = 0;
  let page = 0;

  console.log(
    `Preparing change-activity projection backfill with LOOKBACK_DAYS=${LOOKBACK_DAYS}, PAGE_SIZE=${PAGE_SIZE}, MAX_APPS=${MAX_APPS || SAFE_MAX_APPS}, DRY_RUN=${DRY_RUN}`
  );

  while (true) {
    const appids = await listRecentChangeActivityAppIds(supabase, LOOKBACK_DAYS, afterAppid, PAGE_SIZE);
    if (appids.length === 0) {
      break;
    }

    const remaining = MAX_APPS > 0 ? Math.max(MAX_APPS - processedApps, 0) : appids.length;
    const batch = MAX_APPS > 0 ? appids.slice(0, remaining) : appids;
    if (batch.length === 0) {
      break;
    }

    const jobs = batch.map((appid) => ({
      appid,
      source: 'projection_refresh' as const,
      triggerReason: 'projection_backfill',
      triggerCursor: PROJECTION_REFRESH_CURSOR,
      priority: 70,
    }));
    const inserted = DRY_RUN ? jobs.length : await enqueueCaptureJobs(supabase, jobs);

    page += 1;
    processedApps += batch.length;
    queuedJobs += inserted;
    afterAppid = batch[batch.length - 1] ?? afterAppid;

    console.log(
      `Page ${page}: scanned ${batch.length} apps, ${DRY_RUN ? 'would enqueue' : 'coalesced'} ${inserted} projection_refresh jobs, last appid ${afterAppid}`
    );

    if (MAX_APPS > 0 && processedApps >= MAX_APPS) {
      break;
    }
  }

  console.log(
    `${DRY_RUN ? 'Projection backfill dry run complete.' : 'Projection backfill queueing complete.'} Consider running the change-intel worker with QUEUE_SOURCES=projection_refresh to drain the backlog. Processed ${processedApps} apps and ${DRY_RUN ? 'would enqueue' : 'coalesced'} ${queuedJobs} jobs.`
  );
}

main().catch((error) => {
  console.error('Projection backfill failed:', error);
  process.exitCode = 1;
});
