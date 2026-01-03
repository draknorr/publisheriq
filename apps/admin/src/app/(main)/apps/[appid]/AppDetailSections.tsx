'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendBadge, TierBadge, StackedBarChart, AreaChartComponent, RatioBar } from '@/components/data-display';
import { SimilaritySection } from '@/components/similarity';
import { CheckCircle2, XCircle, AlertTriangle, ChevronRight } from 'lucide-react';

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
  { id: 'similar', label: 'Similar' },
  { id: 'pics', label: 'PICS Data' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'sync', label: 'Sync Status' },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
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

/**
 * Month names for consistent formatting between server and client.
 * Using manual lookup avoids toLocaleDateString hydration mismatches.
 */
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Safely parse a month_start string (YYYY-MM or YYYY-MM-DD format)
 * and return a formatted month label like "December 2025".
 */
function formatMonthLabel(monthStart: string): string {
  if (!monthStart) return '—';

  // Validate YYYY-MM or YYYY-MM-DD format
  const isoPattern = /^(\d{4})-(\d{2})(?:-\d{2})?$/;
  const match = monthStart.match(isoPattern);

  if (!match) {
    // Bad data - hide it
    return '—';
  }

  const year = match[1]; // Keep as string "2025"
  const monthIndex = parseInt(match[2], 10) - 1; // 0-indexed

  if (monthIndex < 0 || monthIndex > 11) return '—';

  return `${MONTH_NAMES[monthIndex]} ${year}`; // "December 2025"
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
      <div className="space-y-8">
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
        {/* Similar Games Section */}
        {app.type === 'game' && !app.is_delisted && (
          <section id="similar">
            <SectionHeader title="Similar Games" id="similar-header" />
            <SimilaritySection
              entityId={app.appid}
              entityName={app.name}
              entityType="game"
              limit={8}
              showFilters={true}
            />
          </section>
        )}
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
      <div className="space-y-4">
        {/* Trends - compact inline row */}
        {trends && (
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-md border border-border-subtle bg-surface-raised">
            <TrendBadge
              direction={(trends.trend_30d_direction as 'up' | 'down' | 'stable') ?? 'stable'}
              value={trends.trend_30d_change_pct ?? undefined}
              label="30d"
            />
            <TrendBadge
              direction={(trends.trend_90d_direction as 'up' | 'down' | 'stable') ?? 'stable'}
              value={trends.trend_90d_change_pct ?? undefined}
              label="90d"
            />
            <span className="text-border-subtle">|</span>
            <span className="text-caption text-text-tertiary">Reviews/day:</span>
            <span className="text-body-sm font-medium text-text-primary">{trends.review_velocity_7d?.toFixed(1) ?? '—'} <span className="text-text-muted">(7d)</span></span>
            <span className="text-body-sm font-medium text-text-primary">{trends.review_velocity_30d?.toFixed(1) ?? '—'} <span className="text-text-muted">(30d)</span></span>
          </div>
        )}

        {/* Developer / Publisher - inline row */}
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex items-center gap-2">
            <span className="text-caption text-text-tertiary">Dev:</span>
            {developers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {developers.map((dev) => (
                  <Link
                    key={dev.id}
                    href={`/developers/${dev.id}`}
                    className="px-2 py-0.5 rounded text-body-sm text-accent-blue bg-accent-blue/10 hover:bg-accent-blue/20 transition-colors"
                  >
                    {dev.name}
                  </Link>
                ))}
              </div>
            ) : (
              <span className="text-text-muted text-body-sm">—</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-caption text-text-tertiary">Pub:</span>
            {publishers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {publishers.map((pub) => (
                  <Link
                    key={pub.id}
                    href={`/publishers/${pub.id}`}
                    className="px-2 py-0.5 rounded text-body-sm text-accent-cyan bg-accent-cyan/10 hover:bg-accent-cyan/20 transition-colors"
                  >
                    {pub.name}
                  </Link>
                ))}
              </div>
            ) : (
              <span className="text-text-muted text-body-sm">—</span>
            )}
          </div>
        </div>

        {/* Genres & Franchises - inline tags */}
        {(genres.length > 0 || franchises.length > 0) && (
          <div className="flex flex-wrap items-center gap-3">
            {genres.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-caption text-text-tertiary">Genres:</span>
                {genres.map((genre) => (
                  <span
                    key={genre.id}
                    className={`px-2 py-0.5 rounded text-body-sm ${
                      genre.is_primary
                        ? 'bg-accent-purple/20 text-accent-purple font-medium'
                        : 'bg-accent-purple/10 text-accent-purple'
                    }`}
                  >
                    {genre.is_primary && '★ '}{genre.name}
                  </span>
                ))}
              </div>
            )}
            {franchises.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-caption text-text-tertiary">Franchise:</span>
                {franchises.map((franchise) => (
                  <span
                    key={franchise.id}
                    className="px-2 py-0.5 rounded text-body-sm bg-accent-cyan/10 text-accent-cyan"
                  >
                    {franchise.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PICS Steam Tags (ranked) - compact */}
        {steamTags.length > 0 && (() => {
          const namedTags = steamTags.filter(t => !t.name.startsWith('Tag '));
          const unnamedCount = steamTags.length - namedTags.length;
          const displayTags = namedTags.slice(0, 12);
          const remainingCount = (namedTags.length > 12 ? namedTags.length - 12 : 0) + unnamedCount;

          return namedTags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-caption text-text-tertiary mr-1">Tags:</span>
              {displayTags.map((tag) => (
                <a
                  key={tag.id}
                  href={`https://store.steampowered.com/search/?tags=${tag.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-0.5 rounded text-caption bg-surface-elevated border border-border-subtle text-text-secondary hover:text-accent-blue hover:border-accent-blue/30 transition-colors"
                  title={`Rank #${tag.rank}`}
                >
                  {tag.name}
                </a>
              ))}
              {remainingCount > 0 && (
                <span className="text-caption text-text-muted">+{remainingCount}</span>
              )}
            </div>
          ) : null;
        })()}

        {/* SteamSpy Tags - shown if no PICS tags */}
        {tags.length > 0 && steamTags.length === 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-caption text-text-tertiary mr-1">Tags:</span>
            {tags.slice(0, 12).map(({ tag }) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded text-caption bg-surface-elevated border border-border-subtle text-text-secondary"
              >
                {tag}
              </span>
            ))}
            {tags.length > 12 && (
              <span className="text-caption text-text-muted">+{tags.length - 12}</span>
            )}
          </div>
        )}

        {/* App Details - compact 6-col grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-3 rounded-md border border-border-subtle bg-surface-raised">
          <div>
            <p className="text-caption text-text-tertiary">Release</p>
            <p className="text-body-sm text-text-primary">{app.release_date ? formatDate(app.release_date) : app.release_date_raw ?? '—'}</p>
          </div>
          <div>
            <p className="text-caption text-text-tertiary">Page Created</p>
            <p className="text-body-sm text-text-primary">{formatDate(app.page_creation_date)}</p>
          </div>
          <div>
            <p className="text-caption text-text-tertiary">Workshop</p>
            <p className={`text-body-sm ${app.has_workshop ? 'text-accent-green' : 'text-text-muted'}`}>
              {app.has_workshop ? 'Yes' : 'No'}
            </p>
          </div>
          <div>
            <p className="text-caption text-text-tertiary">Dev Info</p>
            <p className={`text-body-sm ${app.has_developer_info ? 'text-accent-green' : 'text-accent-yellow'}`}>
              {app.has_developer_info ? 'Complete' : 'Pending'}
            </p>
          </div>
          <div>
            <p className="text-caption text-text-tertiary">First Seen</p>
            <p className="text-body-sm text-text-primary">{formatDate(app.created_at)}</p>
          </div>
          <div>
            <p className="text-caption text-text-tertiary">Updated</p>
            <p className="text-body-sm text-text-primary">{formatDate(app.updated_at)}</p>
          </div>
        </div>
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
  const [showAllDLCs, setShowAllDLCs] = useState(false);

  return (
    <section>
      <SectionHeader title="PICS Data" id={id} />
      {hasPICSData ? (
        <div className="space-y-4">
          {/* Steam Deck + Features row */}
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-md border border-border-subtle bg-surface-raised">
            {steamDeck && (
              <>
                <span className="text-caption text-text-tertiary">Deck:</span>
                <span className={`px-2 py-0.5 rounded text-body-sm font-medium ${
                  steamDeck.category === 'verified' ? 'bg-accent-green/15 text-accent-green' :
                  steamDeck.category === 'playable' ? 'bg-accent-yellow/15 text-accent-yellow' :
                  steamDeck.category === 'unsupported' ? 'bg-accent-red/15 text-accent-red' :
                  'bg-surface-elevated text-text-muted'
                }`}>
                  {steamDeck.category === 'verified' ? 'Verified' :
                   steamDeck.category === 'playable' ? 'Playable' :
                   steamDeck.category === 'unsupported' ? 'Unsupported' : 'Unknown'}
                </span>
                {(steamDeck.tests_passed || steamDeck.tests_failed) && (
                  <span className="text-caption text-text-muted">
                    ({steamDeck.tests_passed?.length ?? 0} passed, {steamDeck.tests_failed?.length ?? 0} failed)
                  </span>
                )}
              </>
            )}
            {categories.length > 0 && (
              <>
                {steamDeck && <span className="text-border-subtle">|</span>}
                <span className="text-caption text-text-tertiary">Features:</span>
                {categories.slice(0, 6).map((category) => (
                  <span key={category.id} className="px-2 py-0.5 rounded text-caption bg-surface-elevated border border-border-subtle text-text-secondary">
                    {category.name}
                  </span>
                ))}
                {categories.length > 6 && <span className="text-caption text-text-muted">+{categories.length - 6}</span>}
              </>
            )}
          </div>

          {/* PICS Metadata - 6 col dense grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-3 rounded-md border border-border-subtle bg-surface-raised">
            {app.pics_review_score !== null && (
              <div>
                <p className="text-caption text-text-tertiary">Review Score</p>
                <p className={`text-body-sm font-medium ${
                  app.pics_review_score >= 7 ? 'text-accent-green' :
                  app.pics_review_score >= 5 ? 'text-accent-yellow' : 'text-accent-red'
                }`}>
                  {app.pics_review_score} ({getPICSReviewScoreDescription(app.pics_review_score).split(' ').slice(-1)[0]})
                </p>
              </div>
            )}
            {app.pics_review_percentage !== null && (
              <div>
                <p className="text-caption text-text-tertiary">Review %</p>
                <p className="text-body-sm text-text-primary">{app.pics_review_percentage}%</p>
              </div>
            )}
            {app.metacritic_score !== null && (
              <div>
                <p className="text-caption text-text-tertiary">Metacritic</p>
                <p className={`text-body-sm font-medium ${
                  app.metacritic_score >= 75 ? 'text-accent-green' :
                  app.metacritic_score >= 50 ? 'text-accent-yellow' : 'text-accent-red'
                }`}>{app.metacritic_score}</p>
              </div>
            )}
            {app.platforms && (
              <div>
                <p className="text-caption text-text-tertiary">Platforms</p>
                <p className="text-body-sm text-text-primary capitalize">{app.platforms.replace(/,/g, ', ')}</p>
              </div>
            )}
            {app.controller_support && (
              <div>
                <p className="text-caption text-text-tertiary">Controller</p>
                <p className="text-body-sm text-text-primary capitalize">{app.controller_support}</p>
              </div>
            )}
            {app.parent_appid !== null && (
              <div>
                <p className="text-caption text-text-tertiary">Parent</p>
                <Link href={`/apps/${app.parent_appid}`} className="text-body-sm text-accent-blue hover:underline">
                  {app.parent_appid}
                </Link>
              </div>
            )}
            {app.release_state && (
              <div>
                <p className="text-caption text-text-tertiary">Release State</p>
                <p className="text-body-sm text-text-primary capitalize">{app.release_state}</p>
              </div>
            )}
            {app.app_state && (
              <div>
                <p className="text-caption text-text-tertiary">App State</p>
                <p className="text-body-sm text-text-primary">{app.app_state}</p>
              </div>
            )}
            {app.last_content_update && (
              <div>
                <p className="text-caption text-text-tertiary">Content Update</p>
                <p className="text-body-sm text-text-primary">{formatDate(app.last_content_update)}</p>
              </div>
            )}
            {app.current_build_id && (
              <div>
                <p className="text-caption text-text-tertiary">Build ID</p>
                <p className="text-body-sm text-text-primary font-mono">{app.current_build_id}</p>
              </div>
            )}
            {app.homepage_url && (
              <div className="col-span-2">
                <p className="text-caption text-text-tertiary">Homepage</p>
                <a href={app.homepage_url} target="_blank" rel="noopener noreferrer" className="text-body-sm text-accent-blue hover:underline truncate block">
                  {app.homepage_url.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
          </div>

          {/* Content Descriptors (inline) */}
          {contentDescriptors.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-caption text-text-tertiary">Warnings:</span>
              {contentDescriptors.map((descriptor) => (
                <span
                  key={descriptor.id}
                  className={`px-2 py-0.5 rounded text-caption font-medium ${
                    descriptor.severity === 'high'
                      ? 'bg-accent-red/15 text-accent-red'
                      : 'bg-accent-orange/15 text-accent-orange'
                  }`}
                >
                  {descriptor.label}
                </span>
              ))}
            </div>
          )}

          {/* DLC List - compact collapsible */}
          {dlcs.length > 0 && (
            <div className="p-3 rounded-md border border-border-subtle bg-surface-raised">
              <div className="flex items-center justify-between mb-2">
                <span className="text-body-sm font-medium text-text-primary">DLC ({dlcs.length})</span>
                {dlcs.length > 5 && (
                  <button onClick={() => setShowAllDLCs(!showAllDLCs)} className="text-caption text-accent-blue hover:underline">
                    {showAllDLCs ? 'Show less' : `Show all`}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(showAllDLCs ? dlcs : dlcs.slice(0, 5)).map((dlc) => (
                  <Link
                    key={dlc.appid}
                    href={`/apps/${dlc.appid}`}
                    className="px-2 py-0.5 rounded text-caption bg-surface-elevated border border-border-subtle text-text-secondary hover:text-accent-blue hover:border-accent-blue/30 transition-colors truncate max-w-48"
                    title={dlc.name}
                  >
                    {dlc.name}
                  </Link>
                ))}
                {!showAllDLCs && dlcs.length > 5 && (
                  <span className="text-caption text-text-muted">+{dlcs.length - 5} more</span>
                )}
              </div>
            </div>
          )}

          {/* Languages - inline */}
          {app.languages && Object.keys(app.languages).length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-caption text-text-tertiary mr-1">Languages:</span>
              {Object.keys(app.languages).slice(0, 10).map((lang) => (
                <span key={lang} className="px-2 py-0.5 rounded text-caption bg-surface-elevated text-text-secondary">
                  {lang}
                </span>
              ))}
              {Object.keys(app.languages).length > 10 && (
                <span className="text-caption text-text-muted">+{Object.keys(app.languages).length - 10}</span>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-body-sm text-text-muted p-3 rounded-md border border-border-subtle bg-surface-raised">
          No PICS data available
        </p>
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
        <div className="space-y-4">
          {/* Charts - compact */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="p-3 rounded-md border border-border-subtle bg-surface-raised">
              <h3 className="text-body-sm font-medium text-text-primary mb-2">Reviews</h3>
              <AreaChartComponent
                data={chartData}
                xKey="date"
                yKey="reviews"
                height={140}
                color="blue"
                formatYAxis={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toString()}
              />
            </div>
            <div className="p-3 rounded-md border border-border-subtle bg-surface-raised">
              <h3 className="text-body-sm font-medium text-text-primary mb-2">Peak CCU</h3>
              <AreaChartComponent
                data={chartData}
                xKey="date"
                yKey="ccu"
                height={140}
                color="cyan"
                formatYAxis={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toString()}
              />
            </div>
          </div>

          {/* Metrics table - compact, 5 days */}
          <div className="rounded-md border border-border-subtle overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-elevated">
                <tr>
                  <th className="px-3 py-2 text-left text-caption font-medium text-text-tertiary">Date</th>
                  <th className="px-3 py-2 text-left text-caption font-medium text-text-tertiary">Score</th>
                  <th className="px-3 py-2 text-right text-caption font-medium text-text-tertiary">Total</th>
                  <th className="px-3 py-2 text-right text-caption font-medium text-text-tertiary">+/-</th>
                  <th className="px-3 py-2 text-right text-caption font-medium text-text-tertiary">CCU</th>
                  <th className="px-3 py-2 text-right text-caption font-medium text-text-tertiary">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {metrics.slice(0, 5).map((m) => (
                  <tr key={m.metric_date} className="bg-surface-raised">
                    <td className="px-3 py-2 text-caption text-text-primary">{formatDate(m.metric_date)}</td>
                    <td className="px-3 py-2">
                      <span className={`text-caption ${
                        m.review_score_desc?.includes('Positive') ? 'text-accent-green' :
                        m.review_score_desc?.includes('Negative') ? 'text-accent-red' :
                        m.review_score_desc === 'Mixed' ? 'text-accent-yellow' : 'text-text-muted'
                      }`}>
                        {m.review_score_desc ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-caption text-text-secondary">{formatNumber(m.total_reviews)}</td>
                    <td className="px-3 py-2 text-right text-caption">
                      <span className="text-accent-green">{formatNumber(m.positive_reviews)}</span>
                      <span className="text-text-muted">/</span>
                      <span className="text-accent-red">{formatNumber(m.negative_reviews)}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-caption text-text-secondary">{formatNumber(m.ccu_peak)}</td>
                    <td className="px-3 py-2 text-right text-caption text-text-secondary">
                      {m.price_cents !== null ? `$${(m.price_cents / 100).toFixed(2)}` : '—'}
                      {m.discount_percent && m.discount_percent > 0 && (
                        <span className="ml-1 text-accent-green">-{m.discount_percent}%</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-body-sm text-text-muted p-3 rounded-md border border-border-subtle bg-surface-raised">
          No metrics data available
        </p>
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
    month: formatMonthLabel(h.month_start),
    positive: h.recommendations_up,
    negative: h.recommendations_down,
  }));

  return (
    <section>
      <SectionHeader title="Reviews" id={id} />
      {histogram.length > 0 ? (
        <div className="space-y-4">
          {/* Chart - compact */}
          <div className="p-3 rounded-md border border-border-subtle bg-surface-raised">
            <h3 className="text-body-sm font-medium text-text-primary mb-2">Monthly Distribution</h3>
            <StackedBarChart
              data={histogramData}
              xKey="month"
              positiveKey="positive"
              negativeKey="negative"
              height={180}
            />
          </div>

          {/* Table - compact, 4 months */}
          <div className="rounded-md border border-border-subtle overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-elevated">
                <tr>
                  <th className="px-3 py-2 text-left text-caption font-medium text-text-tertiary">Month</th>
                  <th className="px-3 py-2 text-right text-caption font-medium text-text-tertiary">+/-</th>
                  <th className="px-3 py-2 text-right text-caption font-medium text-text-tertiary">Total</th>
                  <th className="px-3 py-2 text-right text-caption font-medium text-text-tertiary">%</th>
                  <th className="px-3 py-2 w-24 text-caption font-medium text-text-tertiary">Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {histogram.slice(0, 4).map((h) => {
                  const total = h.recommendations_up + h.recommendations_down;
                  const ratio = total > 0 ? (h.recommendations_up / total * 100) : 0;
                  return (
                    <tr key={h.month_start} className="bg-surface-raised">
                      <td className="px-3 py-2 text-caption text-text-primary">
                        {formatMonthLabel(h.month_start)}
                      </td>
                      <td className="px-3 py-2 text-right text-caption">
                        <span className="text-accent-green">{h.recommendations_up.toLocaleString()}</span>
                        <span className="text-text-muted">/</span>
                        <span className="text-accent-red">{h.recommendations_down.toLocaleString()}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-caption text-text-secondary">{total.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-caption text-text-secondary">{ratio.toFixed(0)}%</td>
                      <td className="px-3 py-2">
                        <RatioBar positive={h.recommendations_up} negative={h.recommendations_down} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-body-sm text-text-muted p-3 rounded-md border border-border-subtle bg-surface-raised">
          No review histogram data available
        </p>
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
        <p className="text-body-sm text-text-muted p-3 rounded-md border border-border-subtle bg-surface-raised">
          No sync status available
        </p>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader title="Sync Status" id={id} />
      <div className="space-y-4">
        {/* Status + Sync times in single row */}
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-md border border-border-subtle bg-surface-raised">
          {syncStatus.refresh_tier && (
            <TierBadge tier={syncStatus.refresh_tier as 'active' | 'moderate' | 'dormant' | 'dead'} />
          )}
          {syncStatus.is_syncable ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent-green/10 text-accent-green text-caption font-medium">
              <CheckCircle2 className="h-3 w-3" />
              Syncable
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent-red/10 text-accent-red text-caption font-medium">
              <XCircle className="h-3 w-3" />
              Disabled
            </span>
          )}
          {syncStatus.priority_score !== null && (
            <span className="text-caption text-text-tertiary">
              Priority: <span className="text-text-secondary font-medium">{syncStatus.priority_score}</span>
            </span>
          )}
          <span className="text-border-subtle">|</span>
          <span className="text-caption text-text-tertiary">Store:</span>
          <span className="text-caption text-text-primary">{timeAgo(syncStatus.last_storefront_sync)}</span>
          <span className="text-caption text-text-tertiary">Reviews:</span>
          <span className="text-caption text-text-primary">{timeAgo(syncStatus.last_reviews_sync)}</span>
          <span className="text-caption text-text-tertiary">SteamSpy:</span>
          <span className="text-caption text-text-primary">{timeAgo(syncStatus.last_steamspy_sync)}</span>
          <span className="text-caption text-text-tertiary">Histogram:</span>
          <span className="text-caption text-text-primary">{timeAgo(syncStatus.last_histogram_sync)}</span>
        </div>

        {/* Errors - only show if there are errors */}
        {syncStatus.consecutive_errors !== null && syncStatus.consecutive_errors > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-md border border-accent-red/20 bg-accent-red/5">
            <AlertTriangle className="h-4 w-4 text-accent-red mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-body-sm font-medium text-accent-red">
                {syncStatus.consecutive_errors} error{syncStatus.consecutive_errors > 1 ? 's' : ''}
              </span>
              {syncStatus.last_error_message && (
                <span className="text-body-sm text-accent-red/80 ml-2">{syncStatus.last_error_message}</span>
              )}
              {syncStatus.last_error_at && (
                <span className="text-caption text-accent-red/60 ml-2">
                  ({timeAgo(syncStatus.last_error_at)}{syncStatus.last_error_source && `, ${syncStatus.last_error_source}`})
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
