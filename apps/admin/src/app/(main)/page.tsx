import type { Metadata } from 'next';
import Link from 'next/link';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import { Card } from '@/components/ui';
import { Gamepad2, Building2, Users, ArrowRight, Sparkles } from 'lucide-react';
import { DashboardSearch } from './DashboardSearch';

export const metadata: Metadata = {
  title: 'Dashboard',
};

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

interface InsightCardProps {
  title: string;
  value: string | number;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  delay: number;
}

function InsightCard({
  title,
  value,
  description,
  href,
  icon: Icon,
  color,
  delay,
}: InsightCardProps) {
  return (
    <Link href={href} className="block group">
      <Card
        variant="interactive"
        className="p-6 h-full animate-fade-in-up"
        style={{ animationDelay: `${delay}ms` }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-text-secondary group-hover:translate-x-0.5 transition-all" />
        </div>
        <div>
          <p className="text-display-sm text-text-primary mb-1">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          <p className="text-subheading text-text-primary mb-1">{title}</p>
          <p className="text-body-sm text-text-tertiary">{description}</p>
        </div>
      </Card>
    </Link>
  );
}

function ChatCard({ delay }: { delay: number }) {
  return (
    <Link href="/chat" className="block group">
      <Card
        variant="interactive"
        className="p-6 h-full animate-fade-in-up bg-gradient-to-br from-accent-primary/5 to-accent-cyan/5 border-accent-primary/20 hover:border-accent-primary/40"
        style={{ animationDelay: `${delay}ms` }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-primary/15 text-accent-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-accent-primary group-hover:translate-x-0.5 transition-all" />
        </div>
        <div>
          <p className="text-subheading text-text-primary mb-1 flex items-center gap-2">
            AI Chat
            <span className="text-caption-sm px-1.5 py-0.5 rounded bg-accent-primary/15 text-accent-primary">New</span>
          </p>
          <p className="text-body-sm text-text-tertiary">
            Ask questions in natural language and get instant insights from the database
          </p>
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
    <div className="max-w-5xl mx-auto">
      {/* Search Hero Section */}
      <DashboardSearch />

      {/* Insights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
        <InsightCard
          title="Games"
          value={appCount}
          description="Browse the complete catalog of games with detailed metrics"
          href="/apps"
          icon={Gamepad2}
          color="bg-accent-purple/15 text-accent-purple"
          delay={100}
        />
        <InsightCard
          title="Publishers"
          value={publisherCount}
          description="Explore publisher portfolios and market presence"
          href="/publishers"
          icon={Building2}
          color="bg-accent-green/15 text-accent-green"
          delay={150}
        />
        <InsightCard
          title="Developers"
          value={developerCount}
          description="Discover development studios and their releases"
          href="/developers"
          icon={Users}
          color="bg-accent-orange/15 text-accent-orange"
          delay={200}
        />
        <ChatCard delay={250} />
      </div>
    </div>
  );
}
