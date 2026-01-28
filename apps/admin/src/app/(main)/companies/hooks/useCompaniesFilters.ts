'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, useCallback, useMemo, useRef, useState } from 'react';
import type {
  CompanyType,
  SortField,
  SortOrder,
  QuickFilterId,
  PresetId,
  TimePeriod,
  SteamDeckFilterValue,
  RelationshipFilterValue,
  StatusFilterValue,
  PlatformValue,
  FilterMode,
  ColumnId,
} from '../lib/companies-types';
import {
  QUICK_FILTERS,
  buildFilterParams,
  getPresetById,
  getUnifiedFilterById,
} from '../lib/companies-presets';
import {
  parseColumnsParam,
  serializeColumnsParam,
} from '../lib/companies-columns';

// Stable empty array to avoid reference changes triggering re-renders
const EMPTY_NUMBER_ARRAY: number[] = [];

/**
 * Extended advanced filters state for M4b
 */
export interface AdvancedFiltersState {
  // Metric filters (M4a)
  minGames?: number;
  maxGames?: number;
  minOwners?: number;
  maxOwners?: number;
  minCcu?: number;
  maxCcu?: number;
  minHours?: number;
  maxHours?: number;
  minRevenue?: number;
  maxRevenue?: number;
  minScore?: number;
  maxScore?: number;
  minReviews?: number;
  maxReviews?: number;
  // Growth filters (M4a)
  minGrowth7d?: number;
  maxGrowth7d?: number;
  minGrowth30d?: number;
  maxGrowth30d?: number;
  // Time period (M4a)
  period?: TimePeriod;
  // Content filters (M4b)
  genres?: number[];
  genreMode?: FilterMode;
  tags?: number[];
  categories?: number[];
  steamDeck?: SteamDeckFilterValue;
  platforms?: PlatformValue[];
  platformMode?: FilterMode;
  // Relationship & Activity (M4b)
  status?: StatusFilterValue;
  relationship?: RelationshipFilterValue;
}

export interface UseCompaniesFiltersReturn {
  // Loading state
  isPending: boolean;

  // Current state from URL
  type: CompanyType;
  sort: SortField;
  order: SortOrder;
  search: string;
  activePreset: PresetId | null;
  activeQuickFilters: QuickFilterId[];

  // Advanced filters state
  advancedFilters: AdvancedFiltersState;
  advancedFilterCount: number;
  isAdvancedOpen: boolean;

  // Column customization (M5)
  visibleColumns: ColumnId[];

  // Actions
  setType: (type: CompanyType) => void;
  setSort: (field: SortField) => void;
  setSearch: (search: string) => void;
  toggleQuickFilter: (filterId: QuickFilterId) => void;
  applyPreset: (presetId: string) => void;
  clearAllFilters: () => void;
  clearPreset: () => void;

  // Advanced filter actions (M4a)
  setAdvancedFilter: (field: keyof AdvancedFiltersState, value: number | string | undefined) => void;
  clearAdvancedFilters: () => void;
  applyGrowthPreset: (preset: 'growing' | 'declining' | 'stable', period: '7d' | '30d') => void;
  toggleAdvanced: () => void;

  // Content filter actions (M4b)
  setGenres: (ids: number[]) => void;
  setGenreMode: (mode: FilterMode) => void;
  setTags: (ids: number[]) => void;
  setCategories: (ids: number[]) => void;
  setSteamDeck: (value: SteamDeckFilterValue) => void;
  setPlatforms: (platforms: PlatformValue[]) => void;
  setPlatformMode: (mode: FilterMode) => void;
  setStatus: (status: StatusFilterValue) => void;
  setRelationship: (relationship: RelationshipFilterValue) => void;

  // Column customization actions (M5)
  setColumns: (columns: ColumnId[]) => void;
}

// Valid time periods
const VALID_PERIODS: TimePeriod[] = [
  'all', '2025', '2024', '2023',
  'last_12mo', 'last_6mo', 'last_90d', 'last_30d',
];

// Valid filter modes
const VALID_FILTER_MODES: FilterMode[] = ['any', 'all'];

// Valid platforms
const VALID_PLATFORMS: PlatformValue[] = ['windows', 'mac', 'linux'];

// Note: Validation of Steam Deck, relationship, and status values
// is done inline in the parse functions below

/**
 * Parse a numeric URL param
 */
function parseNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const num = parseFloat(value);
  return isNaN(num) ? undefined : num;
}

/**
 * Parse comma-separated number array from URL
 */
function parseNumberArray(value: string | null): number[] | undefined {
  if (!value) return undefined;
  const ids = value.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
  return ids.length > 0 ? ids : undefined;
}

/**
 * Parse comma-separated platform array from URL
 */
function parsePlatforms(value: string | null): PlatformValue[] | undefined {
  if (!value) return undefined;
  const platforms = value.split(',')
    .map((s) => s.trim().toLowerCase() as PlatformValue)
    .filter((p) => VALID_PLATFORMS.includes(p));
  return platforms.length > 0 ? platforms : undefined;
}

/**
 * Parse filter mode from URL
 */
function parseFilterMode(value: string | null): FilterMode | undefined {
  if (!value) return undefined;
  return VALID_FILTER_MODES.includes(value as FilterMode) ? (value as FilterMode) : undefined;
}

/**
 * Parse Steam Deck filter from URL
 */
function parseSteamDeck(value: string | null): SteamDeckFilterValue | undefined {
  if (!value) return undefined;
  if (value === 'verified' || value === 'playable') return value;
  return undefined;
}

/**
 * Parse relationship filter from URL
 */
function parseRelationship(value: string | null): RelationshipFilterValue | undefined {
  if (!value) return undefined;
  if (value === 'self_published' || value === 'external_devs' || value === 'multi_publisher') {
    return value;
  }
  return undefined;
}

/**
 * Parse status filter from URL
 */
function parseStatus(value: string | null): StatusFilterValue | undefined {
  if (!value) return undefined;
  if (value === 'active' || value === 'dormant') return value;
  return undefined;
}

/**
 * Hook for managing Companies page filter state via URL params
 */
export function useCompaniesFilters(): UseCompaniesFiltersReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local UI state for advanced panel visibility
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Parse current state from URL
  const type = (searchParams.get('type') as CompanyType) || 'all';
  const sort = (searchParams.get('sort') as SortField) || 'estimated_weekly_hours';
  const order = (searchParams.get('order') as SortOrder) || 'desc';
  const search = searchParams.get('search') || '';
  const presetParam = searchParams.get('preset');
  // Validate preset ID against known presets
  const activePreset = presetParam && getUnifiedFilterById(presetParam as PresetId)?.type === 'preset'
    ? (presetParam as PresetId)
    : null;
  const filtersParam = searchParams.get('filters') || '';
  const activeQuickFilters = filtersParam
    ? (filtersParam.split(',').filter((f) => QUICK_FILTERS.some((qf) => qf.id === f)) as QuickFilterId[])
    : [];

  // Parse visible columns (M5)
  const visibleColumns = useMemo(
    () => parseColumnsParam(searchParams.get('columns')),
    [searchParams]
  );

  // Parse advanced filter params
  const periodParam = searchParams.get('period');
  const advancedFilters: AdvancedFiltersState = useMemo(
    () => ({
      // Metric filters (M4a)
      minGames: parseNumber(searchParams.get('minGames')),
      maxGames: parseNumber(searchParams.get('maxGames')),
      minOwners: parseNumber(searchParams.get('minOwners')),
      maxOwners: parseNumber(searchParams.get('maxOwners')),
      minCcu: parseNumber(searchParams.get('minCcu')),
      maxCcu: parseNumber(searchParams.get('maxCcu')),
      minHours: parseNumber(searchParams.get('minHours')),
      maxHours: parseNumber(searchParams.get('maxHours')),
      minRevenue: parseNumber(searchParams.get('minRevenue')),
      maxRevenue: parseNumber(searchParams.get('maxRevenue')),
      minScore: parseNumber(searchParams.get('minScore')),
      maxScore: parseNumber(searchParams.get('maxScore')),
      minReviews: parseNumber(searchParams.get('minReviews')),
      maxReviews: parseNumber(searchParams.get('maxReviews')),
      // Growth filters (M4a)
      minGrowth7d: parseNumber(searchParams.get('minGrowth7d')),
      maxGrowth7d: parseNumber(searchParams.get('maxGrowth7d')),
      minGrowth30d: parseNumber(searchParams.get('minGrowth30d')),
      maxGrowth30d: parseNumber(searchParams.get('maxGrowth30d')),
      // Time period (M4a)
      period: VALID_PERIODS.includes(periodParam as TimePeriod)
        ? (periodParam as TimePeriod)
        : undefined,
      // Content filters (M4b) - use stable empty array when undefined
      genres: parseNumberArray(searchParams.get('genres')) ?? EMPTY_NUMBER_ARRAY,
      genreMode: parseFilterMode(searchParams.get('genreMode')),
      tags: parseNumberArray(searchParams.get('tags')) ?? EMPTY_NUMBER_ARRAY,
      categories: parseNumberArray(searchParams.get('categories')) ?? EMPTY_NUMBER_ARRAY,
      steamDeck: parseSteamDeck(searchParams.get('steamDeck')),
      platforms: parsePlatforms(searchParams.get('platforms')),
      platformMode: parseFilterMode(searchParams.get('platformMode')),
      // Relationship & Activity (M4b)
      status: parseStatus(searchParams.get('status')),
      relationship: parseRelationship(searchParams.get('relationship')),
    }),
    [searchParams, periodParam]
  );

  // Calculate active filter count
  const advancedFilterCount = useMemo(() => {
    let count = 0;
    // Metric filters (each min/max counts as 1)
    if (advancedFilters.minGames !== undefined) count++;
    if (advancedFilters.maxGames !== undefined) count++;
    if (advancedFilters.minOwners !== undefined) count++;
    if (advancedFilters.maxOwners !== undefined) count++;
    if (advancedFilters.minCcu !== undefined) count++;
    if (advancedFilters.maxCcu !== undefined) count++;
    if (advancedFilters.minHours !== undefined) count++;
    if (advancedFilters.maxHours !== undefined) count++;
    if (advancedFilters.minRevenue !== undefined) count++;
    if (advancedFilters.maxRevenue !== undefined) count++;
    if (advancedFilters.minScore !== undefined) count++;
    if (advancedFilters.maxScore !== undefined) count++;
    if (advancedFilters.minReviews !== undefined) count++;
    if (advancedFilters.maxReviews !== undefined) count++;
    // Growth filters
    if (advancedFilters.minGrowth7d !== undefined) count++;
    if (advancedFilters.maxGrowth7d !== undefined) count++;
    if (advancedFilters.minGrowth30d !== undefined) count++;
    if (advancedFilters.maxGrowth30d !== undefined) count++;
    // Time period
    if (advancedFilters.period && advancedFilters.period !== 'all') count++;
    // Content filters (M4b) - each selection counts as 1
    if (advancedFilters.genres && advancedFilters.genres.length > 0) count++;
    if (advancedFilters.tags && advancedFilters.tags.length > 0) count++;
    if (advancedFilters.categories && advancedFilters.categories.length > 0) count++;
    if (advancedFilters.steamDeck) count++;
    if (advancedFilters.platforms && advancedFilters.platforms.length > 0) count++;
    // Relationship & Activity (M4b)
    if (advancedFilters.status) count++;
    if (advancedFilters.relationship) count++;
    return count;
  }, [advancedFilters]);

  // Ref for debouncing URL updates (batches rapid filter changes)
  const urlUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<Record<string, string | null>>({});

  /**
   * Update URL with new params (immediate)
   */
  const updateUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '' || value === undefined) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      startTransition(() => {
        router.push(`/companies?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  /**
   * Update URL with debouncing (for filter inputs to batch rapid changes)
   * This prevents multiple server fetches while user is typing
   */
  const updateUrlDebounced = useCallback(
    (updates: Record<string, string | null>) => {
      // Merge with any pending updates
      pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };

      // Clear existing timeout
      if (urlUpdateTimeoutRef.current) {
        clearTimeout(urlUpdateTimeoutRef.current);
      }

      // Set new debounced update
      urlUpdateTimeoutRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());

        Object.entries(pendingUpdatesRef.current).forEach(([key, value]) => {
          if (value === null || value === '' || value === undefined) {
            params.delete(key);
          } else {
            params.set(key, value);
          }
        });

        // Clear pending updates
        pendingUpdatesRef.current = {};

        startTransition(() => {
          router.push(`/companies?${params.toString()}`);
        });
      }, 400); // 400ms debounce for URL updates
    },
    [router, searchParams]
  );

  /**
   * Set company type filter
   */
  const setType = useCallback(
    (newType: CompanyType) => {
      updateUrl({ type: newType === 'all' ? null : newType, preset: null });
    },
    [updateUrl]
  );

  /**
   * Set sort field and order
   */
  const setSort = useCallback(
    (field: SortField) => {
      const newOrder = sort === field && order === 'desc' ? 'asc' : 'desc';
      updateUrl({ sort: field, order: newOrder });
    },
    [sort, order, updateUrl]
  );

  /**
   * Set search query
   */
  const setSearch = useCallback(
    (query: string) => {
      // Use debounced URL update to batch rapid typing
      updateUrlDebounced({ search: query || null, preset: null });
    },
    [updateUrlDebounced]
  );

  /**
   * Toggle a quick filter on/off
   */
  const toggleQuickFilter = useCallback(
    (filterId: QuickFilterId) => {
      const isActive = activeQuickFilters.includes(filterId);
      let newFilters: QuickFilterId[];

      if (isActive) {
        // Remove filter
        newFilters = activeQuickFilters.filter((f) => f !== filterId);
      } else {
        // Add filter
        newFilters = [...activeQuickFilters, filterId];
      }

      // Build the filter URL params from active filters
      const filterParams = buildFilterParams(newFilters);

      // Build update object
      const updates: Record<string, string | null> = {
        filters: newFilters.length > 0 ? newFilters.join(',') : null,
        preset: null, // Clear preset when manually filtering
        ...filterParams,
      };

      // Clear filter params that are no longer needed
      if (!filterParams.minGames) updates.minGames = null;
      if (!filterParams.maxGames) updates.maxGames = null;
      if (!filterParams.minOwners) updates.minOwners = null;
      if (!filterParams.maxOwners) updates.maxOwners = null;
      if (!filterParams.minRevenue) updates.minRevenue = null;
      if (!filterParams.minGrowth7d) updates.minGrowth7d = null;
      if (!filterParams.maxGrowth7d) updates.maxGrowth7d = null;
      if (!filterParams.status) updates.status = null;

      updateUrl(updates);
    },
    [activeQuickFilters, updateUrl]
  );

  /**
   * Apply a preset view (clears other filters including advanced)
   */
  const applyPreset = useCallback(
    (presetId: string) => {
      const preset = getPresetById(presetId);
      if (!preset) return;

      // Build updates from preset - clear all filters first (including advanced)
      const updates: Record<string, string | null> = {
        preset: presetId,
        sort: preset.sort,
        order: preset.order,
        // Reset type to 'all' unless preset specifies otherwise
        type: preset.filters.type ?? null,
        // Clear all filter-related params
        search: null,
        filters: null,
        minGames: null,
        maxGames: null,
        minOwners: null,
        maxOwners: null,
        minCcu: null,
        maxCcu: null,
        minHours: null,
        maxHours: null,
        minRevenue: null,
        maxRevenue: null,
        minScore: null,
        maxScore: null,
        minReviews: null,
        maxReviews: null,
        minGrowth7d: null,
        maxGrowth7d: null,
        minGrowth30d: null,
        maxGrowth30d: null,
        period: null,
        status: null,
      };

      // Apply preset filters (type already handled above)
      if (preset.filters.minGames !== undefined) updates.minGames = String(preset.filters.minGames);
      if (preset.filters.maxGames !== undefined) updates.maxGames = String(preset.filters.maxGames);
      if (preset.filters.minOwners !== undefined) updates.minOwners = String(preset.filters.minOwners);
      if (preset.filters.maxOwners !== undefined) updates.maxOwners = String(preset.filters.maxOwners);
      if (preset.filters.minRevenue !== undefined) updates.minRevenue = String(preset.filters.minRevenue);
      if (preset.filters.minGrowth7d !== undefined) updates.minGrowth7d = String(preset.filters.minGrowth7d);
      if (preset.filters.status) updates.status = preset.filters.status;

      updateUrl(updates);
    },
    [updateUrl]
  );

  /**
   * Clear preset (keep other filters)
   */
  const clearPreset = useCallback(() => {
    updateUrl({ preset: null });
  }, [updateUrl]);

  /**
   * Clear all filters and reset to defaults
   */
  const clearAllFilters = useCallback(() => {
    router.push('/companies');
  }, [router]);

  /**
   * Set a single advanced filter field
   */
  const setAdvancedFilter = useCallback(
    (field: keyof AdvancedFiltersState, value: number | string | undefined) => {
      const stringValue = value !== undefined ? String(value) : null;
      // Use debounced URL update to batch rapid filter changes
      updateUrlDebounced({
        [field]: stringValue,
        preset: null, // Clear preset when manually filtering
      });
    },
    [updateUrlDebounced]
  );

  /**
   * Clear all advanced filters (M4a + M4b)
   */
  const clearAdvancedFilters = useCallback(() => {
    updateUrl({
      // Metric filters (M4a)
      minGames: null,
      maxGames: null,
      minOwners: null,
      maxOwners: null,
      minCcu: null,
      maxCcu: null,
      minHours: null,
      maxHours: null,
      minRevenue: null,
      maxRevenue: null,
      minScore: null,
      maxScore: null,
      minReviews: null,
      maxReviews: null,
      // Growth filters (M4a)
      minGrowth7d: null,
      maxGrowth7d: null,
      minGrowth30d: null,
      maxGrowth30d: null,
      period: null,
      // Content filters (M4b)
      genres: null,
      genreMode: null,
      tags: null,
      categories: null,
      steamDeck: null,
      platforms: null,
      platformMode: null,
      // Relationship & Activity (M4b)
      status: null,
      relationship: null,
    });
  }, [updateUrl]);

  /**
   * Apply a growth preset (Growing, Declining, Stable)
   */
  const applyGrowthPreset = useCallback(
    (preset: 'growing' | 'declining' | 'stable', period: '7d' | '30d') => {
      const minKey = period === '7d' ? 'minGrowth7d' : 'minGrowth30d';
      const maxKey = period === '7d' ? 'maxGrowth7d' : 'maxGrowth30d';

      const updates: Record<string, string | null> = { preset: null };

      switch (preset) {
        case 'growing':
          updates[minKey] = '10';
          updates[maxKey] = null;
          break;
        case 'declining':
          updates[minKey] = null;
          updates[maxKey] = '-10';
          break;
        case 'stable':
          updates[minKey] = '-10';
          updates[maxKey] = '10';
          break;
      }

      updateUrl(updates);
    },
    [updateUrl]
  );

  // ========================================
  // M4b: Content filter setters
  // ========================================

  /**
   * Set genre filter (array of genre IDs)
   */
  const setGenres = useCallback(
    (ids: number[]) => {
      updateUrl({
        genres: ids.length > 0 ? ids.join(',') : null,
        preset: null,
      });
    },
    [updateUrl]
  );

  /**
   * Set genre mode (any/all)
   */
  const setGenreMode = useCallback(
    (mode: FilterMode) => {
      updateUrl({ genreMode: mode, preset: null });
    },
    [updateUrl]
  );

  /**
   * Set tag filter (array of tag IDs)
   */
  const setTags = useCallback(
    (ids: number[]) => {
      updateUrl({
        tags: ids.length > 0 ? ids.join(',') : null,
        preset: null,
      });
    },
    [updateUrl]
  );

  /**
   * Set category filter (array of category IDs)
   */
  const setCategories = useCallback(
    (ids: number[]) => {
      updateUrl({
        categories: ids.length > 0 ? ids.join(',') : null,
        preset: null,
      });
    },
    [updateUrl]
  );

  /**
   * Set Steam Deck filter
   */
  const setSteamDeck = useCallback(
    (value: SteamDeckFilterValue) => {
      updateUrl({
        steamDeck: value ?? null,
        preset: null,
      });
    },
    [updateUrl]
  );

  /**
   * Set platform filter (array of platforms)
   */
  const setPlatforms = useCallback(
    (platforms: PlatformValue[]) => {
      updateUrl({
        platforms: platforms.length > 0 ? platforms.join(',') : null,
        preset: null,
      });
    },
    [updateUrl]
  );

  /**
   * Set platform mode (any/all)
   */
  const setPlatformMode = useCallback(
    (mode: FilterMode) => {
      updateUrl({ platformMode: mode, preset: null });
    },
    [updateUrl]
  );

  /**
   * Set activity status filter
   */
  const setStatus = useCallback(
    (status: StatusFilterValue) => {
      updateUrl({
        status: status ?? null,
        preset: null,
      });
    },
    [updateUrl]
  );

  /**
   * Set relationship filter
   */
  const setRelationship = useCallback(
    (relationship: RelationshipFilterValue) => {
      updateUrl({
        relationship: relationship ?? null,
        preset: null,
      });
    },
    [updateUrl]
  );

  // ========================================
  // M5: Column customization
  // ========================================

  /**
   * Set visible columns
   */
  const setColumns = useCallback(
    (columns: ColumnId[]) => {
      updateUrl({
        columns: serializeColumnsParam(columns),
      });
    },
    [updateUrl]
  );

  /**
   * Toggle advanced filters panel visibility
   */
  const toggleAdvanced = useCallback(() => {
    setIsAdvancedOpen((prev) => !prev);
  }, []);

  return {
    isPending,
    type,
    sort,
    order,
    search,
    activePreset,
    activeQuickFilters,
    advancedFilters,
    advancedFilterCount,
    isAdvancedOpen,
    // M5
    visibleColumns,
    setType,
    setSort,
    setSearch,
    toggleQuickFilter,
    applyPreset,
    clearAllFilters,
    clearPreset,
    // M4a
    setAdvancedFilter,
    clearAdvancedFilters,
    applyGrowthPreset,
    toggleAdvanced,
    // M4b
    setGenres,
    setGenreMode,
    setTags,
    setCategories,
    setSteamDeck,
    setPlatforms,
    setPlatformMode,
    setStatus,
    setRelationship,
    // M5
    setColumns,
  };
}
