'use client';

import { useCallback } from 'react';
import { RangeInput } from './RangeInput';

export interface GrowthFilterValues {
  minGrowth7d?: number;
  maxGrowth7d?: number;
  minGrowth30d?: number;
  maxGrowth30d?: number;
}

type GrowthPreset = 'growing' | 'declining' | 'stable';

interface GrowthFiltersProps {
  filters: GrowthFilterValues;
  onChange: (field: keyof GrowthFilterValues, value: number | undefined) => void;
  onPresetClick: (preset: GrowthPreset, period: '7d' | '30d') => void;
  disabled?: boolean;
}

/**
 * Determine which preset is active based on current filter values
 */
function getActivePreset(
  min: number | undefined,
  max: number | undefined
): GrowthPreset | null {
  if (min === 10 && max === undefined) return 'growing';
  if (min === undefined && max === -10) return 'declining';
  if (min === -10 && max === 10) return 'stable';
  return null;
}

interface PresetButtonProps {
  label: string;
  preset: GrowthPreset;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function PresetButton({ label, isActive, onClick, disabled }: PresetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        px-2.5 py-1 rounded text-caption font-medium transition-all
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${
          isActive
            ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/40'
            : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-overlay border border-border-subtle'
        }
      `}
    >
      {label}
    </button>
  );
}

/**
 * Growth range filters with quick presets
 */
export function GrowthFilters({
  filters,
  onChange,
  onPresetClick,
  disabled = false,
}: GrowthFiltersProps) {
  const active7d = getActivePreset(filters.minGrowth7d, filters.maxGrowth7d);
  const active30d = getActivePreset(filters.minGrowth30d, filters.maxGrowth30d);

  const handlePreset7d = useCallback(
    (preset: GrowthPreset) => {
      onPresetClick(preset, '7d');
    },
    [onPresetClick]
  );

  const handlePreset30d = useCallback(
    (preset: GrowthPreset) => {
      onPresetClick(preset, '30d');
    },
    [onPresetClick]
  );

  return (
    <div className="space-y-4">
      {/* 7-day Growth */}
      <div className="space-y-2">
        <RangeInput
          label="CCU Growth (7d)"
          minValue={filters.minGrowth7d}
          maxValue={filters.maxGrowth7d}
          onMinChange={(v) => onChange('minGrowth7d', v)}
          onMaxChange={(v) => onChange('maxGrowth7d', v)}
          minPlaceholder="-100"
          maxPlaceholder="500+"
          suffix="%"
          disabled={disabled}
        />
        <div className="flex gap-2">
          <PresetButton
            label="Growing >10%"
            preset="growing"
            isActive={active7d === 'growing'}
            onClick={() => handlePreset7d('growing')}
            disabled={disabled}
          />
          <PresetButton
            label="Declining <-10%"
            preset="declining"
            isActive={active7d === 'declining'}
            onClick={() => handlePreset7d('declining')}
            disabled={disabled}
          />
          <PresetButton
            label="Stable"
            preset="stable"
            isActive={active7d === 'stable'}
            onClick={() => handlePreset7d('stable')}
            disabled={disabled}
          />
        </div>
      </div>

      {/* 30-day Growth */}
      <div className="space-y-2">
        <RangeInput
          label="CCU Growth (30d)"
          minValue={filters.minGrowth30d}
          maxValue={filters.maxGrowth30d}
          onMinChange={(v) => onChange('minGrowth30d', v)}
          onMaxChange={(v) => onChange('maxGrowth30d', v)}
          minPlaceholder="-100"
          maxPlaceholder="500+"
          suffix="%"
          disabled={disabled}
        />
        <div className="flex gap-2">
          <PresetButton
            label="Growing >10%"
            preset="growing"
            isActive={active30d === 'growing'}
            onClick={() => handlePreset30d('growing')}
            disabled={disabled}
          />
          <PresetButton
            label="Declining <-10%"
            preset="declining"
            isActive={active30d === 'declining'}
            onClick={() => handlePreset30d('declining')}
            disabled={disabled}
          />
          <PresetButton
            label="Stable"
            preset="stable"
            isActive={active30d === 'stable'}
            onClick={() => handlePreset30d('stable')}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
