# @publisheriq/ingestion

Data collection workers and API clients for PublisherIQ.

## Overview

This package provides:
- API clients for Steam, SteamSpy, and scraping
- Worker processes for scheduled data sync
- Rate limiting and retry utilities

## Workers

### Available Commands

```bash
# Steam app list
pnpm --filter ingestion applist-sync

# SteamSpy bulk data
pnpm --filter ingestion steamspy-sync

# Steam Storefront metadata
pnpm --filter ingestion storefront-sync

# Steam Reviews
pnpm --filter ingestion reviews-sync

# Review histogram
pnpm --filter ingestion histogram-sync

# Page creation date scraping
pnpm --filter ingestion scrape-creation-dates

# Calculate trend metrics
pnpm --filter ingestion calculate-trends

# Calculate priority scores
pnpm --filter ingestion update-priorities
```

### Worker Schedule

Workers run via GitHub Actions:

| Worker | Schedule | Purpose |
|--------|----------|---------|
| applist-sync | Daily 00:15 UTC | Master app list |
| steamspy-sync | Daily 02:15 UTC | CCU, owners, tags |
| histogram-sync | Daily 04:15 UTC | Monthly reviews |
| storefront-sync | 5x daily | Game metadata |
| reviews-sync | 5x daily | Review counts |
| calculate-trends | Daily 22:00 UTC | Trend metrics |
| update-priorities | Daily 22:30 UTC | Priority scores |

## API Clients

### Steam Web API

```typescript
import { fetchAppList } from '@publisheriq/ingestion';

const apps = await fetchAppList();
```

### Storefront API

```typescript
import { fetchStorefrontApp } from '@publisheriq/ingestion';

const result = await fetchStorefrontApp(730);
if (result.status === 'success') {
  console.log(result.data);
}
```

### Reviews API

```typescript
import { fetchReviewSummary, fetchReviewHistogram } from '@publisheriq/ingestion';

const summary = await fetchReviewSummary(730);
const histogram = await fetchReviewHistogram(730);
```

### SteamSpy API

```typescript
import { fetchSteamSpyAllApps, fetchSteamSpyAppDetails } from '@publisheriq/ingestion';

const allApps = await fetchSteamSpyAllApps(0); // Page 0
const details = await fetchSteamSpyAppDetails(730);
```

## Utilities

### Rate Limiter

Token bucket rate limiter for API calls:

```typescript
import { RateLimiter } from '@publisheriq/ingestion';

const limiter = new RateLimiter({
  tokensPerInterval: 10,
  interval: 30_000,
  maxTokens: 10
});

await limiter.acquire(); // Blocks until token available
```

### Retry

Exponential backoff retry wrapper:

```typescript
import { withRetry } from '@publisheriq/ingestion';

const result = await withRetry(
  () => fetchSomeData(),
  {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30_000
  }
);
```

## Project Structure

```
src/
├── apis/
│   ├── steam-web.ts      # Steam IStoreService API
│   ├── storefront.ts     # Steam Storefront API
│   ├── reviews.ts        # Steam Reviews & Histogram
│   └── steamspy.ts       # SteamSpy API
│
├── scrapers/
│   └── page-creation.ts  # Community hub scraping
│
├── workers/
│   ├── applist-worker.ts
│   ├── steamspy-worker.ts
│   ├── storefront-worker.ts
│   ├── reviews-worker.ts
│   ├── histogram-worker.ts
│   ├── scraper-worker.ts
│   ├── trends-worker.ts
│   └── priority-worker.ts
│
├── utils/
│   ├── rate-limiter.ts   # Token bucket limiter
│   └── retry.ts          # Retry with backoff
│
└── index.ts              # Package exports
```

## Environment Variables

```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
STEAM_API_KEY=xxx

# Optional
BATCH_SIZE=200
MAX_PAGES=0  # 0 = all
GITHUB_RUN_ID=xxx
```

## Dependencies

- `@publisheriq/database` - Database client
- `@publisheriq/shared` - Logger, errors, constants
- `cheerio` - HTML parsing for scraping
- `p-limit` - Concurrency control

## Scripts

```bash
# Build package
pnpm --filter ingestion build

# Type check
pnpm --filter ingestion check-types

# Run specific worker
pnpm --filter ingestion steamspy-sync
```

## Related Documentation

- [Running Workers](../../docs/guides/running-workers.md)
- [Adding New Workers](../../docs/guides/adding-new-worker.md)
- [Sync Pipeline](../../docs/architecture/sync-pipeline.md)
- [Rate Limits](../../docs/reference/rate-limits.md)
