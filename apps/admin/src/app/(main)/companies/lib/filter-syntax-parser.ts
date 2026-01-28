/**
 * Filter Syntax Parser for Companies
 *
 * Parses user input into structured filter operations.
 * Supports:
 * - Range syntax: revenue > 1M, revenue 1M-10M, games > 10
 * - Boolean syntax: active, trending
 * - Content syntax: genre:indie, tag:roguelike
 */

import {
  type FilterDefinition,
  type Operator,
  getFilterByShortcut,
  FILTER_REGISTRY,
} from './filter-registry';
import {
  QUICK_FILTERS,
  PRESETS,
  type QuickFilter,
  type Preset,
} from './companies-presets';

// ============================================================================
// Types
// ============================================================================

export type ParsedFilterType = 'range' | 'boolean' | 'content' | 'search' | 'quick_filter' | 'preset';

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

export interface ParsedQuickFilter {
  type: 'quick_filter';
  quickFilter: QuickFilter;
  displayText: string;
}

export interface ParsedPreset {
  type: 'preset';
  preset: Preset;
  displayText: string;
}

export type ParsedFilter =
  | ParsedRangeFilter
  | ParsedBooleanFilter
  | ParsedContentFilter
  | ParsedSearchFilter
  | ParsedQuickFilter
  | ParsedPreset;

export interface ParseResult {
  success: boolean;
  filter?: ParsedFilter;
  error?: string;
  suggestions?: string[];
}

// ============================================================================
// Value Parsing Utilities
// ============================================================================

/**
 * Parse a value with K/M suffix into a number
 * For revenue, values are stored in cents, so $1M = 100,000,000 cents
 */
function parseValueWithSuffix(valueStr: string, isRevenue: boolean = false): number | null {
  const match = valueStr.match(/^(\d+(?:\.\d+)?)\s*(k|m)?$/i);
  if (!match) return null;

  let value = parseFloat(match[1]);
  const suffix = match[2]?.toLowerCase();

  if (suffix === 'k') {
    value *= 1_000;
  } else if (suffix === 'm') {
    value *= 1_000_000;
  }

  // Revenue is stored in cents, so multiply by 100
  if (isRevenue) {
    value *= 100;
  }

  return value;
}

// ============================================================================
// Parser Implementation
// ============================================================================

/**
 * Parse a filter syntax string into a structured filter
 *
 * Supported formats:
 * - Range: "revenue > 1M", "games >= 10", "ccu 1000-50000"
 * - Boolean: "active", "trending"
 * - Content: "genre:indie", "tag:roguelike"
 */
export function parseFilterSyntax(input: string): ParseResult {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    return { success: false, error: 'Empty input' };
  }

  // Try parsing in order of specificity

  // 1. Try range with hyphen syntax: "revenue 1M-10M"
  const rangeWithHyphen = parseRangeWithHyphen(trimmed);
  if (rangeWithHyphen.success) return rangeWithHyphen;

  // 2. Try range with operator: "revenue > 1M"
  const rangeWithOperator = parseRangeWithOperator(trimmed);
  if (rangeWithOperator.success) return rangeWithOperator;

  // 3. Try content filter: "genre:indie", "tag:roguelike"
  const contentFilter = parseContentFilter(trimmed);
  if (contentFilter.success) return contentFilter;

  // 4. Try quick filter by name: "active", "trending", "major"
  const quickFilter = parseQuickFilter(trimmed);
  if (quickFilter.success) return quickFilter;

  // 5. Try preset by name: "market leaders", "rising indies"
  const preset = parsePreset(trimmed);
  if (preset.success) return preset;

  // 6. Generate suggestions if no match
  return {
    success: false,
    error: 'Could not parse filter',
    suggestions: generateSuggestions(trimmed),
  };
}

/**
 * Parse range with hyphen syntax: "revenue 1M-10M"
 */
function parseRangeWithHyphen(input: string): ParseResult {
  // Match: shortcut value-value (with optional spaces, K/M suffixes)
  const match = input.match(/^(\w+)\s+(\d+(?:\.\d+)?[km]?)\s*-\s*(\d+(?:\.\d+)?[km]?)$/i);
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

  const isRevenue = filter.id === 'revenue';
  const minValue = parseValueWithSuffix(minStr, isRevenue);
  const maxValue = parseValueWithSuffix(maxStr, isRevenue);

  if (minValue === null || maxValue === null) {
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
 * Parse range with operator: "revenue > 1M", "games >= 10"
 */
function parseRangeWithOperator(input: string): ParseResult {
  // Match: shortcut operator value (with K/M suffix support)
  const match = input.match(/^(\w+)\s*(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?[km]?)$/i);
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
  const isRevenue = filter.id === 'revenue';
  const value = parseValueWithSuffix(valueStr, isRevenue);

  if (value === null) {
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
 * Parse content filter: "genre:indie", "tag:roguelike"
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
 * Normalize a string for matching: lowercase, remove spaces/underscores/hyphens
 */
function normalizeForMatch(str: string): string {
  return str.toLowerCase().replace(/[\s_-]+/g, '');
}

/**
 * Parse quick filter by name: "active", "trending", "major"
 */
function parseQuickFilter(input: string): ParseResult {
  const normalized = normalizeForMatch(input);

  const match = QUICK_FILTERS.find((qf) => {
    const normalizedId = normalizeForMatch(qf.id);
    const normalizedLabel = normalizeForMatch(qf.label);
    return normalizedId === normalized || normalizedLabel === normalized;
  });

  if (match) {
    return {
      success: true,
      filter: {
        type: 'quick_filter',
        quickFilter: match,
        displayText: match.label,
      },
    };
  }

  return { success: false };
}

/**
 * Parse preset by name: "market leaders", "rising indies"
 */
function parsePreset(input: string): ParseResult {
  const normalized = normalizeForMatch(input);

  const match = PRESETS.find((p) => {
    const normalizedId = normalizeForMatch(p.id);
    const normalizedLabel = normalizeForMatch(p.label);
    return normalizedId === normalized || normalizedLabel === normalized;
  });

  if (match) {
    return {
      success: true,
      filter: {
        type: 'preset',
        preset: match,
        displayText: match.label,
      },
    };
  }

  return { success: false };
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

  // For revenue, convert from cents to dollars for display
  const isRevenue = filter.id === 'revenue';
  const displayValue = isRevenue ? value / 100 : value;
  const displayMaxValue = maxValue !== undefined && isRevenue ? maxValue / 100 : maxValue;

  const formattedValue = formatNumber(displayValue, unit);

  if (operator === 'between' && displayMaxValue !== undefined) {
    return `${filter.label}: ${formattedValue} - ${formatNumber(displayMaxValue, unit)}`;
  }

  const operatorSymbol = {
    '>': '>',
    '<': '<',
    '>=': '>=',
    '<=': '<=',
    '=': '=',
    'between': '',
  }[operator];

  return `${filter.label} ${operatorSymbol} ${formattedValue}`;
}

/**
 * Format a number for display (compact notation for large numbers)
 */
function formatNumber(value: number, unit?: string): string {
  let formatted: string;

  if (value >= 1_000_000) {
    formatted = `${(value / 1_000_000).toFixed(1)}M`;
  } else if (value >= 1_000) {
    formatted = `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  } else {
    formatted = value.toString();
  }

  if (unit === '$') {
    return `$${formatted}`;
  }
  if (unit) {
    return `${formatted}${unit}`;
  }
  return formatted;
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
  const normalizedInput = normalizeForMatch(input);

  // Find quick filters that match the input
  const matchingQuickFilters = QUICK_FILTERS.filter((qf) => {
    const normalizedId = normalizeForMatch(qf.id);
    const normalizedLabel = normalizeForMatch(qf.label);
    return normalizedId.includes(normalizedInput) || normalizedLabel.includes(normalizedInput);
  });

  for (const qf of matchingQuickFilters.slice(0, 2)) {
    suggestions.push(qf.id);
  }

  // Find presets that match the input
  const matchingPresets = PRESETS.filter((p) => {
    const normalizedId = normalizeForMatch(p.id);
    const normalizedLabel = normalizeForMatch(p.label);
    return normalizedId.includes(normalizedInput) || normalizedLabel.includes(normalizedInput);
  });

  for (const p of matchingPresets.slice(0, 2)) {
    suggestions.push(p.id.replace(/_/g, ' '));
  }

  // Find filters that start with the input
  const startsWith = FILTER_REGISTRY.filter((f) =>
    f.shortcut.startsWith(input) || f.label.toLowerCase().startsWith(input)
  );

  for (const filter of startsWith.slice(0, 3)) {
    if (filter.type === 'range') {
      suggestions.push(`${filter.shortcut} > [value]`);
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

    case 'content': {
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
    } else if (f.type === 'select' && f.options) {
      example = `${f.shortcut}:${f.options[0].value}`;
    } else if (f.type === 'multiselect') {
      example = `${f.shortcut}:value`;
    }

    return {
      shortcut: f.shortcut,
      label: f.label,
      type: f.type,
      example,
    };
  });
}
