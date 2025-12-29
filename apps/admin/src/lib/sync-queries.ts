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
 */
export async function getSyncHealthData(supabase: SupabaseClient<Database>): Promise<SyncHealthData> {
  const [jobs24h, successRate7d, overdueApps, appsWithErrors, lastSyncs] = await Promise.all([
    getJobStats24h(supabase),
    getSuccessRate7d(supabase),
    getOverdueAppsCount(supabase),
    getAppsWithErrorsCount(supabase),
    getLastSyncTimes(supabase),
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
 */
export async function getPriorityDistribution(supabase: SupabaseClient<Database>): Promise<PriorityDistribution> {
  const { data } = await supabase
    .from('sync_status')
    .select('priority_score')
    .eq('is_syncable', true);

  const distribution: PriorityDistribution = {
    high: 0,
    medium: 0,
    normal: 0,
    low: 0,
    minimal: 0,
  };

  if (data) {
    for (const row of data) {
      const score = row.priority_score ?? 0;
      if (score >= 150) distribution.high++;
      else if (score >= 100) distribution.medium++;
      else if (score >= 50) distribution.normal++;
      else if (score >= 25) distribution.low++;
      else distribution.minimal++;
    }
  }

  return distribution;
}

/**
 * Get queue status (apps due for sync at different time intervals)
 */
export async function getQueueStatus(supabase: SupabaseClient<Database>): Promise<QueueStatus> {
  const now = new Date();
  const in1Hour = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const in6Hours = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const [overdue, dueIn1Hour, dueIn6Hours, dueIn24Hours] = await Promise.all([
    supabase
      .from('sync_status')
      .select('*', { count: 'exact', head: true })
      .lt('next_sync_after', now.toISOString())
      .eq('is_syncable', true),
    supabase
      .from('sync_status')
      .select('*', { count: 'exact', head: true })
      .gte('next_sync_after', now.toISOString())
      .lt('next_sync_after', in1Hour)
      .eq('is_syncable', true),
    supabase
      .from('sync_status')
      .select('*', { count: 'exact', head: true })
      .gte('next_sync_after', now.toISOString())
      .lt('next_sync_after', in6Hours)
      .eq('is_syncable', true),
    supabase
      .from('sync_status')
      .select('*', { count: 'exact', head: true })
      .gte('next_sync_after', now.toISOString())
      .lt('next_sync_after', in24Hours)
      .eq('is_syncable', true),
  ]);

  return {
    overdue: overdue.count ?? 0,
    dueIn1Hour: dueIn1Hour.count ?? 0,
    dueIn6Hours: dueIn6Hours.count ?? 0,
    dueIn24Hours: dueIn24Hours.count ?? 0,
  };
}

/**
 * Get apps with consecutive sync errors
 */
export async function getAppsWithErrors(supabase: SupabaseClient<Database>, limit = 20): Promise<AppWithError[]> {
  const { data: syncStatus } = await supabase
    .from('sync_status')
    .select('appid, consecutive_errors, last_error_source, last_error_message, last_error_at')
    .gt('consecutive_errors', 0)
    .order('consecutive_errors', { ascending: false })
    .limit(limit);

  if (!syncStatus || syncStatus.length === 0) return [];

  // Get app names
  const appIds = syncStatus.map(s => s.appid);
  const { data: apps } = await supabase
    .from('apps')
    .select('appid, name')
    .in('appid', appIds);

  const appMap = new Map(apps?.map(a => [a.appid, a.name]) ?? []);

  return syncStatus.map(s => ({
    appid: s.appid,
    name: appMap.get(s.appid) ?? `App ${s.appid}`,
    consecutive_errors: s.consecutive_errors ?? 0,
    last_error_source: s.last_error_source,
    last_error_message: s.last_error_message,
    last_error_at: s.last_error_at,
  }));
}

/**
 * Get completion stats for each sync source
 * Shows how many apps have been synced vs never synced per source
 */
export async function getSourceCompletionStats(
  supabase: SupabaseClient<Database>
): Promise<SourceCompletionStats[]> {
  // Get total syncable apps count
  const { count: totalApps } = await supabase
    .from('sync_status')
    .select('*', { count: 'exact', head: true })
    .eq('is_syncable', true);

  const total = totalApps ?? 0;
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Query each source's completion and staleness in parallel
  const [
    steamspySynced,
    storefrontSynced,
    reviewsSynced,
    histogramSynced,
    pageCreationSynced,
    steamspyStale,
    storefrontStale,
    reviewsStale,
    histogramStale,
  ] = await Promise.all([
    // Synced counts (NOT NULL)
    supabase
      .from('sync_status')
      .select('*', { count: 'exact', head: true })
      .eq('is_syncable', true)
      .not('last_steamspy_sync', 'is', null),
    supabase
      .from('sync_status')
      .select('*', { count: 'exact', head: true })
      .eq('is_syncable', true)
      .not('last_storefront_sync', 'is', null),
    supabase
      .from('sync_status')
      .select('*', { count: 'exact', head: true })
      .eq('is_syncable', true)
      .not('last_reviews_sync', 'is', null),
    supabase
      .from('sync_status')
      .select('*', { count: 'exact', head: true })
      .eq('is_syncable', true)
      .not('last_histogram_sync', 'is', null),
    supabase
      .from('sync_status')
      .select('*', { count: 'exact', head: true })
      .eq('is_syncable', true)
      .not('last_page_creation_scrape', 'is', null),
    // Stale counts (synced but older than threshold)
    supabase
      .from('sync_status')
      .select('*', { count: 'exact', head: true })
      .eq('is_syncable', true)
      .not('last_steamspy_sync', 'is', null)
      .lt('last_steamspy_sync', oneDayAgo),
    supabase
      .from('sync_status')
      .select('*', { count: 'exact', head: true })
      .eq('is_syncable', true)
      .not('last_storefront_sync', 'is', null)
      .lt('last_storefront_sync', oneDayAgo),
    supabase
      .from('sync_status')
      .select('*', { count: 'exact', head: true })
      .eq('is_syncable', true)
      .not('last_reviews_sync', 'is', null)
      .lt('last_reviews_sync', oneDayAgo),
    supabase
      .from('sync_status')
      .select('*', { count: 'exact', head: true })
      .eq('is_syncable', true)
      .not('last_histogram_sync', 'is', null)
      .lt('last_histogram_sync', sevenDaysAgo),
  ]);

  // Get last sync times from jobs
  const lastSyncs = await getLastSyncTimes(supabase);

  const sources: SourceCompletionStats[] = [
    {
      source: 'steamspy',
      totalApps: total,
      syncedApps: steamspySynced.count ?? 0,
      neverSynced: total - (steamspySynced.count ?? 0),
      staleApps: steamspyStale.count ?? 0,
      completionPercent: total > 0 ? ((steamspySynced.count ?? 0) / total) * 100 : 0,
      lastSyncTime: lastSyncs.steamspy,
    },
    {
      source: 'storefront',
      totalApps: total,
      syncedApps: storefrontSynced.count ?? 0,
      neverSynced: total - (storefrontSynced.count ?? 0),
      staleApps: storefrontStale.count ?? 0,
      completionPercent: total > 0 ? ((storefrontSynced.count ?? 0) / total) * 100 : 0,
      lastSyncTime: lastSyncs.storefront,
    },
    {
      source: 'reviews',
      totalApps: total,
      syncedApps: reviewsSynced.count ?? 0,
      neverSynced: total - (reviewsSynced.count ?? 0),
      staleApps: reviewsStale.count ?? 0,
      completionPercent: total > 0 ? ((reviewsSynced.count ?? 0) / total) * 100 : 0,
      lastSyncTime: lastSyncs.reviews,
    },
    {
      source: 'histogram',
      totalApps: total,
      syncedApps: histogramSynced.count ?? 0,
      neverSynced: total - (histogramSynced.count ?? 0),
      staleApps: histogramStale.count ?? 0,
      completionPercent: total > 0 ? ((histogramSynced.count ?? 0) / total) * 100 : 0,
      lastSyncTime: lastSyncs.histogram,
    },
    {
      source: 'page_creation',
      totalApps: total,
      syncedApps: pageCreationSynced.count ?? 0,
      neverSynced: total - (pageCreationSynced.count ?? 0),
      staleApps: 0, // page_creation doesn't go stale
      completionPercent: total > 0 ? ((pageCreationSynced.count ?? 0) / total) * 100 : 0,
      lastSyncTime: null,
    },
  ];

  return sources;
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
 */
export async function getPICSDataStats(
  supabase: SupabaseClient<Database>
): Promise<PICSDataStats> {
  // Get total syncable apps
  const { count: totalApps } = await supabase
    .from('sync_status')
    .select('*', { count: 'exact', head: true })
    .eq('is_syncable', true);

  // Run all PICS data checks in parallel
  const [
    withPicsSync,
    withCategories,
    withGenres,
    withTags,
    withFranchises,
    withParentApp,
  ] = await Promise.all([
    // Apps with last_pics_sync set
    supabase
      .from('sync_status')
      .select('*', { count: 'exact', head: true })
      .eq('is_syncable', true)
      .not('last_pics_sync', 'is', null),
    // Apps with categories
    supabase
      .from('app_categories')
      .select('appid', { count: 'exact', head: true }),
    // Apps with genres
    supabase
      .from('app_genres')
      .select('appid', { count: 'exact', head: true }),
    // Apps with tags (distinct count of apps that have tags)
    supabase
      .from('app_tags')
      .select('appid', { count: 'exact', head: true }),
    // Apps with franchises
    supabase
      .from('app_franchises')
      .select('appid', { count: 'exact', head: true }),
    // Apps with parent_appid set (DLC/demos linked to parent game)
    supabase
      .from('apps')
      .select('*', { count: 'exact', head: true })
      .not('parent_appid', 'is', null),
  ]);

  return {
    totalApps: totalApps ?? 0,
    withPicsSync: withPicsSync.count ?? 0,
    withCategories: withCategories.count ?? 0,
    withGenres: withGenres.count ?? 0,
    withTags: withTags.count ?? 0,
    withFranchises: withFranchises.count ?? 0,
    withParentApp: withParentApp.count ?? 0,
  };
}
