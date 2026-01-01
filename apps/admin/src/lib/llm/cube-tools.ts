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
                items: { type: 'string' },
                description: 'Filter values. For numbers, pass as strings (e.g., ["2025"] for year filters)',
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

export const SEARCH_GAMES_TOOL: Tool = {
  type: 'function',
  function: {
    name: 'search_games',
    description: `Search for games by tags, genres, categories, platforms, and other criteria.

Use this tool when users ask for games with specific characteristics like:
- "CRPG games for Mac"
- "Cozy games released in 2019"
- "Souls-like games with full controller support"
- "Metroidvania games on Steam Deck"
- "Games with Workshop support"

Supports fuzzy tag matching - you don't need exact tag names.`,
    parameters: {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Steam tags to filter by (fuzzy match). Examples: "CRPG", "Cozy", "Souls-like", "Metroidvania", "Pixel Graphics"',
        },
        genres: {
          type: 'array',
          items: { type: 'string' },
          description: 'Genres to filter by (fuzzy match). Examples: "RPG", "Action", "Adventure", "Indie", "Strategy"',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Steam feature categories (fuzzy match). Examples: "Achievements", "Cloud Saves", "Co-op", "Workshop", "VR"',
        },
        platforms: {
          type: 'array',
          items: { type: 'string', enum: ['windows', 'macos', 'linux'] },
          description: 'Required platform support',
        },
        controller_support: {
          type: 'string',
          enum: ['full', 'partial', 'any'],
          description: 'Controller support level required',
        },
        steam_deck: {
          type: 'array',
          items: { type: 'string', enum: ['verified', 'playable'] },
          description: 'Steam Deck compatibility requirement',
        },
        release_year: {
          type: 'object',
          properties: {
            gte: { type: 'number', description: 'Released in or after this year' },
            lte: { type: 'number', description: 'Released in or before this year' },
          },
          description: 'Release year range filter',
        },
        review_percentage: {
          type: 'object',
          properties: {
            gte: { type: 'number', description: 'Minimum positive review percentage (0-100)' },
          },
          description: 'Review score filter',
        },
        metacritic_score: {
          type: 'object',
          properties: {
            gte: { type: 'number', description: 'Minimum Metacritic score (0-100)' },
          },
          description: 'Metacritic score filter',
        },
        is_free: {
          type: 'boolean',
          description: 'Filter by free-to-play status',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default 20, max 50)',
        },
        order_by: {
          type: 'string',
          enum: ['reviews', 'score', 'release_date', 'owners'],
          description: 'Sort order: reviews (default), score, release_date, or owners',
        },
      },
      required: [],
    },
  },
};

export const LOOKUP_TAGS_TOOL: Tool = {
  type: 'function',
  function: {
    name: 'lookup_tags',
    description: `Search for available Steam tags, genres, or categories.

Use this tool when you need to:
- Find the correct tag name for a concept (e.g., "rogue" → "Roguelike", "Roguelite")
- Discover what tags/genres/categories exist
- Verify a tag exists before using it in search_games`,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find matching tags/genres/categories',
        },
        type: {
          type: 'string',
          enum: ['tags', 'genres', 'categories', 'all'],
          description: 'Type to search: tags, genres, categories, or all (default)',
        },
        limit: {
          type: 'number',
          description: 'Maximum results per type (default 10, max 20)',
        },
      },
      required: ['query'],
    },
  },
};

// Export all tools for the chat interface
export const CUBE_TOOLS: Tool[] = [
  QUERY_ANALYTICS_TOOL,
  FIND_SIMILAR_TOOL,
  SEARCH_GAMES_TOOL,
  LOOKUP_TAGS_TOOL,
];
