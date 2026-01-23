'use client';

/**
 * Command Palette Home View
 *
 * Default view with:
 * - Search input with filter syntax parsing
 * - Quick presets (4 primary presets)
 * - Quick filters (12 stackable filters)
 * - Genre chips (all ~30 genres)
 * - Browse navigation (Tags, Categories)
 * - Metric filter shortcuts
 */

import { useRef, useEffect, useMemo } from 'react';
import {
  Search,
  ChevronRight,
  Sparkles,
  Tag,
  Grid3X3,
  TrendingUp,
  Users,
  Star,
  DollarSign,
  Loader2,
  Check,
  Zap,
} from 'lucide-react';
import type { UseCommandPaletteReturn } from '../../hooks/useCommandPalette';
import type { FilterOption } from '../../hooks/useFilterCounts';
import type { PresetId, QuickFilterId } from '../../lib/apps-types';
import { getPresetsOnly, getQuickFiltersOnly } from '../../lib/apps-presets';
import { getMetricFilters } from '../../lib/filter-registry';

// ============================================================================
// Types
// ============================================================================

interface CommandPaletteHomeProps {
  palette: UseCommandPaletteReturn;
  // Genre data
  genreOptions: FilterOption[];
  genresLoading?: boolean;
  onGenresOpen?: () => void;
  // Preset/Quick filter state
  activePreset: PresetId | null;
  activeQuickFilters: QuickFilterId[];
  onApplyPreset: (id: PresetId) => void;
  onToggleQuickFilter: (id: QuickFilterId) => void;
}

// ============================================================================
// Component
// ============================================================================

export function CommandPaletteHome({
  palette,
  genreOptions,
  genresLoading = false,
  onGenresOpen,
  activePreset,
  activeQuickFilters,
  onApplyPreset,
  onToggleQuickFilter,
}: CommandPaletteHomeProps) {
  const {
    state,
    navigateTo,
    setSearchInput,
    applyParsedFilter,
    toggleGenre,
    close,
  } = palette;
  const { searchInput, parsedFilter, selectedGenres } = state;

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input on mount
  useEffect(() => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  }, []);

  // Fetch genres when component mounts
  useEffect(() => {
    if (genreOptions.length === 0 && onGenresOpen) {
      onGenresOpen();
    }
  }, [genreOptions.length, onGenresOpen]);

  // Get presets and quick filters
  const presets = useMemo(() => getPresetsOnly().slice(0, 4), []);
  const quickFilters = useMemo(() => getQuickFiltersOnly(), []);
  const metricFilters = useMemo(() => getMetricFilters().slice(0, 5), []);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  // Handle Enter key in search
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && parsedFilter?.success) {
      e.preventDefault();
      applyParsedFilter();
    }
  };

  // Handle preset click
  const handlePresetClick = (id: PresetId) => {
    onApplyPreset(id);
    close();
  };

  // Handle quick filter click
  const handleQuickFilterClick = (id: QuickFilterId) => {
    onToggleQuickFilter(id);
  };

  // Handle metric shortcut click - populate search
  const handleMetricClick = (shortcut: string) => {
    setSearchInput(`${shortcut} > `);
    searchInputRef.current?.focus();
  };

  return (
    <div className="p-4 space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchInput}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search filters, tags, or type ccu > 50000..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg
                     bg-surface-elevated border border-border-subtle
                     text-body text-text-primary placeholder:text-text-muted
                     focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary"
        />
      </div>

      {/* Parsed Filter Preview */}
      {parsedFilter?.success && parsedFilter.filter && (
        <button
          onClick={applyParsedFilter}
          className="w-full flex items-center justify-between p-3 rounded-lg
                     bg-accent-green/10 border border-accent-green/30
                     hover:bg-accent-green/15 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-accent-green" />
            <span className="text-body text-text-primary">
              Add filter: <span className="font-medium">{parsedFilter.filter.displayText}</span>
            </span>
          </div>
          <span className="text-caption text-text-muted">Press Enter</span>
        </button>
      )}

      {/* Parse error with suggestions */}
      {parsedFilter && !parsedFilter.success && parsedFilter.suggestions && searchInput.length > 2 && (
        <div className="p-3 rounded-lg bg-surface-elevated border border-border-subtle">
          <p className="text-caption text-text-muted mb-2">
            {parsedFilter.error || 'Did you mean:'}
          </p>
          <div className="flex flex-wrap gap-2">
            {parsedFilter.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setSearchInput(suggestion)}
                className="px-2 py-1 rounded text-caption text-accent-primary
                           bg-accent-primary/10 hover:bg-accent-primary/20 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Presets */}
      <section>
        <h3 className="text-caption font-medium text-text-secondary mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Presets
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((preset) => {
            const isActive = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset.id as PresetId)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg text-left
                  transition-colors
                  ${isActive
                    ? 'bg-accent-purple/20 border border-accent-purple/40 text-accent-purple'
                    : 'bg-surface-elevated border border-border-subtle hover:border-accent-purple/30 text-text-primary'
                  }
                `}
              >
                {preset.emoji && <span className="text-base">{preset.emoji}</span>}
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium truncate">{preset.label}</div>
                </div>
                {isActive && <Check className="w-4 h-4 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Quick Filters */}
      <section>
        <h3 className="text-caption font-medium text-text-secondary mb-2 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" />
          Quick Filters
        </h3>
        <div className="flex flex-wrap gap-2">
          {quickFilters.map((filter) => {
            const isActive = activeQuickFilters.includes(filter.id as QuickFilterId);
            return (
              <button
                key={filter.id}
                onClick={() => handleQuickFilterClick(filter.id as QuickFilterId)}
                title={filter.tooltip}
                className={`
                  px-2.5 py-1.5 rounded-md text-body-sm font-medium
                  transition-colors
                  ${isActive
                    ? 'bg-accent-primary text-white'
                    : 'bg-surface-elevated border border-border-subtle hover:border-border-prominent text-text-primary'
                  }
                `}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Genres */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-caption font-medium text-text-secondary flex items-center gap-1.5">
            <Grid3X3 className="w-3.5 h-3.5" />
            Genres
            {selectedGenres.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-accent-primary/20 text-accent-primary text-[10px]">
                {selectedGenres.length}
              </span>
            )}
          </h3>
          <button
            onClick={() => navigateTo('genres')}
            className="text-caption text-accent-primary hover:underline flex items-center gap-0.5"
          >
            Browse all <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        {genresLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {genreOptions.slice(0, 20).map((genre) => {
              const isSelected = selectedGenres.includes(genre.option_id);
              return (
                <button
                  key={genre.option_id}
                  onClick={() => toggleGenre(genre.option_id)}
                  className={`
                    px-2 py-1 rounded-md text-caption
                    transition-colors
                    ${isSelected
                      ? 'bg-accent-primary text-white'
                      : 'bg-surface-elevated border border-border-subtle hover:border-border-prominent text-text-primary'
                    }
                  `}
                >
                  {genre.option_name}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Browse Navigation */}
      <section className="space-y-2">
        <h3 className="text-caption font-medium text-text-secondary">Browse Content</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => navigateTo('tags')}
            className="flex items-center justify-between p-3 rounded-lg
                       bg-surface-elevated border border-border-subtle
                       hover:border-border-prominent transition-colors group"
          >
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-accent-blue" />
              <span className="text-body-sm font-medium text-text-primary">All Tags</span>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
          </button>
          <button
            onClick={() => navigateTo('categories')}
            className="flex items-center justify-between p-3 rounded-lg
                       bg-surface-elevated border border-border-subtle
                       hover:border-border-prominent transition-colors group"
          >
            <div className="flex items-center gap-2">
              <Grid3X3 className="w-4 h-4 text-accent-purple" />
              <span className="text-body-sm font-medium text-text-primary">Categories</span>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
          </button>
        </div>
      </section>

      {/* Metric Shortcuts */}
      <section>
        <h3 className="text-caption font-medium text-text-secondary mb-2">Metric Filters</h3>
        <div className="space-y-1">
          {metricFilters.map((filter) => {
            const icon = getMetricIcon(filter.shortcut);
            return (
              <button
                key={filter.id}
                onClick={() => handleMetricClick(filter.shortcut)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md
                           hover:bg-surface-elevated transition-colors group"
              >
                <div className="flex items-center gap-2">
                  {icon}
                  <span className="text-body-sm text-text-primary">{filter.label}</span>
                </div>
                <code className="text-caption text-text-muted font-mono group-hover:text-accent-primary transition-colors">
                  {filter.shortcut} &gt;
                </code>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getMetricIcon(shortcut: string): React.ReactNode {
  const iconClass = 'w-4 h-4 text-text-muted';
  switch (shortcut) {
    case 'ccu':
      return <Users className={iconClass} />;
    case 'owners':
      return <Users className={iconClass} />;
    case 'reviews':
      return <Star className={iconClass} />;
    case 'score':
      return <Star className={iconClass} />;
    case 'price':
      return <DollarSign className={iconClass} />;
    case 'growth':
      return <TrendingUp className={iconClass} />;
    default:
      return <TrendingUp className={iconClass} />;
  }
}
