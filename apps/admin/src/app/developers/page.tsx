import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import Link from 'next/link';
import { PageHeader } from '@/components/layout';
import { MetricCard } from '@/components/data-display';
import { Card } from '@/components/ui';
import { Users, Layers, TrendingUp, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

type SortField = 'name' | 'game_count' | 'first_game_release_date';
type SortOrder = 'asc' | 'desc';

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

async function getDevelopers(search?: string, sort: SortField = 'game_count', order: SortOrder = 'desc', filter?: string): Promise<Developer[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }
  const supabase = getSupabase();

  let query = supabase
    .from('developers')
    .select('*')
    .limit(100);

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  if (filter === 'prolific') {
    query = query.gte('game_count', 5);
  } else if (filter === 'recent') {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    query = query.gte('first_game_release_date', oneYearAgo.toISOString().split('T')[0]);
  }

  query = query.order(sort, { ascending: order === 'asc' });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching developers:', error);
    return [];
  }

  return data ?? [];
}

async function getDeveloperCount() {
  if (!isSupabaseConfigured()) {
    return 0;
  }
  const supabase = getSupabase();
  const { count } = await supabase
    .from('developers')
    .select('*', { count: 'exact', head: true });
  return count ?? 0;
}

async function getDeveloperStats() {
  if (!isSupabaseConfigured()) {
    return { total: 0, prolific: 0, recentlyActive: 0 };
  }
  const supabase = getSupabase();

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const [totalResult, prolificResult, recentResult] = await Promise.all([
    supabase.from('developers').select('*', { count: 'exact', head: true }),
    supabase.from('developers').select('*', { count: 'exact', head: true }).gte('game_count', 5),
    supabase.from('developers').select('*', { count: 'exact', head: true }).gte('first_game_release_date', oneYearAgo.toISOString().split('T')[0]),
  ]);

  return {
    total: totalResult.count ?? 0,
    prolific: prolificResult.count ?? 0,
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

export default async function DevelopersPage({
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

  const [developers, totalCount, stats] = await Promise.all([
    getDevelopers(search, sort, order, filter),
    getDeveloperCount(),
    getDeveloperStats(),
  ]);

  return (
    <div>
      <PageHeader
        title="Developers"
        description={`Browse Steam developers (${totalCount.toLocaleString()} total)`}
      />

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total developers"
          value={stats.total}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          label="Prolific developers (5+ games)"
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
        <div className="flex gap-2">
          <Link
            href="/developers"
            className={`px-3 py-2 rounded-md text-body-sm font-medium transition-colors ${
              !filter
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
            href="/developers?filter=recent"
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

      {developers.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-surface-overlay flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-text-tertiary" />
          </div>
          <h3 className="text-subheading text-text-primary">No developers found</h3>
          <p className="mt-2 text-body-sm text-text-secondary">
            {search
              ? 'Try a different search term'
              : 'Run the Storefront sync to populate developers'}
          </p>
        </Card>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {developers.map((developer) => (
              <Link key={developer.id} href={`/developers/${developer.id}`}>
                <Card variant="interactive" className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="text-body font-medium text-text-primary">
                      {developer.name}
                    </span>
                    {developer.game_count >= 5 && (
                      <span className="px-1.5 py-0.5 rounded text-caption bg-accent-cyan/15 text-accent-cyan">
                        Prolific
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-body-sm">
                    <span className="text-text-secondary">
                      <span className="font-medium text-text-primary">{developer.game_count}</span> games
                    </span>
                    {developer.first_game_release_date && (
                      <span className="text-text-tertiary">
                        Since {new Date(developer.first_game_release_date).getFullYear()}
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
                {developers.map((developer) => (
                  <tr key={developer.id} className="bg-surface-raised hover:bg-surface-elevated transition-colors">
                    <td className="px-4 py-3">
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
                      </div>
                    </td>
                    <td className="px-4 py-3 text-body-sm text-text-secondary">
                      {developer.game_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-body-sm text-text-tertiary">
                      {developer.first_game_release_date
                        ? new Date(developer.first_game_release_date).getFullYear()
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
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
          Showing first 100 results. Use search to find specific developers.
        </p>
      )}
    </div>
  );
}
