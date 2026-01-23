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

import { useRef, useEffect, useMemo, useState } from 'react';
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
  X,
} from 'lucide-react';
import type { UseCommandPaletteReturn } from '../../hooks/useCommandPalette';
import type { FilterOption } from '../../hooks/useFilterCounts';
import type { PresetId, QuickFilterId } from '../../lib/apps-types';
import { PRESETS, QUICK_FILTERS } from '../../lib/apps-presets';
import { getMetricFilters } from '../../lib/filter-registry';
import type { ParsedQuickFilter, ParsedPreset } from '../../lib/filter-syntax-parser';

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

  // State for presets expansion
  const [presetsExpanded, setPresetsExpanded] = useState(false);

  // Get presets and quick filters
  const presets = useMemo(() => PRESETS, []);
  const visiblePresets = presetsExpanded ? presets : presets.slice(0, 6);
  const quickFilters = useMemo(() => QUICK_FILTERS, []);
  const metricFilters = useMemo(() => getMetricFilters().slice(0, 5), []);

  // Quick filter groupings for organized display
  const quickFilterGroups = useMemo(() => [
    { label: 'Discovery', ids: ['popular', 'trending', 'well_reviewed', 'free'] },
    { label: 'Platform', ids: ['indie', 'steam_deck', 'momentum_up', 'sentiment_up'] },
    { label: 'Status', ids: ['workshop', 'early_access', 'on_sale', 'this_week'] },
  ], []);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  // Handle applying the parsed filter (handles quick_filter and preset types)
  const handleApplyParsedFilter = () => {
    if (!parsedFilter?.success || !parsedFilter.filter) return;

    const filter = parsedFilter.filter;

    if (filter.type === 'quick_filter') {
      const qf = (filter as ParsedQuickFilter).quickFilter;
      onToggleQuickFilter(qf.id);
      close();
    } else if (filter.type === 'preset') {
      const p = (filter as ParsedPreset).preset;
      onApplyPreset(p.id);
      close();
    } else {
      applyParsedFilter();
    }
  };

  // Handle Enter key in search
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && parsedFilter?.success) {
      e.preventDefault();
      handleApplyParsedFilter();
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
      {/* Search Input with Close Button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
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
        <button
          onClick={close}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
          aria-label="Close palette"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Parsed Filter Preview */}
      {parsedFilter?.success && parsedFilter.filter && (
        <button
          onClick={handleApplyParsedFilter}
          className="w-full flex items-center justify-between p-3 rounded-lg
                     bg-accent-green/10 border border-accent-green/30
                     hover:bg-accent-green/15 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-accent-green" />
            <span className="text-body text-text-primary">
              {parsedFilter.filter.type === 'quick_filter' ? (
                <>Enable: <span className="font-medium">{parsedFilter.filter.displayText}</span></>
              ) : parsedFilter.filter.type === 'preset' ? (
                <>Apply: <span className="font-medium">{parsedFilter.filter.displayText}</span></>
              ) : (
                <>Add filter: <span className="font-medium">{parsedFilter.filter.displayText}</span></>
              )}
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
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-caption font-medium text-text-secondary flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Presets
          </h3>
          <button
            onClick={() => setPresetsExpanded(!presetsExpanded)}
            className="text-caption text-accent-primary hover:underline"
          >
            {presetsExpanded ? 'Show less' : `Show all ${presets.length}`}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {visiblePresets.map((preset) => {
            const isActive = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset.id as PresetId)}
                className={`
                  flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-body-sm
                  transition-colors
                  ${isActive
                    ? 'bg-accent-primary/15 border border-accent-primary/30 text-accent-primary'
                    : 'bg-surface-elevated border border-border-subtle hover:border-border-prominent text-text-primary'
                  }
                `}
              >
                {preset.emoji && <span className="text-sm">{preset.emoji}</span>}
                <span className="font-medium truncate">{preset.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Quick Filters - Grouped by Category */}
      <section>
        <h3 className="text-caption font-medium text-text-secondary mb-2 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" />
          Quick Filters
        </h3>
        <div className="space-y-2">
          {quickFilterGroups.map((group) => (
            <div key={group.label} className="flex items-start gap-2">
              <span className="text-[10px] uppercase tracking-wide text-text-muted w-[60px] flex-shrink-0 pt-1.5">
                {group.label}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {group.ids.map((id) => {
                  const filter = quickFilters.find((f) => f.id === id);
                  if (!filter) return null;
                  const isActive = activeQuickFilters.includes(id as QuickFilterId);
                  return (
                    <button
                      key={id}
                      onClick={() => handleQuickFilterClick(id as QuickFilterId)}
                      title={filter.description}
                      className={`
                        px-2 py-1 rounded-md text-caption font-medium transition-colors
                        ${isActive
                          ? 'bg-accent-primary/20 text-accent-primary'
                          : 'bg-surface-elevated border border-border-subtle hover:border-border-prominent text-text-primary'
                        }
                      `}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
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
          <div className="grid grid-cols-4 gap-1.5">
            {genreOptions.slice(0, 8).map((genre) => {
              const isSelected = selectedGenres.includes(genre.option_id);
              return (
                <button
                  key={genre.option_id}
                  onClick={() => toggleGenre(genre.option_id)}
                  className={`
                    px-2 py-1.5 rounded-md text-caption text-center transition-colors
                    ${isSelected
                      ? 'bg-accent-primary/20 text-accent-primary'
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
        <h3 className="text-caption font-medium text-text-secondary flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5" />
          Browse Content
        </h3>
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
        <h3 className="text-caption font-medium text-text-secondary mb-2 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          Metric Filters
        </h3>
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
