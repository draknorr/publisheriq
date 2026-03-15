import { NextRequest, NextResponse } from 'next/server';
import { getAuthErrorResponse, requireAuthOrThrow } from '@/lib/auth-utils';
import type { ChangeFeedBurstsResponse } from '@/app/(main)/changes/lib';
import {
  ChangeFeedQueryError,
  ChangeFeedUnavailableError,
  fetchChangeFeedBurstsResponse,
  parseChangeFeedBurstParams,
} from '@/app/(main)/changes/lib';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuthOrThrow();

    const params = parseChangeFeedBurstParams(request.nextUrl.searchParams);
    const response: ChangeFeedBurstsResponse = await fetchChangeFeedBurstsResponse(params);
    return NextResponse.json(response);
  } catch (error) {
    const authErrorResponse = getAuthErrorResponse(error);
    if (authErrorResponse) {
      return authErrorResponse;
    }

    if (error instanceof ChangeFeedUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (error instanceof ChangeFeedQueryError) {
      console.error('Change Feed bursts RPC error:', error.cause ?? error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.error('Change Feed bursts GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
