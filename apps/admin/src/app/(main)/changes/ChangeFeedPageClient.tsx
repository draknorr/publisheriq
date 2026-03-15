'use client';

import {
  type KeyboardEvent,
  type ReactNode,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowUpRight,
  ExternalLink,
  Loader2,
  Newspaper,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Badge, Button, Card, Input, Popover, UnderlineTabs } from '@/components/ui';
import { useAuthReady } from '@/hooks/useAuthReady';
import { ChangeFeedDrawer } from './ChangeFeedDrawer';
import type {
  AppType,
  ChangeBurstDetail,
  ChangeBurstDetailResponse,
  ChangeBurstRow,
  ChangeFeedBurstsResponse,
  ChangeFeedCursor,
  ChangeFeedPreset,
  ChangeFeedSource,
  ChangeFeedStatus,
  ChangeFeedStatusState,
  ChangeNewsRow,
  ChangeFeedNewsResponse,
} from './lib';
import {
  CHANGE_FEED_APP_TYPES,
  CHANGE_FEED_PRESETS,
  CHANGE_FEED_SOURCES,
} from './lib';

type FeedTab = 'feed' | 'news';
type FeedRange = '24h' | '7d' | '30d';
type AppTypeFilter = 'all' | AppType;
type SourceFilter = 'all' | ChangeFeedSource;

interface ChangeFeedPageClientProps {
  initialTab?: string;
  initialPreset?: string;
  initialRange?: string;
  initialAppTypes?: string;
  initialSource?: string;
  initialSearch?: string;
}

const FEED_PRESET_OPTIONS: Array<{
  id: ChangeFeedPreset;
  label: string;
  description: string;
}> = [
  {
    id: 'high-signal',
    label: 'High Signal',
    description: 'Meaningful non-news bursts with lower-value technical churn filtered down.',
  },
  {
    id: 'upcoming-radar',
    label: 'Upcoming Radar',
    description: 'Unreleased titles plus games in their first 30 days after launch.',
  },
  {
    id: 'all-changes',
    label: 'All Changes',
    description: 'Every grouped storefront, PICS, and media burst in strict recency order.',
  },
];

const RANGE_OPTIONS: Array<{ id: FeedRange; label: string }> = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
];

const APP_TYPE_LABELS: Partial<Record<AppType, string>> = {
  game: 'Games',
  demo: 'Demos',
  application: 'Apps',
  dlc: 'DLC',
  mod: 'Mods',
  video: 'Video',
  hardware: 'Hardware',
  music: 'Music',
  episode: 'Episode',
  tool: 'Tools',
  series: 'Series',
  advertising: 'Advertising',
};

const APP_TYPE_OPTIONS: Array<{ id: AppTypeFilter; label: string }> = [
  { id: 'all', label: 'All apps' },
  ...CHANGE_FEED_APP_TYPES.map((appType) => ({
    id: appType,
    label: APP_TYPE_LABELS[appType] ?? formatTokenLabel(appType),
  })),
];

const SOURCE_OPTIONS: Array<{ id: SourceFilter; label: string }> = [
  { id: 'all', label: 'All sources' },
  ...CHANGE_FEED_SOURCES.map((source) => ({
    id: source,
    label: source === 'pics' ? 'PICS' : formatTokenLabel(source),
  })),
];

function formatTokenLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseTab(value: string | null | undefined): FeedTab {
  return value === 'news' ? 'news' : 'feed';
}

function parsePreset(value: string | null | undefined): ChangeFeedPreset {
  if (!value) {
    return 'high-signal';
  }

  const normalized = value.replace(/_/g, '-');
  return CHANGE_FEED_PRESETS.includes(normalized as ChangeFeedPreset)
    ? (normalized as ChangeFeedPreset)
    : 'high-signal';
}

function parseRange(value: string | null | undefined): FeedRange {
  return RANGE_OPTIONS.some((range) => range.id === value) ? (value as FeedRange) : '7d';
}

function parseAppType(value: string | null | undefined): AppTypeFilter {
  if (!value) {
    return 'all';
  }

  return CHANGE_FEED_APP_TYPES.includes(value as AppType) ? (value as AppType) : 'all';
}

function parseSource(value: string | null | undefined): SourceFilter {
  if (!value) {
    return 'all';
  }

  return CHANGE_FEED_SOURCES.includes(value as ChangeFeedSource)
    ? (value as ChangeFeedSource)
    : 'all';
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

function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) {
    return 'Unknown';
  }

  const diffMs = Date.now() - new Date(timestamp).getTime();
  if (diffMs < 60_000) {
    return 'Just now';
  }
  if (diffMs < 3_600_000) {
    return `${Math.floor(diffMs / 60_000)}m ago`;
  }
  if (diffMs < 86_400_000) {
    return `${Math.floor(diffMs / 3_600_000)}h ago`;
  }
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
}

function formatAbsoluteTime(timestamp: string | null): string {
  if (!timestamp) {
    return 'Unknown';
  }

  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatAppTypeLabel(appType: AppType | null): string {
  if (!appType) {
    return 'Unknown';
  }

  return APP_TYPE_LABELS[appType] ?? formatTokenLabel(appType);
}

function formatChangeLabel(changeType: string): string {
  const labels: Record<string, string> = {
    technical_update: 'Technical update',
    build_id_changed: 'Build changed',
    last_content_update_changed: 'Content update',
    release_date_changed: 'Release date',
    coming_soon_changed: 'Coming soon',
    supported_languages_changed: 'Languages',
    categories_changed: 'Categories',
    genres_changed: 'Genres',
    tags_changed: 'Tags',
    platforms_changed: 'Platforms',
    price_changed: 'Price',
    discount_changed: 'Discount',
    screenshots_changed: 'Screenshots',
    trailer_changed: 'Trailer',
    capsule_art_changed: 'Capsule art',
    header_image_changed: 'Header image',
  };

  return labels[changeType] ?? formatTokenLabel(changeType);
}

function getSourceBadgeVariant(source: ChangeFeedSource): 'info' | 'purple' | 'orange' {
  switch (source) {
    case 'storefront':
      return 'info';
    case 'pics':
      return 'purple';
    case 'media':
      return 'orange';
  }
}

function getStatusBadgeVariant(state: ChangeFeedStatusState): 'warning' | 'error' {
  return state === 'delayed' ? 'error' : 'warning';
}

function getStatusLabel(state: ChangeFeedStatusState): string {
  switch (state) {
    case 'catching_up':
      return 'Catching up';
    case 'delayed':
      return 'Delayed';
    default:
      return 'Healthy';
  }
}

function getStatusSummary(status: ChangeFeedStatus): string {
  return status.reasons[0] ?? 'Change capture is healthy.';
}

function buildUrl(
  pathname: string,
  searchParams: URLSearchParams,
  updates: Record<string, string | null>
): string {
  const params = new URLSearchParams(searchParams.toString());

  Object.entries(updates).forEach(([key, value]) => {
    const shouldDelete =
      !value ||
      value === 'all' ||
      (key === 'tab' && value === 'feed') ||
      (key === 'preset' && value === 'high-signal') ||
      (key === 'range' && value === '7d');

    if (shouldDelete) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function buildFeedParams(args: {
  range: FeedRange;
  preset: ChangeFeedPreset;
  appType: AppTypeFilter;
  source: SourceFilter;
  search: string;
  cursor?: ChangeFeedCursor | null;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set('days', String(rangeToDays(args.range)));
  params.set('preset', args.preset);
  params.set('limit', '50');

  if (args.appType !== 'all') {
    params.set('appTypes', args.appType);
  }
  if (args.source !== 'all') {
    params.set('source', args.source);
  }
  if (args.search) {
    params.set('search', args.search);
  }
  if (args.cursor) {
    params.set('cursorTime', args.cursor.time);
    params.set('cursorKey', args.cursor.key);
  }

  return params;
}

function buildNewsParams(args: {
  range: FeedRange;
  appType: AppTypeFilter;
  search: string;
  cursor?: ChangeFeedCursor | null;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set('days', String(rangeToDays(args.range)));
  params.set('limit', '50');

  if (args.appType !== 'all') {
    params.set('appTypes', args.appType);
  }
  if (args.search) {
    params.set('search', args.search);
  }
  if (args.cursor) {
    params.set('cursorTime', args.cursor.time);
    params.set('cursorKey', args.cursor.key);
  }

  return params;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? 'Request failed');
  }

  return response.json() as Promise<T>;
}

function getFeedRowSummary(row: ChangeBurstRow): { chips: string[]; extraCount: number } {
  const hasBuildChange = row.headlineChangeTypes.includes('build_id_changed');
  const hasContentUpdate = row.headlineChangeTypes.includes('last_content_update_changed');

  const normalizedChangeTypes = row.headlineChangeTypes.filter(
    (changeType) =>
      changeType !== 'build_id_changed' && changeType !== 'last_content_update_changed'
  );

  if (hasBuildChange && hasContentUpdate) {
    normalizedChangeTypes.unshift('technical_update');
  } else {
    if (hasBuildChange) {
      normalizedChangeTypes.unshift('build_id_changed');
    }
    if (hasContentUpdate) {
      normalizedChangeTypes.unshift('last_content_update_changed');
    }
  }

  const displayedChipCount = Math.min(normalizedChangeTypes.length, 2);
  const totalChangeCount = row.changeTypeCount - (hasBuildChange && hasContentUpdate ? 1 : 0);

  return {
    chips: normalizedChangeTypes.slice(0, 2),
    extraCount: Math.max(totalChangeCount - displayedChipCount, 0),
  };
}

function mergeUniqueRows<T>(currentItems: T[], nextItems: T[], getKey: (item: T) => string): T[] {
  const seenKeys = new Set(currentItems.map(getKey));
  const mergedItems = [...currentItems];

  nextItems.forEach((item) => {
    const key = getKey(item);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      mergedItems.push(item);
    }
  });

  return mergedItems;
}

function FeedRowCard({
  row,
  onOpen,
}: {
  row: ChangeBurstRow;
  onOpen: (row: ChangeBurstRow) => void;
}) {
  const { chips, extraCount } = getFeedRowSummary(row);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(row);
    }
  };

  return (
    <Card
      variant="interactive"
      padding="md"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(row)}
      onKeyDown={handleKeyDown}
      className="group space-y-3"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/apps/${row.appid}`}
              onClick={(event) => event.stopPropagation()}
              className="truncate text-body font-medium text-text-primary transition-colors hover:text-accent-blue"
            >
              {row.appName}
            </Link>
            <Badge variant="default" size="sm">
              {formatAppTypeLabel(row.appType)}
            </Badge>
            {row.isReleased === false && (
              <Badge variant="warning" size="sm">
                Upcoming
              </Badge>
            )}
            {row.hasRelatedNews && (
              <Badge variant="warning" size="sm">
                {row.relatedNewsCount} related {row.relatedNewsCount === 1 ? 'post' : 'posts'}
              </Badge>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {chips.map((changeType) => (
              <Badge key={changeType} variant="info" size="sm">
                {formatChangeLabel(changeType)}
              </Badge>
            ))}
            {extraCount > 0 && (
              <span className="text-caption text-text-muted">+{extraCount} more</span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {row.sourceSet.map((source) => (
              <Badge key={source} variant={getSourceBadgeVariant(source)} size="sm">
                {source === 'pics' ? 'PICS' : formatTokenLabel(source)}
              </Badge>
            ))}
            <span className="text-caption text-text-muted">
              {row.eventCount} {row.eventCount === 1 ? 'event' : 'events'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-caption text-text-muted lg:flex-col lg:items-end">
          <span>{formatRelativeTime(row.effectiveAt)}</span>
          <span className="hidden lg:inline">{formatAbsoluteTime(row.effectiveAt)}</span>
          <span className="inline-flex items-center gap-1 text-accent-blue">
            Open detail
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Card>
  );
}

function NewsRowCard({ row }: { row: ChangeNewsRow }) {
  return (
    <Card padding="md" className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-body font-medium text-text-primary">
              {row.title ?? 'Untitled post'}
            </p>
            <Badge variant="default" size="sm">
              {formatAppTypeLabel(row.appType)}
            </Badge>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-body-sm text-text-secondary">
            <Link
              href={`/apps/${row.appid}`}
              className="transition-colors hover:text-accent-blue"
            >
              {row.appName}
            </Link>
            {row.feedLabel && <Badge variant="purple" size="sm">{row.feedLabel}</Badge>}
            {row.feedName && <Badge variant="default" size="sm">{row.feedName}</Badge>}
          </div>
        </div>

        <div className="flex items-center gap-3 text-caption text-text-muted lg:flex-col lg:items-end">
          <span>{formatRelativeTime(row.publishedAt ?? row.firstSeenAt)}</span>
          <span className="hidden lg:inline">
            {formatAbsoluteTime(row.publishedAt ?? row.firstSeenAt)}
          </span>
          {row.url && (
            <a
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent-blue transition-colors hover:text-accent-blue/80"
            >
              Open
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}

function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Card className="py-12 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated text-text-muted">
        {icon}
      </div>
      <h3 className="mt-3 text-subheading text-text-primary">{title}</h3>
      <p className="mt-1 text-body-sm text-text-secondary">{description}</p>
    </Card>
  );
}

export function ChangeFeedPageClient({
  initialTab,
  initialPreset,
  initialRange,
  initialAppTypes,
  initialSource,
  initialSearch,
}: ChangeFeedPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authReady = useAuthReady();
  const [, startTransition] = useTransition();
  const pathname = '/changes';

  const tab = parseTab(searchParams.get('tab') ?? initialTab);
  const preset = parsePreset(searchParams.get('preset') ?? initialPreset);
  const range = parseRange(searchParams.get('range') ?? initialRange);
  const appType = parseAppType(searchParams.get('appTypes') ?? initialAppTypes);
  const source = parseSource(searchParams.get('source') ?? initialSource);
  const search = searchParams.get('search') ?? initialSearch ?? '';
  const feedQueryKey = `${preset}|${range}|${appType}|${source}|${search}`;
  const newsQueryKey = `${range}|${appType}|${search}`;

  const [searchInput, setSearchInput] = useState(search);
  const deferredSearch = useDeferredValue(searchInput);

  const [feedItems, setFeedItems] = useState<ChangeBurstRow[]>([]);
  const [feedCursor, setFeedCursor] = useState<ChangeFeedCursor | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedLoadedKey, setFeedLoadedKey] = useState<string | null>(null);

  const [newsItems, setNewsItems] = useState<ChangeNewsRow[]>([]);
  const [newsCursor, setNewsCursor] = useState<ChangeFeedCursor | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsLoadingMore, setNewsLoadingMore] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsLoadedKey, setNewsLoadedKey] = useState<string | null>(null);

  const [status, setStatus] = useState<ChangeFeedStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [selectedBurst, setSelectedBurst] = useState<ChangeBurstRow | null>(null);
  const [drawerDetail, setDrawerDetail] = useState<ChangeBurstDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const feedRequestVersionRef = useRef(0);
  const newsRequestVersionRef = useRef(0);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (deferredSearch === search) {
      return;
    }

    const nextUrl = buildUrl(pathname, searchParams, {
      search: deferredSearch || null,
    });

    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  }, [deferredSearch, pathname, router, search, searchParams]);

  useEffect(() => {
    feedRequestVersionRef.current += 1;
    setFeedItems([]);
    setFeedCursor(null);
    setFeedError(null);
    setFeedLoading(false);
    setFeedLoadingMore(false);
    setFeedLoadedKey(null);
  }, [feedQueryKey]);

  useEffect(() => {
    newsRequestVersionRef.current += 1;
    setNewsItems([]);
    setNewsCursor(null);
    setNewsError(null);
    setNewsLoading(false);
    setNewsLoadingMore(false);
    setNewsLoadedKey(null);
  }, [newsQueryKey]);

  useEffect(() => {
    setSelectedBurst(null);
    setDrawerDetail(null);
    setDrawerError(null);
    setDrawerLoading(false);
  }, [feedQueryKey, tab]);

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
      } catch (error) {
        if (!cancelled) {
          setStatus(null);
          setStatusError(error instanceof Error ? error.message : 'Failed to load feed status');
        }
      }
    };

    loadStatus();
    const intervalId = window.setInterval(loadStatus, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [authReady]);

  useEffect(() => {
    if (!authReady || tab !== 'feed' || feedLoadedKey === feedQueryKey) {
      return;
    }

    const version = feedRequestVersionRef.current;
    let cancelled = false;

    const loadFeed = async () => {
      setFeedLoading(true);
      setFeedError(null);

      try {
        const params = buildFeedParams({ range, preset, appType, source, search });
        const data = await fetchJson<ChangeFeedBurstsResponse>(
          `/api/change-feed/bursts?${params.toString()}`
        );

        if (!cancelled && feedRequestVersionRef.current === version) {
          setFeedItems(data.items);
          setFeedCursor(data.nextCursor);
          setFeedLoadedKey(feedQueryKey);
        }
      } catch (error) {
        if (!cancelled && feedRequestVersionRef.current === version) {
          setFeedItems([]);
          setFeedCursor(null);
          setFeedError(error instanceof Error ? error.message : 'Failed to load change feed');
        }
      } finally {
        if (!cancelled && feedRequestVersionRef.current === version) {
          setFeedLoading(false);
        }
      }
    };

    loadFeed();

    return () => {
      cancelled = true;
    };
  }, [authReady, tab, feedLoadedKey, feedQueryKey, range, preset, appType, source, search]);

  useEffect(() => {
    if (!authReady || tab !== 'news' || newsLoadedKey === newsQueryKey) {
      return;
    }

    const version = newsRequestVersionRef.current;
    let cancelled = false;

    const loadNews = async () => {
      setNewsLoading(true);
      setNewsError(null);

      try {
        const params = buildNewsParams({ range, appType, search });
        const data = await fetchJson<ChangeFeedNewsResponse>(
          `/api/change-feed/news?${params.toString()}`
        );

        if (!cancelled && newsRequestVersionRef.current === version) {
          setNewsItems(data.items);
          setNewsCursor(data.nextCursor);
          setNewsLoadedKey(newsQueryKey);
        }
      } catch (error) {
        if (!cancelled && newsRequestVersionRef.current === version) {
          setNewsItems([]);
          setNewsCursor(null);
          setNewsError(error instanceof Error ? error.message : 'Failed to load news feed');
        }
      } finally {
        if (!cancelled && newsRequestVersionRef.current === version) {
          setNewsLoading(false);
        }
      }
    };

    loadNews();

    return () => {
      cancelled = true;
    };
  }, [authReady, tab, newsLoadedKey, newsQueryKey, range, appType, search]);

  useEffect(() => {
    if (!selectedBurst) {
      return;
    }

    if (drawerDetail?.burstId === selectedBurst.burstId) {
      return;
    }

    let cancelled = false;
    setDrawerLoading(true);
    setDrawerError(null);
    setDrawerDetail(null);

    fetchJson<ChangeBurstDetailResponse>(
      `/api/change-feed/bursts/${encodeURIComponent(selectedBurst.burstId)}`
    )
      .then((response) => {
        if (!cancelled) {
          setDrawerDetail(response.item);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setDrawerError(error instanceof Error ? error.message : 'Failed to load burst detail');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDrawerLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [drawerDetail?.burstId, selectedBurst]);

  const handleParamChange = (updates: Record<string, string | null>) => {
    const nextUrl = buildUrl(pathname, searchParams, {
      ...updates,
      cursorTime: null,
      cursorKey: null,
    });

    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  };

  const handleLoadMoreFeed = async () => {
    if (!feedCursor || feedLoadingMore) {
      return;
    }

    const version = feedRequestVersionRef.current;
    setFeedLoadingMore(true);

    try {
      const params = buildFeedParams({
        range,
        preset,
        appType,
        source,
        search,
        cursor: feedCursor,
      });

      const data = await fetchJson<ChangeFeedBurstsResponse>(
        `/api/change-feed/bursts?${params.toString()}`
      );

      if (feedRequestVersionRef.current !== version) {
        return;
      }

      setFeedItems((currentItems) =>
        mergeUniqueRows(currentItems, data.items, (item) => item.burstId)
      );
      setFeedCursor(data.nextCursor);
    } catch (error) {
      if (feedRequestVersionRef.current === version) {
        setFeedError(error instanceof Error ? error.message : 'Failed to load more bursts');
      }
    } finally {
      if (feedRequestVersionRef.current === version) {
        setFeedLoadingMore(false);
      }
    }
  };

  const handleLoadMoreNews = async () => {
    if (!newsCursor || newsLoadingMore) {
      return;
    }

    const version = newsRequestVersionRef.current;
    setNewsLoadingMore(true);

    try {
      const params = buildNewsParams({
        range,
        appType,
        search,
        cursor: newsCursor,
      });

      const data = await fetchJson<ChangeFeedNewsResponse>(
        `/api/change-feed/news?${params.toString()}`
      );

      if (newsRequestVersionRef.current !== version) {
        return;
      }

      setNewsItems((currentItems) =>
        mergeUniqueRows(currentItems, data.items, (item) => item.gid)
      );
      setNewsCursor(data.nextCursor);
    } catch (error) {
      if (newsRequestVersionRef.current === version) {
        setNewsError(error instanceof Error ? error.message : 'Failed to load more news');
      }
    } finally {
      if (newsRequestVersionRef.current === version) {
        setNewsLoadingMore(false);
      }
    }
  };

  const statusContent = status ? (
    <div className="w-72 p-3">
      <p className="text-body-sm font-medium text-text-primary">{getStatusLabel(status.state)}</p>
      <p className="mt-1 text-body-sm text-text-secondary">{getStatusSummary(status)}</p>
      <div className="mt-3 space-y-1 text-caption text-text-muted">
        <p>Storefront latest: {formatRelativeTime(status.latestStorefrontEventAt)}</p>
        <p>News latest: {formatRelativeTime(status.latestNewsEventAt)}</p>
        <p>Queued jobs: {status.queuedJobs.toLocaleString()}</p>
        <p>Oldest queued: {formatRelativeTime(status.oldestQueuedAt)}</p>
      </div>
      {status.reasons.length > 1 && (
        <div className="mt-3 border-t border-border-subtle pt-3 text-caption text-text-muted">
          {status.reasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </div>
      )}
    </div>
  ) : null;

  const tabs = [
    { id: 'feed', label: 'Feed', count: feedItems.length || undefined },
    { id: 'news', label: 'News', count: newsItems.length || undefined },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Change Feed"
        description="Scan recent Steam storefront, PICS, media, and announcement changes in a dense feed."
        actions={
          <div className="flex items-center gap-2">
            {status && status.state !== 'healthy' && statusContent && (
              <Popover
                trigger={
                  <Badge variant={getStatusBadgeVariant(status.state)}>
                    {getStatusLabel(status.state)}
                  </Badge>
                }
                content={statusContent}
                align="end"
              />
            )}
            {statusError && <Badge variant="warning">Status unavailable</Badge>}
          </div>
        }
      />

      <Card padding="none" className="overflow-hidden">
        <div className="px-4 pt-4">
          <UnderlineTabs
            tabs={tabs}
            activeTab={tab}
            onChange={(nextTab) => handleParamChange({ tab: nextTab })}
          />
        </div>

        {!authReady ? (
          <div className="px-4 py-12">
            <Card className="flex items-center justify-center gap-2 bg-surface-elevated py-8 text-body-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Establishing authenticated session...
            </Card>
          </div>
        ) : (
          <div className="space-y-4 px-4 py-4">
            <div className="flex flex-col gap-3">
              {tab === 'feed' && (
                <div className="flex flex-wrap gap-2">
                  {FEED_PRESET_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleParamChange({ preset: option.id })}
                      className={`rounded-full border px-3 py-1.5 text-body-sm font-medium transition-colors ${
                        preset === option.id
                          ? 'border-border-muted bg-surface-elevated text-text-primary'
                          : 'border-border-subtle bg-surface text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
                      }`}
                      title={option.description}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleParamChange({ range: option.id })}
                      className={`rounded-md border px-2.5 py-1.5 text-body-sm transition-colors ${
                        range === option.id
                          ? 'border-border-muted bg-surface-elevated text-text-primary'
                          : 'border-transparent text-text-secondary hover:border-border-subtle hover:bg-surface-elevated hover:text-text-primary'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px] xl:grid-cols-[minmax(0,1fr)_180px_180px]">
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder={tab === 'feed' ? 'Search apps or change types' : 'Search apps or news titles'}
                    leftIcon={<Search className="h-4 w-4" />}
                  />

                  <label className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface px-3 text-body-sm text-text-secondary">
                    <span>Type</span>
                    <select
                      value={appType}
                      onChange={(event) => handleParamChange({ appTypes: event.target.value })}
                      className="h-9 min-w-0 flex-1 bg-transparent text-text-primary focus:outline-none"
                    >
                      {APP_TYPE_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {tab === 'feed' ? (
                    <label className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface px-3 text-body-sm text-text-secondary">
                      <span>Source</span>
                      <select
                        value={source}
                        onChange={(event) => handleParamChange({ source: event.target.value })}
                        className="h-9 min-w-0 flex-1 bg-transparent text-text-primary focus:outline-none"
                      >
                        {SOURCE_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <div className="hidden xl:block" />
                  )}
                </div>
              </div>
            </div>

            {tab === 'feed' && (
              <div className="space-y-3">
                {feedLoading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
                  </div>
                )}

                {!feedLoading && feedError && (
                  <Card className="border-accent-red/30 bg-accent-red/10">
                    <p className="text-body-sm text-accent-red">{feedError}</p>
                  </Card>
                )}

                {!feedLoading && !feedError && feedItems.length === 0 && (
                  <EmptyState
                    title="No change bursts found"
                    description="Try widening the range or relaxing the current filters."
                    icon={<Sparkles className="h-5 w-5" />}
                  />
                )}

                {!feedLoading &&
                  !feedError &&
                  feedItems.map((row) => (
                    <FeedRowCard key={row.burstId} row={row} onOpen={setSelectedBurst} />
                  ))}

                {!feedLoading && !feedError && feedCursor && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="secondary"
                      onClick={handleLoadMoreFeed}
                      isLoading={feedLoadingMore}
                    >
                      Load more bursts
                    </Button>
                  </div>
                )}
              </div>
            )}

            {tab === 'news' && (
              <div className="space-y-3">
                {newsLoading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
                  </div>
                )}

                {!newsLoading && newsError && (
                  <Card className="border-accent-red/30 bg-accent-red/10">
                    <p className="text-body-sm text-accent-red">{newsError}</p>
                  </Card>
                )}

                {!newsLoading && !newsError && newsItems.length === 0 && (
                  <EmptyState
                    title="No recent news"
                    description="No Steam announcements matched the current range and filters."
                    icon={<Newspaper className="h-5 w-5" />}
                  />
                )}

                {!newsLoading &&
                  !newsError &&
                  newsItems.map((row) => <NewsRowCard key={row.gid} row={row} />)}

                {!newsLoading && !newsError && newsCursor && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="secondary"
                      onClick={handleLoadMoreNews}
                      isLoading={newsLoadingMore}
                    >
                      Load more news
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-surface-elevated p-2 text-text-muted">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <p className="text-body-sm font-medium text-text-primary">How this feed works</p>
            <p className="mt-1 text-body-sm text-text-secondary">
              Feed rows group storefront, PICS, and media changes into bursts. News is shown
              separately and only attaches to feed bursts when it lands near the same app window.
            </p>
          </div>
        </div>

        <div className="grid gap-2 text-body-sm text-text-secondary sm:grid-cols-3 md:text-right">
          <div>
            <p className="font-medium text-text-primary">High Signal</p>
            <p>Relevant bursts with low-value technical churn reduced.</p>
          </div>
          <div>
            <p className="font-medium text-text-primary">Upcoming Radar</p>
            <p>Unreleased titles plus activity around recent launches.</p>
          </div>
          <div>
            <p className="font-medium text-text-primary">All Changes</p>
            <p>Every grouped non-news burst in strict recency order.</p>
          </div>
        </div>
      </Card>

      <ChangeFeedDrawer
        isOpen={selectedBurst !== null}
        summary={selectedBurst}
        detail={drawerDetail}
        loading={drawerLoading}
        error={drawerError}
        onClose={() => {
          setSelectedBurst(null);
          setDrawerDetail(null);
          setDrawerError(null);
          setDrawerLoading(false);
        }}
      />
    </div>
  );
}
