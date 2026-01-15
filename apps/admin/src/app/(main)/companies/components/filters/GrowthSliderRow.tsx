'use client';

import { useCallback, useMemo } from 'react';
import { DualRangeSlider } from './DualRangeSlider';

export interface GrowthFilterValues {
  minGrowth7d?: number;
  maxGrowth7d?: number;
  minGrowth30d?: number;
  maxGrowth30d?: number;
}

interface GrowthSliderRowProps {
  filters: GrowthFilterValues;
  onChange: (field: keyof GrowthFilterValues, value: number | undefined) => void;
  onPresetClick: (preset: 'growing' | 'declining' | 'stable', period: '7d' | '30d') => void;
  disabled?: boolean;
}

type GrowthPreset = 'growing' | 'declining' | 'stable' | null;

function formatGrowthPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${Math.round(value)}`;
}

// Detect which preset is active based on current values
function detectActivePreset(
  min: number | undefined,
  max: number | undefined
): GrowthPreset {
  // Growing: min >= 10, no max
  if (min === 10 && max === undefined) return 'growing';
  // Declining: max <= -10, no min
  if (max === -10 && min === undefined) return 'declining';
  // Stable: min = -10, max = 10
  if (min === -10 && max === 10) return 'stable';
  return null;
}

interface GrowthPeriodSliderProps {
  label: string;
  period: '7d' | '30d';
  minValue: number | undefined;
  maxValue: number | undefined;
  onMinChange: (value: number | undefined) => void;
  onMaxChange: (value: number | undefined) => void;
  onPresetClick: (preset: 'growing' | 'declining' | 'stable', period: '7d' | '30d') => void;
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
    (preset: 'growing' | 'declining' | 'stable') => {
      onPresetClick(preset, period);
    },
    [onPresetClick, period]
  );

  const presetButtonClasses = (preset: GrowthPreset) => `
    px-2.5 py-1 rounded text-caption font-medium
    transition-colors duration-150
    ${activePreset === preset
      ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
      : 'bg-surface-overlay text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
    }
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
  `;

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
        <button
          type="button"
          onClick={() => handlePresetClick('growing')}
          disabled={disabled}
          className={presetButtonClasses('growing')}
        >
          <span className="text-trend-positive mr-1">↑</span>
          Growing
        </button>
        <button
          type="button"
          onClick={() => handlePresetClick('declining')}
          disabled={disabled}
          className={presetButtonClasses('declining')}
        >
          <span className="text-trend-negative mr-1">↓</span>
          Declining
        </button>
        <button
          type="button"
          onClick={() => handlePresetClick('stable')}
          disabled={disabled}
          className={presetButtonClasses('stable')}
        >
          <span className="text-trend-neutral mr-1">→</span>
          Stable
        </button>
      </div>
    </div>
  );
}

export function GrowthSliderRow({
  filters,
  onChange,
  onPresetClick,
  disabled = false,
}: GrowthSliderRowProps) {
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

  return (
    <div className="space-y-4">
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
    </div>
  );
}
