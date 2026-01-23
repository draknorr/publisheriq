/**
 * Filter Registry - Centralized filter definitions for command palette
 *
 * Defines all filterable dimensions with shortcuts, types, and UI placement.
 * New filters are added as config, not spec changes.
 */

// Filter type definitions are self-contained in this module

// ============================================================================
// Filter Type Definitions
// ============================================================================

export type FilterCategory =
  | 'metric'      // CCU, owners, reviews, score, price, playtime
  | 'growth'      // 7d growth, 30d growth, momentum
  | 'sentiment'   // Sentiment delta, velocity tier
  | 'engagement'  // Active %, review rate, value score
  | 'content'     // Tags, genres, categories
  | 'platform'    // Windows/Mac/Linux, Steam Deck, controller
  | 'release'     // Age, year, early access
  | 'relationship'// Publisher, developer, publisher size
  | 'activity';   // CCU tier

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
  shortcut: string;              // For syntax parsing (e.g., 'ccu', 'deck')
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
    id: 'ccu',
    shortcut: 'ccu',
    label: 'Peak CCU',
    category: 'metric',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    homeViewSlot: 'metric',
    minUrlParam: 'minCcu',
    maxUrlParam: 'maxCcu',
    description: 'Concurrent player count',
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
    description: 'Estimated total owners',
  },
  {
    id: 'reviews',
    shortcut: 'reviews',
    label: 'Review Count',
    category: 'metric',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    homeViewSlot: 'metric',
    minUrlParam: 'minReviews',
    maxUrlParam: 'maxReviews',
    description: 'Total review count',
  },
  {
    id: 'score',
    shortcut: 'score',
    label: 'Review Score',
    category: 'metric',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    unit: '%',
    homeViewSlot: 'metric',
    minUrlParam: 'minScore',
    maxUrlParam: 'maxScore',
    description: 'Positive review percentage',
  },
  {
    id: 'price',
    shortcut: 'price',
    label: 'Price',
    category: 'metric',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    unit: '$',
    homeViewSlot: 'metric',
    minUrlParam: 'minPrice',
    maxUrlParam: 'maxPrice',
    description: 'Current price in USD',
  },
  {
    id: 'playtime',
    shortcut: 'playtime',
    label: 'Median Playtime',
    category: 'metric',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    unit: 'h',
    minUrlParam: 'minPlaytime',
    maxUrlParam: 'maxPlaytime',
    description: 'Median playtime in hours',
  },
  {
    id: 'isFree',
    shortcut: 'free',
    label: 'Free to Play',
    category: 'metric',
    type: 'boolean',
    homeViewSlot: 'toggle',
    description: 'Free-to-play games only',
  },
  {
    id: 'discount',
    shortcut: 'sale',
    label: 'On Sale',
    category: 'metric',
    type: 'range',
    operators: ['>', '>='],
    unit: '%',
    minUrlParam: 'minDiscount',
    description: 'Currently discounted',
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
  {
    id: 'momentum',
    shortcut: 'momentum',
    label: 'Momentum Score',
    category: 'growth',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    minUrlParam: 'minMomentum',
    maxUrlParam: 'maxMomentum',
    description: 'Combined growth + velocity metric',
  },

  // -------------------------------------------------------------------------
  // Sentiment Filters
  // -------------------------------------------------------------------------
  {
    id: 'sentimentDelta',
    shortcut: 'sentiment',
    label: 'Sentiment Delta',
    category: 'sentiment',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    unit: '%',
    minUrlParam: 'minSentimentDelta',
    maxUrlParam: 'maxSentimentDelta',
    description: 'Recent vs all-time review score change',
  },
  {
    id: 'velocityTier',
    shortcut: 'velocity',
    label: 'Velocity Tier',
    category: 'sentiment',
    type: 'select',
    options: [
      { value: 'high', label: 'High', description: '5+ reviews/day' },
      { value: 'medium', label: 'Medium', description: '1-5 reviews/day' },
      { value: 'low', label: 'Low', description: '0.1-1 reviews/day' },
      { value: 'dormant', label: 'Dormant', description: '<0.1 reviews/day' },
    ],
    description: 'Review velocity category',
  },

  // -------------------------------------------------------------------------
  // Engagement Filters
  // -------------------------------------------------------------------------
  {
    id: 'activePct',
    shortcut: 'active',
    label: 'Active Player %',
    category: 'engagement',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    unit: '%',
    minUrlParam: 'minActivePct',
    description: 'CCU as percentage of owners',
  },
  {
    id: 'reviewRate',
    shortcut: 'rate',
    label: 'Review Rate',
    category: 'engagement',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    minUrlParam: 'minReviewRate',
    description: 'Reviews per 1000 owners',
  },
  {
    id: 'valueScore',
    shortcut: 'value',
    label: 'Value Score',
    category: 'engagement',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    minUrlParam: 'minValueScore',
    description: 'Hours of playtime per dollar',
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
    description: 'Steam user-defined tags',
  },
  {
    id: 'genres',
    shortcut: 'genre',
    label: 'Genres',
    category: 'content',
    type: 'multiselect',
    homeViewSlot: 'genre',
    description: 'Steam genres',
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
  {
    id: 'hasWorkshop',
    shortcut: 'workshop',
    label: 'Has Workshop',
    category: 'content',
    type: 'boolean',
    homeViewSlot: 'toggle',
    description: 'Has Steam Workshop support',
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
      { value: 'verified', label: 'Verified', description: 'Fully compatible' },
      { value: 'playable', label: 'Playable', description: 'Works with minor issues' },
      { value: 'unsupported', label: 'Unsupported', description: 'Not compatible' },
    ],
    homeViewSlot: 'platform',
    description: 'Steam Deck compatibility',
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
  {
    id: 'controller',
    shortcut: 'controller',
    label: 'Controller',
    category: 'platform',
    type: 'select',
    options: [
      { value: 'full', label: 'Full Support', description: 'Fully playable with controller' },
      { value: 'partial', label: 'Partial', description: 'Some features require keyboard' },
    ],
    description: 'Controller support level',
  },

  // -------------------------------------------------------------------------
  // Release Filters
  // -------------------------------------------------------------------------
  {
    id: 'age',
    shortcut: 'age',
    label: 'Days Since Release',
    category: 'release',
    type: 'range',
    operators: ['>', '<', '>=', '<=', '=', 'between'],
    minUrlParam: 'minAge',
    maxUrlParam: 'maxAge',
    description: 'Days since game release',
  },
  {
    id: 'released',
    shortcut: 'released',
    label: 'Released Within',
    category: 'release',
    type: 'select',
    options: [
      { value: '7', label: 'This Week', description: 'Last 7 days' },
      { value: '30', label: 'This Month', description: 'Last 30 days' },
      { value: '90', label: 'Last 3 Months', description: 'Last 90 days' },
      { value: '365', label: 'This Year', description: 'Last 365 days' },
    ],
    description: 'Release date filter',
  },
  {
    id: 'releaseYear',
    shortcut: 'year',
    label: 'Release Year',
    category: 'release',
    type: 'select',
    description: 'Specific release year',
  },
  {
    id: 'earlyAccess',
    shortcut: 'ea',
    label: 'Early Access',
    category: 'release',
    type: 'boolean',
    homeViewSlot: 'toggle',
    description: 'Currently in Early Access',
  },

  // -------------------------------------------------------------------------
  // Relationship Filters
  // -------------------------------------------------------------------------
  {
    id: 'publisherSearch',
    shortcut: 'publisher',
    label: 'Publisher',
    category: 'relationship',
    type: 'search',
    description: 'Search by publisher name',
  },
  {
    id: 'developerSearch',
    shortcut: 'developer',
    label: 'Developer',
    category: 'relationship',
    type: 'search',
    description: 'Search by developer name',
  },
  {
    id: 'publisherSize',
    shortcut: 'pubsize',
    label: 'Publisher Size',
    category: 'relationship',
    type: 'select',
    options: [
      { value: 'indie', label: 'Indie', description: '<10 games' },
      { value: 'mid', label: 'Mid-size', description: '10-50 games' },
      { value: 'major', label: 'Major', description: '50+ games' },
    ],
    description: 'Publisher catalog size',
  },
  {
    id: 'selfPublished',
    shortcut: 'self',
    label: 'Self-Published',
    category: 'relationship',
    type: 'boolean',
    homeViewSlot: 'toggle',
    description: 'Developer is also publisher',
  },
  {
    id: 'vsPublisher',
    shortcut: 'vspub',
    label: 'vs Publisher Avg',
    category: 'relationship',
    type: 'range',
    operators: ['>', '<', '>=', '<='],
    unit: 'pts',
    minUrlParam: 'minVsPublisher',
    description: 'Score difference from publisher average',
  },

  // -------------------------------------------------------------------------
  // Activity Filters
  // -------------------------------------------------------------------------
  {
    id: 'ccuTier',
    shortcut: 'tier',
    label: 'CCU Tier',
    category: 'activity',
    type: 'select',
    options: [
      { value: '1', label: 'Tier 1', description: 'Top 500 by CCU' },
      { value: '2', label: 'Tier 2', description: 'Top 1000 newest' },
      { value: '3', label: 'Tier 3', description: 'All others' },
    ],
    description: 'CCU polling tier',
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
 * Get all toggle filters (boolean filters in Home View)
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
