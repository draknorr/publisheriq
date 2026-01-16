'use client';

import { useCallback, useState, useRef, useEffect, type ChangeEvent } from 'react';

/**
 * Engagement filter values for Apps page
 */
export interface EngagementFilterValues {
  minActivePct?: number;
  minReviewRate?: number;
  minValueScore?: number;
}

interface EngagementFiltersProps {
  filters: EngagementFilterValues;
  onChange: (field: keyof EngagementFilterValues, value: number | undefined) => void;
  disabled?: boolean;
}

/**
 * Simple min-only slider component for engagement metrics
 */
interface MinSliderProps {
  label: string;
  description: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min: number;
  max: number;
  step?: number;
  formatValue: (value: number) => string;
  suffix?: string;
  disabled?: boolean;
}

function MinSlider({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step = 1,
  formatValue,
  suffix,
  disabled = false,
}: MinSliderProps) {
  const [localValue, setLocalValue] = useState<string>('');
  const inputFocused = useRef(false);

  // State for slider drag - deferred commit on release
  const [localSliderValue, setLocalSliderValue] = useState<number>(min);
  const [isDragging, setIsDragging] = useState(false);

  // Sync local state from props (when not focused/dragging)
  useEffect(() => {
    if (!inputFocused.current) {
      setLocalValue(value !== undefined ? formatValue(value) : '');
    }
  }, [value, formatValue]);

  // Sync slider value from props when not dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalSliderValue(value ?? min);
    }
  }, [value, min, isDragging]);

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setLocalValue(raw);
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        const clamped = Math.max(min, Math.min(max, parsed));
        onChange(clamped);
      } else if (raw === '') {
        onChange(undefined);
      }
    },
    [onChange, min, max]
  );

  // Visual update only during drag - no parent notification
  const handleSliderChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const parsed = parseFloat(e.target.value);
      if (!isNaN(parsed)) {
        setLocalSliderValue(parsed);
        setLocalValue(formatValue(parsed));
      }
    },
    [formatValue]
  );

  // Commit value to parent on drag end
  const handleSliderCommit = useCallback(() => {
    if (localSliderValue > min) {
      onChange(localSliderValue);
    } else {
      onChange(undefined);
    }
    setIsDragging(false);
  }, [localSliderValue, min, onChange]);

  const sliderValue = isDragging ? localSliderValue : (value ?? min);
  const position = ((sliderValue - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      {/* Label with description */}
      <div className="flex items-center justify-between">
        <label className="text-body-sm font-medium text-text-secondary">
          {label}
        </label>
        <span className="text-caption text-text-muted">
          {description}
        </span>
      </div>

      {/* Slider with input */}
      <div className="flex items-center gap-3">
        {/* Min input */}
        <div className="relative">
          <input
            type="text"
            value={localValue}
            onChange={handleInputChange}
            onFocus={() => { inputFocused.current = true; }}
            onBlur={() => {
              inputFocused.current = false;
              setLocalValue(value !== undefined ? formatValue(value) : '');
            }}
            placeholder={formatValue(min)}
            disabled={disabled}
            className={`
              w-16 h-7 px-2 rounded
              bg-surface-elevated border border-border-muted
              text-body-sm text-text-primary text-center
              placeholder:text-text-muted
              transition-colors duration-150
              hover:border-border-prominent
              focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary
              disabled:opacity-50 disabled:cursor-not-allowed
              ${suffix ? 'pr-6' : ''}
            `}
          />
          {suffix && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-body-sm">
              {suffix}
            </span>
          )}
        </div>

        {/* Slider track */}
        <div className="relative flex-1 h-2">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={sliderValue}
            onChange={handleSliderChange}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={handleSliderCommit}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={handleSliderCommit}
            disabled={disabled}
            className={`
              absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer
              [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-surface-overlay
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-accent-primary [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
              [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-surface-overlay
              [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-surface [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-accent-primary [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:shadow-sm
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          />
          {/* Active range highlight */}
          <div
            className="absolute top-0 left-0 h-full bg-accent-primary/40 rounded-full pointer-events-none"
            style={{ width: `${position}%` }}
          />
        </div>

        {/* Max label */}
        <span className="text-caption text-text-muted w-12 text-right">
          {formatValue(max)}
        </span>
      </div>
    </div>
  );
}

/**
 * Engagement filters component for Apps page advanced filters
 * Includes: Active Player %, Review Rate, Value Score
 */
export function EngagementFilters({
  filters,
  onChange,
  disabled = false,
}: EngagementFiltersProps) {
  const handleActivePctChange = useCallback(
    (value: number | undefined) => onChange('minActivePct', value),
    [onChange]
  );

  const handleReviewRateChange = useCallback(
    (value: number | undefined) => onChange('minReviewRate', value),
    [onChange]
  );

  const handleValueScoreChange = useCallback(
    (value: number | undefined) => onChange('minValueScore', value),
    [onChange]
  );

  return (
    <div className="space-y-4">
      {/* Active Player % */}
      <MinSlider
        label="Active Player %"
        description="% of owners currently playing"
        value={filters.minActivePct}
        onChange={handleActivePctChange}
        min={0}
        max={100}
        step={1}
        formatValue={(v) => v.toFixed(0)}
        suffix="%"
        disabled={disabled}
      />

      {/* Review Rate */}
      <MinSlider
        label="Review Rate"
        description="Reviews per 1K owners"
        value={filters.minReviewRate}
        onChange={handleReviewRateChange}
        min={0}
        max={50}
        step={0.5}
        formatValue={(v) => v.toFixed(1)}
        disabled={disabled}
      />

      {/* Value Score */}
      <MinSlider
        label="Value Score"
        description="Hours of play per $"
        value={filters.minValueScore}
        onChange={handleValueScoreChange}
        min={0}
        max={20}
        step={0.5}
        formatValue={(v) => v.toFixed(1)}
        suffix="hrs/$"
        disabled={disabled}
      />
    </div>
  );
}
