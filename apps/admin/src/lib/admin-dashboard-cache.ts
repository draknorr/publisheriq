/**
 * In-memory cache for admin dashboard data
 * Reduces database load by caching dashboard data for a short TTL
 */

import type { AdminDashboardData } from '@/app/(main)/admin/page';

interface DashboardCache {
  data: AdminDashboardData;
  cachedAt: number;
}

// Cache TTL in milliseconds (30 seconds)
const CACHE_TTL_MS = 30 * 1000;

// Module-level cache variable
let dashboardCache: DashboardCache | null = null;

/**
 * Get cached dashboard data if available and not expired
 * @returns Cached data or null if cache miss/expired
 */
export function getCachedDashboardData(): AdminDashboardData | null {
  if (dashboardCache && Date.now() - dashboardCache.cachedAt < CACHE_TTL_MS) {
    return dashboardCache.data;
  }
  return null;
}

/**
 * Store dashboard data in cache
 * @param data The dashboard data to cache
 */
export function setCachedDashboardData(data: AdminDashboardData): void {
  dashboardCache = {
    data,
    cachedAt: Date.now(),
  };
}

/**
 * Invalidate the dashboard cache
 * Call this when you know data has changed
 */
export function invalidateDashboardCache(): void {
  dashboardCache = null;
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus(): { cached: boolean; ageMs: number | null; ttlMs: number } {
  if (!dashboardCache) {
    return { cached: false, ageMs: null, ttlMs: CACHE_TTL_MS };
  }
  return {
    cached: true,
    ageMs: Date.now() - dashboardCache.cachedAt,
    ttlMs: CACHE_TTL_MS,
  };
}
