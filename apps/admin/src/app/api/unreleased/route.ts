import { NextRequest, NextResponse } from 'next/server';
import { getAuthErrorResponse, requireAuthOrThrow } from '@/lib/auth-utils';
import {
  buildUnreleasedFiltersFromUrlSearchParams,
  getUnreleasedGames,
  getUnreleasedStats,
} from '@/app/(main)/unreleased/lib/unreleased-queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuthOrThrow();

    const filters = buildUnreleasedFiltersFromUrlSearchParams(request.nextUrl.searchParams);
    const [data, stats] = await Promise.all([
      getUnreleasedGames(filters),
      getUnreleasedStats(filters),
    ]);

    return NextResponse.json({ data, stats });
  } catch (error) {
    const authErrorResponse = getAuthErrorResponse(error);
    if (authErrorResponse) return authErrorResponse;

    console.error('Unreleased games API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
