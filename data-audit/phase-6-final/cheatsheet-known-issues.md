# Known Issues Cheatsheet
## Things to Know When Working on PublisherIQ

---

## Critical Security Issues (Fix Before Production)

| Issue | Location | Quick Fix |
|-------|----------|-----------|
| Waitlist readable by anyone | `waitlist` RLS | Change policy to filter by email |
| Chat logs readable by anyone | `chat_query_logs` RLS | Add user_id filter |
| Anon can DELETE sensitive tables | Grants on user tables | Revoke DELETE, TRUNCATE |

---

## Data Quality Gotchas

### Corrupt Data
| Issue | Examples | Workaround |
|-------|----------|------------|
| 15 games have insane prices | ELDEN RING: $599K | Filter `current_price_cents > 50000` |
| 32 apps have empty names | Various appids | Check `name = ''` |
| 149 apps have whitespace in names | Leading/trailing spaces | Use `TRIM(name)` |
| 2,904 apps have year 9998/6969 dates | Placeholder release dates | Filter `release_date < '2030-01-01'` |

### Duplicates
| Entity | Count | Pattern |
|--------|-------|---------|
| Publishers | 807 groups | Case variants: "Valve" vs "VALVE" |
| Developers | 983 groups | Case variants |
| Franchises | 130 groups | Case variants |

**When querying publishers/developers:** Use `LOWER(name)` for matching or the `normalized_name` column.

### Missing Data
| Issue | Count | Notes |
|-------|-------|-------|
| Games without publishers | 1,218 | Need storefront re-sync |
| Games without release dates | 402 | `is_released=true` but `release_date IS NULL` |
| Entities without embeddings | 374 | Embedding sync pending |

---

## Performance Pitfalls

### N+1 Query Patterns (Avoid These)
```typescript
// BAD: Loop with individual queries
for (const entry of histogram) {
  await supabase.from('review_histogram').upsert(entry);
}

// GOOD: Batch upsert
await supabase.from('review_histogram').upsert(allEntries);
```

**Known N+1 locations:**
- `histogram-worker.ts:57` - 36 queries per app
- `operations.py` (PICS) - 12+ queries per app
- `reviews-worker.ts:107` - 3 queries per app

### Unbounded Queries (Add LIMIT)
```sql
-- BAD
SELECT * FROM daily_metrics WHERE appid = 123;

-- GOOD
SELECT * FROM daily_metrics
WHERE appid = 123
ORDER BY metric_date DESC
LIMIT 30;
```

### Stale Materialized Views
Views refresh at 05:00 UTC only. Can be up to 24h stale.

```sql
-- Force refresh if needed
REFRESH MATERIALIZED VIEW CONCURRENTLY publisher_metrics;
```

---

## Schema Quirks

### Dead Columns (Never Populated)
| Table | Columns | Safe to ignore |
|-------|---------|----------------|
| `daily_metrics` | `recent_total_reviews`, `recent_positive`, `recent_negative`, `recent_score_desc` | Yes |
| `apps` | `page_creation_date`, `page_creation_date_raw` | Yes |
| `publishers/developers` | `steam_vanity_url`, `first_page_creation_date` | Yes |

### Intentionally Missing FKs
| Table | Reason |
|-------|--------|
| `app_dlc.parent_appid` | DLC discovered before parent app |
| `app_dlc.dlc_appid` | Same reason |

### Special Tables
| Table | Notes |
|-------|-------|
| `pics_sync_state` | Always exactly 1 row |
| `dashboard_stats_cache` | Always exactly 1 row (id='main') |

---

## Sync Job Issues

### Stuck Jobs
184 jobs currently stuck in "running" status. Check before trusting job counts:

```sql
SELECT * FROM sync_jobs
WHERE status = 'running'
AND started_at < NOW() - INTERVAL '2 hours';
```

### Job Types
| Job Type | Schedule | Notes |
|----------|----------|-------|
| storefront | 5x daily | ~1h per partition |
| reviews | After storefront | Velocity-based |
| steamspy | Daily 02:15 | Paginated bulk |
| histogram | Daily 04:15 | Slow (N+1 issue) |
| ccu | Hourly | Tiered polling |
| embedding | Daily 03:00 | OpenAI rate limited |
| priority | Daily 22:30 | Depends on all other syncs |

### High Failure Rates
| Job Type | Failure Rate | Reason |
|----------|--------------|--------|
| priority | 63% | Unknown |
| steamspy | 47% | Rate limiting |

---

## Authentication Notes

### Service Key vs Anon Key
- **SUPABASE_SERVICE_KEY**: Bypasses RLS, server-side only
- **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Client-side, RLS applies

**Never use service key in:**
- Client-side code
- Browser-accessible endpoints
- Logged output

### Auth Flow
Uses Supabase magic link (passwordless). No passwords stored.

The `AUTH_PASSWORD` env var is legacy and should be removed.

---

## Cube.js Notes

### Pre-aggregations
Scheduled refresh is currently DISABLED (`scheduledRefreshTimer: false`).

### Cubes Exposed to LLM
- Discovery, PublisherMetrics, DeveloperMetrics
- PublisherGameMetrics, DeveloperGameMetrics
- PublisherYearMetrics, DeveloperYearMetrics
- DailyMetrics, LatestMetrics
- ReviewVelocity, ReviewDeltas

### Cubes for Internal Use Only
- Apps, SyncJobs, SyncStatus, PicsSyncState

---

## Quick Fixes Reference

```sql
-- Fix stuck jobs
UPDATE sync_jobs SET status = 'failed'
WHERE status = 'running'
AND started_at < NOW() - INTERVAL '24 hours';

-- Trim whitespace
UPDATE apps SET name = TRIM(name) WHERE name != TRIM(name);

-- Refresh all views
SELECT refresh_all_metrics_views();

-- Check for orphans
SELECT COUNT(*) FROM app_publishers ap
WHERE NOT EXISTS (SELECT 1 FROM apps a WHERE a.appid = ap.appid);
-- Should return 0
```

---

## Environment Variables

### Required for Workers
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `STEAM_API_KEY` (for applist)

### Required for Admin Dashboard
- Above plus: `OPENAI_API_KEY`, `CUBE_API_URL`, `CUBE_API_SECRET`, `QDRANT_URL`, `QDRANT_API_KEY`

### Feature Flags
| Flag | Default | Effect |
|------|---------|--------|
| `USE_CUBE_CHAT` | true | Enable Cube.js chat mode |
| `LLM_PROVIDER` | openai | "openai" or "anthropic" |
| `CREDITS_ENABLED` | false | Enable credit system |
