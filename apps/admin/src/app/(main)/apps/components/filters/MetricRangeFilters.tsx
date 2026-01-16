'use client';

import { useCallback } from 'react';
import { DualRangeSlider } from './DualRangeSlider';

/**
 * Metric filter values for Apps page
 */
export interface MetricFilters {
  minCcu?: number;
  maxCcu?: number;
  minOwners?: number;
  maxOwners?: number;
  minReviews?: number;
  maxReviews?: number;
  minScore?: number;
  maxScore?: number;
  minPrice?: number;
  maxPrice?: number;
  minPlaytime?: number;
  maxPlaytime?: number;
}

interface MetricRangeFiltersProps {
  filters: MetricFilters;
  onChange: (field: keyof MetricFilters, value: number | undefined) => void;
  disabled?: boolean;
}

/**
 * Format large numbers compactly (e.g., 1.2M, 500K)
 */
function formatCompact(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return value.toString();
}

/**
 * Format price in dollars (stored as cents)
 */
function formatPrice(cents: number): string {
  return `${(cents / 100).toFixed(0)}`;
}

/**
 * Format percentage
 */
function formatPercent(value: number): string {
  return `${value}`;
}

/**
 * Format hours
 */
function formatHours(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

/**
 * Metric range sliders for the Apps page advanced filters
 * 6 sliders: CCU, Owners, Reviews, Score, Price, Playtime
 */
export function MetricRangeFilters({
  filters,
  onChange,
  disabled = false,
}: MetricRangeFiltersProps) {
  // Create typed handlers
  const handleMinCcu = useCallback(
    (value: number | undefined) => onChange('minCcu', value),
    [onChange]
  );
  const handleMaxCcu = useCallback(
    (value: number | undefined) => onChange('maxCcu', value),
    [onChange]
  );
  const handleMinOwners = useCallback(
    (value: number | undefined) => onChange('minOwners', value),
    [onChange]
  );
  const handleMaxOwners = useCallback(
    (value: number | undefined) => onChange('maxOwners', value),
    [onChange]
  );
  const handleMinReviews = useCallback(
    (value: number | undefined) => onChange('minReviews', value),
    [onChange]
  );
  const handleMaxReviews = useCallback(
    (value: number | undefined) => onChange('maxReviews', value),
    [onChange]
  );
  const handleMinScore = useCallback(
    (value: number | undefined) => onChange('minScore', value),
    [onChange]
  );
  const handleMaxScore = useCallback(
    (value: number | undefined) => onChange('maxScore', value),
    [onChange]
  );
  const handleMinPrice = useCallback(
    (value: number | undefined) => onChange('minPrice', value),
    [onChange]
  );
  const handleMaxPrice = useCallback(
    (value: number | undefined) => onChange('maxPrice', value),
    [onChange]
  );
  const handleMinPlaytime = useCallback(
    (value: number | undefined) => onChange('minPlaytime', value),
    [onChange]
  );
  const handleMaxPlaytime = useCallback(
    (value: number | undefined) => onChange('maxPlaytime', value),
    [onChange]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Peak CCU - logarithmic scale */}
      <DualRangeSlider
        label="Peak CCU"
        minValue={filters.minCcu}
        maxValue={filters.maxCcu}
        onMinChange={handleMinCcu}
        onMaxChange={handleMaxCcu}
        absoluteMin={0}
        absoluteMax={500000}
        scale="log"
        formatValue={formatCompact}
        disabled={disabled}
      />

      {/* Owners - logarithmic scale */}
      <DualRangeSlider
        label="Owners"
        minValue={filters.minOwners}
        maxValue={filters.maxOwners}
        onMinChange={handleMinOwners}
        onMaxChange={handleMaxOwners}
        absoluteMin={0}
        absoluteMax={100000000}
        scale="log"
        formatValue={formatCompact}
        disabled={disabled}
      />

      {/* Reviews - logarithmic scale */}
      <DualRangeSlider
        label="Reviews"
        minValue={filters.minReviews}
        maxValue={filters.maxReviews}
        onMinChange={handleMinReviews}
        onMaxChange={handleMaxReviews}
        absoluteMin={0}
        absoluteMax={1000000}
        scale="log"
        formatValue={formatCompact}
        disabled={disabled}
      />

      {/* Score - linear scale with % suffix */}
      <DualRangeSlider
        label="Score"
        minValue={filters.minScore}
        maxValue={filters.maxScore}
        onMinChange={handleMinScore}
        onMaxChange={handleMaxScore}
        absoluteMin={0}
        absoluteMax={100}
        scale="linear"
        formatValue={formatPercent}
        suffix="%"
        disabled={disabled}
      />

      {/* Price - linear scale with $ prefix (stored in cents) */}
      <DualRangeSlider
        label="Price"
        minValue={filters.minPrice}
        maxValue={filters.maxPrice}
        onMinChange={handleMinPrice}
        onMaxChange={handleMaxPrice}
        absoluteMin={0}
        absoluteMax={6000}
        scale="linear"
        formatValue={formatPrice}
        prefix="$"
        disabled={disabled}
      />

      {/* Playtime - logarithmic scale with hrs suffix */}
      <DualRangeSlider
        label="Playtime"
        minValue={filters.minPlaytime}
        maxValue={filters.maxPlaytime}
        onMinChange={handleMinPlaytime}
        onMaxChange={handleMaxPlaytime}
        absoluteMin={0}
        absoluteMax={10000}
        scale="log"
        formatValue={formatHours}
        suffix="hrs"
        disabled={disabled}
      />
    </div>
  );
}
