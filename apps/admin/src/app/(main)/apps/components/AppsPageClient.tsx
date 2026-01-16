'use client';

import { X, Filter, ChevronDown } from 'lucide-react';
import { ToastProvider } from '@/components/ui/Toast';
import { PageHeader } from '@/components/layout';
import { AppTypeToggle } from './AppTypeToggle';
import { AppsTable } from './AppsTable';
import { SearchBar } from './SearchBar';
import { PresetViews } from './PresetViews';
import { QuickFilters } from './QuickFilters';
import { AdvancedFiltersPanel } from './AdvancedFiltersPanel';
import { useAppsFilters } from '../hooks/useAppsFilters';
import type { App, AppType, SortField, SortOrder, AggregateStats } from '../lib/apps-types';
import { formatCompactNumber } from '../lib/apps-queries';

interface AppsPageClientProps {
  initialData: App[];
  initialType: AppType;
  initialSort: SortField;
  initialOrder: SortOrder;
  initialSearch: string;
  aggregateStats: AggregateStats;
}

export function AppsPageClient(props: AppsPageClientProps) {
  return (
    <ToastProvider>
      <AppsPageClientInner {...props} />
    </ToastProvider>
  );
}

function AppsPageClientInner({
  initialData,
  aggregateStats,
}: AppsPageClientProps) {
  // Unified filter state management
  const {
    isPending,
    type,
    sort,
    order,
    search,
    activePreset,
    activeQuickFilters,
    hasActiveFilters,
    // M4a: Advanced filters state
    advancedFilters,
    advancedFilterCount,
    isAdvancedOpen,
    // Actions
    setType,
    setSort,
    setSearch,
    toggleQuickFilter,
    applyPreset,
    clearPreset,
    clearAllFilters,
    // M4a: Advanced filter actions
    setAdvancedFilter,
    clearAdvancedFilters,
    applyGrowthPreset,
    applySentimentPreset,
    toggleAdvanced,
  } = useAppsFilters();

  // Get the display label based on current type
  const getTypeLabel = (): string => {
    switch (type) {
      case 'all':
        return 'Apps';
      case 'game':
        return 'Games';
      case 'dlc':
        return 'DLC';
      case 'demo':
        return 'Demos';
      default:
        return 'Games';
    }
  };

  return (
    <div className={`space-y-4 ${isPending ? 'opacity-60' : ''}`}>
      {/* Page Header */}
      <PageHeader
        title="Games"
        description="Browse and analyze Steam games, DLC, and demos"
      />

      {/* Row 1: Type Toggle + Result Count */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <AppTypeToggle
          value={type}
          onChange={setType}
          disabled={isPending}
        />

        {/* Result count + Clear button */}
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              disabled={isPending}
              className="flex items-center gap-1 px-2 py-1 text-body-sm text-accent-red hover:text-accent-red/80 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Clear all
            </button>
          )}
          <div className="text-body text-text-secondary">
            {getTypeLabel()} ({formatCompactNumber(aggregateStats.total_games)})
          </div>
        </div>
      </div>

      {/* Row 2: Search Bar */}
      <SearchBar
        initialValue={search}
        onSearch={setSearch}
        isPending={isPending}
        disabled={isPending}
      />

      {/* Row 3: Preset Views */}
      <div>
        <div className="text-caption text-text-muted mb-2">Presets</div>
        <PresetViews
          activePreset={activePreset}
          onSelectPreset={applyPreset}
          onClearPreset={clearPreset}
          disabled={isPending}
        />
      </div>

      {/* Row 4: Quick Filters */}
      <div>
        <div className="text-caption text-text-muted mb-2">Quick Filters</div>
        <QuickFilters
          activeFilters={activeQuickFilters}
          onToggle={toggleQuickFilter}
          disabled={isPending}
        />
      </div>

      {/* Row 5: Advanced Filters Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleAdvanced}
          disabled={isPending}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-md text-body-sm font-medium
            transition-colors duration-150
            ${
              isAdvancedOpen
                ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/30'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-muted hover:border-border-prominent'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <Filter className="w-4 h-4" />
          Advanced Filters
          {advancedFilterCount > 0 && (
            <span className="px-1.5 py-0.5 bg-accent-primary text-white text-caption rounded-full min-w-[20px] text-center">
              {advancedFilterCount}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isAdvancedOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* Row 6: Advanced Filters Panel (collapsible) */}
      {isAdvancedOpen && (
        <AdvancedFiltersPanel
          filters={advancedFilters}
          activeCount={advancedFilterCount}
          onFilterChange={setAdvancedFilter}
          onClearAll={clearAdvancedFilters}
          onGrowthPreset={applyGrowthPreset}
          onSentimentPreset={applySentimentPreset}
          disabled={isPending}
        />
      )}

      {/* Apps Table */}
      <AppsTable
        apps={initialData}
        sortField={sort}
        sortOrder={order}
        onSort={setSort}
      />
    </div>
  );
}
