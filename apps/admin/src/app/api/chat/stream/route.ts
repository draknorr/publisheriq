import { NextRequest } from 'next/server';
import { createProvider } from '@/lib/llm/providers';
import { buildSystemPrompt } from '@/lib/llm/system-prompt';
import { buildCubeSystemPrompt } from '@/lib/llm/cube-system-prompt';
import { TOOLS } from '@/lib/llm/tools';
import { CUBE_TOOLS } from '@/lib/llm/cube-tools';
import { executeQuery } from '@/lib/query-executor';
import { executeCubeQuery } from '@/lib/cube-executor';
import { findSimilar, type FindSimilarArgs } from '@/lib/qdrant/search-service';
import { searchGames, type SearchGamesArgs } from '@/lib/search/game-search';
import { lookupTags, type LookupTagsArgs } from '@/lib/search/tag-lookup';
import {
  lookupPublishers,
  lookupDevelopers,
  type LookupPublishersArgs,
  type LookupDevelopersArgs,
} from '@/lib/search/publisher-lookup';
import { formatResultWithEntityLinks } from '@/lib/llm/format-entity-links';
import type { Message, ChatRequest, Tool, QueryResult, SimilarityResult, ToolCall } from '@/lib/llm/types';
import type { StreamEvent, TextDeltaEvent, ToolStartEvent, ToolResultEvent, MessageEndEvent, ErrorEvent, StreamDebugInfo } from '@/lib/llm/streaming-types';

const USE_CUBE = process.env.USE_CUBE_CHAT === 'true';
const MAX_TOOL_ITERATIONS = 5;

interface QueryAnalyticsArgs {
  cube: string;
  dimensions?: string[];
  measures?: string[];
  filters?: Array<{ member: string; operator: string; values?: (string | number | boolean)[] }>;
  segments?: string[];
  order?: Record<string, 'asc' | 'desc'>;
  limit?: number;
  reasoning: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(toolCall: ToolCall): Promise<{ success: boolean; error?: string; [key: string]: any }> {
  if (toolCall.name === 'query_database') {
    const args = toolCall.arguments as { sql: string; reasoning: string };
    return executeQuery(args.sql);
  } else if (toolCall.name === 'query_analytics') {
    const args = toolCall.arguments as unknown as QueryAnalyticsArgs;
    return executeCubeQuery({
      cube: args.cube,
      dimensions: args.dimensions,
      measures: args.measures,
      filters: args.filters,
      segments: args.segments,
      order: args.order,
      limit: args.limit,
    });
  } else if (toolCall.name === 'find_similar') {
    const args = toolCall.arguments as unknown as FindSimilarArgs;
    return findSimilar(args);
  } else if (toolCall.name === 'search_games') {
    const args = toolCall.arguments as unknown as SearchGamesArgs;
    return searchGames(args);
  } else if (toolCall.name === 'lookup_tags') {
    const args = toolCall.arguments as unknown as LookupTagsArgs;
    return lookupTags(args);
  } else if (toolCall.name === 'lookup_publishers') {
    const args = toolCall.arguments as unknown as LookupPublishersArgs;
    return lookupPublishers(args);
  } else if (toolCall.name === 'lookup_developers') {
    const args = toolCall.arguments as unknown as LookupDevelopersArgs;
    return lookupDevelopers(args);
  }
  return { success: false, error: `Unknown tool: ${toolCall.name}` };
}

function formatSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestStart = performance.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = (await request.json()) as ChatRequest;

        if (!body.messages || !Array.isArray(body.messages)) {
          const errorEvent: ErrorEvent = { type: 'error', message: 'Invalid request: messages array required' };
          controller.enqueue(encoder.encode(formatSSE(errorEvent)));
          controller.close();
          return;
        }

        const provider = createProvider();

        // Check if provider supports streaming
        if (!provider.chatStream) {
          const errorEvent: ErrorEvent = { type: 'error', message: 'Provider does not support streaming' };
          controller.enqueue(encoder.encode(formatSSE(errorEvent)));
          controller.close();
          return;
        }

        const systemPrompt = USE_CUBE ? buildCubeSystemPrompt() : buildSystemPrompt();
        const tools: Tool[] = USE_CUBE ? CUBE_TOOLS : TOOLS;

        const messages: Message[] = [{ role: 'system', content: systemPrompt }, ...body.messages];

        let iterations = 0;
        let totalLlmMs = 0;
        let totalToolsMs = 0;

        // Debug stats - zero additional cost, just counters
        const debugStats: StreamDebugInfo = {
          iterations: 0,
          textDeltaCount: 0,
          totalChars: 0,
          toolCallCount: 0,
          lastIterationHadText: false,
        };

        while (iterations < MAX_TOOL_ITERATIONS) {
          iterations++;
          debugStats.iterations = iterations;
          let iterationTextCount = 0;

          const llmStart = performance.now();
          const llmStream = provider.chatStream(messages, tools);

          let accumulatedText = '';
          const completedToolCalls: ToolCall[] = [];

          // Stream through the LLM response
          for await (const chunk of llmStream) {
            if (chunk.type === 'text' && chunk.text) {
              accumulatedText += chunk.text;
              debugStats.textDeltaCount++;
              debugStats.totalChars += chunk.text.length;
              iterationTextCount++;
              const textEvent: TextDeltaEvent = { type: 'text_delta', delta: chunk.text };
              controller.enqueue(encoder.encode(formatSSE(textEvent)));
            }

            if (chunk.type === 'tool_use_start' && chunk.toolCall) {
              const toolStartEvent: ToolStartEvent = {
                type: 'tool_start',
                toolCallId: chunk.toolCall.id,
                name: chunk.toolCall.name,
                arguments: chunk.toolCall.arguments,
              };
              controller.enqueue(encoder.encode(formatSSE(toolStartEvent)));
            }

            if (chunk.type === 'tool_use_end' && chunk.toolCall) {
              completedToolCalls.push({
                id: chunk.toolCall.id,
                name: chunk.toolCall.name,
                arguments: chunk.toolCall.arguments,
              });
            }
          }

          totalLlmMs += performance.now() - llmStart;
          debugStats.lastIterationHadText = iterationTextCount > 0;
          debugStats.toolCallCount += completedToolCalls.length;

          // If no tool calls, we're done
          if (completedToolCalls.length === 0) {
            break;
          }

          // Execute all tool calls and collect results
          const toolResults: Array<{ toolCall: ToolCall; result: QueryResult | SimilarityResult }> = [];
          for (const toolCall of completedToolCalls) {
            const toolStart = performance.now();
            const result = await executeTool(toolCall);
            const toolExecutionMs = performance.now() - toolStart;
            totalToolsMs += toolExecutionMs;

            const toolResultEvent: ToolResultEvent = {
              type: 'tool_result',
              toolCallId: toolCall.id,
              name: toolCall.name,
              arguments: toolCall.arguments,
              result,
              timing: { executionMs: Math.round(toolExecutionMs) },
            };
            controller.enqueue(encoder.encode(formatSSE(toolResultEvent)));

            toolResults.push({ toolCall, result });
          }

          // Add assistant message ONCE with ALL tool calls
          messages.push({
            role: 'assistant',
            content: accumulatedText,
            toolCalls: completedToolCalls,
          });

          // Add each tool result to message history (pre-formatted with entity links)
          for (const { toolCall, result } of toolResults) {
            messages.push({
              role: 'tool',
              toolCallId: toolCall.id,
              content: formatResultWithEntityLinks(result),
            });
          }

          // Reset accumulated text for next iteration
          accumulatedText = '';
        }

        // If we hit max iterations with no text response, send a fallback message
        if (debugStats.totalChars === 0 && debugStats.toolCallCount > 0) {
          const fallbackText = `I executed ${debugStats.toolCallCount} tool calls but wasn't able to generate a response. This may be due to hitting the maximum iteration limit (${MAX_TOOL_ITERATIONS}). Please try rephrasing your question or being more specific.`;
          const fallbackEvent: TextDeltaEvent = { type: 'text_delta', delta: fallbackText };
          controller.enqueue(encoder.encode(formatSSE(fallbackEvent)));
          debugStats.textDeltaCount = 1;
          debugStats.totalChars = fallbackText.length;
        }

        // Send completion event with debug info
        const endEvent: MessageEndEvent = {
          type: 'message_end',
          timing: {
            llmMs: Math.round(totalLlmMs),
            toolsMs: Math.round(totalToolsMs),
            totalMs: Math.round(performance.now() - requestStart),
          },
          debug: debugStats,
        };
        controller.enqueue(encoder.encode(formatSSE(endEvent)));

      } catch (error) {
        console.error('Streaming chat error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        const errorEvent: ErrorEvent = { type: 'error', message: errorMessage };
        controller.enqueue(encoder.encode(formatSSE(errorEvent)));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
