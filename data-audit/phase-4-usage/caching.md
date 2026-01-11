# Caching Analysis - PublisherIQ

## Summary

PublisherIQ implements caching at multiple layers with varying strategies. The analysis reveals **appropriate conservative caching** for a data-intensive application, with some opportunities for improvement and a few potential risks.

**Overall Assessment:** Good - Caching is well-designed with appropriate TTLs for data freshness requirements.

---

## 1. Cache Inventory

### 1.1 Application-Level Caches

| Cache | Location | Type | TTL | Size Bound |
|-------|----------|------|-----|------------|
| Admin Dashboard Cache | `apps/admin/src/lib/admin-dashboard-cache.ts` | Module-level variable | 30 seconds | 1 object |
| Tag/Genre/Category Cache | `apps/admin/src/lib/search/tag-lookup.ts` | Module-level variable | 1 hour | ~1000 strings |
| Cube.js JWT Token Cache | `packages/cube/src/client.ts` | Class instance variable | 59 minutes (refresh at 60s before expiry) | 1 token |
| PICS Tag Name Cache | `services/pics-service/src/database/operations.py` | Class-level dictionary | Forever (process lifetime) | ~500 entries |

### 1.2 Singleton/Connection Caches

| Singleton | Location | Purpose | Lifetime |
|-----------|----------|---------|----------|
| Supabase Client | `apps/admin/src/lib/supabase.ts` | Connection pooling | Process lifetime |
| Supabase Service Client | `packages/database/src/client.ts` | Server-side operations | Process lifetime |
| Qdrant Client | `packages/qdrant/src/client.ts` | Vector DB connection | Process lifetime |

### 1.3 Rate Limiter State (In-Memory)

| Limiter | Location | Data Stored |
|---------|----------|-------------|
| Token Bucket Limiters | `packages/ingestion/src/utils/rate-limiter.ts` | Token count, last refill time, queue |

**Limiters defined:**
- `steamspyGeneral`: 1 req/sec, burst 1
- `steamspyAll`: 1 req/60sec, burst 1
- `storefront`: 0.33 req/sec, burst 3
- `reviews`: 1 req/sec, burst 10
- `histogram`: 1 req/sec, burst 5
- `communityScrape`: 0.67 req/sec, burst 1
- `steamCCU`: 1 req/sec, burst 5

### 1.4 Cube.js Caching

| Cache Type | Configuration | Location |
|------------|---------------|----------|
| Query Cache | In-memory (`cacheAndQueueDriver: 'memory'`) | `packages/cube/cube.js` |
| Pre-aggregations | PostgreSQL schema `cube_pre_aggs` | Discovery cube only |
| Scheduled Refresh | **Disabled** (`scheduledRefreshTimer: false`) | `packages/cube/cube.js` |

**Pre-aggregation Configuration (Discovery cube):**
```javascript
preAggregations: {
  discoveryList: {
    refreshKey: { every: '6 hours' }
  },
  countsByFilters: {
    refreshKey: { every: '6 hours' }
  },
  pricingBreakdown: {
    refreshKey: { every: '6 hours' }
  }
}
```

### 1.5 Database-Level Caching

| Cache | Table | Refresh Method |
|-------|-------|----------------|
| Dashboard Stats | `dashboard_stats_cache` | Manual/scheduled |
| Latest Metrics | `latest_daily_metrics` (materialized view) | Auto-refresh on daily_metrics update |
| Publisher Metrics | `publisher_metrics` (materialized view) | Manual: `REFRESH MATERIALIZED VIEW CONCURRENTLY` |
| Developer Metrics | `developer_metrics` (materialized view) | Manual: `REFRESH MATERIALIZED VIEW CONCURRENTLY` |
| Review Velocity Stats | `review_velocity_stats` (materialized view) | Daily via `refresh_mat_views()` |

---

## 2. Cache Invalidation Strategies

### 2.1 Time-Based Invalidation (TTL)

| Cache | Strategy | TTL |
|-------|----------|-----|
| Admin Dashboard | Simple timestamp check | 30 seconds |
| Tag Lookup | Simple timestamp check | 1 hour |
| Cube.js JWT | Refresh 60s before expiry | ~59 minutes |
| Cube Pre-aggregations | Automatic by Cube.js | 6 hours |

### 2.2 Manual Invalidation

| Cache | Invalidation Method | When Called |
|-------|---------------------|-------------|
| Admin Dashboard | `invalidateDashboardCache()` | Exported but not currently used |
| Qdrant Client | `resetClient()` | Testing only |

### 2.3 Process Restart Invalidation

All in-memory caches (Vercel serverless functions) are naturally invalidated on:
- New deployment
- Cold start (after ~15 min inactivity)
- Instance scaling

---

## 3. Stale Cache Risks

### 3.1 Low Risk

| Cache | Staleness Impact | Mitigation |
|-------|------------------|------------|
| Tag/Genre/Category | Tags rarely change | 1-hour TTL is appropriate |
| Admin Dashboard | Operational data | 30-second TTL is very fresh |
| Dashboard Stats Cache | Count approximations | Acceptable for dashboard display |

### 3.2 Medium Risk

| Risk | Description | Current State | Recommendation |
|------|-------------|---------------|----------------|
| **PICS Tag Cache** | Never refreshed during process lifetime | Could miss new tags | Consider adding periodic refresh for long-running PICS service |
| **Cube Pre-aggregations** | 6-hour refresh with scheduled refresh disabled | Pre-aggregations may not refresh automatically | Enable `scheduledRefreshTimer` or implement manual refresh |
| **Materialized Views** | Manual refresh only | Could show stale publisher/developer metrics | Currently refreshed daily via `refresh_mat_views()` worker |

### 3.3 High Risk

**None identified** - The application appropriately uses short TTLs and force-dynamic rendering for user-facing data.

---

## 4. Missing Caching Opportunities

### 4.1 High Impact Opportunities

| Opportunity | Current Behavior | Potential Benefit |
|-------------|------------------|-------------------|
| **Similarity API Results** | No caching - queries Qdrant on every request | Cache popular entity similarity results for 5-10 minutes |
| **Publisher/Developer Detail Pages** | Fresh DB query every request | Consider short-term caching (30-60s) for heavy aggregation queries |
| **Game Search Results** | Fresh DB query every request | Cache common search patterns |

### 4.2 Medium Impact Opportunities

| Opportunity | Current Behavior | Potential Benefit |
|-------------|------------------|-------------------|
| **Steam Tag Name Lookups** | Cached in PICS service only | Share cache across Next.js instances |
| **Cube.js Meta Endpoint** | No caching visible | Cache schema metadata (changes rarely) |
| **Entity Link Formatting** | Computed on every message | Minimal impact, but could memoize |

### 4.3 Low Impact (Not Recommended)

| Opportunity | Why Not Recommended |
|-------------|---------------------|
| User-specific data | Should not be cached globally (security) |
| Chat responses | Each query is unique |
| Sync job status | Needs real-time accuracy |

---

## 5. Over-Caching Issues

### 5.1 Memory Concerns

| Cache | Memory Risk | Assessment |
|-------|-------------|------------|
| Admin Dashboard | Single object | **Safe** |
| Tag Lookup | ~1000 strings | **Safe** (~100KB) |
| Rate Limiters | Minimal state | **Safe** |
| Singletons | Connection objects | **Safe** |

### 5.2 Unbounded Cache Risks

**None found** - All caches are either:
- Fixed size (single object)
- Naturally bounded (tags/genres/categories are finite)
- Reset on process restart (Vercel serverless)

### 5.3 Stale While Revalidate Issues

**Not applicable** - The codebase does not use stale-while-revalidate patterns.

---

## 6. Next.js Caching Configuration

### 6.1 Dynamic Rendering

All data pages use `export const dynamic = 'force-dynamic'`:

```
apps/admin/src/app/(main)/developers/page.tsx
apps/admin/src/app/(main)/insights/page.tsx
apps/admin/src/app/(main)/admin/page.tsx
apps/admin/src/app/(main)/chat/page.tsx
apps/admin/src/app/(main)/publishers/page.tsx
apps/admin/src/app/(main)/developers/[id]/page.tsx
apps/admin/src/app/(main)/dashboard/page.tsx
apps/admin/src/app/(main)/apps/page.tsx
apps/admin/src/app/(main)/publishers/[id]/page.tsx
apps/admin/src/app/(main)/account/page.tsx
apps/admin/src/app/(main)/apps/[appid]/page.tsx
apps/admin/src/app/(main)/admin/users/page.tsx
apps/admin/src/app/(main)/admin/usage/page.tsx
apps/admin/src/app/(main)/admin/waitlist/page.tsx
apps/admin/src/app/api/similarity/route.ts
```

**Assessment:** Appropriate for a data-heavy application where freshness matters.

### 6.2 Missing Next.js Caching Features

| Feature | Status | Recommendation |
|---------|--------|----------------|
| `revalidate` exports | Not used | Could add to rarely-changing pages |
| `unstable_cache` | Not used | Could wrap expensive computations |
| `cache: 'force-cache'` in fetch | Not used | Not needed with `force-dynamic` |

---

## 7. Cube.js Caching Analysis

### 7.1 Current Configuration

```javascript
// packages/cube/cube.js
module.exports = {
  cacheAndQueueDriver: 'memory',  // In-memory query caching
  scheduledRefreshTimer: false,    // Pre-aggregation refresh DISABLED
  preAggregationsSchema: 'cube_pre_aggs',
};
```

### 7.2 Pre-aggregation Status

**Discovery Cube** has pre-aggregations defined:
- `discoveryList` - Main game discovery data
- `countsByFilters` - Filter UI counts
- `pricingBreakdown` - Free vs paid stats

**Other Cubes** (Publishers, Developers, DailyMetrics, etc.) have **no pre-aggregations**.

### 7.3 Recommendations

1. **Enable Scheduled Refresh**: Set `scheduledRefreshTimer: 60` (seconds) to automatically refresh pre-aggregations
2. **Add Pre-aggregations to Heavy Cubes**: PublisherMetrics, DeveloperMetrics queries would benefit
3. **Consider Redis Cache**: For production scale, switch from memory to Redis cache driver

---

## 8. Recommendations Summary

### 8.1 High Priority

| Recommendation | Impact | Effort |
|----------------|--------|--------|
| Enable Cube.js scheduled refresh | Ensures pre-aggregations stay fresh | Low |
| Add similarity result caching | Reduces Qdrant load, improves latency | Medium |

### 8.2 Medium Priority

| Recommendation | Impact | Effort |
|----------------|--------|--------|
| Add PICS tag cache refresh timer | Prevents stale tags in long-running service | Low |
| Consider Redis for Cube.js cache | Better cache persistence across restarts | Medium |
| Add pre-aggregations to Publisher/Developer cubes | Faster analytics queries | Medium |

### 8.3 Low Priority (Future Consideration)

| Recommendation | Impact | Effort |
|----------------|--------|--------|
| Implement stale-while-revalidate for dashboard | Slightly faster perceived load | Medium |
| Add common search result caching | Benefit depends on usage patterns | High |

---

## 9. Cache Flow Diagrams

### 9.1 Admin Dashboard Request

```
Request -> Check admin-dashboard-cache (30s TTL)
        -> If cache hit: Return cached data
        -> If cache miss:
           -> Query Supabase (11+ parallel queries)
           -> Store in cache
           -> Return data
```

### 9.2 Chat Query Request

```
Request -> LLM processes query
        -> Tool calls (no caching):
           -> query_analytics -> Cube.js (in-memory cache + pre-aggs)
           -> find_similar -> Qdrant (no cache)
           -> lookup_* -> Supabase direct queries
        -> Format response with entity links
        -> Return streamed response
```

### 9.3 Tag Lookup Request

```
Request -> Check tag cache (1h TTL)
        -> If cache hit: Filter in-memory
        -> If cache miss:
           -> Query Supabase for tags, genres, categories
           -> Store in cache
           -> Filter in-memory
        -> Return matches
```

---

## 10. Appendix: Code References

### Admin Dashboard Cache
```typescript
// apps/admin/src/lib/admin-dashboard-cache.ts
const CACHE_TTL_MS = 30 * 1000; // 30 seconds
let dashboardCache: DashboardCache | null = null;
```

### Tag Lookup Cache
```typescript
// apps/admin/src/lib/search/tag-lookup.ts
let tagCache: TagCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
```

### Cube.js Configuration
```javascript
// packages/cube/cube.js
module.exports = {
  cacheAndQueueDriver: 'memory',
  scheduledRefreshTimer: false,
  preAggregationsSchema: 'cube_pre_aggs',
};
```

### PICS Tag Cache
```python
# services/pics-service/src/database/operations.py
class PICSDatabase:
    _tag_name_cache: Dict[int, str] = {}  # Class-level cache, never expires
```
