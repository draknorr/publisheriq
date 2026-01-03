import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import { notFound } from 'next/navigation';
import { PageSubHeader } from '@/components/layout';
import { TypeBadge, ReviewScoreBadge, RatioBar } from '@/components/data-display';
import { ExternalLink } from 'lucide-react';
import { AppDetailSections } from './AppDetailSections';

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
  // PICS data
  controller_support: string | null;
  pics_review_score: number | null;
  pics_review_percentage: number | null;
  metacritic_score: number | null;
  metacritic_url: string | null;
  platforms: string | null;
  release_state: string | null;
  parent_appid: number | null;
  homepage_url: string | null;
  last_content_update: string | null;
  current_build_id: string | null;
  app_state: string | null;
  languages: Record<string, unknown> | null;
  content_descriptors: unknown[] | null;
  created_at: string;
  updated_at: string;
}

export interface SteamDeckInfo {
  category: 'verified' | 'playable' | 'unsupported' | 'unknown';
  tests_passed: string[] | null;
  tests_failed: string[] | null;
}

export interface Genre {
  id: number;
  name: string;
  is_primary: boolean;
}

export interface Category {
  id: number;
  name: string;
}

export interface Franchise {
  id: number;
  name: string;
}

export interface SteamTag {
  id: number;
  name: string;
  rank: number;
}

export interface DLCApp {
  appid: number;
  name: string;
  type: string;
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

  const appData = data as typeof data & { has_developer_info?: boolean };
  return {
    ...appData,
    has_developer_info: appData.has_developer_info ?? false,
  } as AppDetails;
}

async function getDevelopers(appid: number): Promise<{ id: number; name: string }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  const { data } = await supabase
    .from('app_developers')
    .select('developers(id, name)')
    .eq('appid', appid);

  return (data ?? [])
    .map((d: { developers: { id: number; name: string } | null }) => d.developers)
    .filter((dev): dev is { id: number; name: string } => dev !== null);
}

async function getPublishers(appid: number): Promise<{ id: number; name: string }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  const { data } = await supabase
    .from('app_publishers')
    .select('publishers(id, name)')
    .eq('appid', appid);

  return (data ?? [])
    .map((p: { publishers: { id: number; name: string } | null }) => p.publishers)
    .filter((pub): pub is { id: number; name: string } => pub !== null);
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

  const syncData = data as typeof data & { refresh_tier?: string; last_activity_at?: string };
  return {
    ...syncData,
    refresh_tier: syncData.refresh_tier ?? null,
    last_activity_at: syncData.last_activity_at ?? null,
  } as SyncStatus;
}

async function getSteamDeckInfo(appid: number): Promise<SteamDeckInfo | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();

  const { data } = await supabase
    .from('app_steam_deck')
    .select('category, tests_passed, tests_failed')
    .eq('appid', appid)
    .single();

  return data as SteamDeckInfo | null;
}

async function getGenres(appid: number): Promise<Genre[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  const { data } = await supabase
    .from('app_genres')
    .select('is_primary, steam_genres(genre_id, name)')
    .eq('appid', appid)
    .order('is_primary', { ascending: false });

  type GenreRow = { is_primary: boolean; steam_genres: { genre_id: number; name: string } | null };
  return ((data ?? []) as unknown as GenreRow[])
    .map((g) =>
      g.steam_genres ? { id: g.steam_genres.genre_id, name: g.steam_genres.name, is_primary: g.is_primary ?? false } : null)
    .filter((genre): genre is Genre => genre !== null);
}

async function getCategories(appid: number): Promise<Category[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  const { data } = await supabase
    .from('app_categories')
    .select('steam_categories(category_id, name)')
    .eq('appid', appid);

  return (data ?? [])
    .map((c: { steam_categories: { category_id: number; name: string } | null }) =>
      c.steam_categories ? { id: c.steam_categories.category_id, name: c.steam_categories.name } : null)
    .filter((category): category is Category => category !== null);
}

async function getFranchises(appid: number): Promise<Franchise[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  const { data } = await supabase
    .from('app_franchises')
    .select('franchises(id, name)')
    .eq('appid', appid);

  return (data ?? [])
    .map((f: { franchises: { id: number; name: string } | null }) => f.franchises)
    .filter((franchise): franchise is Franchise => franchise !== null);
}

async function getDLCs(appid: number): Promise<DLCApp[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  const { data } = await supabase
    .from('apps')
    .select('appid, name, type')
    .eq('parent_appid', appid)
    .order('name');

  return (data ?? []) as DLCApp[];
}

async function getSteamTags(appid: number): Promise<SteamTag[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  const { data } = await supabase
    .from('app_steam_tags')
    .select('rank, steam_tags(tag_id, name)')
    .eq('appid', appid)
    .order('rank');

  type TagRow = { rank: number; steam_tags: { tag_id: number; name: string } | null };
  return ((data ?? []) as unknown as TagRow[])
    .map((t) =>
      t.steam_tags ? { id: t.steam_tags.tag_id, name: t.steam_tags.name, rank: t.rank } : null)
    .filter((tag): tag is SteamTag => tag !== null);
}

function formatPrice(cents: number | null, isFree: boolean): string {
  if (isFree) return 'Free';
  if (cents === null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
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

function formatPlaytime(minutes: number | null): string {
  if (minutes === null) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function formatNumber(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString();
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

  const [app, developers, publishers, tags, metrics, histogram, trends, syncStatus, steamDeck, genres, categories, franchises, dlcs, steamTags] = await Promise.all([
    getAppDetails(appid),
    getDevelopers(appid),
    getPublishers(appid),
    getTags(appid),
    getDailyMetrics(appid),
    getReviewHistogram(appid),
    getTrends(appid),
    getSyncStatus(appid),
    getSteamDeckInfo(appid),
    getGenres(appid),
    getCategories(appid),
    getFranchises(appid),
    getDLCs(appid),
    getSteamTags(appid),
  ]);

  if (!app) {
    notFound();
  }

  const latestMetrics = metrics[0] ?? null;

  return (
    <div>
      {/* Header */}
      <PageSubHeader
        title={app.name}
        backLink={{ label: 'Back to Apps', href: '/apps' }}
        actions={
          <a
            href={`https://store.steampowered.com/app/${app.appid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-body-sm font-medium text-text-secondary hover:text-text-primary bg-surface-elevated hover:bg-surface-overlay border border-border-subtle transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Steam Store
          </a>
        }
      />

      {/* App meta */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <TypeBadge type={app.type as 'game' | 'dlc' | 'demo' | 'mod' | 'video'} />
        {steamDeck && (
          <span className={`px-2 py-0.5 rounded text-caption font-medium ${
            steamDeck.category === 'verified' ? 'bg-accent-green/15 text-accent-green' :
            steamDeck.category === 'playable' ? 'bg-accent-yellow/15 text-accent-yellow' :
            steamDeck.category === 'unsupported' ? 'bg-accent-red/15 text-accent-red' :
            'bg-surface-elevated text-text-muted'
          }`}>
            {steamDeck.category === 'verified' ? 'Deck Verified' :
             steamDeck.category === 'playable' ? 'Deck Playable' :
             steamDeck.category === 'unsupported' ? 'Deck Unsupported' : 'Deck Unknown'}
          </span>
        )}
        {app.is_delisted && (
          <span className="px-2 py-0.5 rounded text-caption bg-accent-red/15 text-accent-red font-medium">
            Delisted
          </span>
        )}
        {!app.is_released && (
          <span className="px-2 py-0.5 rounded text-caption bg-accent-yellow/15 text-accent-yellow font-medium">
            Unreleased
          </span>
        )}
        <span className="text-text-tertiary text-body-sm">
          ID: <span className="font-mono text-text-secondary">{app.appid}</span>
        </span>
        <span className="text-text-tertiary">·</span>
        <span className="text-subheading text-text-primary">
          {formatPrice(app.current_price_cents, app.is_free)}
          {app.current_discount_percent && app.current_discount_percent > 0 && (
            <span className="ml-2 text-accent-green text-body-sm">-{app.current_discount_percent}%</span>
          )}
        </span>
      </div>

      {/* Key metrics row - compact */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
        <div className="col-span-3 md:col-span-2 p-3 rounded-md border border-border-subtle bg-surface-raised">
          <div className="flex items-center gap-2 mb-1.5">
            {latestMetrics && latestMetrics.total_reviews && latestMetrics.total_reviews > 0 ? (
              <ReviewScoreBadge
                score={Math.round((latestMetrics.positive_reviews ?? 0) / latestMetrics.total_reviews * 100)}
                description={latestMetrics.review_score_desc ?? undefined}
              />
            ) : (
              <span className="text-text-muted text-body-sm">No reviews</span>
            )}
          </div>
          <div className="text-caption text-text-secondary mb-1.5">
            {formatNumber(latestMetrics?.positive_reviews ?? null)} pos / {formatNumber(latestMetrics?.negative_reviews ?? null)} neg
          </div>
          {latestMetrics && latestMetrics.positive_reviews !== null && latestMetrics.negative_reviews !== null && (
            <RatioBar positive={latestMetrics.positive_reviews} negative={latestMetrics.negative_reviews} />
          )}
        </div>
        <div className="p-3 rounded-md border border-border-subtle bg-surface-raised">
          <p className="text-caption text-text-tertiary">Owners</p>
          <p className="text-body font-semibold text-text-primary">{formatOwners(latestMetrics?.owners_min ?? null, latestMetrics?.owners_max ?? null)}</p>
        </div>
        <div className="p-3 rounded-md border border-border-subtle bg-surface-raised">
          <p className="text-caption text-text-tertiary">Peak CCU</p>
          <p className="text-body font-semibold text-text-primary">{formatNumber(latestMetrics?.ccu_peak ?? null)}</p>
        </div>
        <div className="p-3 rounded-md border border-border-subtle bg-surface-raised">
          <p className="text-caption text-text-tertiary">Avg Playtime</p>
          <p className="text-body font-semibold text-text-primary">{formatPlaytime(latestMetrics?.average_playtime_forever ?? null)}</p>
        </div>
        <div className="p-3 rounded-md border border-border-subtle bg-surface-raised">
          <p className="text-caption text-text-tertiary">Recent 2w</p>
          <p className="text-body font-semibold text-text-primary">{formatPlaytime(latestMetrics?.average_playtime_2weeks ?? null)}</p>
        </div>
      </div>

      {/* All sections */}
      <AppDetailSections
        app={app}
        developers={developers}
        publishers={publishers}
        tags={tags}
        metrics={metrics}
        histogram={histogram}
        trends={trends}
        syncStatus={syncStatus}
        steamDeck={steamDeck}
        genres={genres}
        categories={categories}
        franchises={franchises}
        dlcs={dlcs}
        steamTags={steamTags}
      />
    </div>
  );
}
