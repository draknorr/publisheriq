'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, Filter, ChevronDown, Loader2 } from 'lucide-react';
import { ToastProvider } from '@/components/ui/Toast';
import { PageHeader } from '@/components/layout';
import { AppTypeToggle } from './AppTypeToggle';
import { AppsTable } from './AppsTable';
import { SearchBar } from './SearchBar';
import { PresetViews } from './PresetViews';
import { QuickFilters } from './QuickFilters';
import { AdvancedFiltersPanel } from './AdvancedFiltersPanel';
import { SavedViews } from './SavedViews';
import { ColumnSelector } from './ColumnSelector';
import { SummaryStatsBar } from './SummaryStatsBar';
import { DataFreshnessFooter } from './DataFreshnessFooter';
import { BulkActionsBar } from './BulkActionsBar';
import { CompareMode } from './CompareMode';
import { ExportDialog } from './ExportDialog';
import { useAppsFilters } from '../hooks/useAppsFilters';
import { useFilterCounts } from '../hooks/useFilterCounts';
import { useSavedViews, type SavedView } from '../hooks/useSavedViews';
import { useSparklineLoader } from '../hooks/useSparklineLoader';
import { useAppsSelection } from '../hooks/useAppsSelection';
import { useAppsCompare } from '../hooks/useAppsCompare';
import { useAppsQuery, buildFilterParamsFromUrl, DEFAULT_AGGREGATE_STATS } from '../hooks/useAppsQuery';
import type { App, AppType, SortField, SortOrder, AggregateStats } from '../lib/apps-types';
import type { FilterDescription } from '../lib/apps-export';
import { formatCompactNumber } from '../lib/apps-queries';

interface AppsPageClientProps {
  initialData: App[];
  initialType: AppType;
  initialSort: SortField;
  initialOrder: SortOrder;
  initialSearch: string;
  aggregateStats: AggregateStats;
  // M6a: Compare mode
  compareApps?: App[];
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
  aggregateStats: serverAggregateStats,
  compareApps = [],
}: AppsPageClientProps) {
  // Router for client-side navigation
  const router = useRouter();
  const searchParams = useSearchParams();

  // Build filter params from current URL for React Query
  const filterParams = useMemo(
    () => buildFilterParamsFromUrl(searchParams),
    [searchParams]
  );

  // Fetch apps data using React Query with client-side caching
  const {
    data: queryData,
    isLoading,
    isFetching,
    error,
  } = useAppsQuery(filterParams);

  // Use React Query data if available, otherwise fall back to server data
  const apps = queryData ?? initialData;
  const aggregateStats = serverAggregateStats; // Aggregate stats still from server (could add separate query)

  // M6a: Selection state management
  const selection = useAppsSelection();

  // M6a: Compare state management (URL-persisted)
  const compare = useAppsCompare();

  // M6a: Check if compare is valid (2-5 selected)
  const canCompare = selection.selectedCount >= 2 && selection.selectedCount <= 5;

  // M6b: Export dialog state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'filtered' | 'selected'>('filtered');

  // M6a: Handle opening compare mode
  const handleCompare = useCallback(() => {
    if (canCompare) {
      compare.openCompare(selection.getSelectedAppIds());
    }
  }, [canCompare, compare, selection]);

  // M6b: Handle opening export dialog
  const handleExport = useCallback(() => {
    setExportScope(selection.selectedCount > 0 ? 'selected' : 'filtered');
    setIsExportDialogOpen(true);
  }, [selection.selectedCount]);

  // M6b: Get selected apps for export
  const selectedApps = useMemo(() => {
    const selectedIds = selection.getSelectedAppIds();
    return apps.filter((app) => selectedIds.includes(app.appid));
  }, [apps, selection]);

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
    // M4b: Content filter actions
    setGenres,
    setGenreMode,
    setTags,
    setTagMode,
    setCategories,
    setHasWorkshop,
    // M4b: Platform filter actions
    setPlatforms,
    setPlatformMode,
    setSteamDeck,
    setController,
    // M4b: Release filter actions
    setReleaseYear,
    setMinAge,
    setMaxAge,
    setEarlyAccess,
    setMinHype,
    setMaxHype,
    // M4b: Relationship filter actions
    setPublisherSearch,
    setDeveloperSearch,
    setSelfPublished,
    setPublisherSize,
    setVsPublisher,
    // M4b: Activity filter actions
    setCcuTier,
    // M5a: Column customization
    visibleColumns,
    setVisibleColumns,
  } = useAppsFilters();

  // M6b: Build filter description for export metadata
  const filterDescription: FilterDescription = useMemo(() => ({
    type: type !== 'game' ? type : undefined,
    search: search || undefined,
    preset: activePreset || undefined,
    quickFilters: activeQuickFilters.length > 0 ? activeQuickFilters : undefined,
    minCcu: advancedFilters.minCcu,
    minScore: advancedFilters.minScore,
    minOwners: advancedFilters.minOwners,
    minGrowth7d: advancedFilters.minGrowth7d,
    minMomentum: advancedFilters.minMomentum,
  }), [type, search, activePreset, activeQuickFilters, advancedFilters]);

  // M4b: Filter counts for lazy-loading dropdowns
  const {
    data: filterOptions,
    loading: filterLoading,
    fetchCounts,
  } = useFilterCounts();

  // M4b: Saved views
  const {
    views: savedViews,
    isLoaded: savedViewsLoaded,
    saveView,
    deleteView,
    renameView,
  } = useSavedViews();

  // M5b: Sparkline lazy-loading
  const sparklineLoader = useSparklineLoader();

  // M4b: Memoize context filter object to prevent callback recreation
  const filterCountContext = useMemo(() => ({
    minCcu: advancedFilters.minCcu,
    minReviews: advancedFilters.minReviews,
    minScore: advancedFilters.minScore,
    minOwners: advancedFilters.minOwners,
  }), [
    advancedFilters.minCcu,
    advancedFilters.minReviews,
    advancedFilters.minScore,
    advancedFilters.minOwners,
  ]);

  // M4b: Lazy-load handlers for filter dropdowns
  // BUG-005: Expanded context filters for more accurate counts
  const handleGenreOpen = useCallback(() => {
    fetchCounts('genre', type, filterCountContext);
  }, [fetchCounts, type, filterCountContext]);

  const handleTagOpen = useCallback(() => {
    fetchCounts('tag', type, filterCountContext);
  }, [fetchCounts, type, filterCountContext]);

  const handleCategoryOpen = useCallback(() => {
    fetchCounts('category', type, filterCountContext);
  }, [fetchCounts, type, filterCountContext]);

  // M4b: Save current view handler (M5a: includes columns)
  const handleSaveView = useCallback(
    (name: string) => {
      saveView(name, advancedFilters, visibleColumns, sort, order, type);
    },
    [saveView, advancedFilters, visibleColumns, sort, order, type]
  );

  // M4b: Load saved view handler - reconstructs URL and navigates
  const handleLoadView = useCallback(
    (view: SavedView) => {
      // Build URL params from saved view
      const params = new URLSearchParams();

      if (view.type !== 'game') params.set('type', view.type);
      params.set('sort', view.sort);
      if (view.order !== 'desc') params.set('order', view.order);

      // Apply filter values from saved view
      const f = view.filters;
      if (f.minCcu !== undefined) params.set('minCcu', String(f.minCcu));
      if (f.maxCcu !== undefined) params.set('maxCcu', String(f.maxCcu));
      if (f.minOwners !== undefined) params.set('minOwners', String(f.minOwners));
      if (f.maxOwners !== undefined) params.set('maxOwners', String(f.maxOwners));
      if (f.minReviews !== undefined) params.set('minReviews', String(f.minReviews));
      if (f.maxReviews !== undefined) params.set('maxReviews', String(f.maxReviews));
      if (f.minScore !== undefined) params.set('minScore', String(f.minScore));
      if (f.maxScore !== undefined) params.set('maxScore', String(f.maxScore));
      if (f.minPrice !== undefined) params.set('minPrice', String(f.minPrice));
      if (f.maxPrice !== undefined) params.set('maxPrice', String(f.maxPrice));
      if (f.minPlaytime !== undefined) params.set('minPlaytime', String(f.minPlaytime));
      if (f.maxPlaytime !== undefined) params.set('maxPlaytime', String(f.maxPlaytime));
      if (f.minGrowth7d !== undefined) params.set('minGrowth7d', String(f.minGrowth7d));
      if (f.maxGrowth7d !== undefined) params.set('maxGrowth7d', String(f.maxGrowth7d));
      if (f.minGrowth30d !== undefined) params.set('minGrowth30d', String(f.minGrowth30d));
      if (f.maxGrowth30d !== undefined) params.set('maxGrowth30d', String(f.maxGrowth30d));
      if (f.minMomentum !== undefined) params.set('minMomentum', String(f.minMomentum));
      if (f.maxMomentum !== undefined) params.set('maxMomentum', String(f.maxMomentum));
      if (f.minSentimentDelta !== undefined) params.set('minSentimentDelta', String(f.minSentimentDelta));
      if (f.maxSentimentDelta !== undefined) params.set('maxSentimentDelta', String(f.maxSentimentDelta));
      if (f.velocityTier !== undefined) params.set('velocityTier', f.velocityTier);
      if (f.minActivePct !== undefined) params.set('minActivePct', String(f.minActivePct));
      if (f.minReviewRate !== undefined) params.set('minReviewRate', String(f.minReviewRate));
      if (f.minValueScore !== undefined) params.set('minValueScore', String(f.minValueScore));
      // M4b filters
      if (f.genres && f.genres.length > 0) params.set('genres', f.genres.join(','));
      if (f.genreMode === 'all') params.set('genreMode', 'all');
      if (f.tags && f.tags.length > 0) params.set('tags', f.tags.join(','));
      if (f.tagMode === 'all') params.set('tagMode', 'all');
      if (f.categories && f.categories.length > 0) params.set('categories', f.categories.join(','));
      if (f.hasWorkshop !== undefined) params.set('hasWorkshop', String(f.hasWorkshop));
      if (f.platforms && f.platforms.length > 0) params.set('platforms', f.platforms.join(','));
      if (f.platformMode === 'all') params.set('platformMode', 'all');
      if (f.steamDeck !== undefined) params.set('steamDeck', f.steamDeck);
      if (f.controller !== undefined) params.set('controller', f.controller);
      if (f.minAge !== undefined) params.set('minAge', String(f.minAge));
      if (f.maxAge !== undefined) params.set('maxAge', String(f.maxAge));
      if (f.releaseYear !== undefined) params.set('releaseYear', String(f.releaseYear));
      if (f.earlyAccess !== undefined) params.set('earlyAccess', String(f.earlyAccess));
      if (f.minHype !== undefined) params.set('minHype', String(f.minHype));
      if (f.maxHype !== undefined) params.set('maxHype', String(f.maxHype));
      if (f.publisherSearch !== undefined) params.set('publisherSearch', f.publisherSearch);
      if (f.developerSearch !== undefined) params.set('developerSearch', f.developerSearch);
      if (f.selfPublished !== undefined) params.set('selfPublished', String(f.selfPublished));
      if (f.publisherSize !== undefined) params.set('publisherSize', f.publisherSize);
      if (f.minVsPublisher !== undefined) params.set('minVsPublisher', String(f.minVsPublisher));
      if (f.ccuTier !== undefined) params.set('ccuTier', String(f.ccuTier));

      // M5a: Restore columns from saved view
      if (view.columns && view.columns.length > 0) {
        params.set('columns', view.columns.join(','));
      }

      // Navigate to the constructed URL using client-side routing
      const queryString = params.toString();
      router.push(queryString ? `/apps?${queryString}` : '/apps');
    },
    [router]
  );

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

  // Combined loading state: URL transition OR React Query fetching
  const isLoadingData = isPending || isFetching;

  return (
    <div className={`space-y-4 ${isLoadingData ? 'opacity-60' : ''}`}>
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
          disabled={isLoadingData}
        />

        {/* Result count + Clear button */}
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              disabled={isLoadingData}
              className="flex items-center gap-1 px-2 py-1 text-body-sm text-accent-red hover:text-accent-red/80 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Clear all
            </button>
          )}
          <div className="flex items-center gap-2 text-body text-text-secondary">
            {isFetching && <Loader2 className="w-4 h-4 animate-spin" />}
            {getTypeLabel()} ({formatCompactNumber(aggregateStats.total_games)})
          </div>
        </div>
      </div>

      {/* M5b: Summary Stats Bar */}
      <SummaryStatsBar stats={aggregateStats} isLoading={isFetching} />

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
          disabled={isLoadingData}
        />
      </div>

      {/* Row 4: Quick Filters */}
      <div>
        <div className="text-caption text-text-muted mb-2">Quick Filters</div>
        <QuickFilters
          activeFilters={activeQuickFilters}
          onToggle={toggleQuickFilter}
          disabled={isLoadingData}
        />
      </div>

      {/* Row 5: Advanced Filters Toggle + Saved Views */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleAdvanced}
          disabled={isLoadingData}
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

        {/* M4b: Saved Views dropdown */}
        <SavedViews
          views={savedViews}
          isLoaded={savedViewsLoaded}
          onSave={handleSaveView}
          onLoad={handleLoadView}
          onDelete={deleteView}
          onRename={renameView}
          onReset={clearAllFilters}
          hasActiveFilters={hasActiveFilters || type !== 'game' || sort !== 'ccu_peak' || order !== 'desc'}
          disabled={isLoadingData}
        />

        {/* M5a: Column Selector */}
        <ColumnSelector
          visibleColumns={visibleColumns}
          onChange={setVisibleColumns}
          disabled={isLoadingData}
        />
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
          disabled={isLoadingData}
          // M4b: Content filter props
          genreOptions={filterOptions.genre}
          genreLoading={filterLoading.genre}
          onGenreOpen={handleGenreOpen}
          onGenresChange={setGenres}
          onGenreModeChange={setGenreMode}
          tagOptions={filterOptions.tag}
          tagLoading={filterLoading.tag}
          onTagOpen={handleTagOpen}
          onTagsChange={setTags}
          onTagModeChange={setTagMode}
          categoryOptions={filterOptions.category}
          categoryLoading={filterLoading.category}
          onCategoryOpen={handleCategoryOpen}
          onCategoriesChange={setCategories}
          onWorkshopChange={setHasWorkshop}
          // M4b: Platform filter props
          onPlatformsChange={setPlatforms}
          onPlatformModeChange={setPlatformMode}
          onSteamDeckChange={setSteamDeck}
          onControllerChange={setController}
          // M4b: Release filter props
          onMinAgeChange={setMinAge}
          onMaxAgeChange={setMaxAge}
          onReleaseYearChange={setReleaseYear}
          onEarlyAccessChange={setEarlyAccess}
          onMinHypeChange={setMinHype}
          onMaxHypeChange={setMaxHype}
          // M4b: Relationship filter props
          onPublisherSearchChange={setPublisherSearch}
          onDeveloperSearchChange={setDeveloperSearch}
          onSelfPublishedChange={setSelfPublished}
          onPublisherSizeChange={setPublisherSize}
          onVsPublisherChange={setVsPublisher}
          // M4b: Activity filter props
          onCcuTierChange={setCcuTier}
        />
      )}

      {/* Apps Table */}
      <AppsTable
        apps={apps}
        sortField={sort}
        sortOrder={order}
        onSort={setSort}
        visibleColumns={visibleColumns}
        isLoading={isLoading && !apps.length}
        sparklineLoader={sparklineLoader}
        // M6a: Selection props
        isSelected={selection.isSelected}
        isAllSelected={selection.isAllVisibleSelected(apps)}
        isIndeterminate={selection.isIndeterminate(apps)}
        onSelectApp={(appid, index, shiftKey) =>
          selection.toggleSelection(appid, index, apps, shiftKey)
        }
        onSelectAll={() => selection.toggleAllVisible(apps)}
        // M6b: Empty state props
        hasSearch={!!search}
        hasFilters={advancedFilterCount > 0}
        hasPreset={activePreset}
        onClearFilters={clearAllFilters}
      />

      {/* M5b: Data Freshness Footer */}
      <DataFreshnessFooter
        lastUpdated={apps.length > 0 ? apps[0].data_updated_at : null}
      />

      {/* M6a: Bulk Actions Bar (appears when items are selected) */}
      <BulkActionsBar
        selectedCount={selection.selectedCount}
        canCompare={canCompare}
        onCompare={handleCompare}
        onExport={handleExport}
        onClear={selection.clearSelection}
      />

      {/* M6a: Compare Mode Modal */}
      {compare.isCompareOpen && compareApps.length >= 2 && (
        <CompareMode
          apps={compareApps}
          aggregateStats={aggregateStats}
          onClose={compare.closeCompare}
          onRemove={compare.removeFromCompare}
        />
      )}

      {/* M6b: Export Dialog */}
      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        apps={apps}
        selectedApps={selectedApps}
        visibleColumns={visibleColumns}
        filterDescription={filterDescription}
        defaultScope={exportScope}
      />
    </div>
  );
}
