import { API_URLS, logger, ApiError } from '@publisheriq/shared';
import { withRetry } from '../utils/retry.js';

const log = logger.child({ component: 'SteamWebAPI' });

/**
 * Response from Steam's IStoreService/GetAppList API
 */
interface StoreAppListResponse {
  response: {
    apps: Array<{
      appid: number;
      name: string;
      last_modified: number;
      price_change_number: number;
    }>;
    have_more_results?: boolean;
    last_appid?: number;
  };
}

/**
 * Simplified app entry from Steam
 */
export interface SteamApp {
  appid: number;
  name: string;
}

/**
 * Fetch the complete list of all apps on Steam using IStoreService
 * This is the recommended endpoint as ISteamApps/GetAppList is deprecated.
 * Requires a Steam Web API key.
 *
 * @returns Array of all Steam apps with appid and name
 */
export async function fetchSteamAppList(): Promise<SteamApp[]> {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) {
    throw new Error('STEAM_API_KEY environment variable is required');
  }

  const allApps: SteamApp[] = [];
  let lastAppId: number | undefined;
  let hasMore = true;
  let pageCount = 0;

  log.info('Fetching Steam app list from IStoreService');

  while (hasMore) {
    pageCount++;
    const url = new URL(`${API_URLS.STEAM_WEB}/IStoreService/GetAppList/v1/`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('max_results', '50000');
    if (lastAppId !== undefined) {
      url.searchParams.set('last_appid', lastAppId.toString());
    }

    const response = await withRetry(async () => {
      const res = await fetch(url.toString());

      if (!res.ok) {
        throw new ApiError(`Failed to fetch app list: ${res.statusText}`, res.status, url.toString());
      }

      return res.json() as Promise<StoreAppListResponse>;
    });

    const apps = response.response.apps || [];
    for (const app of apps) {
      allApps.push({
        appid: app.appid,
        name: app.name,
      });
    }

    hasMore = response.response.have_more_results === true;
    lastAppId = response.response.last_appid;

    log.info('Fetched app list page', { page: pageCount, appsInPage: apps.length, totalApps: allApps.length });
  }

  log.info('Fetched complete Steam app list', { count: allApps.length, pages: pageCount });

  return allApps;
}

/**
 * Get news for a specific app
 */
interface NewsItem {
  gid: string;
  title: string;
  url: string;
  author: string;
  contents: string;
  feedlabel: string;
  date: number;
  feedname: string;
}

interface NewsResponse {
  appnews: {
    appid: number;
    newsitems: NewsItem[];
    count: number;
  };
}

/**
 * Fetch news/announcements for a specific app
 *
 * @param appid - Steam app ID
 * @param count - Number of news items to fetch (max 100)
 * @returns Array of news items
 */
export async function fetchAppNews(appid: number, count = 10): Promise<NewsItem[]> {
  const url = `${API_URLS.STEAM_WEB}/ISteamNews/GetNewsForApp/v2/?appid=${appid}&count=${count}`;

  const response = await withRetry(async () => {
    const res = await fetch(url);

    if (!res.ok) {
      throw new ApiError(`Failed to fetch news for app ${appid}`, res.status, url);
    }

    return res.json() as Promise<NewsResponse>;
  });

  return response.appnews?.newsitems || [];
}
