'use client';

import { useCallback, useMemo, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { parseCompareParam, serializeCompareParam } from '../lib/apps-compare-utils';

const MIN_COMPARE = 2;
const MAX_COMPARE = 5;

interface UseAppsCompareReturn {
  /** App IDs parsed from URL compare param */
  compareAppIds: number[];
  /** Whether compare mode is active (2+ valid IDs) */
  isCompareOpen: boolean;
  /** Whether transition is pending */
  isPending: boolean;
  /** Open compare mode with selected app IDs */
  openCompare: (appids: number[]) => void;
  /** Close compare mode and clear URL param */
  closeCompare: () => void;
  /** Remove a single app from comparison */
  removeFromCompare: (appid: number) => void;
}

/**
 * Hook for managing URL-persisted compare state.
 * Compare state is stored in URL for shareability: ?compare=730,1245620,553850
 */
export function useAppsCompare(): UseAppsCompareReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Parse compare IDs from URL
  const compareAppIds = useMemo(() => {
    return parseCompareParam(searchParams.get('compare'));
  }, [searchParams]);

  const isCompareOpen = compareAppIds.length >= MIN_COMPARE;

  /**
   * Build URL with updated compare param
   */
  const buildUrl = useCallback(
    (appids: number[]) => {
      const params = new URLSearchParams(searchParams.toString());
      const serialized = serializeCompareParam(appids);

      if (serialized) {
        params.set('compare', serialized);
      } else {
        params.delete('compare');
      }

      return `/apps?${params.toString()}`;
    },
    [searchParams]
  );

  /**
   * Open compare mode with selected app IDs
   */
  const openCompare = useCallback(
    (appids: number[]) => {
      if (appids.length < MIN_COMPARE || appids.length > MAX_COMPARE) {
        console.warn(`Compare requires ${MIN_COMPARE}-${MAX_COMPARE} games`);
        return;
      }

      startTransition(() => {
        router.push(buildUrl(appids));
      });
    },
    [router, buildUrl]
  );

  /**
   * Close compare mode and remove URL param
   */
  const closeCompare = useCallback(() => {
    startTransition(() => {
      router.push(buildUrl([]));
    });
  }, [router, buildUrl]);

  /**
   * Remove a single app from comparison
   */
  const removeFromCompare = useCallback(
    (appidToRemove: number) => {
      const remaining = compareAppIds.filter((id) => id !== appidToRemove);

      startTransition(() => {
        router.push(buildUrl(remaining));
      });
    },
    [compareAppIds, router, buildUrl]
  );

  return {
    compareAppIds,
    isCompareOpen,
    isPending,
    openCompare,
    closeCompare,
    removeFromCompare,
  };
}
