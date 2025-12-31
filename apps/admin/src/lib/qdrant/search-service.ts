/**
 * Similarity Search Service
 *
 * Handles semantic similarity searches using Qdrant.
 */

import {
  getQdrantClient,
  isQdrantConfigured,
  getCollectionName,
  buildGameFilter,
  type GameFilters,
  type EntityFilters,
  type GamePayload,
  type EntityType,
  type PopularityComparison,
  type ReviewComparison,
  type OwnersTier,
  buildEntityFilter,
} from '@publisheriq/qdrant';
import { getSupabase } from '@/lib/supabase';

// Maximum results to return
const MAX_RESULTS = 50;
const DEFAULT_RESULTS = 10;

/**
 * Arguments for find_similar tool
 */
export interface FindSimilarArgs {
  entity_type: EntityType;
  reference_name: string;
  filters?: {
    popularity_comparison?: PopularityComparison;
    review_comparison?: ReviewComparison;
    max_price_cents?: number;
    is_free?: boolean;
    platforms?: ('windows' | 'macos' | 'linux')[];
    steam_deck?: ('verified' | 'playable')[];
    genres?: string[];
    tags?: string[];
    min_reviews?: number;
    release_year?: { gte?: number; lte?: number };
  };
  limit?: number;
}

/**
 * Result from find_similar
 */
export interface FindSimilarResult {
  success: boolean;
  reference?: {
    id: number;
    name: string;
    type: string;
  };
  results?: Array<{
    id: number;
    name: string;
    score: number;
    type?: string;
    genres?: string[];
    tags?: string[];
    review_percentage?: number | null;
    price_cents?: number | null;
    is_free?: boolean;
  }>;
  total_found?: number;
  error?: string;
}

/**
 * Look up entity by name
 */
async function lookupEntityByName(
  entityType: EntityType,
  name: string
): Promise<{ id: number; name: string; type?: string; metrics?: object } | null> {
  const supabase = getSupabase();

  if (entityType === 'game') {
    const { data } = await supabase
      .from('apps')
      .select('appid, name, type, pics_review_percentage, current_price_cents, publisher_ids:app_publishers(publisher_id), developer_ids:app_developers(developer_id)')
      .ilike('name', name)
      .eq('type', 'game')
      .limit(1)
      .single();

    if (data) {
      return {
        id: data.appid,
        name: data.name,
        type: data.type,
        metrics: {
          review_percentage: data.pics_review_percentage,
          price_cents: data.current_price_cents,
          publisher_ids: (data.publisher_ids as { publisher_id: number }[])?.map(p => p.publisher_id) || [],
          developer_ids: (data.developer_ids as { developer_id: number }[])?.map(d => d.developer_id) || [],
        },
      };
    }

    // Try partial match
    const { data: partial } = await supabase
      .from('apps')
      .select('appid, name, type, pics_review_percentage, current_price_cents')
      .ilike('name', `%${name}%`)
      .eq('type', 'game')
      .limit(1)
      .single();

    if (partial) {
      return {
        id: partial.appid,
        name: partial.name,
        type: partial.type,
        metrics: {
          review_percentage: partial.pics_review_percentage,
          price_cents: partial.current_price_cents,
        },
      };
    }
  } else if (entityType === 'publisher') {
    const { data } = await supabase
      .from('publishers')
      .select('id, name, game_count')
      .ilike('name', name)
      .limit(1)
      .single();

    if (data) {
      return { id: data.id, name: data.name };
    }

    // Partial match
    const { data: partial } = await supabase
      .from('publishers')
      .select('id, name')
      .ilike('name', `%${name}%`)
      .limit(1)
      .single();

    if (partial) {
      return { id: partial.id, name: partial.name };
    }
  } else if (entityType === 'developer') {
    const { data } = await supabase
      .from('developers')
      .select('id, name, game_count')
      .ilike('name', name)
      .limit(1)
      .single();

    if (data) {
      return { id: data.id, name: data.name };
    }

    // Partial match
    const { data: partial } = await supabase
      .from('developers')
      .select('id, name')
      .ilike('name', `%${name}%`)
      .limit(1)
      .single();

    if (partial) {
      return { id: partial.id, name: partial.name };
    }
  }

  return null;
}

/**
 * Get vector for an entity from Qdrant
 */
async function getEntityVector(
  entityType: EntityType,
  id: number
): Promise<number[] | null> {
  const client = getQdrantClient();
  const collection = getCollectionName(entityType);

  try {
    const result = await client.retrieve(collection, {
      ids: [id],
      with_vector: true,
    });

    if (result.length > 0 && result[0].vector) {
      return result[0].vector as number[];
    }
  } catch {
    // Entity not in Qdrant yet
  }

  return null;
}

/**
 * Execute similarity search
 */
export async function findSimilar(args: FindSimilarArgs): Promise<FindSimilarResult> {
  // Check if Qdrant is configured
  if (!isQdrantConfigured()) {
    return {
      success: false,
      error: 'Similarity search not configured. QDRANT_URL and QDRANT_API_KEY must be set.',
    };
  }

  const { entity_type, reference_name, filters, limit = DEFAULT_RESULTS } = args;
  const actualLimit = Math.min(limit, MAX_RESULTS);

  // Look up the reference entity
  const entity = await lookupEntityByName(entity_type, reference_name);

  if (!entity) {
    return {
      success: false,
      error: `Could not find ${entity_type} named "${reference_name}". Try a different name or check spelling.`,
    };
  }

  // Get vector for the entity
  const vector = await getEntityVector(entity_type, entity.id);

  if (!vector) {
    return {
      success: false,
      error: `${entity.name} hasn't been indexed for similarity search yet. Try another ${entity_type}.`,
    };
  }

  // Build filter
  const client = getQdrantClient();
  const collection = getCollectionName(entity_type);

  let qdrantFilter;
  if (entity_type === 'game' && filters) {
    const gameFilters: GameFilters = {
      exclude_appids: [entity.id],
      exclude_delisted: true,
      is_released: true,
    };

    // Map filter args to GameFilters
    if (filters.is_free !== undefined) gameFilters.is_free = filters.is_free;
    if (filters.max_price_cents) gameFilters.price_range = { lte: filters.max_price_cents };
    if (filters.platforms) gameFilters.platforms = filters.platforms;
    if (filters.steam_deck) gameFilters.steam_deck = filters.steam_deck;
    if (filters.genres) gameFilters.genres = filters.genres;
    if (filters.tags) gameFilters.tags = filters.tags;
    if (filters.min_reviews) gameFilters.min_reviews = filters.min_reviews;
    if (filters.release_year) gameFilters.release_year = filters.release_year;
    if (filters.popularity_comparison) gameFilters.popularity_comparison = filters.popularity_comparison;
    if (filters.review_comparison) gameFilters.review_comparison = filters.review_comparison;

    // Get source metrics for relative comparisons
    const sourceMetrics = entity.metrics as {
      owners_tier?: OwnersTier;
      review_percentage?: number;
      price_cents?: number;
      publisher_ids?: number[];
      developer_ids?: number[];
    } | undefined;

    qdrantFilter = buildGameFilter(gameFilters, sourceMetrics);
  } else if (entity_type !== 'game') {
    const entityFilters: EntityFilters = {
      exclude_ids: [entity.id],
    };
    qdrantFilter = buildEntityFilter(entityFilters);
  }

  // Execute search
  const searchResult = await client.search(collection, {
    vector,
    filter: qdrantFilter,
    limit: actualLimit,
    with_payload: {
      include: ['name', 'type', 'genres', 'tags', 'review_percentage', 'price_cents', 'is_free', 'game_count'],
    },
  });

  // Format results
  const results = searchResult.map((point) => {
    const payload = point.payload as Partial<GamePayload> & { game_count?: number };
    return {
      id: point.id as number,
      name: payload.name || 'Unknown',
      score: Math.round(point.score * 100), // Convert to percentage
      type: payload.type,
      genres: payload.genres?.slice(0, 3),
      tags: payload.tags?.slice(0, 5),
      review_percentage: payload.review_percentage,
      price_cents: payload.price_cents,
      is_free: payload.is_free,
      game_count: payload.game_count,
    };
  });

  return {
    success: true,
    reference: {
      id: entity.id,
      name: entity.name,
      type: entity.type || entity_type,
    },
    results,
    total_found: searchResult.length,
  };
}
