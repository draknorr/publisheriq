# Data Flow Tracing - PublisherIQ

> Phase 4.3 - Comprehensive data flow documentation for 5 core features
> Generated: January 9, 2026

---

## Table of Contents

1. [Game Discovery (Chat)](#1-game-discovery-chat)
2. [SteamSpy Sync (daily_metrics)](#2-steamspy-sync-daily_metrics)
3. [Publisher/Developer Entity Management](#3-publisherdeveloper-entity-management)
4. [Vector Similarity Search](#4-vector-similarity-search)
5. [CCU Tiered Polling](#5-ccu-tiered-polling)
6. [Validation Gaps & Risks](#6-validation-gaps--risks)

---

## 1. Game Discovery (Chat)

### Flow Diagram

```
User Query ("find top indie games")
         |
         v
+------------------+
| API Route        |
| route.ts         |
| (POST /chat/     |
|  stream)         |
+--------+---------+
         |
         v
+------------------+
| Auth Check       |
| (Supabase)       |
+--------+---------+
         |
         v
+------------------+
| LLM Provider     |
| (OpenAI GPT-4o)  |
+--------+---------+
         |
         | Tool Call: query_analytics
         v
+------------------+
| Tool Executor    |
| executeTool()    |
+--------+---------+
         |
         v
+------------------+
| Cube Executor    |
| executeCubeQuery |
+--------+---------+
         |
         | JWT Auth + POST
         v
+------------------+
| Cube.js Server   |
| (Fly.io)         |
+--------+---------+
         |
         | SQL Generation
         v
+------------------+
| PostgreSQL       |
| (Supabase)       |
+--------+---------+
         |
         | Discovery Cube SQL:
         | SELECT from apps
         | JOIN app_steam_deck
         | JOIN app_trends
         | JOIN latest_daily_metrics
         | JOIN review_velocity_stats
         |
         v
+------------------+
| Format Results   |
| formatResult     |
| WithEntityLinks  |
+--------+---------+
         |
         | Pre-formatted markdown links
         v
+------------------+
| SSE Stream       |
| to Client        |
+------------------+
```

### Key Files Involved

| Step | File | Function |
|------|------|----------|
| API Entry | `apps/admin/src/app/api/chat/stream/route.ts` | `POST()` |
| System Prompt | `apps/admin/src/lib/llm/cube-system-prompt.ts` | `buildCubeSystemPrompt()` |
| Tool Definitions | `apps/admin/src/lib/llm/cube-tools.ts` | `QUERY_ANALYTICS_TOOL` |
| Cube Query | `apps/admin/src/lib/cube-executor.ts` | `executeCubeQuery()` |
| Entity Linking | `apps/admin/src/lib/llm/format-entity-links.ts` | `formatResultWithEntityLinks()` |
| Discovery Cube | `packages/cube/model/Discovery.js` | Discovery cube definition |

### Data Sources

The **Discovery** cube aggregates data from 5 tables:
- `apps` - Core game metadata (name, price, platforms, release date)
- `app_steam_deck` - Steam Deck compatibility status
- `app_trends` - 30-day trend direction and change percentage
- `latest_daily_metrics` - CCU, owners, reviews (materialized view)
- `review_velocity_stats` - 7d/30d review velocity (materialized view)

### Validation Points

1. **Input Validation**: Request body checked for `messages` array
2. **Auth Validation**: Supabase auth check via `createServerClient()`
3. **Credit Check**: Optional credit balance validation if `CREDITS_ENABLED=true`
4. **Rate Limiting**: RPC `check_and_increment_rate_limit` call
5. **Filter Normalization**: SQL operators converted to Cube operators (gte, lte, etc.)
6. **Limit Capping**: Results capped at 100 rows max

### Transformation Steps

1. LLM generates Cube.js query JSON (cube, dimensions, filters, segments, order)
2. `normalizeFilters()` converts SQL-style operators to Cube operators
3. Cube.js generates optimized SQL from cube definitions
4. Results simplified (removes "Discovery." prefix from field names)
5. Application-layer sorting applied (Cube.js doesn't always respect ORDER BY)
6. Entity links pre-formatted: `"name": "[Game](game:123)"`

### Identified Gaps

| Issue | Severity | Description |
|-------|----------|-------------|
| **No schema validation** | Medium | Cube query structure not validated before execution |
| **Silent operator fix** | Low | Invalid operators auto-corrected without warning |
| **NULL handling** | Medium | Some metrics can be NULL, affecting sort order |
| **Retry masking** | Low | Transient errors retried silently, may mask issues |

---

## 2. SteamSpy Sync (daily_metrics)

### Flow Diagram

```
Scheduled Job (GitHub Actions - 02:15 UTC daily)
         |
         v
+------------------+
| steamspy-worker  |
| main()           |
+--------+---------+
         |
         v
+------------------+
| Create sync_job  |
| record           |
+--------+---------+
         |
         v
+------------------+
| fetchAllSteam    |
| SpyApps()        |
| (paginated)      |
+--------+---------+
         |
         | 1 req/60s rate limit
         | ~100 pages
         v
+------------------+
| SteamSpy API     |
| ?request=all&    |
| page=N           |
+--------+---------+
         |
         | Parse owner estimates
         | ("10,000 .. 20,000" -> {min, max})
         v
+------------------+
| processBatch()   |
| Per page         |
+--------+---------+
         |
         | 3 parallel upserts
         v
+-----+-----+------+
| apps| sync | daily|
|     |status|metrics
+-----+-----+------+
         |
         v
+------------------+
| Supplementary    |
| Fetches (1 req/s)|
| For popular apps |
| not in pagination|
+--------+---------+
         |
         v
+------------------+
| Update sync_job  |
| status           |
+------------------+
```

### Key Files Involved

| Step | File | Function |
|------|------|----------|
| Worker | `packages/ingestion/src/workers/steamspy-worker.ts` | `main()` |
| API Client | `packages/ingestion/src/apis/steamspy.ts` | `fetchAllSteamSpyApps()` |
| Owner Parse | `packages/ingestion/src/apis/steamspy.ts` | `parseOwnerEstimate()` |
| Rate Limiter | `packages/ingestion/src/utils/rate-limiter.ts` | Token bucket |

### Data Transformation

| SteamSpy Field | Transformation | Target Column |
|----------------|----------------|---------------|
| `owners` | Parse "X .. Y" -> {min, max} | `owners_min`, `owners_max` |
| `ccu` | Direct | `ccu_peak` |
| `positive`, `negative` | Sum | `total_reviews` |
| `average_forever` | Direct | `average_playtime_forever` |
| `price` | Parse string to int | `price_cents` |

### Database Updates

1. **apps table**: Upserts basic app info (name, is_free, price)
2. **sync_status table**: Updates `last_steamspy_sync`, `steamspy_available`
3. **daily_metrics table**: Upserts metrics with composite key `(appid, metric_date)`

### Validation Points

1. **Empty response detection**: Treats empty JSON as end of pages
2. **Missing name check**: Returns null for apps without name
3. **Owner estimate parsing**: Falls back to {0, 0} if parse fails
4. **Page limit safety**: Stops at page 150 as safety check

### Identified Gaps

| Issue | Severity | Description |
|-------|----------|-------------|
| **No data freshness check** | Medium | Doesn't validate if SteamSpy data is stale |
| **Single-point ownership** | High | Owner estimates are ranges, midpoint not computed here |
| **Missing review score calc** | Medium | `review_score` not calculated during import |
| **Duplicate protection** | Low | Relies on DB unique constraints, no app-level dedup |
| **Tag data ignored** | Low | SteamSpy tags not imported (separate from PICS tags) |

### Downstream Dependencies

```
daily_metrics
     |
     +---> latest_daily_metrics (materialized view, auto-refresh)
     |
     +---> publisher_metrics (materialized view, manual refresh)
     |
     +---> developer_metrics (materialized view, manual refresh)
     |
     +---> Discovery cube (real-time join)
```

---

## 3. Publisher/Developer Entity Management

### Flow Diagram

```
Storefront Sync Worker (6x daily)
         |
         v
+------------------+
| fetchStorefront  |
| AppDetails()     |
+--------+---------+
         |
         | Steam Store API
         v
+------------------+
| Parse Response   |
| extractDev/Pub   |
+--------+---------+
         |
         | developers[], publishers[]
         v
+------------------+
| RPC: upsert_     |
| storefront_app   |
+--------+---------+
         |
         | PostgreSQL Function
         v
+--------+---------+---------+
|        |         |         |
v        v         v         v
apps   developers publishers junction
       (upsert)   (upsert)   tables
+--------+---------+---------+
         |
         | game_count triggers
         v
+------------------+
| Update game_count|
| on dev/pub tables|
+--------+---------+
         |
         | Nightly (05:00 UTC)
         v
+------------------+
| refresh_views    |
| worker           |
+--------+---------+
         |
         v
+--------+---------+
| publisher_metrics|
| developer_metrics|
| (materialized)   |
+------------------+
```

### Key Files Involved

| Step | File | Function |
|------|------|----------|
| Worker | `packages/ingestion/src/workers/storefront-worker.ts` | `processApp()` |
| API Client | `packages/ingestion/src/apis/storefront.ts` | `fetchStorefrontAppDetails()` |
| DB Function | `supabase/migrations/20260105000008_dedupe_storefront_upsert.sql` | `upsert_storefront_app()` |
| View Refresh | `packages/ingestion/src/workers/refresh-views-worker.ts` | `main()` |

### Entity Creation Logic (upsert_storefront_app)

```sql
-- Deduplicate developer names with DISTINCT
WITH valid_names AS (
  SELECT DISTINCT TRIM(dev_name) as name
  FROM unnest(p_developers)
  WHERE dev_name IS NOT NULL AND TRIM(dev_name) != ''
),
dev_upserts AS (
  INSERT INTO developers (name, normalized_name)
  SELECT vn.name, LOWER(vn.name)
  ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
  RETURNING id, name
)
INSERT INTO app_developers (appid, developer_id)
SELECT p_appid, du.id FROM dev_upserts
ON CONFLICT (appid, developer_id) DO NOTHING;
```

### Junction Table Structure

```
app_publishers              app_developers
+--------+-------------+    +--------+-------------+
| appid  | publisher_id|    | appid  | developer_id|
+--------+-------------+    +--------+-------------+
| FK->apps | FK->pubs  |    | FK->apps | FK->devs  |
+--------+-------------+    +--------+-------------+
```

### Materialized View Aggregation (publisher_metrics)

```sql
SELECT
  p.id as publisher_id,
  p.name as publisher_name,
  COUNT(DISTINCT a.appid) as game_count,
  SUM(ldm.owners_midpoint) as total_owners,
  SUM(ldm.ccu_peak) as total_ccu,
  AVG(ldm.positive_percentage) as avg_review_score,
  SUM(ldm.total_reviews) as total_reviews,
  -- Revenue estimate: owners * price * Steam cut (70%)
  SUM(ldm.owners_midpoint * a.current_price_cents * 0.7)::BIGINT as revenue_estimate_cents
FROM publishers p
JOIN app_publishers ap ON p.id = ap.publisher_id
JOIN apps a ON ap.appid = a.appid
LEFT JOIN latest_daily_metrics ldm ON a.appid = ldm.appid
WHERE a.type = 'game'
GROUP BY p.id, p.name
```

### Validation Points

1. **Duplicate name handling**: `DISTINCT` prevents duplicate upsert errors
2. **Empty string filtering**: Filters out NULL and whitespace-only names
3. **Normalized name**: Lowercase version stored for case-insensitive lookups
4. **Parent appid validation**: DLC parent validated to exist before FK insert

### Identified Gaps

| Issue | Severity | Description |
|-------|----------|-------------|
| **Name variations** | High | "Valve" vs "Valve Corporation" not unified |
| **No merge capability** | Medium | Cannot merge duplicate publishers |
| **Stale junction records** | Medium | Old dev/pub associations not cleaned up |
| **game_count drift** | Low | Count may drift from actual junction records |
| **View refresh timing** | Medium | Metrics stale until nightly refresh |

---

## 4. Vector Similarity Search

### Flow Diagram

```
Chat Tool: find_similar
("games like Hades")
         |
         v
+------------------+
| findSimilar()    |
| search-service.ts|
+--------+---------+
         |
         v
+------------------+
| lookupEntity     |
| ByName()         |
| (Supabase query) |
+--------+---------+
         |
         | Get appid from name
         v
+------------------+
| getEntityVector  |
| AndPayload()     |
| (Qdrant retrieve)|
+--------+---------+
         |
         | Get 1536-dim vector
         v
+------------------+
| buildGameFilter()|
| filter-builder.ts|
+--------+---------+
         |
         | Build Qdrant filter
         v
+------------------+
| Qdrant Search    |
| client.search()  |
+--------+---------+
         |
         | Vector similarity (cosine)
         v
+------------------+
| Format Results   |
| (id, name, score)|
+------------------+
```

### Embedding Generation (embedding-worker.ts)

```
Daily Workflow (03:00 UTC)
         |
         v
+------------------+
| get_apps_for_    |
| embedding()      |
| (RPC)            |
+--------+---------+
         |
         | Games not yet embedded
         | or with changed data
         v
+------------------+
| buildGameEmbed   |
| dingText()       |
+--------+---------+
         |
         | "Game: Hades
         |  Genres: Action, Indie, RPG
         |  Tags: Roguelike, ...
         |  Developer: Supergiant
         |  ..."
         v
+------------------+
| OpenAI API       |
| text-embedding-  |
| 3-small          |
+--------+---------+
         |
         | 1536 dimensions
         v
+------------------+
| Qdrant Upsert    |
| (with payload)   |
+--------+---------+
         |
         v
+------------------+
| mark_apps_       |
| embedded()       |
| (update hash)    |
+------------------+
```

### Key Files Involved

| Step | File | Function |
|------|------|----------|
| Search Service | `apps/admin/src/lib/qdrant/search-service.ts` | `findSimilar()` |
| Embedding Worker | `packages/ingestion/src/workers/embedding-worker.ts` | `processGameBatch()` |
| Text Builder | `packages/ingestion/src/apis/embedding.ts` | `buildGameEmbeddingText()` |
| Filter Builder | `packages/qdrant/src/filter-builder.ts` | `buildGameFilter()` |
| Collections | `packages/qdrant/src/collections.ts` | Collection definitions |

### Qdrant Collections

| Collection | Entity | Use Case |
|------------|--------|----------|
| `publisheriq_games` | Games | Find similar games |
| `publisheriq_publishers_portfolio` | Publishers | Match by catalog |
| `publisheriq_publishers_identity` | Publishers | Match by top games |
| `publisheriq_developers_portfolio` | Developers | Match by catalog |
| `publisheriq_developers_identity` | Developers | Match by top games |

### Payload Fields (Games)

```javascript
{
  appid: number,
  name: string,
  type: 'game' | 'dlc' | ...,
  genres: string[],
  tags: string[],           // Top 15 tags
  categories: string[],
  platforms: string[],
  steam_deck: string,
  is_free: boolean,
  price_tier: string,
  price_cents: number,
  review_score: number,
  review_percentage: number,
  total_reviews: number,    // For popularity comparison
  release_year: number,
  developer_ids: number[],
  publisher_ids: number[],
  is_released: boolean,
  is_delisted: boolean,
  embedding_hash: string,   // Change detection
  updated_at: number
}
```

### Change Detection

```javascript
// Hash-based change detection
const text = buildGameEmbeddingText(game);
const hash = hashEmbeddingText(text);  // SHA256

// Only re-embed if hash changed
if (game.embedding_hash !== hash) {
  // Generate new embedding
}
```

### Identified Gaps

| Issue | Severity | Description |
|-------|----------|-------------|
| **Partial match fallback** | Medium | ILIKE `%name%` may return wrong game |
| **Missing embedding error** | Medium | No retry for failed embeddings |
| **Stale embeddings** | Low | Hash-based, but payload data can drift |
| **Publisher/Dev exclusion** | Low | Cannot exclude same publisher/developer |
| **Popularity data lag** | Medium | `total_reviews` from Qdrant may be stale |

---

## 5. CCU Tiered Polling

### Flow Diagram

```
Hourly GitHub Actions
         |
         +--> Hour 0 UTC: recalculate_ccu_tiers()
         |
         v
+------------------+
| ccu-tiered-worker|
| main()           |
+--------+---------+
         |
         v
+------------------+
| Determine tiers  |
| to poll this hour|
+--------+---------+
         |
         | Tier 1: Every hour
         | Tier 2: Even hours only
         v
+------------------+
| getTierGames()   |
| (ccu_tier_       |
| assignments)     |
+--------+---------+
         |
         v
+------------------+
| fetchSteamCCU    |
| Batch()          |
+--------+---------+
         |
         | 1 req/sec rate limit
         | Steam ISteamUserStats API
         v
+------------------+
| insertSnapshots()|
| (ccu_snapshots)  |
+--------+---------+
         |
         v
+------------------+
| updateDaily      |
| MetricsPeak()    |
| (daily_metrics)  |
+------------------+
```

### Tier Calculation (recalculate_ccu_tiers)

```sql
-- Tier 1: Top 500 by 7-day peak CCU
SELECT appid FROM recent_ccu
WHERE recent_peak_ccu > 0
ORDER BY recent_peak_ccu DESC
LIMIT 500;

-- Tier 2: Top 1000 newest releases (not in Tier 1)
SELECT appid FROM release_ranks
WHERE appid NOT IN (SELECT appid FROM tier1_games)
ORDER BY release_rank
LIMIT 1000;

-- Tier 3: Everything else (daily sync only)
```

### Key Files Involved

| Step | File | Function |
|------|------|----------|
| Tiered Worker | `packages/ingestion/src/workers/ccu-tiered-worker.ts` | `main()` |
| Daily Worker | `packages/ingestion/src/workers/ccu-daily-worker.ts` | Tier 3 polling |
| Steam API | `packages/ingestion/src/apis/steam-ccu.ts` | `fetchSteamCCU()` |
| Tier RPC | Migration | `recalculate_ccu_tiers()` |
| Aggregation | Migration | `aggregate_daily_ccu_peaks()` |

### Polling Schedule

| Tier | Criteria | Frequency | Est. Games |
|------|----------|-----------|------------|
| 1 | Top 500 by 7-day peak CCU | Hourly | ~500 |
| 2 | Top 1000 newest releases | Every 2h | ~1000 |
| 3 | All other games | Daily | ~60,000+ |

### Data Storage

```sql
-- ccu_snapshots: Hourly granularity (30-day retention)
CREATE TABLE ccu_snapshots (
  appid INTEGER REFERENCES apps(appid),
  snapshot_time TIMESTAMPTZ DEFAULT NOW(),
  player_count INTEGER,
  ccu_tier SMALLINT,
  UNIQUE(appid, snapshot_time)
);

-- ccu_tier_assignments: Current tier for each game
CREATE TABLE ccu_tier_assignments (
  appid INTEGER PRIMARY KEY,
  ccu_tier SMALLINT DEFAULT 3,
  tier_reason TEXT,           -- 'top_ccu', 'new_release', 'default'
  recent_peak_ccu INTEGER,    -- 7-day max
  release_rank INTEGER
);
```

### Aggregation to daily_metrics

```sql
-- Runs nightly before cleanup
INSERT INTO daily_metrics (appid, metric_date, ccu_peak, ccu_source)
SELECT
  appid,
  target_date,
  MAX(player_count),
  'steam_api'
FROM ccu_snapshots
WHERE snapshot_time >= target_date
  AND snapshot_time < target_date + INTERVAL '1 day'
GROUP BY appid
ON CONFLICT (appid, metric_date) DO UPDATE SET
  ccu_peak = GREATEST(daily_metrics.ccu_peak, EXCLUDED.ccu_peak);
```

### Identified Gaps

| Issue | Severity | Description |
|-------|----------|-------------|
| **Initial tier bootstrap** | Medium | First run may have no tier data |
| **Tier recalc timing** | Low | Only at midnight UTC, not adaptive |
| **Snapshot retention** | Low | 30-day retention may miss long-term trends |
| **Missing games** | Medium | Steam API returns result=42 for invalid apps |
| **Peak vs current** | Low | Snapshots are point-in-time, not true peaks |

---

## 6. Validation Gaps & Risks

### Summary Table

| Feature | Gap | Risk Level | Mitigation |
|---------|-----|------------|------------|
| **Game Discovery** | No Cube query validation | Medium | Add JSON schema validation |
| **Game Discovery** | Silent operator fix | Low | Log warnings for fixed queries |
| **SteamSpy Sync** | Owner estimates are ranges | Medium | Compute midpoint on import |
| **SteamSpy Sync** | No freshness validation | Medium | Check SteamSpy last_update |
| **Entity Management** | No name normalization | High | Implement fuzzy matching/merge |
| **Entity Management** | Stale junction records | Medium | Add cleanup job |
| **Similarity Search** | Partial name match risk | Medium | Use exact match first, partial second |
| **Similarity Search** | Stale payload data | Medium | Sync payload with embedding refresh |
| **CCU Polling** | Missing tier bootstrap | Medium | Run recalc if no tiers exist |
| **CCU Polling** | Point-in-time snapshots | Low | Document limitation |

### Critical Data Integrity Risks

1. **Publisher/Developer Duplicates**: No mechanism to merge "Valve" and "Valve Corporation"
   - Impact: Inflated publisher count, split metrics
   - Recommendation: Implement normalized name index + merge UI

2. **Materialized View Staleness**: Views only refresh at 05:00 UTC
   - Impact: Chat may show outdated publisher/developer metrics
   - Recommendation: Add on-demand refresh capability or increase frequency

3. **SteamSpy Data Gaps**: Not all games in SteamSpy pagination
   - Impact: Missing CCU/owners for ~5% of games
   - Recommendation: Supplementary fetch for high-review games (already implemented)

4. **Embedding Hash Drift**: Payload data can change without re-embedding
   - Impact: Similarity search filters may not match actual game state
   - Recommendation: Periodic full re-sync or payload refresh separate from embedding

### Recommended Actions

| Priority | Action | Effort |
|----------|--------|--------|
| High | Add publisher/developer name normalization | Medium |
| High | Implement query validation for Cube.js | Low |
| Medium | Add materialized view freshness check | Low |
| Medium | Sync Qdrant payload with latest game data | Medium |
| Low | Add tier recalculation trigger on demand | Low |
| Low | Document CCU snapshot limitations | Low |

---

## Appendix: File Reference

### Chat System
- `/apps/admin/src/app/api/chat/stream/route.ts` - SSE streaming endpoint
- `/apps/admin/src/lib/llm/cube-tools.ts` - LLM tool definitions
- `/apps/admin/src/lib/llm/cube-system-prompt.ts` - System prompt with Cube schema
- `/apps/admin/src/lib/cube-executor.ts` - Cube.js query executor
- `/apps/admin/src/lib/llm/format-entity-links.ts` - Entity link pre-formatting

### Sync Workers
- `/packages/ingestion/src/workers/steamspy-worker.ts` - SteamSpy full catalog sync
- `/packages/ingestion/src/workers/storefront-worker.ts` - Steam Store metadata sync
- `/packages/ingestion/src/workers/embedding-worker.ts` - Vector embedding generation
- `/packages/ingestion/src/workers/ccu-tiered-worker.ts` - Tiered CCU polling
- `/packages/ingestion/src/workers/refresh-views-worker.ts` - Materialized view refresh

### API Clients
- `/packages/ingestion/src/apis/steamspy.ts` - SteamSpy API client
- `/packages/ingestion/src/apis/storefront.ts` - Steam Store API client
- `/packages/ingestion/src/apis/steam-ccu.ts` - Steam CCU API client
- `/packages/ingestion/src/apis/embedding.ts` - OpenAI embedding client

### Cube.js Models
- `/packages/cube/model/Discovery.js` - Game discovery cube
- `/packages/cube/model/Publishers.js` - Publisher metrics cubes
- `/packages/cube/model/Developers.js` - Developer metrics cubes

### Qdrant
- `/packages/qdrant/src/collections.ts` - Collection schemas
- `/packages/qdrant/src/filter-builder.ts` - Query filter builder
- `/apps/admin/src/lib/qdrant/search-service.ts` - Similarity search service

### Database
- `/supabase/migrations/20260105000008_dedupe_storefront_upsert.sql` - Entity upsert
- `/supabase/migrations/20260110000003_add_ccu_tiered_tracking.sql` - CCU tier system
