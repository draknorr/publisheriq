import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth-utils';
import { createServerClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { ToastProvider } from '@/components/ui/Toast';
import { Users } from 'lucide-react';
import { UsersTable } from './UsersTable';

export const metadata: Metadata = {
  title: 'Users | Admin',
};

export const dynamic = 'force-dynamic';

interface UserWithProfile {
  id: string;
  email: string;
  full_name: string | null;
  organization: string | null;
  role: 'user' | 'admin';
  credit_balance: number;
  total_credits_used: number;
  total_messages_sent: number;
  created_at: string;
  updated_at: string;
}

interface ActiveUserLog {
  user_id: string | null;
}

async function getUsers(): Promise<UserWithProfile[]> {
  const supabase = await createServerClient();

  const { data: users, error } = await supabase
    .from('user_profiles')
    .select(
      'id, email, full_name, organization, role, credit_balance, total_credits_used, total_messages_sent, created_at, updated_at'
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }

  return users ?? [];
}

async function getUserStats() {
  const supabase = await createServerClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [totalUsersResult, adminUsersResult, activeLogsResult] = await Promise.all([
    supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
    // Active = sent at least one chat message in the last 7 days
    supabase
      .from('chat_query_logs')
      .select('user_id')
      .gte('created_at', sevenDaysAgo)
      .not('user_id', 'is', null),
  ]);

  const activeUsers = new Set(
    ((activeLogsResult.data ?? []) as ActiveUserLog[])
      .map((entry) => entry.user_id)
      .filter((userId): userId is string => typeof userId === 'string' && userId.length > 0)
  ).size;

  return {
    totalUsers: totalUsersResult.count ?? 0,
    adminUsers: adminUsersResult.count ?? 0,
    activeUsers,
  };
}

export default async function AdminUsersPage() {
  await requireAdmin();
  const [users, stats] = await Promise.all([getUsers(), getUserStats()]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-display-sm text-text-primary">Users</h1>
        <p className="mt-1 text-body-sm text-text-secondary">
          Manage user accounts and credit balances
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card variant="default" padding="md">
          <p className="text-body-sm text-text-secondary">Total Users</p>
          <p className="text-display-sm text-text-primary">{stats.totalUsers}</p>
        </Card>
        <Card variant="default" padding="md">
          <p className="text-body-sm text-text-secondary">Admins</p>
          <p className="text-display-sm text-text-primary">{stats.adminUsers}</p>
        </Card>
        <Card variant="default" padding="md">
          <p className="text-body-sm text-text-secondary">Active (7d)</p>
          <p className="text-display-sm text-text-primary">{stats.activeUsers}</p>
        </Card>
      </div>

      {/* Users Table */}
      <Card variant="default" padding="none">
        <div className="p-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-text-secondary" />
            <h2 className="text-subheading text-text-primary">All Users</h2>
          </div>
        </div>
        <ToastProvider>
          <UsersTable users={users} />
        </ToastProvider>
      </Card>
    </div>
  );
}
