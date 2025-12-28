import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function getJobs() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('sync_jobs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(100);

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

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return 'Running...';

  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const durationMs = end - start;

  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
  return `${(durationMs / 60000).toFixed(1)}m`;
}

export default async function JobsPage() {
  const jobs = await getJobs();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Sync Jobs</h1>
        <p className="mt-2 text-gray-400">
          View history of all data synchronization jobs
        </p>
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
          <h3 className="mt-4 text-lg font-medium text-white">No sync jobs yet</h3>
          <p className="mt-2 text-gray-400">
            Trigger a GitHub Action workflow to start syncing data from Steam.
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
                    {formatDuration(job.started_at, job.completed_at)}
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
                  <pre className="mt-2 overflow-x-auto text-sm text-red-300">
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
