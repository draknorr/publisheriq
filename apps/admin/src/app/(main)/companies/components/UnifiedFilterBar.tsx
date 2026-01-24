'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Download, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FilterPill } from './FilterPill';
import { ColumnSelector } from './ColumnSelector';
import { SavedViews } from './SavedViews';
import { UNIFIED_FILTERS, type UnifiedFilter } from '../lib/companies-presets';
import type { ColumnId, CompanyType, SortField, SortOrder, PresetId, QuickFilterId } from '../lib/companies-types';
import type { AdvancedFiltersState } from '../hooks/useCompaniesFilters';
import type { SavedView } from '../lib/companies-types';

interface UnifiedFilterBarProps {
  // Filter state
  activePreset: PresetId | null;
  activeQuickFilters: QuickFilterId[];

  // Filter actions
  onSelectPreset: (presetId: string) => void;
  onClearPreset: () => void;
  onToggleQuickFilter: (filterId: QuickFilterId) => void;
  onClearAll: () => void;

  // Tools - Column Selector
  visibleColumns: ColumnId[];
  onColumnsChange: (columns: ColumnId[]) => void;
  companyType: CompanyType;

  // Tools - Saved Views
  currentFilters: AdvancedFiltersState;
  currentSort: SortField;
  currentOrder: SortOrder;
  onApplyView: (view: SavedView) => void;

  // Tools - Export
  onExport: () => void;
  canExport: boolean;

  // Command Palette
  onOpenPalette?: () => void;

  // State
  hasActiveFilters: boolean;
  disabled?: boolean;
}

/**
 * Unified filter bar combining presets, quick filters, and tools.
 *
 * Layout:
 * - Left: Scrollable filter pills (presets first, then quick filters)
 * - Right: Clear button + Tools (Columns, Saved Views, Export)
 */
export function UnifiedFilterBar({
  activePreset,
  activeQuickFilters,
  onSelectPreset,
  onClearPreset,
  onToggleQuickFilter,
  onClearAll,
  visibleColumns,
  onColumnsChange,
  companyType,
  currentFilters,
  currentSort,
  currentOrder,
  onApplyView,
  onExport,
  canExport,
  onOpenPalette,
  hasActiveFilters,
  disabled,
}: UnifiedFilterBarProps) {
  // Scroll state for arrow indicators
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll state
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  // Update on mount and resize
  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('scroll', updateScrollState);
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState]);

  const scrollBy = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === 'left' ? -200 : 200;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const handleFilterClick = (filter: UnifiedFilter) => {
    if (filter.type === 'preset') {
      // If this preset is already active, clear it
      if (activePreset === filter.id) {
        onClearPreset();
      } else {
        onSelectPreset(filter.id);
      }
    } else {
      // Toggle quick filter
      onToggleQuickFilter(filter.id as QuickFilterId);
    }
  };

  const isFilterActive = (filter: UnifiedFilter): boolean => {
    if (filter.type === 'preset') {
      return activePreset === filter.id;
    }
    return activeQuickFilters.includes(filter.id as QuickFilterId);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Command Palette Trigger */}
      {onOpenPalette && (
        <button
          onClick={onOpenPalette}
          disabled={disabled}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-body-sm font-medium
                     transition-colors flex-shrink-0 border
                     bg-surface-elevated text-text-secondary border-border-subtle
                     hover:border-border-prominent hover:bg-surface-overlay
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          <kbd className="hidden sm:inline-flex ml-1 px-1.5 py-0.5 text-[10px] font-medium
                          bg-surface-sunken rounded border border-border-muted text-text-muted">
            ⌘K
          </kbd>
        </button>
      )}

      {/* Scrollable filter pills with arrow indicators */}
      <div className="flex-1 flex items-center gap-1 min-w-0">
        {/* Left scroll arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scrollBy('left')}
            className="flex-shrink-0 p-1 text-text-muted hover:text-text-primary transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Scrollable container */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto scrollbar-none"
        >
          <div className="flex items-center gap-2">
            {UNIFIED_FILTERS.map((filter) => (
              <FilterPill
                key={filter.id}
                label={filter.label}
                emoji={filter.emoji}
                tooltip={filter.tooltip}
                isActive={isFilterActive(filter)}
                isPreset={filter.type === 'preset'}
                onClick={() => handleFilterClick(filter)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>

        {/* Right scroll arrow */}
        {canScrollRight && (
          <button
            onClick={() => scrollBy('right')}
            className="flex-shrink-0 p-1 text-text-muted hover:text-text-primary transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Right: Clear + Tools */}
      <div className="flex items-center gap-2 flex-shrink-0 border-l border-border-subtle pl-3">
        {/* Clear all filters */}
        {hasActiveFilters && (
          <button
            onClick={onClearAll}
            disabled={disabled}
            className="px-2 py-1.5 text-body-sm text-accent-red hover:text-accent-red/80
                       transition-colors whitespace-nowrap disabled:opacity-50"
          >
            Clear
          </button>
        )}

        {/* Column Selector */}
        <ColumnSelector
          visibleColumns={visibleColumns}
          onChange={onColumnsChange}
          disabled={disabled}
          companyType={companyType}
        />

        {/* Saved Views */}
        <SavedViews
          currentFilters={currentFilters}
          currentSort={currentSort}
          currentOrder={currentOrder}
          currentType={companyType}
          currentColumns={visibleColumns}
          onApplyView={onApplyView}
          disabled={disabled}
        />

        {/* Export Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onExport}
          disabled={disabled || !canExport}
          className="gap-1.5"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </div>
    </div>
  );
}
