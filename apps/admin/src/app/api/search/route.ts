import { NextRequest, NextResponse } from 'next/server';
import { unifiedSearch } from '@/lib/search/unified-search';
import { createServerClient } from '@/lib/supabase/server';
import type { SearchResponse } from '@/components/search/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse<SearchResponse>> {
  const startTime = Date.now();

  try {
    // Auth check
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          query: '',
          results: { games: [], publishers: [], developers: [] },
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { query, limit = 5 } = body as { query: string; limit?: number };

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        {
          success: false,
          query: query || '',
          results: { games: [], publishers: [], developers: [] },
          error: 'Query is required',
        },
        { status: 400 }
      );
    }

    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      return NextResponse.json({
        success: true,
        query: trimmedQuery,
        results: { games: [], publishers: [], developers: [] },
      });
    }

    const results = await unifiedSearch(trimmedQuery, Math.min(limit, 10));

    return NextResponse.json({
      success: true,
      query: trimmedQuery,
      results,
      timing: {
        total_ms: Date.now() - startTime,
      },
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      {
        success: false,
        query: '',
        results: { games: [], publishers: [], developers: [] },
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
