'use client';

import Link from 'next/link';
import { Card } from '@/components/ui';
import { TrendIndicator } from '@/components/data-display';
import type { GameInsight } from '../lib/insights-types';

interface GameInsightCardProps {
  game: GameInsight;
  rank?: number;
  showGrowth?: boolean;
  showTier?: boolean;
}

function formatCCU(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getTierColor(tier: 1 | 2 | 3): string {
  switch (tier) {
    case 1:
      return 'bg-accent-green/15 text-accent-green';
    case 2:
      return 'bg-accent-blue/15 text-accent-blue';
    case 3:
      return 'bg-surface-overlay text-text-muted';
  }
}

export function GameInsightCard({
  game,
  rank,
  showGrowth = false,
  showTier = true,
}: GameInsightCardProps) {
  const trendDirection = game.growthPct !== undefined
    ? game.growthPct > 0
      ? 'up'
      : game.growthPct < 0
        ? 'down'
        : 'stable'
    : undefined;

  return (
    <Card variant="interactive" padding="md">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Rank + Game Info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Rank */}
          {rank !== undefined && (
            <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-surface-overlay">
              <span className="text-body-sm font-semibold text-text-secondary">
                {rank}
              </span>
            </div>
          )}

          {/* Game Info */}
          <div className="flex-1 min-w-0">
            <Link
              href={`/apps/${game.appid}`}
              className="text-body font-medium text-text-primary hover:text-accent-primary transition-colors line-clamp-1"
            >
              {game.name}
            </Link>

            <div className="flex items-center gap-3 mt-1">
              {/* CCU */}
              <span className="text-body-sm text-text-secondary">
                <span className="text-text-primary font-medium">
                  {formatCCU(game.currentCcu)}
                </span>
                {' '}CCU
              </span>

              {/* Growth (for trending) */}
              {showGrowth && game.growthPct !== undefined && trendDirection && (
                <TrendIndicator
                  direction={trendDirection}
                  value={Math.abs(game.growthPct)}
                  variant="badge"
                  size="sm"
                />
              )}

              {/* Prior CCU (for trending context) */}
              {showGrowth && game.priorAvgCcu !== undefined && (
                <span className="text-caption text-text-muted">
                  from {formatCCU(game.priorAvgCcu)}
                </span>
              )}

              {/* Release date (for newest) */}
              {!showGrowth && game.releaseDate && (
                <span className="text-caption text-text-muted">
                  {formatDate(game.releaseDate)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Tier Badge */}
        {showTier && game.ccuTier && (
          <div className="flex-shrink-0">
            <span
              className={`px-2 py-0.5 rounded text-caption font-medium ${getTierColor(game.ccuTier)}`}
              title={game.tierReason ?? `CCU Tier ${game.ccuTier}`}
            >
              Tier {game.ccuTier}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Compact variant for denser lists
 */
export function GameInsightCardCompact({
  game,
  rank,
  showGrowth = false,
}: GameInsightCardProps) {
  const trendDirection = game.growthPct !== undefined
    ? game.growthPct > 0
      ? 'up'
      : game.growthPct < 0
        ? 'down'
        : 'stable'
    : undefined;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-elevated transition-colors">
      {/* Rank */}
      {rank !== undefined && (
        <span className="w-6 text-caption font-medium text-text-muted text-right">
          {rank}
        </span>
      )}

      {/* Game Name */}
      <Link
        href={`/apps/${game.appid}`}
        className="flex-1 text-body-sm font-medium text-text-primary hover:text-accent-primary transition-colors truncate"
      >
        {game.name}
      </Link>

      {/* CCU */}
      <span className="text-body-sm font-medium text-text-secondary">
        {formatCCU(game.currentCcu)}
      </span>

      {/* Growth */}
      {showGrowth && game.growthPct !== undefined && trendDirection && (
        <TrendIndicator
          direction={trendDirection}
          value={Math.abs(game.growthPct)}
          variant="default"
          size="sm"
        />
      )}
    </div>
  );
}
