'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { FilterOption } from '../../lib/companies-types';

interface FeatureFilterProps {
  selected: number[];
  options: FilterOption[];
  isLoading: boolean;
  onChange: (ids: number[]) => void;
  onOpen: () => void;
  disabled?: boolean;
}

const DEFAULT_VISIBLE = 12;

/**
 * Checkbox grid for categories/features (Co-op, Steam Workshop, etc.)
 */
export function FeatureFilter({
  selected,
  options,
  isLoading,
  onChange,
  onOpen,
  disabled = false,
}: FeatureFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = useCallback(
    (id: number) => {
      if (selected.includes(id)) {
        onChange(selected.filter((s) => s !== id));
      } else {
        onChange([...selected, id]);
      }
    },
    [selected, onChange]
  );

  const handleExpand = useCallback(() => {
    setIsExpanded(true);
    onOpen();
  }, [onOpen]);

  // Show top items by default, rest when expanded
  const visibleOptions = isExpanded ? options : options.slice(0, DEFAULT_VISIBLE);
  const hasMore = options.length > DEFAULT_VISIBLE;

  return (
    <div className="space-y-2">
      <label className="block text-body-sm font-medium text-text-secondary">
        Features & Categories
        {selected.length > 0 && (
          <span className="ml-2 px-1.5 py-0.5 rounded bg-accent-primary/15 text-accent-primary text-caption">
            {selected.length}
          </span>
        )}
      </label>

      {isLoading ? (
        <div className="py-4 text-center text-body-sm text-text-muted">Loading categories...</div>
      ) : options.length === 0 ? (
        <div className="py-4 text-center text-body-sm text-text-muted">
          <button
            type="button"
            onClick={onOpen}
            disabled={disabled}
            className="text-accent-primary hover:underline"
          >
            Load categories
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {visibleOptions.map((option) => {
              const isChecked = selected.includes(option.option_id);
              return (
                <label
                  key={option.option_id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                    isChecked ? 'bg-accent-primary/10' : 'hover:bg-surface-elevated'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle(option.option_id)}
                    disabled={disabled}
                    className="rounded border-border-muted text-accent-primary focus:ring-accent-primary h-4 w-4"
                  />
                  <span className="text-body-sm text-text-secondary flex-1 truncate">
                    {option.option_name}
                  </span>
                  <span className="text-caption text-text-muted">
                    {option.company_count.toLocaleString()}
                  </span>
                </label>
              );
            })}
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={() => (isExpanded ? setIsExpanded(false) : handleExpand())}
              disabled={disabled}
              className="flex items-center gap-1 text-body-sm text-accent-primary hover:underline"
            >
              {isExpanded ? (
                <>
                  Show less <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  Show {options.length - DEFAULT_VISIBLE} more <ChevronDown className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
