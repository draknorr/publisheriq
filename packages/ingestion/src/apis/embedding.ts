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
  // Metrics from latest_daily_metrics
  total_reviews: number | null;
  owners_min: number | null;
  ccu_peak: number | null;
  average_playtime_forever: number | null;
  // From apps table
  metacritic_score: number | null;
  content_descriptors: Record<string, unknown> | null;
  language_count: number | null;
  // From app_trends
  trend_30d_direction: string | null;
  // From review_velocity_stats
  velocity_tier: string | null;
  // Franchise names for embedding text
  franchise_names: string[];
  // SteamSpy community tags (user-voted)
  steamspy_tags: string[];
  // Primary genre for embedding prefix
  primary_genre: string | null;
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
 * Get playtime tier description
 */
function getPlaytimeTier(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (minutes < 300) return 'Short';         // < 5 hours
  if (minutes < 1200) return 'Medium';       // 5-20 hours
  if (minutes < 6000) return 'Long';         // 20-100 hours
  return 'Endless';                          // 100+ hours
}

/**
 * Get scale/popularity description based on CCU and reviews
 */
function getScaleTier(ccuPeak: number | null, totalReviews: number | null): string {
  // Use CCU if available, otherwise fall back to reviews
  if (ccuPeak !== null) {
    if (ccuPeak >= 50000) return 'Massive';
    if (ccuPeak >= 10000) return 'Large';
    if (ccuPeak >= 1000) return 'Medium';
    if (ccuPeak >= 100) return 'Small';
    return 'Indie';
  }
  if (totalReviews !== null) {
    if (totalReviews >= 100000) return 'Massive';
    if (totalReviews >= 10000) return 'Large';
    if (totalReviews >= 1000) return 'Medium';
    if (totalReviews >= 100) return 'Small';
    return 'Indie';
  }
  return 'Unknown scale';
}

/**
 * Get price tier description
 */
function getPriceTier(priceCents: number | null, isFree: boolean): string {
  if (isFree) return 'Free';
  if (priceCents === null) return 'Unknown price';
  if (priceCents < 1000) return 'Budget';     // < $10
  if (priceCents < 2000) return 'Mid-price';  // $10-20
  if (priceCents < 4000) return 'Standard';   // $20-40
  return 'Premium';                           // $40+
}

/**
 * Get trend direction description
 */
function getTrendDescription(direction: string | null): string | null {
  if (!direction) return null;
  switch (direction) {
    case 'up': return 'Trending up';
    case 'down': return 'Declining';
    case 'stable': return 'Stable';
    default: return null;
  }
}

/**
 * Extract content descriptors as tags
 */
function extractContentDescriptors(descriptors: Record<string, unknown> | null): string[] {
  if (!descriptors) return [];
  const tags: string[] = [];

  // Common descriptor fields
  if (descriptors.violence) tags.push('Violence');
  if (descriptors.blood) tags.push('Blood');
  if (descriptors.gore) tags.push('Gore');
  if (descriptors.sexual_content) tags.push('Sexual Content');
  if (descriptors.nudity) tags.push('Nudity');
  if (descriptors.mature) tags.push('Mature');
  if (descriptors.drugs) tags.push('Drug Reference');
  if (descriptors.gambling) tags.push('Gambling');
  if (descriptors.language) tags.push('Strong Language');

  // Also check for notes/ids arrays
  if (Array.isArray(descriptors.notes)) {
    tags.push(...(descriptors.notes as string[]).slice(0, 3));
  }

  return tags;
}

/**
 * Build embedding text for a game
 * Enhanced structure with all available metadata for better similarity matching
 *
 * New structure:
 * - Genre-prefixed title (reduces name dominance)
 * - Franchise context (series identification)
 * - Separated gameplay/theme tags
 * - Community tags from SteamSpy
 * - Content descriptors (maturity markers)
 * - Playtime tier (game length)
 * - Scale/popularity tier (CCU + reviews)
 * - Activity level (velocity + trend)
 * - Metacritic score (external reception)
 * - Language count (localization scope)
 */
export function buildGameEmbeddingText(game: GameEmbeddingData): string {
  const lines: string[] = [];

  // Line 1: Genre-prefixed title (reduces name dominance in embeddings)
  const genrePrefix = game.primary_genre || (game.genres.length > 0 ? game.genres[0] : null);
  if (genrePrefix && game.type === 'game') {
    lines.push(`${genrePrefix} game: ${game.name}`);
  } else if (game.type !== 'game') {
    lines.push(`${game.type.toUpperCase()}: ${game.name}`);
  } else {
    lines.push(game.name);
  }

  // Line 2: Franchise context (if part of a series)
  if (game.franchise_names && game.franchise_names.length > 0) {
    lines.push(`Part of the ${game.franchise_names[0]} series`);
  }

  lines.push(''); // Blank line separator

  // CLASSIFICATION SECTION
  // Genres (all of them)
  if (game.genres.length > 0) {
    lines.push(`Genres: ${game.genres.join(', ')}`);
  }

  // PICS Tags (official Steam tags, up to 15)
  if (game.tags.length > 0) {
    lines.push(`Tags: ${game.tags.slice(0, 15).join(', ')}`);
  }

  // SteamSpy community tags (user-voted, supplement to PICS)
  if (game.steamspy_tags && game.steamspy_tags.length > 0) {
    // Filter out duplicates that already appear in PICS tags
    const uniqueCommunityTags = game.steamspy_tags.filter(
      (t) => !game.tags.some((pt) => pt.toLowerCase() === t.toLowerCase())
    );
    if (uniqueCommunityTags.length > 0) {
      lines.push(`Community tags: ${uniqueCommunityTags.slice(0, 10).join(', ')}`);
    }
  }

  // Features/categories
  if (game.categories.length > 0) {
    lines.push(`Features: ${game.categories.join(', ')}`);
  }

  // Content descriptors (maturity markers)
  const contentTags = extractContentDescriptors(game.content_descriptors);
  if (contentTags.length > 0) {
    lines.push(`Content: ${contentTags.join(', ')}`);
  }

  lines.push(''); // Blank line separator

  // METRICS SECTION
  // Playtime tier (game length)
  const playtimeTier = getPlaytimeTier(game.average_playtime_forever);
  if (playtimeTier) {
    const hours = game.average_playtime_forever
      ? Math.round(game.average_playtime_forever / 60)
      : null;
    lines.push(`Length: ${playtimeTier}${hours ? ` (~${hours} hours)` : ''}`);
  }

  // Scale/popularity tier
  const scaleTier = getScaleTier(game.ccu_peak, game.total_reviews);
  const scaleDetails: string[] = [];
  if (game.ccu_peak) scaleDetails.push(`${game.ccu_peak.toLocaleString()} peak players`);
  if (game.total_reviews) scaleDetails.push(`${game.total_reviews.toLocaleString()} reviews`);
  lines.push(`Scale: ${scaleTier}${scaleDetails.length > 0 ? ` (${scaleDetails.join(', ')})` : ''}`);

  // Activity level (velocity + trend)
  const activityParts: string[] = [];
  if (game.velocity_tier) {
    activityParts.push(`${game.velocity_tier} activity`);
  }
  const trendDesc = getTrendDescription(game.trend_30d_direction);
  if (trendDesc) {
    activityParts.push(trendDesc);
  }
  if (activityParts.length > 0) {
    lines.push(`Activity: ${activityParts.join(', ')}`);
  }

  // Reception (reviews + metacritic)
  const receptionParts: string[] = [];
  if (game.pics_review_percentage !== null) {
    const desc = getReviewDescription(game.pics_review_score);
    receptionParts.push(`${desc} (${game.pics_review_percentage}% positive)`);
  }
  if (game.metacritic_score) {
    receptionParts.push(`Metacritic: ${game.metacritic_score}/100`);
  }
  if (receptionParts.length > 0) {
    lines.push(`Reception: ${receptionParts.join(' | ')}`);
  }

  lines.push(''); // Blank line separator

  // IDENTITY SECTION (moved to end - already in payload for filtering)
  if (game.developers.length > 0) {
    lines.push(`By ${game.developers.join(', ')}`);
  }
  if (game.publishers.length > 0 && game.publishers.join(', ') !== game.developers.join(', ')) {
    lines.push(`Published by ${game.publishers.join(', ')}`);
  }

  // PLATFORM SECTION
  const platformParts: string[] = [formatPlatforms(game.platforms)];
  if (game.steam_deck_category && game.steam_deck_category !== 'unknown') {
    platformParts.push(`Steam Deck: ${game.steam_deck_category}`);
  }
  if (game.controller_support) {
    platformParts.push(`Controller: ${game.controller_support}`);
  }
  lines.push(`Platforms: ${platformParts.join(' | ')}`);

  // Languages
  if (game.language_count && game.language_count > 0) {
    lines.push(`Languages: ${game.language_count} supported`);
  }

  // Release & Price
  const releaseParts: string[] = [];
  if (game.release_date) {
    const year = new Date(game.release_date).getFullYear();
    releaseParts.push(`${year}`);
  }
  releaseParts.push(getPriceTier(game.current_price_cents, game.is_free));
  lines.push(`Released: ${releaseParts.join(' | ')}`);

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

  // DLC/demos/mods can have less metadata - be more lenient
  if (game.type !== 'game') {
    // Non-games just need at least 1 tag or 1 genre
    return game.tags.length >= 1 || game.genres.length >= 1;
  }

  // Games must have at least 3 tags OR 1 genre
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
