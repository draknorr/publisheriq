/**
 * Filter Registry - Centralized filter definitions for command palette
 *
 * Defines all filterable dimensions for companies with shortcuts, types, and UI placement.
 * Adapted from apps filter registry for company-specific metrics.
 */

// ============================================================================
// Filter Type Definitions
// ============================================================================

export type FilterCategory =
  | 'metric'      // Games, owners, CCU, hours, revenue, reviews, score
  | 'growth'      // 7d growth, 30d growth
  | 'content'     // Tags, genres, categories
  | 'platform'    // Steam Deck, platforms
  | 'relationship'// Status, self-published, external devs
  | 'activity';   // Activity status

export type FilterType =
  | 'range'       // Min/max numeric (dual slider or syntax)
  | 'boolean'     // Yes/no/any tri-state
  | 'select'      // Single selection from options
  | 'multiselect' // Multiple selections with match mode
  | 'search';     // Free text search

export type HomeViewSlot =
  | 'quick-filter' // In Quick Filters grid
  | 'genre'        // In Genres section
  | 'category'     // In Common Categories
  | 'platform'     // In Platform Quick Access
  | 'toggle'       // In Toggles section
  | 'metric';      // In Metric Filters list

export type Operator = '>' | '<' | '>=' | '<=' | '=' | 'between';

export interface FilterOption {
  value: string | number;
  label: string;
  description?: string;
}

export interface FilterDefinition {
  id: string;                    // Unique identifier (matches URL param)
  shortcut: string;              // For syntax parsing (e.g., 'revenue', 'games')
  label: string;                 // Human-readable name
  category: FilterCategory;      // For grouping in UI
  type: FilterType;              // Determines input component
  operators?: Operator[];        // For range types
  options?: FilterOption[];      // For select/multiselect types
  homeViewSlot?: HomeViewSlot;   // Where to show in Home View (null = not shown)
  urlParam?: string;             // Override URL param name if different from id
  unit?: string;                 // Unit for display (%, $, h, etc.)
  description?: string;          // Help text for filter
  minUrlParam?: string;          // URL param for min value (range filters)
  maxUrlParam?: string;          // URL param for max value (range filters)
}

// ============================================================================
// Filter Definitions
// ============================================================================

export const FILTER_REGISTRY: FilterDefinition[] = [
  // -------------------------------------------------------------------------
  // Metric Filters
  // -------------------------------------------------------------------------
  {
    id: 'games',
    shortcut: 'games',
    label: 'Game Count',
    category: 'metric',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    homeViewSlot: 'metric',
    minUrlParam: 'minGames',
    maxUrlParam: 'maxGames',
    description: 'Number of games published/developed',
  },
  {
    id: 'owners',
    shortcut: 'owners',
    label: 'Total Owners',
    category: 'metric',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    homeViewSlot: 'metric',
    minUrlParam: 'minOwners',
    maxUrlParam: 'maxOwners',
    description: 'Estimated total owners across all games',
  },
  {
    id: 'ccu',
    shortcut: 'ccu',
    label: 'Total CCU',
    category: 'metric',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    homeViewSlot: 'metric',
    minUrlParam: 'minCcu',
    maxUrlParam: 'maxCcu',
    description: 'Total concurrent players across all games',
  },
  {
    id: 'hours',
    shortcut: 'hours',
    label: 'Weekly Hours',
    category: 'metric',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    unit: 'h',
    homeViewSlot: 'metric',
    minUrlParam: 'minHours',
    maxUrlParam: 'maxHours',
    description: 'Estimated weekly playtime hours',
  },
  {
    id: 'revenue',
    shortcut: 'revenue',
    label: 'Revenue',
    category: 'metric',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    unit: '$',
    homeViewSlot: 'metric',
    minUrlParam: 'minRevenue',
    maxUrlParam: 'maxRevenue',
    description: 'Estimated total revenue (stored in cents)',
  },
  {
    id: 'reviews',
    shortcut: 'reviews',
    label: 'Total Reviews',
    category: 'metric',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    homeViewSlot: 'metric',
    minUrlParam: 'minReviews',
    maxUrlParam: 'maxReviews',
    description: 'Total reviews across all games',
  },
  {
    id: 'score',
    shortcut: 'score',
    label: 'Avg Review Score',
    category: 'metric',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    unit: '%',
    homeViewSlot: 'metric',
    minUrlParam: 'minScore',
    maxUrlParam: 'maxScore',
    description: 'Average positive review percentage',
  },

  // -------------------------------------------------------------------------
  // Growth Filters
  // -------------------------------------------------------------------------
  {
    id: 'growth7d',
    shortcut: 'growth',
    label: '7d CCU Growth',
    category: 'growth',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    unit: '%',
    homeViewSlot: 'metric',
    minUrlParam: 'minGrowth7d',
    maxUrlParam: 'maxGrowth7d',
    description: 'Week-over-week CCU change',
  },
  {
    id: 'growth30d',
    shortcut: 'growth30',
    label: '30d CCU Growth',
    category: 'growth',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    unit: '%',
    minUrlParam: 'minGrowth30d',
    maxUrlParam: 'maxGrowth30d',
    description: 'Month-over-month CCU change',
  },

  // -------------------------------------------------------------------------
  // Content Filters
  // -------------------------------------------------------------------------
  {
    id: 'tags',
    shortcut: 'tag',
    label: 'Tags',
    category: 'content',
    type: 'multiselect',
    description: 'Steam user-defined tags across games',
  },
  {
    id: 'genres',
    shortcut: 'genre',
    label: 'Genres',
    category: 'content',
    type: 'multiselect',
    homeViewSlot: 'genre',
    description: 'Steam genres across games',
  },
  {
    id: 'categories',
    shortcut: 'cat',
    label: 'Categories',
    category: 'content',
    type: 'multiselect',
    homeViewSlot: 'category',
    description: 'Steam features & categories',
  },

  // -------------------------------------------------------------------------
  // Platform Filters
  // -------------------------------------------------------------------------
  {
    id: 'steamDeck',
    shortcut: 'deck',
    label: 'Steam Deck',
    category: 'platform',
    type: 'select',
    options: [
      { value: 'verified', label: 'Verified', description: 'Has verified games' },
      { value: 'playable', label: 'Playable', description: 'Has playable games' },
    ],
    homeViewSlot: 'platform',
    description: 'Steam Deck compatibility of games',
  },
  {
    id: 'platforms',
    shortcut: 'platform',
    label: 'Platforms',
    category: 'platform',
    type: 'multiselect',
    options: [
      { value: 'windows', label: 'Windows' },
      { value: 'mac', label: 'macOS' },
      { value: 'linux', label: 'Linux' },
    ],
    homeViewSlot: 'platform',
    description: 'Operating system support',
  },

  // -------------------------------------------------------------------------
  // Relationship Filters
  // -------------------------------------------------------------------------
  {
    id: 'status',
    shortcut: 'status',
    label: 'Activity Status',
    category: 'relationship',
    type: 'select',
    options: [
      { value: 'active', label: 'Active', description: 'Released a game in the last year' },
      { value: 'dormant', label: 'Dormant', description: 'No releases in the last year' },
    ],
    homeViewSlot: 'toggle',
    description: 'Company activity status',
  },
  {
    id: 'relationship',
    shortcut: 'rel',
    label: 'Relationship',
    category: 'relationship',
    type: 'select',
    options: [
      { value: 'self_published', label: 'Self-Published', description: 'Publishes own games' },
      { value: 'external_devs', label: 'External Devs', description: 'Works with external developers' },
      { value: 'multi_publisher', label: 'Multi-Publisher', description: 'Published by multiple publishers' },
    ],
    description: 'Business relationship type',
  },
];

// ============================================================================
// Lookup Utilities
// ============================================================================

/**
 * Get filter definition by ID
 */
export function getFilterById(id: string): FilterDefinition | undefined {
  return FILTER_REGISTRY.find((f) => f.id === id);
}

/**
 * Get filter definition by shortcut
 */
export function getFilterByShortcut(shortcut: string): FilterDefinition | undefined {
  return FILTER_REGISTRY.find((f) => f.shortcut === shortcut.toLowerCase());
}

/**
 * Get all filters for a specific category
 */
export function getFiltersByCategory(category: FilterCategory): FilterDefinition[] {
  return FILTER_REGISTRY.filter((f) => f.category === category);
}

/**
 * Get all filters that appear in Home View
 */
export function getHomeViewFilters(): FilterDefinition[] {
  return FILTER_REGISTRY.filter((f) => f.homeViewSlot !== undefined);
}

/**
 * Get filters by Home View slot
 */
export function getFiltersBySlot(slot: HomeViewSlot): FilterDefinition[] {
  return FILTER_REGISTRY.filter((f) => f.homeViewSlot === slot);
}

/**
 * Get all metric filters (shown in Home View metric section)
 */
export function getMetricFilters(): FilterDefinition[] {
  return getFiltersBySlot('metric');
}

/**
 * Get all toggle filters (boolean/select filters in Home View)
 */
export function getToggleFilters(): FilterDefinition[] {
  return getFiltersBySlot('toggle');
}

/**
 * Build shortcut map for quick lookup
 */
export const SHORTCUT_MAP: Record<string, FilterDefinition> = FILTER_REGISTRY.reduce(
  (acc, filter) => {
    acc[filter.shortcut] = filter;
    return acc;
  },
  {} as Record<string, FilterDefinition>
);
