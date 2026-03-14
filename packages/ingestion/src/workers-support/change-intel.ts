import type { TypedSupabaseClient } from '@publisheriq/database';
import { logger } from '@publisheriq/shared';
import { fetchAppNews, type NewsItem } from '../apis/steam-web.js';
import type { ParsedStorefrontApp } from '../apis/storefront.js';
import { HeroAssetArchiver } from '../change-intel/hero-archive.js';
import { diffNewsVersions, normalizeNewsVersion } from '../change-intel/news.js';
import {
  completeCaptureQueueItems,
  enqueueCaptureJobs,
  getLatestMediaVersion,
  getLatestNewsVersion,
  getLatestStorefrontSnapshot,
  insertChangeEvents,
  updateSyncStatusFields,
  upsertNewsItem,
  writeMediaVersion,
  writeNewsVersion,
  writeStorefrontSnapshot,
} from '../change-intel/repository.js';
import {
  collectChangedHeroAssets,
  diffStorefrontMedia,
  diffStorefrontSnapshots,
  normalizeStorefrontMediaVersion,
  normalizeStorefrontSnapshot,
} from '../change-intel/storefront.js';

const log = logger.child({ component: 'change-intel-support' });

export function buildHintCursor(lastModified: number, priceChangeNumber: number): string {
  return `${lastModified}:${priceChangeNumber}`;
}

export async function captureStorefrontState(
  supabase: TypedSupabaseClient,
  appid: number,
  details: ParsedStorefrontApp,
  trigger: {
    triggerReason: string;
    triggerCursor: string | null;
  }
): Promise<{ snapshotChanged: boolean; mediaChanged: boolean }> {
  const observedAt = new Date().toISOString();
  const previousSnapshot = await getLatestStorefrontSnapshot(supabase, appid);
  const previousMedia = await getLatestMediaVersion(supabase, appid);

  const normalizedSnapshot = normalizeStorefrontSnapshot(details);
  const snapshotVersion = await writeStorefrontSnapshot(
    supabase,
    appid,
    normalizedSnapshot,
    trigger.triggerReason,
    trigger.triggerCursor,
    observedAt
  );

  const normalizedMedia = normalizeStorefrontMediaVersion(normalizedSnapshot);
  const mediaVersion = await writeMediaVersion(
    supabase,
    appid,
    snapshotVersion.currentId,
    normalizedMedia,
    observedAt
  );

  const changeEvents = [
    ...diffStorefrontSnapshots(previousSnapshot, normalizedSnapshot),
    ...diffStorefrontMedia(previousMedia, normalizedMedia),
  ];

  await insertChangeEvents(supabase, appid, changeEvents, {
    sourceSnapshotId: snapshotVersion.currentId,
    relatedSnapshotId: snapshotVersion.previousId,
    mediaVersionId: mediaVersion.currentId,
    triggerCursor: trigger.triggerCursor,
  });

  await updateSyncStatusFields(supabase, appid, {
    last_storefront_sync: observedAt,
    last_media_sync: observedAt,
    storefront_accessible: true,
    last_error_source: null,
    last_error_message: null,
    last_error_at: null,
  });

  const changedHeroAssets = collectChangedHeroAssets(previousMedia, normalizedMedia);
  if (changedHeroAssets.length > 0) {
    await enqueueCaptureJobs(supabase, [
      {
        appid,
        source: 'hero_asset',
        triggerReason: 'storefront_media_change',
        triggerCursor: trigger.triggerCursor,
        priority: 50,
      },
    ]);
  }

  if (snapshotVersion.inserted) {
    await enqueueCaptureJobs(supabase, [
      {
        appid,
        source: 'news',
        triggerReason: 'storefront_snapshot_change',
        triggerCursor: trigger.triggerCursor,
        priority: 75,
      },
    ]);
  }

  return {
    snapshotChanged: snapshotVersion.inserted,
    mediaChanged: mediaVersion.inserted,
  };
}

async function fetchReachableNewsHistory(appid: number, maxPages: number): Promise<NewsItem[]> {
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  let endDateUnix: number | undefined;

  for (let page = 0; page < maxPages; page++) {
    const batch = await fetchAppNews(appid, {
      count: 100,
      endDateUnix,
      maxLength: 5000,
    });

    if (batch.length === 0) {
      break;
    }

    for (const item of batch) {
      if (!seen.has(item.gid)) {
        seen.add(item.gid);
        items.push(item);
      }
    }

    const oldestTimestamp = Math.min(...batch.map((item) => item.date));
    if (batch.length < 100 || !Number.isFinite(oldestTimestamp) || oldestTimestamp <= 1) {
      break;
    }

    endDateUnix = oldestTimestamp - 1;
  }

  return items;
}

export async function captureNewsForApp(
  supabase: TypedSupabaseClient,
  appid: number,
  triggerCursor: string | null
): Promise<number> {
  const observedAt = new Date().toISOString();
  const maxPages = parseInt(process.env.STEAM_NEWS_MAX_PAGES || '5', 10);
  const newsItems = await fetchReachableNewsHistory(appid, maxPages);

  for (const item of newsItems) {
    const normalized = normalizeNewsVersion(item);
    const previousVersion = await getLatestNewsVersion(supabase, item.gid);

    await upsertNewsItem(supabase, appid, normalized);
    const version = await writeNewsVersion(supabase, normalized, observedAt);
    const events = diffNewsVersions(previousVersion, normalized);

    await insertChangeEvents(supabase, appid, events, {
      newsItemGid: item.gid,
      triggerCursor,
    });

    if (!version.inserted) {
      continue;
    }
  }

  await updateSyncStatusFields(supabase, appid, { last_news_sync: observedAt });
  return newsItems.length;
}

export async function archiveHeroAssetsForApp(
  supabase: TypedSupabaseClient,
  appid: number
): Promise<void> {
  const archiver = new HeroAssetArchiver(supabase);
  await archiver.archiveLatestAssetsForApp(appid);
}

export async function seedStaleNewsCatchup(
  supabase: TypedSupabaseClient,
  limit: number
): Promise<number> {
  const staleBefore = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await (supabase as any)
    .from('sync_status')
    .select('appid')
    .or(`last_news_sync.is.null,last_news_sync.lt.${staleBefore}`)
    .order('last_news_sync', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to seed stale news catch-up: ${error.message}`);
  }

  return enqueueCaptureJobs(
    supabase,
    (data ?? []).map((row: { appid: number }) => ({
      appid: row.appid,
      source: 'news' as const,
      triggerReason: 'stale_news_catchup',
      triggerCursor: null,
      priority: 25,
    }))
  );
}

export async function requeueFailedJobs(
  supabase: TypedSupabaseClient,
  jobIds: string[],
  errorMessage: string
): Promise<void> {
  log.warn('Re-queueing failed capture jobs', { jobIds, errorMessage });
  await completeCaptureQueueItems(supabase, jobIds, 'queued', errorMessage);
}
