'use client';

import { useCallback } from 'react';
import { X } from 'lucide-react';
import {
  MetricRangeFilters,
  GrowthFilters,
  SentimentFilters,
  EngagementFilters,
  type MetricFilters,
  type GrowthFilterValues,
  type SentimentFilterValues,
  type EngagementFilterValues,
  type GrowthPreset,
  type SentimentPreset,
} from './filters';

/**
 * Combined advanced filter state for Apps page
 */
export interface AppsAdvancedFiltersState
  extends MetricFilters,
    GrowthFilterValues,
    SentimentFilterValues,
    EngagementFilterValues {}

interface AdvancedFiltersPanelProps {
  filters: AppsAdvancedFiltersState;
  activeCount: number;
  onFilterChange: (field: keyof AppsAdvancedFiltersState, value: number | string | undefined) => void;
  onClearAll: () => void;
  onGrowthPreset: (preset: GrowthPreset, period: '7d' | '30d') => void;
  onSentimentPreset: (preset: SentimentPreset) => void;
  disabled?: boolean;
}

/**
 * Advanced filters panel for Apps page
 * Collapsible panel with metric, growth, sentiment, and engagement filters
 */
export function AdvancedFiltersPanel({
  filters,
  activeCount,
  onFilterChange,
  onClearAll,
  onGrowthPreset,
  onSentimentPreset,
  disabled = false,
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
      <div className="p-4">
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
        <div className="h-px bg-border-subtle my-6" />

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
      </div>
    </div>
  );
}
