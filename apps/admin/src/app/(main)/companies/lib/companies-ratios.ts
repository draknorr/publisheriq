/**
 * Ratio computation utilities for Companies table
 * M5: Column Customization & Visualizations
 */

import type { Company } from './companies-types';

/**
 * Compute Revenue per Game
 * Total estimated revenue / game count
 */
export function computeRevenuePerGame(company: Company): number | null {
  if (company.game_count === 0) return null;
  return company.revenue_estimate_cents / company.game_count;
}

/**
 * Compute Owners per Game
 * Total owners / game count
 */
export function computeOwnersPerGame(company: Company): number | null {
  if (company.game_count === 0) return null;
  return company.total_owners / company.game_count;
}

/**
 * Compute Reviews per 1K Owners
 * (Total reviews / total owners) * 1000
 * Higher values indicate more engaged audiences
 */
export function computeReviewsPer1kOwners(company: Company): number | null {
  if (company.total_owners === 0) return null;
  return (company.total_reviews / company.total_owners) * 1000;
}

/**
 * All ratio computations
 */
export const ratioComputations = {
  revenue_per_game: computeRevenuePerGame,
  owners_per_game: computeOwnersPerGame,
  reviews_per_1k_owners: computeReviewsPer1kOwners,
} as const;

export type RatioColumnId = keyof typeof ratioComputations;

/**
 * Check if a column ID is a ratio column
 */
export function isRatioColumnId(id: string): id is RatioColumnId {
  return id in ratioComputations;
}
