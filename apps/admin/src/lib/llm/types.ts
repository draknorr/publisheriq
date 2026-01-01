// Message types for LLM conversation
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  role: MessageRole;
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// OpenAI function calling format
// Using a more flexible type to support nested objects, enums, and arrays
export interface ToolPropertySchema {
  type: string;
  description?: string;
  enum?: string[];
  items?: ToolPropertySchema;
  properties?: Record<string, ToolPropertySchema>;
  required?: string[];
  additionalProperties?: ToolPropertySchema;
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolPropertySchema>;
      required: string[];
    };
  };
}

export interface LLMResponse {
  content: string | null;
  toolCalls: ToolCall[] | null;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface LLMProvider {
  chat(messages: Message[], tools?: Tool[]): Promise<LLMResponse>;
}

// Query execution
export interface QueryResult {
  success: boolean;
  data?: Record<string, unknown>[];
  rowCount?: number;
  error?: string;
  truncated?: boolean;
}

// Chat API
export interface ChatRequest {
  messages: Message[];
}

export interface ChatToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result: QueryResult | SimilarityResult;
  timing?: {
    executionMs: number;  // Time to execute the tool
  };
}

export interface ChatTiming {
  llmMs: number;       // Total LLM inference time
  toolsMs: number;     // Total tool execution time
  totalMs: number;     // Total request time
}

// Similarity search result
export interface SimilarityResult {
  success: boolean;
  reference?: {
    id: number;
    name: string;
    type: string;
  };
  results?: Array<{
    id: number;
    name: string;
    score: number;
    type?: string;
    genres?: string[];
    tags?: string[];
    review_percentage?: number | null;
    price_cents?: number | null;
    is_free?: boolean;
  }>;
  total_found?: number;
  error?: string;
}

export interface ChatResponse {
  response: string;
  toolCalls?: ChatToolCall[];
  timing?: ChatTiming;
  error?: string;
}
