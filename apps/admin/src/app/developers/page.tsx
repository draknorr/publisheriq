import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function getDevelopers(search?: string) {
  const supabase = getSupabase();
  let query = supabase
    .from('developers')
    .select('*')
    .order('game_count', { ascending: false })
    .limit(100);

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching developers:', error);
    return [];
  }

  return data ?? [];
}

async function getDeveloperCount() {
  const supabase = getSupabase();
  const { count } = await supabase
    .from('developers')
    .select('*', { count: 'exact', head: true });
  return count ?? 0;
}

export default async function DevelopersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const [developers, totalCount] = await Promise.all([
    getDevelopers(search),
    getDeveloperCount(),
  ]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Developers</h1>
        <p className="mt-2 text-gray-400">
          Browse Steam developers ({totalCount.toLocaleString()} total)
        </p>
      </div>

      {/* Search */}
      <form className="mb-6">
        <div className="relative">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search developers by name..."
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

      {developers.length === 0 ? (
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
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-white">No developers found</h3>
          <p className="mt-2 text-gray-400">
            {search
              ? 'Try a different search term'
              : 'Run the Storefront sync to populate developers'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {developers.map((developer) => (
            <div
              key={developer.id}
              className="rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700"
            >
              <h3 className="font-medium text-white">{developer.name}</h3>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <span className="text-gray-400">
                  <span className="font-medium text-white">{developer.game_count}</span>{' '}
                  games
                </span>
                {developer.first_game_release_date && (
                  <span className="text-gray-500">
                    Since {new Date(developer.first_game_release_date).getFullYear()}
                  </span>
                )}
              </div>
              {developer.steam_vanity_url && (
                <a
                  href={`https://store.steampowered.com/developer/${developer.steam_vanity_url}`}
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

      {developers.length === 100 && (
        <p className="mt-4 text-center text-sm text-gray-500">
          Showing top 100 developers by game count. Use search to find specific developers.
        </p>
      )}
    </div>
  );
}
