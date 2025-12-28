import Link from 'next/link';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import { SyncHealthCards, LastSyncTimes } from '@/components/SyncHealthCards';
import { getSyncHealthData } from '@/lib/sync-queries';

export const dynamic = 'force-dynamic';

async function getStats() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const supabase = getSupabase();
  const [appsResult, publishersResult, developersResult, jobsResult, syncHealth] = await Promise.all([
    supabase.from('apps').select('*', { count: 'exact', head: true }),
    supabase.from('publishers').select('*', { count: 'exact', head: true }),
    supabase.from('developers').select('*', { count: 'exact', head: true }),
    supabase
      .from('sync_jobs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(5),
    getSyncHealthData(supabase),
  ]);

  return {
    appCount: appsResult.count ?? 0,
    publisherCount: publishersResult.count ?? 0,
    developerCount: developersResult.count ?? 0,
    recentJobs: jobsResult.data ?? [],
    syncHealth,
  };
}

function StatCard({
  title,
  value,
  href,
}: {
  title: string;
  value: number | string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-gray-800 bg-gray-900 p-6 transition-colors hover:border-gray-700 hover:bg-gray-800"
    >
      <p className="text-sm font-medium text-gray-400">{title}</p>
      <p className="mt-2 text-3xl font-bold text-white">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-gray-500/20 text-gray-400'}`}
    >
      {status}
    </span>
  );
}

export default async function DashboardPage() {
  const stats = await getStats();

  if (!stats) {
    return <ConfigurationRequired />;
  }

  const { appCount, publisherCount, developerCount, recentJobs, syncHealth } = stats;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-2 text-gray-400">
          Steam data acquisition platform overview
        </p>
      </div>

      {/* Sync Health Overview */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Sync Health</h2>
          <Link
            href="/sync-status"
            className="text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            View details
          </Link>
        </div>
        <SyncHealthCards data={syncHealth} />
        <div className="mt-4">
          <LastSyncTimes lastSyncs={syncHealth.lastSyncs} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Apps" value={appCount} href="/apps" />
        <StatCard title="Publishers" value={publisherCount} href="/publishers" />
        <StatCard title="Developers" value={developerCount} href="/developers" />
        <StatCard title="Sync Jobs" value={recentJobs.length > 0 ? 'View All' : 'No Jobs'} href="/jobs" />
      </div>

      {/* Quick Links */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-white">Quick Links</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/jobs"
            className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-white">Sync Jobs</p>
              <p className="text-sm text-gray-400">View job history and status</p>
            </div>
          </Link>

          <Link
            href="/apps"
            className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-white">Browse Apps</p>
              <p className="text-sm text-gray-400">Search and explore games</p>
            </div>
          </Link>

          <Link
            href="/publishers"
            className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20 text-green-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-white">Publishers</p>
              <p className="text-sm text-gray-400">View publisher data</p>
            </div>
          </Link>

          <Link
            href="/developers"
            className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-white">Developers</p>
              <p className="text-sm text-gray-400">View developer data</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Jobs */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Recent Sync Jobs</h2>
          <Link
            href="/jobs"
            className="text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            View all
          </Link>
        </div>

        {recentJobs.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center">
            <p className="text-gray-400">No sync jobs yet</p>
            <p className="mt-2 text-sm text-gray-500">
              Run a GitHub Action workflow to start syncing data
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-800">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                    Job Type
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                    Processed
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                    Started
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {recentJobs.map((job) => (
                  <tr key={job.id} className="bg-gray-900/50">
                    <td className="px-4 py-3 text-sm font-medium text-white">
                      {job.job_type}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {job.items_succeeded}/{job.items_processed}
                      {job.items_failed > 0 && (
                        <span className="ml-1 text-red-400">
                          ({job.items_failed} failed)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(job.started_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
