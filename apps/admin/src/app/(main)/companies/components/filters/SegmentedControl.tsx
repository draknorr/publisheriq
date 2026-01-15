'use client';

import { useCallback } from 'react';
import type { TimePeriod } from '../../lib/companies-types';

interface SegmentedControlProps {
  value: TimePeriod | undefined;
  onChange: (value: TimePeriod | undefined) => void;
  disabled?: boolean;
}

interface SegmentOption {
  value: TimePeriod;
  label: string;
  group: 'years' | 'rolling';
}

const SEGMENT_OPTIONS: SegmentOption[] = [
  { value: 'all', label: 'All Time', group: 'years' },
  { value: '2025', label: '2025', group: 'years' },
  { value: '2024', label: '2024', group: 'years' },
  { value: '2023', label: '2023', group: 'years' },
  { value: 'last_12mo', label: '12mo', group: 'rolling' },
  { value: 'last_6mo', label: '6mo', group: 'rolling' },
  { value: 'last_90d', label: '90d', group: 'rolling' },
  { value: 'last_30d', label: '30d', group: 'rolling' },
];

export function SegmentedControl({
  value,
  onChange,
  disabled = false,
}: SegmentedControlProps) {
  const activeValue = value ?? 'all';

  const handleClick = useCallback(
    (segmentValue: TimePeriod) => {
      if (disabled) return;
      // Selecting 'all' clears the filter (returns undefined)
      onChange(segmentValue === 'all' ? undefined : segmentValue);
    },
    [onChange, disabled]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center bg-surface-overlay rounded-lg p-1">
        {SEGMENT_OPTIONS.map((option, index) => {
          const isActive = activeValue === option.value;

          // Add visual separator between years and rolling periods
          const isGroupBoundary = index > 0 && option.group !== SEGMENT_OPTIONS[index - 1]?.group;

          return (
            <div key={option.value} className="flex items-center">
              {/* Group divider */}
              {isGroupBoundary && (
                <div className="w-px h-5 bg-border-subtle mx-0.5" />
              )}

              <button
                type="button"
                onClick={() => handleClick(option.value)}
                disabled={disabled}
                className={`
                  relative px-3 py-1.5 rounded-md text-body-sm font-medium
                  transition-all duration-150
                  ${isActive
                    ? 'bg-surface text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated/50'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {option.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
