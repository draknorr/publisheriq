import { API_URLS, logger, ApiError } from '@publisheriq/shared';
import { withRetry } from '../utils/retry.js';
import { rateLimiters } from '../utils/rate-limiter.js';

const log = logger.child({ component: 'SteamSpyAPI' });

/**
 * SteamSpy app details response
 */
export interface SteamSpyAppDetails {
  appid: number;
  name: string;
  developer: string;
  publisher: string;
  score_rank: string;
  positive: number;
  negative: number;
  userscore: number;
  owners: string; // e.g., "10,000,000 .. 20,000,000"
  average_forever: number;
  average_2weeks: number;
  median_forever: number;
  median_2weeks: number;
  price: string; // in cents, as string
  initialprice: string;
  discount: string;
  ccu: number;
  languages: string;
  genre: string;
  tags: Record<string, number>; // tag name -> vote count
}

/**
 * SteamSpy "all" endpoint response - simplified app data
 */
export interface SteamSpyAppSummary {
  appid: number;
  name: string;
  developer: string;
  publisher: string;
  positive: number;
  negative: number;
  owners: string;
  average_forever: number;
  average_2weeks: number;
  median_forever: number;
  median_2weeks: number;
  price: string;
  initialprice: string;
  discount: string;
  ccu: number;
}

/**
 * Parse owner estimate string into min/max values
 * e.g., "10,000,000 .. 20,000,000" -> { min: 10000000, max: 20000000 }
 */
export function parseOwnerEstimate(owners: string): { min: number; max: number } {
  const cleaned = owners.replace(/,/g, '');
  const match = cleaned.match(/(\d+)\s*\.\.\s*(\d+)/);

  if (match) {
    return {
      min: parseInt(match[1], 10),
      max: parseInt(match[2], 10),
    };
  }

  // Handle single value case
  const single = parseInt(cleaned, 10);
  if (!isNaN(single)) {
    return { min: single, max: single };
  }

  return { min: 0, max: 0 };
}

/**
 * Fetch detailed information for a single app from SteamSpy
 * Rate limit: 1 request per second
 *
 * @param appid - Steam app ID
 * @returns App details or null if not found
 */
export async function fetchSteamSpyAppDetails(
  appid: number
): Promise<SteamSpyAppDetails | null> {
  await rateLimiters.steamspyGeneral.acquire();

  const url = `${API_URLS.STEAMSPY}?request=appdetails&appid=${appid}`;

  try {
    const response = await withRetry(async () => {
      const res = await fetch(url);

      if (!res.ok) {
        throw new ApiError(`Failed to fetch SteamSpy details for ${appid}`, res.status, url);
      }

      return res.json() as Promise<SteamSpyAppDetails>;
    });

    // SteamSpy returns an empty object or object with just appid for missing apps
    if (!response.name) {
      return null;
    }

    return response;
  } catch (error) {
    log.error('Failed to fetch SteamSpy app details', { appid, error });
    return null;
  }
}

/**
 * Fetch a page of apps from SteamSpy's "all" endpoint
 * Rate limit: 1 request per 60 seconds
 *
 * @param page - Page number (0-indexed)
 * @returns Object with appid as key and app summary as value
 */
export async function fetchSteamSpyAllPage(
  page: number
): Promise<Record<string, SteamSpyAppSummary>> {
  await rateLimiters.steamspyAll.acquire();

  const url = `${API_URLS.STEAMSPY}?request=all&page=${page}`;

  log.info('Fetching SteamSpy all page', { page });

  const response = await withRetry(async () => {
    const res = await fetch(url);

    if (!res.ok) {
      throw new ApiError(`Failed to fetch SteamSpy all page ${page}`, res.status, url);
    }

    // Handle empty/invalid JSON responses (end of pages)
    const text = await res.text();
    if (!text || text.trim() === '') {
      log.info('SteamSpy returned empty response, treating as end of pages', { page });
      return {} as Record<string, SteamSpyAppSummary>;
    }

    try {
      return JSON.parse(text) as Record<string, SteamSpyAppSummary>;
    } catch {
      log.info('SteamSpy returned invalid JSON, treating as end of pages', { page });
      return {} as Record<string, SteamSpyAppSummary>;
    }
  });

  const count = Object.keys(response).length;
  log.info('Fetched SteamSpy all page', { page, count });

  return response;
}

/**
 * Fetch all apps from SteamSpy by paginating through the "all" endpoint
 * This is rate limited to 1 request per 60 seconds, so it takes a while.
 *
 * @param maxPages - Maximum number of pages to fetch (0 = all)
 * @param onPage - Callback for each page fetched
 * @returns Array of all apps
 */
export async function fetchAllSteamSpyApps(
  maxPages = 0,
  onPage?: (apps: SteamSpyAppSummary[], page: number) => Promise<void>
): Promise<SteamSpyAppSummary[]> {
  const allApps: SteamSpyAppSummary[] = [];
  let page = 0;

  while (true) {
    const pageData = await fetchSteamSpyAllPage(page);
    const apps = Object.values(pageData);

    if (apps.length === 0) {
      log.info('Reached end of SteamSpy catalog', { totalPages: page, totalApps: allApps.length });
      break;
    }

    allApps.push(...apps);

    if (onPage) {
      await onPage(apps, page);
    }

    page++;

    // Check max pages limit
    if (maxPages > 0 && page >= maxPages) {
      log.info('Reached max pages limit', { maxPages, totalApps: allApps.length });
      break;
    }

    // Safety check - SteamSpy typically has ~100 pages
    if (page > 150) {
      log.warn('Exceeded expected page count, stopping', { page });
      break;
    }
  }

  return allApps;
}

/**
 * Fetch apps by genre
 */
export async function fetchSteamSpyByGenre(
  genre: string
): Promise<Record<string, SteamSpyAppSummary>> {
  await rateLimiters.steamspyGeneral.acquire();

  const url = `${API_URLS.STEAMSPY}?request=genre&genre=${encodeURIComponent(genre)}`;

  const response = await withRetry(async () => {
    const res = await fetch(url);

    if (!res.ok) {
      throw new ApiError(`Failed to fetch SteamSpy genre ${genre}`, res.status, url);
    }

    return res.json() as Promise<Record<string, SteamSpyAppSummary>>;
  });

  return response;
}

/**
 * Fetch apps by tag
 */
export async function fetchSteamSpyByTag(
  tag: string
): Promise<Record<string, SteamSpyAppSummary>> {
  await rateLimiters.steamspyGeneral.acquire();

  const url = `${API_URLS.STEAMSPY}?request=tag&tag=${encodeURIComponent(tag)}`;

  const response = await withRetry(async () => {
    const res = await fetch(url);

    if (!res.ok) {
      throw new ApiError(`Failed to fetch SteamSpy tag ${tag}`, res.status, url);
    }

    return res.json() as Promise<Record<string, SteamSpyAppSummary>>;
  });

  return response;
}

/**
 * Fetch top 100 games by players in last 2 weeks
 */
export async function fetchSteamSpyTop100In2Weeks(): Promise<Record<string, SteamSpyAppSummary>> {
  await rateLimiters.steamspyGeneral.acquire();

  const url = `${API_URLS.STEAMSPY}?request=top100in2weeks`;

  const response = await withRetry(async () => {
    const res = await fetch(url);

    if (!res.ok) {
      throw new ApiError('Failed to fetch SteamSpy top 100 in 2 weeks', res.status, url);
    }

    return res.json() as Promise<Record<string, SteamSpyAppSummary>>;
  });

  return response;
}

/**
 * Fetch top 100 games by all-time players
 */
export async function fetchSteamSpyTop100Forever(): Promise<Record<string, SteamSpyAppSummary>> {
  await rateLimiters.steamspyGeneral.acquire();

  const url = `${API_URLS.STEAMSPY}?request=top100forever`;

  const response = await withRetry(async () => {
    const res = await fetch(url);

    if (!res.ok) {
      throw new ApiError('Failed to fetch SteamSpy top 100 forever', res.status, url);
    }

    return res.json() as Promise<Record<string, SteamSpyAppSummary>>;
  });

  return response;
}
