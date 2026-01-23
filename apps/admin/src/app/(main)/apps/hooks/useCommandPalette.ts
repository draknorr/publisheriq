'use client';

/**
 * Command Palette State Hook
 *
 * Manages state for the command palette including:
 * - Open/close state
 * - Current view (home, tags, categories)
 * - Search input and parsed filter
 * - Selected content (tags, genres, categories)
 * - Expanded accordion sections
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { parseFilterSyntax, filterToUrlParams, type ParseResult } from '../lib/filter-syntax-parser';

// ============================================================================
// Types
// ============================================================================

export type PaletteView = 'home' | 'tags' | 'categories' | 'genres';

export interface CommandPaletteState {
  isOpen: boolean;
  view: PaletteView;
  searchInput: string;
  parsedFilter: ParseResult | null;
  // Content selections (temporary state before applying)
  selectedTags: number[];
  tagMatchMode: 'any' | 'all';
  selectedGenres: number[];
  genreMatchMode: 'any' | 'all';
  selectedCategories: number[];
  // UI state
  expandedSections: string[];
  recentTags: number[];
}

export interface UseCommandPaletteOptions {
  // Initial values from current filter state
  initialTags?: number[];
  initialTagMode?: 'any' | 'all';
  initialGenres?: number[];
  initialGenreMode?: 'any' | 'all';
  initialCategories?: number[];
  // Callbacks
  onApplyFilter?: (params: Record<string, string>) => void;
  onApplyTags?: (tags: number[], mode: 'any' | 'all') => void;
  onApplyGenres?: (genres: number[], mode: 'any' | 'all') => void;
  onApplyCategories?: (categories: number[]) => void;
}

export interface UseCommandPaletteReturn {
  // State
  state: CommandPaletteState;
  // Open/close
  open: () => void;
  close: () => void;
  toggle: () => void;
  // Navigation
  navigateTo: (view: PaletteView) => void;
  goBack: () => void;
  // Search
  setSearchInput: (value: string) => void;
  clearSearch: () => void;
  // Tag selection
  toggleTag: (tagId: number) => void;
  setTagMatchMode: (mode: 'any' | 'all') => void;
  clearTags: () => void;
  // Genre selection
  toggleGenre: (genreId: number) => void;
  setGenreMatchMode: (mode: 'any' | 'all') => void;
  clearGenres: () => void;
  // Category selection
  toggleCategory: (categoryId: number) => void;
  clearCategories: () => void;
  // Accordion
  toggleSection: (sectionId: string) => void;
  // Apply
  applyParsedFilter: () => void;
  applyContentSelections: () => void;
}

// Session storage key for expanded sections
const EXPANDED_SECTIONS_KEY = 'command-palette-expanded-sections';
const RECENT_TAGS_KEY = 'command-palette-recent-tags';

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCommandPalette(
  options: UseCommandPaletteOptions = {}
): UseCommandPaletteReturn {
  const {
    initialTags = [],
    initialTagMode = 'any',
    initialGenres = [],
    initialGenreMode = 'all',
    initialCategories = [],
    onApplyFilter,
    onApplyTags,
    onApplyGenres,
    onApplyCategories,
  } = options;

  // Load persisted state from sessionStorage
  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    if (typeof window === 'undefined') return ['popular', 'sub-genre'];
    try {
      const stored = sessionStorage.getItem(EXPANDED_SECTIONS_KEY);
      return stored ? JSON.parse(stored) : ['popular', 'sub-genre'];
    } catch {
      return ['popular', 'sub-genre'];
    }
  });

  const [recentTags, setRecentTags] = useState<number[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = sessionStorage.getItem(RECENT_TAGS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Core state
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<PaletteView>('home');
  const [searchInput, setSearchInputState] = useState('');
  const [parsedFilter, setParsedFilter] = useState<ParseResult | null>(null);

  // Content selections (synced from initial values when opening)
  const [selectedTags, setSelectedTags] = useState<number[]>(initialTags);
  const [tagMatchMode, setTagMatchModeState] = useState<'any' | 'all'>(initialTagMode);
  const [selectedGenres, setSelectedGenres] = useState<number[]>(initialGenres);
  const [genreMatchMode, setGenreMatchModeState] = useState<'any' | 'all'>(initialGenreMode);
  const [selectedCategories, setSelectedCategories] = useState<number[]>(initialCategories);

  // Debounce ref for search parsing
  const parseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs to track current state for callbacks (avoids stale closure issues)
  const viewRef = useRef<PaletteView>(view);
  const selectedTagsRef = useRef<number[]>(selectedTags);
  const tagMatchModeRef = useRef<'any' | 'all'>(tagMatchMode);
  const selectedGenresRef = useRef<number[]>(selectedGenres);
  const genreMatchModeRef = useRef<'any' | 'all'>(genreMatchMode);
  const selectedCategoriesRef = useRef<number[]>(selectedCategories);

  // Keep refs in sync with state (synchronous assignment, not useEffect)
  viewRef.current = view;
  selectedTagsRef.current = selectedTags;
  tagMatchModeRef.current = tagMatchMode;
  selectedGenresRef.current = selectedGenres;
  genreMatchModeRef.current = genreMatchMode;
  selectedCategoriesRef.current = selectedCategories;

  // Persist expanded sections to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(EXPANDED_SECTIONS_KEY, JSON.stringify(expandedSections));
    }
  }, [expandedSections]);

  // Persist recent tags to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(RECENT_TAGS_KEY, JSON.stringify(recentTags.slice(0, 10)));
    }
  }, [recentTags]);

  // Sync selections when initial values change (e.g., URL params change)
  useEffect(() => {
    if (!isOpen) {
      setSelectedTags(initialTags);
      setTagMatchModeState(initialTagMode);
      setSelectedGenres(initialGenres);
      setGenreMatchModeState(initialGenreMode);
      setSelectedCategories(initialCategories);
    }
  }, [isOpen, initialTags, initialTagMode, initialGenres, initialGenreMode, initialCategories]);

  // Parse search input with debounce
  useEffect(() => {
    if (parseTimeoutRef.current) {
      clearTimeout(parseTimeoutRef.current);
    }

    if (!searchInput.trim()) {
      setParsedFilter(null);
      return;
    }

    parseTimeoutRef.current = setTimeout(() => {
      const result = parseFilterSyntax(searchInput);
      setParsedFilter(result);
    }, 150);

    return () => {
      if (parseTimeoutRef.current) {
        clearTimeout(parseTimeoutRef.current);
      }
    };
  }, [searchInput]);

  // -------------------------------------------------------------------------
  // Open/Close
  // -------------------------------------------------------------------------

  const open = useCallback(() => {
    setIsOpen(true);
    setView('home');
    setSearchInputState('');
    setParsedFilter(null);
    // Sync with current filter state
    setSelectedTags(initialTags);
    setTagMatchModeState(initialTagMode);
    setSelectedGenres(initialGenres);
    setGenreMatchModeState(initialGenreMode);
    setSelectedCategories(initialCategories);
  }, [initialTags, initialTagMode, initialGenres, initialGenreMode, initialCategories]);

  const close = useCallback(() => {
    // When closing, auto-apply ALL selections using refs for latest values
    // Note: Apply from any view (including 'home') since users can select genres/tags there too
    const currentTags = selectedTagsRef.current;
    const currentTagMode = tagMatchModeRef.current;
    const currentGenres = selectedGenresRef.current;
    const currentGenreMode = genreMatchModeRef.current;
    const currentCategories = selectedCategoriesRef.current;

    // Apply all content selections if there are any selected items
    if (currentTags.length > 0 && onApplyTags) {
      onApplyTags(currentTags, currentTagMode);
    }
    if (currentGenres.length > 0 && onApplyGenres) {
      onApplyGenres(currentGenres, currentGenreMode);
    }
    if (currentCategories.length > 0 && onApplyCategories) {
      onApplyCategories(currentCategories);
    }

    setIsOpen(false);
    // Don't reset view - keep it for next open
  }, [onApplyTags, onApplyGenres, onApplyCategories]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  const navigateTo = useCallback((newView: PaletteView) => {
    viewRef.current = newView; // Sync ref immediately
    setView(newView);
    setSearchInputState('');
    setParsedFilter(null);
  }, []);

  const goBack = useCallback(() => {
    // When going back from a content view, auto-apply the selections using refs for latest values
    const currentView = viewRef.current;
    const currentTags = selectedTagsRef.current;
    const currentTagMode = tagMatchModeRef.current;
    const currentGenres = selectedGenresRef.current;
    const currentGenreMode = genreMatchModeRef.current;
    const currentCategories = selectedCategoriesRef.current;

    // Apply content selections based on current view before navigating
    if (currentView === 'tags' && currentTags.length > 0 && onApplyTags) {
      onApplyTags(currentTags, currentTagMode);
    }
    if (currentView === 'genres' && currentGenres.length > 0 && onApplyGenres) {
      onApplyGenres(currentGenres, currentGenreMode);
    }
    if (currentView === 'categories' && currentCategories.length > 0 && onApplyCategories) {
      onApplyCategories(currentCategories);
    }

    setView('home');
    setSearchInputState('');
    setParsedFilter(null);
  }, [onApplyTags, onApplyGenres, onApplyCategories]);

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  const setSearchInput = useCallback((value: string) => {
    setSearchInputState(value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchInputState('');
    setParsedFilter(null);
  }, []);

  // -------------------------------------------------------------------------
  // Tag Selection
  // -------------------------------------------------------------------------

  const toggleTag = useCallback((tagId: number) => {
    setSelectedTags((prev) => {
      const isSelected = prev.includes(tagId);
      const newTags = isSelected
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId];

      // Synchronously update ref for immediate access in goBack/close
      selectedTagsRef.current = newTags;

      // Update recent tags (add to front, keep unique)
      if (!isSelected) {
        setRecentTags((recent) => {
          const filtered = recent.filter((id) => id !== tagId);
          return [tagId, ...filtered].slice(0, 10);
        });
      }

      return newTags;
    });
  }, []);

  const setTagMatchMode = useCallback((mode: 'any' | 'all') => {
    tagMatchModeRef.current = mode;
    setTagMatchModeState(mode);
  }, []);

  const clearTags = useCallback(() => {
    selectedTagsRef.current = [];
    setSelectedTags([]);
  }, []);

  // -------------------------------------------------------------------------
  // Genre Selection
  // -------------------------------------------------------------------------

  const toggleGenre = useCallback((genreId: number) => {
    setSelectedGenres((prev) => {
      const newGenres = prev.includes(genreId)
        ? prev.filter((id) => id !== genreId)
        : [...prev, genreId];
      // Synchronously update ref for immediate access in close/goBack
      selectedGenresRef.current = newGenres;
      return newGenres;
    });
  }, []);

  const setGenreMatchMode = useCallback((mode: 'any' | 'all') => {
    genreMatchModeRef.current = mode;
    setGenreMatchModeState(mode);
  }, []);

  const clearGenres = useCallback(() => {
    selectedGenresRef.current = [];
    setSelectedGenres([]);
  }, []);

  // -------------------------------------------------------------------------
  // Category Selection
  // -------------------------------------------------------------------------

  const toggleCategory = useCallback((categoryId: number) => {
    setSelectedCategories((prev) => {
      const newCategories = prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId];
      // Synchronously update ref for immediate access in close/goBack
      selectedCategoriesRef.current = newCategories;
      return newCategories;
    });
  }, []);

  const clearCategories = useCallback(() => {
    selectedCategoriesRef.current = [];
    setSelectedCategories([]);
  }, []);

  // -------------------------------------------------------------------------
  // Accordion
  // -------------------------------------------------------------------------

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  }, []);

  // -------------------------------------------------------------------------
  // Apply Actions
  // -------------------------------------------------------------------------

  const applyParsedFilter = useCallback(() => {
    if (!parsedFilter?.success || !parsedFilter.filter) return;

    const params = filterToUrlParams(parsedFilter.filter);

    if (onApplyFilter && Object.keys(params).length > 0) {
      onApplyFilter(params);
    }

    // Clear search and close
    setSearchInputState('');
    setParsedFilter(null);
    close();
  }, [parsedFilter, onApplyFilter, close]);

  const applyContentSelections = useCallback(() => {
    // Apply all content selections
    if (onApplyTags) {
      onApplyTags(selectedTags, tagMatchMode);
    }
    if (onApplyGenres) {
      onApplyGenres(selectedGenres, genreMatchMode);
    }
    if (onApplyCategories) {
      onApplyCategories(selectedCategories);
    }

    close();
  }, [
    selectedTags,
    tagMatchMode,
    selectedGenres,
    genreMatchMode,
    selectedCategories,
    onApplyTags,
    onApplyGenres,
    onApplyCategories,
    close,
  ]);

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    state: {
      isOpen,
      view,
      searchInput,
      parsedFilter,
      selectedTags,
      tagMatchMode,
      selectedGenres,
      genreMatchMode,
      selectedCategories,
      expandedSections,
      recentTags,
    },
    open,
    close,
    toggle,
    navigateTo,
    goBack,
    setSearchInput,
    clearSearch,
    toggleTag,
    setTagMatchMode,
    clearTags,
    toggleGenre,
    setGenreMatchMode,
    clearGenres,
    toggleCategory,
    clearCategories,
    toggleSection,
    applyParsedFilter,
    applyContentSelections,
  };
}
