'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { Grid } from '@/components/layout';
import { TypeBadge, ReviewScoreBadge, TrendIndicator, StackedBarChart, RatioBar } from '@/components/data-display';
import { Calendar, ChevronRight, Users, Building2 } from 'lucide-react';

interface Publisher {
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

interface PublisherApp {
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

interface RelatedDeveloper {
  id: number;
  name: string;
  game_count: number;
  shared_apps: number;
}

interface SimilarPublisher {
  id: number;
  name: string;
  game_count: number;
  shared_tags: number;
}

interface ReviewHistogram {
  month_start: string;
  recommendations_up: number;
  recommendations_down: number;
}

interface PublisherDetailSectionsProps {
  publisher: Publisher;
  apps: PublisherApp[];
  relatedDevelopers: RelatedDeveloper[];
  tags: { tag: string; vote_count: number }[];
  histogram: ReviewHistogram[];
  similarPublishers: SimilarPublisher[];
}

const sections = [
  { id: 'overview', label: 'Overview' },
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

export function PublisherDetailSections({
  publisher,
  apps,
  relatedDevelopers,
  tags,
  histogram,
  similarPublishers,
}: PublisherDetailSectionsProps) {
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
        <OverviewSection id="overview" publisher={publisher} tags={tags} />
        <GamesSection id="games" apps={apps} />
        <ReviewsSection id="reviews" histogram={histogram} />
        <NetworkSection
          id="network"
          relatedDevelopers={relatedDevelopers}
          similarPublishers={similarPublishers}
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
  publisher,
  tags,
}: {
  id: string;
  publisher: Publisher;
  tags: { tag: string; vote_count: number }[];
}) {
  return (
    <section>
      <SectionHeader title="Overview" id={id} />
      <div className="space-y-6">
        {/* Tags */}
        {tags.length > 0 && (
          <div>
            <h3 className="text-subheading text-text-primary mb-4">Top Tags</h3>
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

        {/* Publisher Details */}
        <Card padding="lg">
          <h3 className="text-subheading text-text-primary mb-4">Publisher Details</h3>
          <Grid cols={3} gap="md">
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-text-tertiary mt-0.5" />
              <div>
                <p className="text-caption text-text-tertiary">First Game Release</p>
                <p className="text-body text-text-primary">{formatDate(publisher.first_game_release_date)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-text-tertiary mt-0.5" />
              <div>
                <p className="text-caption text-text-tertiary">Page Created</p>
                <p className="text-body text-text-primary">{formatDate(publisher.first_page_creation_date)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 text-text-tertiary mt-0.5" />
              <div>
                <p className="text-caption text-text-tertiary">Total Games</p>
                <p className="text-body text-text-primary">{publisher.game_count}</p>
              </div>
            </div>
          </Grid>
        </Card>
      </div>
    </section>
  );
}

function GamesSection({
  id,
  apps,
}: {
  id: string;
  apps: PublisherApp[];
}) {
  // Sort apps by total_reviews descending
  const sortedApps = [...apps].sort((a, b) => (b.total_reviews ?? 0) - (a.total_reviews ?? 0));

  return (
    <section>
      <SectionHeader title="Games" id={id} />
      {sortedApps.length > 0 ? (
        <Card padding="none">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <h3 className="text-subheading text-text-primary">All Games</h3>
            <span className="text-body-sm text-text-tertiary">{sortedApps.length} games</span>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[800px]">
              <thead className="bg-surface-elevated">
                <tr>
                  <th className="px-4 py-3 text-left text-caption font-medium text-text-secondary">Name</th>
                  <th className="px-4 py-3 text-left text-caption font-medium text-text-secondary">Type</th>
                  <th className="px-4 py-3 text-left text-caption font-medium text-text-secondary">Reviews</th>
                  <th className="px-4 py-3 text-right text-caption font-medium text-text-secondary">Count</th>
                  <th className="px-4 py-3 text-right text-caption font-medium text-text-secondary">Owners</th>
                  <th className="px-4 py-3 text-left text-caption font-medium text-text-secondary">30d Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {sortedApps.map((app) => (
                  <tr key={app.appid} className="bg-surface-raised hover:bg-surface-elevated transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/apps/${app.appid}`}
                          className="text-body font-medium text-text-primary hover:text-accent-blue transition-colors"
                        >
                          {app.name}
                        </Link>
                        {app.is_delisted && (
                          <span className="px-1.5 py-0.5 rounded text-caption bg-accent-red/15 text-accent-red">
                            Delisted
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={app.type as 'game' | 'dlc' | 'demo' | 'mod' | 'video'} />
                    </td>
                    <td className="px-4 py-3">
                      {app.total_reviews && app.total_reviews > 0 ? (
                        <ReviewScoreBadge
                          score={Math.round((app.positive_reviews ?? 0) / app.total_reviews * 100)}
                        />
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-body-sm text-text-secondary">
                      {formatNumber(app.total_reviews)}
                    </td>
                    <td className="px-4 py-3 text-right text-body-sm text-text-secondary">
                      {formatOwners(app.owners_min, app.owners_max)}
                    </td>
                    <td className="px-4 py-3">
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
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-text-muted">No games found for this publisher</p>
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
            <p className="text-body-sm text-text-tertiary mb-4">Aggregated across all games</p>
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

function NetworkSection({
  id,
  relatedDevelopers,
  similarPublishers,
}: {
  id: string;
  relatedDevelopers: RelatedDeveloper[];
  similarPublishers: SimilarPublisher[];
}) {
  return (
    <section>
      <SectionHeader title="Network" id={id} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Related Developers */}
        <Card padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-text-tertiary" />
            <h3 className="text-subheading text-text-primary">Related Developers</h3>
          </div>
          {relatedDevelopers.length > 0 ? (
            <div className="space-y-2">
              {relatedDevelopers.map((dev) => (
                <Link
                  key={dev.id}
                  href={`/developers/${dev.id}`}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-surface-elevated transition-colors group"
                >
                  <span className="text-body text-text-primary group-hover:text-accent-blue transition-colors">
                    {dev.name}
                  </span>
                  <span className="text-body-sm text-text-tertiary">
                    {dev.shared_apps} shared game{dev.shared_apps !== 1 ? 's' : ''}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-body-sm text-text-muted">No related developers found</p>
          )}
        </Card>

        {/* Similar Publishers */}
        <Card padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-4 w-4 text-text-tertiary" />
            <h3 className="text-subheading text-text-primary">Similar Publishers</h3>
          </div>
          {similarPublishers.length > 0 ? (
            <div className="space-y-2">
              {similarPublishers.map((pub) => (
                <Link
                  key={pub.id}
                  href={`/publishers/${pub.id}`}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-surface-elevated transition-colors group"
                >
                  <span className="text-body text-text-primary group-hover:text-accent-blue transition-colors">
                    {pub.name}
                  </span>
                  <span className="text-body-sm text-text-tertiary">
                    {pub.game_count} games
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-body-sm text-text-muted">No similar publishers found</p>
          )}
        </Card>
      </div>
    </section>
  );
}
