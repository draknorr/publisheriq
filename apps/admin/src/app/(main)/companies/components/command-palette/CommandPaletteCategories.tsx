'use client';

/**
 * Command Palette Categories View for Companies
 *
 * Category selection for filtering companies by game features.
 * Features:
 * - Back navigation to Home View
 * - Category search
 * - Selected categories bar
 * - Grid layout with counts
 */

import { useRef, useEffect, useState, useMemo } from 'react';
import {
  ChevronLeft,
  Search,
  X,
  Loader2,
  Check,
} from 'lucide-react';
import type { UseCommandPaletteReturn } from '../../hooks/useCommandPalette';
import type { FilterOption } from '../../lib/companies-types';

// ============================================================================
// Types
// ============================================================================

interface CommandPaletteCategoriesProps {
  palette: UseCommandPaletteReturn;
  categoryOptions: FilterOption[];
  isLoading?: boolean;
  onOpen?: () => void;
  onDone: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function CommandPaletteCategories({
  palette,
  categoryOptions,
  isLoading = false,
  onOpen,
  onDone,
}: CommandPaletteCategoriesProps) {
  const {
    state,
    goBack,
    toggleCategory,
    clearCategories,
  } = palette;
  const { selectedCategories } = state;

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load categories when opened
  useEffect(() => {
    if (categoryOptions.length === 0 && onOpen) {
      onOpen();
    }
  }, [categoryOptions.length, onOpen]);

  // Focus search on mount
  useEffect(() => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  }, []);

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categoryOptions;

    const query = searchQuery.toLowerCase();
    return categoryOptions.filter((cat) =>
      cat.option_name.toLowerCase().includes(query)
    );
  }, [categoryOptions, searchQuery]);

  // Get selected category names for display
  const selectedCategoryNames = useMemo(() => {
    return selectedCategories
      .map((id) => categoryOptions.find((c) => c.option_id === id)?.option_name)
      .filter(Boolean) as string[];
  }, [selectedCategories, categoryOptions]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border-subtle">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={goBack}
              className="p-1.5 rounded-md hover:bg-surface-elevated transition-colors"
              aria-label="Back to home"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-body font-semibold text-text-primary">Categories</h2>
              <p className="text-caption text-text-muted">
                {selectedCategories.length > 0
                  ? `${selectedCategories.length} selected`
                  : 'Filter companies by Steam categories'}
              </p>
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter categories..."
            className="w-full pl-10 pr-4 py-2 rounded-lg
                       bg-surface-elevated border border-border-subtle
                       text-body text-text-primary placeholder:text-text-muted
                       focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
          />
        </div>
      </div>

      {/* Selected Categories Bar */}
      {selectedCategories.length > 0 && (
        <div className="px-4 py-2 border-b border-border-subtle bg-surface-elevated/50">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {selectedCategoryNames.slice(0, 5).map((name, index) => (
              <span
                key={selectedCategories[index]}
                className="flex items-center gap-1 px-2 py-1 rounded-md
                           bg-accent-primary/20 text-accent-primary text-caption
                           whitespace-nowrap"
              >
                {name}
                <button
                  onClick={() => toggleCategory(selectedCategories[index])}
                  className="hover:bg-accent-primary/20 rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedCategories.length > 5 && (
              <span className="text-caption text-text-muted whitespace-nowrap">
                +{selectedCategories.length - 5} more
              </span>
            )}
            <button
              onClick={clearCategories}
              className="text-caption text-accent-red hover:underline whitespace-nowrap ml-auto"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-body text-text-muted">No categories found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredCategories.map((category) => {
              const isSelected = selectedCategories.includes(category.option_id);
              return (
                <button
                  key={category.option_id}
                  onClick={() => toggleCategory(category.option_id)}
                  className={`
                    flex items-center justify-between px-3 py-2 rounded-md
                    text-left text-body-sm transition-colors
                    ${isSelected
                      ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                      : 'bg-surface-elevated border border-border-subtle hover:border-border-prominent text-text-primary'
                    }
                  `}
                >
                  <span className="truncate">{category.option_name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-caption text-text-muted">
                      {formatCount(category.company_count)}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border-subtle bg-surface-elevated/50">
        <div className="flex items-center justify-between">
          <span className="text-caption text-text-muted">
            {selectedCategories.length} categor{selectedCategories.length !== 1 ? 'ies' : 'y'} selected
          </span>
          <button
            onClick={onDone}
            className="px-4 py-2 rounded-lg bg-accent-primary text-white text-body-sm font-medium
                       hover:bg-accent-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`;
  }
  return count.toString();
}
