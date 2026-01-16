'use client';

import { useCallback, useMemo } from 'react';
import { DualRangeSlider } from './DualRangeSlider';

/**
 * Growth filter values for Apps page
 */
export interface GrowthFilterValues {
  minGrowth7d?: number;
  maxGrowth7d?: number;
  minGrowth30d?: number;
  maxGrowth30d?: number;
  minMomentum?: number;
  maxMomentum?: number;
}

export type GrowthPreset = 'growing' | 'declining' | 'stable';

interface GrowthFiltersProps {
  filters: GrowthFilterValues;
  onChange: (field: keyof GrowthFilterValues, value: number | undefined) => void;
  onPresetClick: (preset: GrowthPreset, period: '7d' | '30d') => void;
  disabled?: boolean;
}

/**
 * Format growth percentage with sign
 */
function formatGrowthPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${Math.round(value)}`;
}

/**
 * Format momentum score
 */
function formatMomentum(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${Math.round(value)}`;
}

/**
 * Detect which preset is active based on current values
 */
function detectActivePreset(
  min: number | undefined,
  max: number | undefined
): GrowthPreset | null {
  // Growing: min >= 10, no max
  if (min === 10 && max === undefined) return 'growing';
  // Declining: max <= -10, no min
  if (max === -10 && min === undefined) return 'declining';
  // Stable: min = -10, max = 10
  if (min === -10 && max === 10) return 'stable';
  return null;
}

/**
 * Preset button component
 */
interface PresetButtonProps {
  preset: GrowthPreset;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function PresetButton({ preset, isActive, onClick, disabled }: PresetButtonProps) {
  const baseClasses = `
    px-2.5 py-1 rounded text-caption font-medium
    transition-colors duration-150
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
  `;

  const activeClasses = isActive
    ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
    : 'bg-surface-overlay text-text-secondary hover:bg-surface-elevated hover:text-text-primary';

  const icons: Record<GrowthPreset, string> = {
    growing: '↑',
    declining: '↓',
    stable: '→',
  };

  const colors: Record<GrowthPreset, string> = {
    growing: 'text-trend-positive',
    declining: 'text-trend-negative',
    stable: 'text-trend-neutral',
  };

  const labels: Record<GrowthPreset, string> = {
    growing: 'Growing',
    declining: 'Declining',
    stable: 'Stable',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${activeClasses}`}
    >
      <span className={`${colors[preset]} mr-1`}>{icons[preset]}</span>
      {labels[preset]}
    </button>
  );
}

/**
 * Growth period slider with presets
 */
interface GrowthPeriodSliderProps {
  label: string;
  period: '7d' | '30d';
  minValue: number | undefined;
  maxValue: number | undefined;
  onMinChange: (value: number | undefined) => void;
  onMaxChange: (value: number | undefined) => void;
  onPresetClick: (preset: GrowthPreset, period: '7d' | '30d') => void;
  disabled?: boolean;
}

function GrowthPeriodSlider({
  label,
  period,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  onPresetClick,
  disabled = false,
}: GrowthPeriodSliderProps) {
  const activePreset = useMemo(
    () => detectActivePreset(minValue, maxValue),
    [minValue, maxValue]
  );

  const handlePresetClick = useCallback(
    (preset: GrowthPreset) => {
      onPresetClick(preset, period);
    },
    [onPresetClick, period]
  );

  return (
    <div className="space-y-2">
      <DualRangeSlider
        label={label}
        minValue={minValue}
        maxValue={maxValue}
        onMinChange={onMinChange}
        onMaxChange={onMaxChange}
        absoluteMin={-100}
        absoluteMax={500}
        scale="linear"
        formatValue={formatGrowthPercent}
        suffix="%"
        disabled={disabled}
      />

      {/* Preset chips */}
      <div className="flex items-center gap-2">
        <PresetButton
          preset="growing"
          isActive={activePreset === 'growing'}
          onClick={() => handlePresetClick('growing')}
          disabled={disabled}
        />
        <PresetButton
          preset="declining"
          isActive={activePreset === 'declining'}
          onClick={() => handlePresetClick('declining')}
          disabled={disabled}
        />
        <PresetButton
          preset="stable"
          isActive={activePreset === 'stable'}
          onClick={() => handlePresetClick('stable')}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

/**
 * Growth filters component for Apps page advanced filters
 * Includes: CCU Growth 7d, CCU Growth 30d, Momentum Score
 */
export function GrowthFilters({
  filters,
  onChange,
  onPresetClick,
  disabled = false,
}: GrowthFiltersProps) {
  // Create handlers for each slider
  const handleMinChange7d = useCallback(
    (value: number | undefined) => onChange('minGrowth7d', value),
    [onChange]
  );
  const handleMaxChange7d = useCallback(
    (value: number | undefined) => onChange('maxGrowth7d', value),
    [onChange]
  );
  const handleMinChange30d = useCallback(
    (value: number | undefined) => onChange('minGrowth30d', value),
    [onChange]
  );
  const handleMaxChange30d = useCallback(
    (value: number | undefined) => onChange('maxGrowth30d', value),
    [onChange]
  );
  const handleMinMomentum = useCallback(
    (value: number | undefined) => onChange('minMomentum', value),
    [onChange]
  );
  const handleMaxMomentum = useCallback(
    (value: number | undefined) => onChange('maxMomentum', value),
    [onChange]
  );

  return (
    <div className="space-y-4">
      {/* CCU Growth 7d with presets */}
      <GrowthPeriodSlider
        label="CCU Growth (7d)"
        period="7d"
        minValue={filters.minGrowth7d}
        maxValue={filters.maxGrowth7d}
        onMinChange={handleMinChange7d}
        onMaxChange={handleMaxChange7d}
        onPresetClick={onPresetClick}
        disabled={disabled}
      />

      {/* CCU Growth 30d with presets */}
      <GrowthPeriodSlider
        label="CCU Growth (30d)"
        period="30d"
        minValue={filters.minGrowth30d}
        maxValue={filters.maxGrowth30d}
        onMinChange={handleMinChange30d}
        onMaxChange={handleMaxChange30d}
        onPresetClick={onPresetClick}
        disabled={disabled}
      />

      {/* Momentum Score (no presets) */}
      <DualRangeSlider
        label="Momentum Score"
        minValue={filters.minMomentum}
        maxValue={filters.maxMomentum}
        onMinChange={handleMinMomentum}
        onMaxChange={handleMaxMomentum}
        absoluteMin={-50}
        absoluteMax={100}
        scale="linear"
        formatValue={formatMomentum}
        disabled={disabled}
      />
    </div>
  );
}
