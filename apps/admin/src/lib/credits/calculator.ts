/**
 * Credit calculation utilities for chat usage billing.
 * All costs are in credits.
 */

// Tool credit costs (per call)
export const TOOL_COSTS: Record<string, number> = {
  lookup_publishers: 4,
  lookup_developers: 4,
  lookup_tags: 4,
  query_analytics: 8,
  search_games: 8,
  find_similar: 12,
} as const;

// LLM token costs (per 1,000 tokens)
export const TOKEN_COSTS = {
  input: 2,   // 2 credits per 1k input tokens
  output: 8,  // 8 credits per 1k output tokens
} as const;

// Minimum charge per chat message
export const MINIMUM_CHARGE = 4;

// Default reservation amount (to reserve upfront)
// This should cover most typical queries
export const DEFAULT_RESERVATION = 25;

// Maximum reservation (cap to prevent excessive holds)
export const MAX_RESERVATION = 100;

/**
 * Calculate credits for tool usage.
 * @param toolNames - Array of tool names used in the chat
 * @returns Total tool credits
 */
export function calculateToolCredits(toolNames: string[]): number {
  return toolNames.reduce((total, toolName) => {
    const cost = TOOL_COSTS[toolName] ?? 0;
    return total + cost;
  }, 0);
}

/**
 * Calculate credits for LLM token usage.
 * Rounds up to nearest whole credit.
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Total token credits
 */
export function calculateTokenCredits(
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = Math.ceil((inputTokens / 1000) * TOKEN_COSTS.input);
  const outputCost = Math.ceil((outputTokens / 1000) * TOKEN_COSTS.output);
  return inputCost + outputCost;
}

/**
 * Calculate total credits for a chat message.
 * Applies minimum charge.
 * @param toolNames - Array of tool names used
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Total credits to charge (minimum of MINIMUM_CHARGE)
 */
export function calculateTotalCredits(
  toolNames: string[],
  inputTokens: number,
  outputTokens: number
): number {
  const toolCredits = calculateToolCredits(toolNames);
  const tokenCredits = calculateTokenCredits(inputTokens, outputTokens);
  const total = toolCredits + tokenCredits;

  // Apply minimum charge
  return Math.max(total, MINIMUM_CHARGE);
}

/**
 * Estimate reservation amount based on expected usage.
 * This is called before processing to reserve credits upfront.
 * @param expectedIterations - Expected number of LLM iterations (default 2)
 * @param expectedTools - Expected number of tool calls (default 2)
 * @returns Credits to reserve
 */
export function estimateReservation(
  expectedIterations: number = 2,
  expectedTools: number = 2
): number {
  // Estimate based on:
  // - Average tool cost of 6 credits each
  // - Average of 500 input tokens + 300 output tokens per iteration
  const estimatedToolCredits = expectedTools * 6;
  const estimatedTokenCredits = expectedIterations * (
    Math.ceil((500 / 1000) * TOKEN_COSTS.input) +
    Math.ceil((300 / 1000) * TOKEN_COSTS.output)
  );

  const estimate = estimatedToolCredits + estimatedTokenCredits;

  // Clamp between minimum and maximum
  return Math.min(Math.max(estimate, MINIMUM_CHARGE), MAX_RESERVATION);
}

/**
 * Check if user has enough credits for chat.
 * @param balance - User's current credit balance
 * @returns Whether user can use chat
 */
export function hasMinimumCredits(balance: number): boolean {
  return balance >= MINIMUM_CHARGE;
}

/**
 * Get detailed credit breakdown for a chat message.
 * Useful for logging and display.
 */
export interface CreditBreakdown {
  toolCredits: number;
  inputTokenCredits: number;
  outputTokenCredits: number;
  totalBeforeMinimum: number;
  total: number;
  minimumApplied: boolean;
}

export function getCreditBreakdown(
  toolNames: string[],
  inputTokens: number,
  outputTokens: number
): CreditBreakdown {
  const toolCredits = calculateToolCredits(toolNames);
  const inputTokenCredits = Math.ceil((inputTokens / 1000) * TOKEN_COSTS.input);
  const outputTokenCredits = Math.ceil((outputTokens / 1000) * TOKEN_COSTS.output);
  const totalBeforeMinimum = toolCredits + inputTokenCredits + outputTokenCredits;
  const total = Math.max(totalBeforeMinimum, MINIMUM_CHARGE);

  return {
    toolCredits,
    inputTokenCredits,
    outputTokenCredits,
    totalBeforeMinimum,
    total,
    minimumApplied: totalBeforeMinimum < MINIMUM_CHARGE,
  };
}
