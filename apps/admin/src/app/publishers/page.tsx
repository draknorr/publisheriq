import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import Link from 'next/link';
import { PageHeader } from '@/components/layout';
import { MetricCard } from '@/components/data-display';
import { Card } from '@/components/ui';
import { Building2, Layers, TrendingUp, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

type SortField = 'name' | 'game_count' | 'first_game_release_date';
type SortOrder = 'asc' | 'desc';

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

async function getPublishers(search?: string, sort: SortField = 'game_count', order: SortOrder = 'desc', filter?: string): Promise<Publisher[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }
  const supabase = getSupabase();

  let query = supabase
    .from('publishers')
    .select('*')
    .limit(100);

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  if (filter === 'major') {
    query = query.gte('game_count', 10);
  } else if (filter === 'recent') {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    query = query.gte('first_game_release_date', oneYearAgo.toISOString().split('T')[0]);
  }

  query = query.order(sort, { ascending: order === 'asc' });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching publishers:', error);
    return [];
  }

  return data ?? [];
}

async function getPublisherCount() {
  if (!isSupabaseConfigured()) {
    return 0;
  }
  const supabase = getSupabase();
  const { count } = await supabase
    .from('publishers')
    .select('*', { count: 'exact', head: true });
  return count ?? 0;
}

async function getPublisherStats() {
  if (!isSupabaseConfigured()) {
    return { total: 0, major: 0, recentlyActive: 0 };
  }
  const supabase = getSupabase();

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const [totalResult, majorResult, recentResult] = await Promise.all([
    supabase.from('publishers').select('*', { count: 'exact', head: true }),
    supabase.from('publishers').select('*', { count: 'exact', head: true }).gte('game_count', 10),
    supabase.from('publishers').select('*', { count: 'exact', head: true }).gte('first_game_release_date', oneYearAgo.toISOString().split('T')[0]),
  ]);

  return {
    total: totalResult.count ?? 0,
    major: majorResult.count ?? 0,
    recentlyActive: recentResult.count ?? 0,
  };
}

function SortHeader({
  field,
  label,
  currentSort,
  currentOrder,
  filter,
  className = '',
}: {
  field: SortField;
  label: string;
  currentSort: SortField;
  currentOrder: SortOrder;
  filter?: string;
  className?: string;
}) {
  const isActive = currentSort === field;
  const nextOrder = isActive && currentOrder === 'desc' ? 'asc' : 'desc';
  const arrow = isActive ? (currentOrder === 'asc' ? ' ↑' : ' ↓') : '';
  const filterParam = filter ? `&filter=${filter}` : '';

  return (
    <th className={`px-4 py-3 text-left text-caption font-medium text-text-secondary ${className}`}>
      <Link
        href={`?sort=${field}&order=${nextOrder}${filterParam}`}
        className={`hover:text-text-primary transition-colors ${isActive ? 'text-accent-blue' : ''}`}
      >
        {label}{arrow}
      </Link>
    </th>
  );
}

export default async function PublishersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; sort?: SortField; order?: SortOrder; filter?: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />;
  }

  const params = await searchParams;
  const { search, filter } = params;
  const sort = params.sort ?? 'game_count';
  const order = params.order ?? 'desc';

  const [publishers, totalCount, stats] = await Promise.all([
    getPublishers(search, sort, order, filter),
    getPublisherCount(),
    getPublisherStats(),
  ]);

  return (
    <div>
      <PageHeader
        title="Publishers"
        description={`Browse Steam publishers (${totalCount.toLocaleString()} total)`}
      />

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total publishers"
          value={stats.total}
          icon={<Building2 className="h-4 w-4" />}
        />
        <MetricCard
          label="Major publishers (10+ games)"
          value={stats.major}
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
              placeholder="Search publishers by name..."
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
        <div className="flex gap-2">
          <Link
            href="/publishers"
            className={`px-3 py-2 rounded-md text-body-sm font-medium transition-colors ${
              !filter
                ? 'bg-accent-blue text-white'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-overlay border border-border-subtle'
            }`}
          >
            All
          </Link>
          <Link
            href="/publishers?filter=major"
            className={`px-3 py-2 rounded-md text-body-sm font-medium transition-colors ${
              filter === 'major'
                ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-overlay border border-border-subtle'
            }`}
          >
            Major
          </Link>
          <Link
            href="/publishers?filter=recent"
            className={`px-3 py-2 rounded-md text-body-sm font-medium transition-colors ${
              filter === 'recent'
                ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-overlay border border-border-subtle'
            }`}
          >
            Recent
          </Link>
        </div>
      </div>

      {publishers.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-surface-overlay flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-text-tertiary" />
          </div>
          <h3 className="text-subheading text-text-primary">No publishers found</h3>
          <p className="mt-2 text-body-sm text-text-secondary">
            {search
              ? 'Try a different search term'
              : 'Run the Storefront sync to populate publishers'}
          </p>
        </Card>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {publishers.map((publisher) => (
              <Link key={publisher.id} href={`/publishers/${publisher.id}`}>
                <Card variant="interactive" className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="text-body font-medium text-text-primary">
                      {publisher.name}
                    </span>
                    {publisher.game_count >= 10 && (
                      <span className="px-1.5 py-0.5 rounded text-caption bg-accent-purple/15 text-accent-purple">
                        Major
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-body-sm">
                    <span className="text-text-secondary">
                      <span className="font-medium text-text-primary">{publisher.game_count}</span> games
                    </span>
                    {publisher.first_game_release_date && (
                      <span className="text-text-tertiary">
                        Since {new Date(publisher.first_game_release_date).getFullYear()}
                      </span>
                    )}
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
                  <SortHeader field="name" label="Name" currentSort={sort} currentOrder={order} filter={filter} className="min-w-[200px]" />
                  <SortHeader field="game_count" label="Games" currentSort={sort} currentOrder={order} filter={filter} />
                  <SortHeader field="first_game_release_date" label="First Release" currentSort={sort} currentOrder={order} filter={filter} />
                  <th className="px-4 py-3 text-left text-caption font-medium text-text-secondary">Steam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {publishers.map((publisher) => (
                  <tr key={publisher.id} className="bg-surface-raised hover:bg-surface-elevated transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/publishers/${publisher.id}`}
                          className="text-body font-medium text-text-primary hover:text-accent-blue transition-colors"
                        >
                          {publisher.name}
                        </Link>
                        {publisher.game_count >= 10 && (
                          <span className="px-1.5 py-0.5 rounded text-caption bg-accent-purple/15 text-accent-purple">
                            Major
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-body-sm text-text-secondary">
                      {publisher.game_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-body-sm text-text-tertiary">
                      {publisher.first_game_release_date
                        ? new Date(publisher.first_game_release_date).getFullYear()
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {publisher.steam_vanity_url ? (
                        <a
                          href={`https://store.steampowered.com/publisher/${publisher.steam_vanity_url}`}
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

      {publishers.length === 100 && (
        <p className="mt-4 text-center text-body-sm text-text-tertiary">
          Showing first 100 results. Use search to find specific publishers.
        </p>
      )}
    </div>
  );
}
