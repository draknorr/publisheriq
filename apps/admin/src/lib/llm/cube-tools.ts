/**
 * Cube.dev-based LLM tools
 *
 * These tools replace the raw SQL query_database tool with
 * safe, pre-defined Cube.dev semantic queries.
 */

import type { Tool } from './types';

export const QUERY_ANALYTICS_TOOL: Tool = {
  type: 'function',
  function: {
    name: 'query_analytics',
    description: `Query game, publisher, and developer analytics using pre-defined semantic models.

CUBES:
- Discovery: Games with metrics (use for most game queries)
- PublisherMetrics: Publisher portfolio analytics
- DeveloperMetrics: Developer portfolio analytics
- DailyMetrics: Historical time-series data

IMPORTANT - USE SEGMENTS FOR COMMON FILTERS:
- Trending games → segment "Discovery.trending" (NOT filter on isTrendingUp)
- Good reviews → segment "Discovery.highlyRated" (80%+) or "Discovery.veryPositive" (90%+)
- Popular games → segment "Discovery.popular" (1000+ reviews)
- Steam Deck → segment "Discovery.steamDeckVerified" or "Discovery.steamDeckPlayable"
- Free games → segment "Discovery.free"

Only use filters for custom thresholds not covered by segments.

ALWAYS include Discovery.appid and Discovery.name in dimensions for game lists.`,
    parameters: {
      type: 'object',
      properties: {
        cube: {
          type: 'string',
          enum: ['Discovery', 'PublisherMetrics', 'DeveloperMetrics', 'DailyMetrics'],
          description: 'The cube to query. Use Discovery for game queries.',
        },
        dimensions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Dimensions to include (e.g., ["Discovery.name", "Discovery.appid"])',
        },
        measures: {
          type: 'array',
          items: { type: 'string' },
          description: 'Measures to aggregate (e.g., ["Discovery.count", "PublisherMetrics.sumOwners"])',
        },
        filters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              member: { type: 'string', description: 'Dimension or measure to filter on' },
              operator: {
                type: 'string',
                enum: ['equals', 'notEquals', 'contains', 'notContains', 'gt', 'gte', 'lt', 'lte', 'set', 'notSet'],
              },
              values: {
                type: 'array',
                items: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
                description: 'Filter values (strings for text, numbers for numeric comparisons, booleans for flags)',
              },
            },
            required: ['member', 'operator'],
          },
          description: 'Filters to apply',
        },
        segments: {
          type: 'array',
          items: { type: 'string' },
          description: 'Pre-defined segments to apply (e.g., ["Discovery.highlyRated", "Discovery.steamDeckVerified"])',
        },
        order: {
          type: 'object',
          additionalProperties: { type: 'string', enum: ['asc', 'desc'] },
          description: 'Sort order (e.g., {"Discovery.totalReviews": "desc"})',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default 50, max 100)',
        },
        reasoning: {
          type: 'string',
          description: 'Brief explanation of why this query answers the user question',
        },
      },
      required: ['cube', 'reasoning'],
    },
  },
};

export const FIND_SIMILAR_TOOL: Tool = {
  type: 'function',
  function: {
    name: 'find_similar',
    description: `Find games, publishers, or developers similar to a reference entity using semantic similarity search.

Use this tool for questions like:
- "Games like Hades" / "Similar to Stardew Valley"
- "Hidden gems like Dead Cells" (less popular alternatives)
- "Publishers similar to Devolver Digital"
- "Better reviewed alternatives to [game]"
- "Cheaper games similar to [game]"

Returns semantically similar entities based on genres, tags, features, and other characteristics.`,
    parameters: {
      type: 'object',
      properties: {
        entity_type: {
          type: 'string',
          enum: ['game', 'publisher', 'developer'],
          description: 'Type of entity to search for',
        },
        reference_name: {
          type: 'string',
          description: 'Name of the game/publisher/developer to find similar matches for',
        },
        filters: {
          type: 'object',
          description: 'Optional filters to narrow results',
          properties: {
            popularity_comparison: {
              type: 'string',
              enum: ['any', 'less_popular', 'similar', 'more_popular'],
              description: 'Filter by relative popularity. Use "less_popular" for hidden gems.',
            },
            review_comparison: {
              type: 'string',
              enum: ['any', 'similar_or_better', 'better_only'],
              description: 'Filter by relative review scores',
            },
            max_price_cents: {
              type: 'number',
              description: 'Maximum price in cents (e.g., 1999 for $19.99)',
            },
            is_free: {
              type: 'boolean',
              description: 'Only show free-to-play games',
            },
            platforms: {
              type: 'array',
              items: { type: 'string', enum: ['windows', 'macos', 'linux'] },
              description: 'Required platform support',
            },
            steam_deck: {
              type: 'array',
              items: { type: 'string', enum: ['verified', 'playable'] },
              description: 'Steam Deck compatibility requirement',
            },
            genres: {
              type: 'array',
              items: { type: 'string' },
              description: 'Required genres (e.g., ["Action", "RPG"])',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Required tags (e.g., ["Roguelike", "Indie"])',
            },
            min_reviews: {
              type: 'number',
              description: 'Minimum number of reviews',
            },
            release_year: {
              type: 'object',
              properties: {
                gte: { type: 'number', description: 'Released in or after this year' },
                lte: { type: 'number', description: 'Released in or before this year' },
              },
            },
          },
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (1-20, default 10)',
        },
      },
      required: ['entity_type', 'reference_name'],
    },
  },
};

// Export both the new Cube.dev-based tools and the similarity tool
export const CUBE_TOOLS: Tool[] = [QUERY_ANALYTICS_TOOL, FIND_SIMILAR_TOOL];
