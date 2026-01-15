'use client';

import { useState, useCallback, useEffect } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { MetricRangeFilters, type MetricFilters } from './filters/MetricRangeFilters';
import { GrowthFilters, type GrowthFilterValues } from './filters/GrowthFilters';
import { TimePeriodFilter } from './filters/TimePeriodFilter';
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
 * Collapsible advanced filters panel with metric, growth, time period,
 * content, and relationship filters (M4a + M4b)
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
  const [isOpen, setIsOpen] = useState(false);
  const { data: filterOptions, loading: filterLoading, fetchCounts } = useFilterCounts();

  // Build contextual filters for count queries
  const contextFilters = {
    minGames: filters.minGames,
    minRevenue: filters.minRevenue,
    status: filters.status,
  };

  // Auto-open panel if there are active filters
  useEffect(() => {
    if (activeCount > 0 && !isOpen) {
      // Don't auto-open, just show the badge
    }
  }, [activeCount, isOpen]);

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
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 rounded-t-lg">
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls="advanced-filters-content"
          className="flex items-center gap-2 hover:bg-surface-elevated/50 transition-colors -ml-1 px-1 py-0.5 rounded"
        >
          <ChevronRight
            className={`h-4 w-4 text-text-tertiary transition-transform duration-150 ${
              isOpen ? 'rotate-90' : ''
            }`}
          />
          <span className="text-body-sm font-medium text-text-primary">Advanced Filters</span>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 text-caption rounded bg-accent-primary/15 text-accent-primary">
              {activeCount} active
            </span>
          )}
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            disabled={disabled}
            className="flex items-center gap-1 px-2 py-1 text-caption text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>

      {/* Content */}
      {isOpen && (
        <div
          id="advanced-filters-content"
          className="px-3 pb-4 pt-2 border-t border-border-subtle space-y-6"
        >
          {/* ====== M4a Filters ====== */}

          {/* Metric Range Filters */}
          <div>
            <h4 className="text-body-sm font-medium text-text-primary mb-3">Metric Ranges</h4>
            <MetricRangeFilters
              filters={metricFilters}
              onChange={handleMetricChange}
              disabled={disabled}
            />
          </div>

          {/* Growth Filters */}
          <div>
            <h4 className="text-body-sm font-medium text-text-primary mb-3">Growth Filters</h4>
            <GrowthFilters
              filters={growthFilters}
              onChange={handleGrowthChange}
              onPresetClick={onGrowthPreset}
              disabled={disabled}
            />
          </div>

          {/* Time Period Filter */}
          <div>
            <TimePeriodFilter
              value={filters.period}
              onChange={handlePeriodChange}
              disabled={disabled}
            />
          </div>

          {/* ====== M4b Content Filters ====== */}
          <div className="border-t border-border-subtle pt-6">
            <h4 className="text-body-sm font-medium text-text-primary mb-4">Content Filters</h4>

            <div className="space-y-4">
              {/* Genre Filter */}
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

              {/* Tag Filter */}
              <GenreTagFilter
                label="Tags"
                filterType="tag"
                selected={filters.tags ?? []}
                mode="any"
                options={filterOptions.tag}
                isLoading={filterLoading.tag}
                onSelect={onTagsChange}
                onModeChange={() => {}} // Tags don't have mode toggle
                onOpen={handleTagOpen}
                disabled={disabled}
              />

              {/* Feature/Category Filter */}
              <FeatureFilter
                selected={filters.categories ?? []}
                options={filterOptions.category}
                isLoading={filterLoading.category}
                onChange={onCategoriesChange}
                onOpen={handleCategoryOpen}
                disabled={disabled}
              />

              {/* Platform Filter */}
              <PlatformFilter
                selected={filters.platforms ?? []}
                mode={filters.platformMode ?? 'any'}
                onSelect={onPlatformsChange}
                onModeChange={onPlatformModeChange}
                disabled={disabled}
              />

              {/* Steam Deck Filter */}
              <SteamDeckFilter
                value={filters.steamDeck ?? null}
                onChange={onSteamDeckChange}
                disabled={disabled}
              />
            </div>
          </div>

          {/* ====== M4b Relationship & Activity Filters ====== */}
          <div className="border-t border-border-subtle pt-6">
            <h4 className="text-body-sm font-medium text-text-primary mb-4">
              Relationship & Activity
            </h4>

            <div className="space-y-4">
              {/* Relationship Filter */}
              <RelationshipFilter
                value={filters.relationship ?? null}
                companyType={companyType}
                onChange={onRelationshipChange}
                disabled={disabled}
              />

              {/* Activity Filter */}
              <ActivityFilter
                value={filters.status ?? null}
                onChange={onStatusChange}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
