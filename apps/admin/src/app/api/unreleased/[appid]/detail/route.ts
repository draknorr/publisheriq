import { NextRequest, NextResponse } from 'next/server';
import { getAuthErrorResponse, requireAuthOrThrow } from '@/lib/auth-utils';
import { getUnreleasedGameDetail } from '@/app/(main)/unreleased/lib/unreleased-queries';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ appid: string }> }
) {
  try {
    await requireAuthOrThrow();

    const { appid: appidParam } = await params;
    const appid = Number.parseInt(appidParam, 10);
    if (!Number.isInteger(appid) || appid <= 0) {
      return NextResponse.json({ error: 'Invalid appid' }, { status: 400 });
    }

    const detail = await getUnreleasedGameDetail(appid);
    if (!detail) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json({ data: detail });
  } catch (error) {
    const authErrorResponse = getAuthErrorResponse(error);
    if (authErrorResponse) return authErrorResponse;

    console.error('Unreleased detail API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
