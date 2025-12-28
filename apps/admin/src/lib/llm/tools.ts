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

export const TOOLS: Tool[] = [QUERY_DATABASE_TOOL];
