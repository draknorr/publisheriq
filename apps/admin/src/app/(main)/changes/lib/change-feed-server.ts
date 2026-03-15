import type { PostgrestError } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase-service';
import type {
  ChangeBurstDetail,
  ChangeFeedBurstsResponse,
  ChangeFeedNewsResponse,
  RawChangeBurstDetailRow,
  RawChangeBurstRow,
  RawChangeNewsRow,
} from './change-feed-types';
import type { ChangeFeedBurstParams, ChangeFeedNewsParams } from './change-feed-query';
import {
  buildNextCursor,
  isMissingChangeFeedRpcError,
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
