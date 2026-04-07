import { getServiceClient } from '@publisheriq/database';
import { logger } from '@publisheriq/shared';
import { enqueueCaptureJobs } from '../change-intel/repository.js';

const log = logger.child({ worker: 'requeue-hero-asset-404-dead-letters' });

const DEFAULT_BATCH_SIZE = 500;

interface HeroDeadLetterRow {
  appid: number;
  dead_lettered_at: string;
  last_error: string | null;
  latest_trigger_cursor: string | null;
  latest_trigger_reason: string;
  payload: Record<string, unknown> | null;
  priority: number | null;
}

function parseBooleanEnv(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) {
    return fallback;
  }

  return raw === '1' || raw.toLowerCase() === 'true';
}

function parseAppIds(raw: string | undefined): number[] | null {
  if (!raw) {
    return null;
  }

  const appids = raw
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0);

  return appids.length > 0 ? Array.from(new Set(appids)) : null;
}

async function main(): Promise<void> {
  const dryRun = parseBooleanEnv(process.env.DRY_RUN, true);
  const batchSize = Math.max(1, Number.parseInt(process.env.BATCH_SIZE || `${DEFAULT_BATCH_SIZE}`, 10));
  const explicitAppids = parseAppIds(process.env.APPIDS);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Load the repo root .env before running this script.'
    );
  }
  const supabase = getServiceClient();
  let totalSelected = 0;
  let totalRequeued = 0;

  log.info('Scanning hero dead letters for Steam 404 requeue', {
    batchSize,
    dryRun,
    explicitAppidsCount: explicitAppids?.length ?? 0,
  });

  while (true) {
    let query = (supabase as any)
      .from('app_capture_work_state')
      .select(
        'appid, priority, latest_trigger_reason, latest_trigger_cursor, payload, last_error, dead_lettered_at'
      )
      .eq('source', 'hero_asset')
      .not('dead_lettered_at', 'is', null)
      .ilike('last_error', 'Failed to download % asset: 404')
      .order('dead_lettered_at', { ascending: false })
      .limit(batchSize);

    if (explicitAppids && explicitAppids.length > 0) {
      query = query.in('appid', explicitAppids);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to list hero dead letters: ${error.message}`);
    }

    const rows = (data ?? []) as HeroDeadLetterRow[];
    if (rows.length === 0) {
      break;
    }

    totalSelected += rows.length;

    log.info(dryRun ? 'Would requeue hero dead letters' : 'Requeuing hero dead letters', {
      appids: rows.map((row) => row.appid),
      count: rows.length,
      errors: rows.map((row) => row.last_error),
    });

    if (dryRun) {
      break;
    }

    totalRequeued += await enqueueCaptureJobs(
      supabase,
      rows.map((row) => ({
        appid: row.appid,
        source: 'hero_asset' as const,
        triggerReason: row.latest_trigger_reason,
        triggerCursor: row.latest_trigger_cursor,
        priority: row.priority ?? 100,
        payload: row.payload ?? {},
      }))
    );
  }

  log.info('Finished hero dead-letter requeue scan', {
    dryRun,
    totalRequeued,
    totalSelected,
  });
}

main().catch((error) => {
  log.error('Failed to requeue hero dead letters', {
    error,
  });
  process.exitCode = 1;
});
