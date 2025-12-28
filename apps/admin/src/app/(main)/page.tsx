import Link from 'next/link';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import { SyncHealthCards, LastSyncTimes } from '@/components/SyncHealthCards';
import { getSyncHealthData } from '@/lib/sync-queries';
import { PageHeader, Section, Grid } from '@/components/layout';
import { Card } from '@/components/ui';
import { Badge } from '@/components/ui/Badge';
import { RefreshCw, Gamepad2, Building2, Users, ArrowRight } from 'lucide-react';

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
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Link href={href}>
      <Card variant="interactive" className="p-5 group">
        <div className="flex items-start justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-text-secondary transition-colors" />
        </div>
        <div className="mt-4">
          <p className="text-display text-text-primary">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          <p className="text-body-sm text-text-secondary mt-1">{title}</p>
        </div>
      </Card>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'completed' ? 'success' : status === 'running' ? 'info' : status === 'failed' ? 'error' : 'default';
  return <Badge variant={variant}>{status}</Badge>;
}

export default async function DashboardPage() {
  const stats = await getStats();

  if (!stats) {
    return <ConfigurationRequired />;
  }

  const { appCount, publisherCount, developerCount, recentJobs, syncHealth } = stats;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Steam data acquisition platform overview"
      />

      {/* Sync Health Overview */}
      <Section
        title="Sync Health"
        actions={
          <Link
            href="/sync-status"
            className="text-body-sm font-medium text-accent-blue hover:text-accent-blue/80 transition-colors"
          >
            View details
          </Link>
        }
        className="mb-8"
      >
        <SyncHealthCards data={syncHealth} />
        <div className="mt-4">
          <LastSyncTimes lastSyncs={syncHealth.lastSyncs} />
        </div>
      </Section>

      {/* Stats Grid */}
      <Section className="mb-8">
        <Grid cols={4} gap="md">
          <StatCard
            title="Total Apps"
            value={appCount}
            href="/apps"
            icon={Gamepad2}
            color="bg-accent-purple/15 text-accent-purple"
          />
          <StatCard
            title="Publishers"
            value={publisherCount}
            href="/publishers"
            icon={Building2}
            color="bg-accent-green/15 text-accent-green"
          />
          <StatCard
            title="Developers"
            value={developerCount}
            href="/developers"
            icon={Users}
            color="bg-accent-orange/15 text-accent-orange"
          />
          <StatCard
            title="Sync Jobs"
            value={recentJobs.length > 0 ? recentJobs.length : 0}
            href="/jobs"
            icon={RefreshCw}
            color="bg-accent-blue/15 text-accent-blue"
          />
        </Grid>
      </Section>

      {/* Quick Links */}
      <Section title="Quick Links" className="mb-8">
        <Grid cols={3} gap="md">
          <Link href="/jobs">
            <Card variant="interactive" className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-blue/15 text-accent-blue">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-body font-medium text-text-primary">Sync Jobs</p>
                  <p className="text-body-sm text-text-secondary">View job history and status</p>
                </div>
              </div>
            </Card>
          </Link>

          <Link href="/apps">
            <Card variant="interactive" className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple/15 text-accent-purple">
                  <Gamepad2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-body font-medium text-text-primary">Browse Apps</p>
                  <p className="text-body-sm text-text-secondary">Search and explore games</p>
                </div>
              </div>
            </Card>
          </Link>

          <Link href="/publishers">
            <Card variant="interactive" className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-green/15 text-accent-green">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-body font-medium text-text-primary">Publishers</p>
                  <p className="text-body-sm text-text-secondary">View publisher data</p>
                </div>
              </div>
            </Card>
          </Link>
        </Grid>
      </Section>

      {/* Recent Jobs */}
      <Section
        title="Recent Sync Jobs"
        actions={
          <Link
            href="/jobs"
            className="text-body-sm font-medium text-accent-blue hover:text-accent-blue/80 transition-colors"
          >
            View all
          </Link>
        }
      >
        {recentJobs.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-text-secondary">No sync jobs yet</p>
            <p className="mt-2 text-body-sm text-text-muted">
              Run a GitHub Action workflow to start syncing data
            </p>
          </Card>
        ) : (
          <Card padding="none">
            <div className="overflow-hidden">
              <table className="w-full">
                <thead className="bg-surface-elevated">
                  <tr>
                    <th className="px-4 py-3 text-left text-caption font-medium text-text-secondary">
                      Job Type
                    </th>
                    <th className="px-4 py-3 text-left text-caption font-medium text-text-secondary">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-caption font-medium text-text-secondary">
                      Processed
                    </th>
                    <th className="px-4 py-3 text-left text-caption font-medium text-text-secondary">
                      Started
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {recentJobs.map((job) => (
                    <tr key={job.id} className="bg-surface-raised hover:bg-surface-elevated transition-colors">
                      <td className="px-4 py-3 text-body-sm font-medium text-text-primary">
                        {job.job_type}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-4 py-3 text-body-sm text-text-secondary">
                        {job.items_succeeded}/{job.items_processed}
                        {job.items_failed > 0 && (
                          <span className="ml-1 text-accent-red">
                            ({job.items_failed} failed)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-body-sm text-text-tertiary">
                        {new Date(job.started_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Section>
    </div>
  );
}
