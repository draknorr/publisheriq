'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { Grid } from '@/components/layout';
import { TrendBadge, TierBadge, StackedBarChart, AreaChartComponent, RatioBar } from '@/components/data-display';
import { Calendar, Wrench, CheckCircle2, XCircle, AlertTriangle, Clock, ChevronRight, ExternalLink } from 'lucide-react';

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

interface SteamDeckInfo {
  category: 'verified' | 'playable' | 'unsupported' | 'unknown';
  tests_passed: string[] | null;
  tests_failed: string[] | null;
}

interface Genre {
  id: number;
  name: string;
  is_primary: boolean;
}

interface Category {
  id: number;
  name: string;
}

interface Franchise {
  id: number;
  name: string;
}

interface SteamTag {
  id: number;
  name: string;
  rank: number;
}

interface DLCApp {
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

interface AppDetailSectionsProps {
  app: AppDetails;
  developers: { id: number; name: string }[];
  publishers: { id: number; name: string }[];
  tags: { tag: string; vote_count: number }[];
  metrics: DailyMetric[];
  histogram: ReviewHistogram[];
  trends: AppTrends | null;
  syncStatus: SyncStatus | null;
  steamDeck: SteamDeckInfo | null;
  genres: Genre[];
  categories: Category[];
  franchises: Franchise[];
  dlcs: DLCApp[];
  steamTags: SteamTag[];
}

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'pics', label: 'PICS Data' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'sync', label: 'Sync Status' },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString();
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

function formatNumber(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString();
}

function getPICSReviewScoreDescription(score: number): string {
  const descriptions: Record<number, string> = {
    9: 'Overwhelmingly Positive',
    8: 'Very Positive',
    7: 'Positive',
    6: 'Mostly Positive',
    5: 'Mixed',
    4: 'Mostly Negative',
    3: 'Negative',
    2: 'Very Negative',
    1: 'Overwhelmingly Negative',
  };
  return descriptions[score] ?? 'Unknown';
}

function parseContentDescriptors(descriptors: unknown[] | null): { id: string; label: string; severity: 'high' | 'medium' }[] {
  if (!descriptors || !Array.isArray(descriptors)) return [];

  const descriptorMap: Record<string, { label: string; severity: 'high' | 'medium' }> = {
    '1': { label: 'Some Nudity or Sexual Content', severity: 'medium' },
    '2': { label: 'Frequent Violence or Gore', severity: 'medium' },
    '3': { label: 'Adult Only Sexual Content', severity: 'high' },
    '4': { label: 'Frequent Nudity or Sexual Content', severity: 'high' },
    '5': { label: 'General Mature Content', severity: 'medium' },
  };

  return descriptors
    .map(d => {
      const id = String(d);
      const info = descriptorMap[id];
      return info ? { id, ...info } : null;
    })
    .filter((d): d is { id: string; label: string; severity: 'high' | 'medium' } => d !== null);
}

export function AppDetailSections({
  app,
  developers,
  publishers,
  tags,
  metrics,
  histogram,
  trends,
  syncStatus,
  steamDeck,
  genres,
  categories,
  franchises,
  dlcs,
  steamTags,
}: AppDetailSectionsProps) {
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    const handleScroll = () => {
      const sectionElements = sections.map(s => document.getElementById(s.id));
      const scrollPosition = window.scrollY + 150;

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const element = sectionElements[i];
        if (element && element.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 120;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  return (
    <div>
      {/* Sticky section navigation */}
      <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm border-b border-border-subtle -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 py-3 mb-6">
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {sections.map((section, index) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-body-sm font-medium transition-colors ${
                activeSection === section.id
                  ? 'bg-accent-blue/10 text-accent-blue'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
              }`}
            >
              {section.label}
              {index < sections.length - 1 && (
                <ChevronRight className="h-3 w-3 text-text-muted ml-1" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* All sections in scrollable view */}
      <div className="space-y-12">
        <OverviewSection
          id="overview"
          app={app}
          developers={developers}
          publishers={publishers}
          tags={tags}
          steamTags={steamTags}
          trends={trends}
          genres={genres}
          franchises={franchises}
        />
        <PICSSection
          id="pics"
          app={app}
          steamDeck={steamDeck}
          categories={categories}
          dlcs={dlcs}
        />
        <MetricsSection id="metrics" metrics={metrics} />
        <ReviewsSection id="reviews" histogram={histogram} />
        <SyncSection id="sync" syncStatus={syncStatus} />
      </div>
    </div>
  );
}

function SectionHeader({ title, id }: { title: string; id: string }) {
  return (
    <h2 id={id} className="text-heading text-text-primary mb-6 scroll-mt-32">
      {title}
    </h2>
  );
}

function OverviewSection({
  id,
  app,
  developers,
  publishers,
  tags,
  steamTags,
  trends,
  genres,
  franchises,
}: {
  id: string;
  app: AppDetails;
  developers: { id: number; name: string }[];
  publishers: { id: number; name: string }[];
  tags: { tag: string; vote_count: number }[];
  steamTags: SteamTag[];
  trends: AppTrends | null;
  genres: Genre[];
  franchises: Franchise[];
}) {
  return (
    <section>
      <SectionHeader title="Overview" id={id} />
      <div className="space-y-6">
        {/* Trends */}
        {trends && (
          <div className="mb-6">
            <h3 className="text-subheading text-text-primary mb-4">Trends</h3>
            <Grid cols={4} gap="md">
              <TrendBadge
                direction={(trends.trend_30d_direction as 'up' | 'down' | 'stable') ?? 'stable'}
                value={trends.trend_30d_change_pct ?? undefined}
                label="30 Day Trend"
              />
              <TrendBadge
                direction={(trends.trend_90d_direction as 'up' | 'down' | 'stable') ?? 'stable'}
                value={trends.trend_90d_change_pct ?? undefined}
                label="90 Day Trend"
              />
              <Card className="p-4">
                <p className="text-heading text-text-primary">
                  {trends.review_velocity_7d?.toFixed(1) ?? '—'}
                </p>
                <p className="text-body-sm text-text-secondary">Reviews/day (7d)</p>
              </Card>
              <Card className="p-4">
                <p className="text-heading text-text-primary">
                  {trends.review_velocity_30d?.toFixed(1) ?? '—'}
                </p>
                <p className="text-body-sm text-text-secondary">Reviews/day (30d)</p>
              </Card>
            </Grid>
          </div>
        )}

        {/* Developer / Publisher */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card padding="lg">
            <h3 className="text-subheading text-text-primary mb-4">Developers</h3>
            {developers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {developers.map((dev) => (
                  <Link
                    key={dev.id}
                    href={`/developers/${dev.id}`}
                    className="px-3 py-1.5 rounded-md bg-surface-overlay text-body-sm text-text-secondary hover:bg-surface-elevated hover:text-accent-blue transition-colors"
                  >
                    {dev.name}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-body-sm">No developers linked</p>
            )}
          </Card>
          <Card padding="lg">
            <h3 className="text-subheading text-text-primary mb-4">Publishers</h3>
            {publishers.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {publishers.map((pub) => (
                  <Link
                    key={pub.id}
                    href={`/publishers/${pub.id}`}
                    className="px-3 py-1.5 rounded-md bg-surface-overlay text-body-sm text-text-secondary hover:bg-surface-elevated hover:text-accent-blue transition-colors"
                  >
                    {pub.name}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-body-sm">No publishers linked</p>
            )}
          </Card>
        </div>

        {/* Genres & Franchises */}
        {(genres.length > 0 || franchises.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {genres.length > 0 && (
              <Card padding="lg">
                <h3 className="text-subheading text-text-primary mb-4">Genres</h3>
                <div className="flex flex-wrap gap-2">
                  {genres.map((genre) => (
                    <span
                      key={genre.id}
                      className={`px-3 py-1.5 rounded-md text-body-sm ${
                        genre.is_primary
                          ? 'bg-accent-purple/20 text-accent-purple font-medium border border-accent-purple/30'
                          : 'bg-accent-purple/10 text-accent-purple'
                      }`}
                    >
                      {genre.is_primary && <span className="mr-1">★</span>}
                      {genre.name}
                    </span>
                  ))}
                </div>
              </Card>
            )}
            {franchises.length > 0 && (
              <Card padding="lg">
                <h3 className="text-subheading text-text-primary mb-4">Franchises</h3>
                <div className="flex flex-wrap gap-2">
                  {franchises.map((franchise) => (
                    <span
                      key={franchise.id}
                      className="px-3 py-1.5 rounded-md bg-accent-cyan/10 text-body-sm text-accent-cyan"
                    >
                      {franchise.name}
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* PICS Steam Tags (ranked) */}
        {steamTags.length > 0 && (() => {
          // Filter out placeholder tags (ones that start with "Tag ")
          const namedTags = steamTags.filter(t => !t.name.startsWith('Tag '));
          const unnamedCount = steamTags.length - namedTags.length;
          const displayTags = namedTags.slice(0, 15);
          const remainingCount = (namedTags.length > 15 ? namedTags.length - 15 : 0) + unnamedCount;

          return namedTags.length > 0 ? (
            <div>
              <h3 className="text-subheading text-text-primary mb-4">Steam Tags</h3>
              <div className="flex flex-wrap gap-2">
                {displayTags.map((tag) => (
                  <a
                    key={tag.id}
                    href={`https://store.steampowered.com/search/?tags=${tag.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-accent-blue/10 border border-accent-blue/20 text-body-sm text-accent-blue hover:bg-accent-blue/20 transition-colors"
                    title={`Rank #${tag.rank} - View on Steam`}
                  >
                    {tag.name}
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </a>
                ))}
                {remainingCount > 0 && (
                  <span className="px-3 py-1.5 text-body-sm text-text-muted">
                    +{remainingCount} more
                  </span>
                )}
              </div>
            </div>
          ) : null;
        })()}

        {/* SteamSpy Tags (vote-based) - shown if no PICS tags or as secondary */}
        {tags.length > 0 && steamTags.length === 0 && (
          <div>
            <h3 className="text-subheading text-text-primary mb-4">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {tags.slice(0, 15).map(({ tag, vote_count }) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 rounded-md bg-surface-elevated border border-border-subtle text-body-sm text-text-secondary"
                  title={`${vote_count.toLocaleString()} votes`}
                >
                  {tag}
                  <span className="ml-2 text-text-muted">{vote_count.toLocaleString()}</span>
                </span>
              ))}
              {tags.length > 15 && (
                <span className="px-3 py-1.5 text-body-sm text-text-muted">
                  +{tags.length - 15} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* App Details */}
        <Card padding="lg">
          <h3 className="text-subheading text-text-primary mb-4">App Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-text-tertiary mt-0.5" />
              <div>
                <p className="text-caption text-text-tertiary">Release Date</p>
                <p className="text-body text-text-primary">{app.release_date ? formatDate(app.release_date) : app.release_date_raw ?? '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-text-tertiary mt-0.5" />
              <div>
                <p className="text-caption text-text-tertiary">Page Created</p>
                <p className="text-body text-text-primary">{formatDate(app.page_creation_date)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Wrench className="h-4 w-4 text-text-tertiary mt-0.5" />
              <div>
                <p className="text-caption text-text-tertiary">Workshop</p>
                <p className={`text-body ${app.has_workshop ? 'text-accent-green' : 'text-text-muted'}`}>
                  {app.has_workshop ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              {app.has_developer_info ? (
                <CheckCircle2 className="h-4 w-4 text-accent-green mt-0.5" />
              ) : (
                <Clock className="h-4 w-4 text-accent-yellow mt-0.5" />
              )}
              <div>
                <p className="text-caption text-text-tertiary">Developer Info</p>
                <p className={`text-body ${app.has_developer_info ? 'text-accent-green' : 'text-accent-yellow'}`}>
                  {app.has_developer_info ? 'Complete' : 'Pending'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-text-tertiary mt-0.5" />
              <div>
                <p className="text-caption text-text-tertiary">First Seen</p>
                <p className="text-body text-text-primary">{formatDateTime(app.created_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-text-tertiary mt-0.5" />
              <div>
                <p className="text-caption text-text-tertiary">Last Updated</p>
                <p className="text-body text-text-primary">{formatDateTime(app.updated_at)}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

function PICSSection({
  id,
  app,
  steamDeck,
  categories,
  dlcs,
}: {
  id: string;
  app: AppDetails;
  steamDeck: SteamDeckInfo | null;
  categories: Category[];
  dlcs: DLCApp[];
}) {
  const hasPICSData = steamDeck || categories.length > 0 || app.controller_support || app.platforms || app.metacritic_score || app.parent_appid || app.languages || dlcs.length > 0 || app.pics_review_score;
  const contentDescriptors = parseContentDescriptors(app.content_descriptors);

  return (
    <section>
      <SectionHeader title="PICS Data" id={id} />
      {hasPICSData ? (
        <div className="space-y-6">
          {/* Steam Deck Compatibility */}
          {steamDeck && (
            <Card padding="lg">
              <h3 className="text-subheading text-text-primary mb-4">Steam Deck Compatibility</h3>
              <div className="flex items-center gap-4 mb-4">
                <span className={`px-3 py-1.5 rounded-md text-body font-medium ${
                  steamDeck.category === 'verified' ? 'bg-accent-green/15 text-accent-green' :
                  steamDeck.category === 'playable' ? 'bg-accent-yellow/15 text-accent-yellow' :
                  steamDeck.category === 'unsupported' ? 'bg-accent-red/15 text-accent-red' :
                  'bg-surface-elevated text-text-muted'
                }`}>
                  {steamDeck.category === 'verified' ? 'Verified' :
                   steamDeck.category === 'playable' ? 'Playable' :
                   steamDeck.category === 'unsupported' ? 'Unsupported' : 'Unknown'}
                </span>
              </div>
              {(steamDeck.tests_passed && steamDeck.tests_passed.length > 0) && (
                <div className="mb-3">
                  <p className="text-caption text-text-tertiary mb-2">Tests Passed</p>
                  <div className="flex flex-wrap gap-2">
                    {steamDeck.tests_passed.map((test) => (
                      <span key={test} className="px-2 py-1 rounded text-caption bg-accent-green/10 text-accent-green flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {test}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(steamDeck.tests_failed && steamDeck.tests_failed.length > 0) && (
                <div>
                  <p className="text-caption text-text-tertiary mb-2">Tests Failed</p>
                  <div className="flex flex-wrap gap-2">
                    {steamDeck.tests_failed.map((test) => (
                      <span key={test} className="px-2 py-1 rounded text-caption bg-accent-red/10 text-accent-red flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {test}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Categories (Features) */}
          {categories.length > 0 && (
            <Card padding="lg">
              <h3 className="text-subheading text-text-primary mb-4">Features</h3>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <span
                    key={category.id}
                    className="px-3 py-1.5 rounded-md bg-surface-elevated border border-border-subtle text-body-sm text-text-secondary"
                  >
                    {category.name}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* PICS Metadata */}
          <Card padding="lg">
            <h3 className="text-subheading text-text-primary mb-4">PICS Metadata</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {app.pics_review_score !== null && (
                <div>
                  <p className="text-caption text-text-tertiary">PICS Review Score</p>
                  <p className={`text-body font-medium ${
                    app.pics_review_score >= 7 ? 'text-accent-green' :
                    app.pics_review_score >= 5 ? 'text-accent-yellow' : 'text-accent-red'
                  }`}>
                    {app.pics_review_score} - {getPICSReviewScoreDescription(app.pics_review_score)}
                  </p>
                </div>
              )}
              {app.pics_review_percentage !== null && (
                <div>
                  <p className="text-caption text-text-tertiary">PICS Review %</p>
                  <p className="text-body text-text-primary">{app.pics_review_percentage}%</p>
                </div>
              )}
              {app.metacritic_score !== null && (
                <div>
                  <p className="text-caption text-text-tertiary">Metacritic</p>
                  {app.metacritic_url ? (
                    <a
                      href={app.metacritic_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-body font-medium hover:underline ${
                        app.metacritic_score >= 75 ? 'text-accent-green' :
                        app.metacritic_score >= 50 ? 'text-accent-yellow' : 'text-accent-red'
                      }`}
                    >
                      {app.metacritic_score}
                    </a>
                  ) : (
                    <p className={`text-body font-medium ${
                      app.metacritic_score >= 75 ? 'text-accent-green' :
                      app.metacritic_score >= 50 ? 'text-accent-yellow' : 'text-accent-red'
                    }`}>
                      {app.metacritic_score}
                    </p>
                  )}
                </div>
              )}
              {app.platforms && (
                <div>
                  <p className="text-caption text-text-tertiary">Platforms</p>
                  <p className="text-body text-text-primary capitalize">{app.platforms.replace(/,/g, ', ')}</p>
                </div>
              )}
              {app.controller_support && (
                <div>
                  <p className="text-caption text-text-tertiary">Controller Support</p>
                  <p className="text-body text-text-primary capitalize">{app.controller_support}</p>
                </div>
              )}
              {app.parent_appid !== null && (
                <div>
                  <p className="text-caption text-text-tertiary">Parent App</p>
                  <Link href={`/apps/${app.parent_appid}`} className="text-body text-accent-blue hover:underline">
                    {app.parent_appid}
                  </Link>
                </div>
              )}
              {app.release_state && (
                <div>
                  <p className="text-caption text-text-tertiary">Release State</p>
                  <p className="text-body text-text-primary capitalize">{app.release_state}</p>
                </div>
              )}
              {app.app_state && (
                <div>
                  <p className="text-caption text-text-tertiary">App State</p>
                  <p className="text-body text-text-primary">{app.app_state}</p>
                </div>
              )}
              {app.last_content_update && (
                <div>
                  <p className="text-caption text-text-tertiary">Last Content Update</p>
                  <p className="text-body text-text-primary">{formatDateTime(app.last_content_update)}</p>
                </div>
              )}
              {app.current_build_id && (
                <div>
                  <p className="text-caption text-text-tertiary">Build ID</p>
                  <p className="text-body text-text-primary font-mono text-body-sm">{app.current_build_id}</p>
                </div>
              )}
              {app.homepage_url && (
                <div>
                  <p className="text-caption text-text-tertiary">Homepage</p>
                  <a href={app.homepage_url} target="_blank" rel="noopener noreferrer" className="text-body text-accent-blue hover:underline truncate block">
                    {app.homepage_url.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              {app.is_free && (
                <div>
                  <p className="text-caption text-text-tertiary">Pricing</p>
                  <p className="text-body text-accent-green font-medium">Free to Play</p>
                </div>
              )}
            </div>
          </Card>

          {/* Content Descriptors (Mature Content) */}
          {contentDescriptors.length > 0 && (
            <Card padding="lg">
              <h3 className="text-subheading text-text-primary mb-4">Content Warnings</h3>
              <div className="flex flex-wrap gap-2">
                {contentDescriptors.map((descriptor) => (
                  <span
                    key={descriptor.id}
                    className={`px-3 py-1.5 rounded-md text-body-sm font-medium ${
                      descriptor.severity === 'high'
                        ? 'bg-accent-red/15 text-accent-red border border-accent-red/30'
                        : 'bg-accent-orange/15 text-accent-orange border border-accent-orange/30'
                    }`}
                  >
                    {descriptor.label}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* DLC List */}
          {dlcs.length > 0 && (
            <Card padding="lg">
              <h3 className="text-subheading text-text-primary mb-4">DLC ({dlcs.length})</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {dlcs.map((dlc) => (
                  <Link
                    key={dlc.appid}
                    href={`/apps/${dlc.appid}`}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-surface-elevated transition-colors"
                  >
                    <span className="text-body-sm text-text-primary">{dlc.name}</span>
                    <span className="text-caption text-text-muted font-mono">{dlc.appid}</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Languages */}
          {app.languages && Object.keys(app.languages).length > 0 && (
            <Card padding="lg">
              <h3 className="text-subheading text-text-primary mb-4">Supported Languages</h3>
              <div className="flex flex-wrap gap-2">
                {Object.keys(app.languages).map((lang) => (
                  <span
                    key={lang}
                    className="px-2 py-1 rounded text-caption bg-surface-elevated text-text-secondary"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-text-muted">No PICS data available for this app</p>
          <p className="text-caption text-text-tertiary mt-2">PICS data is synced from Steam&apos;s Product Info Cache Server</p>
        </Card>
      )}
    </section>
  );
}

function MetricsSection({
  id,
  metrics,
}: {
  id: string;
  metrics: DailyMetric[];
}) {
  const chartData = [...metrics].reverse().map((m) => ({
    date: new Date(m.metric_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    reviews: m.total_reviews ?? 0,
    ccu: m.ccu_peak ?? 0,
    positive: m.positive_reviews ?? 0,
    negative: m.negative_reviews ?? 0,
  }));

  return (
    <section>
      <SectionHeader title="Metrics" id={id} />
      {chartData.length > 0 ? (
        <div className="space-y-6">
          {/* Charts side by side on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card padding="lg">
              <h3 className="text-subheading text-text-primary mb-4">Total Reviews Over Time</h3>
              <AreaChartComponent
                data={chartData}
                xKey="date"
                yKey="reviews"
                height={200}
                color="blue"
                formatYAxis={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toString()}
              />
            </Card>
            <Card padding="lg">
              <h3 className="text-subheading text-text-primary mb-4">Peak CCU Over Time</h3>
              <AreaChartComponent
                data={chartData}
                xKey="date"
                yKey="ccu"
                height={200}
                color="cyan"
                formatYAxis={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toString()}
              />
            </Card>
          </div>

          {/* Metrics table */}
          <Card padding="none">
            <div className="px-4 py-3 border-b border-border-subtle">
              <h3 className="text-subheading text-text-primary">Daily Metrics History</h3>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[700px]">
                <thead className="bg-surface-elevated">
                  <tr>
                    <th className="px-4 py-3 text-left text-caption font-medium text-text-secondary">Date</th>
                    <th className="px-4 py-3 text-left text-caption font-medium text-text-secondary">Score</th>
                    <th className="px-4 py-3 text-right text-caption font-medium text-text-secondary">Total</th>
                    <th className="px-4 py-3 text-right text-caption font-medium text-text-secondary">Positive</th>
                    <th className="px-4 py-3 text-right text-caption font-medium text-text-secondary">Negative</th>
                    <th className="px-4 py-3 text-right text-caption font-medium text-text-secondary">Peak CCU</th>
                    <th className="px-4 py-3 text-right text-caption font-medium text-text-secondary">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {metrics.slice(0, 10).map((m) => (
                    <tr key={m.metric_date} className="bg-surface-raised hover:bg-surface-elevated transition-colors">
                      <td className="px-4 py-3 text-body-sm text-text-primary">{formatDate(m.metric_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-body-sm ${
                          m.review_score_desc?.includes('Positive') ? 'text-accent-green' :
                          m.review_score_desc?.includes('Negative') ? 'text-accent-red' :
                          m.review_score_desc === 'Mixed' ? 'text-accent-yellow' : 'text-text-muted'
                        }`}>
                          {m.review_score_desc ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-body-sm text-text-secondary">{formatNumber(m.total_reviews)}</td>
                      <td className="px-4 py-3 text-right text-body-sm text-accent-green">{formatNumber(m.positive_reviews)}</td>
                      <td className="px-4 py-3 text-right text-body-sm text-accent-red">{formatNumber(m.negative_reviews)}</td>
                      <td className="px-4 py-3 text-right text-body-sm text-text-secondary">{formatNumber(m.ccu_peak)}</td>
                      <td className="px-4 py-3 text-right text-body-sm text-text-secondary">
                        {m.price_cents !== null ? `$${(m.price_cents / 100).toFixed(2)}` : '—'}
                        {m.discount_percent && m.discount_percent > 0 && (
                          <span className="ml-1 text-accent-green text-caption">-{m.discount_percent}%</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-text-muted">No metrics data available</p>
        </Card>
      )}
    </section>
  );
}

function ReviewsSection({
  id,
  histogram,
}: {
  id: string;
  histogram: ReviewHistogram[];
}) {
  const histogramData = [...histogram].reverse().slice(-12).map((h) => ({
    month: new Date(h.month_start).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    positive: h.recommendations_up,
    negative: h.recommendations_down,
  }));

  return (
    <section>
      <SectionHeader title="Reviews" id={id} />
      {histogram.length > 0 ? (
        <div className="space-y-6">
          <Card padding="lg">
            <h3 className="text-subheading text-text-primary mb-4">Monthly Review Distribution</h3>
            <StackedBarChart
              data={histogramData}
              xKey="month"
              positiveKey="positive"
              negativeKey="negative"
              height={250}
            />
          </Card>

          <Card padding="none">
            <div className="px-4 py-3 border-b border-border-subtle">
              <h3 className="text-subheading text-text-primary">Monthly Breakdown</h3>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[600px]">
                <thead className="bg-surface-elevated">
                  <tr>
                    <th className="px-4 py-3 text-left text-caption font-medium text-text-secondary">Month</th>
                    <th className="px-4 py-3 text-right text-caption font-medium text-text-secondary">Positive</th>
                    <th className="px-4 py-3 text-right text-caption font-medium text-text-secondary">Negative</th>
                    <th className="px-4 py-3 text-right text-caption font-medium text-text-secondary">Total</th>
                    <th className="px-4 py-3 text-right text-caption font-medium text-text-secondary">Ratio</th>
                    <th className="px-4 py-3 w-32 text-caption font-medium text-text-secondary">Distribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {histogram.slice(0, 6).map((h) => {
                    const total = h.recommendations_up + h.recommendations_down;
                    const ratio = total > 0 ? (h.recommendations_up / total * 100) : 0;
                    return (
                      <tr key={h.month_start} className="bg-surface-raised hover:bg-surface-elevated transition-colors">
                        <td className="px-4 py-3 text-body-sm text-text-primary">
                          {new Date(h.month_start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-right text-body-sm text-accent-green">{h.recommendations_up.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-body-sm text-accent-red">{h.recommendations_down.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-body-sm text-text-secondary">{total.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-body-sm text-text-secondary">{ratio.toFixed(0)}%</td>
                        <td className="px-4 py-3">
                          <RatioBar positive={h.recommendations_up} negative={h.recommendations_down} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-text-muted">No review histogram data available</p>
        </Card>
      )}
    </section>
  );
}

function SyncSection({
  id,
  syncStatus,
}: {
  id: string;
  syncStatus: SyncStatus | null;
}) {
  if (!syncStatus) {
    return (
      <section>
        <SectionHeader title="Sync Status" id={id} />
        <Card className="p-12 text-center">
          <p className="text-text-muted">No sync status available</p>
        </Card>
      </section>
    );
  }

  const syncItems = [
    { label: 'Storefront', date: syncStatus.last_storefront_sync },
    { label: 'Reviews', date: syncStatus.last_reviews_sync },
    { label: 'SteamSpy', date: syncStatus.last_steamspy_sync },
    { label: 'Histogram', date: syncStatus.last_histogram_sync },
    { label: 'Page Scrape', date: syncStatus.last_page_creation_scrape },
    { label: 'Last Activity', date: syncStatus.last_activity_at },
  ];

  return (
    <section>
      <SectionHeader title="Sync Status" id={id} />
      <div className="space-y-6">
        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-3">
          {syncStatus.refresh_tier && (
            <TierBadge tier={syncStatus.refresh_tier as 'active' | 'moderate' | 'dormant' | 'dead'} />
          )}
          {syncStatus.is_syncable ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent-green/10 text-accent-green text-body-sm font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Syncable
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent-red/10 text-accent-red text-body-sm font-medium">
              <XCircle className="h-3.5 w-3.5" />
              Sync Disabled
            </span>
          )}
          {syncStatus.priority_score !== null && (
            <span className="text-body-sm text-text-tertiary">
              Priority: <span className="text-text-secondary font-medium">{syncStatus.priority_score}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sync times */}
          <Card padding="lg">
            <h3 className="text-subheading text-text-primary mb-4">Sync History</h3>
            <div className="space-y-1">
              {syncItems.map((item) => (
                <div key={item.label} className="flex justify-between py-2 border-b border-border-subtle last:border-0">
                  <span className="text-body-sm text-text-secondary">{item.label}</span>
                  <span className="text-body-sm text-text-primary">{timeAgo(item.date)}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Errors */}
          {syncStatus.consecutive_errors !== null && syncStatus.consecutive_errors > 0 && (
            <Card className="p-6 border-accent-red/20 bg-accent-red/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-accent-red mt-0.5" />
                <div>
                  <p className="text-body font-medium text-accent-red">
                    {syncStatus.consecutive_errors} consecutive error{syncStatus.consecutive_errors > 1 ? 's' : ''}
                  </p>
                  {syncStatus.last_error_message && (
                    <p className="text-body-sm text-accent-red/80 mt-1">{syncStatus.last_error_message}</p>
                  )}
                  {syncStatus.last_error_at && (
                    <p className="text-caption text-accent-red/60 mt-2">
                      Last error: {formatDateTime(syncStatus.last_error_at)}
                      {syncStatus.last_error_source && ` (${syncStatus.last_error_source})`}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
