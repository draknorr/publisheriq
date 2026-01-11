# Query Pattern Analysis

**Audit Date:** January 9, 2026
**Scope:** Database query patterns across TypeScript workers, Python PICS service, API routes, and Cube.js semantic layer

---

## Executive Summary

The PublisherIQ codebase demonstrates **mature query patterns** with several optimization strategies already in place:
- Heavy use of RPC functions for complex operations
- Batch processing with pagination
- Parallel queries using `Promise.all`
- Use of materialized views for expensive aggregations

However, several **N+1 query problems** and **missing pagination** issues were identified that could impact performance at scale.

---

## 1. N+1 Query Problems Found

### Critical: histogram-worker.ts (Lines 57-68)

**File:** `/Users/ryanbohmann/Desktop/publisheriq/packages/ingestion/src/workers/histogram-worker.ts`

```typescript
// N+1 pattern: Individual upsert per histogram entry in a loop
for (const entry of histogram) {
  const monthStart = entry.monthStart.toISOString().split('T')[0];

  await supabase.from('review_histogram').upsert(
    {
      appid,
      month_start: monthStart,
      recommendations_up: entry.recommendationsUp,
      recommendations_down: entry.recommendationsDown,
    },
    { onConflict: 'appid,month_start' }
  );
}
```

**Impact:** For an app with 36 months of data, this causes 36 individual database round trips per app.

**Recommendation:** Batch the histogram entries and perform a single upsert:
```typescript
const records = histogram.map(entry => ({
  appid,
  month_start: entry.monthStart.toISOString().split('T')[0],
  recommendations_up: entry.recommendationsUp,
  recommendations_down: entry.recommendationsDown,
}));
await supabase.from('review_histogram').upsert(records, { onConflict: 'appid,month_start' });
```

---

### Moderate: steamspy-worker.ts - processSupplementaryFetches (Lines 132-222)

**File:** `/Users/ryanbohmann/Desktop/publisheriq/packages/ingestion/src/workers/steamspy-worker.ts`

```typescript
for (const candidate of candidates) {
  const details = await fetchSteamSpyAppDetails(candidate.appid);
  // Individual upsert per candidate
  await supabase.from('daily_metrics').upsert(...);
  await supabase.from('sync_status').update(...).eq('appid', candidate.appid);
}
```

**Impact:** 2-3 DB calls per candidate. With 100 candidates, this is 200-300 queries.

**Recommendation:** Collect results and batch upsert at the end of the loop.

---

### Moderate: reviews-worker.ts - processApp (Lines 107-152)

**File:** `/Users/ryanbohmann/Desktop/publisheriq/packages/ingestion/src/workers/reviews-worker.ts`

```typescript
// Each processApp call makes 3 sequential upserts
await supabase.from('review_deltas').upsert(...);
await supabase.from('daily_metrics').upsert(...);
await supabase.from('sync_status').update(...).eq('appid', appid);
```

**Impact:** 3 DB round trips per app processed (though this is running with p-limit concurrency of 8).

**Recommendation:** Consider creating an RPC function similar to `upsert_storefront_app` that handles all three operations atomically.

---

### Low: ccu-daily-worker.ts / ccu-tiered-worker.ts (Lines 92-131)

**File:** `/Users/ryanbohmann/Desktop/publisheriq/packages/ingestion/src/workers/ccu-daily-worker.ts`

```typescript
// Queries existing data for each batch in the loop
for (let i = 0; i < entries.length; i += batchSize) {
  const batch = entries.slice(i, i + batchSize);
  const { data: existing } = await supabase
    .from('daily_metrics')
    .select('appid, ccu_peak')
    .in('appid', appids)
    .eq('metric_date', today);
  // ... upsert logic
}
```

**Impact:** Query per batch (100 items). Acceptable pattern but could be optimized.

**Recommendation:** Fetch all existing data in a single query before the loop if dataset size permits.

---

## 2. Over-Fetching Patterns

### `.select()` Without Arguments (Returns All Columns)

Found in multiple sync job creation patterns:

| File | Line | Context |
|------|------|---------|
| `priority-worker.ts` | 134 | Job creation |
| `embedding-worker.ts` | 467 | Job creation |
| `histogram-worker.ts` | 108 | Job creation |
| `steamspy-worker.ts` | 244 | Job creation |
| `reviews-worker.ts` | 184 | Job creation |
| `storefront-worker.ts` | 175 | Job creation |
| ... | ... | 14+ occurrences |

**Pattern:**
```typescript
const { data: job } = await supabase
  .from('sync_jobs')
  .insert({ ... })
  .select()  // Returns all columns when only id is needed
  .single();
```

**Impact:** Low - only occurs once per job, returning ~10 columns when only `id` is used.

**Recommendation:** Specify `.select('id')` for consistency.

---

### SELECT * Patterns

| File | Line | Table | Concern |
|------|------|-------|---------|
| `trends-worker.ts` | 189 | `review_histogram` | Returns all columns when only metrics needed |
| `server.ts` | 66 | `user_profiles` | Returns full profile when checking auth |
| `sync-queries.ts` | Various | `sync_status` | Count queries use `select('*', { count: 'exact', head: true })` |

**Note:** The `{ count: 'exact', head: true }` pattern is actually optimal - it only returns the count, not data.

---

## 3. Missing Pagination Issues

### Critical: insights-queries.ts - getNewestGamesWithCCU (Line 325)

**File:** `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/app/(main)/insights/lib/insights-queries.ts`

```typescript
const { data: apps } = await supabase
  .from('apps')
  .select('appid, name, release_date, is_free')
  .eq('type', 'game')
  .eq('is_released', true)
  .gte('release_date', oneYearAgo.toISOString())
  .not('release_date', 'is', null)
  .order('release_date', { ascending: false })
  .limit(200);  // Hardcoded limit, no offset pagination
```

**Impact:** Returns only 200 newest games. If more are needed for UI pagination, this becomes limiting.

---

### Moderate: insights-queries.ts - CCU Snapshots (Line 661)

```typescript
.select('player_count')
.gte('snapshot_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
.limit(10000)
```

**Impact:** Fetches up to 10,000 rows at once for statistics calculation. Memory concern for large datasets.

---

### Good Pattern: applist-worker.ts (Lines 47-66)

```typescript
while (true) {
  const { data: existingIds } = await supabase
    .from('apps')
    .select('appid')
    .range(from, from + pageSize - 1);  // Proper cursor pagination

  if (existingIds.length < pageSize) break;
  from += pageSize;
}
```

**Note:** This is the correct pattern being used throughout most workers.

---

## 4. Unbounded Query Risks

### Well-Protected Queries

Most large table queries have proper guards:

| Pattern | Usage |
|---------|-------|
| RPC `get_apps_for_sync` | Returns limited batch based on priority |
| RPC `get_apps_for_reviews_sync` | Velocity-based scheduling with limit |
| `.limit()` on all CCU queries | Explicit bounds |
| Cursor-based pagination | Used in PICS service Python code |

### Potential Risk Areas

1. **sync-queries.ts fallback queries**: When RPC functions fail, fallback queries perform multiple count operations:
   ```typescript
   // 9 parallel count queries on sync_status table
   await Promise.all([
     supabase.from('sync_status').select('*', { count: 'exact', head: true })...
     // ... 8 more
   ]);
   ```
   **Impact:** Low - these are count-only queries, not full scans.

2. **Cube.js Discovery cube**: The base SQL scans full `apps` table with multiple LEFT JOINs:
   ```sql
   FROM apps a
   LEFT JOIN app_steam_deck asd ON a.appid = asd.appid
   LEFT JOIN app_trends at ON a.appid = at.appid
   LEFT JOIN latest_daily_metrics ldm ON a.appid = ldm.appid
   LEFT JOIN review_velocity_stats rvs ON a.appid = rvs.appid
   WHERE a.type = 'game' AND a.is_delisted = false
   ```
   **Impact:** Mitigated by Cube.js pre-aggregations and caching (6-hour refresh).

---

## 5. Raw SQL vs ORM Usage Breakdown

### Supabase Query Builder (Primary)

Used extensively throughout the codebase:

| Pattern | Count | Example |
|---------|-------|---------|
| `.from().select()` | 100+ | Data fetching |
| `.from().upsert()` | 30+ | Batch inserts |
| `.from().update().eq()` | 25+ | Targeted updates |
| `.from().delete().eq()` | 8 | Relationship cleanup |
| `.rpc()` | 22 | Stored procedures |

### RPC Functions (Stored Procedures)

**Total:** 22 distinct RPC calls found

| Function | Worker/File | Purpose |
|----------|-------------|---------|
| `get_apps_for_sync` | storefront, histogram, scraper | Priority-based sync scheduling |
| `get_apps_for_sync_partitioned` | storefront | Parallel initial sync |
| `get_apps_for_reviews_sync` | reviews | Velocity-based scheduling |
| `get_apps_for_embedding` | embedding | Embedding status filtering |
| `get_publishers_needing_embedding` | embedding | Hash-based change detection |
| `get_developers_needing_embedding` | embedding | Hash-based change detection |
| `mark_apps_embedded` | embedding | Batch status update |
| `mark_publishers_embedded` | embedding | Batch status update |
| `mark_developers_embedded` | embedding | Batch status update |
| `upsert_storefront_app` | storefront | Single-call upsert (7-11 ops -> 1) |
| `upsert_franchise` | PICS | Franchise creation |
| `batch_update_prices` | price-sync | Price batch updates |
| `recalculate_ccu_tiers` | ccu-tiered | Tier assignment |
| `refresh_materialized_view` | refresh-views | View refresh |
| `refresh_review_velocity_stats` | velocity-calculator | Velocity refresh |
| `update_review_velocity_tiers` | velocity-calculator | Tier updates |
| `interpolate_all_review_deltas` | interpolation | Delta interpolation |
| `get_priority_distribution` | sync-queries | Dashboard stats |
| `get_queue_status` | sync-queries | Dashboard stats |
| `get_source_completion_stats` | sync-queries | Dashboard stats |
| `get_pics_data_stats` | sync-queries | PICS stats |
| `get_steamspy_individual_fetch_candidates` | steamspy | Candidate selection |

### Cube.js (Semantic Layer)

**Total:** 9 cube definitions

| Cube | Data Source | Query Type |
|------|-------------|------------|
| `Discovery` | Pre-joined view | Complex analytics |
| `PublisherMetrics` | Materialized view | Aggregations |
| `PublisherYearMetrics` | Regular view | Time-based |
| `PublisherGameMetrics` | Regular view | Per-game |
| `DeveloperMetrics` | Materialized view | Aggregations |
| `DeveloperYearMetrics` | Regular view | Time-based |
| `DeveloperGameMetrics` | Regular view | Per-game |
| `ReviewVelocity` | Materialized view | Velocity metrics |
| `ReviewDeltas` | Table | Delta tracking |

---

## 6. Transaction Handling Assessment

### Current State: No Explicit Transactions

The codebase **does not use explicit transaction management**. Supabase's PostgREST API doesn't support multi-statement transactions directly.

### Transaction-like Patterns Found

1. **RPC Functions (Atomic):**
   - `upsert_storefront_app` - Handles app + developer + publisher + sync status atomically
   - `batch_update_prices` - Atomic price updates

2. **Sequential Dependent Operations (Non-Atomic):**

   **reviews-worker.ts:**
   ```typescript
   await supabase.from('review_deltas').upsert(...);
   await supabase.from('daily_metrics').upsert(...);  // If this fails, review_deltas already written
   await supabase.from('sync_status').update(...);
   ```

3. **Delete + Insert Patterns (Non-Atomic):**

   **PICS operations.py:**
   ```python
   # Delete existing then insert - if insert fails, data is lost
   self._db.client.table("app_categories").delete().eq("appid", appid).execute()
   # ... build records ...
   self._db.client.table("app_categories").insert(records).execute()
   ```

### Risk Areas

| Operation | Risk Level | Impact |
|-----------|------------|--------|
| Storefront sync | Low | Uses RPC for atomicity |
| Reviews sync | Medium | Partial writes possible |
| PICS relationship sync | High | Delete+Insert not atomic |
| Embedding sync | Low | Idempotent operations |

### Recommendations

1. **Convert reviews sync to RPC** - Single atomic operation like storefront
2. **PICS delete+insert pattern** - Consider using UPSERT with proper ON CONFLICT
3. **Add retry logic** - Already present in cube-executor.ts, extend to workers

---

## 7. Python PICS Service Analysis

**File:** `/Users/ryanbohmann/Desktop/publisheriq/services/pics-service/src/database/operations.py`

### Positive Patterns

1. **Cursor-based Pagination:**
   ```python
   def _get_unsynced_app_ids_paginated(self) -> List[int]:
       while True:
           result = self._db.client.table("sync_status")
               .select("appid")
               .is_("last_pics_sync", "null")
               .gt("appid", last_appid)  # Cursor
               .order("appid")
               .limit(page_size)
               .execute()
   ```

2. **Batch Upserts (500 records):**
   ```python
   UPSERT_BATCH_SIZE = 500

   for i in range(0, len(app_records), self.UPSERT_BATCH_SIZE):
       batch = app_records[i : i + self.UPSERT_BATCH_SIZE]
       self._db.client.table("apps").upsert(batch, on_conflict="appid").execute()
   ```

3. **Existence Check Before Processing:**
   ```python
   existing_appids = set(self._get_existing_appids(all_appids))
   apps_to_process = [app for app in apps if app.appid in existing_appids]
   ```

### N+1 Patterns in Python

**_sync_relationships method (Lines 345-384):**
```python
for app in apps:
    if app.steam_deck:
        self._upsert_steam_deck(app.appid, app.steam_deck)  # 1 query
    if app.categories:
        self._sync_categories(app.appid, app.categories)    # 3 queries (delete, upsert lookup, insert)
    if app.genres:
        self._sync_genres(app.appid, app.genres)            # 3 queries
    if app.store_tags:
        self._sync_store_tags(app.appid, app.store_tags)    # 3 queries
    for franchise in franchises:
        self._upsert_franchise_link(app.appid, franchise.name)  # 2 queries per franchise
```

**Impact:** Up to 12+ queries per app for relationship syncing.

**Recommendation:** Batch relationship syncing across all apps before commit.

---

## 8. Summary of Findings

### Severity Matrix

| Issue | Severity | Files Affected | Estimated Impact |
|-------|----------|----------------|------------------|
| N+1 in histogram-worker | High | 1 | 36x queries per app |
| N+1 in PICS relationships | High | 1 | 12+ queries per app |
| N+1 in reviews-worker | Medium | 1 | 3x queries per app |
| N+1 in steamspy supplementary | Medium | 1 | 200-300 queries |
| Missing transactions | Medium | 3 | Data inconsistency risk |
| Over-fetching in job creation | Low | 14+ | Minimal overhead |

### Optimization Priority

1. **Immediate:** Batch histogram upserts in histogram-worker.ts
2. **High:** Consolidate PICS relationship syncing to batched operations
3. **Medium:** Create RPC for reviews-worker like storefront-worker
4. **Low:** Add explicit column selection to job creation queries

### Positive Patterns to Maintain

- Extensive use of RPC functions for complex operations
- Cursor-based pagination in large dataset handling
- Parallel query execution with `Promise.all`
- Pre-aggregations in Cube.js for expensive queries
- Materialized views for aggregation caching

---

## Appendix: File Locations Reference

| Category | File Path |
|----------|-----------|
| Workers | `/Users/ryanbohmann/Desktop/publisheriq/packages/ingestion/src/workers/` |
| API Routes | `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/app/api/` |
| Sync Queries | `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/lib/sync-queries.ts` |
| PICS Service | `/Users/ryanbohmann/Desktop/publisheriq/services/pics-service/src/database/operations.py` |
| Cube.js Models | `/Users/ryanbohmann/Desktop/publisheriq/packages/cube/model/` |
| Insights Queries | `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/app/(main)/insights/lib/insights-queries.ts` |
