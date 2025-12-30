# Steam Data Acquisition - Implementation Overview

## Architecture

**Stack:** TypeScript monorepo (pnpm) with Supabase (PostgreSQL)

```
publisheriq/
├── apps/admin/          # Next.js 15 admin dashboard + Chat interface
├── packages/database/   # Supabase client & types
├── packages/ingestion/  # API clients & workers
├── packages/shared/     # Constants, logger, utilities
└── supabase/migrations/ # Database schema
```

## Chat Interface

Natural language interface for querying the Steam database. See [Chat Interface Guide](docs/CHAT_INTERFACE.md) for usage.

**Features:**
- Query database using plain English
- Structured responses with markdown tables
- Clickable game links (`[Game Name](game:APPID)` → `/apps/{appid}`)
- SQL syntax highlighting with copy button
- Expandable query details (SQL + reasoning)
- Collapsible long responses

**LLM Providers:**
- **Anthropic:** Claude 3.5 Haiku (default)
- **OpenAI:** GPT-4o-mini (fallback)
- Selection via `LLM_PROVIDER` environment variable

**Security:**
- Read-only queries only (SELECT)
- Dual-layer validation (client + database function)
- 50 row result limit
- 5000 character query limit
- Blocked: INSERT, UPDATE, DELETE, DROP, and 27 other dangerous keywords

## Data Source Hierarchy

```
LAYER 1 - AUTHORITATIVE (100% coverage):
├── Steam IStoreService/GetAppList  → Master list of ALL appIDs (paginated)
├── Steam Storefront API            → developers[], publishers[], release_date, categories
├── Steam Reviews API               → Review counts, sentiment scores
└── Steam Review Histogram          → Monthly +/- reviews for trend analysis

LAYER 2 - ENRICHMENT (80-90% coverage):
└── SteamSpy API                    → CCU, owner estimates, playtime, tags
    ⚠️ NOT authoritative for publishers/developers

LAYER 3 - SCRAPING:
└── Community Hub scraping          → Page creation "Founded" date
```

## GitHub Actions Schedule (UTC)

| Job | Schedule | Batch | Worker |
|-----|----------|-------|--------|
| applist-sync | 00:15 daily | Full | `applist-worker.ts` |
| steamspy-sync | 02:15 daily | 1000/page | `steamspy-worker.ts` |
| histogram-sync | 04:15 daily | 300 | `histogram-worker.ts` |
| storefront-sync | 06, 10, 14, 18, 22 | 200 | `storefront-worker.ts` |
| reviews-sync | 06:30, 10:30, 14:30, 18:30, 22:30 | 200 | `reviews-worker.ts` |
| trends-calculation | 22:00 daily | 500 | `trends-worker.ts` |
| priority-calculation | 22:30 daily | 1000 | `priority-worker.ts` |

## Database Schema (Supabase)

### Enums
```sql
app_type: 'game', 'dlc', 'demo', 'mod', 'video', 'hardware', 'music'
sync_source: 'steamspy', 'storefront', 'reviews', 'histogram', 'scraper'
trend_direction: 'up', 'down', 'stable'
refresh_tier: 'active', 'moderate', 'dormant', 'dead'
```

### Core Tables
```sql
-- Apps (source: GetAppList + Storefront API)
apps (
    appid INTEGER PRIMARY KEY,
    name TEXT,
    type app_type,  -- 'game', 'dlc', 'demo', 'mod', 'video', 'hardware', 'music'
    is_free BOOLEAN,
    release_date DATE,
    page_creation_date DATE,  -- scraped
    has_workshop BOOLEAN,     -- categories contains id:30
    has_developer_info BOOLEAN,  -- TRUE once dev/pub fetched from Storefront API
    current_price_cents INTEGER,
    current_discount_percent INTEGER
)

-- Developers/Publishers (source: Storefront API ONLY)
developers (id, name, normalized_name, game_count, first_game_release_date)
publishers (id, name, normalized_name, game_count, first_game_release_date)

-- Many-to-many junctions
app_developers (appid, developer_id)
app_publishers (appid, publisher_id)
```

### Metrics Tables
```sql
-- Daily snapshots (source: Reviews API + SteamSpy)
daily_metrics (
    appid, metric_date,
    owners_min, owners_max, ccu_peak,
    average_playtime_forever, average_playtime_2weeks,
    total_reviews, positive_reviews, negative_reviews,
    review_score, review_score_desc,
    recent_positive, recent_negative, recent_score_desc,
    price_cents, discount_percent
)

-- Monthly review aggregates (source: Histogram API)
review_histogram (appid, month_start, recommendations_up, recommendations_down)

-- Calculated trends
app_trends (
    appid,
    trend_30d_direction, trend_30d_change_pct,
    trend_90d_direction, trend_90d_change_pct,
    current_positive_ratio, previous_positive_ratio,
    review_velocity_7d, review_velocity_30d
)
```

### Sync Tracking
```sql
sync_status (
    appid,
    last_steamspy_sync, last_storefront_sync, last_reviews_sync,
    last_histogram_sync, last_page_creation_scrape,
    priority_score INTEGER,
    refresh_tier refresh_tier,  -- 'active', 'moderate', 'dormant', 'dead'
    sync_interval_hours INTEGER,
    next_sync_after TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,  -- for dormancy detection
    consecutive_errors INTEGER,
    is_syncable BOOLEAN
)

sync_jobs (id, job_type, status, started_at, completed_at, items_processed, items_succeeded, items_failed)
```

### Database Functions
```sql
-- Safe query execution for chat interface
execute_readonly_query(query_text TEXT) RETURNS JSONB
  -- Validates query starts with SELECT
  -- Blocks dangerous keywords
  -- Returns results as JSONB array

-- Auto-update game counts via triggers
update_developer_game_count()  -- on app_developers INSERT/DELETE
update_publisher_game_count()  -- on app_publishers INSERT/DELETE
```

## Smart Caching Strategy

**Goal:** Reduce daily requests from 70,000 → 2,000-5,000

### Data That Rarely Changes (Fetch Once)
| Data | Strategy |
|------|----------|
| Developer/Publisher names | Fetch once via `has_developer_info` flag |
| Release date | Immutable after release |
| Page creation date | Scrape once, never refresh |
| Workshop support | Check once, refresh monthly |

### Tiered Refresh Schedule
```
active   (CCU>100 OR reviews/day>1)  → 6-12h    (~5,000 apps)
moderate (CCU>0)                     → 24-48h   (~15,000 apps)
dormant  (no activity 90 days)       → Weekly   (~30,000 apps)
dead     (no activity 1 year)        → Monthly  (~20,000 apps)
```

### Priority Scoring (from priority-worker.ts)
```typescript
// CCU-based scoring
CCU > 10,000: +100 pts
CCU > 1,000:  +50 pts
CCU > 100:    +25 pts

// Activity-based scoring
Review velocity > 10/day: +40 pts
Trend change > 10%:       +25 pts

// Penalties
Dead game (CCU=0, velocity<0.1): -50 pts
```

## API Quick Reference

| API | Endpoint | Rate Limit | Data |
|-----|----------|------------|------|
| GetAppList | `api.steampowered.com/IStoreService/GetAppList/v1/` | Needs API key | All appIDs (paginated) |
| Storefront | `store.steampowered.com/api/appdetails/?appids={id}` | 0.67/sec (burst 10) | Dev/Pub/Details |
| Reviews | `store.steampowered.com/appreviews/{appid}?json=1` | 0.33/sec (burst 5) | Counts/Sentiment |
| Histogram | `store.steampowered.com/appreviewhistogram/{appid}` | 1/sec (burst 5) | Monthly trends |
| SteamSpy | `steamspy.com/api.php?request=all&page={n}` | 1/60sec | CCU/Owners/Tags |

## Key Implementation Notes

1. **Publisher/Developer Source**: ONLY use Steam Storefront API `developers[]` and `publishers[]` fields. SteamSpy has gaps.

2. **Workshop Detection**: Check Storefront API `categories` array for `{"id": 30, "description": "Steam Workshop"}`

3. **Trending Calculation**: Use Review Histogram API monthly buckets to calculate 30/90 day trend direction (2% threshold for "stable").

4. **Priority Processing**: Workers use `get_apps_for_sync(source, limit)` function which orders by priority score and prioritizes apps missing developer info.

5. **Page Creation Date**: Only available via scraping `steamcommunity.com/app/{appid}`. Cache forever (immutable).

6. **Rate Limiting**: Token bucket algorithm implemented in `packages/ingestion/src/utils/rate-limiter.ts`

## Environment Variables

```bash
# Database
SUPABASE_URL=         # Supabase project URL
SUPABASE_SERVICE_KEY= # Service role key (full access)

# Steam API
STEAM_API_KEY=        # Steam Web API key

# Chat Interface (choose one provider)
LLM_PROVIDER=anthropic  # 'anthropic' or 'openai'
ANTHROPIC_API_KEY=      # Anthropic API key (for Claude)
OPENAI_API_KEY=         # OpenAI API key (for GPT-4o-mini)
```

## File Locations

| Purpose | Path |
|---------|------|
| API clients | `packages/ingestion/src/apis/` |
| Workers | `packages/ingestion/src/workers/` |
| Rate limiter | `packages/ingestion/src/utils/rate-limiter.ts` |
| Constants | `packages/shared/src/constants.ts` |
| Schema | `supabase/migrations/` |
| Types | `packages/database/src/types.ts` |
| GitHub Actions | `.github/workflows/` |
| Chat page | `apps/admin/src/app/chat/page.tsx` |
| Chat API | `apps/admin/src/app/api/chat/route.ts` |
| Query executor | `apps/admin/src/lib/query-executor.ts` |
| LLM providers | `apps/admin/src/lib/llm/providers/` |
| System prompt | `apps/admin/src/lib/llm/system-prompt.ts` |
| Chat components | `apps/admin/src/components/chat/` |
