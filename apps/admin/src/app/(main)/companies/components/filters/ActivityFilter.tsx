'use client';

import type { StatusFilterValue } from '../../lib/companies-types';

interface ActivityFilterProps {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
  disabled?: boolean;
}

const OPTIONS: { id: StatusFilterValue; label: string; description: string }[] = [
  { id: null, label: 'All', description: 'Any activity level' },
  { id: 'active', label: 'Active', description: 'Released game in past year' },
  { id: 'dormant', label: 'Dormant', description: 'No releases in past year' },
];

/**
 * Radio buttons for filtering by activity status (All/Active/Dormant)
 */
export function ActivityFilter({ value, onChange, disabled = false }: ActivityFilterProps) {
  return (
    <div className="space-y-2">
      <label className="block text-body-sm font-medium text-text-secondary">
        Activity Status
      </label>
      <div className="flex gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.id ?? 'all'}
            type="button"
            onClick={() => onChange(option.id)}
            disabled={disabled}
            title={option.description}
            className={`px-3 py-1.5 rounded text-body-sm transition-colors ${
              value === option.id
                ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/40'
                : 'bg-surface-elevated text-text-secondary border border-border-subtle hover:border-border-prominent'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
