/**
 * Trend Discovery Service
 *
 * Discovers games with trend momentum based on review activity using Cube.js.
 * Provides a simplified interface for trend-based queries.
 */

import { executeCubeQuery } from '../cube-executor';

/**
 * Arguments for discover_trending tool
 */
export interface DiscoverTrendingArgs {
  trend_type: 'review_momentum' | 'accelerating' | 'breaking_out' | 'declining';
  timeframe?: '7d' | '30d';
  filters?: {
    tags?: string[];
    genres?: string[];
    platforms?: ('windows' | 'macos' | 'linux')[];
    steam_deck?: ('verified' | 'playable')[];
    min_reviews?: number;
    max_reviews?: number;
    is_free?: boolean;
    release_year?: { gte?: number; lte?: number };
  };
  limit?: number;
}

/**
 * Result from discover_trending
 */
export interface DiscoverTrendingResult {
  success: boolean;
  trend_type: string;
  timeframe: string;
  results?: Array<{
    appid: number;
    name: string;
    velocity7d: number | null;
    velocity30d: number | null;
    velocityTier: string | null;
    reviewsAdded7d: number | null;
    reviewsAdded30d: number | null;
    totalReviews: number | null;
    reviewPercentage: number | null;
  }>;
  total_found?: number;
  filters_applied?: string[];
  error?: string;
}

// Maximum results to prevent expensive queries
const MAX_RESULTS = 20;
const DEFAULT_RESULTS = 10;

/**
 * Discover games with trend momentum
 */
export async function discoverTrending(args: DiscoverTrendingArgs): Promise<DiscoverTrendingResult> {
  const {
    trend_type,
    timeframe = '7d',
    filters = {},
    limit = DEFAULT_RESULTS,
  } = args;

  const filtersApplied: string[] = [`trend_type: ${trend_type}`, `timeframe: ${timeframe}`];
  const actualLimit = Math.min(limit, MAX_RESULTS);

  try {
    // Build Cube.js query
    const cubeQuery: {
      cube: string;
      dimensions: string[];
      filters: Array<{ member: string; operator: string; values?: (string | number | boolean)[] }>;
      segments: string[];
      order: Record<string, 'asc' | 'desc'>;
      limit: number;
    } = {
      cube: 'Discovery',
      dimensions: [
        'Discovery.appid',
        'Discovery.name',
        'Discovery.velocity7d',
        'Discovery.velocity30d',
        'Discovery.velocityTier',
        'Discovery.reviewsAdded7d',
        'Discovery.reviewsAdded30d',
        'Discovery.totalReviews',
        'Discovery.reviewPercentage',
      ],
      filters: [
        // Require velocity data to exist
        { member: 'Discovery.velocity7d', operator: 'set' },
      ],
      segments: [],
      order: {},
      limit: actualLimit,
    };

    // Apply trend-type specific logic
    switch (trend_type) {
      case 'review_momentum':
        // Games with highest review activity
        cubeQuery.segments.push('Discovery.activelyReviewed');
        cubeQuery.order = timeframe === '7d'
          ? { 'Discovery.velocity7d': 'desc' }
          : { 'Discovery.velocity30d': 'desc' };
        break;

      case 'accelerating':
        // Games where review rate is increasing (7d > 30d × 1.2)
        cubeQuery.segments.push('Discovery.acceleratingVelocity');
        cubeQuery.order = { 'Discovery.velocity7d': 'desc' };
        break;

      case 'breaking_out':
        // Hidden gems gaining attention: accelerating + moderate review count
        cubeQuery.segments.push('Discovery.acceleratingVelocity');
        cubeQuery.filters.push(
          { member: 'Discovery.totalReviews', operator: 'gte', values: [100] },
          { member: 'Discovery.totalReviews', operator: 'lt', values: [10000] }
        );
        cubeQuery.order = { 'Discovery.velocity7d': 'desc' };
        filtersApplied.push('totalReviews: 100-10000 (hidden gems)');
        break;

      case 'declining':
        // Games where review velocity is dropping (7d < 30d × 0.8)
        cubeQuery.segments.push('Discovery.deceleratingVelocity');
        cubeQuery.order = { 'Discovery.velocity30d': 'desc' };
        break;
    }

    // Apply optional filters
    if (filters.min_reviews !== undefined) {
      cubeQuery.filters.push({
        member: 'Discovery.totalReviews',
        operator: 'gte',
        values: [filters.min_reviews],
      });
      filtersApplied.push(`min_reviews: ${filters.min_reviews}`);
    }

    if (filters.max_reviews !== undefined) {
      cubeQuery.filters.push({
        member: 'Discovery.totalReviews',
        operator: 'lte',
        values: [filters.max_reviews],
      });
      filtersApplied.push(`max_reviews: ${filters.max_reviews}`);
    }

    if (filters.is_free !== undefined) {
      cubeQuery.filters.push({
        member: 'Discovery.isFree',
        operator: 'equals',
        values: [filters.is_free],
      });
      filtersApplied.push(`is_free: ${filters.is_free}`);
    }

    if (filters.release_year?.gte !== undefined) {
      cubeQuery.filters.push({
        member: 'Discovery.releaseYear',
        operator: 'gte',
        values: [filters.release_year.gte],
      });
      filtersApplied.push(`release_year >= ${filters.release_year.gte}`);
    }

    if (filters.release_year?.lte !== undefined) {
      cubeQuery.filters.push({
        member: 'Discovery.releaseYear',
        operator: 'lte',
        values: [filters.release_year.lte],
      });
      filtersApplied.push(`release_year <= ${filters.release_year.lte}`);
    }

    if (filters.platforms && filters.platforms.length > 0) {
      // Use platform boolean dimensions
      for (const platform of filters.platforms) {
        const platformField = platform === 'windows' ? 'hasWindows' :
                             platform === 'macos' ? 'hasMac' :
                             platform === 'linux' ? 'hasLinux' : null;
        if (platformField) {
          cubeQuery.filters.push({
            member: `Discovery.${platformField}`,
            operator: 'equals',
            values: [true],
          });
        }
      }
      filtersApplied.push(`platforms: ${filters.platforms.join(', ')}`);
    }

    if (filters.steam_deck && filters.steam_deck.length > 0) {
      // Add Steam Deck segment based on requirements
      if (filters.steam_deck.includes('verified')) {
        cubeQuery.segments.push('Discovery.steamDeckVerified');
      } else if (filters.steam_deck.includes('playable')) {
        cubeQuery.segments.push('Discovery.steamDeckPlayable');
      }
      filtersApplied.push(`steam_deck: ${filters.steam_deck.join(', ')}`);
    }

    // Note: tags and genres filtering would require additional JOINs
    // For simplicity, we'll log that these filters need the search_games tool
    if (filters.tags && filters.tags.length > 0) {
      console.log('[TrendDiscovery] Tags filter requested - suggest using search_games for tag filtering');
      filtersApplied.push(`tags: ${filters.tags.join(', ')} (note: use search_games for full tag support)`);
    }

    if (filters.genres && filters.genres.length > 0) {
      console.log('[TrendDiscovery] Genres filter requested - suggest using search_games for genre filtering');
      filtersApplied.push(`genres: ${filters.genres.join(', ')} (note: use search_games for full genre support)`);
    }

    // Execute query
    const result = await executeCubeQuery(cubeQuery);

    if (!result.success) {
      return {
        success: false,
        trend_type,
        timeframe,
        error: result.error,
        filters_applied: filtersApplied,
      };
    }

    // Map results to expected format
    const results = result.data.map((row) => ({
      appid: row.appid as number,
      name: row.name as string,
      velocity7d: row.velocity7d as number | null,
      velocity30d: row.velocity30d as number | null,
      velocityTier: row.velocityTier as string | null,
      reviewsAdded7d: row.reviewsAdded7d as number | null,
      reviewsAdded30d: row.reviewsAdded30d as number | null,
      totalReviews: row.totalReviews as number | null,
      reviewPercentage: row.reviewPercentage as number | null,
    }));

    return {
      success: true,
      trend_type,
      timeframe,
      results,
      total_found: results.length,
      filters_applied: filtersApplied,
    };
  } catch (error) {
    return {
      success: false,
      trend_type,
      timeframe,
      error: error instanceof Error ? error.message : 'Trend discovery failed',
      filters_applied: filtersApplied,
    };
  }
}
