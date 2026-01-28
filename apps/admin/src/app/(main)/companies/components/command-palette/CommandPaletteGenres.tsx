'use client';

/**
 * Command Palette Genres View for Companies
 *
 * Genre selection with:
 * - Back navigation to Home View
 * - Match mode toggle (ANY/ALL)
 * - Genre search
 * - Selected genres bar
 * - Grid layout
 */

import { useRef, useEffect, useState, useMemo } from 'react';
import {
  ChevronLeft,
  Search,
  X,
  Loader2,
  Check,
} from 'lucide-react';
import type { UseCommandPaletteReturn } from '../../hooks/useCommandPalette';
import type { FilterOption } from '../../lib/companies-types';

// ============================================================================
// Types
// ============================================================================

interface CommandPaletteGenresProps {
  palette: UseCommandPaletteReturn;
  genreOptions: FilterOption[];
  isLoading?: boolean;
  onOpen?: () => void;
  onDone: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function CommandPaletteGenres({
  palette,
  genreOptions,
  isLoading = false,
  onOpen,
  onDone,
}: CommandPaletteGenresProps) {
  const {
    state,
    goBack,
    toggleGenre,
    setGenreMatchMode,
    clearGenres,
  } = palette;
  const { selectedGenres, genreMatchMode } = state;

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load genres when opened
  useEffect(() => {
    if (genreOptions.length === 0 && onOpen) {
      onOpen();
    }
  }, [genreOptions.length, onOpen]);

  // Focus search on mount
  useEffect(() => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  }, []);

  // Filter genres by search
  const filteredGenres = useMemo(() => {
    if (!searchQuery.trim()) return genreOptions;

    const query = searchQuery.toLowerCase();
    return genreOptions.filter((genre) =>
      genre.option_name.toLowerCase().includes(query)
    );
  }, [genreOptions, searchQuery]);

  // Get selected genre names for display
  const selectedGenreNames = useMemo(() => {
    return selectedGenres
      .map((id) => genreOptions.find((g) => g.option_id === id)?.option_name)
      .filter(Boolean) as string[];
  }, [selectedGenres, genreOptions]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border-subtle">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={goBack}
              className="p-1.5 rounded-md hover:bg-surface-elevated transition-colors"
              aria-label="Back to home"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-body font-semibold text-text-primary">Genres</h2>
              <p className="text-caption text-text-muted">
                {selectedGenres.length > 0
                  ? `${selectedGenres.length} selected`
                  : 'Filter companies by game genres'}
              </p>
            </div>
          </div>

          {/* Match Mode Toggle */}
          <div className="flex items-center gap-1 bg-surface-elevated rounded-lg p-1">
            <button
              onClick={() => setGenreMatchMode('any')}
              className={`px-2.5 py-1 rounded-md text-caption font-medium transition-colors
                ${genreMatchMode === 'any'
                  ? 'bg-accent-primary text-white'
                  : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              Match ANY
            </button>
            <button
              onClick={() => setGenreMatchMode('all')}
              className={`px-2.5 py-1 rounded-md text-caption font-medium transition-colors
                ${genreMatchMode === 'all'
                  ? 'bg-accent-primary text-white'
                  : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              Match ALL
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter genres..."
            className="w-full pl-10 pr-4 py-2 rounded-lg
                       bg-surface-elevated border border-border-subtle
                       text-body text-text-primary placeholder:text-text-muted
                       focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
          />
        </div>
      </div>

      {/* Selected Genres Bar */}
      {selectedGenres.length > 0 && (
        <div className="px-4 py-2 border-b border-border-subtle bg-surface-elevated/50">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {selectedGenreNames.slice(0, 5).map((name, index) => (
              <span
                key={selectedGenres[index]}
                className="flex items-center gap-1 px-2 py-1 rounded-md
                           bg-accent-primary/20 text-accent-primary text-caption
                           whitespace-nowrap"
              >
                {name}
                <button
                  onClick={() => toggleGenre(selectedGenres[index])}
                  className="hover:bg-accent-primary/20 rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedGenres.length > 5 && (
              <span className="text-caption text-text-muted whitespace-nowrap">
                +{selectedGenres.length - 5} more
              </span>
            )}
            <button
              onClick={clearGenres}
              className="text-caption text-accent-red hover:underline whitespace-nowrap ml-auto"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
          </div>
        ) : filteredGenres.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-body text-text-muted">No genres found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredGenres.map((genre) => {
              const isSelected = selectedGenres.includes(genre.option_id);
              return (
                <button
                  key={genre.option_id}
                  onClick={() => toggleGenre(genre.option_id)}
                  className={`
                    flex items-center justify-between px-3 py-2 rounded-md
                    text-left text-body-sm transition-colors
                    ${isSelected
                      ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                      : 'bg-surface-elevated border border-border-subtle hover:border-border-prominent text-text-primary'
                    }
                  `}
                >
                  <span className="truncate">{genre.option_name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-caption text-text-muted">
                      {formatCount(genre.company_count)}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border-subtle bg-surface-elevated/50">
        <div className="flex items-center justify-between">
          <span className="text-caption text-text-muted">
            {selectedGenres.length} genre{selectedGenres.length !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={onDone}
            className="px-4 py-2 rounded-lg bg-accent-primary text-white text-body-sm font-medium
                       hover:bg-accent-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`;
  }
  return count.toString();
}
