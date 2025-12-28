import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function getPublishers(search?: string) {
  const supabase = getSupabase();
  let query = supabase
    .from('publishers')
    .select('*')
    .order('game_count', { ascending: false })
    .limit(100);

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching publishers:', error);
    return [];
  }

  return data ?? [];
}

async function getPublisherCount() {
  const supabase = getSupabase();
  const { count } = await supabase
    .from('publishers')
    .select('*', { count: 'exact', head: true });
  return count ?? 0;
}

export default async function PublishersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const [publishers, totalCount] = await Promise.all([
    getPublishers(search),
    getPublisherCount(),
  ]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Publishers</h1>
        <p className="mt-2 text-gray-400">
          Browse Steam publishers ({totalCount.toLocaleString()} total)
        </p>
      </div>

      {/* Search */}
      <form className="mb-6">
        <div className="relative">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search publishers by name..."
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 pl-10 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-3.5 h-5 w-5 text-gray-500"
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

      {publishers.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-white">No publishers found</h3>
          <p className="mt-2 text-gray-400">
            {search
              ? 'Try a different search term'
              : 'Run the Storefront sync to populate publishers'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {publishers.map((publisher) => (
            <div
              key={publisher.id}
              className="rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700"
            >
              <h3 className="font-medium text-white">{publisher.name}</h3>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <span className="text-gray-400">
                  <span className="font-medium text-white">{publisher.game_count}</span>{' '}
                  games
                </span>
                {publisher.first_game_release_date && (
                  <span className="text-gray-500">
                    Since {new Date(publisher.first_game_release_date).getFullYear()}
                  </span>
                )}
              </div>
              {publisher.steam_vanity_url && (
                <a
                  href={`https://store.steampowered.com/publisher/${publisher.steam_vanity_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center text-sm text-blue-400 hover:text-blue-300"
                >
                  View on Steam
                  <svg
                    className="ml-1 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {publishers.length === 100 && (
        <p className="mt-4 text-center text-sm text-gray-500">
          Showing top 100 publishers by game count. Use search to find specific publishers.
        </p>
      )}
    </div>
  );
}
