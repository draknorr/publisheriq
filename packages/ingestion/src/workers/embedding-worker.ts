/**
 * Embedding Sync Worker
 *
 * Generates embeddings for games, publishers, and developers
 * and syncs to Qdrant Cloud vector database.
 *
 * Run with: pnpm --filter @publisheriq/ingestion embedding-sync
 */

import { getServiceClient } from '@publisheriq/database';
import { logger } from '@publisheriq/shared';
import {
  getQdrantClient,
  initializeCollections,
  COLLECTIONS,
  type GamePayload,
  type PublisherPortfolioPayload,
  type PublisherIdentityPayload,
  type DeveloperPortfolioPayload,
  type DeveloperIdentityPayload,
  type PriceTier,
  type Platform,
  type SteamDeckCategory,
} from '@publisheriq/qdrant';
import {
  buildGameEmbeddingText,
  buildPublisherPortfolioText,
  buildPublisherIdentityText,
  buildDeveloperPortfolioText,
  buildDeveloperIdentityText,
  hashEmbeddingText,
  isWorthEmbedding,
  generateEmbeddings,
  type GameEmbeddingData,
  type PublisherEmbeddingData,
  type DeveloperEmbeddingData,
} from '../apis/embedding.js';

const log = logger.child({ worker: 'embedding-sync' });

// Configuration
const GAME_BATCH_SIZE = 100; // Games to fetch from DB at a time
const QDRANT_BATCH_SIZE = 100; // Points to upsert at a time

interface SyncStats {
  gamesProcessed: number;
  gamesEmbedded: number;
  gamesSkipped: number;
  gamesFailed: number;
  publishersEmbedded: number;
  developersEmbedded: number;
  tokensUsed: number;
}

/**
 * Calculate price tier from cents
 */
function getPriceTier(priceCents: number | null, isFree: boolean): PriceTier {
  if (isFree || priceCents === 0) return 'free';
  if (priceCents === null) return 'under_20'; // Default
  if (priceCents < 1000) return 'under_10';
  if (priceCents < 2000) return 'under_20';
  if (priceCents < 4000) return 'under_40';
  return 'premium';
}


/**
 * Parse platforms string to array
 */
function parsePlatforms(platforms: string | null): Platform[] {
  if (!platforms) return [];
  return platforms
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is Platform => ['windows', 'macos', 'linux'].includes(p));
}

/**
 * Build game payload for Qdrant
 */
function buildGamePayload(game: GameEmbeddingData, embeddingHash: string): GamePayload {
  return {
    appid: game.appid,
    name: game.name,
    type: game.type as GamePayload['type'],
    genres: game.genres,
    tags: game.tags.slice(0, 15),
    categories: game.categories,
    platforms: parsePlatforms(game.platforms),
    steam_deck: (game.steam_deck_category as SteamDeckCategory) || 'unknown',
    controller_support: game.controller_support,
    is_free: game.is_free,
    price_tier: getPriceTier(game.current_price_cents, game.is_free),
    price_cents: game.current_price_cents,
    review_score: game.pics_review_score,
    review_percentage: game.pics_review_percentage,
    total_reviews: null, // Would need to fetch from daily_metrics
    owners_tier: null, // Would need to fetch from daily_metrics
    ccu_tier: null, // Would need to fetch from daily_metrics
    release_year: game.release_date ? new Date(game.release_date).getFullYear() : null,
    developer_ids: game.developer_ids,
    publisher_ids: game.publisher_ids,
    franchise_ids: game.franchise_ids,
    is_released: game.is_released,
    is_delisted: game.is_delisted,
    embedding_hash: embeddingHash,
    updated_at: Date.now(),
  };
}

/**
 * Process a batch of games
 */
async function processGameBatch(
  supabase: ReturnType<typeof getServiceClient>,
  qdrant: ReturnType<typeof getQdrantClient>,
  games: GameEmbeddingData[],
  stats: SyncStats
): Promise<void> {
  // Filter to games worth embedding
  const worthyGames = games.filter(isWorthEmbedding);
  stats.gamesSkipped += games.length - worthyGames.length;

  if (worthyGames.length === 0) {
    return;
  }

  // Build embedding texts
  const texts = worthyGames.map(buildGameEmbeddingText);
  const hashes = texts.map(hashEmbeddingText);

  // Generate embeddings
  const { embeddings, usage } = await generateEmbeddings(texts);
  stats.tokensUsed += usage.total_tokens;

  // Build Qdrant points
  const points = worthyGames.map((game, i) => ({
    id: game.appid,
    vector: embeddings[i],
    payload: buildGamePayload(game, hashes[i]),
  }));

  // Upsert to Qdrant in batches
  for (let i = 0; i < points.length; i += QDRANT_BATCH_SIZE) {
    const batch = points.slice(i, i + QDRANT_BATCH_SIZE);
    await qdrant.upsert(COLLECTIONS.GAMES, {
      wait: true,
      points: batch,
    });
  }

  // Mark as embedded in Supabase
  const appids = worthyGames.map((g) => g.appid);
  await supabase.rpc('mark_apps_embedded', {
    p_appids: appids,
    p_hashes: hashes,
  });

  stats.gamesEmbedded += worthyGames.length;
  stats.gamesProcessed += games.length;
}

/**
 * Process a batch of publishers
 */
async function processPublisherBatch(
  publishers: PublisherEmbeddingData[],
  qdrant: ReturnType<typeof getQdrantClient>,
  stats: SyncStats
): Promise<void> {
  // Build portfolio texts
  const portfolioTexts = publishers.map(buildPublisherPortfolioText);
  const portfolioHashes = portfolioTexts.map(hashEmbeddingText);

  // Build identity texts
  const identityTexts = publishers.map(buildPublisherIdentityText);
  const identityHashes = identityTexts.map(hashEmbeddingText);

  // Generate all embeddings
  const { embeddings: portfolioEmbeddings, usage: portfolioUsage } =
    await generateEmbeddings(portfolioTexts);
  stats.tokensUsed += portfolioUsage.total_tokens;

  const { embeddings: identityEmbeddings, usage: identityUsage } =
    await generateEmbeddings(identityTexts);
  stats.tokensUsed += identityUsage.total_tokens;

  // Build payloads and upsert portfolio collection
  const portfolioPoints = publishers.map((pub: PublisherEmbeddingData, i: number) => ({
    id: pub.id,
    vector: portfolioEmbeddings[i],
    payload: {
      id: pub.id,
      name: pub.name,
      game_count: pub.game_count,
      first_release_year: pub.first_game_release_date
        ? new Date(pub.first_game_release_date).getFullYear()
        : null,
      top_genres: pub.top_genres,
      top_tags: pub.top_tags,
      platforms_supported: pub.platforms_supported as Platform[],
      total_owners_tier: null,
      avg_review_percentage: pub.avg_review_percentage ? Math.round(pub.avg_review_percentage) : null,
      total_reviews: pub.total_reviews,
      is_major: pub.game_count >= 10,
      embedding_hash: portfolioHashes[i],
      updated_at: Date.now(),
    } as PublisherPortfolioPayload,
  }));

  for (let i = 0; i < portfolioPoints.length; i += QDRANT_BATCH_SIZE) {
    const batch = portfolioPoints.slice(i, i + QDRANT_BATCH_SIZE);
    await qdrant.upsert(COLLECTIONS.PUBLISHERS_PORTFOLIO, {
      wait: true,
      points: batch,
    });
  }

  // Upsert identity collection
  const identityPoints = publishers.map((pub: PublisherEmbeddingData, i: number) => ({
    id: pub.id,
    vector: identityEmbeddings[i],
    payload: {
      id: pub.id,
      name: pub.name,
      game_count: pub.game_count,
      top_game_names: pub.top_game_names.slice(0, 10),
      top_game_appids: pub.top_game_appids.slice(0, 10),
      top_game_genres: pub.top_genres.slice(0, 5),
      flagship_game_appid: pub.top_game_appids[0] || null,
      is_major: pub.game_count >= 10,
      avg_review_percentage: pub.avg_review_percentage ? Math.round(pub.avg_review_percentage) : null,
      embedding_hash: identityHashes[i],
      updated_at: Date.now(),
    } as PublisherIdentityPayload,
  }));

  for (let i = 0; i < identityPoints.length; i += QDRANT_BATCH_SIZE) {
    const batch = identityPoints.slice(i, i + QDRANT_BATCH_SIZE);
    await qdrant.upsert(COLLECTIONS.PUBLISHERS_IDENTITY, {
      wait: true,
      points: batch,
    });
  }

  stats.publishersEmbedded += publishers.length;
}

/**
 * Process publishers (top by game count)
 */
async function processPublishers(
  supabase: ReturnType<typeof getServiceClient>,
  qdrant: ReturnType<typeof getQdrantClient>,
  stats: SyncStats
): Promise<void> {
  log.info('Fetching publishers for embedding');

  const { data: publishers, error } = await supabase.rpc('get_publishers_for_embedding', {
    p_limit: 500,
  });

  if (error) {
    log.error('Failed to fetch publishers', { error });
    return;
  }

  if (!publishers || publishers.length === 0) {
    log.info('No publishers to embed');
    return;
  }

  log.info('Embedding publishers', { count: publishers.length });
  await processPublisherBatch(publishers as PublisherEmbeddingData[], qdrant, stats);
  log.info('Publishers embedding complete', { total: stats.publishersEmbedded });
}

/**
 * Process a batch of developers
 */
async function processDeveloperBatch(
  developers: DeveloperEmbeddingData[],
  qdrant: ReturnType<typeof getQdrantClient>,
  stats: SyncStats
): Promise<void> {
  // Build portfolio texts
  const portfolioTexts = developers.map(buildDeveloperPortfolioText);
  const portfolioHashes = portfolioTexts.map(hashEmbeddingText);

  // Build identity texts
  const identityTexts = developers.map(buildDeveloperIdentityText);
  const identityHashes = identityTexts.map(hashEmbeddingText);

  // Generate embeddings
  const { embeddings: portfolioEmbeddings, usage: portfolioUsage } =
    await generateEmbeddings(portfolioTexts);
  stats.tokensUsed += portfolioUsage.total_tokens;

  const { embeddings: identityEmbeddings, usage: identityUsage } =
    await generateEmbeddings(identityTexts);
  stats.tokensUsed += identityUsage.total_tokens;

  // Upsert portfolio collection
  const portfolioPoints = developers.map((dev: DeveloperEmbeddingData, i: number) => ({
    id: dev.id,
    vector: portfolioEmbeddings[i],
    payload: {
      id: dev.id,
      name: dev.name,
      game_count: dev.game_count,
      first_release_year: dev.first_game_release_date
        ? new Date(dev.first_game_release_date).getFullYear()
        : null,
      top_genres: dev.top_genres,
      top_tags: dev.top_tags,
      platforms_supported: dev.platforms_supported as Platform[],
      avg_review_percentage: dev.avg_review_percentage ? Math.round(dev.avg_review_percentage) : null,
      total_reviews: dev.total_reviews,
      is_indie: dev.is_indie,
      embedding_hash: portfolioHashes[i],
      updated_at: Date.now(),
    } as DeveloperPortfolioPayload,
  }));

  for (let i = 0; i < portfolioPoints.length; i += QDRANT_BATCH_SIZE) {
    const batch = portfolioPoints.slice(i, i + QDRANT_BATCH_SIZE);
    await qdrant.upsert(COLLECTIONS.DEVELOPERS_PORTFOLIO, {
      wait: true,
      points: batch,
    });
  }

  // Upsert identity collection
  const identityPoints = developers.map((dev: DeveloperEmbeddingData, i: number) => ({
    id: dev.id,
    vector: identityEmbeddings[i],
    payload: {
      id: dev.id,
      name: dev.name,
      game_count: dev.game_count,
      top_game_names: dev.top_game_names.slice(0, 10),
      top_game_appids: dev.top_game_appids.slice(0, 10),
      top_game_genres: dev.top_genres.slice(0, 5),
      flagship_game_appid: dev.top_game_appids[0] || null,
      is_indie: dev.is_indie,
      avg_review_percentage: dev.avg_review_percentage ? Math.round(dev.avg_review_percentage) : null,
      embedding_hash: identityHashes[i],
      updated_at: Date.now(),
    } as DeveloperIdentityPayload,
  }));

  for (let i = 0; i < identityPoints.length; i += QDRANT_BATCH_SIZE) {
    const batch = identityPoints.slice(i, i + QDRANT_BATCH_SIZE);
    await qdrant.upsert(COLLECTIONS.DEVELOPERS_IDENTITY, {
      wait: true,
      points: batch,
    });
  }

  stats.developersEmbedded += developers.length;
}

/**
 * Process developers (top by game count)
 */
async function processDevelopers(
  supabase: ReturnType<typeof getServiceClient>,
  qdrant: ReturnType<typeof getQdrantClient>,
  stats: SyncStats
): Promise<void> {
  log.info('Fetching developers for embedding');

  const { data: developers, error } = await supabase.rpc('get_developers_for_embedding', {
    p_limit: 500,
  });

  if (error) {
    log.error('Failed to fetch developers', { error });
    return;
  }

  if (!developers || developers.length === 0) {
    log.info('No developers to embed');
    return;
  }

  log.info('Embedding developers', { count: developers.length });
  await processDeveloperBatch(developers as DeveloperEmbeddingData[], qdrant, stats);
  log.info('Developers embedding complete', { total: stats.developersEmbedded });
}

/**
 * Main worker function
 */
async function main(): Promise<void> {
  const startTime = Date.now();
  const githubRunId = process.env.GITHUB_RUN_ID;
  const batchSize = parseInt(process.env.BATCH_SIZE || String(GAME_BATCH_SIZE), 10);
  const syncCollection = process.env.SYNC_COLLECTION || 'all'; // games, publishers, developers, all

  log.info('Starting embedding sync', { githubRunId, batchSize, syncCollection });

  const supabase = getServiceClient();
  const qdrant = getQdrantClient();

  // Create sync job record
  const { data: job, error: jobError } = await supabase
    .from('sync_jobs')
    .insert({
      job_type: 'embedding',
      github_run_id: githubRunId,
      status: 'running',
    })
    .select()
    .single();

  if (jobError) {
    log.error('Failed to create sync job record', { error: jobError });
  }

  const stats: SyncStats = {
    gamesProcessed: 0,
    gamesEmbedded: 0,
    gamesSkipped: 0,
    gamesFailed: 0,
    publishersEmbedded: 0,
    developersEmbedded: 0,
    tokensUsed: 0,
  };

  try {
    // Initialize Qdrant collections
    log.info('Initializing Qdrant collections');
    await initializeCollections(qdrant);

    // Process games
    if (syncCollection === 'all' || syncCollection === 'games') {
      log.info('Fetching games for embedding');

      // Fetch games in batches
      let hasMore = true;
      while (hasMore) {
        const { data: games, error } = await supabase.rpc('get_apps_for_embedding', {
          p_limit: batchSize,
        });

        if (error) {
          log.error('Failed to fetch games', { error });
          break;
        }

        if (!games || games.length === 0) {
          log.info('No more games to embed');
          hasMore = false;
          break;
        }

        log.info('Processing game batch', {
          count: games.length,
          processed: stats.gamesProcessed,
          embedded: stats.gamesEmbedded,
        });

        await processGameBatch(supabase, qdrant, games as GameEmbeddingData[], stats);

        // Check if we got a full batch (more might be available)
        hasMore = games.length === batchSize;
      }
    }

    // Process publishers
    if (syncCollection === 'all' || syncCollection === 'publishers') {
      await processPublishers(supabase, qdrant, stats);
    }

    // Process developers
    if (syncCollection === 'all' || syncCollection === 'developers') {
      await processDevelopers(supabase, qdrant, stats);
    }

    // Update sync job as completed
    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          items_processed: stats.gamesProcessed + stats.publishersEmbedded + stats.developersEmbedded,
          items_succeeded: stats.gamesEmbedded + stats.publishersEmbedded + stats.developersEmbedded,
          items_failed: stats.gamesFailed,
          items_skipped: stats.gamesSkipped,
        })
        .eq('id', job.id);
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    log.info('Embedding sync completed', {
      durationMinutes: duration,
      ...stats,
      estimatedCost: `$${((stats.tokensUsed / 1000000) * 0.02).toFixed(4)}`,
    });
  } catch (error) {
    log.error('Embedding sync failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Update sync job as failed
    if (job) {
      await supabase
        .from('sync_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : String(error),
          items_processed: stats.gamesProcessed,
          items_succeeded: stats.gamesEmbedded,
          items_failed: stats.gamesFailed,
          items_skipped: stats.gamesSkipped,
        })
        .eq('id', job.id);
    }

    process.exit(1);
  }
}

main();
