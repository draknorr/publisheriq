'use client';

import { useState, useCallback, useRef } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { AppType } from '../lib/apps-types';

/**
 * Filter option returned from get_apps_filter_option_counts RPC
 */
export interface FilterOption {
  option_id: number;
  option_name: string;
  app_count: number;
}

export type FilterType = 'genre' | 'tag' | 'category' | 'steam_deck' | 'platform' | 'ccu_tier';

interface CacheEntry {
  data: FilterOption[];
  timestamp: number;
}

interface ContextFilters {
  minCcu?: number;
  minReviews?: number;
  minScore?: number;
  minOwners?: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Hook for lazy-loading filter option counts with caching.
 * Calls get_apps_filter_option_counts RPC when dropdowns open.
 */
export function useFilterCounts() {
  const [loading, setLoading] = useState<Record<FilterType, boolean>>({
    genre: false,
    tag: false,
    category: false,
    steam_deck: false,
    platform: false,
    ccu_tier: false,
  });

  const [data, setData] = useState<Record<FilterType, FilterOption[]>>({
    genre: [],
    tag: [],
    category: [],
    steam_deck: [],
    platform: [],
    ccu_tier: [],
  });

  const cache = useRef<Record<string, CacheEntry>>({});

  /**
   * Build a cache key from filter type and context.
   * Keys are sorted to ensure consistent cache hits regardless of property order.
   */
  const buildCacheKey = (
    filterType: FilterType,
    appType: AppType,
    context?: ContextFilters
  ): string => {
    const sortedContext = context
      ? JSON.stringify(
          Object.keys(context)
            .sort()
            .reduce((acc, key) => {
              const value = context[key as keyof ContextFilters];
              if (value !== undefined) {
                acc[key] = value;
              }
              return acc;
            }, {} as Record<string, unknown>)
        )
      : '{}';
    return `${filterType}-${appType}-${sortedContext}`;
  };

  /**
   * Fetch counts for a filter type with optional contextual filters.
   * Results are cached for 5 minutes.
   */
  const fetchCounts = useCallback(
    async (
      filterType: FilterType,
      appType: AppType = 'game',
      contextFilters?: ContextFilters
    ): Promise<FilterOption[]> => {
      const cacheKey = buildCacheKey(filterType, appType, contextFilters);

      // Check cache first
      const cached = cache.current[cacheKey];
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setData((prev) => ({ ...prev, [filterType]: cached.data }));
        return cached.data;
      }

      // Set loading state
      setLoading((prev) => ({ ...prev, [filterType]: true }));

      try {
        const supabase = getSupabase();

        const rpcParams = {
          p_filter_type: filterType,
          p_type: appType,
          p_min_ccu: contextFilters?.minCcu,
          p_min_reviews: contextFilters?.minReviews,
          p_min_score: contextFilters?.minScore,
          p_min_owners: contextFilters?.minOwners,
        };

        console.log(`Fetching ${filterType} counts with params:`, rpcParams);

        const response = await supabase.rpc('get_apps_filter_option_counts', rpcParams);

        console.log(`Raw RPC response for ${filterType}:`, response);

        const { data: result, error } = response;

        if (error) {
          console.error(`Error fetching ${filterType} counts:`, error);
          throw error;
        }

        const options = (result ?? []) as FilterOption[];

        console.log(`${filterType} counts result:`, options?.length ?? 0, 'options');

        // Cache the result
        cache.current[cacheKey] = { data: options, timestamp: Date.now() };

        // Update state
        setData((prev) => ({ ...prev, [filterType]: options }));

        return options;
      } finally {
        setLoading((prev) => ({ ...prev, [filterType]: false }));
      }
    },
    []
  );

  /**
   * Clear the cache (useful when filters change significantly)
   */
  const clearCache = useCallback(() => {
    cache.current = {};
  }, []);

  /**
   * Invalidate cache for a specific filter type
   */
  const invalidateFilter = useCallback((filterType: FilterType) => {
    // Remove all entries for this filter type
    Object.keys(cache.current).forEach((key) => {
      if (key.startsWith(filterType)) {
        delete cache.current[key];
      }
    });
  }, []);

  return {
    data,
    loading,
    fetchCounts,
    clearCache,
    invalidateFilter,
  };
}
