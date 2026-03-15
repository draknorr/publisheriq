import { NextRequest, NextResponse } from 'next/server';
import { getAuthErrorResponse, requireAuthOrThrow } from '@/lib/auth-utils';
import { createServerClient } from '@/lib/supabase/server';
import type {
  ChangeFeedBurstsResponse,
  RawChangeBurstRow,
} from '@/app/(main)/changes/lib';
import {
  buildNextCursor,
  isMissingChangeFeedRpcError,
  mapChangeBurstRow,
  parseChangeFeedBurstParams,
  toSqlChangeFeedPreset,
} from '@/app/(main)/changes/lib';

export const dynamic = 'force-dynamic';

const DEFAULT_CACHE_TTL_MS = 60 * 1000;

let defaultBurstsCache:
  | {
      data: ChangeFeedBurstsResponse;
      cachedAt: number;
    }
  | null = null;

function isDefaultBurstsRequest(params: ReturnType<typeof parseChangeFeedBurstParams>): boolean {
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

export async function GET(request: NextRequest) {
  try {
    await requireAuthOrThrow();

    const params = parseChangeFeedBurstParams(request.nextUrl.searchParams);
    const isDefaultRequest = isDefaultBurstsRequest(params);

    if (
      isDefaultRequest &&
      defaultBurstsCache &&
      Date.now() - defaultBurstsCache.cachedAt < DEFAULT_CACHE_TTL_MS
    ) {
      return NextResponse.json(defaultBurstsCache.data);
    }

    const supabase = await createServerClient();

    // Generated DB types will lag until the migration is applied.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('get_change_feed_bursts', {
      p_days: params.days,
      p_preset: toSqlChangeFeedPreset(params.preset),
      p_app_types: params.appTypes,
      p_search: params.search,
      p_source_filter: params.sourceFilter,
      p_cursor_time: params.cursorTime,
      p_cursor_burst_id: params.cursorKey,
      p_limit: params.limit,
    });

    if (error) {
      if (isMissingChangeFeedRpcError(error, 'get_change_feed_bursts')) {
        return NextResponse.json(
          { error: 'Change Feed query surfaces are not available yet. Apply the pending migration first.' },
          { status: 503 }
        );
      }

      console.error('Change Feed bursts RPC error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items = ((data ?? []) as RawChangeBurstRow[]).map(mapChangeBurstRow);
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

    return NextResponse.json(response);
  } catch (error) {
    const authErrorResponse = getAuthErrorResponse(error);
    if (authErrorResponse) {
      return authErrorResponse;
    }

    console.error('Change Feed bursts GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
