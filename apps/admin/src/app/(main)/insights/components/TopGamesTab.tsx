'use client';

import { Users, Trophy, Zap } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { GameInsightCard } from './GameInsightCard';
import type { GameInsight } from '../lib/insights-types';

interface TopGamesTabProps {
  games: GameInsight[];
}

export function TopGamesTab({ games }: TopGamesTabProps) {
  if (games.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-text-muted mx-auto mb-4" />
        <h3 className="text-subheading text-text-primary mb-2">No CCU Data Available</h3>
        <p className="text-body-sm text-text-secondary max-w-md mx-auto">
          CCU data is still being collected. Check back soon for top games by concurrent players.
        </p>
      </div>
    );
  }

  // Calculate summary stats
  const totalCcu = games.reduce((sum, g) => sum + g.currentCcu, 0);
  const tier1Count = games.filter(g => g.ccuTier === 1).length;
  const topGame = games[0];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-cyan/15">
              <Users className="h-5 w-5 text-accent-cyan" />
            </div>
            <div>
              <p className="text-caption text-text-muted">Total CCU</p>
              <p className="text-heading font-semibold text-text-primary">
                {totalCcu.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-green/15">
              <Zap className="h-5 w-5 text-accent-green" />
            </div>
            <div>
              <p className="text-caption text-text-muted">Tier 1 Games</p>
              <p className="text-heading font-semibold text-text-primary">
                {tier1Count}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-purple/15">
              <Trophy className="h-5 w-5 text-accent-purple" />
            </div>
            <div>
              <p className="text-caption text-text-muted">Top Game</p>
              <p className="text-body font-medium text-text-primary truncate max-w-[180px]">
                {topGame?.name ?? '-'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Games List */}
      <Card padding="none">
        <CardHeader className="px-4 pt-4 pb-0">
          <CardTitle>Top Games by Peak CCU</CardTitle>
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
