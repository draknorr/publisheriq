/**
 * Qdrant Collection Definitions for PublisherIQ
 *
 * All collections use scalar quantization (int8) to fit within
 * Qdrant Cloud's 1GB free tier.
 */

import type { QdrantClient } from '@qdrant/js-client-rest';

// Collection names
export const COLLECTIONS = {
  GAMES: 'publisheriq_games',
  PUBLISHERS_PORTFOLIO: 'publisheriq_publishers_portfolio',
  PUBLISHERS_IDENTITY: 'publisheriq_publishers_identity',
  DEVELOPERS_PORTFOLIO: 'publisheriq_developers_portfolio',
  DEVELOPERS_IDENTITY: 'publisheriq_developers_identity',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

// Embedding configuration
export const EMBEDDING_CONFIG = {
  MODEL: 'text-embedding-3-small',
  DIMENSIONS: 1536,
  MAX_TOKENS: 8191,
  MAX_CHARS: 2000, // ~500 tokens, safe limit
} as const;

// Quantization config for all collections - reduces storage 4x
const QUANTIZATION_CONFIG = {
  scalar: {
    type: 'int8' as const,
    quantile: 0.99, // Clip outliers
    always_ram: true, // Keep quantized vectors in RAM
  },
};

// Common vector config
const VECTOR_CONFIG = {
  size: EMBEDDING_CONFIG.DIMENSIONS,
  distance: 'Cosine' as const,
};

/**
 * Payload field indexes to create for filtering
 * Only index fields that will be used in filters
 */
const GAME_INDEXES = [
  { field: 'genres', schema: 'keyword' },
  { field: 'tags', schema: 'keyword' },
  { field: 'categories', schema: 'keyword' },
  { field: 'platforms', schema: 'keyword' },
  { field: 'steam_deck', schema: 'keyword' },
  { field: 'type', schema: 'keyword' },
  { field: 'price_tier', schema: 'keyword' },
  { field: 'owners_tier', schema: 'keyword' },
  { field: 'is_free', schema: 'bool' },
  { field: 'is_released', schema: 'bool' },
  { field: 'is_delisted', schema: 'bool' },
  { field: 'review_score', schema: 'integer' },
  { field: 'review_percentage', schema: 'integer' },
  { field: 'total_reviews', schema: 'integer' },  // For popularity comparison
  { field: 'release_year', schema: 'integer' },
  { field: 'publisher_ids', schema: 'integer' },
  { field: 'developer_ids', schema: 'integer' },
  { field: 'franchise_ids', schema: 'integer' },
] as const;

const ENTITY_INDEXES = [
  { field: 'top_genres', schema: 'keyword' },
  { field: 'top_tags', schema: 'keyword' },
  { field: 'is_major', schema: 'bool' },
  { field: 'is_indie', schema: 'bool' },
  { field: 'game_count', schema: 'integer' },
  { field: 'first_release_year', schema: 'integer' },
  { field: 'avg_review_percentage', schema: 'integer' },
] as const;

/**
 * Initialize all collections with proper schema and indexes
 */
export async function initializeCollections(client: QdrantClient): Promise<void> {
  // Games collection
  await ensureCollection(client, COLLECTIONS.GAMES, GAME_INDEXES);

  // Publisher collections
  await ensureCollection(client, COLLECTIONS.PUBLISHERS_PORTFOLIO, ENTITY_INDEXES);
  await ensureCollection(client, COLLECTIONS.PUBLISHERS_IDENTITY, ENTITY_INDEXES);

  // Developer collections
  await ensureCollection(client, COLLECTIONS.DEVELOPERS_PORTFOLIO, ENTITY_INDEXES);
  await ensureCollection(client, COLLECTIONS.DEVELOPERS_IDENTITY, ENTITY_INDEXES);
}

/**
 * Ensure a collection exists with proper config
 */
async function ensureCollection(
  client: QdrantClient,
  name: string,
  indexes: ReadonlyArray<{ field: string; schema: string }>
): Promise<void> {
  const exists = await client.collectionExists(name);

  if (!exists.exists) {
    await client.createCollection(name, {
      vectors: VECTOR_CONFIG,
      quantization_config: QUANTIZATION_CONFIG,
      optimizers_config: {
        default_segment_number: 2, // Good for ~150k vectors
        memmap_threshold: 20000, // Use mmap for larger segments
      },
      on_disk_payload: false, // Keep payloads in RAM for fast filtering
    });
  }

  // Always ensure indexes exist (idempotent - won't error if already exists)
  // This handles new indexes added after initial collection creation
  for (const { field, schema } of indexes) {
    try {
      await client.createPayloadIndex(name, {
        field_name: field,
        field_schema: schema as 'keyword' | 'integer' | 'bool' | 'float' | 'geo' | 'text',
      });
    } catch {
      // Index likely already exists, ignore
    }
  }
}

/**
 * Get collection name for entity type and variant
 */
export function getCollectionName(
  entityType: 'game' | 'publisher' | 'developer',
  variant?: 'portfolio' | 'identity'
): CollectionName {
  switch (entityType) {
    case 'game':
      return COLLECTIONS.GAMES;
    case 'publisher':
      return variant === 'identity'
        ? COLLECTIONS.PUBLISHERS_IDENTITY
        : COLLECTIONS.PUBLISHERS_PORTFOLIO;
    case 'developer':
      return variant === 'identity'
        ? COLLECTIONS.DEVELOPERS_IDENTITY
        : COLLECTIONS.DEVELOPERS_PORTFOLIO;
  }
}

/**
 * Delete all collections (for testing/reset)
 */
export async function deleteAllCollections(client: QdrantClient): Promise<void> {
  for (const name of Object.values(COLLECTIONS)) {
    const exists = await client.collectionExists(name);
    if (exists.exists) {
      await client.deleteCollection(name);
    }
  }
}

/**
 * Get collection info/stats
 */
export async function getCollectionStats(
  client: QdrantClient
): Promise<Record<CollectionName, { points: number; segments: number } | null>> {
  const stats: Record<string, { points: number; segments: number } | null> = {};

  for (const name of Object.values(COLLECTIONS)) {
    const exists = await client.collectionExists(name);
    if (exists.exists) {
      const info = await client.getCollection(name);
      stats[name] = {
        points: info.points_count ?? 0,
        segments: info.segments_count ?? 0,
      };
    } else {
      stats[name] = null;
    }
  }

  return stats as Record<CollectionName, { points: number; segments: number } | null>;
}
