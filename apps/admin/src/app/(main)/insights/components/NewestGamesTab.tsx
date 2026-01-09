'use client';

import { Sparkles, Calendar, Users } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { GameInsightCard } from './GameInsightCard';
import type { GameInsight } from '../lib/insights-types';

interface NewestGamesTabProps {
  games: GameInsight[];
}

export function NewestGamesTab({ games }: NewestGamesTabProps) {
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
  const totalCcu = games.reduce((sum, g) => sum + g.currentCcu, 0);
  const avgCcu = Math.round(totalCcu / games.length);

  // Find most recent release
  const sortedByDate = [...games].sort((a, b) => {
    if (!a.releaseDate || !b.releaseDate) return 0;
    return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
  });
  const mostRecent = sortedByDate[0];

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
              <p className="text-heading font-semibold text-text-primary">
                {games.length}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-cyan/15">
              <Users className="h-5 w-5 text-accent-cyan" />
            </div>
            <div>
              <p className="text-caption text-text-muted">Avg CCU</p>
              <p className="text-heading font-semibold text-text-primary">
                {avgCcu.toLocaleString()}
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
              <p className="text-caption text-text-muted">Most Recent</p>
              <p className="text-body font-medium text-text-primary truncate max-w-[180px]">
                {mostRecent?.name ?? '-'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Games List */}
      <Card padding="none">
        <CardHeader className="px-4 pt-4 pb-0">
          <CardTitle>Recently Released Games</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-4">
          <div className="space-y-2">
            {games.map((game, index) => (
              <GameInsightCard
                key={game.appid}
                game={game}
                rank={index + 1}
                showGrowth={false}
                showTier={true}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
