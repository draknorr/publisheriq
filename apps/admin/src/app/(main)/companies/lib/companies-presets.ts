/**
 * Preset views and quick filter definitions for the Companies page
 */

import type {
  CompanyType,
  SortField,
  SortOrder,
  QuickFilterId,
  PresetId,
  UnifiedFilterId,
} from './companies-types';

/**
 * Preset view definition
 */
export interface Preset {
  id: string;
  label: string;
  emoji?: string;
  description: string;
  tooltip: string;
  filters: {
    type?: CompanyType;
    minGames?: number;
    maxGames?: number;
    minOwners?: number;
    maxOwners?: number;
    minRevenue?: number;
    minGrowth7d?: number;
    status?: 'active' | 'dormant';
  };
  sort: SortField;
  order: SortOrder;
}

/**
 * Quick filter definition
 */
export interface QuickFilter {
  id: QuickFilterId;
  label: string;
  emoji?: string;
  description: string;
  filters: {
    minGames?: number;
    maxGames?: number;
    minOwners?: number;
    maxOwners?: number;
    minRevenue?: number;
    minGrowth7d?: number;
    maxGrowth7d?: number;
    status?: 'active' | 'dormant';
  };
}

/**
 * Preset view definitions per spec
 */
export const PRESETS: Preset[] = [
  {
    id: 'market_leaders',
    label: 'Market Leaders',
    description: 'Top companies by revenue ($10M+)',
    tooltip: 'Companies with $10M+ estimated revenue, ranked by total revenue',
    filters: {
      minRevenue: 1_000_000_000, // $10M in cents
    },
    sort: 'revenue_estimate_cents',
    order: 'desc',
  },
  {
    id: 'rising_indies',
    label: 'Rising Indies',
    description: 'Small studios with 10%+ growth',
    tooltip: 'Studios with ≤10 games and 10%+ weekly growth, ranked by growth rate',
    filters: {
      maxGames: 10,
      minGrowth7d: 10, // 10%+ growth
    },
    sort: 'ccu_growth_7d',
    order: 'desc',
  },
  {
    id: 'breakout',
    label: 'Breakout',
    emoji: '🚀',
    description: 'Companies with 50%+ growth and under 1M owners',
    tooltip: 'Companies with 50%+ weekly growth and <1M owners, ranked by growth rate',
    filters: {
      minGrowth7d: 50,
      maxOwners: 1_000_000,
    },
    sort: 'ccu_growth_7d',
    order: 'desc',
  },
  {
    id: 'growing_publishers',
    label: 'Growing Publishers',
    description: 'Publishers with 10%+ growth',
    tooltip: 'Publishers with 10%+ weekly growth, ranked by growth rate',
    filters: {
      type: 'publisher',
      minGrowth7d: 10,
    },
    sort: 'ccu_growth_7d',
    order: 'desc',
  },
];

/**
 * Quick filter definitions per spec
 */
export const QUICK_FILTERS: QuickFilter[] = [
  {
    id: 'major',
    label: 'Major 10+',
    description: '10 or more games',
    filters: {
      minGames: 10,
    },
  },
  {
    id: 'prolific',
    label: 'Prolific 5+',
    description: '5 or more games',
    filters: {
      minGames: 5,
    },
  },
  {
    id: 'active',
    label: 'Active',
    description: 'Released a game in the last year',
    filters: {
      status: 'active',
    },
  },
  {
    id: 'trending',
    label: 'Trending',
    description: 'Has games trending up',
    filters: {
      minGrowth7d: 0, // Any positive growth
    },
  },
  // Note: 'breakout' removed from quick filters - now only in presets
  {
    id: 'revenue1m',
    label: '$1M+',
    description: 'Over $1M estimated revenue',
    filters: {
      minRevenue: 100_000_000, // $1M in cents
    },
  },
  {
    id: 'revenue10m',
    label: '$10M+',
    description: 'Over $10M estimated revenue',
    filters: {
      minRevenue: 1_000_000_000, // $10M in cents
    },
  },
  {
    id: 'owners100k',
    label: '100K+',
    description: 'Over 100K total owners',
    filters: {
      minOwners: 100_000,
    },
  },
];

/**
 * Get a preset by ID
 */
export function getPresetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/**
 * Get a quick filter by ID
 */
export function getQuickFilterById(id: QuickFilterId): QuickFilter | undefined {
  return QUICK_FILTERS.find((f) => f.id === id);
}

/**
 * Build URL params from active quick filters
 */
export function buildFilterParams(activeFilters: QuickFilterId[]): Record<string, string> {
  const params: Record<string, string> = {};

  // Merge all active filter params
  for (const filterId of activeFilters) {
    const filter = getQuickFilterById(filterId);
    if (!filter) continue;

    const { filters } = filter;

    // For numeric filters, take the maximum/minimum appropriately
    if (filters.minGames !== undefined) {
      const current = params.minGames ? parseInt(params.minGames) : 0;
      params.minGames = String(Math.max(current, filters.minGames));
    }
    if (filters.maxGames !== undefined) {
      const current = params.maxGames ? parseInt(params.maxGames) : Infinity;
      params.maxGames = String(Math.min(current, filters.maxGames));
    }
    if (filters.minOwners !== undefined) {
      const current = params.minOwners ? parseInt(params.minOwners) : 0;
      params.minOwners = String(Math.max(current, filters.minOwners));
    }
    if (filters.maxOwners !== undefined) {
      const current = params.maxOwners ? parseInt(params.maxOwners) : Infinity;
      params.maxOwners = String(Math.min(current, filters.maxOwners));
    }
    if (filters.minRevenue !== undefined) {
      const current = params.minRevenue ? parseInt(params.minRevenue) : 0;
      params.minRevenue = String(Math.max(current, filters.minRevenue));
    }
    if (filters.minGrowth7d !== undefined) {
      const current = params.minGrowth7d ? parseFloat(params.minGrowth7d) : -Infinity;
      params.minGrowth7d = String(Math.max(current, filters.minGrowth7d));
    }
    if (filters.maxGrowth7d !== undefined) {
      const current = params.maxGrowth7d ? parseFloat(params.maxGrowth7d) : Infinity;
      params.maxGrowth7d = String(Math.min(current, filters.maxGrowth7d));
    }
    if (filters.status !== undefined) {
      params.status = filters.status;
    }
  }

  // Remove Infinity values
  if (params.maxGames === 'Infinity') delete params.maxGames;
  if (params.maxOwners === 'Infinity') delete params.maxOwners;
  if (params.maxGrowth7d === 'Infinity') delete params.maxGrowth7d;

  return params;
}

/**
 * Unified filter definition combining presets and quick filters
 */
export interface UnifiedFilter {
  id: UnifiedFilterId;
  label: string;
  emoji?: string;
  description: string;
  tooltip?: string; // Tooltip text shown on hover (presets only)
  type: 'preset' | 'quick';
  filters: {
    type?: CompanyType;
    minGames?: number;
    maxGames?: number;
    minOwners?: number;
    maxOwners?: number;
    minRevenue?: number;
    minGrowth7d?: number;
    maxGrowth7d?: number;
    status?: 'active' | 'dormant';
  };
  // Only for presets - applies sorting
  sort?: SortField;
  order?: SortOrder;
}

/**
 * Unified filters array - presets first, then quick filters
 * Presets: exclusive (selecting one clears others + applies sort)
 * Quick filters: stackable (can combine multiple)
 */
export const UNIFIED_FILTERS: UnifiedFilter[] = [
  // Presets (shown with purple tint, exclusive)
  {
    id: 'market_leaders',
    label: 'Market Leaders',
    description: 'Top companies by revenue ($10M+)',
    tooltip: 'Companies with $10M+ estimated revenue, ranked by total revenue',
    type: 'preset',
    filters: {
      minRevenue: 1_000_000_000, // $10M in cents
    },
    sort: 'revenue_estimate_cents',
    order: 'desc',
  },
  {
    id: 'rising_indies',
    label: 'Rising Indies',
    description: 'Small studios with 10%+ growth',
    tooltip: 'Studios with ≤10 games and 10%+ weekly growth, ranked by growth rate',
    type: 'preset',
    filters: {
      maxGames: 10,
      minGrowth7d: 10,
    },
    sort: 'ccu_growth_7d',
    order: 'desc',
  },
  {
    id: 'breakout',
    label: 'Breakout',
    emoji: '🚀',
    description: 'Companies with 50%+ growth and under 1M owners',
    tooltip: 'Companies with 50%+ weekly growth and <1M owners, ranked by growth rate',
    type: 'preset',
    filters: {
      minGrowth7d: 50,
      maxOwners: 1_000_000,
    },
    sort: 'ccu_growth_7d',
    order: 'desc',
  },
  {
    id: 'growing_publishers',
    label: 'Growing Publishers',
    description: 'Publishers with 10%+ growth',
    tooltip: 'Publishers with 10%+ weekly growth, ranked by growth rate',
    type: 'preset',
    filters: {
      type: 'publisher',
      minGrowth7d: 10,
    },
    sort: 'ccu_growth_7d',
    order: 'desc',
  },
  // Quick filters (neutral style, stackable)
  {
    id: 'major',
    label: 'Major 10+',
    description: '10 or more games',
    type: 'quick',
    filters: {
      minGames: 10,
    },
  },
  {
    id: 'prolific',
    label: 'Prolific 5+',
    description: '5 or more games',
    type: 'quick',
    filters: {
      minGames: 5,
    },
  },
  {
    id: 'active',
    label: 'Active',
    description: 'Released a game in the last year',
    type: 'quick',
    filters: {
      status: 'active',
    },
  },
  {
    id: 'trending',
    label: 'Trending',
    description: 'Has games trending up',
    type: 'quick',
    filters: {
      minGrowth7d: 0,
    },
  },
  {
    id: 'revenue1m',
    label: '$1M+',
    description: 'Over $1M estimated revenue',
    type: 'quick',
    filters: {
      minRevenue: 100_000_000, // $1M in cents
    },
  },
  {
    id: 'revenue10m',
    label: '$10M+',
    description: 'Over $10M estimated revenue',
    type: 'quick',
    filters: {
      minRevenue: 1_000_000_000, // $10M in cents
    },
  },
  {
    id: 'owners100k',
    label: '100K+',
    description: 'Over 100K total owners',
    type: 'quick',
    filters: {
      minOwners: 100_000,
    },
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
export function isPresetId(id: UnifiedFilterId): id is PresetId {
  const filter = getUnifiedFilterById(id);
  return filter?.type === 'preset';
}

/**
 * Get all preset filters
 */
export function getPresetFilters(): UnifiedFilter[] {
  return UNIFIED_FILTERS.filter((f) => f.type === 'preset');
}

/**
 * Get all quick filters
 */
export function getQuickFiltersOnly(): UnifiedFilter[] {
  return UNIFIED_FILTERS.filter((f) => f.type === 'quick');
}
