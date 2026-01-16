'use client';

import { useCallback, useMemo } from 'react';
import { DualRangeSlider } from './DualRangeSlider';

/**
 * Velocity tier options
 */
export type VelocityTier = 'high' | 'medium' | 'low' | 'dormant';

/**
 * Sentiment filter values for Apps page
 */
export interface SentimentFilterValues {
  minSentimentDelta?: number;
  maxSentimentDelta?: number;
  velocityTier?: VelocityTier;
}

export type SentimentPreset = 'improving' | 'stable' | 'declining' | 'bombing';

interface SentimentFiltersProps {
  filters: SentimentFilterValues;
  onChange: (field: keyof SentimentFilterValues, value: number | string | undefined) => void;
  onPresetClick: (preset: SentimentPreset) => void;
  disabled?: boolean;
}

/**
 * Format sentiment delta percentage with sign
 */
function formatSentimentPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}`;
}

/**
 * Detect which preset is active based on current values
 */
function detectActivePreset(
  min: number | undefined,
  max: number | undefined
): SentimentPreset | null {
  // Improving: min >= 3, no max
  if (min === 3 && max === undefined) return 'improving';
  // Stable: min = -3, max = 3
  if (min === -3 && max === 3) return 'stable';
  // Declining: max <= -3, no min
  if (max === -3 && min === undefined) return 'declining';
  // Bombing: max <= -10, no min
  if (max === -10 && min === undefined) return 'bombing';
  return null;
}

/**
 * Velocity tier labels
 */
const VELOCITY_TIER_OPTIONS: { value: VelocityTier; label: string; description: string }[] = [
  { value: 'high', label: 'High', description: '5+ reviews/day' },
  { value: 'medium', label: 'Medium', description: '1-5 reviews/day' },
  { value: 'low', label: 'Low', description: '0.1-1 reviews/day' },
  { value: 'dormant', label: 'Dormant', description: '<0.1 reviews/day' },
];

/**
 * Sentiment filters component for Apps page advanced filters
 * Includes: Sentiment Delta slider with presets, Velocity Tier dropdown
 */
export function SentimentFilters({
  filters,
  onChange,
  onPresetClick,
  disabled = false,
}: SentimentFiltersProps) {
  const activePreset = useMemo(
    () => detectActivePreset(filters.minSentimentDelta, filters.maxSentimentDelta),
    [filters.minSentimentDelta, filters.maxSentimentDelta]
  );

  const handleMinChange = useCallback(
    (value: number | undefined) => onChange('minSentimentDelta', value),
    [onChange]
  );

  const handleMaxChange = useCallback(
    (value: number | undefined) => onChange('maxSentimentDelta', value),
    [onChange]
  );

  const handleVelocityChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value as VelocityTier | '';
      onChange('velocityTier', value || undefined);
    },
    [onChange]
  );

  const presetButtonClasses = (preset: SentimentPreset) => {
    const isActive = activePreset === preset;
    return `
      px-2.5 py-1 rounded text-caption font-medium
      transition-colors duration-150
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      ${
        isActive
          ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
          : 'bg-surface-overlay text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
      }
    `;
  };

  return (
    <div className="space-y-4">
      {/* Sentiment Delta slider */}
      <div className="space-y-2">
        <DualRangeSlider
          label="Sentiment Delta"
          minValue={filters.minSentimentDelta}
          maxValue={filters.maxSentimentDelta}
          onMinChange={handleMinChange}
          onMaxChange={handleMaxChange}
          absoluteMin={-20}
          absoluteMax={20}
          scale="linear"
          formatValue={formatSentimentPercent}
          suffix="%"
          disabled={disabled}
        />

        {/* Preset chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onPresetClick('improving')}
            disabled={disabled}
            className={presetButtonClasses('improving')}
          >
            <span className="text-trend-positive mr-1">⬆</span>
            Improving
          </button>
          <button
            type="button"
            onClick={() => onPresetClick('stable')}
            disabled={disabled}
            className={presetButtonClasses('stable')}
          >
            <span className="text-trend-neutral mr-1">→</span>
            Stable
          </button>
          <button
            type="button"
            onClick={() => onPresetClick('declining')}
            disabled={disabled}
            className={presetButtonClasses('declining')}
          >
            <span className="text-trend-negative mr-1">⬇</span>
            Declining
          </button>
          <button
            type="button"
            onClick={() => onPresetClick('bombing')}
            disabled={disabled}
            className={presetButtonClasses('bombing')}
          >
            <span className="text-accent-red mr-1">💣</span>
            Bombing
          </button>
        </div>
      </div>

      {/* Velocity Tier dropdown */}
      <div className="space-y-2">
        <label className="text-body-sm font-medium text-text-secondary">
          Velocity Tier
        </label>
        <select
          value={filters.velocityTier || ''}
          onChange={handleVelocityChange}
          disabled={disabled}
          className={`
            w-full h-9 px-3 rounded
            bg-surface-elevated border border-border-muted
            text-body-sm text-text-primary
            transition-colors duration-150
            hover:border-border-prominent
            focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <option value="">All Tiers</option>
          {VELOCITY_TIER_OPTIONS.map((tier) => (
            <option key={tier.value} value={tier.value}>
              {tier.label} ({tier.description})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
