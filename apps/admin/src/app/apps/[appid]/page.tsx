import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface AppDetails {
  appid: number;
  name: string;
  type: string;
  is_free: boolean;
  release_date: string | null;
  release_date_raw: string | null;
  page_creation_date: string | null;
  has_workshop: boolean;
  current_price_cents: number | null;
  current_discount_percent: number | null;
  is_released: boolean;
  is_delisted: boolean;
  has_developer_info: boolean;
  created_at: string;
  updated_at: string;
}

interface DailyMetric {
  metric_date: string;
  review_score: number | null;
  review_score_desc: string | null;
  total_reviews: number | null;
  positive_reviews: number | null;
  negative_reviews: number | null;
  owners_min: number | null;
  owners_max: number | null;
  ccu_peak: number | null;
  average_playtime_forever: number | null;
  average_playtime_2weeks: number | null;
  price_cents: number | null;
  discount_percent: number | null;
}

interface ReviewHistogram {
  month_start: string;
  recommendations_up: number;
  recommendations_down: number;
}

interface AppTrends {
  trend_30d_direction: string | null;
  trend_30d_change_pct: number | null;
  trend_90d_direction: string | null;
  trend_90d_change_pct: number | null;
  current_positive_ratio: number | null;
  previous_positive_ratio: number | null;
  review_velocity_7d: number | null;
  review_velocity_30d: number | null;
  ccu_trend_7d_pct: number | null;
}

interface SyncStatus {
  last_steamspy_sync: string | null;
  last_storefront_sync: string | null;
  last_reviews_sync: string | null;
  last_histogram_sync: string | null;
  last_page_creation_scrape: string | null;
  priority_score: number | null;
  refresh_tier: string | null;
  last_activity_at: string | null;
  consecutive_errors: number | null;
  last_error_source: string | null;
  last_error_message: string | null;
  last_error_at: string | null;
  is_syncable: boolean;
}

async function getAppDetails(appid: number) {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('apps')
    .select('*')
    .eq('appid', appid)
    .single();

  if (error || !data) return null;

  // Cast to handle has_developer_info which was added in a later migration
  const appData = data as typeof data & { has_developer_info?: boolean };
  return {
    ...appData,
    has_developer_info: appData.has_developer_info ?? false,
  } as AppDetails;
}

async function getDevelopers(appid: number): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  const { data } = await supabase
    .from('app_developers')
    .select('developers(name)')
    .eq('appid', appid);

  return (data ?? []).map((d: { developers: { name: string } | null }) => d.developers?.name).filter((name): name is string => Boolean(name));
}

async function getPublishers(appid: number): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  const { data } = await supabase
    .from('app_publishers')
    .select('publishers(name)')
    .eq('appid', appid);

  return (data ?? []).map((p: { publishers: { name: string } | null }) => p.publishers?.name).filter((name): name is string => Boolean(name));
}

async function getTags(appid: number): Promise<{ tag: string; vote_count: number }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  const { data } = await supabase
    .from('app_tags')
    .select('tag, vote_count')
    .eq('appid', appid)
    .order('vote_count', { ascending: false });

  return data ?? [];
}

async function getDailyMetrics(appid: number): Promise<DailyMetric[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  const { data } = await supabase
    .from('daily_metrics')
    .select('*')
    .eq('appid', appid)
    .order('metric_date', { ascending: false })
    .limit(30);

  return data ?? [];
}

async function getReviewHistogram(appid: number): Promise<ReviewHistogram[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  const { data } = await supabase
    .from('review_histogram')
    .select('month_start, recommendations_up, recommendations_down')
    .eq('appid', appid)
    .order('month_start', { ascending: false })
    .limit(24);

  return data ?? [];
}

async function getTrends(appid: number): Promise<AppTrends | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();

  const { data } = await supabase
    .from('app_trends')
    .select('*')
    .eq('appid', appid)
    .single();

  return data ?? null;
}

async function getSyncStatus(appid: number): Promise<SyncStatus | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();

  const { data } = await supabase
    .from('sync_status')
    .select('*')
    .eq('appid', appid)
    .single();

  if (!data) return null;

  // Cast to handle columns added in later migrations
  const syncData = data as typeof data & { refresh_tier?: string; last_activity_at?: string };
  return {
    ...syncData,
    refresh_tier: syncData.refresh_tier ?? null,
    last_activity_at: syncData.last_activity_at ?? null,
  } as SyncStatus;
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
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colors[type] ?? 'bg-gray-500/20 text-gray-400'}`}>
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
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colors[tier] ?? 'bg-gray-500/20 text-gray-400'}`}>
      {tier}
    </span>
  );
}

function TrendIndicator({ direction, change, label }: { direction: string | null; change: number | null; label: string }) {
  if (!direction) return null;

  const icons: Record<string, { icon: string; color: string; bgColor: string }> = {
    up: { icon: '↑', color: 'text-green-400', bgColor: 'bg-green-500/10' },
    down: { icon: '↓', color: 'text-red-400', bgColor: 'bg-red-500/10' },
    stable: { icon: '→', color: 'text-gray-400', bgColor: 'bg-gray-500/10' },
  };

  const { icon, color, bgColor } = icons[direction] ?? { icon: '-', color: 'text-gray-400', bgColor: 'bg-gray-500/10' };

  return (
    <div className={`rounded-lg p-4 ${bgColor}`}>
      <div className={`text-2xl font-bold ${color}`}>
        {icon} {change !== null ? `${change > 0 ? '+' : ''}${change.toFixed(1)}%` : '-'}
      </div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString();
}

function formatNumber(n: number | null): string {
  if (n === null) return '-';
  return n.toLocaleString();
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

function formatPlaytime(minutes: number | null): string {
  if (minutes === null) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function formatPrice(cents: number | null, isFree: boolean): string {
  if (isFree) return 'Free';
  if (cents === null) return '-';
  return `$${(cents / 100).toFixed(2)}`;
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

function ReviewScoreBadge({ desc, score }: { desc: string | null; score: number | null }) {
  if (!desc) return <span className="text-gray-500">No reviews</span>;

  const colors: Record<string, { text: string; bg: string }> = {
    'Overwhelmingly Positive': { text: 'text-green-400', bg: 'bg-green-500/20' },
    'Very Positive': { text: 'text-green-400', bg: 'bg-green-500/20' },
    'Positive': { text: 'text-green-500', bg: 'bg-green-500/15' },
    'Mostly Positive': { text: 'text-lime-400', bg: 'bg-lime-500/20' },
    'Mixed': { text: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    'Mostly Negative': { text: 'text-orange-400', bg: 'bg-orange-500/20' },
    'Negative': { text: 'text-red-400', bg: 'bg-red-500/20' },
    'Very Negative': { text: 'text-red-500', bg: 'bg-red-500/25' },
    'Overwhelmingly Negative': { text: 'text-red-600', bg: 'bg-red-500/30' },
  };

  const style = colors[desc] ?? { text: 'text-gray-400', bg: 'bg-gray-500/20' };

  return (
    <span className={`inline-flex items-center rounded-lg px-3 py-1 text-sm font-medium ${style.text} ${style.bg}`}>
      {desc}
      {score !== null && <span className="ml-2 opacity-75">({score}%)</span>}
    </span>
  );
}

function StatCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
      {subValue && <div className="mt-1 text-xs text-gray-500">{subValue}</div>}
    </div>
  );
}

function SyncRow({ label, date, isError = false }: { label: string; date: string | null; isError?: boolean }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-800 last:border-0">
      <span className="text-gray-400">{label}</span>
      <span className={isError ? 'text-red-400' : 'text-gray-300'}>{timeAgo(date)}</span>
    </div>
  );
}

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ appid: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />;
  }

  const { appid: appidStr } = await params;
  const appid = parseInt(appidStr, 10);

  if (isNaN(appid)) {
    notFound();
  }

  const [app, developers, publishers, tags, metrics, histogram, trends, syncStatus] = await Promise.all([
    getAppDetails(appid),
    getDevelopers(appid),
    getPublishers(appid),
    getTags(appid),
    getDailyMetrics(appid),
    getReviewHistogram(appid),
    getTrends(appid),
    getSyncStatus(appid),
  ]);

  if (!app) {
    notFound();
  }

  const latestMetrics = metrics[0] ?? null;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <Link href="/apps" className="text-gray-400 hover:text-white">
            ← Back to Apps
          </Link>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">{app.name}</h1>
              <TypeBadge type={app.type} />
              {app.is_delisted && (
                <span className="rounded bg-red-500/20 px-2 py-1 text-sm text-red-400">Delisted</span>
              )}
              {!app.is_released && (
                <span className="rounded bg-yellow-500/20 px-2 py-1 text-sm text-yellow-400">Unreleased</span>
              )}
            </div>
            <p className="mt-2 text-gray-400">
              App ID: <span className="font-mono text-gray-300">{app.appid}</span>
              {' · '}
              <a
                href={`https://store.steampowered.com/app/${app.appid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                View on Steam →
              </a>
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{formatPrice(app.current_price_cents, app.is_free)}</div>
            {app.current_discount_percent && app.current_discount_percent > 0 && (
              <span className="text-green-400">-{app.current_discount_percent}% off</span>
            )}
          </div>
        </div>
      </div>

      {/* Developer / Publisher */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Developers</h2>
          {developers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {developers.map((dev) => (
                <span key={dev} className="rounded bg-gray-700 px-3 py-1 text-sm text-gray-300">
                  {dev}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No developers linked</p>
          )}
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Publishers</h2>
          {publishers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {publishers.map((pub) => (
                <span key={pub} className="rounded bg-gray-700 px-3 py-1 text-sm text-gray-300">
                  {pub}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No publishers linked</p>
          )}
        </div>
      </div>

      {/* Review Score & Stats */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Current Metrics</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          <div className="col-span-2 rounded-lg border border-gray-800 bg-gray-900 p-4">
            <div className="mb-2">
              <ReviewScoreBadge desc={latestMetrics?.review_score_desc ?? null} score={latestMetrics?.review_score ?? null} />
            </div>
            <div className="text-sm text-gray-400">
              {formatNumber(latestMetrics?.positive_reviews ?? null)} positive / {formatNumber(latestMetrics?.negative_reviews ?? null)} negative
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Total: {formatNumber(latestMetrics?.total_reviews ?? null)} reviews
            </div>
          </div>
          <StatCard label="Owners" value={formatOwners(latestMetrics?.owners_min ?? null, latestMetrics?.owners_max ?? null)} />
          <StatCard label="Peak CCU" value={formatNumber(latestMetrics?.ccu_peak ?? null)} />
          <StatCard label="Avg Playtime" value={formatPlaytime(latestMetrics?.average_playtime_forever ?? null)} subValue="All time" />
          <StatCard label="Recent Playtime" value={formatPlaytime(latestMetrics?.average_playtime_2weeks ?? null)} subValue="Last 2 weeks" />
        </div>
      </div>

      {/* Trends */}
      {trends && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Trends</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <TrendIndicator direction={trends.trend_30d_direction} change={trends.trend_30d_change_pct} label="30 Day Trend" />
            <TrendIndicator direction={trends.trend_90d_direction} change={trends.trend_90d_change_pct} label="90 Day Trend" />
            <div className="rounded-lg bg-gray-900 border border-gray-800 p-4">
              <div className="text-2xl font-bold text-white">
                {trends.review_velocity_7d !== null ? trends.review_velocity_7d.toFixed(1) : '-'}
              </div>
              <div className="text-sm text-gray-400">Reviews/day (7d)</div>
            </div>
            <div className="rounded-lg bg-gray-900 border border-gray-800 p-4">
              <div className="text-2xl font-bold text-white">
                {trends.review_velocity_30d !== null ? trends.review_velocity_30d.toFixed(1) : '-'}
              </div>
              <div className="text-sm text-gray-400">Reviews/day (30d)</div>
            </div>
          </div>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {tags.map(({ tag, vote_count }) => (
              <span
                key={tag}
                className="rounded bg-gray-800 px-3 py-1.5 text-sm text-gray-300"
                title={`${vote_count.toLocaleString()} votes`}
              >
                {tag}
                <span className="ml-2 text-gray-500">{vote_count.toLocaleString()}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Review Histogram */}
      {histogram.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Monthly Reviews</h2>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="text-left text-sm text-gray-400">
                  <th className="pb-3">Month</th>
                  <th className="pb-3 text-right">Positive</th>
                  <th className="pb-3 text-right">Negative</th>
                  <th className="pb-3 text-right">Total</th>
                  <th className="pb-3 text-right">Ratio</th>
                  <th className="pb-3 w-48">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {histogram.slice(0, 12).map((h) => {
                  const total = h.recommendations_up + h.recommendations_down;
                  const ratio = total > 0 ? (h.recommendations_up / total * 100) : 0;
                  return (
                    <tr key={h.month_start} className="border-t border-gray-800">
                      <td className="py-2 text-gray-300">
                        {new Date(h.month_start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-2 text-right text-green-400">{h.recommendations_up.toLocaleString()}</td>
                      <td className="py-2 text-right text-red-400">{h.recommendations_down.toLocaleString()}</td>
                      <td className="py-2 text-right text-gray-300">{total.toLocaleString()}</td>
                      <td className="py-2 text-right text-gray-300">{ratio.toFixed(0)}%</td>
                      <td className="py-2">
                        <div className="flex h-4 overflow-hidden rounded bg-gray-800">
                          <div
                            className="bg-green-500"
                            style={{ width: `${ratio}%` }}
                          />
                          <div
                            className="bg-red-500"
                            style={{ width: `${100 - ratio}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily Metrics History */}
      {metrics.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Daily Metrics</h2>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="text-left text-sm text-gray-400">
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Score</th>
                  <th className="pb-3 text-right">Total Reviews</th>
                  <th className="pb-3 text-right">Positive</th>
                  <th className="pb-3 text-right">Negative</th>
                  <th className="pb-3 text-right">Peak CCU</th>
                  <th className="pb-3 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {metrics.slice(0, 14).map((m) => (
                  <tr key={m.metric_date} className="border-t border-gray-800">
                    <td className="py-2 text-gray-300">{formatDate(m.metric_date)}</td>
                    <td className="py-2">
                      <span className={`text-sm ${
                        m.review_score_desc?.includes('Positive') ? 'text-green-400' :
                        m.review_score_desc?.includes('Negative') ? 'text-red-400' :
                        m.review_score_desc === 'Mixed' ? 'text-yellow-400' : 'text-gray-400'
                      }`}>
                        {m.review_score_desc ?? '-'}
                      </span>
                    </td>
                    <td className="py-2 text-right text-gray-300">{formatNumber(m.total_reviews)}</td>
                    <td className="py-2 text-right text-green-400">{formatNumber(m.positive_reviews)}</td>
                    <td className="py-2 text-right text-red-400">{formatNumber(m.negative_reviews)}</td>
                    <td className="py-2 text-right text-gray-300">{formatNumber(m.ccu_peak)}</td>
                    <td className="py-2 text-right text-gray-300">
                      {m.price_cents !== null ? `$${(m.price_cents / 100).toFixed(2)}` : '-'}
                      {m.discount_percent && m.discount_percent > 0 && (
                        <span className="ml-1 text-green-400 text-xs">-{m.discount_percent}%</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* App Details & Sync Status */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* App Details */}
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">App Details</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-800">
              <span className="text-gray-400">Release Date</span>
              <span className="text-gray-300">{app.release_date ? formatDate(app.release_date) : app.release_date_raw ?? '-'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-800">
              <span className="text-gray-400">Page Creation</span>
              <span className="text-gray-300">{formatDate(app.page_creation_date)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-800">
              <span className="text-gray-400">Workshop</span>
              <span className={app.has_workshop ? 'text-green-400' : 'text-gray-500'}>{app.has_workshop ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-800">
              <span className="text-gray-400">Has Developer Info</span>
              <span className={app.has_developer_info ? 'text-green-400' : 'text-yellow-400'}>{app.has_developer_info ? 'Yes' : 'Pending'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-800">
              <span className="text-gray-400">First Seen</span>
              <span className="text-gray-300">{formatDateTime(app.created_at)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-400">Last Updated</span>
              <span className="text-gray-300">{formatDateTime(app.updated_at)}</span>
            </div>
          </div>
        </div>

        {/* Sync Status */}
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Sync Status</h2>
          {syncStatus ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <TierBadge tier={syncStatus.refresh_tier} />
                {syncStatus.is_syncable ? (
                  <span className="text-green-400 text-sm">Syncable</span>
                ) : (
                  <span className="text-red-400 text-sm">Sync Disabled</span>
                )}
                {syncStatus.priority_score !== null && (
                  <span className="text-gray-500 text-sm">Priority: {syncStatus.priority_score}</span>
                )}
              </div>
              <div className="space-y-1 text-sm">
                <SyncRow label="Storefront" date={syncStatus.last_storefront_sync} />
                <SyncRow label="Reviews" date={syncStatus.last_reviews_sync} />
                <SyncRow label="SteamSpy" date={syncStatus.last_steamspy_sync} />
                <SyncRow label="Histogram" date={syncStatus.last_histogram_sync} />
                <SyncRow label="Page Scrape" date={syncStatus.last_page_creation_scrape} />
                <SyncRow label="Last Activity" date={syncStatus.last_activity_at} />
              </div>
              {syncStatus.consecutive_errors !== null && syncStatus.consecutive_errors > 0 && (
                <div className="mt-4 rounded bg-red-500/10 border border-red-500/20 p-3">
                  <div className="text-red-400 font-medium">
                    {syncStatus.consecutive_errors} consecutive error{syncStatus.consecutive_errors > 1 ? 's' : ''}
                  </div>
                  {syncStatus.last_error_message && (
                    <div className="text-red-300 text-sm mt-1">{syncStatus.last_error_message}</div>
                  )}
                  {syncStatus.last_error_at && (
                    <div className="text-red-400/60 text-xs mt-1">
                      Last error: {formatDateTime(syncStatus.last_error_at)} ({syncStatus.last_error_source})
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500">No sync status available</p>
          )}
        </div>
      </div>
    </div>
  );
}
