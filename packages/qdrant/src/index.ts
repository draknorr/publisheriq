/**
 * @publisheriq/qdrant
 *
 * Qdrant vector database client for semantic similarity search.
 */

// Client
export { getQdrantClient, isQdrantConfigured, testConnection, resetClient } from './client.js';

// Collections
export {
  COLLECTIONS,
  EMBEDDING_CONFIG,
  initializeCollections,
  deleteAllCollections,
  getCollectionStats,
  getCollectionName,
  type CollectionName,
} from './collections.js';

// Filter builder
export {
  buildGameFilter,
  buildEntityFilter,
  type QdrantFilter,
  type QdrantCondition,
} from './filter-builder.js';

// Types
export type {
  // Entity types
  EntityType,
  AppType,
  SteamDeckCategory,
  Platform,
  PriceTier,
  OwnersTier,
  CcuTier,
  // Payloads
  GamePayload,
  PublisherPortfolioPayload,
  PublisherIdentityPayload,
  DeveloperPortfolioPayload,
  DeveloperIdentityPayload,
  PublisherPayload,
  DeveloperPayload,
  QdrantPayload,
  // Filters
  RangeFilter,
  DateRangeFilter,
  PopularityComparison,
  ReviewComparison,
  GameFilters,
  EntityFilters,
  // Search
  SimilaritySearchRequest,
  SimilaritySearchResult,
  SimilaritySearchResponse,
  EmbeddingSyncStatus,
} from './types.js';
