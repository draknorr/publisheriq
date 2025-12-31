# Sync Pipeline

This document describes how data flows through PublisherIQ, from external APIs to the database.

## Pipeline Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   GitHub    │    │   Worker    │    │   Rate      │    │  Supabase   │
│   Actions   │───▶│   Process   │───▶│   Limiter   │───▶│  Database   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
     │                   │                  │                   │
  Schedule           Batch              Token Bucket        Upsert
  Trigger            Processing         Algorithm           Results
```

## GitHub Actions Schedule

All scheduled sync jobs run via GitHub Actions on UTC time:

| Job | Schedule (UTC) | Worker | Batch Size | Purpose |
|-----|----------------|--------|------------|---------|
| applist-sync | 00:15 daily | `applist-worker.ts` | Full | Master app list |
| steamspy-sync | 02:15 daily | `steamspy-worker.ts` | 1000/page | CCU, owners, tags |
| histogram-sync | 04:15 daily | `histogram-worker.ts` | 300 | Monthly reviews |
| storefront-sync | 06,10,14,18,22:00 | `storefront-worker.ts` | 200 | Game metadata |
| reviews-sync | 06:30,10:30,14:30,18:30,22:30 | `reviews-worker.ts` | 200 | Review counts |
| trends-calculation | 22:00 daily | `trends-worker.ts` | 500 | Trend metrics |
| priority-calculation | 22:30 daily | `priority-worker.ts` | 1000 | Priority scores |
| page-creation-scrape | 03:00 daily | `scraper-worker.ts` | 100 | Page dates |

## Worker Architecture

Each worker follows a common pattern:

```typescript
async function runWorker() {
  // 1. Create job record
  const job = await createSyncJob('worker-name');

  // 2. Get apps to sync (priority-ordered)
  const apps = await getAppsForSync('source', batchSize);

  // 3. Process with rate limiting
  for (const app of apps) {
    await rateLimiter.acquire();
    try {
      const data = await fetchFromAPI(app.appid);
      await upsertToDatabase(data);
      job.itemsSucceeded++;
    } catch (error) {
      job.itemsFailed++;
      await recordError(app.appid, error);
    }
  }

  // 4. Complete job
  await completeSyncJob(job);
}
```

## Priority-Based Scheduling

Not all apps are synced equally. The system uses priority tiers:

### Refresh Tiers

| Tier | Criteria | Sync Interval |
|------|----------|---------------|
| `active` | CCU > 100 OR reviews/day > 1 | 6-12 hours |
| `moderate` | CCU > 0 | 24-48 hours |
| `dormant` | No activity for 90 days | Weekly |
| `dead` | No activity for 1 year | Monthly |

### Priority Scoring

```
CCU-based scoring:
  CCU > 10,000:  +100 points
  CCU > 1,000:   +50 points
  CCU > 100:     +25 points

Activity-based scoring:
  Review velocity > 10/day:  +40 points
  Trend change > 10%:        +25 points

Penalties:
  Dead game (CCU=0, velocity<0.1):  -50 points
```

### App Selection Query

Workers use `get_apps_for_sync()` which:
1. Filters by `next_sync_after < NOW()`
2. Orders by `priority_score DESC`
3. Prioritizes apps missing developer info
4. Returns requested batch size

## Rate Limiting

All API calls go through a token bucket rate limiter:

```typescript
const rateLimiter = new RateLimiter({
  tokensPerInterval: 10,    // Burst capacity
  interval: 5000,           // Refill interval (ms)
  maxTokens: 10             // Maximum bucket size
});

await rateLimiter.acquire();  // Blocks until token available
```

### Per-API Rate Limits

| API | Tokens/Interval | Interval | Effective Rate |
|-----|-----------------|----------|----------------|
| Storefront | 10 | 30s | 0.33/sec |
| Reviews | 5 | 15s | 0.33/sec |
| Histogram | 5 | 5s | 1/sec |
| SteamSpy | 1 | 1s | 1/sec |

## Data Flow by Worker

### 1. App List Sync

```
Steam GetAppList API → apps table
                     → sync_status table (new entries)
```

Creates records for all Steam apps, initializes sync status.

### 2. SteamSpy Sync

```
SteamSpy API → daily_metrics (owners, CCU, playtime)
             → app_tags (user-voted tags)
             → sync_status.last_steamspy_sync
```

### 3. Storefront Sync

```
Steam Storefront API → apps (metadata, prices)
                     → publishers (new entries)
                     → developers (new entries)
                     → app_publishers (links)
                     → app_developers (links)
                     → sync_status.last_storefront_sync
```

### 4. Reviews Sync

```
Steam Reviews API → daily_metrics (review counts, scores)
                  → sync_status.last_reviews_sync
```

### 5. Histogram Sync

```
Steam Histogram API → review_histogram (monthly buckets)
                    → sync_status.last_histogram_sync
```

### 6. Trends Calculation

```
review_histogram → app_trends (computed metrics)
daily_metrics    → app_trends (velocity)
```

Calculates:
- 30/90 day trend direction
- Positive ratio changes
- Review velocity (reviews/day)

### 7. Priority Calculation

```
daily_metrics → sync_status.priority_score
app_trends    → sync_status.refresh_tier
             → sync_status.next_sync_after
```

## PICS Service Pipeline

The PICS service runs continuously on Railway:

### Bulk Sync Mode

```
Steam PICS → All apps (70k in ~3 minutes)
          → app_tags, app_genres, app_categories
          → app_steam_deck, app_franchises
```

### Change Monitor Mode

```
Steam PICS Changes → Queue
                  → Process batch
                  → Update affected apps
```

## Error Handling

### Retry Strategy

```typescript
const retryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2
};
```

### Circuit Breaker

After consecutive errors, apps are temporarily skipped:

```sql
UPDATE sync_status
SET consecutive_errors = consecutive_errors + 1,
    last_error_message = $1,
    last_error_at = NOW()
WHERE appid = $2;

-- Skip apps with > 5 consecutive errors
WHERE consecutive_errors < 5
```

### Job Tracking

All sync runs are logged to `sync_jobs`:

```sql
INSERT INTO sync_jobs (
  job_type, status, started_at,
  items_processed, items_succeeded, items_failed,
  error_message, github_run_id
)
```

## Monitoring

### Sync Health Dashboard

The admin dashboard at `/sync` shows:
- Recent job history
- Success/failure rates
- Error messages
- Next scheduled runs

### Key Metrics

- **Items processed**: Total apps attempted
- **Success rate**: `items_succeeded / items_processed`
- **Error rate**: `items_failed / items_processed`
- **Duration**: `completed_at - started_at`

## Related Documentation

- [Data Sources](data-sources.md) - API specifications
- [Rate Limits](../reference/rate-limits.md) - Detailed limits
- [GitHub Actions](../deployment/github-actions.md) - Workflow setup
- [Troubleshooting](../guides/troubleshooting.md) - Common issues
