'use client';

import { useState } from 'react';
import { SyncHealthCards, LastSyncTimes } from '@/components/SyncHealthCards';
import {
  formatRelativeTime,
  formatDuration,
  type PriorityDistribution,
  type QueueStatus,
  type AppWithError,
  type SourceCompletionStats,
} from '@/lib/sync-queries';
import type { AdminDashboardData, SyncJob } from './page';

const JOB_TYPES = ['all', 'steamspy', 'storefront', 'reviews', 'histogram', 'priority', 'applist'] as const;

// ============================================
// Sync Health Tab Components
// ============================================

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
        <PriorityBar label="High (150+)" count={data.high} total={total} color="bg-red-500" interval="6hr" />
        <PriorityBar label="Medium (100-149)" count={data.medium} total={total} color="bg-orange-500" interval="12hr" />
        <PriorityBar label="Normal (50-99)" count={data.normal} total={total} color="bg-yellow-500" interval="24hr" />
        <PriorityBar label="Low (25-49)" count={data.low} total={total} color="bg-blue-500" interval="48hr" />
        <PriorityBar label="Minimal (<25)" count={data.minimal} total={total} color="bg-gray-600" interval="weekly" />
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
          <div key={item.label} className={`rounded-lg ${item.bgColor} p-4`}>
            <p className="text-sm text-gray-400">{item.label}</p>
            <p className={`mt-1 text-2xl font-bold ${item.color}`}>{item.count.toLocaleString()}</p>
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
      <p className="mb-6 text-sm text-gray-400">Apps that have failed to sync multiple times in a row.</p>
      <div className="overflow-hidden rounded-lg border border-gray-800">
        <table className="w-full">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">App</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">Errors</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">Source</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">Last Error</th>
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
                <td className="px-4 py-3 text-sm text-gray-400">{app.last_error_source ?? '-'}</td>
                <td className="px-4 py-3">
                  <div>
                    <p className="max-w-xs truncate text-sm text-gray-300" title={app.last_error_message ?? ''}>
                      {app.last_error_message ?? '-'}
                    </p>
                    <p className="text-xs text-gray-500">{formatRelativeTime(app.last_error_at)}</p>
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
          <span className="text-sm font-medium text-white">{sourceLabels[stats.source]}</span>
        </div>
        <span className="text-sm text-gray-400">{stats.completionPercent.toFixed(1)}%</span>
      </div>
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
      <div className="flex items-center justify-between text-xs">
        <span className="text-green-400">{stats.syncedApps.toLocaleString()} synced</span>
        <span className="text-gray-500">{stats.neverSynced.toLocaleString()} remaining</span>
        {stats.staleApps > 0 && <span className="text-orange-400">{stats.staleApps.toLocaleString()} stale</span>}
      </div>
      {stats.lastSyncTime && (
        <div className="mt-2 text-xs text-gray-500">Last job: {formatRelativeTime(stats.lastSyncTime)}</div>
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
      <div className="mb-6 p-4 rounded-lg bg-gray-800/50">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-2xl font-bold text-white">
              {fullyCompletedCount.toLocaleString()} / {totalApps.toLocaleString()}
            </p>
            <p className="text-sm text-gray-400">Apps with complete data (all sources)</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-400">{overallPercent.toFixed(1)}%</p>
            <p className="text-sm text-gray-400">Overall</p>
          </div>
        </div>
        <div className="h-4 w-full overflow-hidden rounded-full bg-gray-700">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
            style={{ width: `${Math.min(overallPercent, 100)}%` }}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {completionStats.map((stats) => (
          <CompletionProgressBar key={stats.source} stats={stats} />
        ))}
      </div>
    </div>
  );
}

function RunningJobsCard({ jobs, isExpanded, onToggle }: { jobs: SyncJob[]; isExpanded: boolean; onToggle: () => void }) {
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
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-blue-500/10 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-white font-medium">
            {jobs.length} job{jobs.length > 1 ? 's' : ''} running
          </span>
        </div>
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-blue-500/20 pt-3">
          {jobs.map((job) => (
            <div key={job.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{job.job_type}</span>
              <span className="text-blue-400">{job.items_processed ?? 0} processed</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Job History Tab Components
// ============================================

function formatDateTime(timestamp: string | null): string {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString();
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

interface JobStats {
  total: number;
  completed: number;
  failed: number;
  running: number;
  avgDurationMs: number | null;
}

function calculateJobStats(jobs: SyncJob[]): JobStats {
  const completed = jobs.filter((j) => j.status === 'completed');
  const failed = jobs.filter((j) => j.status === 'failed');
  const running = jobs.filter((j) => j.status === 'running');

  const durations = completed
    .filter((j) => j.completed_at)
    .map((j) => new Date(j.completed_at!).getTime() - new Date(j.started_at).getTime());

  const avgDurationMs = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

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

function ExpandableJobRow({ job, isExpanded, onToggle }: { job: SyncJob; isExpanded: boolean; onToggle: () => void }) {
  const duration = job.completed_at
    ? formatDuration(new Date(job.completed_at).getTime() - new Date(job.started_at).getTime())
    : 'Running...';

  return (
    <>
      <tr
        className="bg-gray-900/50 hover:bg-gray-900 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <svg
              className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-sm font-medium text-white">{job.job_type}</span>
            {job.batch_size && (
              <span className="text-xs text-gray-500">(batch: {job.batch_size})</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={job.status} />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-green-400">{job.items_succeeded ?? 0}</span>
            <span className="text-gray-600">/</span>
            <span className="text-sm text-gray-300">{job.items_processed ?? 0}</span>
            {(job.items_failed ?? 0) > 0 && (
              <span className="text-sm text-red-400">({job.items_failed} failed)</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-400">{duration}</td>
        <td className="px-4 py-3 text-sm text-gray-500">{formatRelativeTime(job.started_at)}</td>
      </tr>
      {isExpanded && (
        <tr className="bg-gray-800/20">
          <td colSpan={5} className="px-4 py-4">
            <div className="pl-6 space-y-3">
              {/* Time details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Started:</span>
                  <span className="ml-2 text-gray-300">{formatDateTime(job.started_at)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Completed:</span>
                  <span className="ml-2 text-gray-300">{formatDateTime(job.completed_at)}</span>
                </div>
              </div>

              {/* Batch size */}
              {job.batch_size !== null && (
                <div className="text-sm">
                  <span className="text-gray-500">Batch size:</span>
                  <span className="ml-2 text-gray-300">{job.batch_size}</span>
                </div>
              )}

              {/* Processing stats */}
              <div className="text-sm">
                <span className="text-gray-500">Processing:</span>
                <span className="ml-2">
                  {(job.items_created !== null || job.items_updated !== null) ? (
                    <>
                      <span className="text-blue-400">{job.items_created ?? 0} new</span>
                      <span className="text-gray-500"> | </span>
                      <span className="text-green-400">{job.items_updated ?? 0} updated</span>
                    </>
                  ) : (
                    <span className="text-green-400">{job.items_succeeded ?? 0} succeeded</span>
                  )}
                  {(job.items_failed ?? 0) > 0 && (
                    <>
                      <span className="text-gray-500"> | </span>
                      <span className="text-red-400">{job.items_failed} failed</span>
                    </>
                  )}
                  <span className="text-gray-500"> of </span>
                  <span className="text-gray-300">{job.items_processed ?? 0} processed</span>
                </span>
              </div>

              {/* Error message */}
              {job.error_message && (
                <div className="text-sm">
                  <span className="text-red-400">Error:</span>
                  <p className="mt-1 text-red-300 bg-red-500/10 rounded p-2 font-mono text-xs">
                    {job.error_message}
                  </p>
                </div>
              )}

              {/* GitHub Actions link */}
              {job.github_run_id && (
                <div className="text-sm">
                  <a
                    href={`https://github.com/draknorr/publisheriq/actions/runs/${job.github_run_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" clipRule="evenodd"/>
                    </svg>
                    View GitHub Actions Run
                  </a>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ============================================
// Main Tabbed Component
// ============================================

type TabType = 'health' | 'jobs';

export function AdminDashboardTabs({ data }: { data: AdminDashboardData }) {
  const [activeTab, setActiveTab] = useState<TabType>('health');
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [runningJobsExpanded, setRunningJobsExpanded] = useState(false);
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());

  const filteredJobs =
    jobFilter === 'all' ? data.allJobs : data.allJobs.filter((j) => j.job_type.toLowerCase().includes(jobFilter));

  const jobStats = calculateJobStats(filteredJobs);

  const toggleJobExpanded = (id: string) => {
    setExpandedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div>
      {/* Tab Navigation */}
      <div className="relative mb-8">
        <div className="flex gap-1 rounded-lg bg-gray-900/50 p-1 border border-gray-800">
          <button
            onClick={() => setActiveTab('health')}
            className={`relative flex-1 rounded-md px-6 py-3 text-sm font-medium transition-all duration-200 ${
              activeTab === 'health'
                ? 'bg-gray-800 text-white shadow-lg'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Sync Health
            </span>
            {activeTab === 'health' && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`relative flex-1 rounded-md px-6 py-3 text-sm font-medium transition-all duration-200 ${
              activeTab === 'jobs'
                ? 'bg-gray-800 text-white shadow-lg'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Job History
            </span>
            {activeTab === 'jobs' && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in duration-300">
        {activeTab === 'health' && (
          <div className="space-y-8">
            {/* Running Jobs Indicator */}
            <RunningJobsCard
              jobs={data.runningJobs}
              isExpanded={runningJobsExpanded}
              onToggle={() => setRunningJobsExpanded(!runningJobsExpanded)}
            />

            {/* First-Pass Completion */}
            <FirstPassCompletionCard
              completionStats={data.completionStats}
              fullyCompletedCount={data.fullyCompletedCount}
            />

            {/* Health Overview */}
            <div>
              <h2 className="mb-4 text-xl font-semibold text-white">Health Overview</h2>
              <SyncHealthCards data={data.syncHealth} />
              <div className="mt-4">
                <LastSyncTimes lastSyncs={data.syncHealth.lastSyncs} />
              </div>
            </div>

            {/* Priority & Queue */}
            <div className="grid gap-6 lg:grid-cols-2">
              <PriorityDistributionCard data={data.priorityDistribution} />
              <QueueStatusCard data={data.queueStatus} />
            </div>

            {/* Error Report */}
            <ErrorReportCard apps={data.appsWithErrors} />
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="space-y-6">
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {JOB_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setJobFilter(type)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    jobFilter === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {/* Stats Bar */}
            {filteredJobs.length > 0 && <JobStatsBar stats={jobStats} />}

            {/* Jobs Table */}
            {filteredJobs.length === 0 ? (
              <div className="rounded-lg border border-gray-800 bg-gray-900 p-12 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-white">
                  {jobFilter === 'all' ? 'No sync jobs yet' : `No ${jobFilter} jobs found`}
                </h3>
                <p className="mt-2 text-gray-400">
                  {jobFilter === 'all'
                    ? 'Trigger a GitHub Action workflow to start syncing data from Steam.'
                    : 'Try a different filter or wait for jobs to run.'}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-800 bg-gray-900">
                <div className="px-4 py-3 border-b border-gray-800">
                  <p className="text-sm text-gray-400">Click a row to see details including new/updated counts</p>
                </div>
                <div className="overflow-hidden">
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
                      {filteredJobs.map((job) => (
                        <ExpandableJobRow
                          key={job.id}
                          job={job}
                          isExpanded={expandedJobIds.has(job.id)}
                          onToggle={() => toggleJobExpanded(job.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
