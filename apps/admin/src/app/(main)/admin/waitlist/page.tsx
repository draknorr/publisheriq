import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient, getUserWithProfile } from '@/lib/supabase';
import { Card } from '@/components/ui';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { WaitlistTable } from './WaitlistTable';

export const metadata: Metadata = {
  title: 'Waitlist | Admin',
};

export const dynamic = 'force-dynamic';

interface WaitlistEntry {
  id: string;
  email: string;
  full_name: string;
  organization: string | null;
  how_i_plan_to_use: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  invite_sent_at: string | null;
  created_at: string;
}

async function getWaitlistEntries(): Promise<WaitlistEntry[]> {
  const supabase = await createServerClient();

  const { data: entries, error } = await supabase
    .from('waitlist')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching waitlist:', error);
    return [];
  }

  return entries ?? [];
}

async function getWaitlistStats() {
  const supabase = await createServerClient();

  const [pendingResult, approvedResult, rejectedResult] = await Promise.all([
    supabase.from('waitlist').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('waitlist').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('waitlist').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
  ]);

  return {
    pending: pendingResult.count ?? 0,
    approved: approvedResult.count ?? 0,
    rejected: rejectedResult.count ?? 0,
  };
}

export default async function AdminWaitlistPage() {
  // Check admin access
  const result = await getUserWithProfile();

  if (!result) {
    redirect('/login');
  }

  if (result.profile.role !== 'admin') {
    redirect('/');
  }

  const [entries, stats] = await Promise.all([getWaitlistEntries(), getWaitlistStats()]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-display-sm text-text-primary">Waitlist</h1>
        <p className="mt-1 text-body-sm text-text-secondary">
          Review and approve access requests
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card variant="default" padding="md">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-accent-yellow" />
            <div>
              <p className="text-body-sm text-text-secondary">Pending</p>
              <p className="text-display-sm text-text-primary">{stats.pending}</p>
            </div>
          </div>
        </Card>
        <Card variant="default" padding="md">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-accent-green" />
            <div>
              <p className="text-body-sm text-text-secondary">Approved</p>
              <p className="text-display-sm text-text-primary">{stats.approved}</p>
            </div>
          </div>
        </Card>
        <Card variant="default" padding="md">
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-accent-red" />
            <div>
              <p className="text-body-sm text-text-secondary">Rejected</p>
              <p className="text-display-sm text-text-primary">{stats.rejected}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Waitlist Table */}
      <Card variant="default" padding="none">
        <WaitlistTable entries={entries} adminId={result.user.id} />
      </Card>
    </div>
  );
}
