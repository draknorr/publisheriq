'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowUpDown,
  CalendarClock,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  Film,
  ImageIcon,
  Loader2,
  Newspaper,
  Pin,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge, Button, Card, SearchInput } from '@/components/ui';
import { useAuthReady } from '@/hooks/useAuthReady';
import {
  downloadCsv,
  generateUnreleasedCsv,
  unreleasedCsvFilename,
} from '../lib/unreleased-export';
import type {
  AdultFilter,
  FilterOption,
  PublisherStatus,
  ReleaseStatus,
  SortOrder,
  UnreleasedFilters,
  UnreleasedGame,
  UnreleasedGameDetail,
  UnreleasedSortField,
  UnreleasedStats,
} from '../lib/unreleased-types';

interface UnreleasedPageClientProps {
  initialData: UnreleasedGame[];
  initialStats: UnreleasedStats;
  initialFilters: UnreleasedFilters;
}

interface UnreleasedApiResponse {
  data: UnreleasedGame[];
  stats: UnreleasedStats;
}

interface DetailApiResponse {
  data: UnreleasedGameDetail;
}

const SORT_OPTIONS: Array<{ value: UnreleasedSortField; label: string; defaultOrder: SortOrder }> = [
  { value: 'opportunity_score', label: 'Opportunity', defaultOrder: 'desc' },
  { value: 'latest_added_at', label: 'Latest Added', defaultOrder: 'desc' },
  { value: 'release_date', label: 'Release Date', defaultOrder: 'asc' },
  { value: 'latest_change_at', label: 'Recent Updates', defaultOrder: 'desc' },
  { value: 'latest_news_at', label: 'Latest News', defaultOrder: 'desc' },
  { value: 'name', label: 'Title', defaultOrder: 'asc' },
  { value: 'publisher_name', label: 'Publisher', defaultOrder: 'asc' },
  { value: 'developer_name', label: 'Developer', defaultOrder: 'asc' },
  { value: 'primary_tag_name', label: 'Tag', defaultOrder: 'asc' },
  { value: 'primary_category_name', label: 'Feature', defaultOrder: 'asc' },
  { value: 'change_count_30d', label: '30d Changes', defaultOrder: 'desc' },
  { value: 'screenshot_count', label: 'Screenshots', defaultOrder: 'desc' },
  { value: 'movie_count', label: 'Trailers', defaultOrder: 'desc' },
];

const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  dated_future: 'Dated',
  stale_past_date: 'Past date',
  undated: 'Undated',
};

const PUBLISHER_STATUS_LABELS: Record<PublisherStatus, string> = {
  no_publisher: 'No publisher',
  self_published: 'Self-published',
  small_publisher: 'Small publisher',
  established_publisher: 'Established',
};

const SIGNAL_OPTIONS = [
  { id: 'announcement', label: 'Announcements' },
  { id: 'release', label: 'Release' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'store-page', label: 'Store page' },
  { id: 'media', label: 'Media' },
  { id: 'taxonomy', label: 'Positioning' },
  { id: 'platform', label: 'Platform' },
  { id: 'build', label: 'Build' },
];

const PRESETS: Array<{
  id: string;
  label: string;
  tooltip: string;
  params: Partial<UnreleasedFilters>;
}> = [
  {
    id: 'opportunity',
    label: 'Opportunity Radar',
    tooltip: 'High-scoring games with adult content hidden',
    params: { sort: 'opportunity_score', order: 'desc', adult: 'exclude' },
  },
  {
    id: 'launch30',
    label: 'Launch 30d',
    tooltip: 'Dated future games launching within 30 days',
    params: {
      releaseStatuses: ['dated_future'],
      maxDaysUntilRelease: 30,
      sort: 'release_date',
      order: 'asc',
    },
  },
  {
    id: 'recently-added',
    label: 'Recently Added',
    tooltip: 'Newest rows from the Steam applist',
    params: { sort: 'latest_added_at', order: 'desc' },
  },
  {
    id: 'fresh-updates',
    label: 'Fresh Store Updates',
    tooltip: 'Games with captured store changes',
    params: { hasRecentChange: true, sort: 'latest_change_at', order: 'desc' },
  },
  {
    id: 'news-active',
    label: 'News Active',
    tooltip: 'Games with Steam news activity in the last 30 days',
    params: { minNewsDays: 30, sort: 'latest_news_at', order: 'desc' },
  },
  {
    id: 'no-publisher',
    label: 'No Publisher',
    tooltip: 'Games with no linked publisher',
    params: { publisherStatuses: ['no_publisher'], sort: 'opportunity_score', order: 'desc' },
  },
  {
    id: 'self-published',
    label: 'Self Published',
    tooltip: 'Developer and publisher are the same entity',
    params: { publisherStatuses: ['self_published'], sort: 'opportunity_score', order: 'desc' },
  },
  {
    id: 'undated',
    label: 'Undated Watchlist',
    tooltip: 'Coming soon rows without a parsed release date',
    params: { releaseStatuses: ['undated'], sort: 'latest_change_at', order: 'desc' },
  },
  {
    id: 'media-ready',
    label: 'Media Ready',
    tooltip: 'Rows with screenshots and trailers captured',
    params: { hasScreenshots: true, hasTrailers: true, sort: 'opportunity_score', order: 'desc' },
  },
  {
    id: 'date-review',
    label: 'Date Needs Review',
    tooltip: 'Unreleased rows with a parsed date in the past',
    params: { releaseStatuses: ['stale_past_date'], sort: 'latest_change_at', order: 'desc' },
  },
];

const DEFAULT_FILTERS: UnreleasedFilters = {
  sort: 'opportunity_score',
  order: 'desc',
  limit: 50,
  offset: 0,
  adult: 'exclude',
};

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString();
}

function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return 'TBD';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelative(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '-';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return 'just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  if (diffMs < 2_592_000_000) return `${Math.floor(diffMs / 86_400_000)}d ago`;
  return formatDate(value);
}

function formatReleaseLead(game: UnreleasedGame): string {
  if (game.release_status === 'undated') return game.release_date_raw || 'Coming soon';
  if (game.days_until_release === null) return formatDate(game.release_date);
  if (game.days_until_release < 0) return `${Math.abs(game.days_until_release)}d past`;
  if (game.days_until_release === 0) return 'today';
  if (game.days_until_release === 1) return 'tomorrow';
  return `${game.days_until_release}d`;
}

function cleanLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function steamAppUrl(appid: number): string {
  return `https://store.steampowered.com/app/${appid}`;
}

function steamEntityUrl(kind: 'publisher' | 'developer', name: string, vanityUrl: string | null): string {
  if (vanityUrl) {
    if (vanityUrl.startsWith('http://') || vanityUrl.startsWith('https://')) return vanityUrl;
    return `https://store.steampowered.com/${kind}/${encodeURIComponent(vanityUrl)}`;
  }
  const param = kind === 'publisher' ? 'publisher' : 'developer';
  return `https://store.steampowered.com/search/?${param}=${encodeURIComponent(name)}`;
}

function arrayParam(values: readonly string[] | readonly number[] | undefined): string | undefined {
  return values && values.length > 0 ? values.join(',') : undefined;
}

function buildSearchParams(filters: UnreleasedFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set('sort', filters.sort);
  if (filters.order !== DEFAULT_FILTERS.order) params.set('order', filters.order);
  if (filters.search) params.set('search', filters.search);
  if (filters.adult && filters.adult !== 'exclude') params.set('adult', filters.adult);
  if (filters.releaseStatuses?.length) params.set('releaseStatus', filters.releaseStatuses.join(','));
  if (filters.publisherStatuses?.length) params.set('publisherStatus', filters.publisherStatuses.join(','));
  if (filters.publisherSearch) params.set('publisherSearch', filters.publisherSearch);
  if (filters.developerSearch) params.set('developerSearch', filters.developerSearch);
  if (filters.minDaysUntilRelease !== undefined) params.set('minDaysUntilRelease', String(filters.minDaysUntilRelease));
  if (filters.maxDaysUntilRelease !== undefined) params.set('maxDaysUntilRelease', String(filters.maxDaysUntilRelease));
  if (filters.minOpportunityScore !== undefined) params.set('minOpportunityScore', String(filters.minOpportunityScore));
  if (filters.minChanges30d !== undefined) params.set('minChanges30d', String(filters.minChanges30d));
  if (filters.minNewsDays !== undefined) params.set('minNewsDays', String(filters.minNewsDays));
  if (filters.hasNews !== undefined) params.set('hasNews', String(filters.hasNews));
  if (filters.hasRecentChange !== undefined) params.set('hasRecentChange', String(filters.hasRecentChange));
  if (filters.hasScreenshots !== undefined) params.set('hasScreenshots', String(filters.hasScreenshots));
  if (filters.hasTrailers !== undefined) params.set('hasTrailers', String(filters.hasTrailers));
  if (filters.hasPurchasePackages !== undefined) params.set('hasPurchasePackages', String(filters.hasPurchasePackages));
  if (filters.isFree !== undefined) params.set('isFree', String(filters.isFree));
  if (filters.hasWorkshop !== undefined) params.set('hasWorkshop', String(filters.hasWorkshop));
  if (arrayParam(filters.genres)) params.set('genres', arrayParam(filters.genres) ?? '');
  if (filters.genreMode === 'any') params.set('genreMode', 'any');
  if (arrayParam(filters.tags)) params.set('tags', arrayParam(filters.tags) ?? '');
  if (filters.tagMode === 'any') params.set('tagMode', 'any');
  if (arrayParam(filters.categories)) params.set('categories', arrayParam(filters.categories) ?? '');
  if (filters.categoryMode === 'any') params.set('categoryMode', 'any');
  if (arrayParam(filters.platforms)) params.set('platforms', arrayParam(filters.platforms) ?? '');
  if (filters.platformMode === 'any') params.set('platformMode', 'any');
  if (arrayParam(filters.signalFamilies)) params.set('signalFamilies', arrayParam(filters.signalFamilies) ?? '');
  if (filters.signalMode === 'any') params.set('signalMode', 'any');
  if (filters.limit && filters.limit !== DEFAULT_FILTERS.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));
  return params;
}

function filtersFromSearchParams(searchParams: URLSearchParams, fallback: UnreleasedFilters): UnreleasedFilters {
  const parseNumber = (key: string): number | undefined => {
    const value = searchParams.get(key);
    if (!value) return undefined;
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  };
  const parseBoolean = (key: string): boolean | undefined => {
    const value = searchParams.get(key);
    if (!value) return undefined;
    return value === 'true';
  };
  const parseStrings = (key: string): string[] | undefined => {
    const value = searchParams.get(key);
    if (!value) return undefined;
    const items = value.split(',').map((item) => item.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
  };
  const parseNumbers = (key: string): number[] | undefined => {
    const items = parseStrings(key)
      ?.map((item) => Number.parseInt(item, 10))
      .filter((item) => Number.isFinite(item));
    return items && items.length > 0 ? items : undefined;
  };

  return {
    ...fallback,
    sort: (searchParams.get('sort') as UnreleasedSortField | null) ?? fallback.sort,
    order: searchParams.get('order') === 'asc' ? 'asc' : fallback.order,
    search: searchParams.get('search') || undefined,
    adult: (searchParams.get('adult') as AdultFilter | null) ?? 'exclude',
    releaseStatuses: parseStrings('releaseStatus') as ReleaseStatus[] | undefined,
    publisherStatuses: parseStrings('publisherStatus') as PublisherStatus[] | undefined,
    publisherSearch: searchParams.get('publisherSearch') || undefined,
    developerSearch: searchParams.get('developerSearch') || undefined,
    minDaysUntilRelease: parseNumber('minDaysUntilRelease'),
    maxDaysUntilRelease: parseNumber('maxDaysUntilRelease'),
    minOpportunityScore: parseNumber('minOpportunityScore'),
    minChanges30d: parseNumber('minChanges30d'),
    minNewsDays: parseNumber('minNewsDays'),
    hasNews: parseBoolean('hasNews'),
    hasRecentChange: parseBoolean('hasRecentChange'),
    hasScreenshots: parseBoolean('hasScreenshots'),
    hasTrailers: parseBoolean('hasTrailers'),
    hasPurchasePackages: parseBoolean('hasPurchasePackages'),
    isFree: parseBoolean('isFree'),
    hasWorkshop: parseBoolean('hasWorkshop'),
    genres: parseNumbers('genres'),
    genreMode: searchParams.get('genreMode') === 'any' ? 'any' : 'all',
    tags: parseNumbers('tags'),
    tagMode: searchParams.get('tagMode') === 'any' ? 'any' : 'all',
    categories: parseNumbers('categories'),
    categoryMode: searchParams.get('categoryMode') === 'any' ? 'any' : 'all',
    platforms: parseStrings('platforms'),
    platformMode: searchParams.get('platformMode') === 'any' ? 'any' : 'all',
    signalFamilies: parseStrings('signalFamilies'),
    signalMode: searchParams.get('signalMode') === 'any' ? 'any' : 'all',
    limit: parseNumber('limit') ?? DEFAULT_FILTERS.limit,
    offset: parseNumber('offset') ?? 0,
  };
}

function activeFilterCount(filters: UnreleasedFilters): number {
  const ignored = new Set(['sort', 'order', 'limit', 'offset', 'adult']);
  return Object.entries(filters).filter(([key, value]) => {
    if (ignored.has(key)) return false;
    if (value === undefined || value === null || value === '') return false;
    return !Array.isArray(value) || value.length > 0;
  }).length + (filters.adult && filters.adult !== 'exclude' ? 1 : 0);
}

function isSameArray<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
  if (!a?.length && !b?.length) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function toggleArrayValue<T>(values: readonly T[] | undefined, value: T): T[] | undefined {
  const current = values ?? [];
  if (current.includes(value)) {
    const next = current.filter((item) => item !== value);
    return next.length > 0 ? next : undefined;
  }
  return [...current, value];
}

function FilterToggle({
  active,
  children,
  onClick,
  disabled,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-body-sm transition-colors ${
        active
          ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
          : 'border-border-subtle bg-surface-raised text-text-secondary hover:border-border-muted hover:text-text-primary'
      } disabled:opacity-50`}
    >
      {active && <Check className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

function MetricStrip({ stats }: { stats: UnreleasedStats }) {
  const items = [
    { label: 'Tracked', value: formatNumber(stats.total_games), tone: 'text-text-primary' },
    { label: 'Dated', value: formatNumber(stats.dated_future_count), tone: 'text-accent-green' },
    { label: 'Undated', value: formatNumber(stats.undated_count), tone: 'text-accent-blue' },
    { label: 'Active 30d', value: formatNumber(stats.active_30d_count), tone: 'text-accent-primary' },
    { label: 'No publisher', value: formatNumber(stats.no_publisher_count), tone: 'text-accent-orange' },
    { label: 'Avg score', value: stats.avg_opportunity_score === null ? '-' : Math.round(stats.avg_opportunity_score).toString(), tone: 'text-accent-purple' },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="border border-border-subtle bg-surface-raised px-3 py-2"
        >
          <div className={`text-heading-md leading-none ${item.tone}`}>{item.value}</div>
          <div className="mt-1 text-caption uppercase tracking-[0.04em] text-text-tertiary">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function OpportunityBadge({ score }: { score: number }) {
  const variant = score >= 80 ? 'success' : score >= 60 ? 'warning' : score >= 40 ? 'info' : 'default';
  return <Badge variant={variant}>{score}</Badge>;
}

function ReleaseBadge({ status }: { status: ReleaseStatus }) {
  const variant = status === 'dated_future' ? 'success' : status === 'stale_past_date' ? 'warning' : 'info';
  return <Badge variant={variant}>{RELEASE_STATUS_LABELS[status]}</Badge>;
}

function PublisherStatusBadge({ status }: { status: PublisherStatus }) {
  const variant =
    status === 'no_publisher'
      ? 'orange'
      : status === 'self_published'
        ? 'purple'
        : status === 'small_publisher'
          ? 'info'
          : 'default';
  return <Badge variant={variant}>{PUBLISHER_STATUS_LABELS[status]}</Badge>;
}

function EntityLinks({ game }: { game: UnreleasedGame }) {
  return (
    <div className="space-y-1">
      {game.publisher_name ? (
        <div className="flex min-w-0 items-center gap-1.5">
          {game.publisher_id ? (
            <Link
              href={`/publishers/${game.publisher_id}`}
              className="truncate text-text-secondary hover:text-accent-primary"
              title={game.publisher_name}
            >
              {game.publisher_name}
            </Link>
          ) : (
            <span className="truncate text-text-secondary">{game.publisher_name}</span>
          )}
          <a
            href={steamEntityUrl('publisher', game.publisher_name, game.publisher_steam_vanity_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted hover:text-accent-primary"
            title="Open publisher on Steam"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : (
        <div className="text-text-muted">No publisher</div>
      )}
      {game.developer_name ? (
        <div className="flex min-w-0 items-center gap-1.5 text-caption">
          {game.developer_id ? (
            <Link
              href={`/developers/${game.developer_id}`}
              className="truncate text-text-tertiary hover:text-accent-primary"
              title={game.developer_name}
            >
              {game.developer_name}
            </Link>
          ) : (
            <span className="truncate text-text-tertiary">{game.developer_name}</span>
          )}
          <a
            href={steamEntityUrl('developer', game.developer_name, game.developer_steam_vanity_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted hover:text-accent-primary"
            title="Open developer on Steam"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : (
        <div className="text-caption text-text-muted">No developer</div>
      )}
    </div>
  );
}

function TaxonomyPills({ labels, limit = 3 }: { labels: string[]; limit?: number }) {
  if (labels.length === 0) return <span className="text-text-muted">-</span>;
  const visible = labels.slice(0, limit);
  const hidden = labels.length - visible.length;
  return (
    <div className="flex max-w-[260px] flex-wrap gap-1">
      {visible.map((label) => (
        <span key={label} className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] text-text-secondary">
          {label}
        </span>
      ))}
      {hidden > 0 && (
        <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
          +{hidden}
        </span>
      )}
    </div>
  );
}

function getMediaUrl(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const candidates = [
    record.path_full,
    record.path_thumbnail,
    record.thumbnail,
    record.url,
    record.webm_max,
    record.mp4_max,
  ];
  return candidates.find((item): item is string => typeof item === 'string' && item.length > 0) ?? null;
}

function DetailInspector({
  appid,
  onClose,
}: {
  appid: number | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<UnreleasedGameDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appid) {
      setDetail(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/unreleased/${appid}/detail`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || `HTTP ${response.status}`);
        }
        return response.json() as Promise<DetailApiResponse>;
      })
      .then((payload) => setDetail(payload.data))
      .catch((fetchError: unknown) => {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') return;
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load detail');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [appid]);

  if (!appid) return null;

  const game = detail?.game;
  const screenshotUrls = detail?.screenshots.map(getMediaUrl).filter((item): item is string => Boolean(item)).slice(0, 6) ?? [];
  const trailerUrls = detail?.trailers.map(getMediaUrl).filter((item): item is string => Boolean(item)).slice(0, 3) ?? [];

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl border-l border-border-subtle bg-surface-raised shadow-xl md:top-0">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
          <div className="min-w-0">
            <div className="text-caption uppercase tracking-[0.08em] text-text-tertiary">Unreleased detail</div>
            <h2 className="mt-1 truncate text-heading-md text-text-primary">
              {game?.name ?? `App ${appid}`}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-text-muted hover:bg-surface-overlay hover:text-text-primary"
            aria-label="Close detail"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center gap-2 text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading evidence
            </div>
          )}
          {error && (
            <div className="rounded-md border border-accent-red/30 bg-accent-red/10 p-3 text-body-sm text-accent-red">
              {error}
            </div>
          )}
          {detail && game && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="border border-border-subtle bg-surface px-3 py-2">
                  <div className="text-caption text-text-tertiary">Score</div>
                  <div className="text-heading-md text-text-primary">{game.opportunity_score}</div>
                </div>
                <div className="border border-border-subtle bg-surface px-3 py-2">
                  <div className="text-caption text-text-tertiary">Release</div>
                  <div className="text-body-sm text-text-primary">{formatReleaseLead(game)}</div>
                </div>
                <div className="border border-border-subtle bg-surface px-3 py-2">
                  <div className="text-caption text-text-tertiary">Changes</div>
                  <div className="text-heading-md text-text-primary">{game.change_count_30d}</div>
                </div>
                <div className="border border-border-subtle bg-surface px-3 py-2">
                  <div className="text-caption text-text-tertiary">Media</div>
                  <div className="text-body-sm text-text-primary">{game.screenshot_count} / {game.movie_count}</div>
                </div>
              </div>

              <section>
                <h3 className="mb-2 text-subheading text-text-primary">Media</h3>
                {screenshotUrls.length === 0 && trailerUrls.length === 0 ? (
                  <p className="text-body-sm text-text-muted">No captured media payload available.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {screenshotUrls.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt=""
                        className="aspect-video w-full border border-border-subtle object-cover"
                      />
                    ))}
                    {trailerUrls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex aspect-video items-center justify-center border border-border-subtle bg-surface text-text-secondary hover:text-accent-primary"
                      >
                        <Film className="mr-2 h-4 w-4" />
                        Trailer
                      </a>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-subheading text-text-primary">Recent Changes</h3>
                <div className="space-y-2">
                  {detail.recent_changes.length === 0 ? (
                    <p className="text-body-sm text-text-muted">No captured changes yet.</p>
                  ) : detail.recent_changes.slice(0, 12).map((change) => (
                    <div key={`${change.event_id}-${change.occurred_at}`} className="border border-border-subtle bg-surface px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-body-sm font-medium text-text-primary">{cleanLabel(change.change_type)}</span>
                        <span className="text-caption text-text-muted">{formatRelative(change.occurred_at)}</span>
                      </div>
                      {Object.keys(change.context).length > 0 && (
                        <pre className="mt-2 max-h-32 overflow-auto rounded bg-surface-elevated p-2 text-[11px] text-text-tertiary">
                          {JSON.stringify(change.context, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-subheading text-text-primary">Recent News</h3>
                <div className="space-y-2">
                  {detail.recent_news.length === 0 ? (
                    <p className="text-body-sm text-text-muted">No Steam news captured yet.</p>
                  ) : detail.recent_news.map((news) => (
                    <a
                      key={news.gid}
                      href={news.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block border border-border-subtle bg-surface px-3 py-2 hover:border-border-muted"
                    >
                      <div className="text-body-sm font-medium text-text-primary">{news.title || 'Untitled news item'}</div>
                      <div className="mt-1 text-caption text-text-muted">{formatRelative(news.published_at ?? news.first_seen_at)}</div>
                    </a>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function FilterOptionsGroup({
  title,
  options,
  selected,
  onToggle,
  max = 16,
}: {
  title: string;
  options: FilterOption[];
  selected: number[] | undefined;
  onToggle: (id: number) => void;
  max?: number;
}) {
  return (
    <div>
      <div className="mb-2 text-caption uppercase tracking-[0.06em] text-text-tertiary">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.slice(0, max).map((option) => (
          <FilterToggle
            key={option.option_id}
            active={selected?.includes(option.option_id) ?? false}
            onClick={() => onToggle(option.option_id)}
          >
            {option.option_name}
            <span className="text-text-muted">{formatCompact(option.app_count)}</span>
          </FilterToggle>
        ))}
      </div>
    </div>
  );
}

function FiltersPanel({
  filters,
  genreOptions,
  tagOptions,
  categoryOptions,
  onChange,
}: {
  filters: UnreleasedFilters;
  genreOptions: FilterOption[];
  tagOptions: FilterOption[];
  categoryOptions: FilterOption[];
  onChange: (updates: Partial<UnreleasedFilters>) => void;
}) {
  return (
    <Card padding="md" className="space-y-5 rounded-lg">
      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-body-sm font-medium text-text-secondary">Publisher</label>
          <input
            value={filters.publisherSearch ?? ''}
            onChange={(event) => onChange({ publisherSearch: event.target.value || undefined })}
            placeholder="Search publisher"
            className="h-9 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-body-sm text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-body-sm font-medium text-text-secondary">Developer</label>
          <input
            value={filters.developerSearch ?? ''}
            onChange={(event) => onChange({ developerSearch: event.target.value || undefined })}
            placeholder="Search developer"
            className="h-9 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-body-sm text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-body-sm font-medium text-text-secondary">Min opportunity</label>
          <input
            type="number"
            min={0}
            max={100}
            value={filters.minOpportunityScore ?? ''}
            onChange={(event) => onChange({ minOpportunityScore: event.target.value ? Number(event.target.value) : undefined })}
            placeholder="0-100"
            className="h-9 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-body-sm text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <div className="mb-2 text-caption uppercase tracking-[0.06em] text-text-tertiary">Release status</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(RELEASE_STATUS_LABELS).map(([status, label]) => (
              <FilterToggle
                key={status}
                active={filters.releaseStatuses?.includes(status as ReleaseStatus) ?? false}
                onClick={() => onChange({
                  releaseStatuses: toggleArrayValue(filters.releaseStatuses, status as ReleaseStatus),
                })}
              >
                {label}
              </FilterToggle>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-caption uppercase tracking-[0.06em] text-text-tertiary">Publisher status</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(PUBLISHER_STATUS_LABELS).map(([status, label]) => (
              <FilterToggle
                key={status}
                active={filters.publisherStatuses?.includes(status as PublisherStatus) ?? false}
                onClick={() => onChange({
                  publisherStatuses: toggleArrayValue(filters.publisherStatuses, status as PublisherStatus),
                })}
              >
                {label}
              </FilterToggle>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-caption uppercase tracking-[0.06em] text-text-tertiary">Boolean filters</div>
          <div className="flex flex-wrap gap-1.5">
            <FilterToggle active={filters.hasRecentChange === true} onClick={() => onChange({ hasRecentChange: filters.hasRecentChange === true ? undefined : true })}>Changed</FilterToggle>
            <FilterToggle active={filters.minNewsDays === 30} onClick={() => onChange({ minNewsDays: filters.minNewsDays === 30 ? undefined : 30 })}>News 30d</FilterToggle>
            <FilterToggle active={filters.hasScreenshots === true} onClick={() => onChange({ hasScreenshots: filters.hasScreenshots === true ? undefined : true })}>Screenshots</FilterToggle>
            <FilterToggle active={filters.hasTrailers === true} onClick={() => onChange({ hasTrailers: filters.hasTrailers === true ? undefined : true })}>Trailers</FilterToggle>
            <FilterToggle active={filters.hasPurchasePackages === true} onClick={() => onChange({ hasPurchasePackages: filters.hasPurchasePackages === true ? undefined : true })}>Packages</FilterToggle>
            <FilterToggle active={filters.isFree === true} onClick={() => onChange({ isFree: filters.isFree === true ? undefined : true })}>Free</FilterToggle>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-caption uppercase tracking-[0.06em] text-text-tertiary">Release window</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={filters.minDaysUntilRelease ?? ''}
              onChange={(event) => onChange({ minDaysUntilRelease: event.target.value ? Number(event.target.value) : undefined })}
              placeholder="Min days"
              className="h-9 rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-body-sm text-text-primary focus:border-accent-primary focus:outline-none"
            />
            <input
              type="number"
              value={filters.maxDaysUntilRelease ?? ''}
              onChange={(event) => onChange({ maxDaysUntilRelease: event.target.value ? Number(event.target.value) : undefined })}
              placeholder="Max days"
              className="h-9 rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-body-sm text-text-primary focus:border-accent-primary focus:outline-none"
            />
          </div>
        </div>
        <div>
          <div className="mb-2 text-caption uppercase tracking-[0.06em] text-text-tertiary">Change families</div>
          <div className="flex flex-wrap gap-1.5">
            {SIGNAL_OPTIONS.map((signal) => (
              <FilterToggle
                key={signal.id}
                active={filters.signalFamilies?.includes(signal.id) ?? false}
                onClick={() => onChange({ signalFamilies: toggleArrayValue(filters.signalFamilies, signal.id) })}
              >
                {signal.label}
              </FilterToggle>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5">
        <FilterOptionsGroup
          title="Genres"
          options={genreOptions}
          selected={filters.genres}
          onToggle={(id) => onChange({ genres: toggleArrayValue(filters.genres, id) })}
        />
        <FilterOptionsGroup
          title="Tags"
          options={tagOptions}
          selected={filters.tags}
          onToggle={(id) => onChange({ tags: toggleArrayValue(filters.tags, id) })}
          max={24}
        />
        <FilterOptionsGroup
          title="Features"
          options={categoryOptions}
          selected={filters.categories}
          onToggle={(id) => onChange({ categories: toggleArrayValue(filters.categories, id) })}
          max={24}
        />
      </div>
    </Card>
  );
}

function GamesTable({
  games,
  selectedIds,
  pinnedIds,
  pinningIds,
  sort,
  order,
  onSort,
  onToggleSelected,
  onToggleAll,
  onOpenDetail,
  onPin,
}: {
  games: UnreleasedGame[];
  selectedIds: Set<number>;
  pinnedIds: Set<number>;
  pinningIds: Set<number>;
  sort: UnreleasedSortField;
  order: SortOrder;
  onSort: (field: UnreleasedSortField) => void;
  onToggleSelected: (appid: number) => void;
  onToggleAll: () => void;
  onOpenDetail: (appid: number) => void;
  onPin: (game: UnreleasedGame) => void;
}) {
  const allSelected = games.length > 0 && games.every((game) => selectedIds.has(game.appid));
  const selectedSome = games.some((game) => selectedIds.has(game.appid));
  const header = (field: UnreleasedSortField, label: string, className = '') => {
    const active = sort === field;
    return (
      <th className={`px-3 py-2 text-left text-caption font-medium text-text-tertiary ${className}`}>
        <button
          onClick={() => onSort(field)}
          className={`inline-flex items-center gap-1 hover:text-text-primary ${active ? 'text-accent-primary' : ''}`}
        >
          {label}
          {active ? (order === 'asc' ? '↑' : '↓') : <ArrowUpDown className="h-3 w-3" />}
        </button>
      </th>
    );
  };

  return (
    <div className="overflow-hidden border border-border-subtle bg-surface-raised">
      <div className="overflow-x-auto">
        <table className="min-w-[1320px] w-full border-collapse">
          <thead className="border-b border-border-subtle bg-surface-elevated">
            <tr>
              <th className="w-10 px-3 py-2">
                <button
                  onClick={onToggleAll}
                  className={`flex h-4 w-4 items-center justify-center rounded-sm border ${
                    allSelected || selectedSome
                      ? 'border-accent-primary bg-accent-primary text-white'
                      : 'border-border-muted bg-surface'
                  }`}
                  aria-label="Select all visible games"
                >
                  {allSelected && <Check className="h-3 w-3" />}
                  {!allSelected && selectedSome && <span className="h-0.5 w-2 bg-white" />}
                </button>
              </th>
              {header('opportunity_score', 'Score', 'w-20')}
              {header('name', 'Game', 'min-w-[270px]')}
              {header('release_date', 'Release', 'min-w-[150px]')}
              {header('latest_added_at', 'Added', 'min-w-[110px]')}
              {header('publisher_name', 'Publisher / Developer', 'min-w-[230px]')}
              {header('latest_change_at', 'Latest Update', 'min-w-[230px]')}
              {header('latest_news_at', 'News', 'min-w-[210px]')}
              {header('primary_tag_name', 'Tags / Features', 'min-w-[250px]')}
              {header('screenshot_count', 'Media', 'w-24')}
              <th className="px-3 py-2 text-left text-caption font-medium text-text-tertiary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game) => (
              <tr key={game.appid} className="border-b border-border-subtle hover:bg-surface-overlay">
                <td className="px-3 py-3 align-top">
                  <button
                    onClick={() => onToggleSelected(game.appid)}
                    className={`flex h-4 w-4 items-center justify-center rounded-sm border ${
                      selectedIds.has(game.appid)
                        ? 'border-accent-primary bg-accent-primary text-white'
                        : 'border-border-muted bg-surface'
                    }`}
                    aria-label={`Select ${game.name}`}
                  >
                    {selectedIds.has(game.appid) && <Check className="h-3 w-3" />}
                  </button>
                </td>
                <td className="px-3 py-3 align-top">
                  <OpportunityBadge score={game.opportunity_score} />
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/apps/${game.appid}`}
                        className="max-w-[220px] truncate text-body-sm font-medium text-text-primary hover:text-accent-primary"
                        title={game.name}
                      >
                        {game.name}
                      </Link>
                      <a
                        href={steamAppUrl(game.appid)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text-muted hover:text-accent-primary"
                        title="Open game on Steam"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      {game.is_adult_content && <Badge variant="error" size="sm">Adult</Badge>}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <PublisherStatusBadge status={game.publisher_status} />
                      {game.is_free && <Badge variant="success" size="sm">Free</Badge>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="space-y-1">
                    <ReleaseBadge status={game.release_status} />
                    <div className="text-body-sm text-text-secondary">{formatDate(game.release_date)}</div>
                    <div className="text-caption text-text-muted">{formatReleaseLead(game)}</div>
                  </div>
                </td>
                <td className="px-3 py-3 align-top text-body-sm text-text-secondary">
                  {formatRelative(game.latest_added_at)}
                </td>
                <td className="px-3 py-3 align-top text-body-sm">
                  <EntityLinks game={game} />
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="max-w-[220px]">
                    <div className="text-body-sm text-text-primary">
                      {game.latest_change_type ? cleanLabel(game.latest_change_type) : 'No captured change'}
                    </div>
                    <div className="truncate text-caption text-text-muted" title={game.latest_change_summary ?? undefined}>
                      {game.latest_change_summary ?? formatRelative(game.latest_change_at)}
                    </div>
                    <div className="mt-1 text-caption text-text-tertiary">
                      {game.change_count_30d} changes / {game.announcement_count_30d} news
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 align-top">
                  {game.latest_news_url ? (
                    <a
                      href={game.latest_news_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block max-w-[200px] text-body-sm text-text-primary hover:text-accent-primary"
                    >
                      <span className="line-clamp-2">{game.latest_news_title ?? 'Steam news'}</span>
                      <span className="mt-1 block text-caption text-text-muted">{formatRelative(game.latest_news_at)}</span>
                    </a>
                  ) : (
                    <span className="text-body-sm text-text-muted">No news</span>
                  )}
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="space-y-1.5">
                    <TaxonomyPills labels={game.tag_names} />
                    <TaxonomyPills labels={game.category_names} limit={2} />
                  </div>
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="flex items-center gap-2 text-body-sm text-text-secondary">
                    <span className="inline-flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" />{game.screenshot_count}</span>
                    <span className="inline-flex items-center gap-1"><Film className="h-3.5 w-3.5" />{game.movie_count}</span>
                  </div>
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onPin(game)}
                      disabled={pinningIds.has(game.appid)}
                      className={`rounded-md p-1.5 transition-colors ${
                        pinnedIds.has(game.appid)
                          ? 'bg-accent-primary/10 text-accent-primary'
                          : 'text-text-muted hover:bg-surface-elevated hover:text-accent-primary'
                      }`}
                      title={pinnedIds.has(game.appid) ? 'Pinned' : 'Pin game'}
                    >
                      {pinningIds.has(game.appid)
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Pin className={`h-4 w-4 ${pinnedIds.has(game.appid) ? 'fill-current' : ''}`} />}
                    </button>
                    <button
                      onClick={() => onOpenDetail(game.appid)}
                      className="rounded-md p-1.5 text-text-muted hover:bg-surface-elevated hover:text-accent-primary"
                      title="Open detail"
                    >
                      <ChevronDown className="h-4 w-4 -rotate-90" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {games.length === 0 && (
        <div className="px-6 py-12 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-text-muted" />
          <div className="text-subheading text-text-primary">No matching unreleased games</div>
          <p className="mt-1 text-body-sm text-text-secondary">Adjust filters or include adult content if that was intentional.</p>
        </div>
      )}
    </div>
  );
}

export function UnreleasedPageClient({
  initialData,
  initialStats,
  initialFilters,
}: UnreleasedPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authReady = useAuthReady();
  const filters = useMemo(
    () => filtersFromSearchParams(new URLSearchParams(searchParams.toString()), initialFilters),
    [searchParams, initialFilters]
  );
  const [games, setGames] = useState(initialData);
  const [stats, setStats] = useState(initialStats);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pinnedIds, setPinnedIds] = useState<Set<number>>(new Set());
  const [pinningIds, setPinningIds] = useState<Set<number>>(new Set());
  const [detailAppid, setDetailAppid] = useState<number | null>(null);
  const [genreOptions, setGenreOptions] = useState<FilterOption[]>([]);
  const [tagOptions, setTagOptions] = useState<FilterOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<FilterOption[]>([]);

  const selectedGames = useMemo(
    () => games.filter((game) => selectedIds.has(game.appid)),
    [games, selectedIds]
  );

  const updateFilters = useCallback((updates: Partial<UnreleasedFilters>) => {
    const next: UnreleasedFilters = {
      ...filters,
      ...updates,
      offset: 0,
    };
    const params = buildSearchParams(next);
    router.push(params.toString() ? `/unreleased?${params.toString()}` : '/unreleased', { scroll: false });
  }, [filters, router]);

  const clearFilters = useCallback(() => {
    router.push('/unreleased', { scroll: false });
  }, [router]);

  const fetchData = useCallback(async (currentFilters: UnreleasedFilters, showInitialLoading = false) => {
    const params = buildSearchParams(currentFilters);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    if (showInitialLoading) setIsLoading(true);
    setIsFetching(true);
    setError(null);
    try {
      const response = await fetch(`/api/unreleased?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      const payload = await response.json() as UnreleasedApiResponse;
      setGames(payload.data);
      setStats(payload.stats);
      setSelectedIds(new Set());
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        setError('Query timed out. Narrow the filters or try again.');
      } else {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load unreleased games');
      }
    } finally {
      window.clearTimeout(timeout);
      setIsLoading(false);
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    void fetchData(filters);
  }, [authReady, fetchData, filters]);

  useEffect(() => {
    if (!authReady) return;
    const baseParams = buildSearchParams(filters);
    const loadOptions = async (filterType: 'genre' | 'tag' | 'category') => {
      const params = new URLSearchParams(baseParams.toString());
      params.set('filterType', filterType);
      const response = await fetch(`/api/unreleased/filter-counts?${params.toString()}`);
      if (!response.ok) return [];
      const payload = await response.json() as { data: FilterOption[] };
      return payload.data;
    };
    void Promise.all([loadOptions('genre'), loadOptions('tag'), loadOptions('category')])
      .then(([genres, tags, categories]) => {
        setGenreOptions(genres);
        setTagOptions(tags);
        setCategoryOptions(categories);
      })
      .catch(() => {
        setGenreOptions([]);
        setTagOptions([]);
        setCategoryOptions([]);
      });
  }, [authReady, filters]);

  const handleSearch = useCallback((value: string) => {
    updateFilters({ search: value || undefined });
  }, [updateFilters]);

  const handleSort = useCallback((field: UnreleasedSortField) => {
    if (filters.sort === field) {
      updateFilters({ order: filters.order === 'asc' ? 'desc' : 'asc' });
      return;
    }
    const option = SORT_OPTIONS.find((item) => item.value === field);
    updateFilters({ sort: field, order: option?.defaultOrder ?? 'desc' });
  }, [filters.order, filters.sort, updateFilters]);

  const applyPreset = useCallback((preset: typeof PRESETS[number]) => {
    const next: UnreleasedFilters = {
      ...DEFAULT_FILTERS,
      ...preset.params,
    };
    const params = buildSearchParams(next);
    router.push(params.toString() ? `/unreleased?${params.toString()}` : '/unreleased', { scroll: false });
  }, [router]);

  const toggleSelected = useCallback((appid: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(appid)) next.delete(appid);
      else next.add(appid);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = games.length > 0 && games.every((game) => prev.has(game.appid));
      if (allSelected) {
        const next = new Set(prev);
        games.forEach((game) => next.delete(game.appid));
        return next;
      }
      const next = new Set(prev);
      games.forEach((game) => next.add(game.appid));
      return next;
    });
  }, [games]);

  const exportSelected = useCallback(() => {
    const rows = selectedGames.length > 0 ? selectedGames : games;
    downloadCsv(
      generateUnreleasedCsv(rows),
      unreleasedCsvFilename(selectedGames.length > 0 ? 'selected' : 'visible')
    );
  }, [games, selectedGames]);

  const pinGame = useCallback(async (game: UnreleasedGame) => {
    if (pinnedIds.has(game.appid)) return;
    setPinningIds((prev) => new Set(prev).add(game.appid));
    try {
      const response = await fetch('/api/pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'game',
          entityId: game.appid,
          displayName: game.name,
        }),
      });
      if (response.ok || response.status === 409) {
        setPinnedIds((prev) => new Set(prev).add(game.appid));
      }
    } finally {
      setPinningIds((prev) => {
        const next = new Set(prev);
        next.delete(game.appid);
        return next;
      });
    }
  }, [pinnedIds]);

  const activeCount = activeFilterCount(filters);
  const currentSort = SORT_OPTIONS.find((item) => item.value === filters.sort);
  const projectionAge = stats.projection_refreshed_at ? formatRelative(stats.projection_refreshed_at) : 'unknown';

  return (
    <div className="space-y-5">
      <div className="border-b border-border-subtle pb-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-caption uppercase tracking-[0.08em] text-text-tertiary">
              <CalendarClock className="h-4 w-4" />
              Launch pipeline
            </div>
            <h1 className="text-display text-text-primary">Unreleased Games</h1>
            <p className="mt-1 max-w-3xl text-body text-text-secondary">
              Upcoming Steam catalog, release signals, store changes, news, and publisher opportunity tracking.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => void fetchData(filters, true)} disabled={isFetching}>
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
            <Button variant="secondary" size="sm" onClick={exportSelected} disabled={games.length === 0}>
              <Download className="h-4 w-4" />
              {selectedGames.length > 0 ? `Export ${selectedGames.length}` : 'Export Visible'}
            </Button>
          </div>
        </div>
      </div>

      <MetricStrip stats={stats} />

      <Card padding="md" className="rounded-lg">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="min-w-[280px] flex-1">
            <SearchInput
              value={filters.search ?? ''}
              onChange={(event) => handleSearch(event.target.value)}
              onClear={() => handleSearch('')}
              placeholder="Search title, appid, publisher, developer"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filters.sort}
              onChange={(event) => {
                const field = event.target.value as UnreleasedSortField;
                const option = SORT_OPTIONS.find((item) => item.value === field);
                updateFilters({ sort: field, order: option?.defaultOrder ?? 'desc' });
              }}
              className="h-9 rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-body-sm text-text-primary focus:border-accent-primary focus:outline-none"
              aria-label="Sort"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateFilters({ order: filters.order === 'asc' ? 'desc' : 'asc' })}
            >
              {filters.order === 'asc' ? 'Asc' : 'Desc'}
            </Button>
            <select
              value={filters.adult ?? 'exclude'}
              onChange={(event) => updateFilters({ adult: event.target.value as AdultFilter })}
              className="h-9 rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-body-sm text-text-primary focus:border-accent-primary focus:outline-none"
              aria-label="Adult content filter"
            >
              <option value="exclude">Adult hidden</option>
              <option value="include">Adult included</option>
              <option value="only">Adult only</option>
            </select>
            <Button variant="secondary" size="sm" onClick={() => setShowFilters((value) => !value)}>
              <SlidersHorizontal className="h-4 w-4" />
              Filters {activeCount > 0 ? `(${activeCount})` : ''}
            </Button>
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {PRESETS.map((preset) => {
            const active =
              preset.params.sort === filters.sort &&
              preset.params.order === filters.order &&
              isSameArray(preset.params.releaseStatuses, filters.releaseStatuses) &&
              isSameArray(preset.params.publisherStatuses, filters.publisherStatuses) &&
              preset.params.hasRecentChange === filters.hasRecentChange &&
              preset.params.minNewsDays === filters.minNewsDays &&
              preset.params.hasScreenshots === filters.hasScreenshots &&
              preset.params.hasTrailers === filters.hasTrailers;
            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                title={preset.tooltip}
                className={`whitespace-nowrap rounded-md border px-2.5 py-1.5 text-body-sm transition-colors ${
                  active
                    ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                    : 'border-border-subtle text-text-secondary hover:border-border-muted hover:text-text-primary'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </Card>

      {showFilters && (
        <FiltersPanel
          filters={filters}
          genreOptions={genreOptions}
          tagOptions={tagOptions}
          categoryOptions={categoryOptions}
          onChange={updateFilters}
        />
      )}

      {error && (
        <Card className="rounded-lg border-accent-red/40 bg-accent-red/10">
          <div className="text-subheading text-accent-red">Could not load unreleased games</div>
          <p className="mt-1 text-body-sm text-text-secondary">{error}</p>
        </Card>
      )}

      <div className="flex items-center justify-between gap-3 text-body-sm text-text-secondary">
        <div>
          Showing {formatNumber(games.length)} visible rows sorted by {currentSort?.label ?? filters.sort}.
          {selectedGames.length > 0 && <span className="ml-2 text-accent-primary">{selectedGames.length} selected</span>}
        </div>
        <div className="flex items-center gap-2 text-caption text-text-tertiary">
          <Newspaper className="h-3.5 w-3.5" />
          Projection refreshed {projectionAge}
        </div>
      </div>

      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/70">
            <Loader2 className="h-6 w-6 animate-spin text-accent-primary" />
          </div>
        )}
        <GamesTable
          games={games}
          selectedIds={selectedIds}
          pinnedIds={pinnedIds}
          pinningIds={pinningIds}
          sort={filters.sort}
          order={filters.order}
          onSort={handleSort}
          onToggleSelected={toggleSelected}
          onToggleAll={toggleAll}
          onOpenDetail={setDetailAppid}
          onPin={pinGame}
        />
      </div>

      <DetailInspector appid={detailAppid} onClose={() => setDetailAppid(null)} />
    </div>
  );
}
