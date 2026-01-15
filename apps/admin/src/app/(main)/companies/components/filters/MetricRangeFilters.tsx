'use client';

import { RangeInput } from './RangeInput';

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

interface MetricRangeFiltersProps {
  filters: MetricFilters;
  onChange: (field: keyof MetricFilters, value: number | undefined) => void;
  disabled?: boolean;
}

/**
 * Grid of metric range filters for the advanced filters panel
 */
export function MetricRangeFilters({
  filters,
  onChange,
  disabled = false,
}: MetricRangeFiltersProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <RangeInput
        label="Game Count"
        minValue={filters.minGames}
        maxValue={filters.maxGames}
        onMinChange={(v) => onChange('minGames', v)}
        onMaxChange={(v) => onChange('maxGames', v)}
        minPlaceholder="1"
        maxPlaceholder="500+"
        disabled={disabled}
      />

      <RangeInput
        label="Total Owners"
        minValue={filters.minOwners}
        maxValue={filters.maxOwners}
        onMinChange={(v) => onChange('minOwners', v)}
        onMaxChange={(v) => onChange('maxOwners', v)}
        minPlaceholder="0"
        maxPlaceholder="1B+"
        disabled={disabled}
      />

      <RangeInput
        label="Peak CCU"
        minValue={filters.minCcu}
        maxValue={filters.maxCcu}
        onMinChange={(v) => onChange('minCcu', v)}
        onMaxChange={(v) => onChange('maxCcu', v)}
        minPlaceholder="0"
        maxPlaceholder="10M+"
        disabled={disabled}
      />

      <RangeInput
        label="Est. Weekly Hours"
        minValue={filters.minHours}
        maxValue={filters.maxHours}
        onMinChange={(v) => onChange('minHours', v)}
        onMaxChange={(v) => onChange('maxHours', v)}
        minPlaceholder="0"
        maxPlaceholder="100M+"
        disabled={disabled}
      />

      <RangeInput
        label="Est. Revenue (cents)"
        minValue={filters.minRevenue}
        maxValue={filters.maxRevenue}
        onMinChange={(v) => onChange('minRevenue', v)}
        onMaxChange={(v) => onChange('maxRevenue', v)}
        minPlaceholder="0"
        maxPlaceholder="$1B+"
        disabled={disabled}
      />

      <RangeInput
        label="Review Score"
        minValue={filters.minScore}
        maxValue={filters.maxScore}
        onMinChange={(v) => onChange('minScore', v)}
        onMaxChange={(v) => onChange('maxScore', v)}
        minPlaceholder="0"
        maxPlaceholder="100"
        suffix="%"
        disabled={disabled}
      />

      <RangeInput
        label="Total Reviews"
        minValue={filters.minReviews}
        maxValue={filters.maxReviews}
        onMinChange={(v) => onChange('minReviews', v)}
        onMaxChange={(v) => onChange('maxReviews', v)}
        minPlaceholder="0"
        maxPlaceholder="10M+"
        disabled={disabled}
      />
    </div>
  );
}
