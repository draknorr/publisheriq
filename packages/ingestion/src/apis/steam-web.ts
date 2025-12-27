import { API_URLS, logger, ApiError } from '@publisheriq/shared';
import { withRetry } from '../utils/retry.js';

const log = logger.child({ component: 'SteamWebAPI' });

/**
 * Response from Steam's GetAppList API
 */
interface AppListResponse {
  applist: {
    apps: Array<{
      appid: number;
      name: string;
    }>;
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
 * Fetch the complete list of all apps on Steam
 * This includes games, DLC, demos, videos, etc.
 *
 * @returns Array of all Steam apps with appid and name
 */
export async function fetchSteamAppList(): Promise<SteamApp[]> {
  const url = `${API_URLS.STEAM_WEB}/ISteamApps/GetAppList/v2/`;

  log.info('Fetching Steam app list');

  const response = await withRetry(async () => {
    const res = await fetch(url);

    if (!res.ok) {
      throw new ApiError(`Failed to fetch app list: ${res.statusText}`, res.status, url);
    }

    return res.json() as Promise<AppListResponse>;
  });

  const apps = response.applist.apps;
  log.info('Fetched Steam app list', { count: apps.length });

  return apps;
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
