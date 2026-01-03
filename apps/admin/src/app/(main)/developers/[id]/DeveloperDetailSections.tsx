'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { TypeBadge, ReviewScoreBadge, TrendIndicator, StackedBarChart, RatioBar, ReviewBreakdownPopover, MonthlyReviewBreakdownPopover } from '@/components/data-display';
import { ChevronRight, Users, Building2, Monitor, Gamepad2 } from 'lucide-react';
import type { PortfolioPICSData } from '@/lib/portfolio-pics';

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
  games?: ReviewHistogramGame[];
}

interface DeveloperDetailSectionsProps {
  developer: Developer;
  apps: DeveloperApp[];
  relatedPublishers: RelatedPublisher[];
  tags: { tag: string; vote_count: number }[];
  histogram: ReviewHistogram[];
  similarDevelopers: SimilarDeveloper[];
  picsData: PortfolioPICSData | null;
}

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'pics', label: 'Portfolio PICS' },
  { id: 'games', label: 'Games' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'network', label: 'Network' },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

function formatNumber(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString();
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

export function DeveloperDetailSections({
  developer,
  apps,
  relatedPublishers,
  tags,
  histogram,
  similarDevelopers,
  picsData,
}: DeveloperDetailSectionsProps) {
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
        <OverviewSection id="overview" developer={developer} tags={tags} />
        <PortfolioPICSSection id="pics" picsData={picsData} totalGames={apps.length} />
        <GamesSection id="games" apps={apps} />
        <ReviewsSection id="reviews" histogram={histogram} apps={apps} />
        <NetworkSection
          id="network"
          relatedPublishers={relatedPublishers}
          similarDevelopers={similarDevelopers}
        />
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
  developer,
  tags,
}: {
  id: string;
  developer: Developer;
  tags: { tag: string; vote_count: number }[];
}) {
  return (
    <section>
      <SectionHeader title="Overview" id={id} />
      <div className="space-y-4">
        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-caption text-text-tertiary mr-1">Top Tags:</span>
            {tags.slice(0, 15).map(({ tag, vote_count }) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded bg-surface-elevated border border-border-subtle text-caption text-text-secondary"
                title={`${vote_count.toLocaleString()} votes`}
              >
                {tag}
                <span className="ml-1.5 text-text-muted">{vote_count.toLocaleString()}</span>
              </span>
            ))}
            {tags.length > 15 && (
              <span className="text-caption text-text-muted">
                +{tags.length - 15} more
              </span>
            )}
          </div>
        )}

        {/* Developer Details - inline grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-3 rounded-md border border-border-subtle bg-surface-raised">
          <div>
            <p className="text-caption text-text-tertiary">First Release</p>
            <p className="text-body-sm text-text-primary">{formatDate(developer.first_game_release_date)}</p>
          </div>
          <div>
            <p className="text-caption text-text-tertiary">Page Created</p>
            <p className="text-body-sm text-text-primary">{formatDate(developer.first_page_creation_date)}</p>
          </div>
          <div>
            <p className="text-caption text-text-tertiary">Total Games</p>
            <p className="text-body-sm text-text-primary">{developer.game_count}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PortfolioPICSSection({
  id,
  picsData,
  totalGames,
}: {
  id: string;
  picsData: PortfolioPICSData | null;
  totalGames: number;
}) {
  if (!picsData) {
    return (
      <section>
        <SectionHeader title="Portfolio PICS" id={id} />
        <Card className="p-12 text-center">
          <p className="text-text-muted">No PICS data available for this portfolio</p>
          <p className="text-caption text-text-tertiary mt-2">PICS data is synced from Steam&apos;s Product Info Cache Server</p>
        </Card>
      </section>
    );
  }

  const { genres, categories, platformStats, franchises, languages, contentDescriptors } = picsData;

  return (
    <section>
      <SectionHeader title="Portfolio PICS" id={id} />
      <div className="space-y-4">
        {/* Platform / Steam Deck / Controller Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Platform Coverage */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-2">
              <Monitor className="h-4 w-4 text-text-tertiary" />
              <h3 className="text-body-sm font-medium text-text-primary">Platform Coverage</h3>
            </div>
            <div className="space-y-2">
              <PlatformBar label="Windows" count={platformStats.platforms.windows} total={totalGames} />
              <PlatformBar label="macOS" count={platformStats.platforms.macos} total={totalGames} />
              <PlatformBar label="Linux" count={platformStats.platforms.linux} total={totalGames} />
            </div>
          </Card>

          {/* Steam Deck */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-2">
              <Gamepad2 className="h-4 w-4 text-text-tertiary" />
              <h3 className="text-body-sm font-medium text-text-primary">Steam Deck</h3>
            </div>
            <div className="space-y-1.5">
              <DistributionRow label="Verified" count={platformStats.steamDeck.verified} total={totalGames} color="green" />
              <DistributionRow label="Playable" count={platformStats.steamDeck.playable} total={totalGames} color="yellow" />
              <DistributionRow label="Unsupported" count={platformStats.steamDeck.unsupported} total={totalGames} color="red" />
              <DistributionRow label="Unknown" count={platformStats.steamDeck.unknown} total={totalGames} color="gray" />
            </div>
          </Card>

          {/* Controller Support */}
          <Card padding="md">
            <div className="flex items-center gap-2 mb-2">
              <Gamepad2 className="h-4 w-4 text-text-tertiary" />
              <h3 className="text-body-sm font-medium text-text-primary">Controller Support</h3>
            </div>
            <div className="space-y-1.5">
              <DistributionRow label="Full" count={platformStats.controllerSupport.full} total={totalGames} color="green" />
              <DistributionRow label="Partial" count={platformStats.controllerSupport.partial} total={totalGames} color="yellow" />
              <DistributionRow label="None" count={platformStats.controllerSupport.none} total={totalGames} color="gray" />
            </div>
          </Card>
        </div>

        {/* Genre Distribution */}
        {genres.length > 0 && (
          <div className="p-3 rounded-md border border-border-subtle bg-surface-raised">
            <h3 className="text-body-sm font-medium text-text-primary mb-2">Genre Distribution</h3>
            <div className="space-y-1.5">
              {genres.slice(0, 10).map((genre) => (
                <div key={genre.genre_id} className="flex items-center gap-3">
                  <div className="w-28 text-caption text-text-secondary truncate">{genre.name}</div>
                  <div className="flex-1 h-3 bg-surface-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-purple/60 rounded-full"
                      style={{ width: `${(genre.game_count / totalGames) * 100}%` }}
                    />
                  </div>
                  <div className="w-20 text-caption text-text-tertiary text-right">
                    {genre.game_count} {genre.is_primary_count > 0 && (
                      <span className="text-accent-purple">({genre.is_primary_count}★)</span>
                    )}
                  </div>
                </div>
              ))}
              {genres.length > 10 && (
                <p className="text-caption text-text-muted">+{genres.length - 10} more</p>
              )}
            </div>
          </div>
        )}

        {/* Features/Categories */}
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-caption text-text-tertiary mr-1">Features:</span>
            {categories.slice(0, 15).map((category) => (
              <span
                key={category.category_id}
                className="px-2 py-0.5 rounded bg-surface-elevated border border-border-subtle text-caption text-text-secondary"
              >
                {category.name}
                <span className="ml-1.5 text-text-muted">{category.game_count}</span>
              </span>
            ))}
            {categories.length > 15 && (
              <span className="text-caption text-text-muted">
                +{categories.length - 15} more
              </span>
            )}
          </div>
        )}

        {/* Franchises */}
        {franchises.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-caption text-text-tertiary mr-1">Franchises:</span>
            {franchises.map((franchise) => (
              <span
                key={franchise.id}
                className="px-2 py-0.5 rounded bg-accent-cyan/10 text-caption text-accent-cyan"
              >
                {franchise.name}
                <span className="ml-1.5 opacity-70">{franchise.game_count}</span>
              </span>
            ))}
          </div>
        )}

        {/* Languages */}
        {languages.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-caption text-text-tertiary mr-1">Languages:</span>
            {languages.slice(0, 12).map((lang) => (
              <span
                key={lang.language}
                className="px-2 py-0.5 rounded text-caption bg-surface-elevated text-text-secondary"
              >
                {lang.language}
                <span className="ml-1 text-text-muted">{lang.game_count}</span>
              </span>
            ))}
            {languages.length > 12 && (
              <span className="text-caption text-text-muted">
                +{languages.length - 12} more
              </span>
            )}
          </div>
        )}

        {/* Content Descriptors */}
        {contentDescriptors.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-caption text-text-tertiary">Warnings:</span>
            {contentDescriptors.map((descriptor) => (
              <span
                key={descriptor.descriptor_id}
                className={`px-2 py-0.5 rounded text-caption font-medium ${
                  descriptor.severity === 'high'
                    ? 'bg-accent-red/15 text-accent-red'
                    : 'bg-accent-orange/15 text-accent-orange'
                }`}
              >
                {descriptor.label}
                <span className="ml-1.5 opacity-70">{descriptor.game_count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PlatformBar({ label, count, total }: { label: string; count: number; total: number }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-16 text-body-sm text-text-secondary">{label}</div>
      <div className="flex-1 h-3 bg-surface-elevated rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-blue/60 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="w-12 text-body-sm text-text-tertiary text-right">{percentage}%</div>
    </div>
  );
}

function DistributionRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: 'green' | 'yellow' | 'red' | 'gray';
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  const colorClasses = {
    green: 'bg-accent-green/15 text-accent-green',
    yellow: 'bg-accent-yellow/15 text-accent-yellow',
    red: 'bg-accent-red/15 text-accent-red',
    gray: 'bg-surface-elevated text-text-muted',
  };

  return (
    <div className="flex items-center justify-between">
      <span className={`px-2 py-0.5 rounded text-caption font-medium ${colorClasses[color]}`}>
        {label}
      </span>
      <span className="text-body-sm text-text-secondary">
        {count} <span className="text-text-muted">({percentage}%)</span>
      </span>
    </div>
  );
}

function GamesSection({
  id,
  apps,
}: {
  id: string;
  apps: DeveloperApp[];
}) {
  // Sort apps by total_reviews descending
  const sortedApps = [...apps].sort((a, b) => (b.total_reviews ?? 0) - (a.total_reviews ?? 0));

  return (
    <section>
      <SectionHeader title="Games" id={id} />
      {sortedApps.length > 0 ? (
        <div className="rounded-md border border-border-subtle overflow-hidden">
          <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between bg-surface-raised">
            <h3 className="text-body-sm font-medium text-text-primary">All Games</h3>
            <span className="text-caption text-text-tertiary">{sortedApps.length} games</span>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead className="bg-surface-elevated">
                <tr>
                  <th className="px-3 py-2 text-left text-caption font-medium text-text-tertiary">Name</th>
                  <th className="px-3 py-2 text-left text-caption font-medium text-text-tertiary">Type</th>
                  <th className="px-3 py-2 text-left text-caption font-medium text-text-tertiary">Reviews</th>
                  <th className="px-3 py-2 text-right text-caption font-medium text-text-tertiary">Count</th>
                  <th className="px-3 py-2 text-right text-caption font-medium text-text-tertiary">Owners</th>
                  <th className="px-3 py-2 text-left text-caption font-medium text-text-tertiary">30d Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {sortedApps.map((app) => (
                  <tr key={app.appid} className="bg-surface-raised hover:bg-surface-elevated transition-colors">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/apps/${app.appid}`}
                          className="text-body-sm font-medium text-text-primary hover:text-accent-blue transition-colors"
                        >
                          {app.name}
                        </Link>
                        {app.is_delisted && (
                          <span className="px-1 py-0.5 rounded text-caption-sm bg-accent-red/15 text-accent-red">
                            Delisted
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <TypeBadge type={app.type as 'game' | 'dlc' | 'demo' | 'mod' | 'video'} />
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
                    <td className="px-3 py-2 text-right text-caption text-text-secondary">
                      {formatNumber(app.total_reviews)}
                    </td>
                    <td className="px-3 py-2 text-right text-caption text-text-secondary">
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
        </div>
      ) : (
        <p className="text-body-sm text-text-muted p-3 rounded-md border border-border-subtle bg-surface-raised">
          No games found for this developer
        </p>
      )}
    </section>
  );
}

function ReviewsSection({
  id,
  histogram,
  apps,
}: {
  id: string;
  histogram: ReviewHistogram[];
  apps: DeveloperApp[];
}) {
  const histogramData = [...histogram].reverse().slice(-12).map((h) => ({
    month: new Date(h.month_start).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    positive: h.recommendations_up,
    negative: h.recommendations_down,
  }));

  // Prepare game data for the aggregated popover
  const gameReviewData = apps
    .filter((app) => app.total_reviews && app.total_reviews > 0)
    .map((app) => ({
      appid: app.appid,
      name: app.name,
      positive_reviews: app.positive_reviews ?? 0,
      negative_reviews: app.negative_reviews ?? 0,
      total_reviews: app.total_reviews ?? 0,
    }));

  // Calculate aggregated review score
  const totalPositive = apps.reduce((sum, app) => sum + (app.positive_reviews ?? 0), 0);
  const totalNegative = apps.reduce((sum, app) => sum + (app.negative_reviews ?? 0), 0);
  const totalReviews = totalPositive + totalNegative;
  const aggregatedScore = totalReviews > 0 ? Math.round((totalPositive / totalReviews) * 100) : 0;

  return (
    <section>
      <SectionHeader title="Reviews" id={id} />
      {histogram.length > 0 ? (
        <div className="space-y-4">
          {/* Aggregated Review Summary with Popover */}
          {totalReviews > 0 && (
            <div className="p-3 rounded-md border border-border-subtle bg-surface-raised">
              <div className="flex items-center gap-4">
                <ReviewBreakdownPopover
                  games={gameReviewData}
                  trigger={
                    <div className="flex items-center gap-2 p-2 -m-2 rounded hover:bg-surface-elevated transition-colors cursor-pointer">
                      <ReviewScoreBadge score={aggregatedScore} />
                      <span className="text-caption text-text-secondary">
                        {totalReviews.toLocaleString()} reviews
                      </span>
                    </div>
                  }
                  title="Overall Review Breakdown"
                />
                <ReviewBreakdownPopover
                  games={gameReviewData}
                  trigger={
                    <div className="flex-1 max-w-xs p-2 -m-2 rounded hover:bg-surface-elevated transition-colors cursor-pointer">
                      <RatioBar positive={totalPositive} negative={totalNegative} />
                      <div className="flex justify-between mt-1 text-caption">
                        <span className="text-accent-green">{totalPositive.toLocaleString()}</span>
                        <span className="text-accent-red">{totalNegative.toLocaleString()}</span>
                      </div>
                    </div>
                  }
                  title="Overall Review Breakdown"
                />
              </div>
            </div>
          )}

          <div className="p-3 rounded-md border border-border-subtle bg-surface-raised">
            <h3 className="text-body-sm font-medium text-text-primary mb-2">Monthly Distribution</h3>
            <StackedBarChart
              data={histogramData}
              xKey="month"
              positiveKey="positive"
              negativeKey="negative"
              height={140}
            />
          </div>

          <div className="rounded-md border border-border-subtle overflow-hidden">
            <div className="px-3 py-2 border-b border-border-subtle bg-surface-raised">
              <h3 className="text-body-sm font-medium text-text-primary">Monthly Breakdown</h3>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
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
                    const monthLabel = new Date(h.month_start).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

                    const rowContent = (
                      <>
                        <td className="px-3 py-2 text-caption text-text-primary">
                          {monthLabel}
                        </td>
                        <td className="px-3 py-2 text-right text-caption">
                          <span className="text-accent-green">{h.recommendations_up.toLocaleString()}</span>
                          <span className="text-text-muted mx-0.5">/</span>
                          <span className="text-accent-red">{h.recommendations_down.toLocaleString()}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-caption text-text-secondary">{total.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-caption text-text-secondary">{ratio.toFixed(0)}%</td>
                        <td className="px-3 py-2">
                          <RatioBar positive={h.recommendations_up} negative={h.recommendations_down} />
                        </td>
                      </>
                    );

                    // If we have per-game breakdown for this month, wrap with popover
                    if (h.games && h.games.length > 0) {
                      return (
                        <MonthlyReviewBreakdownPopover
                          key={h.month_start}
                          games={h.games}
                          monthLabel={monthLabel}
                          trigger={
                            <tr className="bg-surface-raised hover:bg-surface-elevated transition-colors cursor-pointer">
                              {rowContent}
                            </tr>
                          }
                        />
                      );
                    }

                    return (
                      <tr key={h.month_start} className="bg-surface-raised hover:bg-surface-elevated transition-colors">
                        {rowContent}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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

function NetworkSection({
  id,
  relatedPublishers,
  similarDevelopers,
}: {
  id: string;
  relatedPublishers: RelatedPublisher[];
  similarDevelopers: SimilarDeveloper[];
}) {
  return (
    <section>
      <SectionHeader title="Network" id={id} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Related Publishers */}
        <Card padding="md">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-text-tertiary" />
            <h3 className="text-body-sm font-medium text-text-primary">Related Publishers</h3>
          </div>
          {relatedPublishers.length > 0 ? (
            <div className="space-y-1">
              {relatedPublishers.map((pub) => (
                <Link
                  key={pub.id}
                  href={`/publishers/${pub.id}`}
                  className="flex items-center justify-between p-1.5 rounded hover:bg-surface-elevated transition-colors group"
                >
                  <span className="text-body-sm text-text-primary group-hover:text-accent-blue transition-colors">
                    {pub.name}
                  </span>
                  <span className="text-caption text-text-tertiary">
                    {pub.shared_apps} shared
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-caption text-text-muted">No related publishers found</p>
          )}
        </Card>

        {/* Similar Developers */}
        <Card padding="md">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-text-tertiary" />
            <h3 className="text-body-sm font-medium text-text-primary">Similar Developers</h3>
          </div>
          {similarDevelopers.length > 0 ? (
            <div className="space-y-1">
              {similarDevelopers.map((dev) => (
                <Link
                  key={dev.id}
                  href={`/developers/${dev.id}`}
                  className="flex items-center justify-between p-1.5 rounded hover:bg-surface-elevated transition-colors group"
                >
                  <span className="text-body-sm text-text-primary group-hover:text-accent-blue transition-colors">
                    {dev.name}
                  </span>
                  <span className="text-caption text-text-tertiary">
                    {dev.game_count} games
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-caption text-text-muted">No similar developers found</p>
          )}
        </Card>
      </div>
    </section>
  );
}
