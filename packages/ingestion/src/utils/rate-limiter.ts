import { logger, RATE_LIMITS } from '@publisheriq/shared';

interface RateLimiterConfig {
  /** Requests per second allowed */
  requestsPerSecond: number;
  /** Maximum burst size (tokens that can accumulate) */
  burst: number;
}

/**
 * Token bucket rate limiter with async queue support
 *
 * Implements a token bucket algorithm where:
 * - Tokens are added at a fixed rate (requestsPerSecond)
 * - Maximum tokens is capped at 'burst'
 * - Each request consumes one token
 * - If no tokens available, request waits until one is available
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private readonly log = logger.child({ component: 'RateLimiter' });
  private acquireQueue: Promise<void> = Promise.resolve();

  constructor(config: RateLimiterConfig) {
    this.maxTokens = config.burst;
    this.refillRate = config.requestsPerSecond;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a token, waiting if necessary
   * Returns when a token is available and consumed
   * Uses a queue pattern to serialize concurrent acquire calls
   */
  async acquire(): Promise<void> {
    // Chain onto the queue - this serializes all acquire calls
    const previous = this.acquireQueue;

    let resolveThis!: () => void;
    this.acquireQueue = new Promise((resolve) => {
      resolveThis = resolve;
    });

    // Wait for previous acquire to complete
    await previous;

    try {
      this.refill();

      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }

      // Calculate wait time for next token
      const tokensNeeded = 1 - this.tokens;
      const waitTimeMs = (tokensNeeded / this.refillRate) * 1000;

      this.log.debug('Rate limit reached, waiting', { waitTimeMs });

      await this.sleep(waitTimeMs);

      this.refill();
      this.tokens -= 1;
    } finally {
      // Release the next waiter
      resolveThis();
    }
  }

  /**
   * Try to acquire a token without waiting
   * Returns true if token was acquired, false otherwise
   */
  tryAcquire(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Get the current number of available tokens
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Get the time in ms until the next token is available
   */
  getWaitTimeMs(): number {
    this.refill();

    if (this.tokens >= 1) {
      return 0;
    }

    const tokensNeeded = 1 - this.tokens;
    return (tokensNeeded / this.refillRate) * 1000;
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsedSeconds * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Pre-configured rate limiters for each Steam API
 * Uses centralized rate limit configuration from shared constants
 */
export const rateLimiters = {
  steamspyGeneral: new RateLimiter(RATE_LIMITS.STEAMSPY_GENERAL),
  steamspyAll: new RateLimiter(RATE_LIMITS.STEAMSPY_ALL),
  storefront: new RateLimiter(RATE_LIMITS.STOREFRONT),
  reviews: new RateLimiter(RATE_LIMITS.REVIEWS),
  histogram: new RateLimiter(RATE_LIMITS.HISTOGRAM),
  communityScrape: new RateLimiter(RATE_LIMITS.COMMUNITY_SCRAPE),
};

/**
 * Wrap an async function with rate limiting
 */
export function withRateLimit<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  limiter: RateLimiter
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    await limiter.acquire();
    return fn(...args) as ReturnType<T>;
  }) as T;
}
