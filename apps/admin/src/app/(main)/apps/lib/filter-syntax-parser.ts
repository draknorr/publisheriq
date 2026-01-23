/**
 * Filter Syntax Parser
 *
 * Parses user input into structured filter operations.
 * Supports:
 * - Range syntax: ccu > 50000, ccu 1000-50000
 * - Boolean syntax: free, free:yes, free:no, no:ea
 * - Content syntax: genre:action, tag:roguelike
 */

import {
  type FilterDefinition,
  type Operator,
  getFilterByShortcut,
  FILTER_REGISTRY,
} from './filter-registry';

// ============================================================================
// Types
// ============================================================================

export type ParsedFilterType = 'range' | 'boolean' | 'content' | 'search';

export interface ParsedRangeFilter {
  type: 'range';
  filter: FilterDefinition;
  operator: Operator;
  value: number;
  minValue?: number;  // For 'between' operator
  maxValue?: number;  // For 'between' operator
  displayText: string;
}

export interface ParsedBooleanFilter {
  type: 'boolean';
  filter: FilterDefinition;
  value: boolean;
  displayText: string;
}

export interface ParsedContentFilter {
  type: 'content';
  filter: FilterDefinition;
  value: string;
  displayText: string;
}

export interface ParsedSearchFilter {
  type: 'search';
  filter: FilterDefinition;
  value: string;
  displayText: string;
}

export type ParsedFilter =
  | ParsedRangeFilter
  | ParsedBooleanFilter
  | ParsedContentFilter
  | ParsedSearchFilter;

export interface ParseResult {
  success: boolean;
  filter?: ParsedFilter;
  error?: string;
  suggestions?: string[];
}

// ============================================================================
// Parser Implementation
// ============================================================================

/**
 * Parse a filter syntax string into a structured filter
 *
 * Supported formats:
 * - Range: "ccu > 50000", "ccu >= 1000", "ccu 1000-50000"
 * - Boolean: "free", "free:yes", "free:no", "no:ea", "workshop"
 * - Content: "genre:action", "tag:roguelike"
 * - Search: "publisher:valve", "developer:indie"
 */
export function parseFilterSyntax(input: string): ParseResult {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return { success: false, error: 'Empty input' };
  }

  // Try parsing in order of specificity

  // 1. Try range with hyphen syntax: "ccu 1000-50000"
  const rangeWithHyphen = parseRangeWithHyphen(trimmed);
  if (rangeWithHyphen.success) return rangeWithHyphen;

  // 2. Try range with operator: "ccu > 50000"
  const rangeWithOperator = parseRangeWithOperator(trimmed);
  if (rangeWithOperator.success) return rangeWithOperator;

  // 3. Try boolean with colon: "free:yes", "free:no"
  const booleanWithColon = parseBooleanWithColon(trimmed);
  if (booleanWithColon.success) return booleanWithColon;

  // 4. Try negated boolean: "no:ea", "no:free"
  const negatedBoolean = parseNegatedBoolean(trimmed);
  if (negatedBoolean.success) return negatedBoolean;

  // 5. Try content filter: "genre:action", "tag:roguelike"
  const contentFilter = parseContentFilter(trimmed);
  if (contentFilter.success) return contentFilter;

  // 6. Try bare boolean: "free", "workshop", "ea"
  const bareBoolean = parseBareBoolean(trimmed);
  if (bareBoolean.success) return bareBoolean;

  // 7. Generate suggestions if no match
  return {
    success: false,
    error: 'Could not parse filter',
    suggestions: generateSuggestions(trimmed),
  };
}

/**
 * Parse range with hyphen syntax: "ccu 1000-50000"
 */
function parseRangeWithHyphen(input: string): ParseResult {
  // Match: shortcut value-value (with optional spaces)
  const match = input.match(/^(\w+)\s+(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (!match) {
    return { success: false };
  }

  const [, shortcut, minStr, maxStr] = match;
  const filter = getFilterByShortcut(shortcut);

  if (!filter) {
    return {
      success: false,
      error: `Unknown filter: ${shortcut}`,
      suggestions: findSimilarShortcuts(shortcut),
    };
  }

  if (filter.type !== 'range') {
    return {
      success: false,
      error: `${filter.label} does not support range values`,
    };
  }

  const minValue = parseFloat(minStr);
  const maxValue = parseFloat(maxStr);

  if (isNaN(minValue) || isNaN(maxValue)) {
    return { success: false, error: 'Invalid number values' };
  }

  if (minValue > maxValue) {
    return { success: false, error: 'Min value must be less than max value' };
  }

  const displayText = formatRangeDisplay(filter, 'between', minValue, maxValue);

  return {
    success: true,
    filter: {
      type: 'range',
      filter,
      operator: 'between',
      value: minValue,
      minValue,
      maxValue,
      displayText,
    },
  };
}

/**
 * Parse range with operator: "ccu > 50000", "score >= 85"
 */
function parseRangeWithOperator(input: string): ParseResult {
  // Match: shortcut operator value
  const match = input.match(/^(\w+)\s*(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?)$/);
  if (!match) {
    return { success: false };
  }

  const [, shortcut, operatorStr, valueStr] = match;
  const filter = getFilterByShortcut(shortcut);

  if (!filter) {
    return {
      success: false,
      error: `Unknown filter: ${shortcut}`,
      suggestions: findSimilarShortcuts(shortcut),
    };
  }

  if (filter.type !== 'range') {
    return {
      success: false,
      error: `${filter.label} does not support range values`,
    };
  }

  const operator = operatorStr as Operator;
  const value = parseFloat(valueStr);

  if (isNaN(value)) {
    return { success: false, error: 'Invalid number value' };
  }

  // Validate operator is supported
  if (filter.operators && !filter.operators.includes(operator)) {
    return {
      success: false,
      error: `${filter.label} does not support the ${operator} operator`,
    };
  }

  const displayText = formatRangeDisplay(filter, operator, value);

  return {
    success: true,
    filter: {
      type: 'range',
      filter,
      operator,
      value,
      displayText,
    },
  };
}

/**
 * Parse boolean with colon: "free:yes", "workshop:no"
 */
function parseBooleanWithColon(input: string): ParseResult {
  const match = input.match(/^(\w+):(yes|no|true|false)$/);
  if (!match) {
    return { success: false };
  }

  const [, shortcut, valueStr] = match;
  const filter = getFilterByShortcut(shortcut);

  if (!filter) {
    return {
      success: false,
      error: `Unknown filter: ${shortcut}`,
      suggestions: findSimilarShortcuts(shortcut),
    };
  }

  if (filter.type !== 'boolean') {
    return {
      success: false,
      error: `${filter.label} is not a boolean filter`,
    };
  }

  const value = valueStr === 'yes' || valueStr === 'true';
  const displayText = value ? filter.label : `Not ${filter.label}`;

  return {
    success: true,
    filter: {
      type: 'boolean',
      filter,
      value,
      displayText,
    },
  };
}

/**
 * Parse negated boolean: "no:ea", "no:free"
 */
function parseNegatedBoolean(input: string): ParseResult {
  const match = input.match(/^no:(\w+)$/);
  if (!match) {
    return { success: false };
  }

  const [, shortcut] = match;
  const filter = getFilterByShortcut(shortcut);

  if (!filter) {
    return {
      success: false,
      error: `Unknown filter: ${shortcut}`,
      suggestions: findSimilarShortcuts(shortcut),
    };
  }

  if (filter.type !== 'boolean') {
    return {
      success: false,
      error: `${filter.label} is not a boolean filter`,
    };
  }

  return {
    success: true,
    filter: {
      type: 'boolean',
      filter,
      value: false,
      displayText: `Not ${filter.label}`,
    },
  };
}

/**
 * Parse content filter: "genre:action", "tag:roguelike"
 */
function parseContentFilter(input: string): ParseResult {
  const match = input.match(/^(\w+):(.+)$/);
  if (!match) {
    return { success: false };
  }

  const [, shortcut, value] = match;
  const filter = getFilterByShortcut(shortcut);

  if (!filter) {
    return { success: false };
  }

  // Handle multiselect content filters
  if (filter.type === 'multiselect') {
    return {
      success: true,
      filter: {
        type: 'content',
        filter,
        value: value.trim(),
        displayText: `${filter.label}: ${value.trim()}`,
      },
    };
  }

  // Handle search filters
  if (filter.type === 'search') {
    return {
      success: true,
      filter: {
        type: 'search',
        filter,
        value: value.trim(),
        displayText: `${filter.label}: "${value.trim()}"`,
      },
    };
  }

  // Handle select filters
  if (filter.type === 'select') {
    const option = filter.options?.find(
      (o) => o.value.toString().toLowerCase() === value.toLowerCase() ||
             o.label.toLowerCase() === value.toLowerCase()
    );

    if (option) {
      return {
        success: true,
        filter: {
          type: 'content',
          filter,
          value: option.value.toString(),
          displayText: `${filter.label}: ${option.label}`,
        },
      };
    }

    return {
      success: false,
      error: `Invalid ${filter.label} value: ${value}`,
      suggestions: filter.options?.map((o) => `${shortcut}:${o.value}`),
    };
  }

  return { success: false };
}

/**
 * Parse bare boolean shortcut: "free", "workshop", "ea"
 */
function parseBareBoolean(input: string): ParseResult {
  const filter = getFilterByShortcut(input);

  if (!filter) {
    return { success: false };
  }

  if (filter.type !== 'boolean') {
    return { success: false };
  }

  return {
    success: true,
    filter: {
      type: 'boolean',
      filter,
      value: true,
      displayText: filter.label,
    },
  };
}

// ============================================================================
// Display Formatting
// ============================================================================

/**
 * Format a range filter for display
 */
function formatRangeDisplay(
  filter: FilterDefinition,
  operator: Operator,
  value: number,
  maxValue?: number
): string {
  const unit = filter.unit || '';
  const formattedValue = formatNumber(value);

  if (operator === 'between' && maxValue !== undefined) {
    return `${filter.label}: ${formattedValue}${unit} - ${formatNumber(maxValue)}${unit}`;
  }

  const operatorSymbol = {
    '>': '>',
    '<': '<',
    '>=': '≥',
    '<=': '≤',
    '=': '=',
    'between': '',
  }[operator];

  return `${filter.label} ${operatorSymbol} ${formattedValue}${unit}`;
}

/**
 * Format a number for display (compact notation for large numbers)
 */
function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  }
  return value.toString();
}

// ============================================================================
// Suggestion Generation
// ============================================================================

/**
 * Find similar shortcuts using Levenshtein distance
 */
function findSimilarShortcuts(input: string, maxResults = 3): string[] {
  const shortcuts = FILTER_REGISTRY.map((f) => f.shortcut);
  const distances = shortcuts.map((s) => ({
    shortcut: s,
    distance: levenshteinDistance(input, s),
  }));

  return distances
    .filter((d) => d.distance <= 3)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxResults)
    .map((d) => d.shortcut);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Generate suggestions based on partial input
 */
function generateSuggestions(input: string): string[] {
  const suggestions: string[] = [];

  // Find filters that start with the input
  const startsWith = FILTER_REGISTRY.filter((f) =>
    f.shortcut.startsWith(input) || f.label.toLowerCase().startsWith(input)
  );

  for (const filter of startsWith.slice(0, 3)) {
    if (filter.type === 'range') {
      suggestions.push(`${filter.shortcut} > [value]`);
    } else if (filter.type === 'boolean') {
      suggestions.push(filter.shortcut);
    } else if (filter.type === 'select' && filter.options) {
      suggestions.push(`${filter.shortcut}:${filter.options[0].value}`);
    }
  }

  // Add similar shortcuts
  const similar = findSimilarShortcuts(input);
  for (const s of similar) {
    const filter = getFilterByShortcut(s);
    if (filter && !suggestions.some((sug) => sug.startsWith(s))) {
      if (filter.type === 'range') {
        suggestions.push(`${s} > [value]`);
      } else {
        suggestions.push(s);
      }
    }
  }

  return suggestions.slice(0, 5);
}

// ============================================================================
// URL Parameter Conversion
// ============================================================================

/**
 * Convert a parsed filter to URL parameters
 */
export function filterToUrlParams(filter: ParsedFilter): Record<string, string> {
  const params: Record<string, string> = {};

  switch (filter.type) {
    case 'range': {
      const def = filter.filter;
      if (filter.operator === 'between') {
        if (filter.minValue !== undefined && def.minUrlParam) {
          params[def.minUrlParam] = filter.minValue.toString();
        }
        if (filter.maxValue !== undefined && def.maxUrlParam) {
          params[def.maxUrlParam] = filter.maxValue.toString();
        }
      } else if (filter.operator === '>' || filter.operator === '>=') {
        if (def.minUrlParam) {
          params[def.minUrlParam] = filter.value.toString();
        }
      } else if (filter.operator === '<' || filter.operator === '<=') {
        if (def.maxUrlParam) {
          params[def.maxUrlParam] = filter.value.toString();
        }
      } else if (filter.operator === '=' && def.minUrlParam && def.maxUrlParam) {
        params[def.minUrlParam] = filter.value.toString();
        params[def.maxUrlParam] = filter.value.toString();
      }
      break;
    }

    case 'boolean': {
      params[filter.filter.id] = filter.value.toString();
      break;
    }

    case 'content':
    case 'search': {
      params[filter.filter.id] = filter.value;
      break;
    }
  }

  return params;
}

/**
 * Get all available filter shortcuts with their types
 */
export function getFilterShortcuts(): Array<{
  shortcut: string;
  label: string;
  type: string;
  example: string;
}> {
  return FILTER_REGISTRY.map((f) => {
    let example = '';
    if (f.type === 'range') {
      example = `${f.shortcut} > 1000`;
    } else if (f.type === 'boolean') {
      example = f.shortcut;
    } else if (f.type === 'select' && f.options) {
      example = `${f.shortcut}:${f.options[0].value}`;
    } else if (f.type === 'multiselect') {
      example = `${f.shortcut}:value`;
    } else if (f.type === 'search') {
      example = `${f.shortcut}:name`;
    }

    return {
      shortcut: f.shortcut,
      label: f.label,
      type: f.type,
      example,
    };
  });
}
