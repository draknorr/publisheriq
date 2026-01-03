import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import {
  getSyncHealthData,
  getPriorityDistribution,
  getQueueStatus,
  getAppsWithErrors,
  getSourceCompletionStats,
  getFullyCompletedAppsCount,
  getPICSSyncState,
  getPICSDataStats,
  type PriorityDistribution,
  type QueueStatus,
  type AppWithError,
  type SourceCompletionStats,
  type SyncHealthData,
  type PICSSyncState,
  type PICSDataStats,
} from '@/lib/sync-queries';
import { AdminDashboard } from './AdminDashboard';

export const dynamic = 'force-dynamic';

export interface SyncJob {
  id: string;
  job_type: string;
  status: string;
  items_processed: number | null;
  items_succeeded: number | null;
  items_failed: number | null;
  items_created: number | null;
  items_updated: number | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  github_run_id: string | null;
  batch_size: number | null;
}

export interface ChatQueryLog {
  id: string;
  query_text: string;
  tool_names: string[];
  tool_count: number;
  iteration_count: number;
  response_length: number;
  timing_llm_ms: number | null;
  timing_tools_ms: number | null;
  timing_total_ms: number | null;
  created_at: string;
}

export interface AdminDashboardData {
  syncHealth: SyncHealthData;
  priorityDistribution: PriorityDistribution;
  queueStatus: QueueStatus;
  appsWithErrors: AppWithError[];
  completionStats: SourceCompletionStats[];
  fullyCompletedCount: number;
  runningJobs: SyncJob[];
  recentJobs: SyncJob[];
  allJobs: SyncJob[];
  picsSyncState: PICSSyncState;
  picsDataStats: PICSDataStats;
  chatLogs: ChatQueryLog[];
}

async function getAdminDashboardData(): Promise<AdminDashboardData | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const supabase = getSupabase();

  const [
    syncHealth,
    priorityDistribution,
    queueStatus,
    appsWithErrors,
    completionStats,
    fullyCompletedCount,
    runningJobs,
    recentJobs,
    allJobs,
    picsSyncState,
    picsDataStats,
    chatLogs,
  ] = await Promise.all([
    getSyncHealthData(supabase),
    getPriorityDistribution(supabase),
    getQueueStatus(supabase),
    getAppsWithErrors(supabase, 20),
    getSourceCompletionStats(supabase),
    getFullyCompletedAppsCount(supabase),
    supabase
      .from('sync_jobs')
      .select('*')
      .eq('status', 'running')
      .order('started_at', { ascending: false }),
    supabase
      .from('sync_jobs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10),
    supabase
      .from('sync_jobs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(100),
    getPICSSyncState(supabase),
    getPICSDataStats(supabase),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('chat_query_logs') as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return {
    syncHealth,
    priorityDistribution,
    queueStatus,
    appsWithErrors,
    completionStats,
    fullyCompletedCount,
    runningJobs: runningJobs.data ?? [],
    recentJobs: recentJobs.data ?? [],
    allJobs: allJobs.data ?? [],
    picsSyncState,
    picsDataStats,
    chatLogs: chatLogs.data ?? [],
  };
}

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData();

  if (!data) {
    return <ConfigurationRequired />;
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-display-sm text-text-primary">Admin Dashboard</h1>
        <p className="mt-1 text-body-sm text-text-secondary">
          System health, sync status, and job monitoring
        </p>
      </div>

      <AdminDashboard data={data} />
    </div>
  );
}
