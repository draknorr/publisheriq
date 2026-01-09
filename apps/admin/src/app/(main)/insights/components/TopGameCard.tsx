'use client';

import Link from 'next/link';
import { TrendSparkline } from '@/components/data-display';
import type { GameInsight } from '../lib/insights-types';

interface TopGameCardProps {
  game: GameInsight;
  rank: number;
  showReleaseDate?: boolean;
}

function formatCCU(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatPlaytime(hours: number): string {
  if (hours >= 1000) return `${Math.round(hours / 100) / 10}K h`;
  return `${hours}h`;
}

function getReviewColor(percent: number): string {
  if (percent >= 80) return 'text-accent-green';
  if (percent >= 70) return 'text-lime-400';
  if (percent >= 50) return 'text-accent-yellow';
  return 'text-accent-red';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TopGameCard({ game, rank, showReleaseDate = false }: TopGameCardProps) {
  // Calculate growth percentage from sparkline if available
  let growthPct: number | undefined;
  if (game.ccuSparkline && game.ccuSparkline.length >= 2) {
    const midpoint = Math.floor(game.ccuSparkline.length / 2);
    const firstHalf = game.ccuSparkline.slice(0, midpoint);
    const secondHalf = game.ccuSparkline.slice(midpoint);
    const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
    if (avgFirst > 0) {
      growthPct = Math.round(((avgSecond - avgFirst) / avgFirst) * 100);
    }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-elevated transition-colors">
      {/* Rank */}
      <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md bg-surface-overlay">
        <span className="text-caption font-semibold text-text-secondary">{rank}</span>
      </div>

      {/* Game Name */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/apps/${game.appid}`}
          className="text-body-sm font-medium text-text-primary hover:text-accent-primary transition-colors line-clamp-1"
        >
          {game.name}
        </Link>
        {showReleaseDate && game.releaseDate && (
          <div className="text-caption text-text-muted">{formatDate(game.releaseDate)}</div>
        )}
      </div>

      {/* CCU with Sparkline */}
      <div className="flex items-center gap-2 w-[160px] flex-shrink-0">
        <TrendSparkline
          data={game.ccuSparkline ?? []}
          trend={game.ccuTrend}
          height={24}
          width={70}
        />
        <div className="text-right min-w-[60px]">
          <div className="text-body-sm font-medium text-text-primary">
            {formatCCU(game.peakCcu ?? game.currentCcu)}
          </div>
          {growthPct !== undefined && (
            <div
              className={`text-caption ${growthPct >= 0 ? 'text-accent-green' : 'text-accent-red'}`}
            >
              {growthPct >= 0 ? '+' : ''}
              {growthPct}%
            </div>
          )}
        </div>
      </div>

      {/* Reviews */}
      <div className="w-[100px] text-right flex-shrink-0 hidden sm:block">
        {game.totalReviews !== undefined ? (
          <>
            <div className="text-body-sm text-text-primary">
              {formatNumber(game.totalReviews)}
              {game.positivePercent !== undefined && (
                <span className={`ml-1 ${getReviewColor(game.positivePercent)}`}>
                  ({game.positivePercent}%)
                </span>
              )}
            </div>
            {game.reviewVelocity !== undefined && game.reviewVelocity > 0 && (
              <div className="text-caption text-text-muted">
                {game.reviewVelocity.toFixed(1)}/day
              </div>
            )}
          </>
        ) : (
          <span className="text-caption text-text-muted">-</span>
        )}
      </div>

      {/* Price */}
      <div className="w-[70px] text-right flex-shrink-0 hidden md:block">
        {game.isFree ? (
          <span className="text-body-sm text-accent-green font-medium">Free</span>
        ) : game.priceCents ? (
          <>
            <div className="text-body-sm text-text-primary">
              ${(game.priceCents / 100).toFixed(2)}
            </div>
            {game.discountPercent && game.discountPercent > 0 && (
              <div className="text-caption text-accent-green">-{game.discountPercent}%</div>
            )}
          </>
        ) : (
          <span className="text-caption text-text-muted">-</span>
        )}
      </div>

      {/* Playtime */}
      <div className="w-[50px] text-right flex-shrink-0 hidden lg:block">
        {game.avgPlaytimeHours ? (
          <div className="text-body-sm text-text-secondary">{formatPlaytime(game.avgPlaytimeHours)}</div>
        ) : (
          <span className="text-caption text-text-muted">-</span>
        )}
      </div>
    </div>
  );
}
