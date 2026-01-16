'use client';

import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { GenreTagFilter, type FilterMode } from './GenreTagFilter';
import type { FilterOption } from '../../hooks/useFilterCounts';

interface ContentFiltersProps {
  // Genres
  genres: number[];
  genreMode: FilterMode;
  genreOptions: FilterOption[];
  genreLoading: boolean;
  onGenresChange: (ids: number[]) => void;
  onGenreModeChange: (mode: FilterMode) => void;
  onGenreOpen: () => void;

  // Tags
  tags: number[];
  tagMode: FilterMode;
  tagOptions: FilterOption[];
  tagLoading: boolean;
  onTagsChange: (ids: number[]) => void;
  onTagModeChange: (mode: FilterMode) => void;
  onTagOpen: () => void;

  // Categories
  categories: number[];
  categoryOptions: FilterOption[];
  categoryLoading: boolean;
  onCategoriesChange: (ids: number[]) => void;
  onCategoryOpen: () => void;

  // Workshop toggle
  hasWorkshop: boolean | undefined;
  onWorkshopChange: (value: boolean | undefined) => void;

  disabled?: boolean;
}

/**
 * Content filters: Genres, Tags, Categories, Workshop
 */
export function ContentFilters({
  genres,
  genreMode,
  genreOptions,
  genreLoading,
  onGenresChange,
  onGenreModeChange,
  onGenreOpen,
  tags,
  tagMode,
  tagOptions,
  tagLoading,
  onTagsChange,
  onTagModeChange,
  onTagOpen,
  categories,
  categoryOptions,
  categoryLoading,
  onCategoriesChange,
  onCategoryOpen,
  hasWorkshop,
  onWorkshopChange,
  disabled = false,
}: ContentFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Grid for Genres and Tags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GenreTagFilter
          label="Genres"
          filterType="genre"
          selected={genres}
          mode={genreMode}
          options={genreOptions}
          isLoading={genreLoading}
          onSelect={onGenresChange}
          onModeChange={onGenreModeChange}
          onOpen={onGenreOpen}
          disabled={disabled}
        />

        <GenreTagFilter
          label="Tags"
          filterType="tag"
          selected={tags}
          mode={tagMode}
          options={tagOptions}
          isLoading={tagLoading}
          onSelect={onTagsChange}
          onModeChange={onTagModeChange}
          onOpen={onTagOpen}
          disabled={disabled}
        />
      </div>

      {/* Categories dropdown */}
      <CategoryDropdown
        categories={categories}
        options={categoryOptions}
        isLoading={categoryLoading}
        onChange={onCategoriesChange}
        onOpen={onCategoryOpen}
        disabled={disabled}
      />

      {/* Workshop toggle */}
      <div className="flex items-center gap-3">
        <label className="text-body-sm font-medium text-text-secondary">Workshop</label>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onWorkshopChange(undefined)}
            disabled={disabled}
            className={`px-2.5 py-1 text-caption rounded transition-colors ${
              hasWorkshop === undefined
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
            }`}
          >
            Any
          </button>
          <button
            type="button"
            onClick={() => onWorkshopChange(true)}
            disabled={disabled}
            className={`px-2.5 py-1 text-caption rounded transition-colors ${
              hasWorkshop === true
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
            }`}
          >
            Has Workshop
          </button>
          <button
            type="button"
            onClick={() => onWorkshopChange(false)}
            disabled={disabled}
            className={`px-2.5 py-1 text-caption rounded transition-colors ${
              hasWorkshop === false
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
            }`}
          >
            No Workshop
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Category multi-select dropdown with search
 */
function CategoryDropdown({
  categories,
  options,
  isLoading,
  onChange,
  onOpen,
  disabled = false,
}: {
  categories: number[];
  options: FilterOption[];
  isLoading: boolean;
  onChange: (ids: number[]) => void;
  onOpen: () => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Track if we've already fetched for this open session
  const hasFetchedRef = useRef(false);

  // Filter options by search
  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => o.option_name.toLowerCase().includes(lower));
  }, [options, search]);

  // Get names for selected categories
  const selectedNames = useMemo(() => {
    return categories
      .map((id) => options.find((o) => o.option_id === id)?.option_name)
      .filter(Boolean);
  }, [categories, options]);

  // Handle dropdown open - only trigger fetch when transitioning from closed to open
  const handleOpen = useCallback(() => {
    if (disabled) return;
    if (!isOpen && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      onOpen();
    }
    setIsOpen(true);
  }, [onOpen, disabled, isOpen]);

  // Reset fetch flag when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      hasFetchedRef.current = false;
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = useCallback(
    (id: number) => {
      if (categories.includes(id)) {
        onChange(categories.filter((c) => c !== id));
      } else {
        onChange([...categories, id]);
      }
    },
    [categories, onChange]
  );

  return (
    <div className="space-y-2" ref={dropdownRef}>
      <label className="text-body-sm font-medium text-text-secondary">Categories</label>

      {/* Selected chips */}
      {selectedNames.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedNames.map((name, i) => (
            <span
              key={categories[i]}
              className="px-2 py-0.5 rounded bg-accent-primary/15 text-accent-primary text-caption"
            >
              {name}
            </span>
          ))}
        </div>
      )}

      {/* Dropdown trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={handleOpen}
          disabled={disabled}
          className={`w-full h-9 px-3 flex items-center justify-between rounded-md bg-surface-elevated border border-border-muted text-body-sm text-text-secondary hover:border-border-prominent transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <span>
            {categories.length === 0 ? 'Select categories...' : `${categories.length} selected`}
          </span>
          <ChevronDown className="h-4 w-4" />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-surface-raised border border-border-muted rounded-lg shadow-lg max-h-72 overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-border-subtle">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search categories..."
                  className="w-full h-8 pl-8 pr-3 rounded bg-surface-elevated border border-border-subtle text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary"
                  autoFocus
                />
              </div>
            </div>

            {/* Options */}
            <div className="max-h-52 overflow-y-auto">
              {isLoading ? (
                <div className="px-3 py-4 text-center text-body-sm text-text-muted">
                  Loading categories...
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-body-sm text-text-muted">
                  No categories found
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = categories.includes(option.option_id);
                  return (
                    <button
                      key={option.option_id}
                      type="button"
                      onClick={() => handleToggle(option.option_id)}
                      className={`w-full px-3 py-2 flex items-center justify-between text-body-sm transition-colors ${
                        isSelected
                          ? 'bg-accent-primary/10 text-text-primary'
                          : 'text-text-secondary hover:bg-surface-elevated'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-4 h-4 flex items-center justify-center ${isSelected ? '' : 'opacity-0'}`}>
                          <Check className="h-4 w-4 text-accent-primary" />
                        </span>
                        {option.option_name}
                      </span>
                      <span className="text-caption text-text-muted">
                        {option.app_count.toLocaleString()}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
