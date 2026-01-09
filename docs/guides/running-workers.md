# Running Workers Manually

This guide covers how to run data sync workers manually for testing, debugging, or one-time syncs.

## Prerequisites

- Dependencies installed (`pnpm install`)
- Packages built (`pnpm build`)
- Environment variables configured
- Database connection working

## Quick Reference

```bash
# App list (all Steam apps)
pnpm --filter @publisheriq/ingestion applist-sync

# SteamSpy (owners, CCU, tags)
pnpm --filter @publisheriq/ingestion steamspy-sync

# Storefront (metadata, prices)
pnpm --filter @publisheriq/ingestion storefront-sync

# Reviews (scores, counts)
pnpm --filter @publisheriq/ingestion reviews-sync

# Review histogram (monthly trends)
pnpm --filter @publisheriq/ingestion histogram-sync

# Page creation scraping
pnpm --filter @publisheriq/ingestion page-creation-scrape

# Calculate trends
pnpm --filter @publisheriq/ingestion trends-calculate

# Calculate priority scores
pnpm --filter @publisheriq/ingestion priority-calculate

# Calculate review velocity (v2.1)
pnpm --filter @publisheriq/ingestion calculate-velocity

# Interpolate review data (v2.1)
pnpm --filter @publisheriq/ingestion interpolate-reviews

# CCU tiered sync - Tier 1+2 (v2.2)
pnpm --filter @publisheriq/ingestion ccu-tiered-sync

# CCU daily sync - Tier 3 (v2.2)
pnpm --filter @publisheriq/ingestion ccu-daily-sync
```

## Worker Details

### App List Sync

Fetches the master list of all Steam apps.

```bash
pnpm --filter @publisheriq/ingestion applist-sync
```

**What it does:**
- Calls Steam IStoreService API
- Creates/updates records in `apps` table
- Initializes `sync_status` for new apps

**Duration:** ~2-5 minutes

**Rate limit:** 100k requests/day (no issues)

---

### SteamSpy Sync

Fetches player data and tags from SteamSpy.

```bash
# Full sync
pnpm --filter @publisheriq/ingestion steamspy-sync

# Limited pages (for testing)
MAX_PAGES=5 pnpm --filter @publisheriq/ingestion steamspy-sync
```

**What it does:**
- Fetches bulk data page by page
- Updates `daily_metrics` (owners, CCU, playtime)
- Updates `app_tags`

**Duration:** ~4-6 hours for full sync

**Rate limit:** 1 page per 60 seconds

---

### Storefront Sync

Fetches detailed game metadata from Steam.

```bash
# Default batch
pnpm --filter @publisheriq/ingestion storefront-sync

# Custom batch size
BATCH_SIZE=100 pnpm --filter @publisheriq/ingestion storefront-sync
```

**What it does:**
- Fetches app details from Storefront API
- Updates `apps` (metadata, prices, release dates)
- Creates `publishers` and `developers` entries
- Links via junction tables

**Duration:** ~1-2 hours per 10k apps

**Rate limit:** ~200 requests per 5 minutes

---

### Reviews Sync

Fetches current review scores and counts.

```bash
pnpm --filter @publisheriq/ingestion reviews-sync
```

**What it does:**
- Calls Steam Reviews API
- Updates `daily_metrics` (review counts, scores)

**Duration:** ~30-60 minutes per 10k apps

**Rate limit:** ~20 requests per minute

---

### Histogram Sync

Fetches monthly review aggregates.

```bash
pnpm --filter @publisheriq/ingestion histogram-sync
```

**What it does:**
- Calls Review Histogram API
- Updates `review_histogram` table

**Duration:** ~15-30 minutes per 10k apps

**Rate limit:** ~60 requests per minute

---

### Page Creation Scrape

Scrapes community hub for page creation dates.

```bash
pnpm --filter @publisheriq/ingestion page-creation-scrape
```

**What it does:**
- Scrapes Steam Community Hub pages
- Updates `apps.page_creation_date`

**Duration:** Slow (1.5s per app)

**Rate limit:** Conservative 1 per 1.5 seconds

---

### Trends Calculation

Computes trend metrics from historical data.

```bash
pnpm --filter @publisheriq/ingestion trends-calculate
```

**What it does:**
- Analyzes `review_histogram` data
- Computes 30/90-day trends
- Updates `app_trends` table

**Duration:** ~5-10 minutes

**Rate limit:** None (database operations only)

---

### Priority Calculation

Calculates sync priority scores.

```bash
pnpm --filter @publisheriq/ingestion priority-calculate
```

**What it does:**
- Analyzes activity metrics
- Assigns refresh tiers
- Updates `sync_status` priorities

**Duration:** ~5-10 minutes

**Rate limit:** None (database operations only)

---

### Velocity Calculation (v2.1+)

Calculates review velocity and updates sync tiers.

```bash
pnpm --filter @publisheriq/ingestion calculate-velocity
```

**What it does:**
- Refreshes `review_velocity_stats` materialized view
- Updates `sync_status` with velocity tiers
- Sets dynamic review sync intervals (4/12/24/72 hours)

**Duration:** ~1-2 minutes

**Rate limit:** None (database operations only)

---

### CCU Tiered Sync (v2.2+)

Syncs CCU data for high-priority games (Tier 1 + Tier 2).

```bash
pnpm --filter @publisheriq/ingestion ccu-tiered-sync
```

**What it does:**
- Fetches exact CCU from Steam's GetNumberOfCurrentPlayers API
- Syncs Tier 1 games (top 500 by 7-day peak CCU)
- Syncs Tier 2 games (top 1000 newest releases)
- Stores snapshots in `ccu_snapshots` table
- Updates `daily_metrics.ccu` and `ccu_source`

**Duration:** ~15-30 minutes

**Rate limit:** 1 request per second (Steam API)

**Tier Assignment:**
| Tier | Criteria | Count |
|------|----------|-------|
| Tier 1 | Top 500 by 7-day peak CCU | ~500 |
| Tier 2 | Top 1000 newest releases (past year) | ~1000 |

---

### CCU Daily Sync (v2.2+)

Syncs CCU data for all remaining games (Tier 3).

```bash
# Default (50,000 apps)
pnpm --filter @publisheriq/ingestion ccu-daily-sync

# Custom limit
LIMIT=10000 pnpm --filter @publisheriq/ingestion ccu-daily-sync
```

**What it does:**
- Fetches CCU for Tier 3 games (all others)
- Processes in batches with rate limiting
- Updates `daily_metrics.ccu` and `ccu_source`
- Skips apps with `storefront_accessible = false`

**Duration:** ~3-4 hours for 50k apps

**Rate limit:** 1 request per second (Steam API)

**Environment Variables:**
- `LIMIT` - Maximum apps to sync (default 50000)

---

### Interpolation (v2.1+)

Fills gaps in review delta data with estimated values.

```bash
# Default (30 days)
pnpm --filter @publisheriq/ingestion interpolate-reviews

# Custom range
INTERPOLATION_DAYS=60 pnpm --filter @publisheriq/ingestion interpolate-reviews
```

**What it does:**
- Finds gaps in `review_deltas` table
- Inserts interpolated records (`is_interpolated = TRUE`)
- Linear interpolation between actual sync points

**Duration:** ~5-10 minutes

**Environment Variables:**
- `INTERPOLATION_DAYS` - Days to look back (default 30)

## Environment Variables

Workers respect these environment variables:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Database connection |
| `SUPABASE_SERVICE_KEY` | Database auth |
| `STEAM_API_KEY` | Steam API access |
| `BATCH_SIZE` | Apps per batch (some workers) |
| `MAX_PAGES` | Limit pages (SteamSpy) |
| `GITHUB_RUN_ID` | Job tracking ID |

## Monitoring Progress

### Check Sync Jobs

Query the `sync_jobs` table:

```sql
SELECT job_type, status, items_processed, items_succeeded, items_failed,
       started_at, completed_at
FROM sync_jobs
ORDER BY started_at DESC
LIMIT 10;
```

### Check Sync Status

Query per-app sync times:

```sql
SELECT appid, last_steamspy_sync, last_storefront_sync,
       last_reviews_sync, consecutive_errors
FROM sync_status
WHERE consecutive_errors > 0
ORDER BY consecutive_errors DESC
LIMIT 10;
```

## Running in Background

For long-running syncs:

```bash
# Using nohup
nohup pnpm --filter @publisheriq/ingestion steamspy-sync > steamspy.log 2>&1 &

# Check progress
tail -f steamspy.log
```

## Troubleshooting

### "Module not found"

Build packages first:
```bash
pnpm build
```

### "Rate limited"

Wait for rate limit window to reset. Workers have built-in rate limiting, but external limits still apply.

### "Database connection failed"

Verify environment variables:
```bash
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_KEY
```

### "Timeout" errors

Increase timeout for specific operations or reduce batch size.

## Related Documentation

- [Sync Pipeline](../architecture/sync-pipeline.md) - Data flow details
- [GitHub Actions](../deployment/github-actions.md) - Automated scheduling
- [Troubleshooting](troubleshooting.md) - Common issues
