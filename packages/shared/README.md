# @publisheriq/shared

Shared utilities and constants for PublisherIQ.

## Overview

This package provides:
- Structured logging
- Custom error types
- Shared constants

## Installation

This is a workspace package, included automatically:

```json
{
  "dependencies": {
    "@publisheriq/shared": "workspace:*"
  }
}
```

## Logger

Structured logging with context:

```typescript
import { logger } from '@publisheriq/shared';

// Basic logging
logger.info('Message');
logger.warn('Warning message');
logger.error('Error message');

// With context
logger.info({ appid: 730, count: 100 }, 'Processed apps');

// Child logger with module context
const log = logger.child({ module: 'my-worker' });
log.info('Started worker'); // Includes module in output
```

### Log Levels

- `debug` - Detailed debugging info
- `info` - General information
- `warn` - Warning conditions
- `error` - Error conditions

## Error Types

Custom error types for consistent error handling:

```typescript
import { AppError, ValidationError, NetworkError } from '@publisheriq/shared';

// Base application error
throw new AppError('Something went wrong', { context: 'additional info' });

// Validation errors
throw new ValidationError('Invalid appid');

// Network errors
throw new NetworkError('API request failed', { status: 500 });
```

### Error Properties

```typescript
class AppError extends Error {
  name: string;      // Error type name
  message: string;   // Error message
  context?: object;  // Additional context
  timestamp: Date;   // When error occurred
}
```

## Constants

Shared configuration values:

```typescript
import { RATE_LIMITS, BATCH_SIZES, SYNC_INTERVALS } from '@publisheriq/shared';

// Rate limit configurations
const storefrontLimit = RATE_LIMITS.STOREFRONT;

// Default batch sizes
const batchSize = BATCH_SIZES.STOREFRONT;

// Sync interval configurations
const interval = SYNC_INTERVALS.ACTIVE;
```

## Project Structure

```
src/
├── index.ts       # Package exports
├── logger.ts      # Logging implementation
├── errors.ts      # Custom error types
└── constants.ts   # Shared constants
```

## Usage in Other Packages

Import in other workspace packages:

```typescript
// In @publisheriq/ingestion
import { logger, AppError } from '@publisheriq/shared';

const log = logger.child({ module: 'steamspy-worker' });

try {
  // ... work
  log.info({ count }, 'Processed items');
} catch (error) {
  log.error({ error }, 'Worker failed');
  throw new AppError('Worker failed', { originalError: error });
}
```

## Scripts

```bash
# Build package
pnpm --filter shared build

# Type check
pnpm --filter shared check-types
```

## Related Documentation

- [Project Architecture](../../docs/architecture/overview.md)
- [Adding New Workers](../../docs/guides/adding-new-worker.md)
