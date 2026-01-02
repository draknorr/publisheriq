import { getServiceClient } from '@publisheriq/database';

// Types for log entries
export interface ChatQueryLogEntry {
  query_text: string;
  tool_names: string[];
  tool_count: number;
  iteration_count: number;
  response_length: number;
  timing_llm_ms: number | null;
  timing_tools_ms: number | null;
  timing_total_ms: number | null;
}

/**
 * Log a chat query directly to the database.
 * For serverless environments, we insert immediately since
 * buffering doesn't work reliably (function terminates after response).
 */
export async function logChatQuery(entry: ChatQueryLogEntry): Promise<void> {
  try {
    const supabase = getServiceClient();

    // Type assertion needed until database types are regenerated after migration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('chat_query_logs') as any).insert(entry);

    if (error) {
      console.error('Failed to log chat query:', error);
    }
  } catch (err) {
    console.error('Error logging chat query:', err);
  }
}
