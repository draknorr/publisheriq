import { NextRequest, NextResponse } from 'next/server';
import { getAuthErrorResponse, requireAuthOrThrow } from '@/lib/auth-utils';
import type { ChangeActivityDetail } from '@/app/(main)/changes/lib';
import {
  ChangeFeedQueryError,
  fetchChangeFeedActivityDetail,
} from '@/app/(main)/changes/lib';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ activityId: string }> }
) {
  try {
    await requireAuthOrThrow();

    const { activityId } = await params;
    const decodedActivityId = decodeURIComponent(activityId);
    const detail: ChangeActivityDetail | null =
      await fetchChangeFeedActivityDetail(decodedActivityId);

    if (!detail) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    return NextResponse.json({ item: detail });
  } catch (error) {
    const authErrorResponse = getAuthErrorResponse(error);
    if (authErrorResponse) {
      return authErrorResponse;
    }

    if (error instanceof ChangeFeedQueryError) {
      console.error('Steam Activity detail error:', error.cause ?? error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.error('Steam Activity detail GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
