import type { PostgrestError } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase-service';
import type {
  ChangeActivityDetail,
  ChangeActivityRow,
  ChangeBurstDetail,
  ChangeFeedActivityResponse,
  ChangeFeedBurstsResponse,
  ChangeFeedNewsResponse,
  ChangeNewsRow,
  RawChangeActivityRow,
  RawChangeBurstDetailRow,
  RawChangeBurstRow,
  RawChangeNewsRow,
} from './change-feed-types';
import {
  buildAnnouncementActivityDetail,
  buildAnnouncementActivityRow,
  buildChangeActivityDetail,
  buildChangeActivityRow,
  filterActivitiesBySignalFamilies,
  filterActivitiesForView,
  parseActivityId,
  sortActivities,
} from './change-feed-presenters';
import type {
  ChangeFeedActivityParams,
  ChangeFeedBurstParams,
  ChangeFeedNewsParams,
} from './change-feed-query';
import {
  buildNextCursor,
  decodeActivityCursor,
  decodeActivityScoreCursor,
  encodeActivityCursor,
  encodeActivityScoreCursor,
  isMissingChangeFeedRpcError,
  mapChangeActivityRow,
  mapChangeBurstDetail,
  mapChangeBurstRow,
  mapChangeNewsRow,
  toSqlChangeFeedPreset,
} from './change-feed-query';

const DEFAULT_CACHE_TTL_MS = 60 * 1000;

let defaultBurstsCache:
  | {
      data: ChangeFeedBurstsResponse;
      cachedAt: number;
    }
  | null = null;

let defaultNewsCache:
  | {
      data: ChangeFeedNewsResponse;
      cachedAt: number;
    }
  | null = null;

let defaultActivityCache:
  | {
      data: ChangeFeedActivityResponse;
      cachedAt: number;
    }
  | null = null;

export class ChangeFeedUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChangeFeedUnavailableError';
  }
}

export class ChangeFeedQueryError extends Error {
  constructor(message: string, readonly cause?: PostgrestError) {
    super(message);
    this.name = 'ChangeFeedQueryError';
  }
}

function isDefaultBurstsRequest(params: ChangeFeedBurstParams): boolean {
  return (
    params.days === 7 &&
    params.preset === 'high-signal' &&
    params.appTypes === null &&
    params.search === null &&
    params.sourceFilter === null &&
    params.cursorTime === null &&
    params.cursorKey === null &&
    params.limit === 50
  );
}

function isDefaultNewsRequest(params: ChangeFeedNewsParams): boolean {
  return (
    params.days === 7 &&
    params.appTypes === null &&
    params.search === null &&
    params.cursorTime === null &&
    params.cursorKey === null &&
    params.limit === 50
  );
}

function isDefaultActivityRequest(params: ChangeFeedActivityParams): boolean {
  return (
    params.days === 7 &&
    params.view === 'overview' &&
    params.mode === 'all' &&
    params.sort === 'relevant' &&
    params.appTypes === null &&
    params.signalFamilies === null &&
    params.search === null &&
    params.cursor === null &&
    params.limit === 50
  );
}

async function executeChangeFeedRpc<T>(
  functionName: string,
  args: Record<string, unknown>
): Promise<T> {
  const supabase = getServiceSupabase();

  // Generated DB types lag migrations for these RPC surfaces.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(functionName, args);

  if (error) {
    if (isMissingChangeFeedRpcError(error, functionName)) {
      throw new ChangeFeedUnavailableError(
        `Change Feed query surface "${functionName}" is not available yet. Apply the pending migration first.`
      );
    }

    throw new ChangeFeedQueryError(error.message, error);
  }

  return data as T;
}

export async function fetchChangeFeedBurstsResponse(
  params: ChangeFeedBurstParams
): Promise<ChangeFeedBurstsResponse> {
  const isDefaultRequest = isDefaultBurstsRequest(params);

  if (
    isDefaultRequest &&
    defaultBurstsCache &&
    Date.now() - defaultBurstsCache.cachedAt < DEFAULT_CACHE_TTL_MS
  ) {
    return defaultBurstsCache.data;
  }

  const data = await executeChangeFeedRpc<RawChangeBurstRow[]>('get_change_feed_bursts', {
    p_days: params.days,
    p_preset: toSqlChangeFeedPreset(params.preset),
    p_app_types: params.appTypes,
    p_search: params.search,
    p_source_filter: params.sourceFilter,
    p_cursor_time: params.cursorTime,
    p_cursor_burst_id: params.cursorKey,
    p_limit: params.limit,
  });

  const items = (data ?? []).map(mapChangeBurstRow);
  const response: ChangeFeedBurstsResponse = {
    items,
    nextCursor: buildNextCursor(items, params.limit),
    meta: {
      days: params.days,
      preset: params.preset,
      limit: params.limit,
      appTypes: params.appTypes,
      sourceFilter: params.sourceFilter,
      search: params.search,
    },
  };

  if (isDefaultRequest) {
    defaultBurstsCache = {
      data: response,
      cachedAt: Date.now(),
    };
  }

  return response;
}

export async function fetchChangeFeedNewsResponse(
  params: ChangeFeedNewsParams
): Promise<ChangeFeedNewsResponse> {
  const isDefaultRequest = isDefaultNewsRequest(params);

  if (
    isDefaultRequest &&
    defaultNewsCache &&
    Date.now() - defaultNewsCache.cachedAt < DEFAULT_CACHE_TTL_MS
  ) {
    return defaultNewsCache.data;
  }

  const data = await executeChangeFeedRpc<RawChangeNewsRow[]>('get_change_feed_news', {
    p_days: params.days,
    p_app_types: params.appTypes,
    p_search: params.search,
    p_cursor_time: params.cursorTime,
    p_cursor_gid: params.cursorKey,
    p_limit: params.limit,
  });

  const items = (data ?? []).map(mapChangeNewsRow);
  const response: ChangeFeedNewsResponse = {
    items,
    nextCursor: buildNextCursor(items, params.limit),
    meta: {
      days: params.days,
      limit: params.limit,
      appTypes: params.appTypes,
      search: params.search,
    },
  };

  if (isDefaultRequest) {
    defaultNewsCache = {
      data: response,
      cachedAt: Date.now(),
    };
  }

  return response;
}

function getLegacyPresetForView(view: ChangeFeedActivityParams['view']): ChangeFeedBurstParams['preset'] {
  switch (view) {
    case 'launch-watch':
      return 'upcoming-radar';
    case 'all-activity':
      return 'all-changes';
    default:
      return 'high-signal';
  }
}

async function fetchLegacyChangeFeedActivityResponse(
  params: ChangeFeedActivityParams
): Promise<ChangeFeedActivityResponse> {
  const { offset } = decodeActivityCursor(params.cursor);
  const internalLimit = Math.min(Math.max(offset + params.limit + 25, 75), 100);

  const [burstsResponse, newsResponse] = await Promise.all([
    params.mode === 'announcements'
      ? Promise.resolve<ChangeFeedBurstsResponse | null>(null)
      : fetchChangeFeedBurstsResponse({
          days: params.days,
          preset: getLegacyPresetForView(params.view),
          appTypes: params.appTypes,
          search: params.search,
          sourceFilter: null,
          cursorTime: null,
          cursorKey: null,
          limit: internalLimit,
        }),
    params.mode === 'changes'
      ? Promise.resolve<ChangeFeedNewsResponse | null>(null)
      : fetchChangeFeedNewsResponse({
          days: params.days,
          appTypes: params.appTypes,
          search: params.search,
          cursorTime: null,
          cursorKey: null,
          limit: internalLimit,
        }),
  ]);

  let items: ChangeActivityRow[] = [
    ...(burstsResponse?.items ?? []).map(buildChangeActivityRow),
    ...(newsResponse?.items ?? []).map(buildAnnouncementActivityRow),
  ];

  items = filterActivitiesForView(items, params.view);
  items = filterActivitiesBySignalFamilies(items, params.signalFamilies);
  items = sortActivities(
    items,
    params.view === 'all-activity' && params.sort === 'relevant' ? 'newest' : params.sort
  );

  const pageItems = items.slice(offset, offset + params.limit);
  const nextCursor =
    items.length > offset + params.limit ? encodeActivityCursor({ offset: offset + params.limit }) : null;

  return {
    items: pageItems,
    nextCursor,
    meta: {
      days: params.days,
      view: params.view,
      mode: params.mode,
      sort: params.view === 'all-activity' && params.sort === 'relevant' ? 'newest' : params.sort,
      limit: params.limit,
      appTypes: params.appTypes,
      signalFamilies: params.signalFamilies,
      search: params.search,
    },
  };
}

type ActivityRpcRow = RawChangeActivityRow & { sort_score: number | null };

export async function fetchChangeFeedActivityResponse(
  params: ChangeFeedActivityParams
): Promise<ChangeFeedActivityResponse> {
  const isDefaultRequest = isDefaultActivityRequest(params);

  if (
    isDefaultRequest &&
    defaultActivityCache &&
    Date.now() - defaultActivityCache.cachedAt < DEFAULT_CACHE_TTL_MS
  ) {
    return defaultActivityCache.data;
  }

  const rpcCursor = decodeActivityScoreCursor(params.cursor);

  try {
    const data = await executeChangeFeedRpc<ActivityRpcRow[]>('get_change_feed_activity', {
      p_days: params.days,
      p_view: params.view,
      p_mode: params.mode,
      p_app_types: params.appTypes,
      p_search: params.search,
      p_signal_families: params.signalFamilies,
      p_sort: params.view === 'all-activity' && params.sort === 'relevant' ? 'newest' : params.sort,
      p_cursor_score: rpcCursor?.score ?? null,
      p_cursor_time: rpcCursor?.time ?? null,
      p_cursor_activity_id: rpcCursor?.id ?? null,
      p_limit: params.limit,
    });

    const items = (data ?? []).map(mapChangeActivityRow);
    const lastRow = data?.[data.length - 1] ?? null;

    const response: ChangeFeedActivityResponse = {
      items,
      nextCursor:
        data && data.length >= params.limit && lastRow
          ? encodeActivityScoreCursor({
              score: lastRow.sort_score ?? 0,
              time: lastRow.occurred_at,
              id: lastRow.activity_id,
            })
          : null,
      meta: {
        days: params.days,
        view: params.view,
        mode: params.mode,
        sort: params.view === 'all-activity' && params.sort === 'relevant' ? 'newest' : params.sort,
        limit: params.limit,
        appTypes: params.appTypes,
        signalFamilies: params.signalFamilies,
        search: params.search,
      },
    };

    if (isDefaultRequest) {
      defaultActivityCache = {
        data: response,
        cachedAt: Date.now(),
      };
    }

    return response;
  } catch (error) {
    if (error instanceof ChangeFeedUnavailableError) {
      const fallback = await fetchLegacyChangeFeedActivityResponse(params);

      if (isDefaultRequest) {
        defaultActivityCache = {
          data: fallback,
          cachedAt: Date.now(),
        };
      }

      return fallback;
    }

    throw error;
  }
}

function toNewsExcerpt(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const stripped = value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return stripped.length > 260 ? `${stripped.slice(0, 259).trimEnd()}…` : stripped;
}

async function fetchChangeFeedAnnouncementDetail(gid: string): Promise<{
  row: ChangeNewsRow;
  body: string | null;
  excerpt: string | null;
} | null> {
  const supabase = getServiceSupabase();
  // Generated DB types lag migrations for these history surfaces.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [{ data: newsItem, error: newsError }, { data: latestVersion, error: versionError }] =
    await Promise.all([
      db
        .from('steam_news_items')
        .select('gid, appid, url, feedlabel, feedname, published_at, first_seen_at')
        .eq('gid', gid)
        .maybeSingle(),
      db
        .from('steam_news_versions')
        .select('title, contents, url')
        .eq('gid', gid)
        .order('first_seen_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (newsError) {
    throw new ChangeFeedQueryError(newsError.message, newsError);
  }

  if (versionError) {
    throw new ChangeFeedQueryError(versionError.message, versionError);
  }

  if (!newsItem) {
    return null;
  }

  const { data: app, error: appError } = await db
    .from('apps')
    .select('appid, name, type')
    .eq('appid', newsItem.appid)
    .maybeSingle();

  if (appError) {
    throw new ChangeFeedQueryError(appError.message, appError);
  }

  if (!app) {
    return null;
  }

  return {
    row: {
      gid: newsItem.gid,
      appid: newsItem.appid,
      appName: app.name,
      appType: app.type,
      publishedAt: newsItem.published_at,
      firstSeenAt: newsItem.first_seen_at,
      title: latestVersion?.title ?? null,
      feedLabel: newsItem.feedlabel ?? null,
      feedName: newsItem.feedname ?? null,
      url: latestVersion?.url ?? newsItem.url ?? null,
    },
    body: latestVersion?.contents ?? null,
    excerpt: toNewsExcerpt(latestVersion?.contents ?? null),
  };
}

export async function fetchChangeFeedBurstDetail(
  burstId: string
): Promise<ChangeBurstDetail | null> {
  const data = await executeChangeFeedRpc<RawChangeBurstDetailRow[] | RawChangeBurstDetailRow | null>(
    'get_change_feed_burst_detail',
    {
      p_burst_id: burstId,
    }
  );

  const rawDetail = Array.isArray(data) ? (data[0] ?? null) : data;
  return rawDetail ? mapChangeBurstDetail(rawDetail) : null;
}

export async function fetchChangeFeedActivityDetail(
  activityId: string
): Promise<ChangeActivityDetail | null> {
  const parsed = parseActivityId(activityId);

  if (!parsed) {
    return null;
  }

  if (parsed.kind === 'change') {
    const detail = await fetchChangeFeedBurstDetail(parsed.value);
    return detail ? buildChangeActivityDetail(detail) : null;
  }

  const announcementDetail = await fetchChangeFeedAnnouncementDetail(parsed.value);
  return announcementDetail ? buildAnnouncementActivityDetail(announcementDetail) : null;
}
