import type { Metadata } from 'next';
import { Card } from '@/components/ui/Card';
import { TigerConfigRequired } from '@/app/(main)/apps/lib/tiger-config-required';
import { UnreleasedPageClient } from './components/UnreleasedPageClient';
import {
  buildUnreleasedFiltersFromPageParams,
  getUnreleasedGames,
  getUnreleasedStats,
  isTigerReadConfigured,
} from './lib/unreleased-queries';
import type { UnreleasedGame, UnreleasedSearchParams, UnreleasedStats } from './lib/unreleased-types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Unreleased Games | PublisherIQ',
  description: 'Track upcoming Steam games, release signals, store changes, and publishing opportunities.',
};

const EMPTY_STATS: UnreleasedStats = {
  total_games: 0,
  dated_future_count: 0,
  undated_count: 0,
  stale_past_date_count: 0,
  active_30d_count: 0,
  news_30d_count: 0,
  adult_count: 0,
  no_publisher_count: 0,
  self_published_count: 0,
  small_publisher_count: 0,
  avg_opportunity_score: null,
  projection_refreshed_at: null,
};

export default async function UnreleasedPage({
  searchParams,
}: {
  searchParams: Promise<UnreleasedSearchParams>;
}) {
  if (!isTigerReadConfigured()) {
    return <TigerConfigRequired />;
  }

  const params = await searchParams;
  const filters = buildUnreleasedFiltersFromPageParams(params);
  let games: UnreleasedGame[] = [];
  let stats = EMPTY_STATS;
  let fetchError: string | null = null;

  try {
    [games, stats] = await Promise.all([
      getUnreleasedGames(filters),
      getUnreleasedStats(filters),
    ]);
  } catch (error) {
    console.error('Failed to fetch unreleased games:', error);
    fetchError = error instanceof Error ? error.message : 'Unknown error';
  }

  if (fetchError) {
    return (
      <div className="space-y-6">
        <Card className="rounded-lg border-accent-red/40 bg-accent-red/10">
          <h1 className="text-heading-md text-accent-red">Error Loading Unreleased Games</h1>
          <p className="mt-2 text-body text-text-secondary">
            The `/unreleased` read projection may not be available yet.
          </p>
          <pre className="mt-4 overflow-x-auto rounded bg-surface-raised p-4 text-caption text-text-muted whitespace-pre-wrap">
            {fetchError}
          </pre>
        </Card>
      </div>
    );
  }

  return (
    <UnreleasedPageClient
      initialData={games}
      initialStats={stats}
      initialFilters={filters}
    />
  );
}
