import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import Link from 'next/link';
import { PageHeader } from '@/components/layout';
import { MetricCard, TrendIndicator, ReviewScoreBadge } from '@/components/data-display';
import { Card } from '@/components/ui';
import { TrendingUp, AlertCircle, MessageSquare, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

type SortField = 'appid' | 'name' | 'release_date' | 'review_score' | 'total_reviews' | 'owners_max' | 'ccu_peak';
type SortOrder = 'asc' | 'desc';

interface Genre {
  id: number;
  name: string;
  is_primary: boolean;
}

interface AppWithDetails {
  appid: number;
  name: string;
  type: string;
  is_free: boolean;
  release_date: string | null;
  release_date_raw: string | null;
  has_workshop: boolean;
  current_price_cents: number | null;
  current_discount_percent: number | null;
  is_released: boolean;
  is_delisted: boolean;
  has_developer_info: boolean;
  review_score: number | null;
  review_score_desc: string | null;
  total_reviews: number | null;
  positive_reviews: number | null;
  negative_reviews: number | null;
  owners_min: number | null;
  owners_max: number | null;
  ccu_peak: number | null;
  average_playtime_forever: number | null;
  trend_30d_direction: string | null;
  trend_30d_change_pct: number | null;
  review_velocity_7d: number | null;
  refresh_tier: string | null;
  last_storefront_sync: string | null;
  last_reviews_sync: string | null;
  consecutive_errors: number | null;
  last_error_message: string | null;
  developers: string[];
  publishers: string[];
  tags: string[];
  steam_deck_category: 'verified' | 'playable' | 'unsupported' | 'unknown' | null;
  platforms: string | null;
  controller_support: string | null;
  metacritic_score: number | null;
  genres: Genre[];
}

async function getApps(search?: string, sort: SortField = 'appid', order: SortOrder = 'asc', filter?: string): Promise<AppWithDetails[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }
  const supabase = getSupabase();

  let query = supabase
    .from('apps')
    .select(`
      appid,
      name,
      type,
      is_free,
      release_date,
      release_date_raw,
      has_workshop,
      current_price_cents,
      current_discount_percent,
      is_released,
      is_delisted,
      platforms,
      controller_support,
      metacritic_score,
      daily_metrics (
        review_score,
        review_score_desc,
        total_reviews,
        positive_reviews,
        negative_reviews,
        owners_min,
        owners_max,
        ccu_peak,
        average_playtime_forever,
        metric_date
      ),
      app_trends (
        trend_30d_direction,
        trend_30d_change_pct,
        review_velocity_7d
      ),
      sync_status (
        refresh_tier,
        last_storefront_sync,
        last_reviews_sync,
        consecutive_errors,
        last_error_message
      ),
      app_developers (
        developers (name)
      ),
      app_publishers (
        publishers (name)
      ),
      app_tags (
        tag,
        vote_count
      ),
      app_steam_deck (
        category
      ),
      app_genres (
        is_primary,
        steam_genres (genre_id, name)
      )
    `)
    .limit(100);

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  if (filter === 'errors') {
    query = query.gt('sync_status.consecutive_errors', 0);
  } else if (filter === 'no_reviews') {
    query = query.is('daily_metrics.total_reviews', null);
  } else if (filter === 'trending_up') {
    query = query.eq('app_trends.trend_30d_direction', 'up');
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching apps:', error);
    return getAppsSimple(search);
  }

  type MetricRow = { metric_date: string; review_score: number | null; review_score_desc: string | null; total_reviews: number | null; positive_reviews: number | null; negative_reviews: number | null; owners_min: number | null; owners_max: number | null; ccu_peak: number | null; average_playtime_forever: number | null };
  type TrendRow = { trend_30d_direction: string | null; trend_30d_change_pct: number | null; review_velocity_7d: number | null };
  type SyncRow = { refresh_tier: string | null; last_storefront_sync: string | null; last_reviews_sync: string | null; consecutive_errors: number | null; last_error_message: string | null };
  type DevRow = { developers: { name: string } | null };
  type PubRow = { publishers: { name: string } | null };
  type TagRow = { tag: string; vote_count: number | null };
  type SteamDeckRow = { category: 'verified' | 'playable' | 'unsupported' | 'unknown' };
  type GenreRow = { is_primary: boolean; steam_genres: { genre_id: number; name: string } | null };

  const apps: AppWithDetails[] = (data ?? []).map((app: Record<string, unknown>) => {
    const metricsArr = app.daily_metrics as MetricRow[] | MetricRow | null;
    const latestMetrics = Array.isArray(metricsArr)
      ? metricsArr.sort((a, b) =>
          new Date(b.metric_date).getTime() - new Date(a.metric_date).getTime()
        )[0]
      : metricsArr;

    const trendsArr = app.app_trends as TrendRow[] | TrendRow | null;
    const trends = Array.isArray(trendsArr) ? trendsArr[0] : trendsArr;
    const syncArr = app.sync_status as SyncRow[] | SyncRow | null;
    const syncStatus = Array.isArray(syncArr) ? syncArr[0] : syncArr;

    const devArr = (app.app_developers ?? []) as DevRow[];
    const developers = devArr
      .map((ad) => ad.developers?.name)
      .filter((name): name is string => Boolean(name));

    const pubArr = (app.app_publishers ?? []) as PubRow[];
    const publishers = pubArr
      .map((ap) => ap.publishers?.name)
      .filter((name): name is string => Boolean(name));

    const tagArr = (app.app_tags ?? []) as TagRow[];
    const tags = tagArr
      .sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
      .slice(0, 5)
      .map((t) => t.tag);

    const steamDeckArr = app.app_steam_deck as SteamDeckRow[] | SteamDeckRow | null;
    const steamDeck = Array.isArray(steamDeckArr) ? steamDeckArr[0] : steamDeckArr;

    const genreArr = (app.app_genres ?? []) as GenreRow[];
    const genres: Genre[] = genreArr
      .map((g) => g.steam_genres ? { id: g.steam_genres.genre_id, name: g.steam_genres.name, is_primary: g.is_primary ?? false } : null)
      .filter((g): g is Genre => g !== null)
      .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)); // Primary first

    return {
      appid: app.appid as number,
      name: app.name as string,
      type: app.type as string,
      is_free: app.is_free as boolean,
      release_date: app.release_date as string | null,
      release_date_raw: app.release_date_raw as string | null,
      has_workshop: app.has_workshop as boolean,
      current_price_cents: app.current_price_cents as number | null,
      current_discount_percent: app.current_discount_percent as number | null,
      is_released: app.is_released as boolean,
      is_delisted: app.is_delisted as boolean,
      has_developer_info: developers.length > 0 || publishers.length > 0,
      review_score: latestMetrics?.review_score ?? null,
      review_score_desc: latestMetrics?.review_score_desc ?? null,
      total_reviews: latestMetrics?.total_reviews ?? null,
      positive_reviews: latestMetrics?.positive_reviews ?? null,
      negative_reviews: latestMetrics?.negative_reviews ?? null,
      owners_min: latestMetrics?.owners_min ?? null,
      owners_max: latestMetrics?.owners_max ?? null,
      ccu_peak: latestMetrics?.ccu_peak ?? null,
      average_playtime_forever: latestMetrics?.average_playtime_forever ?? null,
      trend_30d_direction: trends?.trend_30d_direction ?? null,
      trend_30d_change_pct: trends?.trend_30d_change_pct ?? null,
      review_velocity_7d: trends?.review_velocity_7d ?? null,
      refresh_tier: syncStatus?.refresh_tier ?? null,
      last_storefront_sync: syncStatus?.last_storefront_sync ?? null,
      last_reviews_sync: syncStatus?.last_reviews_sync ?? null,
      consecutive_errors: syncStatus?.consecutive_errors ?? null,
      last_error_message: syncStatus?.last_error_message ?? null,
      developers,
      publishers,
      tags,
      steam_deck_category: steamDeck?.category ?? null,
      platforms: app.platforms as string | null,
      controller_support: app.controller_support as string | null,
      metacritic_score: app.metacritic_score as number | null,
      genres,
    };
  });

  apps.sort((a, b) => {
    const aVal = a[sort];
    const bVal = b[sort];

    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return order === 'asc' ? 1 : -1;
    if (bVal === null) return order === 'asc' ? -1 : 1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return order === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });

  return apps;
}

async function getAppsSimple(search?: string): Promise<AppWithDetails[]> {
  const supabase = getSupabase();
  let query = supabase
    .from('apps')
    .select('*')
    .order('appid', { ascending: true })
    .limit(100);

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data } = await query;

  interface SimpleAppRow {
    appid: number;
    name: string;
    type: string;
    is_free: boolean;
    release_date: string | null;
    release_date_raw: string | null;
    has_workshop: boolean;
    current_price_cents: number | null;
    current_discount_percent: number | null;
    is_released: boolean;
    is_delisted: boolean;
    has_developer_info?: boolean;
  }

  return ((data ?? []) as SimpleAppRow[]).map((app): AppWithDetails => ({
    appid: app.appid,
    name: app.name,
    type: app.type,
    is_free: app.is_free,
    release_date: app.release_date,
    release_date_raw: app.release_date_raw,
    has_workshop: app.has_workshop,
    current_price_cents: app.current_price_cents,
    current_discount_percent: app.current_discount_percent,
    is_released: app.is_released,
    is_delisted: app.is_delisted,
    has_developer_info: app.has_developer_info ?? false,
    review_score: null,
    review_score_desc: null,
    total_reviews: null,
    positive_reviews: null,
    negative_reviews: null,
    owners_min: null,
    owners_max: null,
    ccu_peak: null,
    average_playtime_forever: null,
    trend_30d_direction: null,
    trend_30d_change_pct: null,
    review_velocity_7d: null,
    refresh_tier: null,
    last_storefront_sync: null,
    last_reviews_sync: null,
    consecutive_errors: null,
    last_error_message: null,
    developers: [],
    publishers: [],
    tags: [],
    steam_deck_category: null,
    platforms: null,
    controller_support: null,
    metacritic_score: null,
    genres: [],
  }));
}

async function getAppCount() {
  if (!isSupabaseConfigured()) {
    return 0;
  }
  const supabase = getSupabase();
  const { count } = await supabase
    .from('apps')
    .select('*', { count: 'exact', head: true });
  return count ?? 0;
}

async function getStats() {
  if (!isSupabaseConfigured()) {
    return { withReviews: 0, withErrors: 0, trendingUp: 0 };
  }
  const supabase = getSupabase();

  const [reviewsResult, errorsResult, trendingResult] = await Promise.all([
    supabase.from('daily_metrics').select('appid', { count: 'exact', head: true }),
    supabase.from('sync_status').select('appid', { count: 'exact', head: true }).gt('consecutive_errors', 0),
    supabase.from('app_trends').select('appid', { count: 'exact', head: true }).eq('trend_30d_direction', 'up'),
  ]);

  return {
    withReviews: reviewsResult.count ?? 0,
    withErrors: errorsResult.count ?? 0,
    trendingUp: trendingResult.count ?? 0,
  };
}

function formatOwners(min: number | null, max: number | null): string {
  if (min === null || max === null) return '—';

  const formatNum = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toString();
  };

  return `${formatNum(min)} - ${formatNum(max)}`;
}

function formatNumber(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString();
}

function SortHeader({
  field,
  label,
  currentSort,
  currentOrder,
  className = '',
}: {
  field: SortField;
  label: string;
  currentSort: SortField;
  currentOrder: SortOrder;
  className?: string;
}) {
  const isActive = currentSort === field;
  const nextOrder = isActive && currentOrder === 'asc' ? 'desc' : 'asc';
  const arrow = isActive ? (currentOrder === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <th className={`px-3 py-2 text-left text-caption font-medium text-text-tertiary ${className}`}>
      <Link
        href={`?sort=${field}&order=${nextOrder}`}
        className={`hover:text-text-primary transition-colors ${isActive ? 'text-accent-primary' : ''}`}
      >
        {label}{arrow}
      </Link>
    </th>
  );
}

export default async function AppsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; sort?: SortField; order?: SortOrder; filter?: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />;
  }

  const params = await searchParams;
  const { search, filter } = params;
  const sort = params.sort ?? 'appid';
  const order = params.order ?? 'asc';

  const [apps, totalCount, stats] = await Promise.all([
    getApps(search, sort, order, filter),
    getAppCount(),
    getStats(),
  ]);

  return (
    <div>
      <PageHeader
        title="Apps"
        description={`Browse and search Steam applications (${totalCount.toLocaleString()} total)`}
      />

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Apps with reviews"
          value={stats.withReviews}
          icon={<MessageSquare className="h-4 w-4" />}
        />
        <MetricCard
          label="Trending up (30d)"
          value={stats.trendingUp}
          icon={<TrendingUp className="h-4 w-4" />}
          change={stats.trendingUp > 0 ? { value: 0, direction: 'up' } : undefined}
        />
        <MetricCard
          label="With sync errors"
          value={stats.withErrors}
          icon={<AlertCircle className="h-4 w-4" />}
          change={stats.withErrors > 0 ? { value: 0, direction: 'down' } : undefined}
        />
      </div>

      {/* Search & Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <form className="flex-1">
          <div className="relative">
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search apps by name..."
              className="w-full h-10 rounded-md bg-surface-elevated border border-border-muted px-4 pl-10 text-body text-text-primary placeholder:text-text-muted transition-colors hover:border-border-prominent focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </form>
        <div className="flex gap-2">
          <Link
            href="/apps"
            className={`px-3 py-2 rounded-md text-body-sm font-medium transition-colors ${
              !filter
                ? 'bg-accent-blue text-white'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-overlay border border-border-subtle'
            }`}
          >
            All
          </Link>
          <Link
            href="/apps?filter=trending_up"
            className={`px-3 py-2 rounded-md text-body-sm font-medium transition-colors ${
              filter === 'trending_up'
                ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-overlay border border-border-subtle'
            }`}
          >
            Trending ↑
          </Link>
          <Link
            href="/apps?filter=errors"
            className={`px-3 py-2 rounded-md text-body-sm font-medium transition-colors ${
              filter === 'errors'
                ? 'bg-accent-red/20 text-accent-red border border-accent-red/30'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-overlay border border-border-subtle'
            }`}
          >
            Errors
          </Link>
        </div>
      </div>

      {apps.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-surface-overlay flex items-center justify-center mb-4">
            <ExternalLink className="h-6 w-6 text-text-tertiary" />
          </div>
          <h3 className="text-subheading text-text-primary">No apps found</h3>
          <p className="mt-2 text-body-sm text-text-secondary">
            {search
              ? 'Try a different search term'
              : 'Run the App List sync to populate apps'}
          </p>
        </Card>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-2">
            {apps.map((app) => (
              <Link key={app.appid} href={`/apps/${app.appid}`}>
                <Card variant="interactive" padding="sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-body-sm font-medium text-text-primary line-clamp-1">
                        {app.name}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        {app.genres.length > 0 && (
                          <span className="text-caption text-text-tertiary">{app.genres[0].name}</span>
                        )}
                        {app.developers.length > 0 && (
                          <span className="text-caption text-text-muted">• {app.developers[0]}</span>
                        )}
                      </div>
                    </div>
                    {app.trend_30d_direction && (
                      <TrendIndicator
                        direction={app.trend_30d_direction as 'up' | 'down' | 'stable'}
                        value={app.trend_30d_change_pct ?? undefined}
                        variant="badge"
                        size="sm"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-caption">
                    {app.total_reviews && app.total_reviews > 0 ? (
                      <ReviewScoreBadge score={Math.round((app.positive_reviews ?? 0) / app.total_reviews * 100)} />
                    ) : (
                      <span className="text-text-muted">No reviews</span>
                    )}
                    <span className="text-text-tertiary">{formatNumber(app.total_reviews)} reviews</span>
                    <span className="text-text-tertiary">{formatOwners(app.owners_min, app.owners_max)}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto scrollbar-thin rounded-lg border border-border-subtle">
            <table className="w-full">
              <thead className="bg-surface-elevated sticky top-0 z-10">
                <tr>
                  <SortHeader field="name" label="App Name" currentSort={sort} currentOrder={order} className="min-w-[250px]" />
                  <th className="px-3 py-2 text-left text-caption font-medium text-text-tertiary">Genres</th>
                  <th className="px-3 py-2 text-left text-caption font-medium text-text-tertiary">MC</th>
                  <th className="px-3 py-2 text-left text-caption font-medium text-text-tertiary">Developer</th>
                  <SortHeader field="review_score" label="Reviews" currentSort={sort} currentOrder={order} />
                  <SortHeader field="total_reviews" label="Count" currentSort={sort} currentOrder={order} />
                  <SortHeader field="owners_max" label="Owners" currentSort={sort} currentOrder={order} />
                  <th className="px-3 py-2 text-left text-caption font-medium text-text-tertiary">30d Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {apps.map((app) => (
                  <tr key={app.appid} className="bg-surface-raised hover:bg-surface-elevated transition-colors">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/apps/${app.appid}`}
                          className="text-body-sm font-medium text-text-primary hover:text-accent-primary transition-colors truncate max-w-[220px]"
                          title={app.name}
                        >
                          {app.name}
                        </Link>
                        {app.is_delisted && (
                          <span className="px-1 py-0.5 rounded text-caption-sm bg-accent-red/15 text-accent-red shrink-0">
                            Delisted
                          </span>
                        )}
                        {app.consecutive_errors && app.consecutive_errors > 0 && (
                          <span
                            className="px-1 py-0.5 rounded text-caption-sm bg-accent-orange/15 text-accent-orange shrink-0"
                            title={app.last_error_message ?? ''}
                          >
                            {app.consecutive_errors}err
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {app.genres.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <span className="text-body-sm text-text-secondary truncate max-w-[100px]">
                            {app.genres[0].name}
                          </span>
                          {app.genres.length > 1 && (
                            <span className="text-caption text-text-muted">+{app.genres.length - 1}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {app.metacritic_score !== null ? (
                        <span className={`text-body-sm font-medium ${
                          app.metacritic_score >= 75 ? 'text-accent-green' :
                          app.metacritic_score >= 50 ? 'text-accent-yellow' : 'text-accent-red'
                        }`}>
                          {app.metacritic_score}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {app.developers.length > 0 ? (
                        <span className="text-body-sm text-text-secondary truncate max-w-[120px] block">
                          {app.developers[0]}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {app.total_reviews && app.total_reviews > 0 ? (
                        <ReviewScoreBadge
                          score={Math.round((app.positive_reviews ?? 0) / app.total_reviews * 100)}
                        />
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-body-sm text-text-secondary">
                      {formatNumber(app.total_reviews)}
                    </td>
                    <td className="px-3 py-2 text-body-sm text-text-secondary">
                      {formatOwners(app.owners_min, app.owners_max)}
                    </td>
                    <td className="px-3 py-2">
                      {app.trend_30d_direction ? (
                        <TrendIndicator
                          direction={app.trend_30d_direction as 'up' | 'down' | 'stable'}
                          value={app.trend_30d_change_pct ?? undefined}
                          size="sm"
                        />
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {apps.length === 100 && (
        <p className="mt-4 text-center text-body-sm text-text-tertiary">
          Showing first 100 results. Use search to find specific apps.
        </p>
      )}
    </div>
  );
}
