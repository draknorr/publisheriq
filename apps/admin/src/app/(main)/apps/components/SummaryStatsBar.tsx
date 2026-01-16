'use client';

import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import type { AggregateStats } from '../lib/apps-types';
import { formatCompactNumber, formatPercentage } from '../lib/apps-queries';

interface SummaryStatsBarProps {
  stats: AggregateStats;
  isLoading?: boolean;
}

/**
 * Displays aggregate statistics for the filtered games
 * Two-row layout on desktop, stacked on mobile
 */
export function SummaryStatsBar({ stats, isLoading }: SummaryStatsBarProps) {
  if (isLoading) {
    return (
      <div className="p-4 bg-surface-elevated border border-border-muted rounded-lg animate-pulse">
        <div className="h-5 bg-surface-overlay rounded w-3/4 mb-2" />
        <div className="h-5 bg-surface-overlay rounded w-1/2" />
      </div>
    );
  }

  return (
    <div className="p-4 bg-surface-elevated border border-border-muted rounded-lg">
      {/* Row 1: Core metrics */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-body-sm">
        <StatItem
          icon={<BarChart3 className="w-4 h-4 text-accent-primary" />}
          label="Avg CCU"
          value={formatCompactNumber(stats.avg_ccu)}
        />
        <Divider />
        <StatItem
          label="Avg Score"
          value={formatPercentage(stats.avg_score)}
        />
        <Divider />
        <StatItem
          icon={<TrendingUp className="w-4 h-4 text-trend-positive" />}
          label="Trending"
          value={formatCompactNumber(stats.trending_up_count)}
          valueColor="text-trend-positive"
        />
        <Divider />
        <StatItem
          icon={<TrendingDown className="w-4 h-4 text-trend-negative" />}
          label="Declining"
          value={formatCompactNumber(stats.trending_down_count)}
          valueColor="text-trend-negative"
        />
      </div>

      {/* Row 2: Advanced metrics */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-body-sm mt-2 pt-2 border-t border-border-muted">
        <StatItem
          label="Avg Momentum"
          value={formatMomentum(stats.avg_momentum)}
          valueColor={getMomentumColor(stats.avg_momentum)}
        />
        <Divider />
        <StatItem
          label="Sentiment"
          value={
            <span className="flex items-center gap-1">
              <span className="text-trend-positive">
                {stats.sentiment_improving_count}
              </span>
              <span className="text-text-muted">/</span>
              <span className="text-trend-negative">
                {stats.sentiment_declining_count}
              </span>
            </span>
          }
        />
        <Divider />
        <StatItem
          label="Avg Value"
          value={formatValueScore(stats.avg_value_score)}
        />
      </div>
    </div>
  );
}

interface StatItemProps {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  valueColor?: string;
}

function StatItem({ icon, label, value, valueColor = 'text-text-primary' }: StatItemProps) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-text-muted">{label}:</span>
      <span className={`font-medium ${valueColor}`}>{value}</span>
    </div>
  );
}

function Divider() {
  return <span className="hidden sm:inline text-text-muted">|</span>;
}

/**
 * Format momentum score with sign
 */
function formatMomentum(value: number | null): string {
  if (value === null || value === undefined) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}`;
}

/**
 * Get color class for momentum value
 */
function getMomentumColor(value: number | null): string {
  if (value === null || value === undefined) return 'text-text-muted';
  if (value >= 10) return 'text-trend-positive';
  if (value <= -10) return 'text-trend-negative';
  return 'text-text-primary';
}

/**
 * Format value score (hours per dollar)
 */
function formatValueScore(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1)} hrs/$`;
}
