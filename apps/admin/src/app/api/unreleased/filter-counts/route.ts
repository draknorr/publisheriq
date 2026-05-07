import { NextRequest, NextResponse } from 'next/server';
import { getAuthErrorResponse, requireAuthOrThrow } from '@/lib/auth-utils';
import {
  buildUnreleasedFiltersFromUrlSearchParams,
  getUnreleasedFilterOptions,
} from '@/app/(main)/unreleased/lib/unreleased-queries';

export const dynamic = 'force-dynamic';

const VALID_FILTER_TYPES = new Set(['genre', 'tag', 'category']);

export async function GET(request: NextRequest) {
  try {
    await requireAuthOrThrow();

    const filterType = request.nextUrl.searchParams.get('filterType');
    if (!filterType || !VALID_FILTER_TYPES.has(filterType)) {
      return NextResponse.json({ error: 'Invalid filterType' }, { status: 400 });
    }

    const filters = buildUnreleasedFiltersFromUrlSearchParams(request.nextUrl.searchParams);
    const data = await getUnreleasedFilterOptions(
      filterType as 'genre' | 'tag' | 'category',
      filters
    );

    return NextResponse.json({ data });
  } catch (error) {
    const authErrorResponse = getAuthErrorResponse(error);
    if (authErrorResponse) return authErrorResponse;

    console.error('Unreleased filter counts API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
