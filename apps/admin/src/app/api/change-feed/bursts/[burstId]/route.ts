import { NextRequest, NextResponse } from 'next/server';
import { getAuthErrorResponse, requireAuthOrThrow } from '@/lib/auth-utils';
import type { ChangeBurstDetail } from '@/app/(main)/changes/lib';
import {
  ChangeFeedQueryError,
  ChangeFeedUnavailableError,
  fetchChangeFeedBurstDetail,
} from '@/app/(main)/changes/lib';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ burstId: string }> }
) {
  try {
    await requireAuthOrThrow();

    const { burstId } = await params;
    const decodedBurstId = decodeURIComponent(burstId);
    const detail: ChangeBurstDetail | null = await fetchChangeFeedBurstDetail(decodedBurstId);

    if (!detail) {
      return NextResponse.json({ error: 'Burst not found' }, { status: 404 });
    }

    return NextResponse.json({ item: detail });
  } catch (error) {
    const authErrorResponse = getAuthErrorResponse(error);
    if (authErrorResponse) {
      return authErrorResponse;
    }

    if (error instanceof ChangeFeedUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (error instanceof ChangeFeedQueryError) {
      console.error('Change Feed burst detail RPC error:', error.cause ?? error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.error('Change Feed burst detail GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
