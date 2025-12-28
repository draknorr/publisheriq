import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import { notFound } from 'next/navigation';
import { PageSubHeader } from '@/components/layout';
import { Card } from '@/components/ui';
import { MetricCard, ReviewScoreBadge, RatioBar } from '@/components/data-display';
import { ExternalLink } from 'lucide-react';
import { DeveloperDetailSections } from './DeveloperDetailSections';

export const dynamic = 'force-dynamic';

interface Developer {
  id: number;
  name: string;
  normalized_name: string;
  steam_vanity_url: string | null;
  first_game_release_date: string | null;
  first_page_creation_date: string | null;
  game_count: number;
  created_at: string;
  updated_at: string;
}

interface DeveloperApp {
  appid: number;
  name: string;
  type: string;
  is_free: boolean;
  release_date: string | null;
  is_released: boolean;
  is_delisted: boolean;
  review_score: number | null;
  review_score_desc: string | null;
  total_reviews: number | null;
  positive_reviews: number | null;
  negative_reviews: number | null;
  owners_min: number | null;
  owners_max: number | null;
  ccu_peak: number | null;
  trend_30d_direction: string | null;
  trend_30d_change_pct: number | null;
}

interface RelatedPublisher {
  id: number;
  name: string;
  game_count: number;
  shared_apps: number;
}

interface SimilarDeveloper {
  id: number;
  name: string;
  game_count: number;
  shared_tags: number;
}

interface ReviewHistogramGame {
  appid: number;
  name: string;
  recommendations_up: number;
  recommendations_down: number;
}

interface ReviewHistogram {
  month_start: string;
  recommendations_up: number;
  recommendations_down: number;
  games: ReviewHistogramGame[];
}

async function getDeveloper(id: number): Promise<Developer | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('developers')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as Developer;
}

async function getDeveloperApps(developerId: number): Promise<DeveloperApp[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  // Get all appids for this developer
  const { data: appLinks } = await supabase
    .from('app_developers')
    .select('appid')
    .eq('developer_id', developerId);

  if (!appLinks || appLinks.length === 0) return [];

  const appIds = appLinks.map(a => a.appid);

  // Get app details with latest metrics
  const { data: apps } = await supabase
    .from('apps')
    .select(`
      appid,
      name,
      type,
      is_free,
      release_date,
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
        metric_date
      ),
      app_trends (
        trend_30d_direction,
        trend_30d_change_pct
      )
    `)
    .in('appid', appIds);

  if (!apps) return [];

  type MetricRow = { metric_date: string; review_score: number | null; review_score_desc: string | null; total_reviews: number | null; positive_reviews: number | null; negative_reviews: number | null; owners_min: number | null; owners_max: number | null; ccu_peak: number | null };
  type TrendRow = { trend_30d_direction: string | null; trend_30d_change_pct: number | null };

  return apps.map((app: Record<string, unknown>) => {
    const metricsArr = app.daily_metrics as MetricRow[] | MetricRow | null;
    const latestMetrics = Array.isArray(metricsArr)
      ? metricsArr.sort((a, b) => new Date(b.metric_date).getTime() - new Date(a.metric_date).getTime())[0]
      : metricsArr;

    const trendsArr = app.app_trends as TrendRow[] | TrendRow | null;
    const trends = Array.isArray(trendsArr) ? trendsArr[0] : trendsArr;

    return {
      appid: app.appid as number,
      name: app.name as string,
      type: app.type as string,
      is_free: app.is_free as boolean,
      release_date: app.release_date as string | null,
      is_released: app.is_released as boolean,
      is_delisted: app.is_delisted as boolean,
      review_score: latestMetrics?.review_score ?? null,
      review_score_desc: latestMetrics?.review_score_desc ?? null,
      total_reviews: latestMetrics?.total_reviews ?? null,
      positive_reviews: latestMetrics?.positive_reviews ?? null,
      negative_reviews: latestMetrics?.negative_reviews ?? null,
      owners_min: latestMetrics?.owners_min ?? null,
      owners_max: latestMetrics?.owners_max ?? null,
      ccu_peak: latestMetrics?.ccu_peak ?? null,
      trend_30d_direction: trends?.trend_30d_direction ?? null,
      trend_30d_change_pct: trends?.trend_30d_change_pct ?? null,
    };
  });
}

async function getRelatedPublishers(developerId: number): Promise<RelatedPublisher[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  // Get all apps by this developer
  const { data: devApps } = await supabase
    .from('app_developers')
    .select('appid')
    .eq('developer_id', developerId);

  if (!devApps || devApps.length === 0) return [];

  const appIds = devApps.map(a => a.appid);

  // Get all publishers for those apps
  const { data: pubLinks } = await supabase
    .from('app_publishers')
    .select('publisher_id, appid')
    .in('appid', appIds);

  if (!pubLinks || pubLinks.length === 0) return [];

  // Count shared apps per publisher
  const pubCounts = new Map<number, number>();
  for (const link of pubLinks) {
    pubCounts.set(link.publisher_id, (pubCounts.get(link.publisher_id) ?? 0) + 1);
  }

  const publisherIds = [...pubCounts.keys()];

  // Get publisher details
  const { data: publishers } = await supabase
    .from('publishers')
    .select('id, name, game_count')
    .in('id', publisherIds);

  if (!publishers) return [];

  return publishers
    .map((pub: { id: number; name: string; game_count: number }) => ({
      id: pub.id,
      name: pub.name,
      game_count: pub.game_count,
      shared_apps: pubCounts.get(pub.id) ?? 0,
    }))
    .sort((a, b) => b.shared_apps - a.shared_apps)
    .slice(0, 10);
}

async function getDeveloperTags(developerId: number): Promise<{ tag: string; vote_count: number }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  // Get all apps by this developer
  const { data: appLinks } = await supabase
    .from('app_developers')
    .select('appid')
    .eq('developer_id', developerId);

  if (!appLinks || appLinks.length === 0) return [];

  const appIds = appLinks.map(a => a.appid);

  // Get all tags for those apps
  const { data: tags } = await supabase
    .from('app_tags')
    .select('tag, vote_count')
    .in('appid', appIds);

  if (!tags) return [];

  // Aggregate vote counts by tag
  const tagCounts = new Map<string, number>();
  for (const t of tags) {
    tagCounts.set(t.tag, (tagCounts.get(t.tag) ?? 0) + (t.vote_count ?? 0));
  }

  return [...tagCounts.entries()]
    .map(([tag, vote_count]) => ({ tag, vote_count }))
    .sort((a, b) => b.vote_count - a.vote_count)
    .slice(0, 20);
}

async function getDeveloperReviewHistogram(developerId: number): Promise<ReviewHistogram[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();

  // Get all apps by this developer with their names
  const { data: appLinks } = await supabase
    .from('app_developers')
    .select('appid, apps(name)')
    .eq('developer_id', developerId);

  if (!appLinks || appLinks.length === 0) return [];

  const appIds = appLinks.map(a => a.appid);
  const appNameMap = new Map<number, string>();
  for (const link of appLinks) {
    const appData = link.apps as { name: string } | null;
    if (appData) {
      appNameMap.set(link.appid, appData.name);
    }
  }

  // Get histogram data for all apps with appid included
  const { data } = await supabase
    .from('review_histogram')
    .select('appid, month_start, recommendations_up, recommendations_down')
    .in('appid', appIds)
    .order('month_start', { ascending: false });

  if (!data) return [];

  // Aggregate by month while preserving per-game data
  const monthMap = new Map<string, {
    up: number;
    down: number;
    games: Map<number, { up: number; down: number }>;
  }>();

  for (const h of data) {
    const existing = monthMap.get(h.month_start) ?? { up: 0, down: 0, games: new Map() };

    // Update totals
    existing.up += h.recommendations_up;
    existing.down += h.recommendations_down;

    // Update per-game data
    const gameData = existing.games.get(h.appid) ?? { up: 0, down: 0 };
    gameData.up += h.recommendations_up;
    gameData.down += h.recommendations_down;
    existing.games.set(h.appid, gameData);

    monthMap.set(h.month_start, existing);
  }

  return [...monthMap.entries()]
    .map(([month_start, { up, down, games }]) => ({
      month_start,
      recommendations_up: up,
      recommendations_down: down,
      games: [...games.entries()]
        .map(([appid, data]) => ({
          appid,
          name: appNameMap.get(appid) ?? `App ${appid}`,
          recommendations_up: data.up,
          recommendations_down: data.down,
        }))
        .sort((a, b) => b.recommendations_down - a.recommendations_down), // Sort by negative reviews
    }))
    .sort((a, b) => b.month_start.localeCompare(a.month_start))
    .slice(0, 24);
}

async function getSimilarDevelopers(developerId: number, topTags: string[]): Promise<SimilarDeveloper[]> {
  if (!isSupabaseConfigured() || topTags.length === 0) return [];
  const supabase = getSupabase();

  // Get apps that have these top tags
  const { data: taggedApps } = await supabase
    .from('app_tags')
    .select('appid')
    .in('tag', topTags.slice(0, 5));

  if (!taggedApps || taggedApps.length === 0) return [];

  const appIds = [...new Set(taggedApps.map(t => t.appid))];

  // Find developers of those apps (excluding current developer)
  const { data: devLinks } = await supabase
    .from('app_developers')
    .select('developer_id, appid')
    .in('appid', appIds)
    .neq('developer_id', developerId);

  if (!devLinks || devLinks.length === 0) return [];

  // Count shared apps per developer
  const devCounts = new Map<number, number>();
  for (const link of devLinks) {
    devCounts.set(link.developer_id, (devCounts.get(link.developer_id) ?? 0) + 1);
  }

  const developerIds = [...devCounts.keys()].slice(0, 20);

  // Get developer details
  const { data: developers } = await supabase
    .from('developers')
    .select('id, name, game_count')
    .in('id', developerIds);

  if (!developers) return [];

  return developers
    .map((dev: { id: number; name: string; game_count: number }) => ({
      id: dev.id,
      name: dev.name,
      game_count: dev.game_count,
      shared_tags: devCounts.get(dev.id) ?? 0,
    }))
    .sort((a, b) => b.shared_tags - a.shared_tags)
    .slice(0, 10);
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

export default async function DeveloperDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />;
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);

  if (isNaN(id)) {
    notFound();
  }

  const [developer, apps, relatedPublishers, tags, histogram] = await Promise.all([
    getDeveloper(id),
    getDeveloperApps(id),
    getRelatedPublishers(id),
    getDeveloperTags(id),
    getDeveloperReviewHistogram(id),
  ]);

  if (!developer) {
    notFound();
  }

  // Get similar developers based on top tags
  const topTagNames = tags.slice(0, 5).map(t => t.tag);
  const similarDevelopers = await getSimilarDevelopers(id, topTagNames);

  // Calculate aggregated metrics
  const totalReviews = apps.reduce((sum, a) => sum + (a.total_reviews ?? 0), 0);
  const totalPositive = apps.reduce((sum, a) => sum + (a.positive_reviews ?? 0), 0);
  const totalNegative = apps.reduce((sum, a) => sum + (a.negative_reviews ?? 0), 0);
  const avgScore = totalReviews > 0 ? Math.round((totalPositive / totalReviews) * 100) : null;

  const totalOwnersMin = apps.reduce((sum, a) => sum + (a.owners_min ?? 0), 0);
  const totalOwnersMax = apps.reduce((sum, a) => sum + (a.owners_max ?? 0), 0);
  const totalCCU = apps.reduce((sum, a) => sum + (a.ccu_peak ?? 0), 0);

  const gamesWithReviews = apps.filter(a => a.total_reviews && a.total_reviews > 0).length;

  return (
    <div>
      {/* Header */}
      <PageSubHeader
        title={developer.name}
        backLink={{ label: 'Back to Developers', href: '/developers' }}
        actions={
          developer.steam_vanity_url ? (
            <a
              href={`https://store.steampowered.com/developer/${developer.steam_vanity_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-body-sm font-medium text-text-secondary hover:text-text-primary bg-surface-elevated hover:bg-surface-overlay border border-border-subtle transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Steam
            </a>
          ) : undefined
        }
      />

      {/* Developer meta */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-body text-text-secondary">
          <span className="font-medium text-text-primary">{developer.game_count}</span> games
        </span>
        {developer.first_game_release_date && (
          <>
            <span className="text-text-tertiary">·</span>
            <span className="text-body text-text-tertiary">
              Since {new Date(developer.first_game_release_date).getFullYear()}
            </span>
          </>
        )}
        {developer.game_count >= 5 && (
          <span className="px-2 py-0.5 rounded text-caption bg-accent-cyan/15 text-accent-cyan font-medium">
            Prolific Developer
          </span>
        )}
      </div>

      {/* Key aggregated metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <Card className="col-span-2 p-4">
          <div className="flex items-center justify-between mb-2">
            {avgScore !== null ? (
              <ReviewScoreBadge score={avgScore} />
            ) : (
              <span className="text-text-muted text-body-sm">No reviews</span>
            )}
            <span className="text-caption text-text-tertiary">
              {gamesWithReviews} of {apps.length} games
            </span>
          </div>
          <div className="text-body-sm text-text-secondary">
            {formatNumber(totalPositive)} positive / {formatNumber(totalNegative)} negative
          </div>
          {totalPositive > 0 || totalNegative > 0 ? (
            <RatioBar positive={totalPositive} negative={totalNegative} className="mt-2" />
          ) : null}
        </Card>
        <MetricCard
          label="Total Reviews"
          value={formatNumber(totalReviews)}
          variant="compact"
        />
        <MetricCard
          label="Est. Owners"
          value={formatOwners(totalOwnersMin, totalOwnersMax)}
          variant="compact"
        />
        <MetricCard
          label="Total Peak CCU"
          value={formatNumber(totalCCU)}
          variant="compact"
        />
        <MetricCard
          label="Games"
          value={apps.length}
          variant="compact"
        />
      </div>

      {/* All sections */}
      <DeveloperDetailSections
        developer={developer}
        apps={apps}
        relatedPublishers={relatedPublishers}
        tags={tags}
        histogram={histogram}
        similarDevelopers={similarDevelopers}
      />
    </div>
  );
}
