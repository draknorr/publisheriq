'use client';

import { useCallback, useState } from 'react';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { MetricSliderGrid, type MetricFilters } from './filters/MetricSliderGrid';
import { GrowthSliderRow, type GrowthFilterValues } from './filters/GrowthSliderRow';
import { SegmentedControl } from './filters/SegmentedControl';
import { GenreTagFilter } from './filters/GenreTagFilter';
import { FeatureFilter } from './filters/FeatureFilter';
import { PlatformFilter } from './filters/PlatformFilter';
import { SteamDeckFilter } from './filters/SteamDeckFilter';
import { RelationshipFilter } from './filters/RelationshipFilter';
import { ActivityFilter } from './filters/ActivityFilter';
import { useFilterCounts } from '../hooks/useFilterCounts';
import type { AdvancedFiltersState } from '../hooks/useCompaniesFilters';
import type {
  TimePeriod,
  CompanyType,
  FilterMode,
  SteamDeckFilterValue,
  RelationshipFilterValue,
  StatusFilterValue,
  PlatformValue,
} from '../lib/companies-types';

interface AdvancedFiltersPanelProps {
  filters: AdvancedFiltersState;
  activeCount: number;
  companyType: CompanyType;
  onFilterChange: (field: keyof AdvancedFiltersState, value: number | string | undefined) => void;
  onClearAll: () => void;
  onGrowthPreset: (preset: 'growing' | 'declining' | 'stable', period: '7d' | '30d') => void;
  // M4b handlers
  onGenresChange: (ids: number[]) => void;
  onGenreModeChange: (mode: FilterMode) => void;
  onTagsChange: (ids: number[]) => void;
  onCategoriesChange: (ids: number[]) => void;
  onSteamDeckChange: (value: SteamDeckFilterValue) => void;
  onPlatformsChange: (platforms: PlatformValue[]) => void;
  onPlatformModeChange: (mode: FilterMode) => void;
  onStatusChange: (status: StatusFilterValue) => void;
  onRelationshipChange: (relationship: RelationshipFilterValue) => void;
  disabled?: boolean;
}

/**
 * Unified grid-based advanced filters panel with dual-range sliders
 * Dashboard Pro aesthetic - balanced density, clear hierarchy
 */
export function AdvancedFiltersPanel({
  filters,
  activeCount,
  companyType,
  onFilterChange,
  onClearAll,
  onGrowthPreset,
  onGenresChange,
  onGenreModeChange,
  onTagsChange,
  onCategoriesChange,
  onSteamDeckChange,
  onPlatformsChange,
  onPlatformModeChange,
  onStatusChange,
  onRelationshipChange,
  disabled = false,
}: AdvancedFiltersPanelProps) {
  const [timePeriodExpanded, setTimePeriodExpanded] = useState(false);
  const { data: filterOptions, loading: filterLoading, fetchCounts } = useFilterCounts();

  // Build contextual filters for count queries
  const contextFilters = {
    minGames: filters.minGames,
    minRevenue: filters.minRevenue,
    status: filters.status,
  };

  const handleMetricChange = useCallback(
    (field: keyof MetricFilters, value: number | undefined) => {
      onFilterChange(field, value);
    },
    [onFilterChange]
  );

  const handleGrowthChange = useCallback(
    (field: keyof GrowthFilterValues, value: number | undefined) => {
      onFilterChange(field, value);
    },
    [onFilterChange]
  );

  const handlePeriodChange = useCallback(
    (period: TimePeriod | undefined) => {
      onFilterChange('period', period);
    },
    [onFilterChange]
  );

  // Lazy load handlers for content filters
  const handleGenreOpen = useCallback(() => {
    fetchCounts('genre', companyType, contextFilters);
  }, [fetchCounts, companyType, contextFilters]);

  const handleTagOpen = useCallback(() => {
    fetchCounts('tag', companyType, contextFilters);
  }, [fetchCounts, companyType, contextFilters]);

  const handleCategoryOpen = useCallback(() => {
    fetchCounts('category', companyType, contextFilters);
  }, [fetchCounts, companyType, contextFilters]);

  const metricFilters: MetricFilters = {
    minGames: filters.minGames,
    maxGames: filters.maxGames,
    minOwners: filters.minOwners,
    maxOwners: filters.maxOwners,
    minCcu: filters.minCcu,
    maxCcu: filters.maxCcu,
    minHours: filters.minHours,
    maxHours: filters.maxHours,
    minRevenue: filters.minRevenue,
    maxRevenue: filters.maxRevenue,
    minScore: filters.minScore,
    maxScore: filters.maxScore,
    minReviews: filters.minReviews,
    maxReviews: filters.maxReviews,
  };

  const growthFilters: GrowthFilterValues = {
    minGrowth7d: filters.minGrowth7d,
    maxGrowth7d: filters.maxGrowth7d,
    minGrowth30d: filters.minGrowth30d,
    maxGrowth30d: filters.maxGrowth30d,
  };

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-raised">
      {/* Header - shows clear button when filters active */}
      {activeCount > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle bg-surface-overlay/30">
          <span className="text-body-sm font-medium text-text-secondary">
            {activeCount} filter{activeCount !== 1 ? 's' : ''} active
          </span>
          <button
            type="button"
            onClick={onClearAll}
            disabled={disabled}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-caption font-medium text-accent-red hover:bg-accent-red/10 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear all
          </button>
        </div>
      )}

      {/* Unified Grid Layout */}
      <div className="p-4">
        {/* Row 1: Metrics + Growth */}
        <div className="grid grid-cols-12 gap-6">
          {/* Metric Ranges - 8 columns */}
          <div className="col-span-12 lg:col-span-8">
            <h4 className="text-caption font-medium text-text-muted uppercase tracking-wide mb-3">
              Metric Ranges
            </h4>
            <MetricSliderGrid
              filters={metricFilters}
              onChange={handleMetricChange}
              disabled={disabled}
            />
          </div>

          {/* Growth Filters - 4 columns */}
          <div className="col-span-12 lg:col-span-4">
            <h4 className="text-caption font-medium text-text-muted uppercase tracking-wide mb-3">
              Growth
            </h4>
            <GrowthSliderRow
              filters={growthFilters}
              onChange={handleGrowthChange}
              onPresetClick={onGrowthPreset}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border-subtle my-6" />

        {/* Row 2: Content + Platform/Deck */}
        <div className="grid grid-cols-12 gap-6">
          {/* Content Filters - 8 columns */}
          <div className="col-span-12 lg:col-span-8">
            <h4 className="text-caption font-medium text-text-muted uppercase tracking-wide mb-3">
              Content
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <GenreTagFilter
                label="Genres"
                filterType="genre"
                selected={filters.genres ?? []}
                mode={filters.genreMode ?? 'any'}
                options={filterOptions.genre}
                isLoading={filterLoading.genre}
                onSelect={onGenresChange}
                onModeChange={onGenreModeChange}
                onOpen={handleGenreOpen}
                disabled={disabled}
              />
              <GenreTagFilter
                label="Tags"
                filterType="tag"
                selected={filters.tags ?? []}
                mode="any"
                options={filterOptions.tag}
                isLoading={filterLoading.tag}
                onSelect={onTagsChange}
                onModeChange={() => {}}
                onOpen={handleTagOpen}
                disabled={disabled}
              />
            </div>
            <div className="mt-4">
              <FeatureFilter
                selected={filters.categories ?? []}
                options={filterOptions.category}
                isLoading={filterLoading.category}
                onChange={onCategoriesChange}
                onOpen={handleCategoryOpen}
                disabled={disabled}
              />
            </div>
          </div>

          {/* Platform & Steam Deck - 4 columns */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div>
              <h4 className="text-caption font-medium text-text-muted uppercase tracking-wide mb-3">
                Platform & Compatibility
              </h4>
              <PlatformFilter
                selected={filters.platforms ?? []}
                mode={filters.platformMode ?? 'any'}
                onSelect={onPlatformsChange}
                onModeChange={onPlatformModeChange}
                disabled={disabled}
              />
            </div>
            <SteamDeckFilter
              value={filters.steamDeck ?? null}
              onChange={onSteamDeckChange}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border-subtle my-6" />

        {/* Row 3: Relationship & Activity */}
        <div>
          <h4 className="text-caption font-medium text-text-muted uppercase tracking-wide mb-3">
            Relationship & Activity
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RelationshipFilter
              value={filters.relationship ?? null}
              companyType={companyType}
              onChange={onRelationshipChange}
              disabled={disabled}
            />
            <ActivityFilter
              value={filters.status ?? null}
              onChange={onStatusChange}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border-subtle my-6" />

        {/* Row 4: Time Period - Collapsible, Coming Soon */}
        <div>
          <button
            type="button"
            onClick={() => setTimePeriodExpanded(!timePeriodExpanded)}
            className="flex items-center gap-2 w-full text-left group"
          >
            <span className="text-text-muted transition-transform duration-200">
              {timePeriodExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>
            <h4 className="text-caption font-medium text-text-muted uppercase tracking-wide group-hover:text-text-secondary transition-colors">
              Time Period
            </h4>
            <span className="px-2 py-0.5 rounded-full text-caption-sm font-medium bg-accent-yellow/15 text-accent-yellow">
              Coming Soon
            </span>
          </button>

          {timePeriodExpanded && (
            <div className="mt-3 pl-6">
              <SegmentedControl
                value={filters.period}
                onChange={handlePeriodChange}
                disabled={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
