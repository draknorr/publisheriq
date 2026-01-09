import { API_URLS, logger, ApiError } from '@publisheriq/shared';
import { withRetry } from '../utils/retry.js';
import { rateLimiters } from '../utils/rate-limiter.js';

const log = logger.child({ component: 'SteamCCU' });

/**
 * Steam API GetNumberOfCurrentPlayers response
 */
interface CCUResponse {
  response: {
    player_count: number;
    /** 1 = success, 42 = invalid appid */
    result: number;
  };
}

/**
 * Fetch current concurrent player count for a single app from Steam's official API
 *
 * This returns the EXACT player count from Valve - no estimation involved.
 * Rate limit: 1 request per second (conservative)
 *
 * @param appid - Steam app ID
 * @returns Current player count or null if not available
 */
export async function fetchSteamCCU(appid: number): Promise<number | null> {
  await rateLimiters.steamCCU.acquire();

  const url = `${API_URLS.STEAM_WEB}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`;

  try {
    const response = await withRetry(async () => {
      const res = await fetch(url);

      if (!res.ok) {
        throw new ApiError(`Failed to fetch Steam CCU for ${appid}`, res.status, url);
      }

      return res.json() as Promise<CCUResponse>;
    });

    // Result 1 = success, 42 = invalid appid
    if (response.response.result !== 1) {
      log.debug('Steam CCU returned invalid result', { appid, result: response.response.result });
      return null;
    }

    return response.response.player_count;
  } catch (error) {
    log.error('Failed to fetch Steam CCU', { appid, error });
    return null;
  }
}

/**
 * Result from batch CCU fetch
 */
export interface CCUBatchResult {
  /** Map of appid to player count */
  data: Map<number, number>;
  /** Number of successful fetches */
  successCount: number;
  /** Number of failed fetches (errors or invalid appids) */
  failedCount: number;
}

/**
 * Fetch CCU for multiple apps in sequence (rate limited)
 *
 * @param appids - Array of Steam app IDs to fetch
 * @param onProgress - Optional callback for progress updates
 * @returns Map of appid to player count (only includes successful fetches)
 */
export async function fetchSteamCCUBatch(
  appids: number[],
  onProgress?: (processed: number, total: number) => void
): Promise<CCUBatchResult> {
  const results = new Map<number, number>();
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < appids.length; i++) {
    const appid = appids[i];
    const ccu = await fetchSteamCCU(appid);

    if (ccu !== null) {
      results.set(appid, ccu);
      successCount++;
    } else {
      failedCount++;
    }

    if (onProgress && (i + 1) % 100 === 0) {
      onProgress(i + 1, appids.length);
    }
  }

  log.info('Batch CCU fetch complete', {
    total: appids.length,
    successCount,
    failedCount,
  });

  return { data: results, successCount, failedCount };
}
