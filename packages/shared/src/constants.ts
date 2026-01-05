/**
 * Rate limit configurations for Steam APIs
 * Values are in requests per second unless otherwise noted
 */
export const RATE_LIMITS = {
  /** SteamSpy general endpoints - 1 request per second */
  STEAMSPY_GENERAL: { requestsPerSecond: 1, burst: 1 },

  /** SteamSpy "all" endpoint - 1 request per 60 seconds */
  STEAMSPY_ALL: { requestsPerSecond: 1 / 60, burst: 1 },

  /** Steam Storefront API - 0.33 req/sec per worker (3 workers = ~1 req/sec total) */
  STOREFRONT: { requestsPerSecond: 0.33, burst: 3 },

  /** Steam Reviews API - approximately 20 requests per minute */
  REVIEWS: { requestsPerSecond: 0.33, burst: 5 },

  /** Steam Review Histogram API - approximately 60 requests per minute */
  HISTOGRAM: { requestsPerSecond: 1, burst: 5 },

  /** Community Hub scraping - conservative 1 request per 1.5 seconds */
  COMMUNITY_SCRAPE: { requestsPerSecond: 0.67, burst: 1 },
} as const;

/**
 * API base URLs
 */
export const API_URLS = {
  STEAM_WEB: 'https://api.steampowered.com',
  STEAM_STORE: 'https://store.steampowered.com',
  STEAMSPY: 'https://steamspy.com/api.php',
  STEAM_COMMUNITY: 'https://steamcommunity.com',
} as const;

/**
 * Default batch sizes for sync operations
 */
export const BATCH_SIZES = {
  /** Number of apps per page from SteamSpy "all" endpoint */
  STEAMSPY_PAGE: 1000,

  /** Number of apps to fetch from Storefront API per worker run */
  STOREFRONT_BATCH: 1500,

  /** Number of apps to fetch reviews for per worker run */
  REVIEWS_BATCH: 800,

  /** Number of apps to fetch histograms for per worker run */
  HISTOGRAM_BATCH: 2000,

  /** Number of community pages to scrape per worker run */
  SCRAPER_BATCH: 1000,

  /** Number of apps to calculate trends for per batch */
  TRENDS_BATCH: 500,

  /** Number of apps to calculate priority for per batch */
  PRIORITY_BATCH: 1000,
} as const;

/**
 * Retry configuration
 */
export const RETRY_CONFIG = {
  /** Maximum number of retry attempts */
  MAX_RETRIES: 3,

  /** Initial delay in milliseconds before first retry */
  INITIAL_DELAY_MS: 1000,

  /** Maximum delay in milliseconds between retries */
  MAX_DELAY_MS: 30000,

  /** Multiplier for exponential backoff */
  BACKOFF_MULTIPLIER: 2,
} as const;

/**
 * Priority score thresholds
 */
export const PRIORITY_THRESHOLDS = {
  /** CCU threshold for highest priority tier */
  CCU_HIGH: 10000,
  /** CCU threshold for medium priority tier */
  CCU_MEDIUM: 1000,
  /** CCU threshold for low priority tier */
  CCU_LOW: 100,

  /** Review velocity threshold for high activity */
  REVIEW_VELOCITY_HIGH: 10,

  /** Trend change percentage threshold for significance */
  TREND_SIGNIFICANT: 10,

  /** Review velocity threshold for dead games */
  DEAD_GAME_VELOCITY: 0.1,
} as const;

/**
 * Priority score values
 */
export const PRIORITY_SCORES = {
  CCU_HIGH: 100,
  CCU_MEDIUM: 50,
  CCU_LOW: 25,
  REVIEW_ACTIVITY_HIGH: 40,
  TRENDING: 25,
  DEAD_GAME_PENALTY: -50,
} as const;

/**
 * Steam Workshop category ID
 * Used to detect if a game supports Workshop
 */
export const STEAM_CATEGORY_WORKSHOP = 30;

/**
 * Review score descriptions from Steam
 */
export const REVIEW_SCORE_DESC = {
  1: 'Overwhelmingly Negative',
  2: 'Very Negative',
  3: 'Negative',
  4: 'Mostly Negative',
  5: 'Mixed',
  6: 'Mostly Positive',
  7: 'Positive',
  8: 'Very Positive',
  9: 'Overwhelmingly Positive',
} as const;

/**
 * App types from Steam
 */
export const APP_TYPES = [
  'game',
  'dlc',
  'demo',
  'mod',
  'video',
  'hardware',
  'music',
  'episode',
  'tool',
  'application',
  'series',
  'advertising',
] as const;

export type AppType = (typeof APP_TYPES)[number];
export type SyncSource = 'steamspy' | 'storefront' | 'reviews' | 'histogram' | 'scraper';
export type TrendDirection = 'up' | 'down' | 'stable';
