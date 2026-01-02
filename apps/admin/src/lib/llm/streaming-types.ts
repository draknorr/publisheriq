import type { ChatTiming, QueryResult, SimilarityResult } from './types';

// Streaming event types for Server-Sent Events format
export type StreamEventType =
  | 'text_delta'      // Incremental text chunk
  | 'tool_start'      // Tool call initiated
  | 'tool_result'     // Tool execution completed
  | 'message_end'     // Response complete
  | 'error';          // Error occurred

export interface BaseStreamEvent {
  type: StreamEventType;
}

export interface TextDeltaEvent extends BaseStreamEvent {
  type: 'text_delta';
  delta: string;
}

export interface ToolStartEvent extends BaseStreamEvent {
  type: 'tool_start';
  toolCallId: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResultEvent extends BaseStreamEvent {
  type: 'tool_result';
  toolCallId: string;
  name: string;
  arguments: Record<string, unknown>;
  result: QueryResult | SimilarityResult;
  timing: { executionMs: number };
}

export interface StreamDebugInfo {
  iterations: number;          // How many LLM calls happened
  textDeltaCount: number;      // Number of text_delta events received
  totalChars: number;          // Total characters streamed
  toolCallCount: number;       // Number of tool calls made
  lastIterationHadText: boolean; // Whether the final iteration produced text
}

export interface MessageEndEvent extends BaseStreamEvent {
  type: 'message_end';
  timing: ChatTiming;
  debug?: StreamDebugInfo;
}

export interface ErrorEvent extends BaseStreamEvent {
  type: 'error';
  message: string;
}

export type StreamEvent =
  | TextDeltaEvent
  | ToolStartEvent
  | ToolResultEvent
  | MessageEndEvent
  | ErrorEvent;

// Chunk types from LLM provider streaming
export interface StreamChunk {
  type: 'text' | 'tool_use_start' | 'tool_use_delta' | 'tool_use_end' | 'done';
  text?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  };
}
