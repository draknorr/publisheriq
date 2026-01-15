/**
 * Column definitions for the Companies table
 * M5: Column Customization & Visualizations
 */

import type { Company, SortField } from './companies-types';

/**
 * Available column identifiers
 */
export type ColumnId =
  // Engagement metrics
  | 'hours'
  | 'owners'
  | 'ccu'
  // Content metrics
  | 'games'
  | 'unique_developers'
  | 'role'
  // Review metrics
  | 'reviews'
  | 'avg_score'
  | 'review_velocity'
  // Financial metrics
  | 'revenue'
  // Growth metrics
  | 'growth_7d'
  | 'growth_30d'
  | 'trending'
  // Computed ratios
  | 'revenue_per_game'
  | 'owners_per_game'
  | 'reviews_per_1k_owners'
  // Visualizations
  | 'sparkline';

/**
 * Column category for grouping in selector
 */
export type ColumnCategory =
  | 'engagement'
  | 'content'
  | 'reviews'
  | 'financial'
  | 'growth'
  | 'ratios'
  | 'visualization';

/**
 * Column definition with all metadata
 */
export interface ColumnDefinition {
  id: ColumnId;
  label: string;
  shortLabel?: string;
  category: ColumnCategory;
  width: number;
  sortable: boolean;
  sortField?: SortField;
  isRatio?: boolean;
  isVisualization?: boolean;
  methodology?: string;
  getValue: (company: Company) => number | string | null;
}

/**
 * Default visible columns
 */
export const DEFAULT_COLUMNS: ColumnId[] = [
  'hours',
  'games',
  'owners',
  'ccu',
  'reviews',
  'revenue',
  'growth_7d',
  'trending',
];

/**
 * All column definitions
 */
export const COLUMN_DEFINITIONS: Record<ColumnId, ColumnDefinition> = {
  // Engagement metrics
  hours: {
    id: 'hours',
    label: 'Est. Weekly Hours',
    shortLabel: 'Hours',
    category: 'engagement',
    width: 130,
    sortable: true,
    sortField: 'estimated_weekly_hours',
    methodology: 'Estimated total weekly hours played across all games. Based on CCU × avg session length.',
    getValue: (c) => c.estimated_weekly_hours,
  },
  owners: {
    id: 'owners',
    label: 'Total Owners',
    shortLabel: 'Owners',
    category: 'engagement',
    width: 110,
    sortable: true,
    sortField: 'total_owners',
    methodology: 'Total unique owners across all games. From SteamSpy estimates.',
    getValue: (c) => c.total_owners,
  },
  ccu: {
    id: 'ccu',
    label: 'Peak CCU',
    shortLabel: 'CCU',
    category: 'engagement',
    width: 100,
    sortable: true,
    sortField: 'total_ccu',
    methodology: 'Peak concurrent users across all games in the last 24 hours.',
    getValue: (c) => c.total_ccu,
  },

  // Content metrics
  games: {
    id: 'games',
    label: 'Games',
    category: 'content',
    width: 80,
    sortable: true,
    sortField: 'game_count',
    methodology: 'Total number of games published/developed.',
    getValue: (c) => c.game_count,
  },
  unique_developers: {
    id: 'unique_developers',
    label: 'Unique Devs',
    shortLabel: 'Devs',
    category: 'content',
    width: 100,
    sortable: false,
    methodology: 'Number of unique developers this publisher has worked with.',
    getValue: (c) => c.unique_developers,
  },
  role: {
    id: 'role',
    label: 'Role',
    category: 'content',
    width: 60,
    sortable: false,
    methodology: 'Whether this is a Publisher or Developer.',
    getValue: (c) => c.type,
  },

  // Review metrics
  reviews: {
    id: 'reviews',
    label: 'Reviews',
    category: 'reviews',
    width: 120,
    sortable: true,
    sortField: 'total_reviews',
    methodology: 'Total review count across all games.',
    getValue: (c) => c.total_reviews,
  },
  avg_score: {
    id: 'avg_score',
    label: 'Avg Score',
    shortLabel: 'Score',
    category: 'reviews',
    width: 90,
    sortable: true,
    sortField: 'avg_review_score',
    methodology: 'Average review score across all games, weighted by review count.',
    getValue: (c) => c.avg_review_score,
  },
  review_velocity: {
    id: 'review_velocity',
    label: 'Review Velocity',
    shortLabel: 'Velocity',
    category: 'reviews',
    width: 120,
    sortable: false,
    methodology: 'Reviews per day over the last 7 days.',
    getValue: (c) => c.review_velocity_7d,
  },

  // Financial metrics
  revenue: {
    id: 'revenue',
    label: 'Est. Revenue',
    shortLabel: 'Revenue',
    category: 'financial',
    width: 120,
    sortable: true,
    sortField: 'revenue_estimate_cents',
    methodology: 'Estimated total revenue. Based on owners × price × regional adjustments.',
    getValue: (c) => c.revenue_estimate_cents,
  },

  // Growth metrics
  growth_7d: {
    id: 'growth_7d',
    label: 'CCU Growth (7d)',
    shortLabel: '7d Growth',
    category: 'growth',
    width: 130,
    sortable: true,
    sortField: 'ccu_growth_7d',
    methodology: 'CCU change over the last 7 days as a percentage.',
    getValue: (c) => c.ccu_growth_7d_percent,
  },
  growth_30d: {
    id: 'growth_30d',
    label: 'CCU Growth (30d)',
    shortLabel: '30d Growth',
    category: 'growth',
    width: 130,
    sortable: false,
    methodology: 'CCU change over the last 30 days as a percentage.',
    getValue: (c) => c.ccu_growth_30d_percent,
  },
  trending: {
    id: 'trending',
    label: 'Trending',
    category: 'growth',
    width: 100,
    sortable: true,
    sortField: 'games_trending_up',
    methodology: 'Games with upward (↑) or downward (↓) CCU trends.',
    getValue: (c) => c.games_trending_up,
  },

  // Computed ratios
  revenue_per_game: {
    id: 'revenue_per_game',
    label: 'Revenue/Game',
    category: 'ratios',
    width: 110,
    sortable: true,
    isRatio: true,
    methodology: 'Total estimated revenue ÷ game count. Higher = more successful titles on average.',
    getValue: (c) => (c.game_count > 0 ? c.revenue_estimate_cents / c.game_count : null),
  },
  owners_per_game: {
    id: 'owners_per_game',
    label: 'Owners/Game',
    category: 'ratios',
    width: 110,
    sortable: true,
    isRatio: true,
    methodology: 'Total owners ÷ game count. Indicates average game reach.',
    getValue: (c) => (c.game_count > 0 ? c.total_owners / c.game_count : null),
  },
  reviews_per_1k_owners: {
    id: 'reviews_per_1k_owners',
    label: 'Reviews/1K Owners',
    shortLabel: 'Rev/1K',
    category: 'ratios',
    width: 130,
    sortable: true,
    isRatio: true,
    methodology: 'Review rate per 1,000 owners. Higher = more engaged audience.',
    getValue: (c) => (c.total_owners > 0 ? (c.total_reviews / c.total_owners) * 1000 : null),
  },

  // Visualizations
  sparkline: {
    id: 'sparkline',
    label: 'CCU Trend',
    category: 'visualization',
    width: 90,
    sortable: false,
    isVisualization: true,
    methodology: '7-day CCU trend visualization.',
    getValue: () => null,
  },
};

/**
 * Column categories for grouping in selector
 */
export const COLUMN_CATEGORIES: Record<ColumnCategory, { label: string; columns: ColumnId[] }> = {
  engagement: {
    label: 'Engagement',
    columns: ['hours', 'owners', 'ccu'],
  },
  content: {
    label: 'Content',
    columns: ['games', 'unique_developers', 'role'],
  },
  reviews: {
    label: 'Reviews',
    columns: ['reviews', 'avg_score', 'review_velocity'],
  },
  financial: {
    label: 'Financial',
    columns: ['revenue'],
  },
  growth: {
    label: 'Growth',
    columns: ['growth_7d', 'growth_30d', 'trending'],
  },
  ratios: {
    label: 'Computed Ratios',
    columns: ['revenue_per_game', 'owners_per_game', 'reviews_per_1k_owners'],
  },
  visualization: {
    label: 'Visualizations',
    columns: ['sparkline'],
  },
};

/**
 * Get all selectable column IDs (excludes core columns like rank, name, role)
 */
export function getSelectableColumns(): ColumnId[] {
  return Object.keys(COLUMN_DEFINITIONS) as ColumnId[];
}

/**
 * Check if a column ID is valid
 */
export function isValidColumnId(id: string): id is ColumnId {
  return id in COLUMN_DEFINITIONS;
}

/**
 * Parse columns from URL parameter
 */
export function parseColumnsParam(param: string | null | undefined): ColumnId[] {
  if (!param) return DEFAULT_COLUMNS;
  const ids = param.split(',').filter(isValidColumnId);
  return ids.length > 0 ? ids : DEFAULT_COLUMNS;
}

/**
 * Serialize columns to URL parameter
 */
export function serializeColumnsParam(columns: ColumnId[]): string | null {
  if (arraysEqual(columns, DEFAULT_COLUMNS)) return null;
  return columns.join(',');
}

/**
 * Check if two arrays are equal
 */
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
}

/**
 * Check if a column is a ratio column (requires client-side sorting)
 */
export function isRatioColumn(columnId: ColumnId): boolean {
  return COLUMN_DEFINITIONS[columnId]?.isRatio ?? false;
}

/**
 * Get the sort field for a column (null for ratio columns)
 */
export function getColumnSortField(columnId: ColumnId): SortField | null {
  const column = COLUMN_DEFINITIONS[columnId];
  if (!column || column.isRatio) return null;
  return column.sortField ?? null;
}
