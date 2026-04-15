'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthReady } from '@/hooks/useAuthReady';
import type {
  AppType,
  ChangeActivityDetail,
  ChangeActivityMode,
  ChangeActivityRow,
  ChangeActivitySignalFamily,
  ChangeActivitySort,
  ChangeActivityView,
  ChangeFeedActivityDetailResponse,
  ChangeFeedActivityResponse,
  ChangeFeedStatus,
} from './lib';
import {
  CHANGE_ACTIVITY_SIGNAL_FAMILIES,
  CHANGE_FEED_APP_TYPES,
  getDefaultChangeActivitySort,
  parseChangeActivityMode,
  parseChangeActivityView,
  resolveChangeActivitySort,
} from './lib';
import { ChangeFeedWorkspace } from './ChangeFeedWorkspace';
import type { SelectedGame } from './ChangeFeedGamePicker';

type FeedRange = '24h' | '7d' | '30d';
type AppTypeFilter = 'all' | AppType;
type InspectorMode = 'readable' | 'raw';
type FilterUpdateValue = string | string[] | null;

interface ChangeFeedPageClientProps {
  initialMode?: string;
  initialView?: string;
  initialRange?: string;
  initialAppTypes?: string;
  initialSignals?: string;
  initialSort?: string;
  initialSearch?: string;
  initialActivityResponse?: ChangeFeedActivityResponse;
}

const RANGE_OPTIONS: Array<{ id: FeedRange; label: string }> = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
];

function parseRange(value: string | null | undefined): FeedRange {
  return RANGE_OPTIONS.some((option) => option.id === value) ? (value as FeedRange) : '7d';
}

function parseAppType(value: string | null | undefined): AppTypeFilter {
  if (!value) {
    return 'all';
  }

  return CHANGE_FEED_APP_TYPES.includes(value as AppType) ? (value as AppType) : 'all';
}

function parseSignalFamilies(value: string | null | undefined): ChangeActivitySignalFamily[] {
  if (!value) {
    return [];
  }

  const allowed = new Set<ChangeActivitySignalFamily>(CHANGE_ACTIVITY_SIGNAL_FAMILIES);
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry): entry is ChangeActivitySignalFamily =>
      allowed.has(entry as ChangeActivitySignalFamily)
    );
}

function parseAppIds(value: string | null | undefined): number[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isInteger(entry) && entry > 0);
}

function parseSelectedGames(searchParams: ReturnType<typeof useSearchParams>): SelectedGame[] {
  const appIds = parseAppIds(searchParams.get('appIds'));
  const appNames = searchParams.getAll('appNames');

  return appIds.map((appid, index) => ({
    appid,
    name: appNames[index]?.trim() || `App ${appid}`,
  }));
}

function rangeToDays(range: FeedRange): number {
  switch (range) {
    case '24h':
      return 1;
    case '30d':
      return 30;
    default:
      return 7;
  }
}

function buildUrl(
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>,
  updates: Record<string, FilterUpdateValue>
): string {
  const params = new URLSearchParams(searchParams.toString());
  const nextViewUpdate = Array.isArray(updates.view) ? updates.view[0] : updates.view;
  const nextView = parseChangeActivityView(nextViewUpdate ?? searchParams.get('view'));
  const defaultSort = getDefaultChangeActivitySort(nextView);

  for (const [key, value] of Object.entries(updates)) {
    params.delete(key);

    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }

      if (key === 'appNames') {
        value.forEach((entry) => params.append(key, entry));
      } else {
        params.set(key, value.join(','));
      }
      continue;
    }

    const shouldDelete =
      value == null ||
      value === '' ||
      value === 'all' ||
      (key === 'view' && value === 'overview') ||
      (key === 'mode' && value === 'all') ||
      (key === 'range' && value === '7d') ||
      (key === 'sort' && value === defaultSort);

    if (!shouldDelete) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function buildActivityParams(args: {
  range: FeedRange;
  view: ChangeActivityView;
  mode: ChangeActivityMode;
  sort: ChangeActivitySort;
  appType: AppTypeFilter;
  signalFamilies: ChangeActivitySignalFamily[];
  search: string;
  appIds: number[];
  cursor?: string | null;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set('days', String(rangeToDays(args.range)));
  params.set('view', args.view);
  params.set('mode', args.mode);
  params.set('sort', args.sort);
  params.set('limit', '50');

  if (args.appIds.length > 0) {
    params.set('appIds', args.appIds.join(','));
  }
  if (args.appType !== 'all') {
    params.set('appTypes', args.appType);
  }
  if (args.signalFamilies.length > 0) {
    params.set('signals', args.signalFamilies.join(','));
  }
  if (args.search) {
    params.set('search', args.search);
  }
  if (args.cursor) {
    params.set('cursor', args.cursor);
  }

  return params;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? 'Request failed');
  }

  return response.json() as Promise<T>;
}

export function ChangeFeedPageClient({
  initialMode,
  initialView,
  initialRange,
  initialAppTypes,
  initialSignals,
  initialSort,
  initialSearch,
  initialActivityResponse,
}: ChangeFeedPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authReady = useAuthReady();
  const [, startTransition] = useTransition();
  const pathname = '/changes';

  const view = parseChangeActivityView(searchParams.get('view') ?? initialView);
  const mode = parseChangeActivityMode(searchParams.get('mode') ?? initialMode);
  const range = parseRange(searchParams.get('range') ?? initialRange);
  const appType = parseAppType(searchParams.get('appTypes') ?? initialAppTypes);
  const signalFamilies = parseSignalFamilies(searchParams.get('signals') ?? initialSignals);
  const sort = resolveChangeActivitySort(searchParams.get('sort') ?? initialSort, view);
  const search = searchParams.get('search') ?? initialSearch ?? '';
  const selectedGames = parseSelectedGames(searchParams);
  const selectedAppIds = selectedGames.map((game) => game.appid);
  const selectedActivityId = searchParams.get('activity');
  const queryKey = [
    view,
    mode,
    range,
    appType,
    signalFamilies.join(','),
    sort,
    search,
    selectedAppIds.join(','),
  ].join('|');
  const hasServerActivityResponse = Boolean(initialActivityResponse);

  const [searchInput, setSearchInput] = useState(search);
  const deferredSearch = useDeferredValue(searchInput);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>('readable');

  const [items, setItems] = useState<ChangeActivityRow[]>(() => initialActivityResponse?.items ?? []);
  const [cursor, setCursor] = useState<string | null>(() => initialActivityResponse?.nextCursor ?? null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(() =>
    initialActivityResponse ? queryKey : null
  );

  const [details, setDetails] = useState<Record<string, ChangeActivityDetail>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const detailRequestRef = useRef<string | null>(null);

  const [status, setStatus] = useState<ChangeFeedStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const requestVersionRef = useRef(0);
  const previousQueryKeyRef = useRef(queryKey);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    setInspectorMode('readable');
  }, [selectedActivityId]);

  useEffect(() => {
    if (deferredSearch === search) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextUrl = buildUrl(pathname, searchParams, {
        search: deferredSearch || null,
        activity: null,
        cursor: null,
      });

      startTransition(() => {
        router.replace(nextUrl, { scroll: false });
      });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [deferredSearch, pathname, router, search, searchParams, startTransition]);

  useEffect(() => {
    if (previousQueryKeyRef.current === queryKey) {
      return;
    }

    previousQueryKeyRef.current = queryKey;
    requestVersionRef.current += 1;
    setError(null);
    setLoading(false);
    setLoadingMore(false);
    setDetailErrors({});
    setDetailLoadingId(null);

    if (hasServerActivityResponse) {
      return;
    }

    setItems([]);
    setCursor(null);
    setLoadedKey(null);
  }, [hasServerActivityResponse, queryKey]);

  useEffect(() => {
    if (!initialActivityResponse) {
      return;
    }

    setItems(initialActivityResponse.items);
    setCursor(initialActivityResponse.nextCursor);
    setError(null);
    setLoading(false);
    setLoadingMore(false);
    setLoadedKey(queryKey);
  }, [initialActivityResponse, queryKey]);

  useEffect(() => {
    if (!authReady || hasServerActivityResponse || loadedKey === queryKey) {
      return;
    }

    const version = requestVersionRef.current;
    let cancelled = false;

    const loadActivity = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = buildActivityParams({
          range,
          view,
          mode,
          sort,
          appType,
          signalFamilies,
          search,
          appIds: selectedAppIds,
        });
        const data = await fetchJson<ChangeFeedActivityResponse>(
          `/api/change-feed/activity?${params.toString()}`
        );

        if (!cancelled && requestVersionRef.current === version) {
          setItems(data.items);
          setCursor(data.nextCursor);
          setLoadedKey(queryKey);
        }
      } catch (nextError) {
        if (!cancelled && requestVersionRef.current === version) {
          setItems([]);
          setCursor(null);
          setError(nextError instanceof Error ? nextError.message : 'Failed to load Steam activity');
        }
      } finally {
        if (!cancelled && requestVersionRef.current === version) {
          setLoading(false);
        }
      }
    };

    loadActivity();

    return () => {
      cancelled = true;
    };
  }, [
    authReady,
    hasServerActivityResponse,
    loadedKey,
    queryKey,
    range,
    view,
    mode,
    sort,
    appType,
    signalFamilies,
    search,
    selectedAppIds,
  ]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    let cancelled = false;

    const loadStatus = async () => {
      try {
        const nextStatus = await fetchJson<ChangeFeedStatus>('/api/change-feed/status');
        if (!cancelled) {
          setStatus(nextStatus);
          setStatusError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setStatus(null);
          setStatusError(nextError instanceof Error ? nextError.message : 'Status unavailable');
        }
      }
    };

    loadStatus();

    return () => {
      cancelled = true;
    };
  }, [authReady]);

  useEffect(() => {
    if (
      !selectedActivityId ||
      details[selectedActivityId] ||
      detailRequestRef.current === selectedActivityId
    ) {
      return;
    }

    const controller = new AbortController();
    detailRequestRef.current = selectedActivityId;
    setDetailLoadingId(selectedActivityId);
    setDetailErrors((current) => {
      const next = { ...current };
      delete next[selectedActivityId];
      return next;
    });

    fetchJson<ChangeFeedActivityDetailResponse>(
      `/api/change-feed/activity/${encodeURIComponent(selectedActivityId)}`,
      { signal: controller.signal }
    )
      .then((response) => {
        setDetails((current) => ({
          ...current,
          [selectedActivityId]: response.item,
        }));
      })
      .catch((nextError) => {
        if (controller.signal.aborted) {
          return;
        }

        setDetailErrors((current) => ({
          ...current,
          [selectedActivityId]:
            nextError instanceof Error ? nextError.message : 'Failed to load activity detail',
        }));
      })
      .finally(() => {
        if (detailRequestRef.current === selectedActivityId) {
          detailRequestRef.current = null;
        }
        setDetailLoadingId((current) => (current === selectedActivityId ? null : current));
      });

    return () => {
      controller.abort();
      if (detailRequestRef.current === selectedActivityId) {
        detailRequestRef.current = null;
      }
    };
  }, [details, selectedActivityId]);

  const handleUpdateFilters = (updates: Record<string, FilterUpdateValue>) => {
    const nextUrl = buildUrl(pathname, searchParams, {
      ...updates,
      activity: updates.activity ?? null,
      cursor: null,
    });

    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  };

  const handleClearFilters = () => {
    setSearchInput('');
    const nextUrl = buildUrl(pathname, searchParams, {
      view: null,
      mode: null,
      range: null,
      appTypes: null,
      signals: null,
      sort: null,
      search: null,
      appIds: null,
      appNames: null,
      activity: null,
      cursor: null,
    });

    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  };

  const handleLoadMore = async () => {
    if (!cursor || loadingMore) {
      return;
    }

    const version = requestVersionRef.current;
    setLoadingMore(true);

    try {
      const params = buildActivityParams({
        range,
        view,
        mode,
        sort,
        appType,
        signalFamilies,
        search,
        appIds: selectedAppIds,
        cursor,
      });

      const data = await fetchJson<ChangeFeedActivityResponse>(
        `/api/change-feed/activity?${params.toString()}`
      );

      if (requestVersionRef.current !== version) {
        return;
      }

      setItems((current) => {
        const seen = new Set(current.map((item) => item.activityId));
        const merged = [...current];

        data.items.forEach((item) => {
          if (!seen.has(item.activityId)) {
            seen.add(item.activityId);
            merged.push(item);
          }
        });

        return merged;
      });
      setCursor(data.nextCursor);
    } catch (nextError) {
      if (requestVersionRef.current === version) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load more activity');
      }
    } finally {
      if (requestVersionRef.current === version) {
        setLoadingMore(false);
      }
    }
  };

  const selectedRow = useMemo(
    () => items.find((item) => item.activityId === selectedActivityId) ?? null,
    [items, selectedActivityId]
  );

  return (
    <ChangeFeedWorkspace
      authReady={authReady}
      status={status}
      statusError={statusError}
      loading={loading}
      loadingMore={loadingMore}
      error={error}
      items={items}
      cursor={cursor}
      selectedActivityId={selectedActivityId}
      selectedRow={selectedRow}
      selectedDetail={selectedActivityId ? details[selectedActivityId] ?? null : null}
      selectedDetailLoading={detailLoadingId === selectedActivityId}
      selectedDetailError={selectedActivityId ? detailErrors[selectedActivityId] ?? null : null}
      inspectorMode={inspectorMode}
      searchInput={searchInput}
      selectedApps={selectedGames}
      view={view}
      mode={mode}
      range={range}
      sort={sort}
      appType={appType}
      signalFamilies={signalFamilies}
      showAdvancedFilters={showAdvancedFilters}
      onUpdateFilters={handleUpdateFilters}
      onSearchInputChange={setSearchInput}
      onClearFilters={handleClearFilters}
      onToggleAdvancedFilters={() => setShowAdvancedFilters((current) => !current)}
      onSelectActivity={(activityId) => {
        handleUpdateFilters({
          activity: activityId,
        });
      }}
      onInspectorModeChange={setInspectorMode}
      onLoadMore={handleLoadMore}
    />
  );
}
