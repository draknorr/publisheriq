'use client';

import type { AggregateStats } from '../lib/apps-types';

interface ContextBarProps {
  stats: AggregateStats;
  isLoading?: boolean;
}

/**
 * Format a number with K/M suffix
 */
function formatCompactNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '—';
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

/**
 * Format momentum score with sign
 */
function formatMomentum(num: number | null | undefined): string {
  if (num === null || num === undefined) return '—';
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(1)}`;
}

/**
 * Context bar showing inline aggregate stats.
 * Matches Companies page design - simple inline layout with dot separators.
 */
export function ContextBar({ stats, isLoading }: ContextBarProps) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-surface-elevated/50 rounded-lg border border-border-subtle text-body-sm text-text-tertiary">
      {isLoading ? (
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 w-20 bg-surface-overlay rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <span className="whitespace-nowrap">
            <span className="font-medium text-text-secondary">
              {formatCompactNumber(stats.total_games)}
            </span>{' '}
            games
          </span>
          <span className="text-border-muted">·</span>
          <span className="whitespace-nowrap">
            <span className="font-medium text-text-secondary">
              {formatCompactNumber(stats.avg_ccu)}
            </span>{' '}
            avg CCU
          </span>
          <span className="text-border-muted">·</span>
          <span className="whitespace-nowrap">
            <span className="font-medium text-trend-positive">
              {formatCompactNumber(stats.trending_up_count)}
            </span>{' '}
            trending
          </span>
          <span className="text-border-muted hidden sm:inline">·</span>
          <span className="whitespace-nowrap hidden sm:inline">
            <span className="font-medium text-text-secondary">
              {formatMomentum(stats.avg_momentum)}
            </span>{' '}
            momentum
          </span>
        </>
      )}
    </div>
  );
}
