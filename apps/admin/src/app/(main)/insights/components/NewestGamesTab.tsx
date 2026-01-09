'use client';

import { Sparkles, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { TopGameCard } from './TopGameCard';
import type { GameInsight, TimeRange, NewestSortMode } from '../lib/insights-types';

interface NewestGamesTabProps {
  games: GameInsight[];
  timeRange: TimeRange;
  sortBy: NewestSortMode;
  onSortChange: (sort: NewestSortMode) => void;
}

export function NewestGamesTab({ games, timeRange, sortBy, onSortChange }: NewestGamesTabProps) {
  if (games.length === 0) {
    return (
      <div className="text-center py-12">
        <Sparkles className="h-12 w-12 text-text-muted mx-auto mb-4" />
        <h3 className="text-subheading text-text-primary mb-2">No New Games Found</h3>
        <p className="text-body-sm text-text-secondary max-w-md mx-auto">
          No games released in the past year have CCU data yet. Check back soon.
        </p>
      </div>
    );
  }

  // Calculate summary stats
  const _totalCcu = games.reduce((sum, g) => sum + g.currentCcu, 0);
  void _totalCcu; // Reserved for future use

  // Calculate average positive review percentage
  const gamesWithReviews = games.filter(g => g.positivePercent !== undefined);
  const avgPositivePercent =
    gamesWithReviews.length > 0
      ? Math.round(
          gamesWithReviews.reduce((sum, g) => sum + (g.positivePercent ?? 0), 0) /
            gamesWithReviews.length
        )
      : null;

  // Find most recent release (for "By Release" mode)
  const sortedByDate = [...games].sort((a, b) => {
    if (!a.releaseDate || !b.releaseDate) return 0;
    return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
  });
  const mostRecent = sortedByDate[0];

  // Find top gainer (for "By CCU Growth" mode)
  const topGainer = games.reduce(
    (max, g) => ((g.growthPct ?? -Infinity) > (max?.growthPct ?? -Infinity) ? g : max),
    games[0]
  );

  const timeRangeLabel = timeRange === '24h' ? '24h' : timeRange === '7d' ? '7d' : '30d';

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-blue/15">
              <Sparkles className="h-5 w-5 text-accent-blue" />
            </div>
            <div>
              <p className="text-caption text-text-muted">New Games</p>
              <p className="text-heading font-semibold text-text-primary">{games.length}</p>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-green/15">
              <TrendingUp className="h-5 w-5 text-accent-green" />
            </div>
            <div>
              <p className="text-caption text-text-muted">Avg Review Score</p>
              <p className="text-heading font-semibold text-text-primary">
                {avgPositivePercent !== null ? `${avgPositivePercent}% Positive` : '-'}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-purple/15">
              <Calendar className="h-5 w-5 text-accent-purple" />
            </div>
            <div>
              <p className="text-caption text-text-muted">
                {sortBy === 'release' ? 'Most Recent' : 'Top Gainer'}
              </p>
              <p className="text-body font-medium text-text-primary truncate max-w-[180px]">
                {sortBy === 'release' ? mostRecent?.name : topGainer?.name}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Games List */}
      <Card padding="none">
        <CardHeader className="px-4 pt-4 pb-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Recently Released Games</CardTitle>

            {/* Sort Toggle */}
            <div className="flex items-center gap-1 bg-surface-overlay rounded-lg p-0.5">
              <button
                onClick={() => onSortChange('release')}
                className={`px-3 py-1.5 text-caption font-medium rounded-md transition-colors ${
                  sortBy === 'release'
                    ? 'bg-surface-raised text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                By Release
              </button>
              <button
                onClick={() => onSortChange('growth')}
                className={`px-3 py-1.5 text-caption font-medium rounded-md transition-colors ${
                  sortBy === 'growth'
                    ? 'bg-surface-raised text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                By CCU Growth
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          {/* Column Headers */}
          <div className="hidden sm:flex items-center gap-3 px-3 py-2 text-caption text-text-muted border-b border-border-subtle mb-1">
            <div className="w-7" /> {/* Rank */}
            <div className="flex-1">Game</div>
            <div className="w-[160px] text-right">CCU ({timeRangeLabel})</div>
            <div className="w-[100px] text-right hidden sm:block">Reviews</div>
            <div className="w-[70px] text-right hidden md:block">Price</div>
            <div className="w-[50px] text-right hidden lg:block">Playtime</div>
          </div>

          <div className="space-y-0.5">
            {games.map((game, index) => (
              <TopGameCard key={game.appid} game={game} rank={index + 1} showReleaseDate />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
