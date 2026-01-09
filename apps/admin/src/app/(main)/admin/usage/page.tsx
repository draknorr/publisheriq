import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient, getUserWithProfile } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { BarChart3, Coins, MessageSquare, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Usage Analytics | Admin',
};

export const dynamic = 'force-dynamic';

interface UserUsage {
  id: string;
  email: string;
  full_name: string | null;
  credit_balance: number;
  total_credits_used: number;
  total_messages_sent: number;
}

async function getUsageStats() {
  const supabase = await createServerClient();

  // Get aggregate stats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles } = await (supabase.from('user_profiles') as any)
    .select('credit_balance, total_credits_used, total_messages_sent') as {
      data: Array<{ credit_balance: number; total_credits_used: number; total_messages_sent: number }> | null
    };

  const totalCreditsInSystem = profiles?.reduce((sum, p) => sum + p.credit_balance, 0) ?? 0;
  const totalCreditsUsed = profiles?.reduce((sum, p) => sum + p.total_credits_used, 0) ?? 0;
  const totalMessages = profiles?.reduce((sum, p) => sum + p.total_messages_sent, 0) ?? 0;

  // Get recent chat activity (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentLogs, count: recentCount } = await (supabase.from('chat_query_logs') as any)
    .select('*', { count: 'exact' })
    .gte('created_at', sevenDaysAgo);

  const recentCredits = recentLogs?.reduce(
    (sum: number, log: { total_credits_charged?: number }) =>
      sum + (log.total_credits_charged ?? 0),
    0
  ) ?? 0;

  return {
    totalCreditsInSystem,
    totalCreditsUsed,
    totalMessages,
    messagesLast7Days: recentCount ?? 0,
    creditsUsedLast7Days: recentCredits,
  };
}

async function getTopUsers(): Promise<UserUsage[]> {
  const supabase = await createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users } = await (supabase.from('user_profiles') as any)
    .select('id, email, full_name, credit_balance, total_credits_used, total_messages_sent')
    .order('total_credits_used', { ascending: false })
    .limit(10);

  return users ?? [];
}

async function getToolUsageBreakdown() {
  const supabase = await createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: logs } = await (supabase.from('chat_query_logs') as any)
    .select('tool_names')
    .not('tool_names', 'is', null);

  const toolCounts: Record<string, number> = {};

  logs?.forEach((log: { tool_names: string[] | null }) => {
    log.tool_names?.forEach((tool: string) => {
      toolCounts[tool] = (toolCounts[tool] || 0) + 1;
    });
  });

  return Object.entries(toolCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export default async function AdminUsagePage() {
  // Check admin access
  const result = await getUserWithProfile();

  if (!result) {
    redirect('/login');
  }

  if (result.profile.role !== 'admin') {
    redirect('/');
  }

  const [stats, topUsers, toolUsage] = await Promise.all([
    getUsageStats(),
    getTopUsers(),
    getToolUsageBreakdown(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-display-sm text-text-primary">Usage Analytics</h1>
        <p className="mt-1 text-body-sm text-text-secondary">
          Credit usage and chat activity metrics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="default" padding="md">
          <div className="flex items-center gap-3">
            <Coins className="h-5 w-5 text-accent-green" />
            <div>
              <p className="text-body-sm text-text-secondary">Credits in System</p>
              <p className="text-display-sm text-text-primary">
                {stats.totalCreditsInSystem.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card variant="default" padding="md">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-accent-blue" />
            <div>
              <p className="text-body-sm text-text-secondary">Total Credits Used</p>
              <p className="text-display-sm text-text-primary">
                {stats.totalCreditsUsed.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card variant="default" padding="md">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-accent-purple" />
            <div>
              <p className="text-body-sm text-text-secondary">Total Messages</p>
              <p className="text-display-sm text-text-primary">
                {stats.totalMessages.toLocaleString()}
              </p>
              <p className="text-caption text-text-muted">All time</p>
            </div>
          </div>
        </Card>

        <Card variant="default" padding="md">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-accent-orange" />
            <div>
              <p className="text-body-sm text-text-secondary">Last 7 Days</p>
              <p className="text-display-sm text-text-primary">
                {stats.messagesLast7Days} msgs
              </p>
              <p className="text-caption text-text-muted">
                {stats.creditsUsedLast7Days.toLocaleString()} credits
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Users */}
        <Card variant="default" padding="none">
          <div className="p-4 border-b border-border-subtle">
            <h2 className="text-subheading text-text-primary">Top Users by Credits Used</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-raised">
                  <th className="px-4 py-2 text-left text-caption text-text-secondary font-medium">
                    User
                  </th>
                  <th className="px-4 py-2 text-right text-caption text-text-secondary font-medium">
                    Credits Used
                  </th>
                  <th className="px-4 py-2 text-right text-caption text-text-secondary font-medium">
                    Messages
                  </th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border-subtle last:border-0"
                  >
                    <td className="px-4 py-2">
                      <p className="text-body-sm text-text-primary">
                        {user.full_name || user.email}
                      </p>
                      {user.full_name && (
                        <p className="text-caption text-text-muted">{user.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-body-sm text-text-primary">
                        {user.total_credits_used.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-body-sm text-text-secondary">
                        {user.total_messages_sent}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {topUsers.length === 0 && (
            <div className="p-8 text-center text-text-secondary">
              No usage data yet.
            </div>
          )}
        </Card>

        {/* Tool Usage */}
        <Card variant="default" padding="none">
          <div className="p-4 border-b border-border-subtle">
            <h2 className="text-subheading text-text-primary">Tool Usage</h2>
          </div>
          <div className="p-4 space-y-3">
            {toolUsage.map((tool) => {
              const maxCount = toolUsage[0]?.count ?? 1;
              const percentage = (tool.count / maxCount) * 100;

              return (
                <div key={tool.name}>
                  <div className="flex justify-between text-body-sm mb-1">
                    <span className="text-text-primary">{tool.name}</span>
                    <span className="text-text-secondary">{tool.count}</span>
                  </div>
                  <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-blue rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {toolUsage.length === 0 && (
              <div className="text-center text-text-secondary py-4">
                No tool usage data yet.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
