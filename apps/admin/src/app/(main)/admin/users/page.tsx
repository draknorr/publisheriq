import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient, getUserWithProfile } from '@/lib/supabase';
import { Card } from '@/components/ui';
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

async function getUsers(): Promise<UserWithProfile[]> {
  const supabase = await createServerClient();

  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }

  return users ?? [];
}

async function getUserStats() {
  const supabase = await createServerClient();

  const [totalUsersResult, adminUsersResult, activeUsersResult] = await Promise.all([
    supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
    // Active = sent message in last 7 days
    supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .gt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  return {
    totalUsers: totalUsersResult.count ?? 0,
    adminUsers: adminUsersResult.count ?? 0,
    activeUsers: activeUsersResult.count ?? 0,
  };
}

export default async function AdminUsersPage() {
  // Check admin access
  const result = await getUserWithProfile();

  if (!result) {
    redirect('/login');
  }

  if (result.profile.role !== 'admin') {
    redirect('/');
  }

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
        <UsersTable users={users} currentUserId={result.user.id} />
      </Card>
    </div>
  );
}
