import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getUserWithProfile } from '@/lib/supabase/server';
import type {
  ChangeFeedNewsResponse,
  RawChangeNewsRow,
} from '@/app/(main)/changes/lib';
import {
  buildNextCursor,
  isMissingChangeFeedRpcError,
  mapChangeNewsRow,
  parseChangeFeedNewsParams,
} from '@/app/(main)/changes/lib';

export const dynamic = 'force-dynamic';

const DEFAULT_CACHE_TTL_MS = 60 * 1000;

let defaultNewsCache:
  | {
      data: ChangeFeedNewsResponse;
      cachedAt: number;
    }
  | null = null;

function isDefaultNewsRequest(params: ReturnType<typeof parseChangeFeedNewsParams>): boolean {
  return (
    params.days === 7 &&
    params.appTypes === null &&
    params.search === null &&
    params.cursorTime === null &&
    params.cursorKey === null &&
    params.limit === 50
  );
}

export async function GET(request: NextRequest) {
  try {
    const result = await getUserWithProfile();
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = parseChangeFeedNewsParams(request.nextUrl.searchParams);
    const isDefaultRequest = isDefaultNewsRequest(params);

    if (
      isDefaultRequest &&
      defaultNewsCache &&
      Date.now() - defaultNewsCache.cachedAt < DEFAULT_CACHE_TTL_MS
    ) {
      return NextResponse.json(defaultNewsCache.data);
    }

    const supabase = await createServerClient();

    // Generated DB types will lag until the migration is applied.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('get_change_feed_news', {
      p_days: params.days,
      p_app_types: params.appTypes,
      p_search: params.search,
      p_cursor_time: params.cursorTime,
      p_cursor_gid: params.cursorKey,
      p_limit: params.limit,
    });

    if (error) {
      if (isMissingChangeFeedRpcError(error, 'get_change_feed_news')) {
        return NextResponse.json(
          { error: 'Change Feed news query surface is not available yet. Apply the pending migration first.' },
          { status: 503 }
        );
      }

      console.error('Change Feed news RPC error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items = ((data ?? []) as RawChangeNewsRow[]).map(mapChangeNewsRow);
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

    return NextResponse.json(response);
  } catch (error) {
    console.error('Change Feed news GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
