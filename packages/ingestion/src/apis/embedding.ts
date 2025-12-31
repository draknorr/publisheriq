/**
 * Embedding Text Builders and OpenAI API
 *
 * Functions for building embedding text from game/publisher/developer data
 * and calling the OpenAI embeddings API.
 */

import OpenAI from 'openai';
import { createHash } from 'crypto';
import { EMBEDDING_CONFIG } from '@publisheriq/qdrant';

// OpenAI client (lazy initialized)
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OPENAI_API_KEY environment variable');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Game data from the get_apps_for_embedding RPC
 */
export interface GameEmbeddingData {
  appid: number;
  name: string;
  type: string;
  is_free: boolean;
  current_price_cents: number | null;
  release_date: string | null;
  platforms: string | null;
  controller_support: string | null;
  pics_review_score: number | null;
  pics_review_percentage: number | null;
  steam_deck_category: string | null;
  is_released: boolean;
  is_delisted: boolean;
  developers: string[];
  publishers: string[];
  genres: string[];
  tags: string[];
  categories: string[];
  franchise_ids: number[];
  developer_ids: number[];
  publisher_ids: number[];
  updated_at: string;
  total_reviews: number | null;  // From daily_metrics, for popularity comparison
}

/**
 * Publisher data from the get_publishers_for_embedding RPC
 */
export interface PublisherEmbeddingData {
  id: number;
  name: string;
  game_count: number;
  first_game_release_date: string | null;
  top_genres: string[];
  top_tags: string[];
  platforms_supported: string[];
  total_reviews: number;
  avg_review_percentage: number | null;
  top_game_names: string[];
  top_game_appids: number[];
}

/**
 * Developer data from the get_developers_for_embedding RPC
 */
export interface DeveloperEmbeddingData {
  id: number;
  name: string;
  game_count: number;
  first_game_release_date: string | null;
  is_indie: boolean;
  top_genres: string[];
  top_tags: string[];
  platforms_supported: string[];
  total_reviews: number;
  avg_review_percentage: number | null;
  top_game_names: string[];
  top_game_appids: number[];
}

/**
 * Review score to description mapping
 */
const REVIEW_DESCRIPTIONS: Record<number, string> = {
  1: 'Overwhelmingly Negative',
  2: 'Very Negative',
  3: 'Negative',
  4: 'Mostly Negative',
  5: 'Mixed',
  6: 'Mostly Positive',
  7: 'Positive',
  8: 'Very Positive',
  9: 'Overwhelmingly Positive',
};

function getReviewDescription(score: number | null): string {
  if (score === null) return 'No reviews';
  return REVIEW_DESCRIPTIONS[score] || 'Unknown';
}

function formatPrice(priceCents: number | null, isFree: boolean): string {
  if (isFree) return 'Free to Play';
  if (priceCents === null) return 'Price unknown';
  return `$${(priceCents / 100).toFixed(2)}`;
}

function formatPlatforms(platforms: string | null): string {
  if (!platforms) return 'Unknown';
  return platforms
    .split(',')
    .map((p) => p.trim())
    .map((p) => (p === 'windows' ? 'Windows' : p === 'macos' ? 'Mac' : p === 'linux' ? 'Linux' : p))
    .join(', ');
}

/**
 * Build embedding text for a game
 * Combines all metadata into a structured text format
 */
export function buildGameEmbeddingText(game: GameEmbeddingData): string {
  const lines: string[] = [game.name, ''];

  lines.push(`Type: ${game.type}`);

  if (game.developers.length > 0) {
    lines.push(`Developers: ${game.developers.join(', ')}`);
  }

  if (game.publishers.length > 0) {
    lines.push(`Publishers: ${game.publishers.join(', ')}`);
  }

  if (game.genres.length > 0) {
    lines.push(`Genres: ${game.genres.join(', ')}`);
  }

  if (game.tags.length > 0) {
    lines.push(`Tags: ${game.tags.slice(0, 15).join(', ')}`);
  }

  if (game.categories.length > 0) {
    lines.push(`Features: ${game.categories.join(', ')}`);
  }

  lines.push(`Platforms: ${formatPlatforms(game.platforms)}`);

  if (game.release_date) {
    lines.push(`Released: ${game.release_date}`);
  }

  lines.push(`Price: ${formatPrice(game.current_price_cents, game.is_free)}`);

  if (game.controller_support) {
    lines.push(`Controller: ${game.controller_support}`);
  }

  if (game.steam_deck_category) {
    lines.push(`Steam Deck: ${game.steam_deck_category}`);
  }

  if (game.pics_review_percentage !== null) {
    const desc = getReviewDescription(game.pics_review_score);
    lines.push(`Reviews: ${desc} (${game.pics_review_percentage}% positive)`);
  }

  const text = lines.join('\n');

  // Truncate to max chars to stay within token limits
  if (text.length > EMBEDDING_CONFIG.MAX_CHARS) {
    return text.slice(0, EMBEDDING_CONFIG.MAX_CHARS);
  }

  return text;
}

/**
 * Build embedding text for a publisher's portfolio
 * Aggregates data from all their games
 */
export function buildPublisherPortfolioText(publisher: PublisherEmbeddingData): string {
  const lines: string[] = [publisher.name, ''];

  lines.push(`Publisher with ${publisher.game_count} games`);

  if (publisher.first_game_release_date) {
    const year = new Date(publisher.first_game_release_date).getFullYear();
    lines.push(`Active since: ${year}`);
  }

  if (publisher.top_genres.length > 0) {
    lines.push(`Genres: ${publisher.top_genres.join(', ')}`);
  }

  if (publisher.top_tags.length > 0) {
    lines.push(`Tags: ${publisher.top_tags.join(', ')}`);
  }

  if (publisher.platforms_supported.length > 0) {
    lines.push(`Platforms: ${publisher.platforms_supported.join(', ')}`);
  }

  if (publisher.avg_review_percentage !== null) {
    lines.push(`Average reviews: ${Math.round(publisher.avg_review_percentage)}% positive`);
  }

  const text = lines.join('\n');
  return text.length > EMBEDDING_CONFIG.MAX_CHARS ? text.slice(0, EMBEDDING_CONFIG.MAX_CHARS) : text;
}

/**
 * Build embedding text for a publisher's identity (top games)
 * Focuses on what they're known for
 */
export function buildPublisherIdentityText(publisher: PublisherEmbeddingData): string {
  const lines: string[] = [publisher.name, ''];

  lines.push(`Publisher known for:`);

  if (publisher.top_game_names.length > 0) {
    lines.push(`Notable games: ${publisher.top_game_names.slice(0, 10).join(', ')}`);
  }

  if (publisher.top_genres.length > 0) {
    lines.push(`Specializes in: ${publisher.top_genres.slice(0, 5).join(', ')}`);
  }

  if (publisher.top_tags.length > 0) {
    lines.push(`Known for: ${publisher.top_tags.slice(0, 10).join(', ')}`);
  }

  const text = lines.join('\n');
  return text.length > EMBEDDING_CONFIG.MAX_CHARS ? text.slice(0, EMBEDDING_CONFIG.MAX_CHARS) : text;
}

/**
 * Build embedding text for a developer's portfolio
 */
export function buildDeveloperPortfolioText(developer: DeveloperEmbeddingData): string {
  const lines: string[] = [developer.name, ''];

  const type = developer.is_indie ? 'Indie developer' : 'Developer';
  lines.push(`${type} with ${developer.game_count} games`);

  if (developer.first_game_release_date) {
    const year = new Date(developer.first_game_release_date).getFullYear();
    lines.push(`Active since: ${year}`);
  }

  if (developer.top_genres.length > 0) {
    lines.push(`Genres: ${developer.top_genres.join(', ')}`);
  }

  if (developer.top_tags.length > 0) {
    lines.push(`Tags: ${developer.top_tags.join(', ')}`);
  }

  if (developer.platforms_supported.length > 0) {
    lines.push(`Platforms: ${developer.platforms_supported.join(', ')}`);
  }

  if (developer.avg_review_percentage !== null) {
    lines.push(`Average reviews: ${Math.round(developer.avg_review_percentage)}% positive`);
  }

  const text = lines.join('\n');
  return text.length > EMBEDDING_CONFIG.MAX_CHARS ? text.slice(0, EMBEDDING_CONFIG.MAX_CHARS) : text;
}

/**
 * Build embedding text for a developer's identity (top games)
 */
export function buildDeveloperIdentityText(developer: DeveloperEmbeddingData): string {
  const lines: string[] = [developer.name, ''];

  const type = developer.is_indie ? 'Indie developer' : 'Developer';
  lines.push(`${type} known for:`);

  if (developer.top_game_names.length > 0) {
    lines.push(`Notable games: ${developer.top_game_names.slice(0, 10).join(', ')}`);
  }

  if (developer.top_genres.length > 0) {
    lines.push(`Specializes in: ${developer.top_genres.slice(0, 5).join(', ')}`);
  }

  if (developer.top_tags.length > 0) {
    lines.push(`Known for: ${developer.top_tags.slice(0, 10).join(', ')}`);
  }

  const text = lines.join('\n');
  return text.length > EMBEDDING_CONFIG.MAX_CHARS ? text.slice(0, EMBEDDING_CONFIG.MAX_CHARS) : text;
}

/**
 * Hash embedding text for change detection
 */
export function hashEmbeddingText(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/**
 * Check if a game has enough metadata to be worth embedding
 */
export function isWorthEmbedding(game: GameEmbeddingData): boolean {
  // Must have name
  if (!game.name) return false;

  // Must have at least 3 tags OR 1 genre
  if (game.tags.length < 3 && game.genres.length < 1) return false;

  return true;
}

/**
 * Generate embeddings for a batch of texts
 * Uses OpenAI's text-embedding-3-small model
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<{ embeddings: number[][]; usage: { prompt_tokens: number; total_tokens: number } }> {
  if (texts.length === 0) {
    return { embeddings: [], usage: { prompt_tokens: 0, total_tokens: 0 } };
  }

  const openai = getOpenAI();

  const response = await openai.embeddings.create({
    model: EMBEDDING_CONFIG.MODEL,
    input: texts,
    dimensions: EMBEDDING_CONFIG.DIMENSIONS,
  });

  const embeddings = response.data.map((d) => d.embedding);

  return {
    embeddings,
    usage: response.usage,
  };
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await generateEmbeddings([text]);
  return result.embeddings[0];
}
