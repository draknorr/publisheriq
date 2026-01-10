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
 * Status of a CCU fetch result
 * - valid: Steam returned result:1 with player count
 * - invalid: Steam returned result:42 (app doesn't support CCU - DLC, unreleased, etc.)
 * - error: Network/timeout/server error (transient, should retry)
 */
export type CCUFetchStatus = 'valid' | 'invalid' | 'error';

/**
 * Result from a single CCU fetch with status tracking
 */
export interface CCUResultWithStatus {
  status: CCUFetchStatus;
  playerCount?: number;
}

/**
 * Fetch CCU with status tracking for skip logic
 *
 * Unlike fetchSteamCCU, this distinguishes between:
 * - invalid: result:42 (should skip for 30 days)
 * - error: network/timeout (should retry, NOT skip)
 *
 * @param appid - Steam app ID
 * @returns CCUResultWithStatus with status and optional player count
 */
export async function fetchSteamCCUWithStatus(appid: number): Promise<CCUResultWithStatus> {
  await rateLimiters.steamCCU.acquire();

  const url = `${API_URLS.STEAM_WEB}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`;

  try {
    const res = await fetch(url);

    // Try to parse body even on 404 (Steam sends JSON with result:42)
    let data: CCUResponse | null = null;
    try {
      data = (await res.json()) as CCUResponse;
    } catch {
      // Body parse failed - treat as error, NOT invalid
      log.debug('Failed to parse CCU response body', { appid, status: res.status });
      return { status: 'error' };
    }

    // ONLY mark invalid if result === 42 (definitive from Steam)
    if (data?.response?.result === 42) {
      log.debug('Steam CCU returned invalid appid', { appid });
      return { status: 'invalid' };
    }

    // Success case
    if (data?.response?.result === 1) {
      return { status: 'valid', playerCount: data.response.player_count };
    }

    // Unknown response format - treat as error, NOT invalid
    log.debug('Steam CCU returned unexpected result', { appid, result: data?.response?.result });
    return { status: 'error' };
  } catch (error) {
    // Network error, timeout, etc. - NEVER mark as invalid
    log.debug('CCU fetch failed with network error', { appid, error });
    return { status: 'error' };
  }
}

/**
 * Result from batch CCU fetch with status tracking
 */
export interface CCUBatchResultWithStatus {
  /** Map of appid to result with status */
  results: Map<number, CCUResultWithStatus>;
  /** Number of valid fetches (result:1) */
  validCount: number;
  /** Number of invalid appids (result:42) */
  invalidCount: number;
  /** Number of errors (network/timeout) */
  errorCount: number;
}

/**
 * Fetch CCU for multiple apps with status tracking
 *
 * Returns detailed status for each appid to enable skip logic.
 *
 * @param appids - Array of Steam app IDs to fetch
 * @param onProgress - Optional callback for progress updates
 * @returns Map of appid to CCUResultWithStatus
 */
export async function fetchSteamCCUBatchWithStatus(
  appids: number[],
  onProgress?: (processed: number, total: number) => void
): Promise<CCUBatchResultWithStatus> {
  const results = new Map<number, CCUResultWithStatus>();
  let validCount = 0;
  let invalidCount = 0;
  let errorCount = 0;

  for (let i = 0; i < appids.length; i++) {
    const appid = appids[i];
    const result = await fetchSteamCCUWithStatus(appid);

    results.set(appid, result);

    if (result.status === 'valid') {
      validCount++;
    } else if (result.status === 'invalid') {
      invalidCount++;
    } else {
      errorCount++;
    }

    if (onProgress && (i + 1) % 100 === 0) {
      onProgress(i + 1, appids.length);
    }
  }

  log.info('Batch CCU fetch with status complete', {
    total: appids.length,
    validCount,
    invalidCount,
    errorCount,
  });

  return { results, validCount, invalidCount, errorCount };
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
