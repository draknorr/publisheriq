'use client';

import { TrendingUp, ArrowUp, Flame } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { GameInsightCard } from './GameInsightCard';
import type { GameInsight } from '../lib/insights-types';

interface TrendingGamesTabProps {
  games: GameInsight[];
}

export function TrendingGamesTab({ games }: TrendingGamesTabProps) {
  if (games.length === 0) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="h-12 w-12 text-text-muted mx-auto mb-4" />
        <h3 className="text-subheading text-text-primary mb-2">No Trending Data Available</h3>
        <p className="text-body-sm text-text-secondary max-w-md mx-auto">
          Not enough historical CCU data to calculate trends. Check back after more data has been collected.
        </p>
      </div>
    );
  }

  // Calculate summary stats
  const avgGrowth = games.length > 0
    ? Math.round(games.reduce((sum, g) => sum + (g.growthPct ?? 0), 0) / games.length * 10) / 10
    : 0;

  const maxGrowth = Math.max(...games.map(g => g.growthPct ?? 0));
  const topGainer = games.find(g => g.growthPct === maxGrowth);

  const highGrowthCount = games.filter(g => (g.growthPct ?? 0) > 50).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-green/15">
              <TrendingUp className="h-5 w-5 text-accent-green" />
            </div>
            <div>
              <p className="text-caption text-text-muted">Avg Growth</p>
              <p className="text-heading font-semibold text-accent-green">
                +{avgGrowth}%
              </p>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-orange/15">
              <Flame className="h-5 w-5 text-accent-orange" />
            </div>
            <div>
              <p className="text-caption text-text-muted">High Growth (&gt;50%)</p>
              <p className="text-heading font-semibold text-text-primary">
                {highGrowthCount}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-cyan/15">
              <ArrowUp className="h-5 w-5 text-accent-cyan" />
            </div>
            <div>
              <p className="text-caption text-text-muted">Top Gainer</p>
              <p className="text-body font-medium text-text-primary truncate max-w-[180px]">
                {topGainer?.name ?? '-'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Games List */}
      <Card padding="none">
        <CardHeader className="px-4 pt-4 pb-0">
          <CardTitle>Fastest Growing Games</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-4">
          <div className="space-y-2">
            {games.map((game, index) => (
              <GameInsightCard
                key={game.appid}
                game={game}
                rank={index + 1}
                showGrowth={true}
                showTier={false}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
