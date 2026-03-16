import { NextRequest, NextResponse } from 'next/server';
import { getAuthErrorResponse, requireAuthOrThrow } from '@/lib/auth-utils';
import type { ChangeFeedActivityResponse } from '@/app/(main)/changes/lib';
import {
  ChangeFeedQueryError,
  fetchChangeFeedActivityResponse,
  parseChangeFeedActivityParams,
} from '@/app/(main)/changes/lib';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuthOrThrow();

    const params = parseChangeFeedActivityParams(request.nextUrl.searchParams);
    const response: ChangeFeedActivityResponse = await fetchChangeFeedActivityResponse(params);
    return NextResponse.json(response);
  } catch (error) {
    const authErrorResponse = getAuthErrorResponse(error);
    if (authErrorResponse) {
      return authErrorResponse;
    }

    if (error instanceof ChangeFeedQueryError) {
      console.error('Steam Activity RPC error:', error.cause ?? error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.error('Steam Activity GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
