'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SavedView, CompanyType, SortField, SortOrder } from '../lib/companies-types';
import type { AdvancedFiltersState } from './useCompaniesFilters';

const STORAGE_KEY = 'publisheriq-companies-saved-views';
const MAX_SAVED_VIEWS = 10;

/**
 * Hook for managing saved views in localStorage
 */
export function useSavedViews() {
  const [views, setViews] = useState<SavedView[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setViews(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load saved views:', e);
    }
    setIsLoaded(true);
  }, []);

  // Persist to localStorage
  const persist = useCallback((newViews: SavedView[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newViews));
    } catch (e) {
      console.error('Failed to save views:', e);
    }
  }, []);

  /**
   * Save current filters as a new view
   */
  const saveView = useCallback(
    (
      name: string,
      filters: AdvancedFiltersState,
      columns: string[] | undefined,
      sort: SortField,
      order: SortOrder,
      type: CompanyType
    ): SavedView | null => {
      if (!name.trim()) return null;
      if (views.length >= MAX_SAVED_VIEWS) {
        console.warn(`Maximum ${MAX_SAVED_VIEWS} saved views reached`);
        return null;
      }

      const newView: SavedView = {
        id: `view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: name.trim(),
        createdAt: new Date().toISOString(),
        filters: { ...filters },
        columns,
        sort,
        order,
        type,
      };

      const newViews = [...views, newView];
      setViews(newViews);
      persist(newViews);
      return newView;
    },
    [views, persist]
  );

  /**
   * Delete a saved view by ID
   */
  const deleteView = useCallback(
    (id: string) => {
      const newViews = views.filter((v) => v.id !== id);
      setViews(newViews);
      persist(newViews);
    },
    [views, persist]
  );

  /**
   * Rename a saved view
   */
  const renameView = useCallback(
    (id: string, newName: string) => {
      if (!newName.trim()) return;
      const newViews = views.map((v) =>
        v.id === id ? { ...v, name: newName.trim() } : v
      );
      setViews(newViews);
      persist(newViews);
    },
    [views, persist]
  );

  /**
   * Get a view by ID
   */
  const getView = useCallback(
    (id: string): SavedView | undefined => {
      return views.find((v) => v.id === id);
    },
    [views]
  );

  return {
    views,
    isLoaded,
    saveView,
    deleteView,
    renameView,
    getView,
  };
}
