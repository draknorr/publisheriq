import Link from 'next/link';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import { formatDuration } from '@/lib/sync-queries';

export const dynamic = 'force-dynamic';

const JOB_TYPES = ['all', 'steamspy', 'storefront', 'reviews', 'histogram', 'priority', 'applist'] as const;

async function getJobs(filter?: string) {
  if (!isSupabaseConfigured()) {
    return [];
  }
  const supabase = getSupabase();
  let query = supabase
    .from('sync_jobs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(100);

  if (filter && filter !== 'all') {
    query = query.ilike('job_type', `%${filter}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }

  return data ?? [];
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}
    >
      {status}
    </span>
  );
}

function formatJobDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return 'Running...';

  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const durationMs = end - start;

  return formatDuration(durationMs);
}

function JobTypeFilter({ selected }: { selected: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {JOB_TYPES.map((type) => (
        <Link
          key={type}
          href={type === 'all' ? '/jobs' : `/jobs?filter=${type}`}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            selected === type
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
          }`}
        >
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </Link>
      ))}
    </div>
  );
}

interface JobStats {
  total: number;
  completed: number;
  failed: number;
  running: number;
  avgDurationMs: number | null;
}

function calculateJobStats(jobs: Array<{ status: string; started_at: string; completed_at: string | null }>): JobStats {
  const completed = jobs.filter(j => j.status === 'completed');
  const failed = jobs.filter(j => j.status === 'failed');
  const running = jobs.filter(j => j.status === 'running');

  const durations = completed
    .filter(j => j.completed_at)
    .map(j => new Date(j.completed_at!).getTime() - new Date(j.started_at).getTime());

  const avgDurationMs = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : null;

  return {
    total: jobs.length,
    completed: completed.length,
    failed: failed.length,
    running: running.length,
    avgDurationMs,
  };
}

function JobStatsBar({ stats }: { stats: JobStats }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
      <span className="text-sm text-gray-400">
        <span className="font-medium text-white">{stats.total}</span> jobs
      </span>
      <span className="text-gray-700">|</span>
      <span className="text-sm">
        <span className="font-medium text-green-400">{stats.completed}</span>
        <span className="text-gray-400"> completed</span>
      </span>
      {stats.failed > 0 && (
        <>
          <span className="text-gray-700">|</span>
          <span className="text-sm">
            <span className="font-medium text-red-400">{stats.failed}</span>
            <span className="text-gray-400"> failed</span>
          </span>
        </>
      )}
      {stats.running > 0 && (
        <>
          <span className="text-gray-700">|</span>
          <span className="text-sm">
            <span className="font-medium text-blue-400">{stats.running}</span>
            <span className="text-gray-400"> running</span>
          </span>
        </>
      )}
      {stats.avgDurationMs && (
        <>
          <span className="text-gray-700">|</span>
          <span className="text-sm text-gray-400">
            Avg: <span className="font-medium text-white">{formatDuration(stats.avgDurationMs)}</span>
          </span>
        </>
      )}
    </div>
  );
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />;
  }

  const { filter = 'all' } = await searchParams;
  const jobs = await getJobs(filter);
  const stats = calculateJobStats(jobs);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Sync Jobs</h1>
        <p className="mt-2 text-gray-400">
          View history of all data synchronization jobs
        </p>
      </div>

      {/* Filter and Stats */}
      <div className="mb-6 space-y-4">
        <JobTypeFilter selected={filter} />
        {jobs.length > 0 && <JobStatsBar stats={stats} />}
      </div>

      {jobs.length === 0 ? (
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
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-white">
            {filter === 'all' ? 'No sync jobs yet' : `No ${filter} jobs found`}
          </h3>
          <p className="mt-2 text-gray-400">
            {filter === 'all'
              ? 'Trigger a GitHub Action workflow to start syncing data from Steam.'
              : 'Try a different filter or wait for jobs to run.'}
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
                  Progress
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                  Started
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                  GitHub Run
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {jobs.map((job) => (
                <tr key={job.id} className="bg-gray-900/50 hover:bg-gray-900">
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-white">
                      {job.job_type}
                    </span>
                    {job.batch_size && (
                      <span className="ml-2 text-xs text-gray-500">
                        (batch: {job.batch_size})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-green-400">
                        {job.items_succeeded}
                      </span>
                      <span className="text-gray-600">/</span>
                      <span className="text-sm text-gray-300">
                        {job.items_processed}
                      </span>
                      {job.items_failed > 0 && (
                        <span className="text-sm text-red-400">
                          ({job.items_failed} failed)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {formatJobDuration(job.started_at, job.completed_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {new Date(job.started_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {job.github_run_id ? (
                      <a
                        href={`https://github.com/draknorr/publisheriq/actions/runs/${job.github_run_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        #{job.github_run_id.slice(-8)}
                      </a>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Error details for failed jobs */}
      {jobs.some((j) => j.status === 'failed' && j.error_message) && (
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-semibold text-white">Failed Job Details</h2>
          <div className="space-y-4">
            {jobs
              .filter((j) => j.status === 'failed' && j.error_message)
              .map((job) => (
                <div
                  key={job.id}
                  className="rounded-lg border border-red-900/50 bg-red-950/20 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-red-400">{job.job_type}</span>
                    <span className="text-sm text-gray-500">
                      {new Date(job.started_at).toLocaleString()}
                    </span>
                  </div>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-sm text-red-300">
                    {job.error_message}
                  </pre>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
