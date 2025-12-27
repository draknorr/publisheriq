/**
 * Base error class for PublisherIQ
 */
export class PublisherIQError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PublisherIQError';
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends PublisherIQError {
  constructor(
    public readonly retryAfterMs: number,
    context?: Record<string, unknown>
  ) {
    super(`Rate limit exceeded. Retry after ${retryAfterMs}ms`, 'RATE_LIMIT', context);
    this.name = 'RateLimitError';
  }
}

/**
 * Error thrown when an API request fails
 */
export class ApiError extends PublisherIQError {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly url: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'API_ERROR', { ...context, statusCode, url });
    this.name = 'ApiError';
  }
}

/**
 * Error thrown when parsing fails
 */
export class ParseError extends PublisherIQError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'PARSE_ERROR', context);
    this.name = 'ParseError';
  }
}

/**
 * Error thrown when database operation fails
 */
export class DatabaseError extends PublisherIQError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DATABASE_ERROR', context);
    this.name = 'DatabaseError';
  }
}

/**
 * Error thrown when scraping fails
 */
export class ScrapeError extends PublisherIQError {
  constructor(
    message: string,
    public readonly url: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'SCRAPE_ERROR', { ...context, url });
    this.name = 'ScrapeError';
  }
}
