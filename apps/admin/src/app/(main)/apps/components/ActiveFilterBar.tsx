'use client';

/**
 * Active Filter Bar
 *
 * Displays currently active filters as removable chips.
 * Replaces the advanced filter panel output display per command palette spec.
 *
 * Features:
 * - Shows active filters as removable chips
 * - Color-coded by filter category
 * - Shows match mode indicator
 * - "Clear all" action
 * - Click chip to open command palette focused on that filter
 */

import { useMemo } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import type { AppsAdvancedFiltersState } from './AdvancedFiltersPanel';
import type { FilterOption } from '../hooks/useFilterCounts';
import type { PresetId, QuickFilterId } from '../lib/apps-types';
import { getPresetById, getQuickFilterById } from '../lib/apps-presets';

// ============================================================================
// Types
// ============================================================================

interface ActiveFilterBarProps {
  // Filter state
  filters: AppsAdvancedFiltersState;
  activePreset: PresetId | null;
  activeQuickFilters: QuickFilterId[];
  // Filter options for label lookup
  genreOptions?: FilterOption[];
  tagOptions?: FilterOption[];
  categoryOptions?: FilterOption[];
  // Result count
  resultCount?: number;
  // Actions
  onRemoveFilter: (filterKey: string, value?: number) => void;
  onClearAll: () => void;
  onOpenPalette?: () => void;
}

interface FilterChip {
  key: string;
  label: string;
  value?: number | string;
  category: 'preset' | 'quick' | 'metric' | 'content' | 'platform' | 'release' | 'relationship';
  removable: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ActiveFilterBar({
  filters,
  activePreset,
  activeQuickFilters,
  genreOptions = [],
  tagOptions = [],
  categoryOptions = [],
  resultCount,
  onRemoveFilter,
  onClearAll,
  onOpenPalette,
}: ActiveFilterBarProps) {
  // Build list of active filter chips
  const chips = useMemo(() => {
    const result: FilterChip[] = [];

    // Active preset
    if (activePreset) {
      const preset = getPresetById(activePreset);
      if (preset) {
        result.push({
          key: 'preset',
          label: preset.label,
          category: 'preset',
          removable: true,
        });
      }
    }

    // Active quick filters
    for (const qfId of activeQuickFilters) {
      const qf = getQuickFilterById(qfId);
      if (qf) {
        result.push({
          key: `quick:${qfId}`,
          label: qf.label,
          category: 'quick',
          removable: true,
        });
      }
    }

    // Metric filters
    if (filters.minCcu !== undefined) {
      result.push({
        key: 'minCcu',
        label: `CCU ≥ ${formatNumber(filters.minCcu)}`,
        category: 'metric',
        removable: true,
      });
    }
    if (filters.maxCcu !== undefined) {
      result.push({
        key: 'maxCcu',
        label: `CCU ≤ ${formatNumber(filters.maxCcu)}`,
        category: 'metric',
        removable: true,
      });
    }
    if (filters.minOwners !== undefined) {
      result.push({
        key: 'minOwners',
        label: `Owners ≥ ${formatNumber(filters.minOwners)}`,
        category: 'metric',
        removable: true,
      });
    }
    if (filters.maxOwners !== undefined) {
      result.push({
        key: 'maxOwners',
        label: `Owners ≤ ${formatNumber(filters.maxOwners)}`,
        category: 'metric',
        removable: true,
      });
    }
    if (filters.minReviews !== undefined) {
      result.push({
        key: 'minReviews',
        label: `Reviews ≥ ${formatNumber(filters.minReviews)}`,
        category: 'metric',
        removable: true,
      });
    }
    if (filters.minScore !== undefined) {
      result.push({
        key: 'minScore',
        label: `Score ≥ ${filters.minScore}%`,
        category: 'metric',
        removable: true,
      });
    }
    if (filters.maxScore !== undefined) {
      result.push({
        key: 'maxScore',
        label: `Score ≤ ${filters.maxScore}%`,
        category: 'metric',
        removable: true,
      });
    }
    if (filters.minPrice !== undefined) {
      result.push({
        key: 'minPrice',
        label: `Price ≥ $${filters.minPrice}`,
        category: 'metric',
        removable: true,
      });
    }
    if (filters.maxPrice !== undefined) {
      result.push({
        key: 'maxPrice',
        label: `Price ≤ $${filters.maxPrice}`,
        category: 'metric',
        removable: true,
      });
    }

    // Growth filters
    if (filters.minGrowth7d !== undefined) {
      result.push({
        key: 'minGrowth7d',
        label: `7d Growth ≥ ${filters.minGrowth7d}%`,
        category: 'metric',
        removable: true,
      });
    }
    if (filters.minGrowth30d !== undefined) {
      result.push({
        key: 'minGrowth30d',
        label: `30d Growth ≥ ${filters.minGrowth30d}%`,
        category: 'metric',
        removable: true,
      });
    }
    if (filters.minMomentum !== undefined) {
      result.push({
        key: 'minMomentum',
        label: `Momentum ≥ ${filters.minMomentum}`,
        category: 'metric',
        removable: true,
      });
    }

    // Sentiment filters
    if (filters.minSentimentDelta !== undefined) {
      result.push({
        key: 'minSentimentDelta',
        label: `Sentiment ≥ ${filters.minSentimentDelta}%`,
        category: 'metric',
        removable: true,
      });
    }
    if (filters.velocityTier !== undefined) {
      result.push({
        key: 'velocityTier',
        label: `Velocity: ${filters.velocityTier}`,
        category: 'metric',
        removable: true,
      });
    }

    // Content filters - Genres
    if (filters.genres && filters.genres.length > 0) {
      for (const genreId of filters.genres) {
        const genre = genreOptions.find((g) => g.option_id === genreId);
        result.push({
          key: `genre:${genreId}`,
          label: genre?.option_name || `Genre ${genreId}`,
          value: genreId,
          category: 'content',
          removable: true,
        });
      }
    }

    // Content filters - Tags
    if (filters.tags && filters.tags.length > 0) {
      for (const tagId of filters.tags) {
        const tag = tagOptions.find((t) => t.option_id === tagId);
        result.push({
          key: `tag:${tagId}`,
          label: tag?.option_name || `Tag ${tagId}`,
          value: tagId,
          category: 'content',
          removable: true,
        });
      }
    }

    // Content filters - Categories
    if (filters.categories && filters.categories.length > 0) {
      for (const catId of filters.categories) {
        const cat = categoryOptions.find((c) => c.option_id === catId);
        result.push({
          key: `category:${catId}`,
          label: cat?.option_name || `Category ${catId}`,
          value: catId,
          category: 'content',
          removable: true,
        });
      }
    }

    // Boolean filters
    if (filters.hasWorkshop === true) {
      result.push({
        key: 'hasWorkshop',
        label: 'Workshop',
        category: 'content',
        removable: true,
      });
    }
    if (filters.earlyAccess === true) {
      result.push({
        key: 'earlyAccess',
        label: 'Early Access',
        category: 'release',
        removable: true,
      });
    }

    // Platform filters
    if (filters.steamDeck) {
      result.push({
        key: 'steamDeck',
        label: `Steam Deck: ${filters.steamDeck}`,
        category: 'platform',
        removable: true,
      });
    }
    if (filters.platforms && filters.platforms.length > 0) {
      result.push({
        key: 'platforms',
        label: `Platforms: ${filters.platforms.join(', ')}`,
        category: 'platform',
        removable: true,
      });
    }
    if (filters.controller) {
      result.push({
        key: 'controller',
        label: `Controller: ${filters.controller}`,
        category: 'platform',
        removable: true,
      });
    }

    // Release filters
    if (filters.minAge !== undefined) {
      result.push({
        key: 'minAge',
        label: `Age ≥ ${filters.minAge}d`,
        category: 'release',
        removable: true,
      });
    }
    if (filters.maxAge !== undefined) {
      result.push({
        key: 'maxAge',
        label: `Age ≤ ${filters.maxAge}d`,
        category: 'release',
        removable: true,
      });
    }
    if (filters.releaseYear !== undefined) {
      result.push({
        key: 'releaseYear',
        label: `Year: ${filters.releaseYear}`,
        category: 'release',
        removable: true,
      });
    }

    // Relationship filters
    if (filters.publisherSearch) {
      result.push({
        key: 'publisherSearch',
        label: `Publisher: "${filters.publisherSearch}"`,
        category: 'relationship',
        removable: true,
      });
    }
    if (filters.developerSearch) {
      result.push({
        key: 'developerSearch',
        label: `Developer: "${filters.developerSearch}"`,
        category: 'relationship',
        removable: true,
      });
    }
    if (filters.publisherSize) {
      result.push({
        key: 'publisherSize',
        label: `Publisher: ${filters.publisherSize}`,
        category: 'relationship',
        removable: true,
      });
    }
    if (filters.selfPublished === true) {
      result.push({
        key: 'selfPublished',
        label: 'Self-Published',
        category: 'relationship',
        removable: true,
      });
    }
    if (filters.minVsPublisher !== undefined) {
      result.push({
        key: 'minVsPublisher',
        label: `vs Publisher ≥ ${filters.minVsPublisher}`,
        category: 'relationship',
        removable: true,
      });
    }

    // Activity filters
    if (filters.ccuTier !== undefined) {
      result.push({
        key: 'ccuTier',
        label: `CCU Tier ${filters.ccuTier}`,
        category: 'metric',
        removable: true,
      });
    }

    return result;
  }, [
    filters,
    activePreset,
    activeQuickFilters,
    genreOptions,
    tagOptions,
    categoryOptions,
  ]);

  // Determine match mode text
  const matchModeText = useMemo(() => {
    const hasMultipleContent =
      (filters.tags?.length || 0) > 1 ||
      (filters.genres?.length || 0) > 1;

    if (!hasMultipleContent) return null;

    if (filters.tagMode === 'all' || filters.genreMode === 'all') {
      return 'Matching ALL';
    }
    return 'Matching ANY';
  }, [filters]);

  // Don't render if no filters
  if (chips.length === 0) return null;

  // Show overflow indicator if many chips
  const visibleChips = chips.slice(0, 8);
  const overflowCount = chips.length - visibleChips.length;

  const handleChipRemove = (chip: FilterChip) => {
    if (chip.key === 'preset') {
      onRemoveFilter('preset');
    } else if (chip.key.startsWith('quick:')) {
      onRemoveFilter('quickFilter', undefined);
    } else if (chip.key.startsWith('genre:')) {
      const genreId = parseInt(chip.key.split(':')[1]);
      onRemoveFilter('genre', genreId);
    } else if (chip.key.startsWith('tag:')) {
      const tagId = parseInt(chip.key.split(':')[1]);
      onRemoveFilter('tag', tagId);
    } else if (chip.key.startsWith('category:')) {
      const catId = parseInt(chip.key.split(':')[1]);
      onRemoveFilter('category', catId);
    } else {
      onRemoveFilter(chip.key);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-elevated border border-border-subtle">
      {/* Filter icon + result count */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <SlidersHorizontal className="w-4 h-4 text-text-muted" />
        {resultCount !== undefined && (
          <span className="text-caption text-text-muted">
            {formatNumber(resultCount)} results
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-border-subtle flex-shrink-0" />

      {/* Filter chips */}
      <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {visibleChips.map((chip) => (
          <span
            key={chip.key}
            className={`
              flex items-center gap-1 px-2 py-1 rounded-md text-caption
              whitespace-nowrap cursor-pointer
              ${getCategoryStyles(chip.category)}
            `}
            onClick={onOpenPalette}
          >
            {chip.label}
            {chip.removable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleChipRemove(chip);
                }}
                className="hover:bg-black/10 rounded p-0.5 -mr-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}

        {overflowCount > 0 && (
          <button
            onClick={onOpenPalette}
            className="px-2 py-1 rounded-md text-caption text-text-muted
                       hover:bg-surface transition-colors whitespace-nowrap"
          >
            +{overflowCount} more
          </button>
        )}
      </div>

      {/* Match mode indicator */}
      {matchModeText && (
        <>
          <div className="h-4 w-px bg-border-subtle flex-shrink-0" />
          <span className="text-caption text-text-muted whitespace-nowrap">
            {matchModeText}
          </span>
        </>
      )}

      {/* Clear all */}
      <button
        onClick={onClearAll}
        className="text-caption text-accent-red hover:underline whitespace-nowrap flex-shrink-0"
      >
        Clear all
      </button>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  }
  return value.toString();
}

function getCategoryStyles(category: FilterChip['category']): string {
  switch (category) {
    case 'preset':
      return 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30';
    case 'quick':
      return 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30';
    case 'metric':
      return 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30';
    case 'content':
      return 'bg-accent-green/20 text-accent-green border border-accent-green/30';
    case 'platform':
      return 'bg-accent-orange/20 text-accent-orange border border-accent-orange/30';
    case 'release':
      return 'bg-amber-500/20 text-amber-600 border border-amber-500/30';
    case 'relationship':
      return 'bg-pink-500/20 text-pink-600 border border-pink-500/30';
    default:
      return 'bg-surface text-text-primary border border-border-subtle';
  }
}
