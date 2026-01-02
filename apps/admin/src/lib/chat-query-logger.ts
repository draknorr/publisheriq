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

// Configuration
const FLUSH_COUNT_THRESHOLD = 10;
const FLUSH_TIME_INTERVAL_MS = 30_000; // 30 seconds

// Module-level singleton state
let buffer: ChatQueryLogEntry[] = [];
let flushIntervalId: ReturnType<typeof setInterval> | null = null;
let lastFlushTime = Date.now();

/**
 * Add a chat query log entry to the buffer.
 * Automatically flushes when count threshold is reached.
 */
export function logChatQuery(entry: ChatQueryLogEntry): void {
  buffer.push(entry);

  // Start interval timer on first log (lazy initialization)
  if (!flushIntervalId) {
    flushIntervalId = setInterval(() => {
      if (buffer.length > 0 && Date.now() - lastFlushTime >= FLUSH_TIME_INTERVAL_MS) {
        flushBuffer().catch(console.error);
      }
    }, FLUSH_TIME_INTERVAL_MS);
  }

  // Flush if count threshold reached
  if (buffer.length >= FLUSH_COUNT_THRESHOLD) {
    flushBuffer().catch(console.error);
  }
}

/**
 * Flush the buffer to the database.
 * Called automatically by count/time triggers, or manually.
 */
export async function flushBuffer(): Promise<void> {
  if (buffer.length === 0) return;

  // Swap buffer to avoid race conditions
  const toFlush = buffer;
  buffer = [];
  lastFlushTime = Date.now();

  try {
    const supabase = getServiceClient();

    // Type assertion needed until database types are regenerated after migration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('chat_query_logs') as any).insert(toFlush);

    if (error) {
      console.error('Failed to flush chat query logs:', error);
      // Re-add to buffer on failure (with limit to prevent memory issues)
      if (buffer.length + toFlush.length <= FLUSH_COUNT_THRESHOLD * 3) {
        buffer = [...toFlush, ...buffer];
      }
    }
  } catch (err) {
    console.error('Error flushing chat query logs:', err);
  }
}

/**
 * Get current buffer size (for monitoring/debugging).
 */
export function getBufferSize(): number {
  return buffer.length;
}
