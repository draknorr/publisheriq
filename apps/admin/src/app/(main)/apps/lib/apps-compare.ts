/**
 * Utilities for game comparison calculations
 */

import type { App, AggregateStats } from './apps-types';

/**
 * Category type for compare metrics
 */
export type CompareCategory = 'engagement' | 'reviews' | 'growth' | 'financial';

/**
 * Row of comparison data for a single metric
 */
export interface CompareMetricRow {
  metricId: string;
  label: string;
  category: CompareCategory;
  values: (number | null)[];
  formattedValues: string[];
  percentDiffs: (number | null)[];
  vsAvgValue: number | null;
  vsAvgDiff: number | null;
  bestIndex: number | null;
  worstIndex: number | null;
  higherIsBetter: boolean;
}

/**
 * Metric definition for comparison
 */
interface MetricDefinition {
  id: string;
  label: string;
  category: CompareCategory;
  getValue: (app: App) => number | null;
  format: (value: number | null) => string;
  higherIsBetter: boolean;
  getAvgFromStats?: (stats: AggregateStats) => number | null;
}

/**
 * Format a number compactly (1.2K, 3.5M, etc.)
 */
function formatCompactNumber(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

/**
 * Format price in dollars
 */
function formatPrice(cents: number | null): string {
  if (cents === null) return '—';
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format playtime in hours
 */
function formatPlaytime(minutes: number | null): string {
  if (minutes === null) return '—';
  const hours = minutes / 60;
  if (hours >= 100) return `${Math.round(hours)}h`;
  return `${hours.toFixed(1)}h`;
}

/**
 * Format percentage
 */
function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return `${Math.round(value)}%`;
}

/**
 * Format growth percentage with sign
 */
function formatGrowth(value: number | null): string {
  if (value === null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Format velocity (reviews per day)
 */
function formatVelocity(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(1)}/day`;
}

/**
 * All metrics available for game comparison
 */
export const COMPARE_METRICS: MetricDefinition[] = [
  // Engagement
  {
    id: 'ccu_peak',
    label: 'Peak CCU',
    category: 'engagement',
    getValue: (app) => app.ccu_peak,
    format: formatCompactNumber,
    higherIsBetter: true,
    getAvgFromStats: (stats) => stats.avg_ccu,
  },
  {
    id: 'owners',
    label: 'Owners',
    category: 'engagement',
    getValue: (app) => app.owners_midpoint,
    format: formatCompactNumber,
    higherIsBetter: true,
  },
  {
    id: 'playtime',
    label: 'Avg Playtime',
    category: 'engagement',
    getValue: (app) => app.average_playtime_forever,
    format: formatPlaytime,
    higherIsBetter: true,
  },
  {
    id: 'active_pct',
    label: 'Active Players',
    category: 'engagement',
    getValue: (app) => app.active_player_pct,
    format: formatPercent,
    higherIsBetter: true,
  },
  // Reviews
  {
    id: 'total_reviews',
    label: 'Total Reviews',
    category: 'reviews',
    getValue: (app) => app.total_reviews,
    format: formatCompactNumber,
    higherIsBetter: true,
  },
  {
    id: 'review_score',
    label: 'Review Score',
    category: 'reviews',
    getValue: (app) => app.review_score,
    format: formatPercent,
    higherIsBetter: true,
    getAvgFromStats: (stats) => stats.avg_score,
  },
  {
    id: 'positive_pct',
    label: 'Positive %',
    category: 'reviews',
    getValue: (app) => app.positive_percentage,
    format: formatPercent,
    higherIsBetter: true,
  },
  {
    id: 'velocity_7d',
    label: 'Velocity (7d)',
    category: 'reviews',
    getValue: (app) => app.velocity_7d,
    format: formatVelocity,
    higherIsBetter: true,
  },
  {
    id: 'velocity_30d',
    label: 'Velocity (30d)',
    category: 'reviews',
    getValue: (app) => app.velocity_30d,
    format: formatVelocity,
    higherIsBetter: true,
  },
  // Growth
  {
    id: 'growth_7d',
    label: 'CCU Growth (7d)',
    category: 'growth',
    getValue: (app) => app.ccu_growth_7d_percent,
    format: formatGrowth,
    higherIsBetter: true,
  },
  {
    id: 'growth_30d',
    label: 'CCU Growth (30d)',
    category: 'growth',
    getValue: (app) => app.ccu_growth_30d_percent,
    format: formatGrowth,
    higherIsBetter: true,
  },
  {
    id: 'momentum',
    label: 'Momentum',
    category: 'growth',
    getValue: (app) => app.momentum_score,
    format: formatGrowth,
    higherIsBetter: true,
    getAvgFromStats: (stats) => stats.avg_momentum,
  },
  // Financial
  {
    id: 'price',
    label: 'Price',
    category: 'financial',
    getValue: (app) => app.price_cents,
    format: formatPrice,
    higherIsBetter: false, // lower price is often better for value
  },
  {
    id: 'value_score',
    label: 'Value Score',
    category: 'financial',
    getValue: (app) => app.value_score,
    format: (v) => (v !== null ? v.toFixed(1) : '—'),
    higherIsBetter: true,
    getAvgFromStats: (stats) => stats.avg_value_score,
  },
];

/**
 * Calculate percentage difference from baseline
 * @returns null if baseline is 0 or values are null
 */
export function calculatePercentDiff(
  value: number | null,
  baseline: number | null
): number | null {
  if (baseline === null || baseline === 0 || value === null) return null;
  return ((value - baseline) / Math.abs(baseline)) * 100;
}

/**
 * Find best and worst indices for a metric
 */
export function findBestWorstIndices(
  values: (number | null)[],
  higherIsBetter: boolean
): { bestIndex: number | null; worstIndex: number | null } {
  const validEntries = values
    .map((v, i) => ({ value: v, index: i }))
    .filter((e) => e.value !== null);

  if (validEntries.length === 0) {
    return { bestIndex: null, worstIndex: null };
  }

  // Sort to find best/worst
  const sorted = [...validEntries].sort((a, b) => {
    const aVal = a.value!;
    const bVal = b.value!;
    return higherIsBetter ? bVal - aVal : aVal - bVal;
  });

  return {
    bestIndex: sorted[0].index,
    worstIndex: sorted[sorted.length - 1].index,
  };
}

/**
 * Build comparison metric rows from apps
 */
export function buildCompareMetricRows(
  apps: App[],
  aggregateStats?: AggregateStats
): CompareMetricRow[] {
  if (apps.length === 0) return [];

  return COMPARE_METRICS.map((metric) => {
    // Get raw values for all apps
    const values = apps.map((app) => metric.getValue(app));
    const formattedValues = values.map((v) => metric.format(v));

    // Calculate % diff from baseline (first app)
    const baselineValue = values[0];
    const percentDiffs = values.map((v, i) =>
      i === 0 ? null : calculatePercentDiff(v, baselineValue)
    );

    // Calculate "vs Avg" if we have aggregate stats and the function
    let vsAvgValue: number | null = null;
    let vsAvgDiff: number | null = null;
    if (aggregateStats && metric.getAvgFromStats) {
      vsAvgValue = metric.getAvgFromStats(aggregateStats);
      if (vsAvgValue !== null) {
        // Calculate average of selected apps
        const validValues = values.filter((v): v is number => v !== null);
        if (validValues.length > 0) {
          const selectedAvg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
          vsAvgDiff = calculatePercentDiff(selectedAvg, vsAvgValue);
        }
      }
    }

    // Find best/worst
    const { bestIndex, worstIndex } = findBestWorstIndices(values, metric.higherIsBetter);

    return {
      metricId: metric.id,
      label: metric.label,
      category: metric.category,
      values,
      formattedValues,
      percentDiffs,
      vsAvgValue,
      vsAvgDiff,
      bestIndex,
      worstIndex,
      higherIsBetter: metric.higherIsBetter,
    };
  });
}

/**
 * Group metrics by category for display
 */
export function groupMetricsByCategory(
  rows: CompareMetricRow[]
): Record<CompareCategory, CompareMetricRow[]> {
  const groups: Record<CompareCategory, CompareMetricRow[]> = {
    engagement: [],
    reviews: [],
    growth: [],
    financial: [],
  };

  for (const row of rows) {
    if (groups[row.category]) {
      groups[row.category].push(row);
    }
  }

  return groups;
}

/**
 * Category labels for display
 */
export const CATEGORY_LABELS: Record<CompareCategory, string> = {
  engagement: 'Engagement',
  reviews: 'Reviews',
  growth: 'Growth',
  financial: 'Financial',
};

/**
 * Format percent diff for display
 */
export function formatPercentDiff(diff: number | null): string {
  if (diff === null) return '—';
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(0)}%`;
}
