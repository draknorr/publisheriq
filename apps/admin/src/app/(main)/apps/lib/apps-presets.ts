/**
 * Preset views and quick filter definitions for the Games page
 * User-facing: "Games" | Technical: "apps"
 */

import type {
  PresetId,
  QuickFilterId,
  UnifiedFilterId,
  SortField,
  SortOrder,
  AppsFilterParams,
  PublisherSize,
} from './apps-types';

export type { UnifiedFilterId } from './apps-types';

/**
 * Preset filter values (subset of AppsFilterParams)
 */
export interface PresetFilters {
  minCcu?: number;
  maxCcu?: number;
  minOwners?: number;
  maxOwners?: number;
  minReviews?: number;
  minScore?: number;
  minGrowth7d?: number;
  maxGrowth7d?: number;
  minMomentum?: number;
  minSentimentDelta?: number;
  minReviewRate?: number;
  minValueScore?: number;
  minVsPublisher?: number;
  minAge?: number;
  maxAge?: number;
  isFree?: boolean;
}

/**
 * Preset view definition
 */
export interface AppsPreset {
  id: PresetId;
  label: string;
  emoji?: string;
  description: string;
  tooltip: string;
  filters: PresetFilters;
  sort: SortField;
  order: SortOrder;
}

/**
 * Quick filter values (subset of AppsFilterParams)
 */
export interface QuickFilterValues {
  minCcu?: number;
  minGrowth7d?: number;
  minScore?: number;
  isFree?: boolean;
  publisherSize?: PublisherSize;
  steamDeck?: string[];
  minMomentum?: number;
  minSentimentDelta?: number;
  hasWorkshop?: boolean;
  earlyAccess?: boolean;
  minDiscount?: number;
  maxAge?: number;
}

/**
 * Quick filter definition
 */
export interface AppsQuickFilter {
  id: QuickFilterId;
  label: string;
  description: string;
  filters: QuickFilterValues;
}

/**
 * All 12 preset views per spec
 */
export const PRESETS: AppsPreset[] = [
  {
    id: 'top_games',
    label: 'Top Games',
    description: 'Most popular games by current players',
    tooltip: 'Games with 1,000+ peak CCU, ranked by concurrent players',
    filters: {
      minCcu: 1000,
    },
    sort: 'ccu_peak',
    order: 'desc',
  },
  {
    id: 'rising_stars',
    label: 'Rising Stars',
    description: 'Growing games with 25%+ weekly growth',
    tooltip: 'Games with 25%+ weekly growth and under 500K owners',
    filters: {
      minGrowth7d: 25,
      maxOwners: 500_000,
    },
    sort: 'ccu_growth_7d_percent',
    order: 'desc',
  },
  {
    id: 'hidden_gems',
    label: 'Hidden Gems',
    description: 'Highly rated but under the radar',
    tooltip: 'Games with 90%+ positive reviews, under 50K owners, at least 100 reviews',
    filters: {
      minScore: 90,
      maxOwners: 50_000,
      minReviews: 100,
    },
    sort: 'review_score',
    order: 'desc',
  },
  {
    id: 'new_releases',
    label: 'New Releases',
    description: 'Released in the last 30 days',
    tooltip: 'Games released within the last 30 days, newest first',
    filters: {
      maxAge: 30,
    },
    sort: 'release_date',
    order: 'desc',
  },
  {
    id: 'breakout_hits',
    label: 'Breakout Hits',
    description: 'New games with explosive growth',
    tooltip: 'Games with 50%+ weekly growth released in the last 90 days',
    filters: {
      minGrowth7d: 50,
      maxAge: 90,
    },
    sort: 'ccu_growth_7d_percent',
    order: 'desc',
  },
  {
    id: 'high_momentum',
    label: 'High Momentum',
    emoji: '🔥',
    description: 'Games with strong upward trajectory',
    tooltip: 'Combined CCU growth + review velocity score of 15+, with 500+ CCU',
    filters: {
      minMomentum: 15,
      minCcu: 500,
    },
    sort: 'momentum_score',
    order: 'desc',
  },
  {
    id: 'comeback_stories',
    label: 'Comeback Stories',
    emoji: '📈',
    description: 'Games with improving sentiment',
    tooltip: 'Games with 5%+ sentiment improvement and 1,000+ reviews',
    filters: {
      minSentimentDelta: 5,
      minReviews: 1000,
    },
    sort: 'sentiment_delta',
    order: 'desc',
  },
  {
    id: 'evergreen',
    label: 'Evergreen',
    emoji: '🌲',
    description: 'Classic games still thriving',
    tooltip: 'Games 2+ years old with 1,000+ CCU and 80%+ positive reviews',
    filters: {
      minAge: 730, // 2 years
      minCcu: 1000,
      minScore: 80,
    },
    sort: 'ccu_peak',
    order: 'desc',
  },
  {
    id: 'true_gems',
    label: 'True Gems',
    emoji: '💎',
    description: 'Highly rated with engaged communities',
    tooltip: 'Games with 90%+ reviews, under 50K owners, and high review engagement',
    filters: {
      minScore: 90,
      maxOwners: 50_000,
      minReviewRate: 5,
    },
    sort: 'review_rate',
    order: 'desc',
  },
  {
    id: 'best_value',
    label: 'Best Value',
    emoji: '💰',
    description: 'Most entertainment per dollar',
    tooltip: 'Games with 2+ hours of playtime per dollar and 75%+ positive reviews',
    filters: {
      minValueScore: 2,
      minScore: 75,
    },
    sort: 'value_score',
    order: 'desc',
  },
  {
    id: 'publishers_best',
    label: "Publisher's Best",
    emoji: '🏆',
    description: 'Games outperforming their publisher average',
    tooltip: 'Games scoring 10+ points above their publisher average review score',
    filters: {
      minVsPublisher: 10,
    },
    sort: 'vs_publisher_avg',
    order: 'desc',
  },
  {
    id: 'f2p_leaders',
    label: 'F2P Leaders',
    emoji: '🆓',
    description: 'Most popular free-to-play games',
    tooltip: 'Free games with 5,000+ concurrent players',
    filters: {
      isFree: true,
      minCcu: 5000,
    },
    sort: 'ccu_peak',
    order: 'desc',
  },
];

/**
 * All 12 quick filters per spec
 */
export const QUICK_FILTERS: AppsQuickFilter[] = [
  {
    id: 'popular',
    label: 'Popular',
    description: '1,000+ concurrent players',
    filters: {
      minCcu: 1000,
    },
  },
  {
    id: 'trending',
    label: 'Trending ↑',
    description: '10%+ weekly growth',
    filters: {
      minGrowth7d: 10,
    },
  },
  {
    id: 'well_reviewed',
    label: 'Well Reviewed',
    description: '85%+ positive reviews',
    filters: {
      minScore: 85,
    },
  },
  {
    id: 'free',
    label: 'Free',
    description: 'Free to play',
    filters: {
      isFree: true,
    },
  },
  {
    id: 'indie',
    label: 'Indie',
    description: 'Publisher with <10 games',
    filters: {
      publisherSize: 'indie',
    },
  },
  {
    id: 'steam_deck',
    label: 'Steam Deck',
    description: 'Verified or Playable on Steam Deck',
    filters: {
      steamDeck: ['verified', 'playable'],
    },
  },
  {
    id: 'momentum_up',
    label: 'Momentum ↑',
    description: 'Momentum score 10+',
    filters: {
      minMomentum: 10,
    },
  },
  {
    id: 'sentiment_up',
    label: 'Sentiment ↑',
    description: 'Improving sentiment (3%+ delta)',
    filters: {
      minSentimentDelta: 3,
    },
  },
  {
    id: 'workshop',
    label: 'Workshop',
    description: 'Has Steam Workshop support',
    filters: {
      hasWorkshop: true,
    },
  },
  {
    id: 'early_access',
    label: 'Early Access',
    description: 'Currently in Early Access',
    filters: {
      earlyAccess: true,
    },
  },
  {
    id: 'on_sale',
    label: 'On Sale',
    description: 'Currently discounted',
    filters: {
      minDiscount: 1,
    },
  },
  {
    id: 'this_week',
    label: 'This Week',
    description: 'Released in the last 7 days',
    filters: {
      maxAge: 7,
    },
  },
];

/**
 * Get a preset by ID
 */
export function getPresetById(id: PresetId): AppsPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/**
 * Get a quick filter by ID
 */
export function getQuickFilterById(id: QuickFilterId): AppsQuickFilter | undefined {
  return QUICK_FILTERS.find((f) => f.id === id);
}

/**
 * Check if a string is a valid preset ID
 */
export function isValidPresetId(id: string): id is PresetId {
  return PRESETS.some((p) => p.id === id);
}

/**
 * Check if a string is a valid quick filter ID
 */
export function isValidQuickFilterId(id: string): id is QuickFilterId {
  return QUICK_FILTERS.some((f) => f.id === id);
}

/**
 * Build filter params from active quick filters
 * Merges filters with MAX for min values, MIN for max values
 */
export function buildQuickFilterParams(
  activeFilters: QuickFilterId[]
): Partial<AppsFilterParams> {
  const params: Partial<AppsFilterParams> = {};

  for (const filterId of activeFilters) {
    const filter = getQuickFilterById(filterId);
    if (!filter) continue;

    const { filters } = filter;

    // Merge min values (take maximum)
    if (filters.minCcu !== undefined) {
      params.minCcu = Math.max(params.minCcu ?? 0, filters.minCcu);
    }
    if (filters.minGrowth7d !== undefined) {
      params.minGrowth7d = Math.max(params.minGrowth7d ?? -Infinity, filters.minGrowth7d);
    }
    if (filters.minScore !== undefined) {
      params.minScore = Math.max(params.minScore ?? 0, filters.minScore);
    }
    if (filters.minMomentum !== undefined) {
      params.minMomentum = Math.max(params.minMomentum ?? -Infinity, filters.minMomentum);
    }
    if (filters.minSentimentDelta !== undefined) {
      params.minSentimentDelta = Math.max(
        params.minSentimentDelta ?? -Infinity,
        filters.minSentimentDelta
      );
    }
    if (filters.minDiscount !== undefined) {
      params.minDiscount = Math.max(params.minDiscount ?? 0, filters.minDiscount);
    }

    // Merge max values (take minimum)
    if (filters.maxAge !== undefined) {
      params.maxAge = Math.min(params.maxAge ?? Infinity, filters.maxAge);
    }

    // Boolean filters (OR logic - if any filter wants true, result is true)
    if (filters.isFree) {
      params.isFree = true;
    }
    if (filters.hasWorkshop) {
      params.hasWorkshop = true;
    }
    if (filters.earlyAccess) {
      params.earlyAccess = true;
    }

    // String filters (last one wins)
    if (filters.publisherSize) {
      params.publisherSize = filters.publisherSize;
    }

    // Array filters (combine)
    if (filters.steamDeck) {
      params.steamDeck = filters.steamDeck.join(',');
    }
  }

  // Clean up Infinity values
  if (params.maxAge === Infinity) delete params.maxAge;
  if (params.minGrowth7d === -Infinity) delete params.minGrowth7d;
  if (params.minMomentum === -Infinity) delete params.minMomentum;
  if (params.minSentimentDelta === -Infinity) delete params.minSentimentDelta;

  return params;
}

/**
 * Build filter params from a preset
 */
export function buildPresetFilterParams(
  presetId: PresetId
): Partial<AppsFilterParams> | undefined {
  const preset = getPresetById(presetId);
  if (!preset) return undefined;

  const params: Partial<AppsFilterParams> = {
    sort: preset.sort,
    order: preset.order,
  };

  const { filters } = preset;

  if (filters.minCcu !== undefined) params.minCcu = filters.minCcu;
  if (filters.maxCcu !== undefined) params.maxCcu = filters.maxCcu;
  if (filters.minOwners !== undefined) params.minOwners = filters.minOwners;
  if (filters.maxOwners !== undefined) params.maxOwners = filters.maxOwners;
  if (filters.minReviews !== undefined) params.minReviews = filters.minReviews;
  if (filters.minScore !== undefined) params.minScore = filters.minScore;
  if (filters.minGrowth7d !== undefined) params.minGrowth7d = filters.minGrowth7d;
  if (filters.maxGrowth7d !== undefined) params.maxGrowth7d = filters.maxGrowth7d;
  if (filters.minMomentum !== undefined) params.minMomentum = filters.minMomentum;
  if (filters.minSentimentDelta !== undefined) params.minSentimentDelta = filters.minSentimentDelta;
  if (filters.minReviewRate !== undefined) params.minReviewRate = filters.minReviewRate;
  if (filters.minValueScore !== undefined) params.minValueScore = filters.minValueScore;
  if (filters.minVsPublisher !== undefined) params.minVsPublisher = filters.minVsPublisher;
  if (filters.minAge !== undefined) params.minAge = filters.minAge;
  if (filters.maxAge !== undefined) params.maxAge = filters.maxAge;
  if (filters.isFree !== undefined) params.isFree = filters.isFree;

  return params;
}

// ============================================================================
// Unified Filter System
// Combines presets (exclusive) and quick filters (stackable) into one system
// ============================================================================

/**
 * Unified filter combining presets and quick filters
 */
export interface UnifiedFilter {
  id: UnifiedFilterId;
  type: 'preset' | 'quick';
  label: string;
  emoji?: string;
  tooltip: string;
  filters: PresetFilters | QuickFilterValues;
  sort?: SortField;   // Only for presets
  order?: SortOrder;  // Only for presets
}

/**
 * Unified filters for the filter bar
 * 4 key presets (shown with purple tint) + 12 quick filters (neutral gray)
 */
export const UNIFIED_FILTERS: UnifiedFilter[] = [
  // Presets (shown first, purple tint when inactive)
  {
    id: 'top_games',
    type: 'preset',
    label: 'Top Games',
    tooltip: 'Games with 1,000+ peak CCU, ranked by concurrent players',
    filters: { minCcu: 1000 },
    sort: 'ccu_peak',
    order: 'desc',
  },
  {
    id: 'rising_stars',
    type: 'preset',
    label: 'Rising Stars',
    tooltip: 'Games with 25%+ weekly growth and under 500K owners',
    filters: { minGrowth7d: 25, maxOwners: 500_000 },
    sort: 'ccu_growth_7d_percent',
    order: 'desc',
  },
  {
    id: 'hidden_gems',
    type: 'preset',
    label: 'Hidden Gems',
    emoji: '💎',
    tooltip: 'Games with 90%+ positive reviews, under 50K owners',
    filters: { minScore: 90, maxOwners: 50_000, minReviews: 100 },
    sort: 'review_score',
    order: 'desc',
  },
  {
    id: 'breakout_hits',
    type: 'preset',
    label: 'Breakout Hits',
    emoji: '🚀',
    tooltip: 'Games with 50%+ weekly growth released in the last 90 days',
    filters: { minGrowth7d: 50, maxAge: 90 },
    sort: 'ccu_growth_7d_percent',
    order: 'desc',
  },

  // Quick filters (neutral gray when inactive)
  {
    id: 'popular',
    type: 'quick',
    label: 'Popular',
    tooltip: '1,000+ concurrent players',
    filters: { minCcu: 1000 },
  },
  {
    id: 'trending',
    type: 'quick',
    label: 'Trending ↑',
    tooltip: '10%+ weekly growth',
    filters: { minGrowth7d: 10 },
  },
  {
    id: 'well_reviewed',
    type: 'quick',
    label: 'Well Reviewed',
    tooltip: '85%+ positive reviews',
    filters: { minScore: 85 },
  },
  {
    id: 'free',
    type: 'quick',
    label: 'Free',
    tooltip: 'Free to play',
    filters: { isFree: true },
  },
  {
    id: 'indie',
    type: 'quick',
    label: 'Indie',
    tooltip: 'Publisher with <10 games',
    filters: { publisherSize: 'indie' },
  },
  {
    id: 'steam_deck',
    type: 'quick',
    label: 'Steam Deck',
    tooltip: 'Verified or Playable on Steam Deck',
    filters: { steamDeck: ['verified', 'playable'] },
  },
  {
    id: 'momentum_up',
    type: 'quick',
    label: 'Momentum ↑',
    tooltip: 'Momentum score 10+',
    filters: { minMomentum: 10 },
  },
  {
    id: 'sentiment_up',
    type: 'quick',
    label: 'Sentiment ↑',
    tooltip: 'Improving sentiment (3%+ delta)',
    filters: { minSentimentDelta: 3 },
  },
  {
    id: 'workshop',
    type: 'quick',
    label: 'Workshop',
    tooltip: 'Has Steam Workshop support',
    filters: { hasWorkshop: true },
  },
  {
    id: 'early_access',
    type: 'quick',
    label: 'Early Access',
    tooltip: 'Currently in Early Access',
    filters: { earlyAccess: true },
  },
  {
    id: 'on_sale',
    type: 'quick',
    label: 'On Sale',
    tooltip: 'Currently discounted',
    filters: { minDiscount: 1 },
  },
  {
    id: 'this_week',
    type: 'quick',
    label: 'This Week',
    tooltip: 'Released in the last 7 days',
    filters: { maxAge: 7 },
  },
];

/**
 * Get a unified filter by ID
 */
export function getUnifiedFilterById(id: UnifiedFilterId): UnifiedFilter | undefined {
  return UNIFIED_FILTERS.find((f) => f.id === id);
}

/**
 * Check if a filter ID is a preset
 */
export function isPresetId(id: string): id is PresetId {
  const filter = UNIFIED_FILTERS.find((f) => f.id === id);
  return filter?.type === 'preset';
}

/**
 * Get all preset filters
 */
export function getPresetsOnly(): UnifiedFilter[] {
  return UNIFIED_FILTERS.filter((f) => f.type === 'preset');
}

/**
 * Get all quick filters
 */
export function getQuickFiltersOnly(): UnifiedFilter[] {
  return UNIFIED_FILTERS.filter((f) => f.type === 'quick');
}
