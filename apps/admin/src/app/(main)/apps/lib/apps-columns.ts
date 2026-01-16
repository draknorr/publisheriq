/**
 * Column definitions for the Apps table
 * Milestone 5a: Column Customization - 33 columns across 9 categories
 */

import type { App, SortField } from './apps-types';

/**
 * Column categories for grouping in selector
 */
export type AppColumnCategory =
  | 'core' // rank, name (always visible)
  | 'engagement' // playtime, active player %
  | 'reviews' // review metrics, velocity, sentiment
  | 'growth' // CCU growth, momentum, trends
  | 'financial' // price, revenue, value score
  | 'context' // publisher, developer info
  | 'timeline' // release date, days live, hype
  | 'platform' // Steam Deck, platforms, controller
  | 'activity'; // CCU tier, velocity tier

/**
 * Available column IDs for the Apps table (33 total)
 */
export type AppColumnId =
  // Core (2)
  | 'rank'
  | 'name'
  // Engagement (3)
  | 'avg_playtime_forever'
  | 'avg_playtime_2weeks'
  | 'active_player_pct'
  // Reviews (7)
  | 'reviews'
  | 'positive_percentage'
  | 'velocity_7d'
  | 'velocity_30d'
  | 'velocity_tier'
  | 'sentiment_delta'
  | 'review_rate'
  // Growth (6)
  | 'ccu_peak'
  | 'ccu_growth_7d'
  | 'ccu_growth_30d'
  | 'momentum_score'
  | 'velocity_acceleration'
  | 'sparkline'
  // Financial (4)
  | 'price'
  | 'discount'
  | 'owners'
  | 'value_score'
  // Context (4)
  | 'publisher'
  | 'developer'
  | 'vs_publisher_avg'
  | 'publisher_game_count'
  // Timeline (3)
  | 'release_date'
  | 'days_live'
  | 'hype_duration'
  // Platform (3)
  | 'steam_deck'
  | 'platforms'
  | 'controller_support'
  // Activity (1)
  | 'ccu_tier';

/**
 * Column definition with all metadata
 */
export interface AppColumnDefinition {
  id: AppColumnId;
  label: string;
  shortLabel?: string;
  category: AppColumnCategory;
  width: number;
  sortable: boolean;
  sortField?: SortField;
  methodology?: string;
  getValue: (app: App) => number | string | null;
  isVisualization?: boolean;
}

/**
 * Default columns shown on initial load (10)
 */
export const DEFAULT_APP_COLUMNS: AppColumnId[] = [
  'rank',
  'name',
  'ccu_peak',
  'ccu_growth_7d',
  'momentum_score',
  'owners',
  'reviews',
  'price',
  'release_date',
  'sparkline',
];

/**
 * Core columns that are always visible (not in selector)
 */
export const CORE_COLUMNS: AppColumnId[] = ['rank', 'name'];

/**
 * All column definitions (33 total)
 */
export const APP_COLUMN_DEFINITIONS: Record<AppColumnId, AppColumnDefinition> = {
  // ═══════════════════════════════════════════════════════════════════
  // CORE (always visible)
  // ═══════════════════════════════════════════════════════════════════
  rank: {
    id: 'rank',
    label: '#',
    category: 'core',
    width: 50,
    sortable: false,
    getValue: () => null, // Rank is computed from position
  },
  name: {
    id: 'name',
    label: 'Game',
    category: 'core',
    width: 250,
    sortable: false,
    getValue: (app) => app.name,
  },

  // ═══════════════════════════════════════════════════════════════════
  // ENGAGEMENT
  // ═══════════════════════════════════════════════════════════════════
  avg_playtime_forever: {
    id: 'avg_playtime_forever',
    label: 'Avg Playtime',
    shortLabel: 'Playtime',
    category: 'engagement',
    width: 100,
    sortable: false,
    methodology: 'Average playtime across all players (hours)',
    getValue: (app) => app.average_playtime_forever,
  },
  avg_playtime_2weeks: {
    id: 'avg_playtime_2weeks',
    label: 'Playtime (2w)',
    shortLabel: '2w Play',
    category: 'engagement',
    width: 100,
    sortable: false,
    methodology: 'Average playtime in the last 2 weeks (hours)',
    getValue: (app) => app.average_playtime_2weeks,
  },
  active_player_pct: {
    id: 'active_player_pct',
    label: 'Active %',
    category: 'engagement',
    width: 90,
    sortable: true,
    sortField: 'active_player_pct',
    methodology: 'Peak CCU / Owners - indicates player engagement',
    getValue: (app) => app.active_player_pct,
  },

  // ═══════════════════════════════════════════════════════════════════
  // REVIEWS
  // ═══════════════════════════════════════════════════════════════════
  reviews: {
    id: 'reviews',
    label: 'Reviews',
    category: 'reviews',
    width: 120,
    sortable: true,
    sortField: 'total_reviews',
    methodology: 'Total review count with positive percentage',
    getValue: (app) => app.total_reviews,
  },
  positive_percentage: {
    id: 'positive_percentage',
    label: 'Score %',
    category: 'reviews',
    width: 80,
    sortable: true,
    sortField: 'review_score',
    methodology: 'Percentage of positive reviews',
    getValue: (app) => app.positive_percentage,
  },
  velocity_7d: {
    id: 'velocity_7d',
    label: 'Velocity (7d)',
    shortLabel: 'Vel 7d',
    category: 'reviews',
    width: 100,
    sortable: true,
    sortField: 'velocity_7d',
    methodology: 'Reviews per day over the last 7 days',
    getValue: (app) => app.velocity_7d,
  },
  velocity_30d: {
    id: 'velocity_30d',
    label: 'Velocity (30d)',
    shortLabel: 'Vel 30d',
    category: 'reviews',
    width: 100,
    sortable: false,
    methodology: 'Reviews per day over the last 30 days',
    getValue: (app) => app.velocity_30d,
  },
  velocity_tier: {
    id: 'velocity_tier',
    label: 'Velocity Tier',
    shortLabel: 'Vel Tier',
    category: 'reviews',
    width: 100,
    sortable: false,
    methodology: 'Review velocity tier: High, Medium, Low, Dormant',
    getValue: (app) => app.velocity_tier,
  },
  sentiment_delta: {
    id: 'sentiment_delta',
    label: 'Sentiment',
    category: 'reviews',
    width: 100,
    sortable: true,
    sortField: 'sentiment_delta',
    methodology: 'Change in positive review ratio over time',
    getValue: (app) => app.sentiment_delta,
  },
  review_rate: {
    id: 'review_rate',
    label: 'Review Rate',
    shortLabel: 'Rate',
    category: 'reviews',
    width: 100,
    sortable: true,
    sortField: 'review_rate',
    methodology: 'Reviews per 1,000 owners - indicates engagement',
    getValue: (app) => app.review_rate,
  },

  // ═══════════════════════════════════════════════════════════════════
  // GROWTH
  // ═══════════════════════════════════════════════════════════════════
  ccu_peak: {
    id: 'ccu_peak',
    label: 'Peak CCU',
    shortLabel: 'CCU',
    category: 'growth',
    width: 100,
    sortable: true,
    sortField: 'ccu_peak',
    methodology: 'Peak concurrent users in the last 24 hours',
    getValue: (app) => app.ccu_peak,
  },
  ccu_growth_7d: {
    id: 'ccu_growth_7d',
    label: 'Growth (7d)',
    shortLabel: '7d Growth',
    category: 'growth',
    width: 110,
    sortable: true,
    sortField: 'ccu_growth_7d_percent',
    methodology: 'CCU change over the last 7 days',
    getValue: (app) => app.ccu_growth_7d_percent,
  },
  ccu_growth_30d: {
    id: 'ccu_growth_30d',
    label: 'Growth (30d)',
    shortLabel: '30d Growth',
    category: 'growth',
    width: 110,
    sortable: true,
    sortField: 'ccu_growth_30d_percent',
    methodology: 'CCU change over the last 30 days',
    getValue: (app) => app.ccu_growth_30d_percent,
  },
  momentum_score: {
    id: 'momentum_score',
    label: 'Momentum',
    category: 'growth',
    width: 100,
    sortable: true,
    sortField: 'momentum_score',
    methodology: 'Combined CCU growth and review velocity acceleration',
    getValue: (app) => app.momentum_score,
  },
  velocity_acceleration: {
    id: 'velocity_acceleration',
    label: 'Acceleration',
    shortLabel: 'Accel',
    category: 'growth',
    width: 100,
    sortable: false,
    methodology: 'Change in review velocity (7d vs 30d rate)',
    getValue: (app) => app.velocity_acceleration,
  },
  sparkline: {
    id: 'sparkline',
    label: 'CCU Trend',
    shortLabel: 'Trend',
    category: 'growth',
    width: 80,
    sortable: false,
    isVisualization: true,
    methodology: '7-day CCU trend visualization',
    getValue: () => null,
  },

  // ═══════════════════════════════════════════════════════════════════
  // FINANCIAL
  // ═══════════════════════════════════════════════════════════════════
  price: {
    id: 'price',
    label: 'Price',
    category: 'financial',
    width: 100,
    sortable: true,
    sortField: 'price_cents',
    methodology: 'Current price with discount indicator',
    getValue: (app) => app.price_cents,
  },
  discount: {
    id: 'discount',
    label: 'Discount',
    category: 'financial',
    width: 80,
    sortable: false,
    methodology: 'Current discount percentage',
    getValue: (app) => app.current_discount_percent,
  },
  owners: {
    id: 'owners',
    label: 'Owners',
    category: 'financial',
    width: 100,
    sortable: true,
    sortField: 'owners_midpoint',
    methodology: 'Estimated owners from SteamSpy',
    getValue: (app) => app.owners_midpoint,
  },
  value_score: {
    id: 'value_score',
    label: 'Value',
    category: 'financial',
    width: 90,
    sortable: true,
    sortField: 'value_score',
    methodology: 'Hours of playtime per dollar spent',
    getValue: (app) => app.value_score,
  },

  // ═══════════════════════════════════════════════════════════════════
  // CONTEXT
  // ═══════════════════════════════════════════════════════════════════
  publisher: {
    id: 'publisher',
    label: 'Publisher',
    category: 'context',
    width: 150,
    sortable: false,
    methodology: 'Game publisher',
    getValue: (app) => app.publisher_name,
  },
  developer: {
    id: 'developer',
    label: 'Developer',
    category: 'context',
    width: 150,
    sortable: false,
    methodology: 'Game developer',
    getValue: (app) => app.developer_name,
  },
  vs_publisher_avg: {
    id: 'vs_publisher_avg',
    label: 'vs Pub Avg',
    category: 'context',
    width: 100,
    sortable: true,
    sortField: 'vs_publisher_avg',
    methodology: 'Review score compared to publisher average',
    getValue: (app) => app.vs_publisher_avg,
  },
  publisher_game_count: {
    id: 'publisher_game_count',
    label: 'Pub Games',
    category: 'context',
    width: 90,
    sortable: false,
    methodology: "Publisher's total game count",
    getValue: (app) => app.publisher_game_count,
  },

  // ═══════════════════════════════════════════════════════════════════
  // TIMELINE
  // ═══════════════════════════════════════════════════════════════════
  release_date: {
    id: 'release_date',
    label: 'Release',
    category: 'timeline',
    width: 100,
    sortable: true,
    sortField: 'release_date',
    methodology: 'Game release date',
    getValue: (app) => app.release_date,
  },
  days_live: {
    id: 'days_live',
    label: 'Days Live',
    category: 'timeline',
    width: 90,
    sortable: true,
    sortField: 'days_live',
    methodology: 'Days since release',
    getValue: (app) => app.days_live,
  },
  hype_duration: {
    id: 'hype_duration',
    label: 'Hype Days',
    category: 'timeline',
    width: 90,
    sortable: false,
    methodology: 'Days between store page creation and release',
    getValue: (app) => app.hype_duration,
  },

  // ═══════════════════════════════════════════════════════════════════
  // PLATFORM
  // ═══════════════════════════════════════════════════════════════════
  steam_deck: {
    id: 'steam_deck',
    label: 'Steam Deck',
    shortLabel: 'Deck',
    category: 'platform',
    width: 100,
    sortable: false,
    methodology: 'Steam Deck compatibility status',
    getValue: (app) => app.steam_deck_category,
  },
  platforms: {
    id: 'platforms',
    label: 'Platforms',
    category: 'platform',
    width: 90,
    sortable: false,
    methodology: 'Supported platforms (Windows/Mac/Linux)',
    getValue: (app) => app.platforms,
  },
  controller_support: {
    id: 'controller_support',
    label: 'Controller',
    category: 'platform',
    width: 90,
    sortable: false,
    methodology: 'Controller support level',
    getValue: (app) => app.controller_support,
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACTIVITY
  // ═══════════════════════════════════════════════════════════════════
  ccu_tier: {
    id: 'ccu_tier',
    label: 'CCU Tier',
    category: 'activity',
    width: 90,
    sortable: false,
    methodology: 'CCU polling tier (1=Hot, 2=Active, 3=Quiet)',
    getValue: (app) => app.ccu_tier,
  },
};

/**
 * Column categories for grouping in selector
 * Core columns are excluded (always visible)
 */
export const APP_COLUMN_CATEGORIES: Record<
  Exclude<AppColumnCategory, 'core'>,
  { label: string; columns: AppColumnId[] }
> = {
  engagement: {
    label: 'Engagement',
    columns: ['avg_playtime_forever', 'avg_playtime_2weeks', 'active_player_pct'],
  },
  reviews: {
    label: 'Reviews',
    columns: [
      'reviews',
      'positive_percentage',
      'velocity_7d',
      'velocity_30d',
      'velocity_tier',
      'sentiment_delta',
      'review_rate',
    ],
  },
  growth: {
    label: 'Growth',
    columns: [
      'ccu_peak',
      'ccu_growth_7d',
      'ccu_growth_30d',
      'momentum_score',
      'velocity_acceleration',
      'sparkline',
    ],
  },
  financial: {
    label: 'Financial',
    columns: ['price', 'discount', 'owners', 'value_score'],
  },
  context: {
    label: 'Context',
    columns: ['publisher', 'developer', 'vs_publisher_avg', 'publisher_game_count'],
  },
  timeline: {
    label: 'Timeline',
    columns: ['release_date', 'days_live', 'hype_duration'],
  },
  platform: {
    label: 'Platform',
    columns: ['steam_deck', 'platforms', 'controller_support'],
  },
  activity: {
    label: 'Activity Tiers',
    columns: ['ccu_tier'],
  },
};

/**
 * Get column definition by ID
 */
export function getColumnDefinition(id: AppColumnId): AppColumnDefinition {
  return APP_COLUMN_DEFINITIONS[id];
}

/**
 * Check if a column is sortable
 */
export function isColumnSortable(id: AppColumnId): boolean {
  return APP_COLUMN_DEFINITIONS[id]?.sortable ?? false;
}

/**
 * Get the sort field for a column (if sortable)
 */
export function getColumnSortField(id: AppColumnId): SortField | undefined {
  return APP_COLUMN_DEFINITIONS[id]?.sortField;
}

/**
 * Check if a column ID is valid
 */
export function isValidColumnId(id: string): id is AppColumnId {
  return id in APP_COLUMN_DEFINITIONS;
}

/**
 * Get all selectable column IDs (excludes core columns)
 */
export function getSelectableColumns(): AppColumnId[] {
  return (Object.keys(APP_COLUMN_DEFINITIONS) as AppColumnId[]).filter(
    (id) => !CORE_COLUMNS.includes(id)
  );
}

/**
 * Parse columns from URL parameter
 */
export function parseColumnsParam(param: string | null | undefined): AppColumnId[] {
  if (!param) return DEFAULT_APP_COLUMNS;
  const ids = param.split(',').filter(isValidColumnId);
  return ids.length > 0 ? ids : DEFAULT_APP_COLUMNS;
}

/**
 * Serialize columns to URL parameter
 * Returns null if columns match default (to keep URLs clean)
 */
export function serializeColumnsParam(columns: AppColumnId[]): string | null {
  if (arraysEqual(columns, DEFAULT_APP_COLUMNS)) return null;
  return columns.join(',');
}

/**
 * Check if two arrays are equal
 */
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
}
