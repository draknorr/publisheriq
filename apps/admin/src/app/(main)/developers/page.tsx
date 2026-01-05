import type { Metadata } from 'next';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import Link from 'next/link';
import { PageHeader } from '@/components/layout';
import { MetricCard, ReviewScoreBadge, TierBadge } from '@/components/data-display';
import { Card } from '@/components/ui';
import { Users, Layers, TrendingUp, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { AdvancedFilters } from '@/components/filters/AdvancedFilters';

export const metadata: Metadata = {
  title: 'Developers',
};

export const dynamic = 'force-dynamic';

type SortField = 'name' | 'game_count' | 'first_game_release_date' | 'total_owners_max' | 'total_ccu_peak' | 'weighted_review_score' | 'estimated_revenue_usd' | 'games_trending_up';
type SortOrder = 'asc' | 'desc';

interface DeveloperWithMetrics {
  id: number;
  name: string;
  normalized_name: string;
  steam_vanity_url: string | null;
  first_game_release_date: string | null;
  game_count: number | null;
  total_owners_min: number;
  total_owners_max: number;
  total_ccu_peak: number;
  max_ccu_peak: number;
  total_reviews: number;
  weighted_review_score: number | null;
  estimated_revenue_usd: number;
  games_trending_up: number;
  games_trending_down: number;
  games_released_last_year: number;
  computed_at: string | null;
}

interface FilterParams {
  search?: string;
  sort: SortField;
  order: SortOrder;
  filter?: string;
  minOwners?: number;
  minCcu?: number;
  minScore?: number;
  minGames?: number;
  status?: 'active' | 'dormant';
}

async function getDevelopers(params: FilterParams): Promise<DeveloperWithMetrics[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }
  const supabase = getSupabase();

  // Use the RPC function for server-side filtering with metrics
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('get_developers_with_metrics', {
    p_search: params.search || null,
    p_min_owners: params.minOwners || null,
    p_min_ccu: params.minCcu || null,
    p_min_score: params.minScore || null,
    p_min_games: params.filter === 'prolific' ? 5 : (params.minGames || null),
    p_status: params.status || null,
    p_sort_field: params.sort,
    p_sort_order: params.order,
    p_limit: 100,
    p_offset: 0,
  }) as { data: DeveloperWithMetrics[] | null; error: Error | null };

  if (error) {
    console.error('Error fetching developers via RPC:', error);
    // Fallback to basic query if RPC fails
    return getDevelopersFallback(params);
  }

  return data ?? [];
}

// Fallback query without metrics (in case materialized view doesn't exist)
async function getDevelopersFallback(params: FilterParams): Promise<DeveloperWithMetrics[]> {
  const supabase = getSupabase();

  let query = supabase
    .from('developers')
    .select('*')
    .limit(100);

  if (params.search) {
    query = query.ilike('name', `%${params.search}%`);
  }

  if (params.filter === 'prolific') {
    query = query.gte('game_count', 5);
  } else if (params.filter === 'recent') {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    query = query.gte('first_game_release_date', oneYearAgo.toISOString().split('T')[0]);
  }

  const basicSort = ['name', 'game_count', 'first_game_release_date'].includes(params.sort) ? params.sort : 'game_count';
  query = query.order(basicSort, { ascending: params.order === 'asc' });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching developers (fallback):', error);
    return [];
  }

  // Map to expected interface with zeroed metrics
  return (data ?? []).map(d => ({
    ...d,
    total_owners_min: 0,
    total_owners_max: 0,
    total_ccu_peak: 0,
    max_ccu_peak: 0,
    total_reviews: 0,
    weighted_review_score: null,
    estimated_revenue_usd: 0,
    games_trending_up: 0,
    games_trending_down: 0,
    games_released_last_year: 0,
    computed_at: null,
  }));
}

async function getDeveloperStats() {
  if (!isSupabaseConfigured()) {
    return { total: 0, prolific: 0, recentlyActive: 0 };
  }
  const supabase = getSupabase();

  // Use RPC for efficient stats query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('get_developer_stats') as {
    data: { total: number; prolific: number; recentlyActive: number } | null;
    error: Error | null;
  };

  if (error) {
    // Fallback to basic count if RPC doesn't exist
    const { count } = await supabase.from('developers').select('*', { count: 'exact', head: true });
    return { total: count ?? 0, prolific: 0, recentlyActive: 0 };
  }

  return data ?? { total: 0, prolific: 0, recentlyActive: 0 };
}

// Format helpers
function formatOwners(min: number, max: number): string {
  if (min === 0 && max === 0) return '—';

  const formatNum = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toString();
  };

  return `${formatNum(min)} - ${formatNum(max)}`;
}

function formatCompactNumber(n: number): string {
  if (n === 0) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatRevenue(n: number): string {
  if (n === 0) return '—';
  if (n >= 1000000000) return `$${(n / 1000000000).toFixed(1)}B`;
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function SortHeader({
  field,
  label,
  currentSort,
  currentOrder,
  searchParams,
  className = '',
}: {
  field: SortField;
  label: string;
  currentSort: SortField;
  currentOrder: SortOrder;
  searchParams: URLSearchParams;
  className?: string;
}) {
  const isActive = currentSort === field;
  const nextOrder = isActive && currentOrder === 'desc' ? 'asc' : 'desc';
  const arrow = isActive ? (currentOrder === 'asc' ? ' ↑' : ' ↓') : '';

  // Build URL preserving other params
  const newParams = new URLSearchParams(searchParams);
  newParams.set('sort', field);
  newParams.set('order', nextOrder);

  return (
    <th className={`px-3 py-2 text-left text-caption font-medium text-text-tertiary ${className}`}>
      <Link
        href={`?${newParams.toString()}`}
        className={`hover:text-text-primary transition-colors ${isActive ? 'text-accent-blue' : ''}`}
      >
        {label}{arrow}
      </Link>
    </th>
  );
}

function TrendingBadge({ up, down }: { up: number; down: number }) {
  if (up === 0 && down === 0) return <span className="text-text-muted">—</span>;

  return (
    <div className="flex items-center gap-2 text-caption">
      {up > 0 && (
        <span className="inline-flex items-center gap-0.5 text-accent-green">
          <ChevronUp className="h-3 w-3" />
          {up}
        </span>
      )}
      {down > 0 && (
        <span className="inline-flex items-center gap-0.5 text-accent-red">
          <ChevronDown className="h-3 w-3" />
          {down}
        </span>
      )}
    </div>
  );
}

export default async function DevelopersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    sort?: SortField;
    order?: SortOrder;
    filter?: string;
    minOwners?: string;
    minCcu?: string;
    minScore?: string;
    minGames?: string;
    status?: 'active' | 'dormant';
  }>;
}) {
  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />;
  }

  const params = await searchParams;
  const { search, filter, status } = params;
  const sort = params.sort ?? 'game_count';
  const order = params.order ?? 'desc';
  const minOwners = params.minOwners ? parseInt(params.minOwners) : undefined;
  const minCcu = params.minCcu ? parseInt(params.minCcu) : undefined;
  const minScore = params.minScore ? parseInt(params.minScore) : undefined;
  const minGames = params.minGames ? parseInt(params.minGames) : undefined;

  // Build URLSearchParams for passing to SortHeader
  const currentParams = new URLSearchParams();
  if (search) currentParams.set('search', search);
  if (filter) currentParams.set('filter', filter);
  if (status) currentParams.set('status', status);
  if (minOwners) currentParams.set('minOwners', minOwners.toString());
  if (minCcu) currentParams.set('minCcu', minCcu.toString());
  if (minScore) currentParams.set('minScore', minScore.toString());
  if (minGames) currentParams.set('minGames', minGames.toString());

  const hasAdvancedFilters = minOwners || minCcu || minScore || minGames || status;

  let developers: DeveloperWithMetrics[] = [];
  let stats = { total: 0, prolific: 0, recentlyActive: 0 };
  let fetchError: string | null = null;

  try {
    [developers, stats] = await Promise.all([
      getDevelopers({ search, sort, order, filter, minOwners, minCcu, minScore, minGames, status }),
      getDeveloperStats(),
    ]);
  } catch (error) {
    fetchError = error instanceof Error ? error.message : String(error);
    console.error('Developers page error:', error);
  }

  if (fetchError) {
    return (
      <div className="p-6">
        <Card className="p-6 border-accent-red/50 bg-accent-red/10">
          <h2 className="text-subheading text-accent-red mb-2">Error Loading Developers</h2>
          <p className="text-body text-text-secondary mb-4">
            There was an error fetching developer data. This might be due to missing database migrations.
          </p>
          <pre className="p-4 bg-surface-raised rounded-lg text-caption text-text-muted overflow-x-auto">
            {fetchError}
          </pre>
          <p className="mt-4 text-body-sm text-text-tertiary">
            Ensure the following migrations have been applied:
          </p>
          <ul className="list-disc list-inside text-body-sm text-text-tertiary mt-2">
            <li>20251228100000_add_developer_metrics_view.sql</li>
            <li>20251228100001_add_publisher_metrics_view.sql</li>
            <li>20251228100002_add_metrics_refresh_function.sql</li>
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Developers"
        description={`Browse Steam developers (${stats.total.toLocaleString()} total)`}
      />

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total developers"
          value={stats.total}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          label="Prolific (5+ games)"
          value={stats.prolific}
          icon={<Layers className="h-4 w-4" />}
        />
        <MetricCard
          label="Recently active"
          value={stats.recentlyActive}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* Search & Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <form className="flex-1">
          <div className="relative">
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search developers by name..."
              className="w-full h-10 rounded-md bg-surface-elevated border border-border-muted px-4 pl-10 text-body text-text-primary placeholder:text-text-muted transition-colors hover:border-border-prominent focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary"
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
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/developers"
            className={`px-3 py-2 rounded-md text-body-sm font-medium transition-colors ${
              !filter && !hasAdvancedFilters
                ? 'bg-accent-blue text-white'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-overlay border border-border-subtle'
            }`}
          >
            All
          </Link>
          <Link
            href="/developers?filter=prolific"
            className={`px-3 py-2 rounded-md text-body-sm font-medium transition-colors ${
              filter === 'prolific'
                ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-overlay border border-border-subtle'
            }`}
          >
            Prolific
          </Link>
          <Link
            href="/developers?status=active"
            className={`px-3 py-2 rounded-md text-body-sm font-medium transition-colors ${
              status === 'active'
                ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-overlay border border-border-subtle'
            }`}
          >
            Active
          </Link>
          <Link
            href="/developers?minOwners=100000"
            className={`px-3 py-2 rounded-md text-body-sm font-medium transition-colors ${
              minOwners && minOwners >= 100000
                ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-overlay border border-border-subtle'
            }`}
          >
            100K+ Owners
          </Link>
          <Link
            href="/developers?minScore=80"
            className={`px-3 py-2 rounded-md text-body-sm font-medium transition-colors ${
              minScore && minScore >= 80
                ? 'bg-accent-yellow/20 text-accent-yellow border border-accent-yellow/30'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-overlay border border-border-subtle'
            }`}
          >
            80%+ Reviews
          </Link>
        </div>
      </div>

      {/* Advanced Filters Row */}
      <AdvancedFilters
        basePath="/developers"
        filters={[
          {
            name: 'minOwners',
            label: 'Min Owners',
            options: [
              { value: '', label: 'Any' },
              { value: '1000', label: '1K+' },
              { value: '10000', label: '10K+' },
              { value: '100000', label: '100K+' },
              { value: '1000000', label: '1M+' },
              { value: '10000000', label: '10M+' },
            ],
          },
          {
            name: 'minCcu',
            label: 'Min CCU Peak',
            options: [
              { value: '', label: 'Any' },
              { value: '100', label: '100+' },
              { value: '1000', label: '1K+' },
              { value: '10000', label: '10K+' },
              { value: '100000', label: '100K+' },
            ],
          },
          {
            name: 'minScore',
            label: 'Min Review Score',
            options: [
              { value: '', label: 'Any' },
              { value: '50', label: '50%+' },
              { value: '70', label: '70%+' },
              { value: '80', label: '80%+' },
              { value: '90', label: '90%+' },
              { value: '95', label: '95%+' },
            ],
          },
          {
            name: 'minGames',
            label: 'Min Games',
            options: [
              { value: '', label: 'Any' },
              { value: '2', label: '2+' },
              { value: '5', label: '5+' },
              { value: '10', label: '10+' },
              { value: '25', label: '25+' },
              { value: '50', label: '50+' },
            ],
          },
          {
            name: 'status',
            label: 'Activity Status',
            options: [
              { value: '', label: 'Any' },
              { value: 'active', label: 'Active (released in last year)' },
              { value: 'dormant', label: 'Dormant' },
            ],
          },
        ]}
      />

      {developers.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-surface-overlay flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-text-tertiary" />
          </div>
          <h3 className="text-subheading text-text-primary">No developers found</h3>
          <p className="mt-2 text-body-sm text-text-secondary">
            {search || hasAdvancedFilters
              ? 'Try adjusting your filters'
              : 'Run the Storefront sync to populate developers'}
          </p>
        </Card>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-2">
            {developers.map((developer) => (
              <Link key={developer.id} href={`/developers/${developer.id}`}>
                <Card variant="interactive" padding="sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="text-body font-medium text-text-primary">
                      {developer.name}
                    </span>
                    <div className="flex gap-1.5">
                      {developer.game_count >= 5 && (
                        <span className="px-1.5 py-0.5 rounded text-caption bg-accent-cyan/15 text-accent-cyan">
                          Prolific
                        </span>
                      )}
                      {developer.games_released_last_year > 0 && (
                        <TierBadge tier="active" />
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-body-sm">
                    <div>
                      <p className="text-caption text-text-tertiary">Games</p>
                      <p className="text-text-primary font-medium">{developer.game_count}</p>
                    </div>
                    <div>
                      <p className="text-caption text-text-tertiary">Owners</p>
                      <p className="text-text-primary">{formatOwners(developer.total_owners_min, developer.total_owners_max)}</p>
                    </div>
                    <div>
                      <p className="text-caption text-text-tertiary">Peak CCU</p>
                      <p className="text-text-primary">{formatCompactNumber(developer.total_ccu_peak)}</p>
                    </div>
                    <div>
                      <p className="text-caption text-text-tertiary">Review Score</p>
                      {developer.weighted_review_score !== null ? (
                        <ReviewScoreBadge score={developer.weighted_review_score} />
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto scrollbar-thin rounded-lg border border-border-subtle">
            <table className="w-full">
              <thead className="bg-surface-elevated sticky top-0 z-10">
                <tr>
                  <SortHeader field="name" label="Name" currentSort={sort} currentOrder={order} searchParams={currentParams} className="min-w-[200px]" />
                  <SortHeader field="game_count" label="Games" currentSort={sort} currentOrder={order} searchParams={currentParams} />
                  <SortHeader field="total_owners_max" label="Owners" currentSort={sort} currentOrder={order} searchParams={currentParams} />
                  <SortHeader field="total_ccu_peak" label="Peak CCU" currentSort={sort} currentOrder={order} searchParams={currentParams} />
                  <SortHeader field="weighted_review_score" label="Reviews" currentSort={sort} currentOrder={order} searchParams={currentParams} />
                  <SortHeader field="estimated_revenue_usd" label="Est. Revenue" currentSort={sort} currentOrder={order} searchParams={currentParams} />
                  <SortHeader field="games_trending_up" label="Trending" currentSort={sort} currentOrder={order} searchParams={currentParams} />
                  <th className="px-3 py-2 text-left text-caption font-medium text-text-tertiary">Steam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {developers.map((developer) => (
                  <tr key={developer.id} className="bg-surface-raised hover:bg-surface-elevated transition-colors">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/developers/${developer.id}`}
                          className="text-body font-medium text-text-primary hover:text-accent-blue transition-colors"
                        >
                          {developer.name}
                        </Link>
                        {developer.game_count >= 5 && (
                          <span className="px-1.5 py-0.5 rounded text-caption bg-accent-cyan/15 text-accent-cyan">
                            Prolific
                          </span>
                        )}
                        {developer.games_released_last_year > 0 && (
                          <TierBadge tier="active" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-body-sm text-text-secondary">
                      {developer.game_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-body-sm text-text-secondary">
                      {formatOwners(developer.total_owners_min, developer.total_owners_max)}
                    </td>
                    <td className="px-4 py-3 text-body-sm text-text-secondary">
                      {formatCompactNumber(developer.total_ccu_peak)}
                    </td>
                    <td className="px-3 py-2">
                      {developer.weighted_review_score !== null ? (
                        <ReviewScoreBadge score={developer.weighted_review_score} />
                      ) : (
                        <span className="text-text-muted text-body-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-body-sm text-text-secondary">
                      {formatRevenue(developer.estimated_revenue_usd)}
                    </td>
                    <td className="px-3 py-2">
                      <TrendingBadge up={developer.games_trending_up} down={developer.games_trending_down} />
                    </td>
                    <td className="px-3 py-2">
                      {developer.steam_vanity_url ? (
                        <a
                          href={`https://store.steampowered.com/developer/${developer.steam_vanity_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-body-sm text-accent-blue hover:text-accent-blue/80 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          View
                        </a>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {developers.length === 100 && (
        <p className="mt-4 text-center text-body-sm text-text-tertiary">
          Showing first 100 results. Use filters to narrow down.
        </p>
      )}

      {developers[0]?.computed_at && (
        <p className="mt-2 text-center text-caption text-text-muted">
          Metrics last updated: {new Date(developers[0].computed_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
