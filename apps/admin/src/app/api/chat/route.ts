import { NextRequest, NextResponse } from 'next/server';
import { createProvider } from '@/lib/llm/providers';
import { buildSystemPrompt } from '@/lib/llm/system-prompt';
import { TOOLS } from '@/lib/llm/tools';
import { executeQuery } from '@/lib/query-executor';
import { findSimilar, type FindSimilarArgs } from '@/lib/qdrant/search-service';
import type { Message, ChatRequest, ChatResponse, ChatToolCall, LLMResponse } from '@/lib/llm/types';

// Maximum tool call iterations to prevent infinite loops
const MAX_TOOL_ITERATIONS = 5;

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  try {
    const body = (await request.json()) as ChatRequest;

    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { response: '', error: 'Invalid request: messages array required' },
        { status: 400 }
      );
    }

    // Initialize LLM provider
    const provider = createProvider();

    // Build messages with system prompt
    const messages: Message[] = [{ role: 'system', content: buildSystemPrompt() }, ...body.messages];

    // Track tool calls for response
    const executedToolCalls: ChatToolCall[] = [];

    // Tool calling loop
    let iterations = 0;
    let response: LLMResponse | undefined;

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      // Call LLM
      response = await provider.chat(messages, TOOLS);

      // If no tool calls, we're done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        break;
      }

      // Process each tool call
      for (const toolCall of response.toolCalls) {
        if (toolCall.name === 'query_database') {
          const args = toolCall.arguments as { sql: string; reasoning: string };

          // Execute the query
          const queryResult = await executeQuery(args.sql);

          // Track the tool call
          executedToolCalls.push({
            name: toolCall.name,
            arguments: args,
            result: queryResult,
          });

          // Add assistant message with tool calls
          messages.push({
            role: 'assistant',
            content: response.content || '',
            toolCalls: [toolCall],
          });

          // Add tool result message
          messages.push({
            role: 'tool',
            toolCallId: toolCall.id,
            content: JSON.stringify(queryResult),
          });
        } else if (toolCall.name === 'find_similar') {
          const args = toolCall.arguments as unknown as FindSimilarArgs;

          // Execute the similarity search
          const similarityResult = await findSimilar(args);

          // Track the tool call
          executedToolCalls.push({
            name: toolCall.name,
            arguments: args as unknown as Record<string, unknown>,
            result: similarityResult,
          });

          // Add assistant message with tool calls
          messages.push({
            role: 'assistant',
            content: response.content || '',
            toolCalls: [toolCall],
          });

          // Add tool result message
          messages.push({
            role: 'tool',
            toolCallId: toolCall.id,
            content: JSON.stringify(similarityResult),
          });
        } else {
          // Unknown tool - add error result
          messages.push({
            role: 'assistant',
            content: response.content || '',
            toolCalls: [toolCall],
          });
          messages.push({
            role: 'tool',
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: `Unknown tool: ${toolCall.name}` }),
          });
        }
      }
    }

    // Return the final response
    return NextResponse.json({
      response: response?.content || 'I was unable to generate a response.',
      toolCalls: executedToolCalls.length > 0 ? executedToolCalls : undefined,
    });
  } catch (error) {
    console.error('Chat API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    // Check for specific error types
    if (errorMessage.includes('API key')) {
      return NextResponse.json(
        { response: '', error: 'LLM API not configured. Please set the OPENAI_API_KEY.' },
        { status: 503 }
      );
    }

    return NextResponse.json({ response: '', error: errorMessage }, { status: 500 });
  }
}
