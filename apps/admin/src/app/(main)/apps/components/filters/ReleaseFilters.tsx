'use client';

import { useCallback } from 'react';
import { DualRangeSlider } from './DualRangeSlider';

interface ReleaseFiltersProps {
  minAge: number | undefined;
  maxAge: number | undefined;
  releaseYear: number | undefined;
  earlyAccess: boolean | undefined;
  minHype: number | undefined;
  maxHype: number | undefined;

  onMinAgeChange: (value: number | undefined) => void;
  onMaxAgeChange: (value: number | undefined) => void;
  onReleaseYearChange: (year: number | undefined) => void;
  onEarlyAccessChange: (value: boolean | undefined) => void;
  onMinHypeChange: (value: number | undefined) => void;
  onMaxHypeChange: (value: number | undefined) => void;

  disabled?: boolean;
}

// Get current year for release year presets
const currentYear = new Date().getFullYear();

const PERIOD_PRESETS = [
  { label: '7d', maxAge: 7 },
  { label: '30d', maxAge: 30 },
  { label: '90d', maxAge: 90 },
  { label: '1yr', maxAge: 365 },
];

const YEAR_PRESETS = [
  { label: String(currentYear), year: currentYear },
  { label: String(currentYear - 1), year: currentYear - 1 },
  { label: String(currentYear - 2), year: currentYear - 2 },
];

/**
 * Release filters: Period presets, Age range, Early Access, Hype Duration
 */
export function ReleaseFilters({
  minAge,
  maxAge,
  releaseYear,
  earlyAccess,
  minHype,
  maxHype,
  onMinAgeChange,
  onMaxAgeChange,
  onReleaseYearChange,
  onEarlyAccessChange,
  onMinHypeChange,
  onMaxHypeChange,
  disabled = false,
}: ReleaseFiltersProps) {
  // Handle period preset click
  const handlePeriodPreset = useCallback(
    (presetMaxAge: number) => {
      onMinAgeChange(undefined);
      onMaxAgeChange(presetMaxAge);
      onReleaseYearChange(undefined);
    },
    [onMinAgeChange, onMaxAgeChange, onReleaseYearChange]
  );

  // Handle year preset click
  const handleYearPreset = useCallback(
    (year: number) => {
      onMinAgeChange(undefined);
      onMaxAgeChange(undefined);
      onReleaseYearChange(year);
    },
    [onMinAgeChange, onMaxAgeChange, onReleaseYearChange]
  );

  // Clear all presets
  const handleClearPresets = useCallback(() => {
    onMinAgeChange(undefined);
    onMaxAgeChange(undefined);
    onReleaseYearChange(undefined);
  }, [onMinAgeChange, onMaxAgeChange, onReleaseYearChange]);

  // Check if any preset is active
  const isAnyPresetActive = PERIOD_PRESETS.some((p) => maxAge === p.maxAge && !minAge);
  const isYearPresetActive = YEAR_PRESETS.some((p) => releaseYear === p.year);
  const hasActivePreset = isAnyPresetActive || isYearPresetActive;

  return (
    <div className="space-y-4">
      {/* Period & Year presets */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-body-sm font-medium text-text-secondary">Release Period</label>
          {hasActivePreset && (
            <button
              type="button"
              onClick={handleClearPresets}
              disabled={disabled}
              className="text-caption text-text-muted hover:text-text-secondary"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {PERIOD_PRESETS.map(({ label, maxAge: presetMax }) => {
            const isActive = maxAge === presetMax && !minAge && !releaseYear;
            return (
              <button
                key={label}
                type="button"
                onClick={() => handlePeriodPreset(presetMax)}
                disabled={disabled}
                className={`px-2.5 py-1 text-caption rounded transition-colors ${
                  isActive
                    ? 'bg-accent-primary/20 text-accent-primary'
                    : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {label}
              </button>
            );
          })}
          <span className="border-l border-border-subtle mx-1" />
          {YEAR_PRESETS.map(({ label, year }) => {
            const isActive = releaseYear === year;
            return (
              <button
                key={label}
                type="button"
                onClick={() => handleYearPreset(year)}
                disabled={disabled}
                className={`px-2.5 py-1 text-caption rounded transition-colors ${
                  isActive
                    ? 'bg-accent-primary/20 text-accent-primary'
                    : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Age range slider */}
      <DualRangeSlider
        label="Age (days)"
        minValue={minAge}
        maxValue={maxAge}
        absoluteMin={0}
        absoluteMax={3650}
        scale="linear"
        formatValue={(v) => String(v)}
        suffix="d"
        onMinChange={onMinAgeChange}
        onMaxChange={onMaxAgeChange}
        disabled={disabled}
      />

      {/* Early Access toggle */}
      <div className="flex items-center gap-3">
        <label className="text-body-sm font-medium text-text-secondary">Early Access</label>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onEarlyAccessChange(undefined)}
            disabled={disabled}
            className={`px-2.5 py-1 text-caption rounded transition-colors ${
              earlyAccess === undefined
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Any
          </button>
          <button
            type="button"
            onClick={() => onEarlyAccessChange(true)}
            disabled={disabled}
            className={`px-2.5 py-1 text-caption rounded transition-colors ${
              earlyAccess === true
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Early Access
          </button>
          <button
            type="button"
            onClick={() => onEarlyAccessChange(false)}
            disabled={disabled}
            className={`px-2.5 py-1 text-caption rounded transition-colors ${
              earlyAccess === false
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Released
          </button>
        </div>
      </div>

      {/* Hype Duration range */}
      <div className="space-y-2">
        <label className="text-body-sm font-medium text-text-secondary">Hype Duration (days)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={minHype ?? ''}
            onChange={(e) => onMinHypeChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            placeholder="Min"
            disabled={disabled}
            className="w-20 h-8 px-2 rounded bg-surface-elevated border border-border-muted text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary disabled:opacity-50"
          />
          <span className="text-text-muted">—</span>
          <input
            type="number"
            value={maxHype ?? ''}
            onChange={(e) => onMaxHypeChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            placeholder="Max"
            disabled={disabled}
            className="w-20 h-8 px-2 rounded bg-surface-elevated border border-border-muted text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary disabled:opacity-50"
          />
        </div>
        <p className="text-caption text-text-muted">Days between Steam page creation and release</p>
      </div>
    </div>
  );
}
