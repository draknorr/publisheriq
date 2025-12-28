import Link from 'next/link';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import { SyncHealthCards, LastSyncTimes } from '@/components/SyncHealthCards';
import {
  getSyncHealthData,
  getPriorityDistribution,
  getQueueStatus,
  getAppsWithErrors,
  formatRelativeTime,
  type PriorityDistribution,
  type QueueStatus,
  type AppWithError,
} from '@/lib/sync-queries';

export const dynamic = 'force-dynamic';

async function getSyncStatusData() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const supabase = getSupabase();

  const [syncHealth, priorityDistribution, queueStatus, appsWithErrors] = await Promise.all([
    getSyncHealthData(supabase),
    getPriorityDistribution(supabase),
    getQueueStatus(supabase),
    getAppsWithErrors(supabase, 20),
  ]);

  return {
    syncHealth,
    priorityDistribution,
    queueStatus,
    appsWithErrors,
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

export default async function SyncStatusPage() {
  const data = await getSyncStatusData();

  if (!data) {
    return <ConfigurationRequired />;
  }

  const { syncHealth, priorityDistribution, queueStatus, appsWithErrors } = data;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Sync Status</h1>
        <p className="mt-2 text-gray-400">
          Monitor data synchronization health, queue status, and errors
        </p>
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
