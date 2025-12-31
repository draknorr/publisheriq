import type { Tool } from './types';

export const QUERY_DATABASE_TOOL: Tool = {
  type: 'function',
  function: {
    name: 'query_database',
    description: `Query the Steam analytics PostgreSQL database. Use this to answer questions about games, publishers, developers, reviews, player counts, and trends.

RULES:
- Only SELECT queries are allowed
- Always include LIMIT (max 50 rows)
- Use explicit JOINs (no implicit joins)
- Use ILIKE for case-insensitive text searches
- For latest metrics, filter: metric_date = (SELECT MAX(metric_date) FROM daily_metrics WHERE appid = a.appid)
- Use NULLIF(total_reviews, 0) when calculating ratios to avoid division by zero

Return the SQL query that answers the user's question.`,
    parameters: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description:
            'The SELECT SQL query to execute. Must be valid PostgreSQL with LIMIT clause.',
        },
        reasoning: {
          type: 'string',
          description:
            'Brief explanation of why this query answers the user question and what tables/joins are used.',
        },
      },
      required: ['sql', 'reasoning'],
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

export const TOOLS: Tool[] = [QUERY_DATABASE_TOOL, FIND_SIMILAR_TOOL];
