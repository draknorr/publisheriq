'use client';

/**
 * URL state hook for Apps table sorting
 * Milestone 2b: Minimal hook for sort/order only
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, useCallback } from 'react';
import type { SortField, SortOrder, AppType } from '../lib/apps-types';

interface UseAppsSortReturn {
  sort: SortField;
  order: SortOrder;
  setSort: (field: SortField) => void;
  isPending: boolean;
}

/**
 * Hook for managing sort state in URL
 * - Reads sort/order from URL params
 * - Toggles order when same field is clicked
 * - Preserves other URL params (type, search)
 */
export function useAppsSort(): UseAppsSortReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Read current sort state from URL
  const sort = (searchParams.get('sort') as SortField) || 'ccu_peak';
  const order = (searchParams.get('order') as SortOrder) || 'desc';

  // Set sort field (toggles order if same field)
  const setSort = useCallback(
    (field: SortField) => {
      const params = new URLSearchParams(searchParams.toString());

      // Toggle order if clicking same field, otherwise default to desc
      const newOrder = sort === field && order === 'desc' ? 'asc' : 'desc';

      // Set sort params
      if (field === 'ccu_peak') {
        params.delete('sort'); // Default, keep URL clean
      } else {
        params.set('sort', field);
      }

      if (newOrder === 'desc') {
        params.delete('order'); // Default, keep URL clean
      } else {
        params.set('order', newOrder);
      }

      const queryString = params.toString();
      const url = queryString ? `/apps?${queryString}` : '/apps';

      startTransition(() => {
        router.push(url, { scroll: false });
      });
    },
    [router, searchParams, sort, order]
  );

  return { sort, order, setSort, isPending };
}
