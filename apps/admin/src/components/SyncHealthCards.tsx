import { SyncHealthData, formatDuration, formatRelativeTime } from '@/lib/sync-queries';

interface SyncHealthCardsProps {
  data: SyncHealthData;
}

function StatCard({
  title,
  value,
  subtitle,
  color = 'blue',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {subtitle && <p className="mt-1 text-xs opacity-60">{subtitle}</p>}
    </div>
  );
}

export function SyncHealthCards({ data }: SyncHealthCardsProps) {
  const { jobs24h, successRate7d, overdueApps, appsWithErrors } = data;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Jobs (24h)"
        value={jobs24h.total}
        subtitle={
          jobs24h.running > 0
            ? `${jobs24h.running} running`
            : jobs24h.avgDurationMs
              ? `Avg: ${formatDuration(jobs24h.avgDurationMs)}`
              : undefined
        }
        color="blue"
      />
      <StatCard
        title="Success Rate (7d)"
        value={`${successRate7d.toFixed(1)}%`}
        subtitle={`${jobs24h.completed} completed, ${jobs24h.failed} failed`}
        color={successRate7d >= 90 ? 'green' : successRate7d >= 70 ? 'yellow' : 'red'}
      />
      <StatCard
        title="Apps Overdue"
        value={overdueApps.toLocaleString()}
        subtitle="need sync now"
        color={overdueApps === 0 ? 'green' : overdueApps < 100 ? 'yellow' : 'red'}
      />
      <StatCard
        title="Apps w/ Errors"
        value={appsWithErrors.toLocaleString()}
        subtitle="consecutive failures"
        color={appsWithErrors === 0 ? 'green' : appsWithErrors < 10 ? 'yellow' : 'red'}
      />
    </div>
  );
}

export function LastSyncTimes({ lastSyncs }: { lastSyncs: SyncHealthData['lastSyncs'] }) {
  const sources = [
    { name: 'SteamSpy', time: lastSyncs.steamspy, icon: '📊' },
    { name: 'Storefront', time: lastSyncs.storefront, icon: '🏪' },
    { name: 'Reviews', time: lastSyncs.reviews, icon: '⭐' },
    { name: 'Histogram', time: lastSyncs.histogram, icon: '📈' },
  ];

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-3 text-sm font-medium text-gray-400">Last Sync by Source</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {sources.map((source) => (
          <div key={source.name} className="flex items-center gap-3">
            <span className="text-lg">{source.icon}</span>
            <div>
              <p className="text-sm font-medium text-white">{source.name}</p>
              <p className="text-xs text-gray-400">{formatRelativeTime(source.time)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
