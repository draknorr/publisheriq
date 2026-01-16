'use client';

import type { QuickFilterId } from '../lib/apps-types';
import { QUICK_FILTERS } from '../lib/apps-presets';

interface QuickFiltersProps {
  activeFilters: QuickFilterId[];
  onToggle: (filterId: QuickFilterId) => void;
  disabled?: boolean;
}

/**
 * Toggle buttons for quick filters
 * Quick filters are stackable (AND logic) - multiple can be active
 */
export function QuickFilters({
  activeFilters,
  onToggle,
  disabled = false,
}: QuickFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {QUICK_FILTERS.map((filter) => {
        const isActive = activeFilters.includes(filter.id);

        return (
          <button
            key={filter.id}
            onClick={() => onToggle(filter.id)}
            disabled={disabled}
            title={filter.description}
            className={`
              px-3 py-1.5 rounded-md text-body-sm font-medium
              transition-colors whitespace-nowrap
              focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
              ${
                isActive
                  ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/30'
                  : 'bg-surface-elevated text-text-secondary border border-border-subtle hover:border-border-prominent hover:text-text-primary'
              }
            `}
          >
            {filter.label}
          </button>
        );
      })}

      {/* Active filter count indicator */}
      {activeFilters.length > 1 && (
        <span className="px-2 py-1 text-caption text-text-muted">
          {activeFilters.length} active
        </span>
      )}
    </div>
  );
}
