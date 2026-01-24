'use client';

/**
 * Active Filter Bar for Companies
 *
 * Displays currently active filters as color-coded chips:
 * - preset: purple
 * - quick: coral
 * - metric: blue
 * - content: green
 * - platform: orange
 * - relationship: pink
 *
 * Features:
 * - Individual chip removal
 * - "Clear all" action
 * - "+N more" overflow handling (limit 8 visible)
 * - Result count display
 * - Click chip to open command palette
 */

import { useMemo } from 'react';
import { X } from 'lucide-react';
import type { PresetId, QuickFilterId, FilterOption } from '../lib/companies-types';
import type { AdvancedFiltersState } from '../hooks/useCompaniesFilters';
import { PRESETS, QUICK_FILTERS } from '../lib/companies-presets';

// ============================================================================
// Types
// ============================================================================

type ChipCategory = 'preset' | 'quick' | 'metric' | 'content' | 'platform' | 'relationship';

interface FilterChip {
  id: string;
  label: string;
  category: ChipCategory;
  onRemove: () => void;
}

interface ActiveFilterBarProps {
  // Active filters
  activePreset: PresetId | null;
  activeQuickFilters: QuickFilterId[];
  advancedFilters: AdvancedFiltersState;
  // Content filter data (for labels)
  genreOptions: FilterOption[];
  tagOptions: FilterOption[];
  categoryOptions: FilterOption[];
  // Result count
  resultCount?: number;
  // Actions
  onClearPreset: () => void;
  onToggleQuickFilter: (id: QuickFilterId) => void;
  onClearAdvancedFilter: (field: keyof AdvancedFiltersState) => void;
  onClearAll: () => void;
  onOpenPalette?: () => void;
}

// ============================================================================
// Category Colors
// ============================================================================

const CATEGORY_COLORS: Record<ChipCategory, string> = {
  preset: 'bg-accent-purple/20 text-accent-purple border-accent-purple/30',
  quick: 'bg-accent-primary/20 text-accent-primary border-accent-primary/30',
  metric: 'bg-accent-blue/20 text-accent-blue border-accent-blue/30',
  content: 'bg-accent-green/20 text-accent-green border-accent-green/30',
  platform: 'bg-orange-500/20 text-orange-600 border-orange-500/30',
  relationship: 'bg-pink-500/20 text-pink-600 border-pink-500/30',
};

// ============================================================================
// Component
// ============================================================================

export function ActiveFilterBar({
  activePreset,
  activeQuickFilters,
  advancedFilters,
  genreOptions,
  tagOptions,
  categoryOptions,
  resultCount,
  onClearPreset,
  onToggleQuickFilter,
  onClearAdvancedFilter,
  onClearAll,
  onOpenPalette,
}: ActiveFilterBarProps) {
  // Build the list of active filter chips
  const chips = useMemo(() => {
    const result: FilterChip[] = [];

    // Preset chip
    if (activePreset) {
      const preset = PRESETS.find((p) => p.id === activePreset);
      if (preset) {
        result.push({
          id: `preset-${activePreset}`,
          label: preset.label,
          category: 'preset',
          onRemove: onClearPreset,
        });
      }
    }

    // Quick filter chips
    for (const qfId of activeQuickFilters) {
      const filter = QUICK_FILTERS.find((f) => f.id === qfId);
      if (filter) {
        result.push({
          id: `quick-${qfId}`,
          label: filter.label,
          category: 'quick',
          onRemove: () => onToggleQuickFilter(qfId),
        });
      }
    }

    // Metric filter chips
    if (advancedFilters.minGames !== undefined || advancedFilters.maxGames !== undefined) {
      const label = formatRangeLabel('Games', advancedFilters.minGames, advancedFilters.maxGames);
      result.push({
        id: 'metric-games',
        label,
        category: 'metric',
        onRemove: () => {
          onClearAdvancedFilter('minGames');
          onClearAdvancedFilter('maxGames');
        },
      });
    }

    if (advancedFilters.minOwners !== undefined || advancedFilters.maxOwners !== undefined) {
      const label = formatRangeLabel('Owners', advancedFilters.minOwners, advancedFilters.maxOwners, true);
      result.push({
        id: 'metric-owners',
        label,
        category: 'metric',
        onRemove: () => {
          onClearAdvancedFilter('minOwners');
          onClearAdvancedFilter('maxOwners');
        },
      });
    }

    if (advancedFilters.minCcu !== undefined || advancedFilters.maxCcu !== undefined) {
      const label = formatRangeLabel('CCU', advancedFilters.minCcu, advancedFilters.maxCcu, true);
      result.push({
        id: 'metric-ccu',
        label,
        category: 'metric',
        onRemove: () => {
          onClearAdvancedFilter('minCcu');
          onClearAdvancedFilter('maxCcu');
        },
      });
    }

    if (advancedFilters.minRevenue !== undefined || advancedFilters.maxRevenue !== undefined) {
      const label = formatRangeLabel(
        'Revenue',
        advancedFilters.minRevenue ? advancedFilters.minRevenue / 100 : undefined,
        advancedFilters.maxRevenue ? advancedFilters.maxRevenue / 100 : undefined,
        true,
        '$'
      );
      result.push({
        id: 'metric-revenue',
        label,
        category: 'metric',
        onRemove: () => {
          onClearAdvancedFilter('minRevenue');
          onClearAdvancedFilter('maxRevenue');
        },
      });
    }

    if (advancedFilters.minScore !== undefined || advancedFilters.maxScore !== undefined) {
      const label = formatRangeLabel('Score', advancedFilters.minScore, advancedFilters.maxScore, false, '', '%');
      result.push({
        id: 'metric-score',
        label,
        category: 'metric',
        onRemove: () => {
          onClearAdvancedFilter('minScore');
          onClearAdvancedFilter('maxScore');
        },
      });
    }

    // Growth filter chips
    if (advancedFilters.minGrowth7d !== undefined || advancedFilters.maxGrowth7d !== undefined) {
      const label = formatRangeLabel('7d Growth', advancedFilters.minGrowth7d, advancedFilters.maxGrowth7d, false, '', '%');
      result.push({
        id: 'metric-growth7d',
        label,
        category: 'metric',
        onRemove: () => {
          onClearAdvancedFilter('minGrowth7d');
          onClearAdvancedFilter('maxGrowth7d');
        },
      });
    }

    if (advancedFilters.minGrowth30d !== undefined || advancedFilters.maxGrowth30d !== undefined) {
      const label = formatRangeLabel('30d Growth', advancedFilters.minGrowth30d, advancedFilters.maxGrowth30d, false, '', '%');
      result.push({
        id: 'metric-growth30d',
        label,
        category: 'metric',
        onRemove: () => {
          onClearAdvancedFilter('minGrowth30d');
          onClearAdvancedFilter('maxGrowth30d');
        },
      });
    }

    // Content filter chips
    if (advancedFilters.genres && advancedFilters.genres.length > 0) {
      const genreNames = advancedFilters.genres
        .slice(0, 2)
        .map((id) => genreOptions.find((g) => g.option_id === id)?.option_name || `Genre ${id}`)
        .join(', ');
      const label = advancedFilters.genres.length > 2
        ? `${genreNames} +${advancedFilters.genres.length - 2}`
        : genreNames;
      result.push({
        id: 'content-genres',
        label: `Genres: ${label}`,
        category: 'content',
        onRemove: () => onClearAdvancedFilter('genres'),
      });
    }

    if (advancedFilters.tags && advancedFilters.tags.length > 0) {
      const tagNames = advancedFilters.tags
        .slice(0, 2)
        .map((id) => tagOptions.find((t) => t.option_id === id)?.option_name || `Tag ${id}`)
        .join(', ');
      const label = advancedFilters.tags.length > 2
        ? `${tagNames} +${advancedFilters.tags.length - 2}`
        : tagNames;
      result.push({
        id: 'content-tags',
        label: `Tags: ${label}`,
        category: 'content',
        onRemove: () => onClearAdvancedFilter('tags'),
      });
    }

    if (advancedFilters.categories && advancedFilters.categories.length > 0) {
      const catNames = advancedFilters.categories
        .slice(0, 2)
        .map((id) => categoryOptions.find((c) => c.option_id === id)?.option_name || `Cat ${id}`)
        .join(', ');
      const label = advancedFilters.categories.length > 2
        ? `${catNames} +${advancedFilters.categories.length - 2}`
        : catNames;
      result.push({
        id: 'content-categories',
        label: `Categories: ${label}`,
        category: 'content',
        onRemove: () => onClearAdvancedFilter('categories'),
      });
    }

    // Platform filter chips
    if (advancedFilters.steamDeck) {
      result.push({
        id: 'platform-steamdeck',
        label: `Deck: ${advancedFilters.steamDeck}`,
        category: 'platform',
        onRemove: () => onClearAdvancedFilter('steamDeck'),
      });
    }

    if (advancedFilters.platforms && advancedFilters.platforms.length > 0) {
      result.push({
        id: 'platform-platforms',
        label: `Platforms: ${advancedFilters.platforms.join(', ')}`,
        category: 'platform',
        onRemove: () => onClearAdvancedFilter('platforms'),
      });
    }

    // Relationship filter chips
    if (advancedFilters.status) {
      result.push({
        id: 'relationship-status',
        label: `Status: ${advancedFilters.status}`,
        category: 'relationship',
        onRemove: () => onClearAdvancedFilter('status'),
      });
    }

    if (advancedFilters.relationship) {
      const relationshipLabels: Record<string, string> = {
        self_published: 'Self-Published',
        external_devs: 'External Devs',
        multi_publisher: 'Multi-Publisher',
      };
      result.push({
        id: 'relationship-rel',
        label: relationshipLabels[advancedFilters.relationship] || advancedFilters.relationship,
        category: 'relationship',
        onRemove: () => onClearAdvancedFilter('relationship'),
      });
    }

    return result;
  }, [
    activePreset,
    activeQuickFilters,
    advancedFilters,
    genreOptions,
    tagOptions,
    categoryOptions,
    onClearPreset,
    onToggleQuickFilter,
    onClearAdvancedFilter,
  ]);

  // Don't render if no active filters
  if (chips.length === 0) return null;

  // Limit visible chips
  const MAX_VISIBLE = 8;
  const visibleChips = chips.slice(0, MAX_VISIBLE);
  const overflowCount = chips.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-2 py-2 px-1">
      {/* Result count */}
      {resultCount !== undefined && (
        <span className="text-body-sm font-medium text-text-primary flex-shrink-0">
          {resultCount.toLocaleString()} results
        </span>
      )}

      {/* Divider */}
      {resultCount !== undefined && (
        <div className="h-4 w-px bg-border-subtle flex-shrink-0" />
      )}

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {visibleChips.map((chip) => (
          <button
            key={chip.id}
            onClick={onOpenPalette}
            className={`
              group flex items-center gap-1 px-2 py-1 rounded-md text-caption
              border transition-colors cursor-pointer
              ${CATEGORY_COLORS[chip.category]}
            `}
          >
            <span className="max-w-[150px] truncate">{chip.label}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                chip.onRemove();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  chip.onRemove();
                }
              }}
              className="p-0.5 rounded hover:bg-black/10 transition-colors"
              aria-label={`Remove ${chip.label} filter`}
            >
              <X className="w-3 h-3" />
            </span>
          </button>
        ))}

        {/* Overflow indicator */}
        {overflowCount > 0 && (
          <button
            onClick={onOpenPalette}
            className="px-2 py-1 rounded-md text-caption text-text-muted
                       hover:text-text-primary hover:bg-surface-elevated transition-colors"
          >
            +{overflowCount} more
          </button>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Clear all */}
      <button
        onClick={onClearAll}
        className="text-caption text-accent-red hover:text-accent-red/80
                   transition-colors whitespace-nowrap flex-shrink-0"
      >
        Clear all
      </button>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatRangeLabel(
  name: string,
  min?: number,
  max?: number,
  compact: boolean = false,
  prefix: string = '',
  suffix: string = ''
): string {
  const formatValue = (val: number) => {
    if (!compact) return `${prefix}${val}${suffix}`;
    if (val >= 1_000_000) return `${prefix}${(val / 1_000_000).toFixed(1)}M${suffix}`;
    if (val >= 1_000) return `${prefix}${(val / 1_000).toFixed(val >= 10_000 ? 0 : 1)}K${suffix}`;
    return `${prefix}${val}${suffix}`;
  };

  if (min !== undefined && max !== undefined) {
    return `${name}: ${formatValue(min)} - ${formatValue(max)}`;
  }
  if (min !== undefined) {
    return `${name} >= ${formatValue(min)}`;
  }
  if (max !== undefined) {
    return `${name} <= ${formatValue(max)}`;
  }
  return name;
}
