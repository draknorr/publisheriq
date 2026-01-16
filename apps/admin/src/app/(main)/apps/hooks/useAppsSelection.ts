'use client';

import { useState, useCallback, useRef } from 'react';
import type { App } from '../lib/apps-types';

const MAX_SELECTION = 50; // Maximum items that can be selected

interface UseAppsSelectionReturn {
  /** Set of selected app IDs */
  selectedAppIds: Set<number>;
  /** Number of selected apps */
  selectedCount: number;
  /** Check if a specific app is selected */
  isSelected: (appid: number) => boolean;
  /** Whether all visible apps are selected */
  isAllVisibleSelected: (visibleApps: App[]) => boolean;
  /** Whether some but not all visible apps are selected */
  isIndeterminate: (visibleApps: App[]) => boolean;
  /** Toggle selection for a single app (supports shift-click for range) */
  toggleSelection: (
    appid: number,
    index: number,
    visibleApps: App[],
    shiftKey?: boolean
  ) => void;
  /** Toggle selection for all visible apps */
  toggleAllVisible: (visibleApps: App[]) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Get selected apps from the visible list */
  getSelectedApps: (allApps: App[]) => App[];
  /** Get array of selected app IDs */
  getSelectedAppIds: () => number[];
}

/**
 * Hook for managing ephemeral app selection state
 * Selection is NOT persisted to URL (too volatile)
 */
export function useAppsSelection(): UseAppsSelectionReturn {
  const [selectedAppIds, setSelectedAppIds] = useState<Set<number>>(new Set());
  const lastSelectedIndexRef = useRef<number | null>(null);

  const isSelected = useCallback(
    (appid: number): boolean => {
      return selectedAppIds.has(appid);
    },
    [selectedAppIds]
  );

  const isAllVisibleSelected = useCallback(
    (visibleApps: App[]): boolean => {
      if (visibleApps.length === 0) return false;
      return visibleApps.every((app) => selectedAppIds.has(app.appid));
    },
    [selectedAppIds]
  );

  const isIndeterminate = useCallback(
    (visibleApps: App[]): boolean => {
      if (visibleApps.length === 0) return false;
      const selectedInVisible = visibleApps.filter((app) =>
        selectedAppIds.has(app.appid)
      ).length;
      return selectedInVisible > 0 && selectedInVisible < visibleApps.length;
    },
    [selectedAppIds]
  );

  const toggleSelection = useCallback(
    (
      appid: number,
      index: number,
      visibleApps: App[],
      shiftKey: boolean = false
    ) => {
      setSelectedAppIds((prev) => {
        const next = new Set(prev);

        // Shift-click range selection
        if (shiftKey && lastSelectedIndexRef.current !== null) {
          const start = Math.min(lastSelectedIndexRef.current, index);
          const end = Math.max(lastSelectedIndexRef.current, index);

          for (let i = start; i <= end; i++) {
            const app = visibleApps[i];
            if (app && next.size < MAX_SELECTION) {
              next.add(app.appid);
            }
          }
        } else {
          // Single click toggle
          if (next.has(appid)) {
            next.delete(appid);
          } else if (next.size < MAX_SELECTION) {
            next.add(appid);
          }
        }

        return next;
      });

      lastSelectedIndexRef.current = index;
    },
    []
  );

  const toggleAllVisible = useCallback((visibleApps: App[]) => {
    setSelectedAppIds((prev) => {
      const allSelected = visibleApps.every((app) => prev.has(app.appid));

      if (allSelected) {
        // Deselect all visible
        const next = new Set(prev);
        visibleApps.forEach((app) => {
          next.delete(app.appid);
        });
        return next;
      } else {
        // Select all visible (up to max)
        const next = new Set(prev);
        for (const app of visibleApps) {
          if (next.size >= MAX_SELECTION) break;
          next.add(app.appid);
        }
        return next;
      }
    });

    lastSelectedIndexRef.current = null;
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedAppIds(new Set());
    lastSelectedIndexRef.current = null;
  }, []);

  const getSelectedApps = useCallback(
    (allApps: App[]): App[] => {
      return allApps.filter((app) => selectedAppIds.has(app.appid));
    },
    [selectedAppIds]
  );

  const getSelectedAppIds = useCallback((): number[] => {
    return Array.from(selectedAppIds);
  }, [selectedAppIds]);

  return {
    selectedAppIds,
    selectedCount: selectedAppIds.size,
    isSelected,
    isAllVisibleSelected,
    isIndeterminate,
    toggleSelection,
    toggleAllVisible,
    clearSelection,
    getSelectedApps,
    getSelectedAppIds,
  };
}
