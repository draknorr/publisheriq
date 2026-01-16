'use client';

import { useCallback } from 'react';
import { X } from 'lucide-react';
import {
  MetricRangeFilters,
  GrowthFilters,
  SentimentFilters,
  EngagementFilters,
  ContentFilters,
  PlatformFilters,
  ReleaseFilters,
  RelationshipFilters,
  ActivityFilters,
  type MetricFilters,
  type GrowthFilterValues,
  type SentimentFilterValues,
  type EngagementFilterValues,
  type GrowthPreset,
  type SentimentPreset,
  type FilterMode,
} from './filters';
import type { FilterOption } from '../hooks/useFilterCounts';
import type { PublisherSize, CcuTier } from '../lib/apps-types';

/**
 * M4b Content filter values
 */
export interface ContentFilterValues {
  genres?: number[];
  genreMode?: FilterMode;
  tags?: number[];
  tagMode?: FilterMode;
  categories?: number[];
  hasWorkshop?: boolean;
}

/**
 * M4b Platform filter values
 */
export interface PlatformFilterValues {
  platforms?: string[];
  platformMode?: FilterMode;
  steamDeck?: string;
  controller?: string;
}

/**
 * M4b Release filter values
 */
export interface ReleaseFilterValues {
  minAge?: number;
  maxAge?: number;
  releaseYear?: number;
  earlyAccess?: boolean;
  minHype?: number;
  maxHype?: number;
}

/**
 * M4b Relationship filter values
 */
export interface RelationshipFilterValues {
  publisherSearch?: string;
  developerSearch?: string;
  selfPublished?: boolean;
  publisherSize?: PublisherSize;
  minVsPublisher?: number;
}

/**
 * M4b Activity filter values
 */
export interface ActivityFilterValues {
  ccuTier?: CcuTier;
}

/**
 * Combined advanced filter state for Apps page
 */
export interface AppsAdvancedFiltersState
  extends MetricFilters,
    GrowthFilterValues,
    SentimentFilterValues,
    EngagementFilterValues,
    ContentFilterValues,
    PlatformFilterValues,
    ReleaseFilterValues,
    RelationshipFilterValues,
    ActivityFilterValues {}

interface AdvancedFiltersPanelProps {
  filters: AppsAdvancedFiltersState;
  activeCount: number;
  onFilterChange: (field: keyof AppsAdvancedFiltersState, value: number | string | undefined) => void;
  onClearAll: () => void;
  onGrowthPreset: (preset: GrowthPreset, period: '7d' | '30d') => void;
  onSentimentPreset: (preset: SentimentPreset) => void;
  disabled?: boolean;

  // M4b: Content filter props
  genreOptions: FilterOption[];
  genreLoading: boolean;
  onGenreOpen: () => void;
  onGenresChange: (ids: number[]) => void;
  onGenreModeChange: (mode: FilterMode) => void;
  tagOptions: FilterOption[];
  tagLoading: boolean;
  onTagOpen: () => void;
  onTagsChange: (ids: number[]) => void;
  onTagModeChange: (mode: FilterMode) => void;
  categoryOptions: FilterOption[];
  categoryLoading: boolean;
  onCategoryOpen: () => void;
  onCategoriesChange: (ids: number[]) => void;
  onWorkshopChange: (value: boolean | undefined) => void;

  // M4b: Platform filter props
  onPlatformsChange: (platforms: string[]) => void;
  onPlatformModeChange: (mode: FilterMode) => void;
  onSteamDeckChange: (value: string | undefined) => void;
  onControllerChange: (value: string | undefined) => void;

  // M4b: Release filter props
  onMinAgeChange: (value: number | undefined) => void;
  onMaxAgeChange: (value: number | undefined) => void;
  onReleaseYearChange: (year: number | undefined) => void;
  onEarlyAccessChange: (value: boolean | undefined) => void;
  onMinHypeChange: (value: number | undefined) => void;
  onMaxHypeChange: (value: number | undefined) => void;

  // M4b: Relationship filter props
  onPublisherSearchChange: (value: string | undefined) => void;
  onDeveloperSearchChange: (value: string | undefined) => void;
  onSelfPublishedChange: (value: boolean | undefined) => void;
  onPublisherSizeChange: (value: PublisherSize | undefined) => void;
  onVsPublisherChange: (value: number | undefined) => void;

  // M4b: Activity filter props
  onCcuTierChange: (tier: CcuTier | undefined) => void;
}

/**
 * Advanced filters panel for Apps page
 * Collapsible panel with metric, growth, sentiment, engagement filters (M4a)
 * Plus content, platform, release, relationship, activity filters (M4b)
 */
export function AdvancedFiltersPanel({
  filters,
  activeCount,
  onFilterChange,
  onClearAll,
  onGrowthPreset,
  onSentimentPreset,
  disabled = false,
  // M4b: Content
  genreOptions,
  genreLoading,
  onGenreOpen,
  onGenresChange,
  onGenreModeChange,
  tagOptions,
  tagLoading,
  onTagOpen,
  onTagsChange,
  onTagModeChange,
  categoryOptions,
  categoryLoading,
  onCategoryOpen,
  onCategoriesChange,
  onWorkshopChange,
  // M4b: Platform
  onPlatformsChange,
  onPlatformModeChange,
  onSteamDeckChange,
  onControllerChange,
  // M4b: Release
  onMinAgeChange,
  onMaxAgeChange,
  onReleaseYearChange,
  onEarlyAccessChange,
  onMinHypeChange,
  onMaxHypeChange,
  // M4b: Relationship
  onPublisherSearchChange,
  onDeveloperSearchChange,
  onSelfPublishedChange,
  onPublisherSizeChange,
  onVsPublisherChange,
  // M4b: Activity
  onCcuTierChange,
}: AdvancedFiltersPanelProps) {
  // Create typed handlers for each filter section
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

  const handleSentimentChange = useCallback(
    (field: keyof SentimentFilterValues, value: number | string | undefined) => {
      onFilterChange(field, value);
    },
    [onFilterChange]
  );

  const handleEngagementChange = useCallback(
    (field: keyof EngagementFilterValues, value: number | undefined) => {
      onFilterChange(field, value);
    },
    [onFilterChange]
  );

  // Extract filter subsets for each component
  const metricFilters: MetricFilters = {
    minCcu: filters.minCcu,
    maxCcu: filters.maxCcu,
    minOwners: filters.minOwners,
    maxOwners: filters.maxOwners,
    minReviews: filters.minReviews,
    maxReviews: filters.maxReviews,
    minScore: filters.minScore,
    maxScore: filters.maxScore,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minPlaytime: filters.minPlaytime,
    maxPlaytime: filters.maxPlaytime,
  };

  const growthFilters: GrowthFilterValues = {
    minGrowth7d: filters.minGrowth7d,
    maxGrowth7d: filters.maxGrowth7d,
    minGrowth30d: filters.minGrowth30d,
    maxGrowth30d: filters.maxGrowth30d,
    minMomentum: filters.minMomentum,
    maxMomentum: filters.maxMomentum,
  };

  const sentimentFilters: SentimentFilterValues = {
    minSentimentDelta: filters.minSentimentDelta,
    maxSentimentDelta: filters.maxSentimentDelta,
    velocityTier: filters.velocityTier,
  };

  const engagementFilters: EngagementFilterValues = {
    minActivePct: filters.minActivePct,
    minReviewRate: filters.minReviewRate,
    minValueScore: filters.minValueScore,
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

      {/* Main content grid */}
      <div className="p-4 space-y-6">
        {/* Row 1: Metrics + Growth */}
        <div className="grid grid-cols-12 gap-6">
          {/* Metric Ranges - 8 columns */}
          <div className="col-span-12 lg:col-span-8">
            <h4 className="text-caption font-medium text-text-muted uppercase tracking-wide mb-3">
              Metric Ranges
            </h4>
            <MetricRangeFilters
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
            <GrowthFilters
              filters={growthFilters}
              onChange={handleGrowthChange}
              onPresetClick={onGrowthPreset}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border-subtle" />

        {/* Row 2: Sentiment + Engagement */}
        <div className="grid grid-cols-12 gap-6">
          {/* Sentiment Filters - 6 columns */}
          <div className="col-span-12 lg:col-span-6">
            <h4 className="text-caption font-medium text-text-muted uppercase tracking-wide mb-3">
              Sentiment
            </h4>
            <SentimentFilters
              filters={sentimentFilters}
              onChange={handleSentimentChange}
              onPresetClick={onSentimentPreset}
              disabled={disabled}
            />
          </div>

          {/* Engagement Filters - 6 columns */}
          <div className="col-span-12 lg:col-span-6">
            <h4 className="text-caption font-medium text-text-muted uppercase tracking-wide mb-3">
              Engagement
            </h4>
            <EngagementFilters
              filters={engagementFilters}
              onChange={handleEngagementChange}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border-subtle" />

        {/* Row 3: Content + Platform (M4b) */}
        <div className="grid grid-cols-12 gap-6">
          {/* Content Filters - 8 columns */}
          <div className="col-span-12 lg:col-span-8">
            <h4 className="text-caption font-medium text-text-muted uppercase tracking-wide mb-3">
              Content
            </h4>
            <ContentFilters
              genres={filters.genres ?? []}
              genreMode={filters.genreMode ?? 'any'}
              genreOptions={genreOptions}
              genreLoading={genreLoading}
              onGenresChange={onGenresChange}
              onGenreModeChange={onGenreModeChange}
              onGenreOpen={onGenreOpen}
              tags={filters.tags ?? []}
              tagMode={filters.tagMode ?? 'any'}
              tagOptions={tagOptions}
              tagLoading={tagLoading}
              onTagsChange={onTagsChange}
              onTagModeChange={onTagModeChange}
              onTagOpen={onTagOpen}
              categories={filters.categories ?? []}
              categoryOptions={categoryOptions}
              categoryLoading={categoryLoading}
              onCategoriesChange={onCategoriesChange}
              onCategoryOpen={onCategoryOpen}
              hasWorkshop={filters.hasWorkshop}
              onWorkshopChange={onWorkshopChange}
              disabled={disabled}
            />
          </div>

          {/* Platform Filters - 4 columns */}
          <div className="col-span-12 lg:col-span-4">
            <h4 className="text-caption font-medium text-text-muted uppercase tracking-wide mb-3">
              Platform
            </h4>
            <PlatformFilters
              platforms={(filters.platforms ?? []) as ('windows' | 'macos' | 'linux')[]}
              platformMode={filters.platformMode ?? 'any'}
              onPlatformsChange={onPlatformsChange}
              onPlatformModeChange={onPlatformModeChange}
              steamDeck={filters.steamDeck as 'verified' | 'playable' | 'unsupported' | undefined}
              onSteamDeckChange={onSteamDeckChange}
              controller={filters.controller as 'full' | 'partial' | undefined}
              onControllerChange={onControllerChange}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border-subtle" />

        {/* Row 4: Release + Relationship (M4b) */}
        <div className="grid grid-cols-12 gap-6">
          {/* Release Filters - 6 columns */}
          <div className="col-span-12 lg:col-span-6">
            <h4 className="text-caption font-medium text-text-muted uppercase tracking-wide mb-3">
              Release
            </h4>
            <ReleaseFilters
              minAge={filters.minAge}
              maxAge={filters.maxAge}
              releaseYear={filters.releaseYear}
              earlyAccess={filters.earlyAccess}
              minHype={filters.minHype}
              maxHype={filters.maxHype}
              onMinAgeChange={onMinAgeChange}
              onMaxAgeChange={onMaxAgeChange}
              onReleaseYearChange={onReleaseYearChange}
              onEarlyAccessChange={onEarlyAccessChange}
              onMinHypeChange={onMinHypeChange}
              onMaxHypeChange={onMaxHypeChange}
              disabled={disabled}
            />
          </div>

          {/* Relationship Filters - 6 columns */}
          <div className="col-span-12 lg:col-span-6">
            <h4 className="text-caption font-medium text-text-muted uppercase tracking-wide mb-3">
              Relationship
            </h4>
            <RelationshipFilters
              publisherSearch={filters.publisherSearch}
              developerSearch={filters.developerSearch}
              selfPublished={filters.selfPublished}
              publisherSize={filters.publisherSize}
              minVsPublisher={filters.minVsPublisher}
              onPublisherSearchChange={onPublisherSearchChange}
              onDeveloperSearchChange={onDeveloperSearchChange}
              onSelfPublishedChange={onSelfPublishedChange}
              onPublisherSizeChange={onPublisherSizeChange}
              onVsPublisherChange={onVsPublisherChange}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border-subtle" />

        {/* Row 5: Activity (M4b) */}
        <div>
          <h4 className="text-caption font-medium text-text-muted uppercase tracking-wide mb-3">
            Activity
          </h4>
          <ActivityFilters
            ccuTier={filters.ccuTier}
            onCcuTierChange={onCcuTierChange}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
