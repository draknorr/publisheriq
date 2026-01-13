'use client';

import { useState, useEffect, useCallback } from 'react';

const CACHE_KEY = 'piq-autocomplete-cache';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface AutocompleteCache {
  tags: string[];
  genres: string[];
  categories: string[];
  cachedAt: number;
}

interface AutocompleteData {
  tags: string[];
  genres: string[];
  categories: string[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to pre-fetch and cache tags/genres/categories for instant autocomplete.
 * Caches in localStorage with 1-hour TTL.
 */
export function useAutocompleteData(): AutocompleteData {
  const [data, setData] = useState<AutocompleteData>({
    tags: [],
    genres: [],
    categories: [],
    isLoading: true,
    error: null,
  });

  const loadFromCache = useCallback((): AutocompleteCache | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const parsed: AutocompleteCache = JSON.parse(cached);

      // Check if cache is still valid
      if (Date.now() - parsed.cachedAt < CACHE_TTL_MS) {
        return parsed;
      }

      return null;
    } catch {
      return null;
    }
  }, []);

  const saveToCache = useCallback((cache: AutocompleteCache) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      // localStorage might be full or unavailable
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/autocomplete/tags');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result: AutocompleteCache = await response.json();

      // Save to cache
      saveToCache(result);

      setData({
        tags: result.tags,
        genres: result.genres,
        categories: result.categories,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load',
      }));
    }
  }, [saveToCache]);

  useEffect(() => {
    // Try to load from cache first
    const cached = loadFromCache();
    if (cached) {
      setData({
        tags: cached.tags,
        genres: cached.genres,
        categories: cached.categories,
        isLoading: false,
        error: null,
      });
      return;
    }

    // Fetch from API if no valid cache
    fetchData();
  }, [loadFromCache, fetchData]);

  return data;
}

/**
 * Filter items by case-insensitive substring match.
 * Returns items sorted by match position (exact prefix > contains).
 */
export function filterAutocompleteItems(
  items: string[],
  query: string,
  maxResults = 10
): string[] {
  if (!query.trim()) return [];

  const queryLower = query.toLowerCase();

  // Separate into prefix matches and contains matches
  const prefixMatches: string[] = [];
  const containsMatches: string[] = [];

  for (const item of items) {
    const itemLower = item.toLowerCase();
    if (itemLower.startsWith(queryLower)) {
      prefixMatches.push(item);
    } else if (itemLower.includes(queryLower)) {
      containsMatches.push(item);
    }
  }

  // Prefix matches first, then contains matches
  return [...prefixMatches, ...containsMatches].slice(0, maxResults);
}
