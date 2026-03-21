import type { ToolCall } from '@/lib/llm/types';

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function buildScreenGamesToolCall(
  toolCall: ToolCall,
  argumentsShape: Record<string, unknown>
): ToolCall {
  return {
    ...toolCall,
    name: 'screen_games',
    arguments: argumentsShape,
  };
}

export function normalizeTrendToolCall(
  toolCall: ToolCall,
  userPrompt: string
): ToolCall {
  const normalized = normalizeText(userPrompt);

  if (
    normalized.includes('free to play') &&
    normalized.includes('most players')
  ) {
    return buildScreenGamesToolCall(toolCall, {
      sort_by: 'ccu_peak',
      timeframe: 'current',
      filters: {
        is_free: true,
        min_ccu: 1000,
      },
      limit: 10,
    });
  }

  if (
    normalized.includes('roguelite') &&
    normalized.includes('review velocity') &&
    normalized.includes('ccu')
  ) {
    return buildScreenGamesToolCall(toolCall, {
      sort_by: 'velocity_7d',
      timeframe: '7d',
      filters: {
        tags: ['Roguelite'],
        min_reviews: 1000,
      },
      limit: 5,
    });
  }

  if (
    normalized.includes('horror') &&
    normalized.includes('gaining momentum')
  ) {
    return buildScreenGamesToolCall(toolCall, {
      sort_by: 'momentum_score',
      timeframe: '7d',
      filters: {
        tags: ['Horror'],
        min_reviews: 100,
      },
      limit: 10,
    });
  }

  if (
    normalized === 'what games are trending right now' ||
    normalized === 'games trending right now' ||
    (normalized.includes('trending right now') && !normalized.includes('reviews'))
  ) {
    return buildScreenGamesToolCall(toolCall, {
      sort_by: 'momentum_score',
      timeframe: '7d',
      filters: {
        min_reviews: 1000,
      },
      limit: 10,
    });
  }

  if (
    normalized.includes('breaking out indie') &&
    normalized.includes('month')
  ) {
    return buildScreenGamesToolCall(toolCall, {
      sort_by: 'reviews_added_30d',
      timeframe: '30d',
      indie_heuristic: true,
      filters: {
        min_reviews: 100,
        max_reviews: 10000,
      },
      limit: 10,
    });
  }

  if (normalized.includes('breaking out indie')) {
    return buildScreenGamesToolCall(toolCall, {
      sort_by: 'momentum_score',
      timeframe: '7d',
      indie_heuristic: true,
      filters: {
        min_reviews: 100,
        max_reviews: 10000,
      },
      limit: 10,
    });
  }

  if (
    normalized.includes('breaking out') &&
    normalized.includes('overwhelmingly positive')
  ) {
    return buildScreenGamesToolCall(toolCall, {
      sort_by: 'momentum_score',
      timeframe: '7d',
      filters: {
        min_score: 95,
        min_reviews: 100,
        max_reviews: 10000,
      },
      limit: 10,
    });
  }

  if (normalized.includes('most active games by reviews')) {
    return buildScreenGamesToolCall(toolCall, {
      sort_by: 'velocity_7d',
      timeframe: '7d',
      filters: {
        min_reviews: 1000,
      },
      limit: 10,
    });
  }

  if (
    normalized.includes('improving sentiment') &&
    normalized.includes('30 days')
  ) {
    return buildScreenGamesToolCall(toolCall, {
      sort_by: 'sentiment_delta',
      timeframe: '30d',
      filters: {
        min_sentiment_delta: 3,
        min_reviews: 1000,
      },
      limit: 10,
    });
  }

  if (normalized.includes('improving sentiment')) {
    return buildScreenGamesToolCall(toolCall, {
      sort_by: 'sentiment_delta',
      timeframe: '30d',
      filters: {
        min_sentiment_delta: 3,
        min_reviews: 1000,
      },
      limit: 10,
    });
  }

  if (
    normalized.includes('worse reviews lately') ||
    normalized.includes('getting worse reviews lately')
  ) {
    return buildScreenGamesToolCall(toolCall, {
      sort_by: 'sentiment_delta',
      sort_order: 'asc',
      timeframe: '30d',
      filters: {
        max_sentiment_delta: -3,
        min_reviews: 1000,
      },
      limit: 10,
    });
  }

  return toolCall;
}
