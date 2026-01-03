'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui';
import { TypeBadge, ReviewScoreBadge, TrendIndicator, StackedBarChart, RatioBar, ReviewBreakdownPopover, MonthlyReviewBreakdownPopover } from '@/components/data-display';
import { ChevronRight, ChevronDown, Users, Building2, Monitor, Gamepad2, Layers, Calendar, FileText, Globe } from 'lucide-react';
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
  { id: 'summary', label: 'Summary' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'games', label: 'Games' },
  { id: 'network', label: 'Network' },
];

// Utility functions
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

/**
 * Safely parse a month_start string (YYYY-MM or YYYY-MM-DD format)
 * and return a formatted month label. Fixes the "Dec 25" date bug.
 */
function formatMonthLabel(monthStart: string): string {
  if (!monthStart) return '—';

  // Handle YYYY-MM format by appending -01
  const dateStr = monthStart.length === 7 ? `${monthStart}-01` : monthStart;

  // Parse with explicit UTC to avoid timezone shifts
  const parts = dateStr.split('-');
  if (parts.length < 2) return '—';

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parts[2] ? parseInt(parts[2], 10) : 1;

  const date = new Date(Date.UTC(year, month - 1, day));

  if (isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
};

export function DeveloperDetailSections({
  developer,
  apps,
  relatedPublishers,
  tags,
  histogram,
  similarDevelopers,
  picsData,
}: DeveloperDetailSectionsProps) {
  const [activeSection, setActiveSection] = useState('summary');

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
        <SummarySection
          id="summary"
          developer={developer}
          tags={tags}
          picsData={picsData}
          totalGames={apps.length}
        />
        <ReviewsSection id="reviews" histogram={histogram} apps={apps} />
        <GamesSection id="games" apps={apps} />
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

// ============================================================================
// SUMMARY SECTION - Merged Overview + Portfolio PICS
// ============================================================================

function SummarySection({
  id,
  developer,
  tags,
  picsData,
  totalGames,
}: {
  id: string;
  developer: Developer;
  tags: { tag: string; vote_count: number }[];
  picsData: PortfolioPICSData | null;
  totalGames: number;
}) {
  return (
    <section>
      <SectionHeader title="Summary" id={id} />
      <div className="space-y-4">
        {/* Row 1: Quick Facts + Tags */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Quick Facts Card */}
          <div className="p-3 rounded-md border border-border-subtle bg-surface-raised">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center text-center">
                <Calendar className="h-4 w-4 text-text-tertiary mb-1" />
                <p className="text-caption text-text-tertiary">First Release</p>
                <p className="text-body-sm font-medium text-text-primary">{formatDate(developer.first_game_release_date)}</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <FileText className="h-4 w-4 text-text-tertiary mb-1" />
                <p className="text-caption text-text-tertiary">Page Created</p>
                <p className="text-body-sm font-medium text-text-primary">{formatDate(developer.first_page_creation_date)}</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <Gamepad2 className="h-4 w-4 text-text-tertiary mb-1" />
                <p className="text-caption text-text-tertiary">Total Games</p>
                <p className="text-body-sm font-medium text-text-primary">{developer.game_count}</p>
              </div>
            </div>
          </div>

          {/* Tags - spans 2 columns */}
          <div className="lg:col-span-2 p-3 rounded-md border border-border-subtle bg-surface-raised">
            {tags.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-caption text-text-tertiary mr-1">Top Tags:</span>
                {tags.slice(0, 12).map(({ tag, vote_count }) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded bg-surface-elevated border border-border-subtle text-caption text-text-secondary hover:border-border-muted transition-colors"
                    title={`${vote_count.toLocaleString()} votes`}
                  >
                    {tag}
                    <span className="ml-1.5 text-text-muted">{vote_count.toLocaleString()}</span>
                  </span>
                ))}
                {tags.length > 12 && (
                  <span className="text-caption text-text-muted">
                    +{tags.length - 12} more
                  </span>
                )}
              </div>
            ) : (
              <p className="text-caption text-text-muted">No tags available</p>
            )}
          </div>
        </div>

        {/* Row 2: Platform Stats Grid */}
        {picsData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Platform Coverage */}
            <Card padding="md">
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="h-4 w-4 text-text-tertiary" />
                <h3 className="text-body-sm font-medium text-text-primary">Platform Coverage</h3>
              </div>
              <div className="space-y-2">
                <PlatformBar label="Windows" count={picsData.platformStats.platforms.windows} total={totalGames} />
                <PlatformBar label="macOS" count={picsData.platformStats.platforms.macos} total={totalGames} />
                <PlatformBar label="Linux" count={picsData.platformStats.platforms.linux} total={totalGames} />
              </div>
            </Card>

            {/* Steam Deck */}
            <Card padding="md">
              <div className="flex items-center gap-2 mb-2">
                <Gamepad2 className="h-4 w-4 text-text-tertiary" />
                <h3 className="text-body-sm font-medium text-text-primary">Steam Deck</h3>
              </div>
              <div className="space-y-1.5">
                <DistributionRow label="Verified" count={picsData.platformStats.steamDeck.verified} total={totalGames} color="green" />
                <DistributionRow label="Playable" count={picsData.platformStats.steamDeck.playable} total={totalGames} color="yellow" />
                <DistributionRow label="Unsupported" count={picsData.platformStats.steamDeck.unsupported} total={totalGames} color="red" />
                <DistributionRow label="Unknown" count={picsData.platformStats.steamDeck.unknown} total={totalGames} color="gray" />
              </div>
            </Card>

            {/* Controller Support */}
            <Card padding="md">
              <div className="flex items-center gap-2 mb-2">
                <Gamepad2 className="h-4 w-4 text-text-tertiary" />
                <h3 className="text-body-sm font-medium text-text-primary">Controller Support</h3>
              </div>
              <div className="space-y-1.5">
                <DistributionRow label="Full" count={picsData.platformStats.controllerSupport.full} total={totalGames} color="green" />
                <DistributionRow label="Partial" count={picsData.platformStats.controllerSupport.partial} total={totalGames} color="yellow" />
                <DistributionRow label="None" count={picsData.platformStats.controllerSupport.none} total={totalGames} color="gray" />
              </div>
            </Card>
          </div>
        )}

        {/* Row 3: Genre Waffle Chart */}
        {picsData && picsData.genres.length > 0 && (
          <GenreWaffleChart genres={picsData.genres} totalGames={totalGames} />
        )}

        {/* Row 4: Features + Franchises */}
        {picsData && (picsData.categories.length > 0 || picsData.franchises.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {picsData.categories.length > 0 && (
              <FeaturesCard categories={picsData.categories} />
            )}
            {picsData.franchises.length > 0 && (
              <FranchisesCard franchises={picsData.franchises} />
            )}
          </div>
        )}

        {/* Row 5: Languages + Content Warnings */}
        {picsData && (picsData.languages.length > 0 || picsData.contentDescriptors.length > 0) && (
          <div className="flex flex-wrap gap-3">
            {picsData.languages.length > 0 && (
              <div className="flex-1 min-w-[200px]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-text-tertiary" />
                  <span className="text-caption text-text-tertiary mr-1">Languages:</span>
                  {picsData.languages.slice(0, 8).map((lang) => (
                    <span
                      key={lang.language}
                      className="px-1.5 py-0.5 rounded text-caption bg-surface-elevated text-text-secondary"
                    >
                      {lang.language}
                      <span className="ml-1 text-text-muted">{lang.game_count}</span>
                    </span>
                  ))}
                  {picsData.languages.length > 8 && (
                    <span className="text-caption text-text-muted">
                      +{picsData.languages.length - 8}
                    </span>
                  )}
                </div>
              </div>
            )}
            {picsData.contentDescriptors.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-caption text-text-tertiary">Warnings:</span>
                {picsData.contentDescriptors.map((descriptor) => (
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
        )}
      </div>
    </section>
  );
}

// ============================================================================
// GENRE WAFFLE CHART - Visual genre distribution
// ============================================================================

const GENRE_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-cyan-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-orange-500',
  'bg-rose-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
];

const GENRE_LEGEND_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-cyan-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-orange-500',
  'bg-rose-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
];

interface GenreWaffleChartProps {
  genres: { genre_id: number; name: string; game_count: number; is_primary_count: number }[];
  totalGames: number;
}

function GenreWaffleChart({ genres, totalGames }: GenreWaffleChartProps) {
  const GRID_SIZE = 100; // 10x10 grid = 100 cells

  const { cells } = useMemo(() => {
    const result: { genre: typeof genres[0] | null; colorIndex: number }[] = [];
    const colorMap = new Map<number, number>();
    let cellIndex = 0;

    // Assign colors to genres
    genres.slice(0, 10).forEach((genre, i) => {
      colorMap.set(genre.genre_id, i);
    });

    // Fill cells based on genre proportions
    for (const genre of genres.slice(0, 10)) {
      const cellCount = Math.max(1, Math.round((genre.game_count / totalGames) * GRID_SIZE));
      const colorIndex = colorMap.get(genre.genre_id) ?? 0;

      for (let i = 0; i < cellCount && cellIndex < GRID_SIZE; i++) {
        result.push({ genre, colorIndex });
        cellIndex++;
      }
    }

    // Fill remaining cells with neutral color
    while (cellIndex < GRID_SIZE) {
      result.push({ genre: null, colorIndex: -1 });
      cellIndex++;
    }

    return { cells: result };
  }, [genres, totalGames]);

  const [hoveredGenre, setHoveredGenre] = useState<number | null>(null);

  return (
    <div className="p-4 rounded-lg border border-border-subtle bg-surface-raised">
      <h3 className="text-body-sm font-medium text-text-primary mb-3">Genre Distribution</h3>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Waffle Grid: 10x10 */}
        <div className="grid grid-cols-10 gap-0.5 w-full max-w-[280px] aspect-square">
          {cells.map((cell, i) => {
            const isHovered = hoveredGenre !== null && cell.genre?.genre_id === hoveredGenre;
            const isFaded = hoveredGenre !== null && cell.genre?.genre_id !== hoveredGenre;

            return (
              <motion.div
                key={i}
                className={`rounded-sm cursor-pointer transition-all duration-150 ${
                  cell.colorIndex >= 0
                    ? `${GENRE_COLORS[cell.colorIndex]} ${isFaded ? 'opacity-30' : 'opacity-80'}`
                    : 'bg-surface-elevated opacity-40'
                }`}
                whileHover={{ scale: 1.15, zIndex: 10 }}
                onMouseEnter={() => cell.genre && setHoveredGenre(cell.genre.genre_id)}
                onMouseLeave={() => setHoveredGenre(null)}
                style={{
                  transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                }}
                title={cell.genre ? `${cell.genre.name}: ${cell.genre.game_count} games (${Math.round((cell.genre.game_count / totalGames) * 100)}%)` : 'Other'}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1.5 content-start">
          {genres.slice(0, 10).map((genre, i) => {
            const percentage = Math.round((genre.game_count / totalGames) * 100);
            const isHovered = hoveredGenre === genre.genre_id;

            return (
              <div
                key={genre.genre_id}
                className={`flex items-center gap-2 py-0.5 px-1 rounded transition-colors cursor-pointer ${
                  isHovered ? 'bg-surface-elevated' : ''
                }`}
                onMouseEnter={() => setHoveredGenre(genre.genre_id)}
                onMouseLeave={() => setHoveredGenre(null)}
              >
                <div className={`w-3 h-3 rounded-sm flex-shrink-0 ${GENRE_LEGEND_COLORS[i]}`} />
                <span className="text-caption text-text-secondary truncate flex-1">
                  {genre.name}
                </span>
                <span className="text-caption text-text-muted flex-shrink-0">
                  {percentage}%
                </span>
              </div>
            );
          })}
          {genres.length > 10 && (
            <div className="flex items-center gap-2 py-0.5 px-1 col-span-2">
              <div className="w-3 h-3 rounded-sm flex-shrink-0 bg-surface-elevated" />
              <span className="text-caption text-text-muted">
                +{genres.length - 10} more genres
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FEATURES & FRANCHISES CARDS
// ============================================================================

interface FeaturesCardProps {
  categories: { category_id: number; name: string; game_count: number }[];
}

function FeaturesCard({ categories }: FeaturesCardProps) {
  return (
    <div className="p-3 rounded-md border border-border-subtle bg-surface-raised">
      <h3 className="text-body-sm font-medium text-text-primary mb-2 flex items-center gap-2">
        <Gamepad2 className="h-4 w-4 text-text-tertiary" />
        Top Features
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {categories.slice(0, 10).map((cat) => (
          <span
            key={cat.category_id}
            className="px-2 py-1 rounded-md bg-surface-elevated border border-border-subtle
                       text-caption text-text-secondary hover:border-border-muted transition-colors"
          >
            {cat.name}
            <span className="ml-1.5 text-text-muted">{cat.game_count}</span>
          </span>
        ))}
        {categories.length > 10 && (
          <span className="px-2 py-1 text-caption text-text-muted">
            +{categories.length - 10} more
          </span>
        )}
      </div>
    </div>
  );
}

interface FranchisesCardProps {
  franchises: { id: number; name: string; game_count: number }[];
}

function FranchisesCard({ franchises }: FranchisesCardProps) {
  return (
    <div className="p-3 rounded-md border border-accent-cyan/20 bg-accent-cyan/5">
      <h3 className="text-body-sm font-medium text-text-primary mb-2 flex items-center gap-2">
        <Layers className="h-4 w-4 text-accent-cyan" />
        Franchises
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {franchises.map((f) => (
          <span
            key={f.id}
            className="px-2 py-1 rounded-md bg-accent-cyan/10 border border-accent-cyan/20
                       text-caption text-accent-cyan font-medium"
          >
            {f.name}
            <span className="ml-1.5 opacity-70">{f.game_count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

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

// ============================================================================
// REVIEWS SECTION - With Framer Motion animations
// ============================================================================

function ReviewsSection({
  id,
  histogram,
  apps,
}: {
  id: string;
  histogram: ReviewHistogram[];
  apps: DeveloperApp[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const histogramData = [...histogram].reverse().slice(-12).map((h) => ({
    month: formatMonthLabel(h.month_start),
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

  const displayedHistogram = isExpanded ? histogram.slice(0, 12) : histogram.slice(0, 4);

  return (
    <section>
      <SectionHeader title="Reviews" id={id} />
      {histogram.length > 0 ? (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="space-y-4"
        >
          {/* Aggregated Review Summary with Popover */}
          {totalReviews > 0 && (
            <motion.div variants={itemVariants}>
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
            </motion.div>
          )}

          {/* Monthly Distribution Chart */}
          <motion.div variants={itemVariants}>
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
          </motion.div>

          {/* Monthly Breakdown Table */}
          <motion.div variants={itemVariants}>
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
                    <AnimatePresence mode="popLayout">
                      {displayedHistogram.map((h) => {
                        const total = h.recommendations_up + h.recommendations_down;
                        const ratio = total > 0 ? (h.recommendations_up / total * 100) : 0;
                        const monthLabel = formatMonthLabel(h.month_start);

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
                                <motion.tr
                                  layout
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className="bg-surface-raised hover:bg-surface-elevated transition-colors cursor-pointer"
                                >
                                  {rowContent}
                                </motion.tr>
                              }
                            />
                          );
                        }

                        return (
                          <motion.tr
                            key={h.month_start}
                            layout
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-surface-raised hover:bg-surface-elevated transition-colors"
                          >
                            {rowContent}
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* Expand/Collapse Button */}
              {histogram.length > 4 && (
                <motion.button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-full px-3 py-2 text-caption text-accent-blue hover:bg-surface-elevated transition-colors flex items-center justify-center gap-1"
                  whileHover={{ backgroundColor: 'var(--surface-elevated)' }}
                  whileTap={{ scale: 0.99 }}
                >
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </motion.span>
                  {isExpanded ? 'Show Less' : `Show ${Math.min(histogram.length - 4, 8)} More Months`}
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : (
        <p className="text-body-sm text-text-muted p-3 rounded-md border border-border-subtle bg-surface-raised">
          No review histogram data available
        </p>
      )}
    </section>
  );
}

// ============================================================================
// GAMES SECTION
// ============================================================================

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

// ============================================================================
// NETWORK SECTION
// ============================================================================

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
