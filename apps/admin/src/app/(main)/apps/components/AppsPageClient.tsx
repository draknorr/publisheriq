'use client';

import { useCallback } from 'react';
import { X, Filter, ChevronDown } from 'lucide-react';
import { ToastProvider } from '@/components/ui/Toast';
import { PageHeader } from '@/components/layout';
import { AppTypeToggle } from './AppTypeToggle';
import { AppsTable } from './AppsTable';
import { SearchBar } from './SearchBar';
import { PresetViews } from './PresetViews';
import { QuickFilters } from './QuickFilters';
import { AdvancedFiltersPanel } from './AdvancedFiltersPanel';
import { SavedViews } from './SavedViews';
import { useAppsFilters } from '../hooks/useAppsFilters';
import { useFilterCounts } from '../hooks/useFilterCounts';
import { useSavedViews, type SavedView } from '../hooks/useSavedViews';
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
  } = useAppsFilters();

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

  // M4b: Lazy-load handlers for filter dropdowns
  const handleGenreOpen = useCallback(() => {
    fetchCounts('genre', type, { minCcu: advancedFilters.minCcu });
  }, [fetchCounts, type, advancedFilters.minCcu]);

  const handleTagOpen = useCallback(() => {
    fetchCounts('tag', type, { minCcu: advancedFilters.minCcu });
  }, [fetchCounts, type, advancedFilters.minCcu]);

  const handleCategoryOpen = useCallback(() => {
    fetchCounts('category', type, { minCcu: advancedFilters.minCcu });
  }, [fetchCounts, type, advancedFilters.minCcu]);

  // M4b: Save current view handler
  const handleSaveView = useCallback(
    (name: string) => {
      saveView(name, advancedFilters, undefined, sort, order, type);
    },
    [saveView, advancedFilters, sort, order, type]
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

      // Navigate to the constructed URL
      const queryString = params.toString();
      window.location.href = queryString ? `/apps?${queryString}` : '/apps';
    },
    []
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

      {/* Row 5: Advanced Filters Toggle + Saved Views */}
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

        {/* M4b: Saved Views dropdown */}
        <SavedViews
          views={savedViews}
          isLoaded={savedViewsLoaded}
          onSave={handleSaveView}
          onLoad={handleLoadView}
          onDelete={deleteView}
          onRename={renameView}
          disabled={isPending}
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
          disabled={isPending}
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
        apps={initialData}
        sortField={sort}
        sortOrder={order}
        onSort={setSort}
      />
    </div>
  );
}
