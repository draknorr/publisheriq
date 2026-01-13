/**
 * Query templates for chat autocomplete and post-response suggestions.
 * These patterns enable instant suggestions without LLM calls.
 */

export interface QuerySuggestion {
  label: string;      // Display text (may be truncated)
  query: string;      // Full query to submit
  category: 'template' | 'tag' | 'game' | 'publisher' | 'developer';
}

// Tag-based query templates - {input} is replaced with user's typed text
export const TAG_TEMPLATES = [
  '{input} games on Steam Deck',
  '{input} games with great reviews',
  'trending {input} games',
  'free {input} games',
  'hidden gem {input} games',
  "what's breaking out in {input}?",
  'best {input} games of 2025',
  '{input} games under $20',
  '{input} games on Linux',
  '{input} games with co-op',
];

// Game-based query templates - {game} is replaced with matched game name
export const GAME_TEMPLATES = [
  'games similar to {game}',
  'cheaper alternatives to {game}',
  'games like {game} but less popular',
  'Steam Deck games like {game}',
  'tell me about {game}',
];

// Publisher/developer query templates
export const ENTITY_TEMPLATES = [
  'all games by {entity}',
  'top games from {entity}',
  'how many games has {entity} published?',
  '{entity} games with best reviews',
];

// Discovery templates (no variable replacement)
export const DISCOVERY_TEMPLATES = [
  "what's breaking out right now?",
  'trending games this week',
  'best indie games of 2025',
  'Steam Deck verified games with great reviews',
  'free-to-play games with the most players',
  'games gaining traction this month',
  'hidden gem roguelikes',
  'cozy games on Steam Deck',
];

/**
 * Common tags for autocomplete matching.
 * Prioritized by popularity/usefulness.
 */
export const COMMON_TAGS = [
  'roguelike', 'roguelite', 'metroidvania', 'souls-like', 'soulslike',
  'indie', 'action', 'rpg', 'strategy', 'puzzle', 'platformer',
  'horror', 'survival', 'simulation', 'racing', 'sports',
  'fps', 'shooter', 'adventure', 'open world', 'sandbox',
  'co-op', 'multiplayer', 'single-player', 'vr', 'pixel',
  'retro', 'deck-builder', 'turn-based', 'real-time',
  'story-rich', 'atmospheric', 'cozy', 'relaxing',
  'free-to-play', 'early access', 'demo',
];

/**
 * Match user input against query templates.
 * Returns instant suggestions without API calls.
 */
export function matchTemplates(
  input: string,
  options?: {
    maxResults?: number;
    includeDiscovery?: boolean;
  }
): QuerySuggestion[] {
  const { maxResults = 5, includeDiscovery = true } = options || {};
  const suggestions: QuerySuggestion[] = [];
  const normalizedInput = input.toLowerCase().trim();

  if (normalizedInput.length < 2) {
    // For very short input, return discovery templates
    if (includeDiscovery) {
      return DISCOVERY_TEMPLATES.slice(0, maxResults).map(query => ({
        label: query,
        query,
        category: 'template' as const,
      }));
    }
    return [];
  }

  // Check if input matches a common tag
  const matchedTag = COMMON_TAGS.find(tag =>
    tag.toLowerCase().includes(normalizedInput) ||
    normalizedInput.includes(tag.toLowerCase())
  );

  if (matchedTag) {
    // Generate tag-based suggestions
    for (const template of TAG_TEMPLATES) {
      const query = template.replace('{input}', matchedTag);
      suggestions.push({
        label: query,
        query,
        category: 'tag',
      });
      if (suggestions.length >= maxResults) break;
    }
  } else {
    // Use input as-is for tag templates
    for (const template of TAG_TEMPLATES.slice(0, 3)) {
      const query = template.replace('{input}', normalizedInput);
      suggestions.push({
        label: query,
        query,
        category: 'template',
      });
    }
  }

  // Add discovery templates that match
  if (includeDiscovery) {
    for (const query of DISCOVERY_TEMPLATES) {
      if (query.toLowerCase().includes(normalizedInput)) {
        suggestions.push({
          label: query,
          query,
          category: 'template',
        });
      }
    }
  }

  // Dedupe and limit
  const seen = new Set<string>();
  return suggestions
    .filter(s => {
      const key = s.query.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxResults);
}

/**
 * Generate suggestions when a game name is detected.
 */
export function generateGameSuggestions(
  gameName: string,
  maxResults = 4
): QuerySuggestion[] {
  return GAME_TEMPLATES.slice(0, maxResults).map(template => {
    const query = template.replace('{game}', gameName);
    return {
      label: query,
      query,
      category: 'game' as const,
    };
  });
}

/**
 * Generate suggestions when a publisher/developer is detected.
 */
export function generateEntitySuggestions(
  entityName: string,
  entityType: 'publisher' | 'developer',
  maxResults = 4
): QuerySuggestion[] {
  return ENTITY_TEMPLATES.slice(0, maxResults).map(template => {
    const query = template.replace('{entity}', entityName);
    return {
      label: query,
      query,
      category: entityType,
    };
  });
}

/**
 * Highlight matching text in a suggestion label.
 * Returns array of segments with isMatch flag.
 */
export function highlightMatch(
  label: string,
  input: string
): Array<{ text: string; isMatch: boolean }> {
  if (!input.trim()) {
    return [{ text: label, isMatch: false }];
  }

  const normalizedInput = input.toLowerCase();
  const normalizedLabel = label.toLowerCase();
  const startIndex = normalizedLabel.indexOf(normalizedInput);

  if (startIndex === -1) {
    return [{ text: label, isMatch: false }];
  }

  const segments: Array<{ text: string; isMatch: boolean }> = [];

  if (startIndex > 0) {
    segments.push({ text: label.slice(0, startIndex), isMatch: false });
  }

  segments.push({
    text: label.slice(startIndex, startIndex + input.length),
    isMatch: true,
  });

  if (startIndex + input.length < label.length) {
    segments.push({
      text: label.slice(startIndex + input.length),
      isMatch: false,
    });
  }

  return segments;
}
