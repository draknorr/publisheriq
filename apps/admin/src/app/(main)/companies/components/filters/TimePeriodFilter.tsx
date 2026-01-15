'use client';

import type { TimePeriod } from '../../lib/companies-types';
import { Clock } from 'lucide-react';

interface TimePeriodOption {
  value: TimePeriod;
  label: string;
}

const PERIOD_OPTIONS: TimePeriodOption[] = [
  { value: 'all', label: 'All Time' },
  { value: '2025', label: '2025' },
  { value: '2024', label: '2024' },
  { value: '2023', label: '2023' },
  { value: 'last_12mo', label: 'Last 12mo' },
  { value: 'last_6mo', label: 'Last 6mo' },
  { value: 'last_90d', label: 'Last 90d' },
  { value: 'last_30d', label: 'Last 30d' },
];

interface TimePeriodFilterProps {
  value: TimePeriod | undefined;
  onChange: (period: TimePeriod | undefined) => void;
  disabled?: boolean;
}

/**
 * Time period toggle buttons for filtering by release date
 */
export function TimePeriodFilter({
  value,
  onChange,
  disabled = false,
}: TimePeriodFilterProps) {
  const currentValue = value ?? 'all';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="block text-body-sm font-medium text-text-secondary">
          Time Period
        </label>
        {currentValue !== 'all' && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent-yellow/15 text-accent-yellow text-caption">
            <Clock className="h-3 w-3" />
            Coming soon
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PERIOD_OPTIONS.map((option) => {
          const isActive = currentValue === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                onChange(option.value === 'all' ? undefined : option.value)
              }
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
              {option.label}
            </button>
          );
        })}
      </div>
      {currentValue !== 'all' && (
        <p className="text-caption text-text-muted">
          Period filtering will be available in a future update.
        </p>
      )}
    </div>
  );
}
