'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { List } from 'react-window';
import { ChevronDown, X, Search, Check } from 'lucide-react';
import type { FilterOption } from '../../hooks/useFilterCounts';

export type FilterMode = 'any' | 'all';

interface GenreTagFilterProps {
  label: string;
  filterType: 'genre' | 'tag';
  selected: number[];
  mode: FilterMode;
  options: FilterOption[];
  isLoading: boolean;
  onSelect: (ids: number[]) => void;
  onModeChange: (mode: FilterMode) => void;
  onOpen: () => void; // Triggers lazy load
  disabled?: boolean;
}

/**
 * Multi-select dropdown with search, counts, and mode toggle (Has Any / Has All)
 */
export function GenreTagFilter({
  label,
  filterType,
  selected,
  mode,
  options,
  isLoading,
  onSelect,
  onModeChange,
  onOpen,
  disabled = false,
}: GenreTagFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Handle search input with debounce
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value); // Immediate UI update

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 150); // 150ms debounce
  }, []);

  // Filter options by debounced search query
  const filteredOptions = useMemo(() => {
    if (!debouncedSearch) return options;
    const lower = debouncedSearch.toLowerCase();
    return options.filter((o) => o.option_name.toLowerCase().includes(lower));
  }, [options, debouncedSearch]);

  // Create a Map for O(1) lookups
  const optionMap = useMemo(() => {
    return new Map(options.map((o) => [o.option_id, o.option_name]));
  }, [options]);

  // Get names for selected IDs (for badges) - O(1) Map lookup
  const selectedNames = useMemo(() => {
    return selected.map((id) => optionMap.get(id) ?? `ID:${id}`);
  }, [selected, optionMap]);

  // Handle dropdown open
  const handleOpen = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    onOpen();
  }, [onOpen, disabled]);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
        setDebouncedSearch('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Toggle an option
  const handleToggle = useCallback(
    (id: number) => {
      if (selected.includes(id)) {
        onSelect(selected.filter((s) => s !== id));
      } else {
        onSelect([...selected, id]);
      }
    },
    [selected, onSelect]
  );

  // Remove a selected item
  const handleRemove = useCallback(
    (id: number) => {
      onSelect(selected.filter((s) => s !== id));
    },
    [selected, onSelect]
  );

  return (
    <div className="space-y-2" ref={dropdownRef}>
      <div className="flex items-center justify-between">
        <label className="text-body-sm font-medium text-text-secondary">{label}</label>
        {selected.length > 0 && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onModeChange('any')}
              disabled={disabled}
              className={`px-2 py-0.5 text-caption rounded transition-colors ${
                mode === 'any'
                  ? 'bg-accent-primary/20 text-accent-primary'
                  : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
              }`}
            >
              Any
            </button>
            <button
              type="button"
              onClick={() => onModeChange('all')}
              disabled={disabled}
              className={`px-2 py-0.5 text-caption rounded transition-colors ${
                mode === 'all'
                  ? 'bg-accent-primary/20 text-accent-primary'
                  : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
              }`}
            >
              All
            </button>
          </div>
        )}
      </div>

      {/* Selected badges */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((id, i) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent-primary/15 text-accent-primary text-caption"
            >
              {selectedNames[i]}
              <button
                type="button"
                onClick={() => handleRemove(id)}
                disabled={disabled}
                className="hover:text-accent-primary/70"
              >
                <X className="h-3 w-3" />
              </button>
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
            {selected.length === 0
              ? `Select ${label.toLowerCase()}...`
              : `${selected.length} selected`}
          </span>
          <ChevronDown className="h-4 w-4" />
        </button>

        {/* Dropdown panel */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-surface-raised border border-border-muted rounded-lg shadow-lg max-h-72 overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-border-subtle">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}...`}
                  className="w-full h-8 pl-8 pr-3 rounded bg-surface-elevated border border-border-subtle text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary"
                  autoFocus
                />
              </div>
            </div>

            {/* Options - Virtualized for performance */}
            <div className="h-52">
              {isLoading ? (
                <div className="px-3 py-4 text-center text-body-sm text-text-muted">
                  Loading {filterType}s...
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="px-3 py-4 text-center text-body-sm text-text-muted">
                  No {filterType}s found
                </div>
              ) : (
                <List<Record<string, never>>
                  className="h-52"
                  rowCount={filteredOptions.length}
                  rowHeight={40}
                  rowProps={{}}
                  rowComponent={({ index, style }) => {
                    const option = filteredOptions[index];
                    const isSelected = selected.includes(option.option_id);
                    return (
                      <button
                        key={option.option_id}
                        type="button"
                        style={style}
                        onClick={() => handleToggle(option.option_id)}
                        className={`w-full px-3 flex items-center justify-between text-body-sm transition-colors ${
                          isSelected
                            ? 'bg-accent-primary/10 text-text-primary'
                            : 'text-text-secondary hover:bg-surface-elevated'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`w-4 h-4 flex items-center justify-center ${
                              isSelected ? '' : 'opacity-0'
                            }`}
                          >
                            <Check className="h-4 w-4 text-accent-primary" />
                          </span>
                          {option.option_name}
                        </span>
                        <span className="text-caption text-text-muted">
                          {option.app_count.toLocaleString()}
                        </span>
                      </button>
                    );
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
