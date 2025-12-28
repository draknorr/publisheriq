import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type SortField = 'appid' | 'name' | 'release_date' | 'review_score' | 'total_reviews' | 'owners_max' | 'ccu_peak';
type SortOrder = 'asc' | 'desc';

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
  // From daily_metrics (latest)
  review_score: number | null;
  review_score_desc: string | null;
  total_reviews: number | null;
  positive_reviews: number | null;
  negative_reviews: number | null;
  owners_min: number | null;
  owners_max: number | null;
  ccu_peak: number | null;
  average_playtime_forever: number | null;
  // From app_trends
  trend_30d_direction: string | null;
  trend_30d_change_pct: number | null;
  review_velocity_7d: number | null;
  // From sync_status
  refresh_tier: string | null;
  last_storefront_sync: string | null;
  last_reviews_sync: string | null;
  consecutive_errors: number | null;
  last_error_message: string | null;
  // Aggregated
  developers: string[];
  publishers: string[];
  tags: string[];
}

async function getApps(search?: string, sort: SortField = 'appid', order: SortOrder = 'asc', filter?: string): Promise<AppWithDetails[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }
  const supabase = getSupabase();

  // Build the query with all joins
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
    // Fallback to simple query without joins
    return getAppsSimple(search);
  }

  // Define types for the nested data
  type MetricRow = { metric_date: string; review_score: number | null; review_score_desc: string | null; total_reviews: number | null; positive_reviews: number | null; negative_reviews: number | null; owners_min: number | null; owners_max: number | null; ccu_peak: number | null; average_playtime_forever: number | null };
  type TrendRow = { trend_30d_direction: string | null; trend_30d_change_pct: number | null; review_velocity_7d: number | null };
  type SyncRow = { refresh_tier: string | null; last_storefront_sync: string | null; last_reviews_sync: string | null; consecutive_errors: number | null; last_error_message: string | null };
  type DevRow = { developers: { name: string } | null };
  type PubRow = { publishers: { name: string } | null };
  type TagRow = { tag: string; vote_count: number | null };

  // Transform and sort the data
  const apps: AppWithDetails[] = (data ?? []).map((app: Record<string, unknown>) => {
    // Get the latest daily_metrics entry
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
    };
  });

  // Sort the results
  apps.sort((a, b) => {
    const aVal = a[sort];
    const bVal = b[sort];

    // Handle nulls
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return order === 'asc' ? 1 : -1;
    if (bVal === null) return order === 'asc' ? -1 : 1;

    // Compare strings
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    // Compare numbers
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

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    game: 'bg-purple-500/20 text-purple-400',
    dlc: 'bg-blue-500/20 text-blue-400',
    demo: 'bg-cyan-500/20 text-cyan-400',
    mod: 'bg-orange-500/20 text-orange-400',
    video: 'bg-pink-500/20 text-pink-400',
  };

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colors[type] ?? 'bg-gray-500/20 text-gray-400'}`}
    >
      {type}
    </span>
  );
}

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return <span className="text-gray-600">-</span>;

  const colors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    moderate: 'bg-yellow-500/20 text-yellow-400',
    dormant: 'bg-orange-500/20 text-orange-400',
    dead: 'bg-red-500/20 text-red-400',
  };

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colors[tier] ?? 'bg-gray-500/20 text-gray-400'}`}
    >
      {tier}
    </span>
  );
}

function ReviewBadge({ desc, score }: { desc: string | null; score: number | null }) {
  if (!desc) return <span className="text-gray-600">-</span>;

  const colors: Record<string, string> = {
    'Overwhelmingly Positive': 'text-green-400',
    'Very Positive': 'text-green-400',
    'Positive': 'text-green-500',
    'Mostly Positive': 'text-lime-400',
    'Mixed': 'text-yellow-400',
    'Mostly Negative': 'text-orange-400',
    'Negative': 'text-red-400',
    'Very Negative': 'text-red-500',
    'Overwhelmingly Negative': 'text-red-600',
  };

  return (
    <span className={`text-sm ${colors[desc] ?? 'text-gray-400'}`}>
      {desc}
      {score !== null && <span className="text-gray-500 ml-1">({score}%)</span>}
    </span>
  );
}

function TrendIndicator({ direction, change }: { direction: string | null; change: number | null }) {
  if (!direction) return <span className="text-gray-600">-</span>;

  const icons: Record<string, { icon: string; color: string }> = {
    up: { icon: '↑', color: 'text-green-400' },
    down: { icon: '↓', color: 'text-red-400' },
    stable: { icon: '→', color: 'text-gray-400' },
  };

  const { icon, color } = icons[direction] ?? { icon: '-', color: 'text-gray-400' };

  return (
    <span className={`font-medium ${color}`}>
      {icon}
      {change !== null && <span className="ml-1">{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>}
    </span>
  );
}

function formatOwners(min: number | null, max: number | null): string {
  if (min === null || max === null) return '-';

  const formatNum = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toString();
  };

  return `${formatNum(min)} - ${formatNum(max)}`;
}

function formatNumber(n: number | null): string {
  if (n === null) return '-';
  return n.toLocaleString();
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
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
    <th className={`px-4 py-3 text-left text-sm font-medium text-gray-400 ${className}`}>
      <Link
        href={`?sort=${field}&order=${nextOrder}`}
        className={`hover:text-white ${isActive ? 'text-blue-400' : ''}`}
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Apps</h1>
        <p className="mt-2 text-gray-400">
          Browse and search Steam applications ({totalCount.toLocaleString()} total)
        </p>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <div className="text-2xl font-bold text-white">{stats.withReviews.toLocaleString()}</div>
          <div className="text-sm text-gray-400">Apps with reviews</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <div className="text-2xl font-bold text-green-400">{stats.trendingUp.toLocaleString()}</div>
          <div className="text-sm text-gray-400">Trending up (30d)</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <div className="text-2xl font-bold text-red-400">{stats.withErrors.toLocaleString()}</div>
          <div className="text-sm text-gray-400">With sync errors</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <form className="flex-1">
          <div className="relative">
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search apps by name..."
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 pl-10 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <svg
              className="absolute left-3 top-3.5 h-5 w-5 text-gray-500"
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
            className={`rounded-lg px-4 py-3 text-sm font-medium transition ${!filter ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            All
          </Link>
          <Link
            href="/apps?filter=trending_up"
            className={`rounded-lg px-4 py-3 text-sm font-medium transition ${filter === 'trending_up' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            Trending ↑
          </Link>
          <Link
            href="/apps?filter=errors"
            className={`rounded-lg px-4 py-3 text-sm font-medium transition ${filter === 'errors' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            Errors
          </Link>
        </div>
      </div>

      {apps.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-white">No apps found</h3>
          <p className="mt-2 text-gray-400">
            {search
              ? 'Try a different search term'
              : 'Run the App List sync to populate apps'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full min-w-[1400px]">
            <thead className="bg-gray-900">
              <tr>
                <SortHeader field="appid" label="App ID" currentSort={sort} currentOrder={order} />
                <SortHeader field="name" label="Name" currentSort={sort} currentOrder={order} className="min-w-[200px]" />
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Developer / Publisher</th>
                <SortHeader field="review_score" label="Reviews" currentSort={sort} currentOrder={order} />
                <SortHeader field="total_reviews" label="Count" currentSort={sort} currentOrder={order} />
                <SortHeader field="owners_max" label="Owners" currentSort={sort} currentOrder={order} />
                <SortHeader field="ccu_peak" label="CCU Peak" currentSort={sort} currentOrder={order} />
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">30d Trend</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Tier</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Last Sync</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {apps.map((app) => (
                <tr key={app.appid} className="bg-gray-900/50 hover:bg-gray-900">
                  <td className="px-4 py-3">
                    <Link
                      href={`/apps/${app.appid}`}
                      className="text-sm font-mono text-blue-400 hover:text-blue-300"
                    >
                      {app.appid}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/apps/${app.appid}`}
                        className="text-sm font-medium text-white hover:text-blue-400"
                      >
                        {app.name}
                      </Link>
                      {app.is_delisted && (
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400">
                          Delisted
                        </span>
                      )}
                      {app.consecutive_errors && app.consecutive_errors > 0 && (
                        <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-xs text-orange-400" title={app.last_error_message ?? ''}>
                          {app.consecutive_errors} err
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={app.type} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      {app.developers.length > 0 && (
                        <div className="text-gray-300">{app.developers[0]}</div>
                      )}
                      {app.publishers.length > 0 && app.publishers[0] !== app.developers[0] && (
                        <div className="text-gray-500 text-xs">{app.publishers[0]}</div>
                      )}
                      {app.developers.length === 0 && app.publishers.length === 0 && (
                        <span className="text-gray-600">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ReviewBadge desc={app.review_score_desc} score={app.review_score} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {formatNumber(app.total_reviews)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {formatOwners(app.owners_min, app.owners_max)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {formatNumber(app.ccu_peak)}
                  </td>
                  <td className="px-4 py-3">
                    <TrendIndicator direction={app.trend_30d_direction} change={app.trend_30d_change_pct} />
                  </td>
                  <td className="px-4 py-3">
                    <TierBadge tier={app.refresh_tier} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {timeAgo(app.last_reviews_sync)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {app.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-300"
                        >
                          {tag}
                        </span>
                      ))}
                      {app.tags.length === 0 && <span className="text-gray-600">-</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {apps.length === 100 && (
        <p className="mt-4 text-center text-sm text-gray-500">
          Showing first 100 results. Use search to find specific apps.
        </p>
      )}
    </div>
  );
}
