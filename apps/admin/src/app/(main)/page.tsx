import Link from 'next/link';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import { PageHeader, Section, Grid } from '@/components/layout';
import { Card } from '@/components/ui';
import { Gamepad2, Building2, Users, ArrowRight } from 'lucide-react';
import { DashboardSearch } from './DashboardSearch';

export const dynamic = 'force-dynamic';

async function getStats() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const supabase = getSupabase();
  const [appsResult, publishersResult, developersResult] = await Promise.all([
    supabase.from('apps').select('*', { count: 'exact', head: true }),
    supabase.from('publishers').select('*', { count: 'exact', head: true }),
    supabase.from('developers').select('*', { count: 'exact', head: true }),
  ]);

  return {
    appCount: appsResult.count ?? 0,
    publisherCount: publishersResult.count ?? 0,
    developerCount: developersResult.count ?? 0,
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

export default async function DashboardPage() {
  const stats = await getStats();

  if (!stats) {
    return <ConfigurationRequired />;
  }

  const { appCount, publisherCount, developerCount } = stats;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Explore Steam game data with natural language"
      />

      {/* Search Hero Section */}
      <DashboardSearch />

      {/* Stats Grid */}
      <Section className="mb-8">
        <Grid cols={3} gap="md">
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
        </Grid>
      </Section>

      {/* Quick Links */}
      <Section title="Quick Links">
        <Grid cols={3} gap="md">
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

          <Link href="/developers">
            <Card variant="interactive" className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-orange/15 text-accent-orange">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-body font-medium text-text-primary">Developers</p>
                  <p className="text-body-sm text-text-secondary">Explore developer studios</p>
                </div>
              </div>
            </Card>
          </Link>
        </Grid>
      </Section>
    </div>
  );
}
