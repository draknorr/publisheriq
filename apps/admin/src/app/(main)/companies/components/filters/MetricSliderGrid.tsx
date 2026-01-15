'use client';

import { useCallback } from 'react';
import { DualRangeSlider } from './DualRangeSlider';

export interface MetricFilters {
  minGames?: number;
  maxGames?: number;
  minOwners?: number;
  maxOwners?: number;
  minCcu?: number;
  maxCcu?: number;
  minHours?: number;
  maxHours?: number;
  minRevenue?: number;
  maxRevenue?: number;
  minScore?: number;
  maxScore?: number;
  minReviews?: number;
  maxReviews?: number;
}

interface MetricSliderGridProps {
  filters: MetricFilters;
  onChange: (field: keyof MetricFilters, value: number | undefined) => void;
  disabled?: boolean;
}

// Value formatters for different metric types
function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return value.toString();
}

function formatRevenue(value: number): string {
  // Revenue is stored in cents
  const dollars = value / 100;
  if (dollars >= 1_000_000_000) return `$${(dollars / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return `$${dollars.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}`;
}

function formatGameCount(value: number): string {
  return value.toString();
}

// Parse revenue input (handles "$5M" -> cents)
function parseRevenueInput(input: string): number | undefined {
  if (!input.trim()) return undefined;
  const cleaned = input.replace(/[$,]/g, '').trim().toLowerCase();
  const suffixMatch = cleaned.match(/^([\d.]+)\s*([kmb]?)$/);
  if (!suffixMatch) {
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num * 100; // Convert to cents
  }
  const [, numStr, suffix] = suffixMatch;
  const num = parseFloat(numStr);
  if (isNaN(num)) return undefined;
  let dollars = num;
  switch (suffix) {
    case 'k': dollars = num * 1_000; break;
    case 'm': dollars = num * 1_000_000; break;
    case 'b': dollars = num * 1_000_000_000; break;
  }
  return dollars * 100; // Convert to cents
}

// Metric configurations
const METRIC_CONFIGS = {
  gameCount: {
    label: 'Game Count',
    absoluteMin: 0,
    absoluteMax: 500,
    scale: 'linear' as const,
    formatValue: formatGameCount,
  },
  owners: {
    label: 'Total Owners',
    absoluteMin: 0,
    absoluteMax: 1_000_000_000,
    scale: 'log' as const,
    formatValue: formatCompact,
  },
  ccu: {
    label: 'Peak CCU',
    absoluteMin: 0,
    absoluteMax: 10_000_000,
    scale: 'log' as const,
    formatValue: formatCompact,
  },
  hours: {
    label: 'Est. Weekly Hours',
    absoluteMin: 0,
    absoluteMax: 100_000_000,
    scale: 'log' as const,
    formatValue: formatCompact,
  },
  revenue: {
    label: 'Est. Revenue',
    absoluteMin: 0,
    absoluteMax: 100_000_000_000, // $1B in cents
    scale: 'log' as const,
    formatValue: formatRevenue,
    parseInput: parseRevenueInput,
    prefix: '$',
  },
  score: {
    label: 'Review Score',
    absoluteMin: 0,
    absoluteMax: 100,
    scale: 'linear' as const,
    formatValue: formatPercent,
    suffix: '%',
  },
  reviews: {
    label: 'Total Reviews',
    absoluteMin: 0,
    absoluteMax: 10_000_000,
    scale: 'log' as const,
    formatValue: formatCompact,
  },
};

export function MetricSliderGrid({
  filters,
  onChange,
  disabled = false,
}: MetricSliderGridProps) {
  const handleChange = useCallback(
    (field: keyof MetricFilters) => (value: number | undefined) => {
      onChange(field, value);
    },
    [onChange]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Game Count */}
      <DualRangeSlider
        label={METRIC_CONFIGS.gameCount.label}
        minValue={filters.minGames}
        maxValue={filters.maxGames}
        onMinChange={handleChange('minGames')}
        onMaxChange={handleChange('maxGames')}
        absoluteMin={METRIC_CONFIGS.gameCount.absoluteMin}
        absoluteMax={METRIC_CONFIGS.gameCount.absoluteMax}
        scale={METRIC_CONFIGS.gameCount.scale}
        formatValue={METRIC_CONFIGS.gameCount.formatValue}
        disabled={disabled}
      />

      {/* Total Owners */}
      <DualRangeSlider
        label={METRIC_CONFIGS.owners.label}
        minValue={filters.minOwners}
        maxValue={filters.maxOwners}
        onMinChange={handleChange('minOwners')}
        onMaxChange={handleChange('maxOwners')}
        absoluteMin={METRIC_CONFIGS.owners.absoluteMin}
        absoluteMax={METRIC_CONFIGS.owners.absoluteMax}
        scale={METRIC_CONFIGS.owners.scale}
        formatValue={METRIC_CONFIGS.owners.formatValue}
        disabled={disabled}
      />

      {/* Peak CCU */}
      <DualRangeSlider
        label={METRIC_CONFIGS.ccu.label}
        minValue={filters.minCcu}
        maxValue={filters.maxCcu}
        onMinChange={handleChange('minCcu')}
        onMaxChange={handleChange('maxCcu')}
        absoluteMin={METRIC_CONFIGS.ccu.absoluteMin}
        absoluteMax={METRIC_CONFIGS.ccu.absoluteMax}
        scale={METRIC_CONFIGS.ccu.scale}
        formatValue={METRIC_CONFIGS.ccu.formatValue}
        disabled={disabled}
      />

      {/* Weekly Hours */}
      <DualRangeSlider
        label={METRIC_CONFIGS.hours.label}
        minValue={filters.minHours}
        maxValue={filters.maxHours}
        onMinChange={handleChange('minHours')}
        onMaxChange={handleChange('maxHours')}
        absoluteMin={METRIC_CONFIGS.hours.absoluteMin}
        absoluteMax={METRIC_CONFIGS.hours.absoluteMax}
        scale={METRIC_CONFIGS.hours.scale}
        formatValue={METRIC_CONFIGS.hours.formatValue}
        disabled={disabled}
      />

      {/* Revenue */}
      <DualRangeSlider
        label={METRIC_CONFIGS.revenue.label}
        minValue={filters.minRevenue}
        maxValue={filters.maxRevenue}
        onMinChange={handleChange('minRevenue')}
        onMaxChange={handleChange('maxRevenue')}
        absoluteMin={METRIC_CONFIGS.revenue.absoluteMin}
        absoluteMax={METRIC_CONFIGS.revenue.absoluteMax}
        scale={METRIC_CONFIGS.revenue.scale}
        formatValue={METRIC_CONFIGS.revenue.formatValue}
        parseInput={METRIC_CONFIGS.revenue.parseInput}
        disabled={disabled}
      />

      {/* Review Score */}
      <DualRangeSlider
        label={METRIC_CONFIGS.score.label}
        minValue={filters.minScore}
        maxValue={filters.maxScore}
        onMinChange={handleChange('minScore')}
        onMaxChange={handleChange('maxScore')}
        absoluteMin={METRIC_CONFIGS.score.absoluteMin}
        absoluteMax={METRIC_CONFIGS.score.absoluteMax}
        scale={METRIC_CONFIGS.score.scale}
        formatValue={METRIC_CONFIGS.score.formatValue}
        suffix="%"
        disabled={disabled}
      />

      {/* Total Reviews */}
      <DualRangeSlider
        label={METRIC_CONFIGS.reviews.label}
        minValue={filters.minReviews}
        maxValue={filters.maxReviews}
        onMinChange={handleChange('minReviews')}
        onMaxChange={handleChange('maxReviews')}
        absoluteMin={METRIC_CONFIGS.reviews.absoluteMin}
        absoluteMax={METRIC_CONFIGS.reviews.absoluteMax}
        scale={METRIC_CONFIGS.reviews.scale}
        formatValue={METRIC_CONFIGS.reviews.formatValue}
        disabled={disabled}
      />
    </div>
  );
}
