import { NextResponse } from 'next/server';
import { getAllTags, getAllGenres, getAllCategories } from '@/lib/search/tag-lookup';

export const dynamic = 'force-dynamic';

/**
 * GET /api/autocomplete/tags
 *
 * Returns all tags, genres, and categories for client-side caching.
 * Response is designed to be cached in localStorage with a TTL.
 */
export async function GET() {
  try {
    // Fetch all data in parallel
    const [tags, genres, categories] = await Promise.all([
      getAllTags(),
      getAllGenres(),
      getAllCategories(),
    ]);

    return NextResponse.json({
      tags,
      genres,
      categories,
      cachedAt: Date.now(),
    });
  } catch (error) {
    console.error('Error fetching autocomplete tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}
