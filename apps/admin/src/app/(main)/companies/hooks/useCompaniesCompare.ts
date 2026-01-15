'use client';

import { useCallback, useMemo, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  parseCompareParam,
  serializeCompareParam,
  type CompanyIdentifier,
} from '../lib/companies-types';

const MIN_COMPARE = 2;
const MAX_COMPARE = 5;

interface UseCompaniesCompareReturn {
  /** Company identifiers parsed from URL compare param */
  compareIds: CompanyIdentifier[];
  /** Whether compare mode is active (2+ valid IDs) */
  isCompareOpen: boolean;
  /** Whether transition is pending */
  isPending: boolean;
  /** Open compare mode with selected companies */
  openCompare: (ids: CompanyIdentifier[]) => void;
  /** Close compare mode and clear URL param */
  closeCompare: () => void;
  /** Remove a single company from comparison */
  removeFromCompare: (id: CompanyIdentifier) => void;
}

/**
 * Hook for managing URL-persisted compare state.
 * Compare state is stored in URL for shareability: ?compare=pub:123,dev:456
 */
export function useCompaniesCompare(): UseCompaniesCompareReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Parse compare IDs from URL
  const compareIds = useMemo(() => {
    return parseCompareParam(searchParams.get('compare'));
  }, [searchParams]);

  const isCompareOpen = compareIds.length >= MIN_COMPARE;

  /**
   * Build URL with updated compare param
   */
  const buildUrl = useCallback(
    (ids: CompanyIdentifier[]) => {
      const params = new URLSearchParams(searchParams.toString());
      const serialized = serializeCompareParam(ids);

      if (serialized) {
        params.set('compare', serialized);
      } else {
        params.delete('compare');
      }

      return `/companies?${params.toString()}`;
    },
    [searchParams]
  );

  /**
   * Open compare mode with selected companies
   */
  const openCompare = useCallback(
    (ids: CompanyIdentifier[]) => {
      if (ids.length < MIN_COMPARE || ids.length > MAX_COMPARE) {
        console.warn(`Compare requires ${MIN_COMPARE}-${MAX_COMPARE} companies`);
        return;
      }

      startTransition(() => {
        router.push(buildUrl(ids));
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
   * Remove a single company from comparison
   */
  const removeFromCompare = useCallback(
    (idToRemove: CompanyIdentifier) => {
      const remaining = compareIds.filter(
        (id) => !(id.id === idToRemove.id && id.type === idToRemove.type)
      );

      startTransition(() => {
        router.push(buildUrl(remaining));
      });
    },
    [compareIds, router, buildUrl]
  );

  return {
    compareIds,
    isCompareOpen,
    isPending,
    openCompare,
    closeCompare,
    removeFromCompare,
  };
}
