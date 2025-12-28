'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui';
import { Grid } from '@/components/layout';
import { TrendBadge, TierBadge, StackedBarChart, AreaChartComponent, RatioBar } from '@/components/data-display';
import { Calendar, Wrench, CheckCircle2, XCircle, AlertTriangle, Clock, ChevronRight } from 'lucide-react';

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

interface AppDetailSectionsProps {
  app: AppDetails;
  developers: string[];
  publishers: string[];
  tags: { tag: string; vote_count: number }[];
  metrics: DailyMetric[];
  histogram: ReviewHistogram[];
  trends: AppTrends | null;
  syncStatus: SyncStatus | null;
}

const sections = [
  { id: 'overview', label: 'Overview' },
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

export function AppDetailSections({
  app,
  developers,
  publishers,
  tags,
  metrics,
  histogram,
  trends,
  syncStatus,
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
      <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm border-b border-border-subtle -mx-8 px-8 py-3 mb-6">
        <nav className="flex items-center gap-1">
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
          trends={trends}
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
  trends,
}: {
  id: string;
  app: AppDetails;
  developers: string[];
  publishers: string[];
  tags: { tag: string; vote_count: number }[];
  trends: AppTrends | null;
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
                  <span key={dev} className="px-3 py-1.5 rounded-md bg-surface-overlay text-body-sm text-text-secondary">
                    {dev}
                  </span>
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
                  <span key={pub} className="px-3 py-1.5 rounded-md bg-surface-overlay text-body-sm text-text-secondary">
                    {pub}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-body-sm">No publishers linked</p>
            )}
          </Card>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
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
