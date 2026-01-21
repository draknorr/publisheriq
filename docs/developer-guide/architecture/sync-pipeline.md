# Sync Pipeline

This document describes how data flows through PublisherIQ, from external APIs to the database.

**Last Updated:** January 11, 2026

## Recent Improvements

- **10x Embedding Throughput**: Async Qdrant writes, batch optimization (500/200/100), retry logic (v2.3)
- **CCU Rotation Tracking**: 3x daily Tier 3 polling with `last_ccu_synced` ensures full coverage every ~2 days (v2.2)
- **CCU Skip Tracking**: Invalid appids (result:42) automatically skipped for 30 days (v2.2)
- **Store Asset Mtime**: PICS-sourced page creation timestamps replace broken Community Hub scraper (v2.2)
- **Race Condition Fix**: Publisher/developer upserts now use case-insensitive normalized_name (v2.2)
- **Tiered CCU Tracking**: Three-tier system with hourly, 2-hourly, and 3x daily polling (v2.2)
- **Exact CCU from Steam API**: GetNumberOfCurrentPlayers replaces SteamSpy estimates (v2.2)
- **SteamSpy Supplementary Fetch**: Individual fetch for games missing from pagination (v2.2)
- **3x Reviews Throughput**: Rate limit increased from 0.33 to 1 req/sec (v2.2)
- **Velocity-Based Review Scheduling**: Review syncs now scheduled based on review activity (v2.1)
- **Review Delta Tracking**: Daily review changes stored for trend visualization (v2.1)
- **Interpolation**: Automatic gap-filling for continuous time-series data (v2.1)
- **Materialized View Refresh**: Automated daily refresh of all materialized views (v2.1)
- **Concurrency Protection**: Sync jobs now detect stale running jobs after 2 hours
- **Rate Limit Optimization**: Storefront sync optimized for 3 parallel workers
- **Error Handling**: Improved duplicate dev/pub name handling during upserts
- **NULL Safety**: Better handling of nullable fields (game_count, vote_count, started_at)

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
| embedding-sync | 03:00 daily | `embedding-worker.ts` | 500/200/100 | Vector embeddings (v2.3) |
| histogram-sync | 04:15 daily | `histogram-worker.ts` | 300 | Monthly reviews |
| storefront-sync | 06,10,14,18,22:00 | `storefront-worker.ts` | 200 | Game metadata |
| reviews-sync | :15 every 2h | `reviews-worker.ts` | 2500 | Review counts |
| trends-calculation | 22:00 daily | `trends-worker.ts` | 500 | Trend metrics |
| priority-calculation | 22:30 daily | `priority-worker.ts` | 1000 | Priority scores |
| velocity-calculation | 08,16,00:00 | `velocity-calculator-worker.ts` | - | Velocity stats (v2.1) |
| interpolation | 05:00 daily | `interpolation-worker.ts` | - | Fill data gaps (v2.1) |
| refresh-views | 05:00 daily | psql direct | - | Refresh materialized views (v2.1) |
| ccu-sync | :00 hourly | `ccu-tiered-worker.ts` | ~1500 | Tier 1+2 CCU (v2.2) |
| ccu-daily-sync | 04:30, 12:30, 20:30 (3x daily) | `ccu-daily-worker.ts` | ~21k/run (rotation) | Tier 3 CCU (v2.2) |
| ccu-cleanup | Sun 03:00 | psql direct | - | Aggregate + cleanup snapshots (v2.2) |
| cleanup-reservations | :00 hourly | psql direct | - | Stale credit reservation cleanup |
| cleanup-chat-logs | 03:00 daily | psql direct | - | 7-day chat log retention |

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

## Velocity-Based Review Sync Scheduling (v2.1+)

In addition to priority-based scheduling, review syncs use velocity-based intervals.

### Velocity Tiers

| Tier | Reviews/Day | Sync Interval | Description |
|------|-------------|---------------|-------------|
| `high` | >= 5 | 4 hours | Active games getting many reviews |
| `medium` | 1-5 | 12 hours | Moderate review activity |
| `low` | 0.1-1 | 24 hours | Low but non-zero activity |
| `dormant` | < 0.1 | 72 hours | Minimal review activity |

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Reviews Sync                                                 │
│     - Fetch reviews from Steam API                               │
│     - Calculate delta from previous sync                         │
│     - Insert into review_deltas table                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Velocity Calculation (3x daily)                              │
│     - Refresh review_velocity_stats materialized view            │
│     - Compute 7-day and 30-day velocity averages                 │
│     - Classify into velocity tiers                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Tier Update                                                  │
│     - Update sync_status.review_velocity_tier                    │
│     - Update sync_status.reviews_interval_hours                  │
│     - Set sync_status.next_reviews_sync                          │
└─────────────────────────────────────────────────────────────────┘
```

### Review Deltas Table

Each review sync creates a record in `review_deltas`:

| Field | Description |
|-------|-------------|
| `delta_date` | Date of sync |
| `total_reviews` | Absolute count at sync |
| `reviews_added` | Delta from previous sync |
| `daily_velocity` | Normalized to reviews/24h |
| `is_interpolated` | FALSE for real syncs |

### Interpolation

Gaps between syncs are filled with estimated values:

```
Day 1: Actual sync → 1000 reviews (is_interpolated = FALSE)
Day 2: No sync → Interpolated (is_interpolated = TRUE)
Day 3: No sync → Interpolated (is_interpolated = TRUE)
Day 4: Actual sync → 1012 reviews (is_interpolated = FALSE)
       → Days 2,3 estimated as 1004, 1008 reviews
```

**Worker**: `interpolation-worker.ts`
**Schedule**: Daily at 05:00 UTC
**Environment Variable**: `INTERPOLATION_DAYS` (default 30)

### New sync_status Columns

| Column | Type | Description |
|--------|------|-------------|
| `next_reviews_sync` | TIMESTAMPTZ | When due for review sync |
| `reviews_interval_hours` | INTEGER | Hours between syncs (4/12/24/72) |
| `review_velocity_tier` | TEXT | Current velocity tier |
| `velocity_7d` | DECIMAL | 7-day velocity |
| `velocity_calculated_at` | TIMESTAMPTZ | Last calculation time |

## Tiered CCU Tracking System (v2.2+)

CCU (concurrent user) data is collected via a three-tier system using Steam's native API.

### CCU Tier Definitions

| Tier | Criteria | Polling Frequency | Games |
|------|----------|-------------------|-------|
| **Tier 1** | Top 500 by 7-day peak CCU | Hourly | ~500 |
| **Tier 2** | Top 1000 newest releases (past year) | Every 2 hours (even hours) | ~1000 |
| **Tier 3** | All other games | 3x daily (rotation) | ~120,000+ |

### CCU Rotation Tracking

Tier 3 games use rotation tracking to ensure full coverage:

- **3x Daily Schedule**: Runs at 04:30, 12:30, 20:30 UTC
- **Oldest-First Ordering**: Queries by `last_ccu_synced ASC NULLS FIRST`
- **Per-Run Capacity**: ~21k games (6-hour timeout at 1 req/sec)
- **Full Coverage**: Complete Tier 3 rotation every ~2 days

### Partitioned Sync (v2.6+)

For parallel worker execution, Tier 3 syncs can use partitioned queries:

```sql
-- Get partition slice of Tier 3 games
SELECT * FROM get_tier3_games_partitioned(
  p_limit := 7000,       -- Games per partition
  p_partition_count := 3, -- Total partitions
  p_partition_id := 0     -- This worker's partition (0, 1, or 2)
);
```

**How Partitioning Works:**
1. All Tier 3 games are ordered by `last_ccu_synced ASC NULLS FIRST`
2. Each game is assigned to a partition using `(row_number - 1) % partition_count`
3. Each worker processes only its partition slice
4. Results are evenly distributed regardless of appid gaps

**Parallel Execution:**
- Run 3 workers in parallel, each with a different `p_partition_id`
- Each worker handles ~7k games (21k total / 3 partitions)
- Reduces total sync time by ~3x
- Graceful timeout handling ensures partial progress is saved

### CCU Skip Tracking

Invalid appids are automatically skipped to reduce wasted API calls:

- **Valid Response (result: 1)**: Update CCU, set `ccu_fetch_status = 'valid'`
- **Invalid Response (result: 42)**: Set `ccu_skip_until = NOW() + 30 days`
- **Network Error**: Set `ccu_fetch_status = 'error'`, no skip (transient)

This reduces wasted API calls by 10-15%.

### CCU Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Steam GetNumberOfCurrentPlayers API                          │
│     - Returns exact current player count                         │
│     - 1 req/sec rate limit                                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. CCU Tiered Worker (hourly)                                   │
│     - Hour 0-23: Tier 1 games                                    │
│     - Even hours (0,2,4...22): Tier 1 + Tier 2 games            │
│     - Creates ccu_snapshots records                              │
│     - Updates daily_metrics.ccu_peak                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. CCU Daily Worker (04:30 UTC)                                 │
│     - Syncs Tier 3 games (~50k)                                  │
│     - Creates daily_metrics with ccu_source='steam_api'          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Weekly Cleanup (Sunday 03:00 UTC)                            │
│     - Aggregates yesterday's hourly peaks to daily_metrics       │
│     - Deletes ccu_snapshots older than 30 days                   │
│     - Maintains data retention policy                            │
└─────────────────────────────────────────────────────────────────┘
```

### Tier Recalculation

At midnight UTC, the `recalculate_ccu_tiers()` function:
1. Identifies top 500 games by 7-day peak CCU → Tier 1
2. Identifies top 1000 newest releases → Tier 2
3. All remaining games → Tier 3
4. Records tier changes for monitoring

### CCU Source Tracking

The `daily_metrics.ccu_source` column tracks data provenance:
- `'steam_api'` - Exact CCU from Steam's GetNumberOfCurrentPlayers
- `'steamspy'` - Estimated CCU from SteamSpy
- `NULL` - Legacy data (source unknown)

---

## SteamSpy Supplementary Fetch (v2.2+)

SteamSpy's paginated "all" API misses some popular games. The supplementary fetch addresses this:

```
┌─────────────────────────────────────────────────────────────────┐
│  During full SteamSpy sync:                                      │
│  1. Identify candidates: steamspy_available = FALSE,             │
│     total_reviews >= 1000, never individually fetched            │
│  2. Fetch via appdetails endpoint (up to 100 games)              │
│  3. Update daily_metrics and sync_status                         │
│  4. Mark last_steamspy_individual_fetch                          │
└─────────────────────────────────────────────────────────────────┘
```

**Configuration**: `SUPPLEMENTARY_LIMIT` environment variable (default: 100)

---

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
| Reviews | 1 | 1s | 1/sec (v2.2: increased from 0.33) |
| Histogram | 5 | 5s | 1/sec |
| SteamSpy | 1 | 1s | 1/sec |
| Steam CCU | 1 | 1s | 1/sec (v2.2) |

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

### 8. Velocity Calculation (v2.1+)

```
review_deltas → review_velocity_stats (REFRESH MATERIALIZED VIEW)
              → sync_status.velocity_7d
              → sync_status.review_velocity_tier
              → sync_status.reviews_interval_hours
```

**Command**: `pnpm --filter @publisheriq/ingestion calculate-velocity`

**What it does**:
1. Refreshes `review_velocity_stats` materialized view
2. Updates `sync_status` with new velocity tiers
3. Sets `reviews_interval_hours` based on tier
4. Outputs tier distribution (high/medium/low/dormant)

### 9. Interpolation (v2.1+)

```
review_deltas (sparse) → review_deltas (continuous)
```

**Command**: `pnpm --filter @publisheriq/ingestion interpolate-reviews`

**What it does**:
1. Finds gaps in `review_deltas` between actual syncs
2. Inserts interpolated records with `is_interpolated = TRUE`
3. Linear interpolation between sync points

**Environment Variables**:
- `INTERPOLATION_DAYS` - Days to look back (default 30)

### 10. Refresh Views (v2.1+)

```
PostgreSQL tables → Materialized views (REFRESH CONCURRENTLY)
```

**Workflow**: `refresh-views.yml`

**Views refreshed**:
- `latest_daily_metrics`
- `publisher_metrics`
- `developer_metrics`
- `publisher_year_metrics`
- `developer_year_metrics`
- `review_velocity_stats`

**Note**: Uses `psql` directly (not Supabase CLI) for reliable long-running queries.

### 11. CCU Tiered Sync (v2.2+)

```
Steam GetNumberOfCurrentPlayers API → ccu_snapshots
                                    → daily_metrics.ccu_peak
                                    → daily_metrics.ccu_source = 'steam_api'
```

**Command**: `pnpm --filter @publisheriq/ingestion ccu-tiered-sync`

**What it does**:
1. Fetches tier assignments from `ccu_tier_assignments`
2. Determines which tiers to poll based on current hour
3. Calls Steam API for each game in the batch
4. Creates `ccu_snapshots` record with exact player count
5. Updates `daily_metrics.ccu_peak` if new value is higher
6. At midnight: recalculates tier assignments

### 12. CCU Daily Sync (v2.2+)

```
Steam GetNumberOfCurrentPlayers API → daily_metrics (Tier 3 games)
```

**Command**: `pnpm --filter @publisheriq/ingestion ccu-daily-sync`

**What it does**:
1. Fetches Tier 3 games sorted by `last_ccu_synced ASC NULLS FIRST`
2. Skips apps with active `ccu_skip_until` (invalid appids)
3. Polls CCU for each game (up to `CCU_DAILY_LIMIT`, default 150k)
4. Creates/updates `daily_metrics` with `ccu_source='steam_api'`
5. Updates `last_ccu_synced` for each processed game

**Schedule**: 3x daily (04:30, 12:30, 20:30 UTC) for full Tier 3 coverage

### 13. CCU Cleanup (v2.2+)

```
ccu_snapshots → aggregate_daily_ccu_peaks() → daily_metrics
             → cleanup_old_ccu_snapshots() → (deleted)
```

**Schedule**: Weekly on Sunday at 03:00 UTC

**What it does**:
1. Aggregates yesterday's hourly peaks to `daily_metrics`
2. Deletes snapshots older than 30 days
3. Maintains storage efficiency

## PICS Service Pipeline

The PICS service runs continuously on Railway:

### Bulk Sync Mode

```
Steam PICS → All apps (70k in ~3 minutes)
          → app_steam_tags, app_genres, app_categories
          → app_steam_deck, app_franchises
          → steam_tags, steam_genres, steam_categories (reference tables)
```

### Change Monitor Mode

```
Steam PICS Changes → Queue
                  → Process batch
                  → Update affected apps
                  → Update sync_status.last_pics_sync
```

### PICS Data Populated

| Table | Data |
|-------|------|
| `steam_tags` | Tag ID → name mapping |
| `steam_genres` | Genre ID → name mapping |
| `steam_categories` | Category ID → name (features like achievements, multiplayer) |
| `franchises` | Game series/franchise groupings |
| `app_steam_tags` | App to tag with rank |
| `app_genres` | App to genre with is_primary flag |
| `app_categories` | App to feature categories |
| `app_franchises` | App to franchise |
| `app_steam_deck` | Steam Deck compatibility category |
| `apps` columns | controller_support, platforms, pics_review_*, metacritic_score |

---

## Embedding Sync Pipeline

The embedding worker generates vector embeddings for semantic similarity search:

### State-Based Pagination

Instead of OFFSET pagination (which is inefficient for large datasets), the worker uses database state tracking:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Fetch batch via RPC                                          │
│     get_apps_for_embedding(limit=500)                           │
│     - Returns apps where: last_embedding_sync IS NULL           │
│       OR updated_at > last_embedding_sync                        │
│     - Ordered by: unembedded-first, then priority_score DESC    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Build embedding text for each entity                         │
│     - Game: name, type, genres, tags, platforms, price, reviews │
│     - Publisher: portfolio genres, tags, top games, review %    │
│     - Developer: portfolio + is_indie flag                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Hash-based change detection                                  │
│     - SHA256 hash of embedding text (16-char truncated)         │
│     - Skip if hash matches stored embedding_hash                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Generate embeddings via OpenAI API                           │
│     - Model: text-embedding-3-small (1536 dimensions)           │
│     - Batched requests for efficiency                            │
│     - Track token usage for cost monitoring                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Upsert to Qdrant Cloud                                       │
│     - 5 collections: games, publishers (×2), developers (×2)    │
│     - Payload includes all metadata for filtering                │
│     - Batch size: 500 points per upsert (v2.3)                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Mark as synced in Supabase                                   │
│     - mark_apps_embedded(appids[], hashes[])                    │
│     - Updates last_embedding_sync and embedding_hash             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. Loop until batch < limit                                     │
│     - Indicates all entities have been processed                 │
└─────────────────────────────────────────────────────────────────┘
```

### Three-Phase Sync

1. **Games** (batch size: 500)
   - Syncs all games that need embedding
   - Uses `get_apps_for_embedding()` RPC function
   - Marks complete with `mark_apps_embedded()`

2. **Publishers** (batch size: 200)
   - Two embeddings per publisher: portfolio + identity
   - Uses `get_publishers_needing_embedding()` RPC function
   - Marks complete with `mark_publishers_embedded()`
   - Reduced from 500 to avoid RPC timeout (v2.3)

3. **Developers** (batch size: 100)
   - Two embeddings per developer: portfolio + identity
   - Uses `get_developers_needing_embedding()` RPC function
   - Marks complete with `mark_developers_embedded()`
   - Smallest batch due to complex aggregation query (v2.3)

### Qdrant Collections

| Collection | Entity | Purpose |
|------------|--------|---------|
| `publisheriq_games` | Games | Find similar games |
| `publisheriq_publishers_portfolio` | Publishers | Match by entire catalog |
| `publisheriq_publishers_identity` | Publishers | Match by top games |
| `publisheriq_developers_portfolio` | Developers | Match by entire catalog |
| `publisheriq_developers_identity` | Developers | Match by top games |

### Performance Optimizations (v2.3)

**Async Qdrant Writes:**
- Uses `wait: false` for non-blocking upserts
- Collection verification at sync completion ensures data integrity
- Enables 10x throughput improvement over blocking writes

**OpenAI API Retry Logic:**
- 3 retries with exponential backoff (1s → 2s → 4s, max 10s)
- Handles 429 (rate limit), 5xx errors, timeouts
- `isRetryableError()` function classifies transient vs permanent failures

**Progress Monitoring:**
- Logs every 30 seconds during sync
- Metrics: elapsed time, items processed/skipped, tokens used, items/minute

**Selective Sync:**
- `SYNC_COLLECTION` env var controls which entity types to sync
- Options: `all`, `games`, `publishers`, `developers`

### Cost Tracking

- **Model**: text-embedding-3-small (~$0.02 per 1M tokens)
- **Typical usage**: ~500k tokens per full sync
- Worker logs total tokens used and estimated cost

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
- [Rate Limits](../../api/rate-limits.md) - Detailed limits
- [GitHub Actions](../deployment/github-actions.md) - Workflow setup
- [Troubleshooting](../../admin-guide/troubleshooting.md) - Common issues
