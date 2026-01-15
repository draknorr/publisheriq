'use client';

import { QUICK_FILTERS } from '../lib/companies-presets';
import type { QuickFilterId } from '../lib/companies-types';

interface QuickFiltersProps {
  activeFilters: QuickFilterId[];
  onToggle: (filterId: QuickFilterId) => void;
  disabled?: boolean;
}

export function QuickFilters({ activeFilters, onToggle, disabled = false }: QuickFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_FILTERS.map((filter) => {
        const isActive = activeFilters.includes(filter.id);

        return (
          <button
            key={filter.id}
            onClick={() => onToggle(filter.id)}
            disabled={disabled}
            title={filter.description}
            className={`
              px-3 py-1.5 rounded-md text-body-sm font-medium transition-all
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              ${
                isActive
                  ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/40 shadow-sm'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-overlay border border-border-subtle'
              }
            `}
          >
            {filter.emoji && <span className="mr-1">{filter.emoji}</span>}
            {filter.label}
          </button>
        );
      })}

      {activeFilters.length > 0 && (
        <span className="px-2 py-1.5 text-body-sm text-text-muted">
          {activeFilters.length} filter{activeFilters.length !== 1 ? 's' : ''} active
        </span>
      )}
    </div>
  );
}
