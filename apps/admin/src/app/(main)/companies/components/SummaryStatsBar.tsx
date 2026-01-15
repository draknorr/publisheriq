'use client';

import { formatCompactNumber, formatRevenue, type AggregateStats } from '../lib/companies-queries';

interface SummaryStatsBarProps {
  stats: AggregateStats;
  isLoading?: boolean;
}

export function SummaryStatsBar({ stats, isLoading }: SummaryStatsBarProps) {
  if (isLoading) {
    return (
      <div className="flex gap-4 p-4 bg-surface-elevated rounded-lg border border-border-subtle">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex-1 animate-pulse">
            <div className="h-3 bg-surface-overlay rounded w-16 mb-2" />
            <div className="h-5 bg-surface-overlay rounded w-12" />
          </div>
        ))}
      </div>
    );
  }

  const metrics = [
    {
      label: 'Companies',
      value: formatCompactNumber(stats.total_companies),
    },
    {
      label: 'Total Games',
      value: formatCompactNumber(stats.total_games),
    },
    {
      label: 'Total Owners',
      value: formatCompactNumber(stats.total_owners),
    },
    {
      label: 'Total Revenue',
      value: formatRevenue(stats.total_revenue),
    },
    {
      label: 'Avg Score',
      value: stats.avg_review_score ? `${Math.round(stats.avg_review_score)}%` : '—',
    },
    {
      label: 'Total CCU',
      value: formatCompactNumber(stats.total_ccu),
    },
  ];

  return (
    <div className="flex flex-wrap gap-4 p-4 bg-surface-elevated rounded-lg border border-border-subtle">
      {metrics.map((metric) => (
        <div key={metric.label} className="flex-1 min-w-[90px]">
          <div className="text-caption text-text-tertiary uppercase tracking-wide">
            {metric.label}
          </div>
          <div className="text-h4 font-semibold text-text-primary mt-0.5">
            {metric.value}
          </div>
        </div>
      ))}
    </div>
  );
}
