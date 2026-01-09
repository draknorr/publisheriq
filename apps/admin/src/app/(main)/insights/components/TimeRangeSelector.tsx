'use client';

import type { TimeRange } from '../lib/insights-types';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
  disabled?: boolean;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

export function TimeRangeSelector({ value, onChange, disabled = false }: TimeRangeSelectorProps) {
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-surface-elevated rounded-lg border border-border-subtle">
      {TIME_RANGES.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          disabled={disabled}
          className={`
            px-3 py-1.5 rounded-md text-body-sm font-medium
            transition-all duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            ${
              value === range.value
                ? 'bg-surface-raised text-text-primary shadow-subtle'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay'
            }
          `}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
