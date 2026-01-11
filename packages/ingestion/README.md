# @publisheriq/ingestion

Data collection workers and API clients for PublisherIQ.

**Last Updated:** January 11, 2026

## Overview

This package provides:
- API clients for Steam, SteamSpy, and OpenAI embeddings
- Worker processes for scheduled data sync
- Rate limiting and retry utilities

## Workers

### Available Commands

```bash
# Steam app list
pnpm --filter @publisheriq/ingestion applist-sync

# SteamSpy bulk data
pnpm --filter @publisheriq/ingestion steamspy-sync

# Steam Storefront metadata
pnpm --filter @publisheriq/ingestion storefront-sync

# Steam Reviews
pnpm --filter @publisheriq/ingestion reviews-sync

# Review histogram
pnpm --filter @publisheriq/ingestion histogram-sync

# Calculate trend metrics
pnpm --filter @publisheriq/ingestion trends-calculate

# Calculate priority scores
pnpm --filter @publisheriq/ingestion priority-calculate

# Vector embeddings (v2.3 optimized)
pnpm --filter @publisheriq/ingestion embedding-sync

# CCU tracking (v2.2)
pnpm --filter @publisheriq/ingestion ccu-tiered-sync
pnpm --filter @publisheriq/ingestion ccu-daily-sync

# Velocity & view refresh (v2.1)
pnpm --filter @publisheriq/ingestion calculate-velocity
pnpm --filter @publisheriq/ingestion interpolate-reviews
pnpm --filter @publisheriq/ingestion refresh-views

# Price sync
pnpm --filter @publisheriq/ingestion price-sync
```

### Worker Schedule

Workers run via GitHub Actions:

| Worker | Schedule | Purpose |
|--------|----------|---------|
| applist-sync | Daily 00:15 UTC | Master app list |
| steamspy-sync | Daily 02:15 UTC | CCU, owners, tags |
| embedding-sync | Daily 03:00 UTC | Vector embeddings (v2.3) |
| histogram-sync | Daily 04:15 UTC | Monthly reviews |
| ccu-sync | Hourly :00 | Tier 1+2 CCU (v2.2) |
| ccu-daily-sync | 3x daily | Tier 3 CCU rotation (v2.2) |
| storefront-sync | 5x daily | Game metadata |
| reviews-sync | Every 2h :15 | Review counts (3x throughput v2.2) |
| velocity-calculation | 3x daily | Velocity tiers (v2.1) |
| interpolation | Daily 05:00 UTC | Fill review gaps (v2.1) |
| refresh-views | Daily 05:00 UTC | Materialized views (v2.1) |
| trends-calculation | Daily 22:00 UTC | Trend metrics |
| priority-calculation | Daily 22:30 UTC | Priority scores |

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

### Steam CCU API (v2.2)

```typescript
import { fetchSteamCCU } from '@publisheriq/ingestion';

const ccu = await fetchSteamCCU(730); // Returns exact player count
```

### Embedding API (v2.3)

```typescript
import {
  buildGameEmbeddingText,
  generateEmbeddings,
  hashEmbeddingText
} from '@publisheriq/ingestion';

const text = buildGameEmbeddingText(gameData);
const hash = hashEmbeddingText(text);
const embeddings = await generateEmbeddings([text]);
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
│   ├── steamspy.ts       # SteamSpy API
│   ├── steam-ccu.ts      # Steam CCU API (v2.2)
│   └── embedding.ts      # OpenAI embeddings (v2.3)
│
├── workers/
│   ├── applist-worker.ts
│   ├── steamspy-worker.ts
│   ├── storefront-worker.ts
│   ├── reviews-worker.ts
│   ├── histogram-worker.ts
│   ├── trends-worker.ts
│   ├── priority-worker.ts
│   ├── embedding-worker.ts          # Vector embeddings (v2.3)
│   ├── ccu-worker.ts                # Legacy CCU worker
│   ├── ccu-tiered-worker.ts         # Tier 1+2 CCU (v2.2)
│   ├── ccu-daily-worker.ts          # Tier 3 CCU rotation (v2.2)
│   ├── velocity-calculator-worker.ts # Review velocity (v2.1)
│   ├── interpolation-worker.ts      # Gap filling (v2.1)
│   ├── refresh-views-worker.ts      # Materialized views (v2.1)
│   └── price-sync-worker.ts         # Price tracking
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

# Worker-specific
BATCH_SIZE=500                    # Default batch size
MAX_PAGES=0                       # 0 = all pages
GITHUB_RUN_ID=xxx                 # Set by GitHub Actions

# Embedding sync (v2.3)
SYNC_COLLECTION=all               # games|publishers|developers|all
OPENAI_API_KEY=sk-...             # For embeddings

# CCU (v2.2)
CCU_DAILY_LIMIT=150000           # Max Tier 3 apps per run

# Velocity (v2.1)
INTERPOLATION_DAYS=30            # Days to look back for interpolation
```

## Dependencies

- `@publisheriq/database` - Database client
- `@publisheriq/shared` - Logger, errors, constants
- `@publisheriq/qdrant` - Vector database client (v2.3)
- `openai` - Embedding generation (v2.3)

## Scripts

```bash
# Build package
pnpm --filter @publisheriq/ingestion build

# Type check
pnpm --filter @publisheriq/ingestion check-types

# Run specific worker
pnpm --filter @publisheriq/ingestion steamspy-sync
```

## Related Documentation

- [Running Workers](../../docs/guides/running-workers.md)
- [Adding New Workers](../../docs/guides/adding-new-worker.md)
- [Sync Pipeline](../../docs/architecture/sync-pipeline.md)
- [Rate Limits](../../docs/reference/rate-limits.md)
- [v2.3 Release Notes](../../docs/releases/v2.3-embedding-optimization.md)
