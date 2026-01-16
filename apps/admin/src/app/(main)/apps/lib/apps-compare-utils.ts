/**
 * Shared utilities for compare param parsing
 * Can be used on both server and client
 */

const MIN_COMPARE = 2;
const MAX_COMPARE = 5;

/**
 * Parse compare param from URL: "730,1245620,553850"
 */
export function parseCompareParam(param: string | null): number[] {
  if (!param) return [];

  const ids = param
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);

  // Deduplicate and limit to MAX_COMPARE
  return [...new Set(ids)].slice(0, MAX_COMPARE);
}

/**
 * Serialize app IDs to URL param format
 * Returns null if fewer than MIN_COMPARE IDs
 */
export function serializeCompareParam(appids: number[]): string | null {
  const deduped = [...new Set(appids)].slice(0, MAX_COMPARE);
  if (deduped.length < MIN_COMPARE) return null;
  return deduped.join(',');
}
