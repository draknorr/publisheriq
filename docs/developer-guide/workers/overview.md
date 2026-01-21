# Worker System Overview

Workers are TypeScript modules that synchronize data from external sources into the PublisherIQ database. They run on scheduled GitHub Actions and can also be executed manually.

---

## Architecture

```
External APIs          Workers                    Database
┌─────────────┐       ┌─────────────────┐        ┌─────────┐
│ Steam API   │──────▶│ applist-sync    │───────▶│ apps    │
│ SteamSpy    │──────▶│ steamspy-sync   │───────▶│ metrics │
│ Storefront  │──────▶│ storefront-sync │───────▶│ data    │
│ Reviews API │──────▶│ reviews-sync    │───────▶│ views   │
│ PICS        │──────▶│ pics-service    │───────▶│         │
└─────────────┘       └─────────────────┘        └─────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ GitHub Actions  │
                    │ (Scheduled)     │
                    └─────────────────┘
```

---

## Worker Types

| Category | Workers | Purpose |
|----------|---------|---------|
| **Data Collection** | applist, steamspy, storefront, reviews, histogram | Fetch data from external APIs |
| **CCU Tracking** | ccu-tiered, ccu-daily | Track concurrent player counts |
| **Calculations** | trends, priority, velocity | Compute derived metrics |
| **Maintenance** | refresh-views, cleanup | Database maintenance |
| **Embeddings** | embedding-sync | Vector embeddings for search |

---

## Key Concepts

### Rate Limiting

All workers use the token bucket algorithm to respect API rate limits:

```typescript
const rateLimiter = new RateLimiter({
  tokensPerInterval: 60,  // requests allowed
  interval: 60_000,       // per minute
  maxTokens: 60           // burst capacity
});
```

### Priority-Based Scheduling

Apps are synced based on priority scores:

| Tier | Score | Interval | Description |
|------|-------|----------|-------------|
| High | 150+ | 6h | Active games (CCU > 10K) |
| Medium | 100-149 | 12h | Popular games |
| Normal | 50-99 | 24h | Average activity |
| Low | 25-49 | 48h | Low activity |
| Minimal | <25 | 7d | Dead games |

### Job Tracking

All worker runs are logged to `sync_jobs` table:

- Start/end timestamps
- Success/failure counts
- Error messages
- GitHub Actions run ID

---

## File Structure

```
packages/ingestion/
├── src/
│   ├── apis/           # External API clients
│   │   ├── steam-web.ts
│   │   ├── storefront.ts
│   │   ├── reviews.ts
│   │   └── steamspy.ts
│   ├── workers/        # Worker implementations
│   │   ├── applist-sync.ts
│   │   ├── steamspy-sync.ts
│   │   └── ...
│   └── utils/          # Shared utilities
│       ├── rate-limiter.ts
│       └── retry.ts
├── package.json        # pnpm scripts
└── tsconfig.json

.github/workflows/      # Scheduled jobs
├── applist-sync.yml
├── steamspy-sync.yml
└── ...
```

---

## Quick Commands

```bash
# Run a sync worker
pnpm --filter @publisheriq/ingestion <worker-name>

# Common workers
pnpm --filter @publisheriq/ingestion storefront-sync
pnpm --filter @publisheriq/ingestion reviews-sync
pnpm --filter @publisheriq/ingestion steamspy-sync
```

See [Running Workers](./running-workers.md) for all available commands.

---

## Related Documentation

- [Running Workers](./running-workers.md) - Manual execution guide
- [Adding Workers](./adding-workers.md) - How to create new workers
- [Sync Pipeline](../architecture/sync-pipeline.md) - Data flow architecture
- [Data Sources](../architecture/data-sources.md) - API specifications
