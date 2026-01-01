import { NextRequest, NextResponse } from 'next/server';
import { createProvider } from '@/lib/llm/providers';
import { buildSystemPrompt } from '@/lib/llm/system-prompt';
import { buildCubeSystemPrompt } from '@/lib/llm/cube-system-prompt';
import { TOOLS } from '@/lib/llm/tools';
import { CUBE_TOOLS } from '@/lib/llm/cube-tools';
import { executeQuery } from '@/lib/query-executor';
import { executeCubeQuery } from '@/lib/cube-executor';
import { findSimilar, type FindSimilarArgs } from '@/lib/qdrant/search-service';
import type { Message, ChatRequest, ChatResponse, ChatToolCall, ChatTiming, LLMResponse, Tool, QueryResult, SimilarityResult } from '@/lib/llm/types';

// Set to true to use Cube.dev semantic layer, false for legacy SQL
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

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  const requestStart = performance.now();

  try {
    const body = (await request.json()) as ChatRequest;

    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { response: '', error: 'Invalid request: messages array required' },
        { status: 400 }
      );
    }

    const provider = createProvider();

    // Choose system prompt and tools based on mode
    const systemPrompt = USE_CUBE ? buildCubeSystemPrompt() : buildSystemPrompt();
    const tools: Tool[] = USE_CUBE ? CUBE_TOOLS : TOOLS;

    const messages: Message[] = [{ role: 'system', content: systemPrompt }, ...body.messages];
    const executedToolCalls: ChatToolCall[] = [];

    let iterations = 0;
    let response: LLMResponse | undefined;
    let totalLlmMs = 0;
    let totalToolsMs = 0;

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      // Time the LLM call
      const llmStart = performance.now();
      response = await provider.chat(messages, tools);
      totalLlmMs += performance.now() - llmStart;

      if (!response.toolCalls || response.toolCalls.length === 0) {
        break;
      }

      for (const toolCall of response.toolCalls) {
        let result: QueryResult | SimilarityResult;

        // Time each tool execution
        const toolStart = performance.now();

        if (toolCall.name === 'query_database') {
          // Legacy SQL mode
          const args = toolCall.arguments as { sql: string; reasoning: string };
          result = await executeQuery(args.sql);
        } else if (toolCall.name === 'query_analytics') {
          // Cube.dev mode
          const args = toolCall.arguments as unknown as QueryAnalyticsArgs;
          result = await executeCubeQuery({
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
          result = await findSimilar(args);
        } else {
          result = { success: false, error: `Unknown tool: ${toolCall.name}` };
        }

        const toolExecutionMs = performance.now() - toolStart;
        totalToolsMs += toolExecutionMs;

        executedToolCalls.push({
          name: toolCall.name,
          arguments: toolCall.arguments as Record<string, unknown>,
          result,
          timing: {
            executionMs: Math.round(toolExecutionMs),
          },
        });

        messages.push({
          role: 'assistant',
          content: response.content || '',
          toolCalls: [toolCall],
        });

        messages.push({
          role: 'tool',
          toolCallId: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    const timing: ChatTiming = {
      llmMs: Math.round(totalLlmMs),
      toolsMs: Math.round(totalToolsMs),
      totalMs: Math.round(performance.now() - requestStart),
    };

    return NextResponse.json({
      response: response?.content || 'I was unable to generate a response.',
      toolCalls: executedToolCalls.length > 0 ? executedToolCalls : undefined,
      timing,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    if (errorMessage.includes('API key')) {
      return NextResponse.json(
        { response: '', error: 'LLM API not configured.' },
        { status: 503 }
      );
    }

    return NextResponse.json({ response: '', error: errorMessage }, { status: 500 });
  }
}
