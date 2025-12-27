import { RETRY_CONFIG, logger, RateLimitError, ApiError } from '@publisheriq/shared';

interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial delay in milliseconds before first retry */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds between retries */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier?: number;
  /** Function to determine if an error should be retried */
  shouldRetry?: (error: unknown) => boolean;
  /** Callback called before each retry */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const log = logger.child({ component: 'Retry' });

/**
 * Default function to determine if an error should trigger a retry
 */
function defaultShouldRetry(error: unknown): boolean {
  // Retry rate limit errors
  if (error instanceof RateLimitError) {
    return true;
  }

  // Retry certain HTTP status codes
  if (error instanceof ApiError) {
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    return retryableStatusCodes.includes(error.statusCode);
  }

  // Retry network errors
  if (error instanceof Error) {
    const networkErrorMessages = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'EPIPE',
      'EAI_AGAIN',
      'fetch failed',
    ];
    return networkErrorMessages.some((msg) => error.message.includes(msg));
  }

  return false;
}

/**
 * Execute a function with exponential backoff retry logic
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function if successful
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxRetries = RETRY_CONFIG.MAX_RETRIES,
    initialDelayMs = RETRY_CONFIG.INITIAL_DELAY_MS,
    maxDelayMs = RETRY_CONFIG.MAX_DELAY_MS,
    backoffMultiplier = RETRY_CONFIG.BACKOFF_MULTIPLIER,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      let delayMs = initialDelayMs * Math.pow(backoffMultiplier, attempt);

      // If it's a rate limit error with a specific retry time, use that
      if (error instanceof RateLimitError && error.retryAfterMs > 0) {
        delayMs = error.retryAfterMs;
      }

      // Cap the delay at maxDelayMs
      delayMs = Math.min(delayMs, maxDelayMs);

      // Add some jitter (±10%) to prevent thundering herd
      const jitter = delayMs * 0.1 * (Math.random() * 2 - 1);
      delayMs = Math.round(delayMs + jitter);

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(error, attempt + 1, delayMs);
      } else {
        log.warn('Retrying after error', {
          attempt: attempt + 1,
          maxRetries,
          delayMs,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a retry-wrapped version of an async function
 */
export function withRetryWrapper<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return withRetry(() => fn(...args) as Promise<ReturnType<T>>, options);
  }) as T;
}
