/**
 * Column definitions for the Apps table
 * Milestone 2b: 10 default columns
 */

import type { SortField } from './apps-types';

/**
 * Available column IDs for the Apps table
 */
export type AppColumnId =
  | 'rank'
  | 'name'
  | 'ccu_peak'
  | 'ccu_growth_7d'
  | 'momentum_score'
  | 'owners'
  | 'reviews'
  | 'price'
  | 'release_date'
  | 'sparkline';

/**
 * Column definition with metadata
 */
export interface AppColumnDefinition {
  id: AppColumnId;
  label: string;
  shortLabel?: string; // Mobile-friendly short name
  width: number;
  sortable: boolean;
  sortField?: SortField; // Maps to RPC sort field
  methodology?: string; // Key for tooltip content
}

/**
 * Default columns shown on initial load
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
 * Column definitions with metadata
 */
export const APP_COLUMN_DEFINITIONS: Record<AppColumnId, AppColumnDefinition> = {
  rank: {
    id: 'rank',
    label: '#',
    width: 50,
    sortable: false,
  },
  name: {
    id: 'name',
    label: 'Game',
    width: 250,
    sortable: false, // Name sorting not in current SortField type
  },
  ccu_peak: {
    id: 'ccu_peak',
    label: 'Peak CCU',
    shortLabel: 'CCU',
    width: 100,
    sortable: true,
    sortField: 'ccu_peak',
    methodology: 'ccu_peak',
  },
  ccu_growth_7d: {
    id: 'ccu_growth_7d',
    label: 'CCU Growth (7d)',
    shortLabel: 'Growth',
    width: 120,
    sortable: true,
    sortField: 'ccu_growth_7d_percent',
    methodology: 'ccu_growth_7d',
  },
  momentum_score: {
    id: 'momentum_score',
    label: 'Momentum',
    width: 100,
    sortable: true,
    sortField: 'momentum_score',
    methodology: 'momentum_score',
  },
  owners: {
    id: 'owners',
    label: 'Owners',
    width: 100,
    sortable: true,
    sortField: 'owners_midpoint',
    methodology: 'owners',
  },
  reviews: {
    id: 'reviews',
    label: 'Reviews',
    width: 120,
    sortable: true,
    sortField: 'total_reviews',
    methodology: 'reviews',
  },
  price: {
    id: 'price',
    label: 'Price',
    width: 100,
    sortable: true,
    sortField: 'price_cents',
    methodology: 'price',
  },
  release_date: {
    id: 'release_date',
    label: 'Release',
    width: 100,
    sortable: true,
    sortField: 'release_date',
    methodology: 'release_date',
  },
  sparkline: {
    id: 'sparkline',
    label: 'CCU Trend',
    shortLabel: 'Trend',
    width: 80,
    sortable: false, // Visualization column, not sortable
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
