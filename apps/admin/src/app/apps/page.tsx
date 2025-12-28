import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function getApps(search?: string) {
  const supabase = getSupabase();
  let query = supabase
    .from('apps')
    .select('*')
    .order('appid', { ascending: true })
    .limit(100);

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching apps:', error);
    return [];
  }

  return data ?? [];
}

async function getAppCount() {
  const supabase = getSupabase();
  const { count } = await supabase
    .from('apps')
    .select('*', { count: 'exact', head: true });
  return count ?? 0;
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    game: 'bg-purple-500/20 text-purple-400',
    dlc: 'bg-blue-500/20 text-blue-400',
    demo: 'bg-cyan-500/20 text-cyan-400',
    mod: 'bg-orange-500/20 text-orange-400',
    video: 'bg-pink-500/20 text-pink-400',
  };

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colors[type] ?? 'bg-gray-500/20 text-gray-400'}`}
    >
      {type}
    </span>
  );
}

export default async function AppsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const [apps, totalCount] = await Promise.all([
    getApps(search),
    getAppCount(),
  ]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Apps</h1>
        <p className="mt-2 text-gray-400">
          Browse and search Steam applications ({totalCount.toLocaleString()} total)
        </p>
      </div>

      {/* Search */}
      <form className="mb-6">
        <div className="relative">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search apps by name..."
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

      {apps.length === 0 ? (
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
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-white">No apps found</h3>
          <p className="mt-2 text-gray-400">
            {search
              ? 'Try a different search term'
              : 'Run the App List sync to populate apps'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-800">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                  App ID
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                  Release Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                  Price
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                  Workshop
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {apps.map((app) => (
                <tr key={app.appid} className="bg-gray-900/50 hover:bg-gray-900">
                  <td className="px-4 py-3">
                    <a
                      href={`https://store.steampowered.com/app/${app.appid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-blue-400 hover:text-blue-300"
                    >
                      {app.appid}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-white">
                      {app.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={app.type} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {app.release_date
                      ? new Date(app.release_date).toLocaleDateString()
                      : app.release_date_raw ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {app.is_free
                      ? 'Free'
                      : app.current_price_cents
                        ? `$${(app.current_price_cents / 100).toFixed(2)}`
                        : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {app.has_workshop ? (
                      <span className="text-green-400">Yes</span>
                    ) : (
                      <span className="text-gray-600">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {apps.length === 100 && (
        <p className="mt-4 text-center text-sm text-gray-500">
          Showing first 100 results. Use search to find specific apps.
        </p>
      )}
    </div>
  );
}
