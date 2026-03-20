import type { ToolCall, ToolSufficiencyMetadata } from '@/lib/llm/types';
import { isCompanyCube } from '@/lib/chat/company-query-guardrails';

type Primitive = string | number | boolean;

interface QueryAnalyticsArgs {
  cube: string;
  dimensions?: string[];
  measures?: string[];
  filters?: Array<{ member: string; operator: string; values?: Primitive[] }>;
  segments?: string[];
  order?: Record<string, 'asc' | 'desc'>;
  limit?: number;
  reasoning?: string;
}

export type CompanyIntentFamily =
  | 'company_count_profile'
  | 'portfolio_top_titles'
  | 'time_window_ranking'
  | 'constrained_company_screen'
  | 'relationship_screen'
  | 'company_similarity';

export interface CompanyAnswerState {
  family: CompanyIntentFamily;
  blockFurtherTools: boolean;
  reason: string;
}

const MULTI_SLICE_MARKERS = [
  /\balso\b/i,
  /\bplus\b/i,
  /\bas well\b/i,
  /\balong with\b/i,
  /\bin addition\b/i,
  /\bboth\b/i,
  /\bcompare\b/i,
  /\bversus\b/i,
  /\bvs\.?\b/i,
];

function normalizePrompt(prompt: string): string {
  return prompt.toLowerCase().trim();
}

function inferCompanyEntityType(
  prompt: string,
  args?: QueryAnalyticsArgs
): 'publisher' | 'developer' | null {
  const text = normalizePrompt(prompt);

  if (/\bpublisher(s)?\b/.test(text)) return 'publisher';
  if (/\bdeveloper(s)?\b/.test(text)) return 'developer';

  switch (args?.cube) {
    case 'PublisherMetrics':
    case 'PublisherYearMetrics':
    case 'PublisherGameMetrics':
    case 'PublisherRelationshipMetrics':
      return 'publisher';
    case 'DeveloperMetrics':
    case 'DeveloperYearMetrics':
    case 'DeveloperGameMetrics':
    case 'DeveloperRelationshipMetrics':
      return 'developer';
    default:
      return null;
  }
}

function extractPercentThreshold(prompt: string): number | null {
  const match = normalizePrompt(prompt).match(/(\d{2,3})\s*%/);
  if (!match) return null;

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function extractGameCountThreshold(prompt: string): number | null {
  const match = normalizePrompt(prompt).match(/(\d+)\s*\+\s*games?/);
  if (!match) return null;

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function extractYear(prompt: string): number | null {
  const match = normalizePrompt(prompt).match(/\b(20\d{2})\b/);
  if (!match) return null;

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function detectTimeWindow(
  prompt: string
): { type: 'year'; year: number } | { type: 'segment'; segment: 'lastYear' | 'last6Months' | 'last3Months' | 'last30Days' } | null {
  const text = normalizePrompt(prompt);
  const year = extractYear(text);
  const currentYear = new Date().getFullYear();

  if (/\bthis year\b/.test(text)) {
    return { type: 'year', year: currentYear };
  }

  if (/\blast year\b/.test(text)) {
    return { type: 'year', year: currentYear - 1 };
  }

  if (/\bpast 6 months\b|\blast 6 months\b/.test(text)) {
    return { type: 'segment', segment: 'last6Months' };
  }

  if (/\bpast 3 months\b|\blast 3 months\b/.test(text)) {
    return { type: 'segment', segment: 'last3Months' };
  }

  if (/\bpast 30 days\b|\blast 30 days\b|\bpast month\b|\blast month\b/.test(text)) {
    return { type: 'segment', segment: 'last30Days' };
  }

  if (/\bpast year\b|\bpast 12 months\b|\bwithin the past year\b/.test(text)) {
    return { type: 'segment', segment: 'lastYear' };
  }

  if (year !== null && /\breleased\b|\breleases\b/.test(text)) {
    return { type: 'year', year };
  }

  return null;
}

export function classifyCompanyIntent(prompt: string): CompanyIntentFamily | null {
  const text = normalizePrompt(prompt);

  if (
    /\bhow many games has\b/.test(text) &&
    /\b(published|developed|released|made)\b/.test(text)
  ) {
    return 'company_count_profile';
  }

  if (
    (/\btop games?\b/.test(text) || /\bbest games?\b/.test(text)) &&
    /\b(from|by)\b/.test(text)
  ) {
    return 'portfolio_top_titles';
  }

  if (
    /\b(indie|self[- ]published|external devs|multi[- ]publisher)\b/.test(text)
  ) {
    return 'relationship_screen';
  }

  if (
    /\b(similar to|like)\b/.test(text) &&
    /\b(publisher|publishers|developer|developers|studio|studios|company|companies)\b/.test(text)
  ) {
    return 'company_similarity';
  }

  if (
    /\b(publisher|publishers|developer|developers)\b/.test(text) &&
    /\b(most games|releasing the most|released the most)\b/.test(text) &&
    detectTimeWindow(text)
  ) {
    return 'time_window_ranking';
  }

  if (
    /\b(publisher|publishers|developer|developers)\b/.test(text) &&
    /\bwith\b/.test(text) &&
    /\b\d+\s*\+\s*games?\b/.test(text)
  ) {
    return 'constrained_company_screen';
  }

  return null;
}

function buildCompanyIdNameDimensions(
  entityType: 'publisher' | 'developer',
  cube: string
): string[] {
  return entityType === 'publisher'
    ? [`${cube}.publisherId`, `${cube}.publisherName`]
    : [`${cube}.developerId`, `${cube}.developerName`];
}

function normalizeReasoning(family: CompanyIntentFamily, prompt: string): string {
  switch (family) {
    case 'relationship_screen':
      return `Use the relationship metrics surface to answer the company relationship screen: ${prompt}`;
    case 'time_window_ranking':
      return `Use a company ranking query grouped by company for the requested time window: ${prompt}`;
    case 'constrained_company_screen':
      return `Use a grouped company screen that enforces the user's review and release constraints: ${prompt}`;
    default:
      return prompt;
  }
}

function rewriteRelationshipScreen(
  prompt: string,
  args: QueryAnalyticsArgs
): QueryAnalyticsArgs | null {
  const text = normalizePrompt(prompt);
  if (!/\bindie\b/.test(text)) {
    return null;
  }

  const entityType = inferCompanyEntityType(prompt, args);
  if (!entityType) {
    return null;
  }

  const cube = entityType === 'publisher' ? 'PublisherRelationshipMetrics' : 'DeveloperRelationshipMetrics';
  const idNameDimensions = buildCompanyIdNameDimensions(entityType, cube);
  const dimensions = [
    ...idNameDimensions,
    `${cube}.gameCount`,
    `${cube}.hitGameCount`,
    `${cube}.totalReviews`,
    `${cube}.avgReviewPercentage`,
  ];

  return {
    cube,
    dimensions,
    filters: [
      { member: `${cube}.isSelfPublished`, operator: 'equals', values: [true] },
      { member: `${cube}.gameCount`, operator: 'lt', values: [5] },
      { member: `${cube}.hitGameCount`, operator: 'gte', values: [2] },
    ],
    order: { [`${cube}.hitGameCount`]: 'desc' },
    limit: Math.min(args.limit ?? 10, 20),
    reasoning: normalizeReasoning('relationship_screen', prompt),
  };
}

function rewriteTimeWindowRanking(
  prompt: string,
  args: QueryAnalyticsArgs
): QueryAnalyticsArgs | null {
  const entityType = inferCompanyEntityType(prompt, args);
  const timeWindow = detectTimeWindow(prompt);

  if (!entityType || !timeWindow) {
    return null;
  }

  if (timeWindow.type === 'year') {
    const cube = entityType === 'publisher' ? 'PublisherYearMetrics' : 'DeveloperYearMetrics';
    const idNameDimensions = buildCompanyIdNameDimensions(entityType, cube);

    return {
      cube,
      dimensions: [
        ...idNameDimensions,
        `${cube}.gameCount`,
        `${cube}.totalReviews`,
        `${cube}.avgReviewScore`,
      ],
      filters: [
        { member: `${cube}.releaseYear`, operator: 'equals', values: [timeWindow.year] },
      ],
      order: { [`${cube}.gameCount`]: 'desc' },
      limit: Math.min(args.limit ?? 10, 20),
      reasoning: normalizeReasoning('time_window_ranking', prompt),
    };
  }

  const cube = entityType === 'publisher' ? 'PublisherGameMetrics' : 'DeveloperGameMetrics';
  const idNameDimensions = buildCompanyIdNameDimensions(entityType, cube);

  return {
    cube,
    dimensions: idNameDimensions,
    measures: [
      `${cube}.gameCount`,
      `${cube}.sumReviews`,
      `${cube}.avgReviewScore`,
    ],
    segments: [`${cube}.${timeWindow.segment}`],
    order: { [`${cube}.gameCount`]: 'desc' },
    limit: Math.min(args.limit ?? 10, 20),
    reasoning: normalizeReasoning('time_window_ranking', prompt),
  };
}

function rewriteConstrainedCompanyScreen(
  prompt: string,
  args: QueryAnalyticsArgs
): QueryAnalyticsArgs | null {
  const entityType = inferCompanyEntityType(prompt, args);
  const timeWindow = detectTimeWindow(prompt);
  const minGames = extractGameCountThreshold(prompt);
  const reviewPercentage = extractPercentThreshold(prompt);

  if (!entityType || !timeWindow || minGames === null || reviewPercentage === null) {
    return null;
  }

  const cube = entityType === 'publisher' ? 'PublisherGameMetrics' : 'DeveloperGameMetrics';
  const idNameDimensions = buildCompanyIdNameDimensions(entityType, cube);
  const filters: QueryAnalyticsArgs['filters'] = [
    { member: `${cube}.reviewPercentage`, operator: 'gte', values: [reviewPercentage] },
    { member: `${cube}.gameCount`, operator: 'gte', values: [minGames] },
  ];

  if (timeWindow.type === 'year') {
    filters.push({
      member: `${cube}.releaseYear`,
      operator: 'equals',
      values: [timeWindow.year],
    });
  }

  return {
    cube,
    dimensions: idNameDimensions,
    measures: [
      `${cube}.gameCount`,
      `${cube}.sumReviews`,
      `${cube}.avgReviewScore`,
    ],
    filters,
    segments: timeWindow.type === 'segment' ? [`${cube}.${timeWindow.segment}`] : undefined,
    order: { [`${cube}.gameCount`]: 'desc' },
    limit: Math.min(args.limit ?? 50, 50),
    reasoning: normalizeReasoning('constrained_company_screen', prompt),
  };
}

export function normalizeCompanyToolCall(toolCall: ToolCall, userPrompt: string): ToolCall {
  if (toolCall.name !== 'query_analytics') {
    return toolCall;
  }

  const family = classifyCompanyIntent(userPrompt);
  if (!family) {
    return toolCall;
  }

  const args = toolCall.arguments as unknown as QueryAnalyticsArgs;

  let rewritten: QueryAnalyticsArgs | null = null;

  if (family === 'relationship_screen') {
    rewritten = rewriteRelationshipScreen(userPrompt, args);
  } else if (family === 'time_window_ranking') {
    rewritten = rewriteTimeWindowRanking(userPrompt, args);
  } else if (family === 'constrained_company_screen') {
    rewritten = rewriteConstrainedCompanyScreen(userPrompt, args);
  }

  if (!rewritten) {
    return toolCall;
  }

  return {
    ...toolCall,
    arguments: rewritten as unknown as Record<string, unknown>,
  };
}

function isCompanyTopTitlesQuery(toolCall: ToolCall): boolean {
  if (toolCall.name !== 'query_analytics') {
    return false;
  }

  const args = toolCall.arguments as unknown as QueryAnalyticsArgs;
  if (!['PublisherGameMetrics', 'DeveloperGameMetrics'].includes(args.cube)) {
    return false;
  }

  const dimensions = new Set(args.dimensions ?? []);
  return dimensions.has(`${args.cube}.gameName`) || dimensions.has(`${args.cube}.appid`);
}

function filterLowSignalTopTitles<T extends Record<string, unknown>>(result: T): T {
  const data = Array.isArray(result.data) ? result.data : [];
  if (data.length === 0) {
    return result;
  }

  const meaningfulRows = data.filter((row) => Number(row.totalReviews ?? 0) >= 100);
  const fallbackRows = meaningfulRows.length > 0
    ? meaningfulRows
    : data.filter((row) => Number(row.totalReviews ?? 0) > 0);

  const trimmedRows = (fallbackRows.length > 0 ? fallbackRows : data).slice(0, 8);
  const sparseTail = trimmedRows.length < 5;

  return {
    ...result,
    data: trimmedRows,
    rowCount: trimmedRows.length,
    sufficient_to_answer: true,
    sufficiency_reason: sparseTail
      ? 'Returned the strongest available company titles after filtering low-signal tail rows. Respond directly and say the qualifying set is sparse if helpful.'
      : 'Returned the strongest available company titles after filtering low-signal tail rows. Respond directly from these rows.',
  } as T;
}

export function applyCompanyToolResultPolicy<T extends { success: boolean; error?: string } & Record<string, unknown>>(
  userPrompt: string,
  toolCall: ToolCall,
  result: T
): T {
  const family = classifyCompanyIntent(userPrompt);
  if (!family) {
    return result;
  }

  if (
    family === 'portfolio_top_titles' &&
    result.success === true &&
    isCompanyTopTitlesQuery(toolCall)
  ) {
    return filterLowSignalTopTitles(result);
  }

  return result;
}

export function extractCompanyAnswerState(
  userPrompt: string,
  toolCall: ToolCall,
  result: Record<string, unknown>
): CompanyAnswerState | null {
  const family = classifyCompanyIntent(userPrompt);
  if (!family) {
    return null;
  }

  if (
    (toolCall.name === 'lookup_publishers' || toolCall.name === 'lookup_developers') &&
    (result.needsDisambiguation === true || (result.success === false && typeof result.error === 'string'))
  ) {
    return {
      family,
      blockFurtherTools: true,
      reason: typeof result.error === 'string'
        ? result.error
        : 'The company lookup needs user clarification before any other tool call.',
    };
  }

  if (toolCall.name === 'query_analytics') {
    const args = toolCall.arguments as unknown as QueryAnalyticsArgs;
    if (
      isCompanyCube(args.cube) &&
      result.success === true &&
      result.sufficient_to_answer === true &&
      Number(result.rowCount ?? 0) === 0
    ) {
      return {
        family,
        blockFurtherTools: true,
        reason: typeof result.sufficiency_reason === 'string'
          ? result.sufficiency_reason
          : 'The constrained company screen returned no qualifying rows. Respond directly instead of broadening the query.',
      };
    }
  }

  return null;
}

function hasExplicitMultiSliceIntent(userPrompt: string): boolean {
  return MULTI_SLICE_MARKERS.some((pattern) => pattern.test(userPrompt));
}

export function buildRedundantCompanySkipResult(
  previousState: CompanyAnswerState | null,
  toolCall: ToolCall,
  userPrompt: string
): ({ success: true; skipped_redundant_company_query: true; debug: Record<string, unknown> } & ToolSufficiencyMetadata & Record<string, unknown>) | null {
  if (!previousState?.blockFurtherTools) {
    return null;
  }

  if (hasExplicitMultiSliceIntent(userPrompt)) {
    return null;
  }

  return {
    success: true,
    skipped_redundant_company_query: true,
    sufficient_to_answer: true,
    sufficiency_reason: previousState.reason,
    debug: {
      redundantCompanyQueryBlocked: true,
      redundantCompanyBlockReason: `Blocked ${toolCall.name} after a sufficient company result that should end the tool loop.`,
      companyIntentFamily: previousState.family,
    },
  };
}
