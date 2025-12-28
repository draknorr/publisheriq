import Link from 'next/link';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import { SyncHealthCards, LastSyncTimes } from '@/components/SyncHealthCards';
import {
  getSyncHealthData,
  getPriorityDistribution,
  getQueueStatus,
  getAppsWithErrors,
  getSourceCompletionStats,
  getFullyCompletedAppsCount,
  formatRelativeTime,
  formatDuration,
  type PriorityDistribution,
  type QueueStatus,
  type AppWithError,
  type SourceCompletionStats,
} from '@/lib/sync-queries';

export const dynamic = 'force-dynamic';

async function getSyncStatusData() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const supabase = getSupabase();

  const [
    syncHealth,
    priorityDistribution,
    queueStatus,
    appsWithErrors,
    completionStats,
    fullyCompletedCount,
    runningJobs,
    recentJobs,
  ] = await Promise.all([
    getSyncHealthData(supabase),
    getPriorityDistribution(supabase),
    getQueueStatus(supabase),
    getAppsWithErrors(supabase, 20),
    getSourceCompletionStats(supabase),
    getFullyCompletedAppsCount(supabase),
    supabase
      .from('sync_jobs')
      .select('*')
      .eq('status', 'running')
      .order('started_at', { ascending: false }),
    supabase
      .from('sync_jobs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10),
  ]);

  return {
    syncHealth,
    priorityDistribution,
    queueStatus,
    appsWithErrors,
    completionStats,
    fullyCompletedCount,
    runningJobs: runningJobs.data ?? [],
    recentJobs: recentJobs.data ?? [],
  };
}

function PriorityBar({
  label,
  count,
  total,
  color,
  interval,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  interval: string;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="flex items-center gap-4">
      <div className="w-32 text-sm font-medium text-gray-300">{label}</div>
      <div className="flex-1">
        <div className="h-6 w-full overflow-hidden rounded-full bg-gray-800">
          <div
            className={`h-full ${color} transition-all duration-500`}
            style={{ width: `${Math.max(percentage, 1)}%` }}
          />
        </div>
      </div>
      <div className="w-24 text-right text-sm text-gray-400">
        {count.toLocaleString()} apps
      </div>
      <div className="w-20 text-right text-xs text-gray-500">{interval}</div>
    </div>
  );
}

function PriorityDistributionCard({ data }: { data: PriorityDistribution }) {
  const total = data.high + data.medium + data.normal + data.low + data.minimal;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <h3 className="mb-4 text-lg font-semibold text-white">Priority Score Distribution</h3>
      <p className="mb-6 text-sm text-gray-400">
        Apps are prioritized based on popularity, review activity, and trends. Higher priority apps sync more frequently.
      </p>
      <div className="space-y-3">
        <PriorityBar
          label="High (150+)"
          count={data.high}
          total={total}
          color="bg-red-500"
          interval="6hr"
        />
        <PriorityBar
          label="Medium (100-149)"
          count={data.medium}
          total={total}
          color="bg-orange-500"
          interval="12hr"
        />
        <PriorityBar
          label="Normal (50-99)"
          count={data.normal}
          total={total}
          color="bg-yellow-500"
          interval="24hr"
        />
        <PriorityBar
          label="Low (25-49)"
          count={data.low}
          total={total}
          color="bg-blue-500"
          interval="48hr"
        />
        <PriorityBar
          label="Minimal (&lt;25)"
          count={data.minimal}
          total={total}
          color="bg-gray-600"
          interval="weekly"
        />
      </div>
      <div className="mt-4 border-t border-gray-800 pt-4">
        <p className="text-sm text-gray-500">
          Total syncable apps: <span className="font-medium text-white">{total.toLocaleString()}</span>
        </p>
      </div>
    </div>
  );
}

function QueueStatusCard({ data }: { data: QueueStatus }) {
  const items = [
    { label: 'Overdue', count: data.overdue, color: 'text-red-400', bgColor: 'bg-red-500/10' },
    { label: 'Due < 1 hour', count: data.dueIn1Hour, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
    { label: 'Due < 6 hours', count: data.dueIn6Hours, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
    { label: 'Due < 24 hours', count: data.dueIn24Hours, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  ];

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <h3 className="mb-4 text-lg font-semibold text-white">Sync Queue Status</h3>
      <p className="mb-6 text-sm text-gray-400">
        Apps waiting to be synced based on their scheduled sync time.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.label}
            className={`rounded-lg ${item.bgColor} p-4`}
          >
            <p className="text-sm text-gray-400">{item.label}</p>
            <p className={`mt-1 text-2xl font-bold ${item.color}`}>
              {item.count.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-gray-500">apps waiting</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorReportCard({ apps }: { apps: AppWithError[] }) {
  if (apps.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
        <h3 className="mb-4 text-lg font-semibold text-white">Apps with Sync Errors</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 text-green-400">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-gray-400">No sync errors</p>
          <p className="mt-1 text-sm text-gray-500">All apps are syncing successfully</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Apps with Sync Errors</h3>
        <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-medium text-red-400">
          {apps.length} apps
        </span>
      </div>
      <p className="mb-6 text-sm text-gray-400">
        Apps that have failed to sync multiple times in a row.
      </p>
      <div className="overflow-hidden rounded-lg border border-gray-800">
        <table className="w-full">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                App
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                Errors
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                Source
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                Last Error
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {apps.map((app) => (
              <tr key={app.appid} className="hover:bg-gray-800/30">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">{app.name}</p>
                    <p className="text-xs text-gray-500">ID: {app.appid}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-medium text-red-400">
                    {app.consecutive_errors}x
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {app.last_error_source ?? '-'}
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="max-w-xs truncate text-sm text-gray-300" title={app.last_error_message ?? ''}>
                      {app.last_error_message ?? '-'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatRelativeTime(app.last_error_at)}
                    </p>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const sourceLabels: Record<string, string> = {
  steamspy: 'SteamSpy',
  storefront: 'Storefront',
  reviews: 'Reviews',
  histogram: 'Histogram',
  page_creation: 'Page Creation',
};

const sourceIcons: Record<string, string> = {
  steamspy: '📊',
  storefront: '🏪',
  reviews: '⭐',
  histogram: '📈',
  page_creation: '📅',
};

function CompletionProgressBar({ stats }: { stats: SourceCompletionStats }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{sourceIcons[stats.source]}</span>
          <span className="text-sm font-medium text-white">
            {sourceLabels[stats.source]}
          </span>
        </div>
        <span className="text-sm text-gray-400">
          {stats.completionPercent.toFixed(1)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-800 mb-3">
        <div
          className={`h-full transition-all duration-500 ${
            stats.completionPercent >= 100
              ? 'bg-green-500'
              : stats.completionPercent >= 50
              ? 'bg-blue-500'
              : 'bg-orange-500'
          }`}
          style={{ width: `${Math.min(stats.completionPercent, 100)}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-green-400">
          {stats.syncedApps.toLocaleString()} synced
        </span>
        <span className="text-gray-500">
          {stats.neverSynced.toLocaleString()} remaining
        </span>
        {stats.staleApps > 0 && (
          <span className="text-orange-400">
            {stats.staleApps.toLocaleString()} stale
          </span>
        )}
      </div>

      {/* Last sync time */}
      {stats.lastSyncTime && (
        <div className="mt-2 text-xs text-gray-500">
          Last job: {formatRelativeTime(stats.lastSyncTime)}
        </div>
      )}
    </div>
  );
}

function FirstPassCompletionCard({
  completionStats,
  fullyCompletedCount,
}: {
  completionStats: SourceCompletionStats[];
  fullyCompletedCount: number;
}) {
  const totalApps = completionStats[0]?.totalApps ?? 0;
  const overallPercent = totalApps > 0 ? (fullyCompletedCount / totalApps) * 100 : 0;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <h3 className="mb-4 text-lg font-semibold text-white">First-Pass Completion</h3>
      <p className="mb-6 text-sm text-gray-400">
        Progress toward having all apps synced at least once from each data source.
      </p>

      {/* Overall progress */}
      <div className="mb-6 p-4 rounded-lg bg-gray-800/50">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-2xl font-bold text-white">
              {fullyCompletedCount.toLocaleString()} / {totalApps.toLocaleString()}
            </p>
            <p className="text-sm text-gray-400">Apps with complete data (all sources)</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-400">
              {overallPercent.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-400">Overall</p>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="h-4 w-full overflow-hidden rounded-full bg-gray-700">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
            style={{ width: `${Math.min(overallPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Per-source progress */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {completionStats.map((stats) => (
          <CompletionProgressBar key={stats.source} stats={stats} />
        ))}
      </div>
    </div>
  );
}

interface SyncJob {
  id: string;
  job_type: string;
  status: string;
  items_processed: number | null;
  items_succeeded: number | null;
  items_failed: number | null;
  started_at: string;
  completed_at: string | null;
}

function RunningJobsCard({ jobs }: { jobs: SyncJob[] }) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-gray-500" />
          <span className="text-gray-400">No jobs currently running</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-white font-medium">
          {jobs.length} job{jobs.length > 1 ? 's' : ''} running
        </span>
      </div>
      <div className="space-y-2">
        {jobs.map((job) => (
          <div key={job.id} className="flex items-center justify-between text-sm">
            <span className="text-gray-400">{job.job_type}</span>
            <span className="text-blue-400">
              {job.items_processed ?? 0} processed
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentJobsTable({ jobs }: { jobs: SyncJob[] }) {
  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Recent Jobs</h3>
        <Link
          href="/jobs"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          View all jobs →
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-800">
        <table className="w-full">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">Progress</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">Duration</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">Started</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-800/30">
                <td className="px-4 py-3 text-sm font-medium text-white">{job.job_type}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      job.status === 'completed'
                        ? 'bg-green-500/20 text-green-400'
                        : job.status === 'running'
                        ? 'bg-blue-500/20 text-blue-400'
                        : job.status === 'failed'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}
                  >
                    {job.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="text-green-400">{job.items_succeeded ?? 0}</span>
                  <span className="text-gray-500"> / {job.items_processed ?? 0}</span>
                  {(job.items_failed ?? 0) > 0 && (
                    <span className="text-red-400 ml-1">({job.items_failed} failed)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {job.completed_at
                    ? formatDuration(new Date(job.completed_at).getTime() - new Date(job.started_at).getTime())
                    : 'Running...'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {formatRelativeTime(job.started_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function SyncStatusPage() {
  const data = await getSyncStatusData();

  if (!data) {
    return <ConfigurationRequired />;
  }

  const {
    syncHealth,
    priorityDistribution,
    queueStatus,
    appsWithErrors,
    completionStats,
    fullyCompletedCount,
    runningJobs,
    recentJobs,
  } = data;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Sync Status</h1>
        <p className="mt-2 text-gray-400">
          Monitor data synchronization health, completion progress, and errors
        </p>
      </div>

      {/* Running Jobs Indicator */}
      <div className="mb-8">
        <RunningJobsCard jobs={runningJobs} />
      </div>

      {/* First-Pass Completion */}
      <div className="mb-8">
        <FirstPassCompletionCard
          completionStats={completionStats}
          fullyCompletedCount={fullyCompletedCount}
        />
      </div>

      {/* Health Overview */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-white">Health Overview</h2>
        <SyncHealthCards data={syncHealth} />
        <div className="mt-4">
          <LastSyncTimes lastSyncs={syncHealth.lastSyncs} />
        </div>
      </div>

      {/* Priority & Queue */}
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <PriorityDistributionCard data={priorityDistribution} />
        <QueueStatusCard data={queueStatus} />
      </div>

      {/* Error Report */}
      <div className="mb-8">
        <ErrorReportCard apps={appsWithErrors} />
      </div>

      {/* Recent Jobs */}
      <div className="mb-8">
        <RecentJobsTable jobs={recentJobs} />
      </div>

      {/* Quick Links */}
      <div className="flex items-center justify-center gap-4">
        <Link
          href="/jobs"
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          View All Sync Jobs
          <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
