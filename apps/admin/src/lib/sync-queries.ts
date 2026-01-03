import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@publisheriq/database';

export interface JobStats {
  total: number;
  completed: number;
  failed: number;
  running: number;
  avgDurationMs: number | null;
}

export interface SyncHealthData {
  jobs24h: JobStats;
  successRate7d: number;
  overdueApps: number;
  appsWithErrors: number;
  lastSyncs: {
    steamspy: string | null;
    storefront: string | null;
    reviews: string | null;
    histogram: string | null;
  };
}

export interface PriorityDistribution {
  high: number;     // 150+
  medium: number;   // 100-149
  normal: number;   // 50-99
  low: number;      // 25-49
  minimal: number;  // <25
}

export interface QueueStatus {
  overdue: number;
  dueIn1Hour: number;
  dueIn6Hours: number;
  dueIn24Hours: number;
}

export interface AppWithError {
  appid: number;
  name: string;
  consecutive_errors: number;
  last_error_source: string | null;
  last_error_message: string | null;
  last_error_at: string | null;
}

export interface SourceCompletionStats {
  source: 'steamspy' | 'storefront' | 'reviews' | 'histogram' | 'page_creation' | 'pics';
  totalApps: number;
  syncedApps: number;
  neverSynced: number;
  staleApps: number;
  completionPercent: number;
  lastSyncTime: string | null;
}

export interface PICSSyncState {
  lastChangeNumber: number;
  updatedAt: string | null;
}

export interface PICSDataStats {
  totalApps: number;
  withPicsSync: number;
  withCategories: number;
  withGenres: number;
  withTags: number;
  withFranchises: number;
  withParentApp: number;
}

/**
 * Get job statistics for the last 24 hours
 */
export async function getJobStats24h(supabase: SupabaseClient<Database>): Promise<JobStats> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: jobs } = await supabase
    .from('sync_jobs')
    .select('status, started_at, completed_at')
    .gte('started_at', twentyFourHoursAgo);

  if (!jobs || jobs.length === 0) {
    return { total: 0, completed: 0, failed: 0, running: 0, avgDurationMs: null };
  }

  const completed = jobs.filter(j => j.status === 'completed');
  const failed = jobs.filter(j => j.status === 'failed');
  const running = jobs.filter(j => j.status === 'running');

  // Calculate average duration for completed jobs
  const durations = completed
    .filter(j => j.completed_at)
    .map(j => new Date(j.completed_at!).getTime() - new Date(j.started_at).getTime());

  const avgDurationMs = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : null;

  return {
    total: jobs.length,
    completed: completed.length,
    failed: failed.length,
    running: running.length,
    avgDurationMs,
  };
}

/**
 * Get success rate for the last 7 days
 */
export async function getSuccessRate7d(supabase: SupabaseClient<Database>): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: jobs } = await supabase
    .from('sync_jobs')
    .select('status')
    .gte('started_at', sevenDaysAgo)
    .neq('status', 'running');

  if (!jobs || jobs.length === 0) return 0;

  const completed = jobs.filter(j => j.status === 'completed').length;
  return (completed / jobs.length) * 100;
}

/**
 * Get count of apps overdue for sync
 */
export async function getOverdueAppsCount(supabase: SupabaseClient<Database>): Promise<number> {
  const { count } = await supabase
    .from('sync_status')
    .select('*', { count: 'exact', head: true })
    .lt('next_sync_after', new Date().toISOString())
    .eq('is_syncable', true);

  return count ?? 0;
}

/**
 * Get count of apps with consecutive errors
 */
export async function getAppsWithErrorsCount(supabase: SupabaseClient<Database>): Promise<number> {
  const { count } = await supabase
    .from('sync_status')
    .select('*', { count: 'exact', head: true })
    .gt('consecutive_errors', 0);

  return count ?? 0;
}

/**
 * Get last sync time for each data source
 */
export async function getLastSyncTimes(supabase: SupabaseClient<Database>): Promise<SyncHealthData['lastSyncs']> {
  // Get the most recent sync job for each type
  const { data: jobs } = await supabase
    .from('sync_jobs')
    .select('job_type, completed_at')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(100);

  const lastSyncs: SyncHealthData['lastSyncs'] = {
    steamspy: null,
    storefront: null,
    reviews: null,
    histogram: null,
  };

  if (jobs) {
    for (const job of jobs) {
      const type = job.job_type.toLowerCase();
      if (type.includes('steamspy') && !lastSyncs.steamspy) {
        lastSyncs.steamspy = job.completed_at;
      } else if (type.includes('storefront') && !lastSyncs.storefront) {
        lastSyncs.storefront = job.completed_at;
      } else if (type.includes('reviews') && !lastSyncs.reviews) {
        lastSyncs.reviews = job.completed_at;
      } else if (type.includes('histogram') && !lastSyncs.histogram) {
        lastSyncs.histogram = job.completed_at;
      }
    }
  }

  return lastSyncs;
}

/**
 * Get complete sync health data
 * @param sharedData Optional pre-fetched data to avoid duplicate queries
 */
export async function getSyncHealthData(
  supabase: SupabaseClient<Database>,
  sharedData?: {
    lastSyncs?: SyncHealthData['lastSyncs'];
    overdueApps?: number;
  }
): Promise<SyncHealthData> {
  // Only fetch what we don't already have
  const needsLastSyncs = !sharedData?.lastSyncs;
  const needsOverdue = sharedData?.overdueApps === undefined;

  const [jobs24h, successRate7d, overdueApps, appsWithErrors, lastSyncs] = await Promise.all([
    getJobStats24h(supabase),
    getSuccessRate7d(supabase),
    needsOverdue ? getOverdueAppsCount(supabase) : Promise.resolve(sharedData!.overdueApps!),
    getAppsWithErrorsCount(supabase),
    needsLastSyncs ? getLastSyncTimes(supabase) : Promise.resolve(sharedData!.lastSyncs!),
  ]);

  return {
    jobs24h,
    successRate7d,
    overdueApps,
    appsWithErrors,
    lastSyncs,
  };
}

/**
 * Get priority distribution of apps
 * Uses RPC function to count on database side instead of fetching all rows
 */
export async function getPriorityDistribution(supabase: SupabaseClient<Database>): Promise<PriorityDistribution> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('get_priority_distribution');

  if (error || !data || data.length === 0) {
    // Fallback to default values if RPC fails
    return { high: 0, medium: 0, normal: 0, low: 0, minimal: 0 };
  }

  const row = data[0];
  return {
    high: Number(row.high ?? 0),
    medium: Number(row.medium ?? 0),
    normal: Number(row.normal_priority ?? 0),
    low: Number(row.low ?? 0),
    minimal: Number(row.minimal ?? 0),
  };
}

/**
 * Get queue status (apps due for sync at different time intervals)
 * Uses RPC function to get all counts in a single query
 */
export async function getQueueStatus(supabase: SupabaseClient<Database>): Promise<QueueStatus> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('get_queue_status');

  if (error || !data || data.length === 0) {
    // Fallback to default values if RPC fails
    return { overdue: 0, dueIn1Hour: 0, dueIn6Hours: 0, dueIn24Hours: 0 };
  }

  const row = data[0];
  return {
    overdue: Number(row.overdue ?? 0),
    dueIn1Hour: Number(row.due_in_1_hour ?? 0),
    dueIn6Hours: Number(row.due_in_6_hours ?? 0),
    dueIn24Hours: Number(row.due_in_24_hours ?? 0),
  };
}

/**
 * Get apps with consecutive sync errors
 * Uses embedded select (JOIN) to get app names in a single query
 */
export async function getAppsWithErrors(supabase: SupabaseClient<Database>, limit = 20): Promise<AppWithError[]> {
  // Use embedded select to JOIN with apps table in single query
  const { data } = await supabase
    .from('sync_status')
    .select(`
      appid,
      consecutive_errors,
      last_error_source,
      last_error_message,
      last_error_at,
      apps(name)
    `)
    .gt('consecutive_errors', 0)
    .order('consecutive_errors', { ascending: false })
    .limit(limit);

  if (!data || data.length === 0) return [];

  return data.map(row => ({
    appid: row.appid,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    name: (row.apps as any)?.name ?? `App ${row.appid}`,
    consecutive_errors: row.consecutive_errors ?? 0,
    last_error_source: row.last_error_source,
    last_error_message: row.last_error_message,
    last_error_at: row.last_error_at,
  }));
}

/**
 * Get completion stats for each sync source
 * Shows how many apps have been synced vs never synced per source
 * Uses RPC function to get all counts in a single query
 * @param sharedData Optional pre-fetched data to avoid duplicate queries
 */
export async function getSourceCompletionStats(
  supabase: SupabaseClient<Database>,
  sharedData?: {
    totalApps?: number;
    lastSyncs?: SyncHealthData['lastSyncs'];
  }
): Promise<SourceCompletionStats[]> {
  // Get last sync times (use shared data if available)
  const lastSyncs = sharedData?.lastSyncs ?? await getLastSyncTimes(supabase);

  // Use RPC to get all completion stats in a single query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('get_source_completion_stats');

  if (error || !data || data.length === 0) {
    // Fallback to empty array if RPC fails
    return [];
  }

  // Map RPC results to SourceCompletionStats format
  const lastSyncMap: Record<string, string | null> = {
    steamspy: lastSyncs.steamspy,
    storefront: lastSyncs.storefront,
    reviews: lastSyncs.reviews,
    histogram: lastSyncs.histogram,
    page_creation: null,
  };

  return data.map((row: { source: string; total_apps: number; synced_apps: number; stale_apps: number }) => {
    const totalApps = Number(row.total_apps ?? 0);
    const syncedApps = Number(row.synced_apps ?? 0);
    return {
      source: row.source as SourceCompletionStats['source'],
      totalApps,
      syncedApps,
      neverSynced: totalApps - syncedApps,
      staleApps: Number(row.stale_apps ?? 0),
      completionPercent: totalApps > 0 ? (syncedApps / totalApps) * 100 : 0,
      lastSyncTime: lastSyncMap[row.source] ?? null,
    };
  });
}

/**
 * Get count of apps that have ALL sources synced at least once
 */
export async function getFullyCompletedAppsCount(
  supabase: SupabaseClient<Database>
): Promise<number> {
  const { count } = await supabase
    .from('sync_status')
    .select('*', { count: 'exact', head: true })
    .eq('is_syncable', true)
    .not('last_steamspy_sync', 'is', null)
    .not('last_storefront_sync', 'is', null)
    .not('last_reviews_sync', 'is', null)
    .not('last_histogram_sync', 'is', null);

  return count ?? 0;
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Format timestamp to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return 'Never';

  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  if (diffMs < 60000) return 'Just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
  return `${Math.floor(diffMs / 86400000)}d ago`;
}

/**
 * Get PICS sync state (change number tracking)
 */
export async function getPICSSyncState(
  supabase: SupabaseClient<Database>
): Promise<PICSSyncState> {
  try {
    const { data } = await supabase
      .from('pics_sync_state')
      .select('last_change_number, updated_at')
      .eq('id', 1)
      .single();

    return {
      lastChangeNumber: data?.last_change_number ?? 0,
      updatedAt: data?.updated_at ?? null,
    };
  } catch {
    return { lastChangeNumber: 0, updatedAt: null };
  }
}

/**
 * Get PICS data completion statistics
 * Uses RPC function to get all counts in a single query
 * @param sharedTotalApps Optional pre-fetched total apps count (ignored when using RPC)
 */
export async function getPICSDataStats(
  supabase: SupabaseClient<Database>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sharedTotalApps?: number
): Promise<PICSDataStats> {
  // Use RPC to get all PICS stats in a single query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('get_pics_data_stats');

  if (error || !data || data.length === 0) {
    // Fallback to default values if RPC fails
    return {
      totalApps: 0,
      withPicsSync: 0,
      withCategories: 0,
      withGenres: 0,
      withTags: 0,
      withFranchises: 0,
      withParentApp: 0,
    };
  }

  const row = data[0];
  return {
    totalApps: Number(row.total_apps ?? 0),
    withPicsSync: Number(row.with_pics_sync ?? 0),
    withCategories: Number(row.with_categories ?? 0),
    withGenres: Number(row.with_genres ?? 0),
    withTags: Number(row.with_tags ?? 0),
    withFranchises: Number(row.with_franchises ?? 0),
    withParentApp: Number(row.with_parent_app ?? 0),
  };
}
