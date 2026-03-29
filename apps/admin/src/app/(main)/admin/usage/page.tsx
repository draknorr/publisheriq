import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth-utils';
import { createServerClient } from '@/lib/supabase/server';
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

interface UsageStats {
  totalCreditsInSystem: number;
  totalCreditsUsed: number;
  totalMessages: number;
  messagesInWindow: number;
  creditsUsedInWindow: number;
}

interface ToolUsage {
  name: string;
  count: number;
}

interface ChatUsageLog {
  user_id: string | null;
  total_credits_charged: number | null;
  tool_names: string[] | null;
  created_at: string | null;
}

interface UserProfileSummary {
  id: string;
  email: string;
  full_name: string | null;
  credit_balance: number;
  total_credits_used: number;
  total_messages_sent: number;
}

const USAGE_WINDOWS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
} as const;

type UsageWindow = keyof typeof USAGE_WINDOWS;

function parseUsageWindow(windowParam?: string): UsageWindow {
  if (windowParam === '7d' || windowParam === '90d') {
    return windowParam;
  }
  return '30d';
}

async function getUsagePageDataForWindow(window: UsageWindow): Promise<{
  stats: UsageStats;
  topUsers: UserUsage[];
  toolUsage: ToolUsage[];
  window: UsageWindow;
}> {
  const supabase = await createServerClient();
  const cutoff = new Date(
    Date.now() - USAGE_WINDOWS[window] * 24 * 60 * 60 * 1000
  ).toISOString();

  const [recentLogsResult, profilesResult, topUsersResult] = await Promise.all([
    supabase
      .from('chat_query_logs')
      .select('user_id, total_credits_charged, tool_names, created_at')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_profiles')
      .select('id, email, full_name, credit_balance, total_credits_used, total_messages_sent'),
    supabase
      .from('user_profiles')
      .select(
        'id, email, full_name, credit_balance, total_credits_used, total_messages_sent'
      )
      .order('total_credits_used', { ascending: false })
      .order('total_messages_sent', { ascending: false })
      .limit(10),
  ]);

  const logs: ChatUsageLog[] = recentLogsResult.data ?? [];
  const profiles: UserProfileSummary[] = profilesResult.data ?? [];
  const toolCounts: Record<string, number> = {};

  let creditsUsedInWindow = 0;

  for (const log of logs) {
    const creditsCharged = log.total_credits_charged ?? 0;
    creditsUsedInWindow += creditsCharged;

    log.tool_names?.forEach((tool) => {
      toolCounts[tool] = (toolCounts[tool] || 0) + 1;
    });
  }

  const totalCreditsInSystem = profiles.reduce((sum, profile) => {
    return sum + (profile.credit_balance ?? 0);
  }, 0);

  const totalCreditsUsed = profiles.reduce((sum, profile) => {
    return sum + (profile.total_credits_used ?? 0);
  }, 0);

  const totalMessages = profiles.reduce((sum, profile) => {
    return sum + (profile.total_messages_sent ?? 0);
  }, 0);

  const toolUsage = Object.entries(toolCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    stats: {
      totalCreditsInSystem,
      totalCreditsUsed,
      totalMessages,
      messagesInWindow: logs.length,
      creditsUsedInWindow,
    },
    topUsers: (topUsersResult.data ?? []) as UserUsage[],
    toolUsage,
    window,
  };
}

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const selectedWindow = parseUsageWindow(params.window);
  const { stats, topUsers, toolUsage, window } = await getUsagePageDataForWindow(selectedWindow);
  const currentParams = new URLSearchParams();

  if (window !== '30d') {
    currentParams.set('window', window);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-display-sm text-text-primary">Usage Analytics</h1>
          <p className="mt-1 text-body-sm text-text-secondary">
            All-time profile totals plus recent chat activity windows
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-raised p-1">
          {(Object.keys(USAGE_WINDOWS) as UsageWindow[]).map((windowOption) => {
            const nextParams = new URLSearchParams(currentParams.toString());
            if (windowOption === '30d') {
              nextParams.delete('window');
            } else {
              nextParams.set('window', windowOption);
            }
            const href = nextParams.toString()
              ? `/admin/usage?${nextParams.toString()}`
              : '/admin/usage';

            return (
              <Link
                key={windowOption}
                href={href}
                className={`rounded-md px-3 py-1.5 text-body-sm font-medium transition-colors ${
                  window === windowOption
                    ? 'bg-surface-elevated text-text-primary shadow-subtle'
                    : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
                }`}
              >
                {windowOption}
              </Link>
            );
          })}
        </div>
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
              <p className="text-body-sm text-text-secondary">{window} Activity</p>
              <p className="text-display-sm text-text-primary">
                {stats.messagesInWindow.toLocaleString()} msgs
              </p>
              <p className="text-caption text-text-muted">
                {stats.creditsUsedInWindow.toLocaleString()} credits
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
            <h2 className="text-subheading text-text-primary">Tool Usage ({window})</h2>
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
