# CLAUDE.md - PublisherIQ

> Steam data analytics platform with AI chat interface. Next.js 15 + Supabase + Cube.js + Qdrant. Last updated: February 5, 2026.

## When Uncertain, Ask

**Don't assume - ask questions using AskUserQuestion with clear options.**

Ask before:
- Choosing between multiple valid implementation approaches
- Making architectural decisions (new files, patterns, dependencies)
- Changing existing behavior that might be intentional
- Any destructive or hard-to-reverse operations

**Always provide 2-4 concrete options** with brief explanations of trade-offs.

---

## Database Safety Rules

**NEVER apply database changes automatically, even if auto-accept is enabled.**

Before ANY write operation, STOP and explain:
1. What will change (tables, columns, indexes, data)
2. Why the change is needed
3. Risk level (low/medium/high)
4. Rollback plan

**Requires explicit approval:**
- `supabase db push` / `supabase migration up`
- `ALTER TABLE`, `DROP`, `CREATE TABLE`, `TRUNCATE`
- `INSERT`, `UPDATE`, `DELETE` on production data

**Always safe (no approval needed):**
- `SELECT` queries, `supabase db dump`, `supabase migration list`

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router), React 19, TailwindCSS |
| Database | Supabase (PostgreSQL) |
| Semantic Layer | Cube.js (Fly.io) - 27 cubes across 9 model files |
| Vector DB | Qdrant Cloud (512-dim, int8 quantization) |
| Embeddings | OpenAI text-embedding-3-small (512 dims) |
| AI Chat | OpenAI `gpt-4o-mini` (default) with 9 tool-use functions |
| Workers | GitHub Actions (scheduled) |
| PICS Service | Python + SteamKit2 (Railway) |
| Deployment | Vercel (dashboard), Railway (PICS), Fly.io (Cube.js) |

---

## Key Commands

```bash
# Install & build
pnpm install
pnpm build                    # Build all packages
pnpm check-types              # TypeScript type checking

# Local development
pnpm --filter admin dev       # Dashboard on http://localhost:3001

# Database types
pnpm --filter database generate

# Sync workers (correct script names from package.json)
pnpm --filter @publisheriq/ingestion applist-sync
pnpm --filter @publisheriq/ingestion steamspy-sync
pnpm --filter @publisheriq/ingestion storefront-sync
pnpm --filter @publisheriq/ingestion reviews-sync
pnpm --filter @publisheriq/ingestion histogram-sync
pnpm --filter @publisheriq/ingestion calculate-trends      # NOT "trends-calculate"
pnpm --filter @publisheriq/ingestion update-priorities      # NOT "priority-calculate"
pnpm --filter @publisheriq/ingestion embedding-sync
pnpm --filter @publisheriq/ingestion price-sync
pnpm --filter @publisheriq/ingestion ccu-tiered-sync
pnpm --filter @publisheriq/ingestion ccu-daily-sync
pnpm --filter @publisheriq/ingestion calculate-velocity
pnpm --filter @publisheriq/ingestion interpolate-reviews
pnpm --filter @publisheriq/ingestion refresh-views
pnpm --filter @publisheriq/ingestion alert-detection
```

**No test suite exists.** Verification is `pnpm build` + `pnpm check-types`.

**Hot reload:** Next.js Fast Refresh auto-reloads components, styles, API routes.
**Requires restart:** Changes to `.env.local`, `next.config.js`, or `tsconfig.json`.

---

## Monorepo Structure

```
publisheriq/
├── apps/
│   └── admin/                        # Next.js 15 dashboard
│       ├── src/app/
│       │   ├── (auth)/               # Login page
│       │   ├── (main)/               # Authenticated routes
│       │   │   ├── account/           # User account settings
│       │   │   ├── admin/             # Admin panel (users, waitlist, usage, chat-smoke)
│       │   │   ├── apps/              # Games page - discovery & analytics
│       │   │   │   ├── components/    # Table, filters, ActiveFilterBar, command-palette/
│       │   │   │   ├── hooks/         # useAppsFilters, useCommandPalette, etc.
│       │   │   │   └── lib/           # filter-registry.ts, filter-syntax-parser.ts
│       │   │   ├── chat/              # AI chat interface
│       │   │   ├── companies/         # Publishers/developers analytics
│       │   │   │   ├── components/    # Table, filters, ActiveFilterBar, command-palette/
│       │   │   │   ├── hooks/         # useCompaniesFilters, useCommandPalette, etc.
│       │   │   │   └── lib/           # filter-registry.ts, filter-syntax-parser.ts
│       │   │   ├── dashboard/         # Main dashboard
│       │   │   ├── developers/[id]/   # Developer detail pages
│       │   │   ├── insights/          # CCU analytics with sparklines
│       │   │   ├── publishers/[id]/   # Publisher detail pages
│       │   │   └── updates/           # Patch notes / changelog
│       │   ├── api/                   # API routes
│       │   │   ├── admin/             # Admin endpoints
│       │   │   ├── alerts/            # Alert CRUD
│       │   │   ├── apps/              # App data endpoints
│       │   │   ├── auth/              # Auth (OTP verify, logout)
│       │   │   ├── autocomplete/      # Search autocomplete
│       │   │   ├── chat/stream/       # SSE chat streaming
│       │   │   ├── pins/              # User pins CRUD
│       │   │   ├── search/            # Search endpoints
│       │   │   └── similarity/        # Vector similarity
│       │   └── auth/                  # Auth callbacks
│       ├── src/components/            # Shared UI components
│       └── src/lib/                   # Utilities
│           ├── llm/                   # Chat system
│           │   ├── cube-tools.ts              # 9 tool definitions
│           │   ├── cube-system-prompt.ts       # System prompt with Cube schemas
│           │   ├── format-entity-links.ts      # Entity link pre-formatting
│           │   ├── providers/openai.ts         # OpenAI provider (default: gpt-4o-mini)
│           │   └── streaming-types.ts          # SSE event types
│           ├── supabase/              # 5 client variants (see Architecture Patterns)
│           ├── credits/calculator.ts   # Credit cost definitions
│           └── cube-executor.ts       # Cube.js query executor (3 retries, 30s timeout)
│
├── packages/
│   ├── cube/                         # Cube.js semantic layer
│   │   └── model/                    # 9 model files, 27 cubes
│   │       ├── Apps.js               # Apps, AppPublishers, AppDevelopers, AppTrends, AppSteamDeck
│   │       ├── Discovery.js          # Discovery, Genres, AppGenres, Tags, AppTags
│   │       ├── Publishers.js         # Publishers, PublisherMetrics, PublisherYearMetrics, PublisherGameMetrics
│   │       ├── Developers.js         # Developers, DeveloperMetrics, DeveloperYearMetrics, DeveloperGameMetrics
│   │       ├── DailyMetrics.js       # DailyMetrics, LatestMetrics (both in same file)
│   │       ├── MonthlyMetrics.js     # MonthlyGameMetrics, MonthlyPublisherMetrics
│   │       ├── ReviewVelocity.js     # ReviewVelocity
│   │       ├── ReviewDeltas.js       # ReviewDeltas
│   │       └── SyncHealth.js         # SyncJobs, SyncStatus, PicsSyncState
│   │
│   ├── database/                     # Supabase client & generated types
│   ├── ingestion/                    # Data collection workers & API clients
│   ├── qdrant/                       # Vector database client (5 collections)
│   └── shared/                       # Logger (Pino), constants, error types
│
├── services/
│   └── pics-service/                 # Python microservice (Railway)
│       ├── src/steam/                # SteamKit2 client
│       ├── src/workers/              # bulk_sync, change_monitor
│       └── src/database/             # Supabase operations
│
├── supabase/migrations/              # Database schema (apply in order)
├── .github/workflows/                # Scheduled sync jobs
└── docs/                             # Full documentation
```

---

## Architecture Patterns

### Supabase Client Variants

| Context | Function | File | Session Handling |
|---------|----------|------|------------------|
| Server Component / API Route | `createServerClient()` | `lib/supabase/server.ts` | Cookie-based, refreshes session |
| Client Component / Hook | `createBrowserClient()` | `lib/supabase/client.ts` | Singleton, auto-refresh, cookie-aware |
| Login page only | `createBrowserClientNoRefresh()` | `lib/supabase/client.ts` | No auto-refresh (prevents loops) |
| Middleware | `createMiddlewareClient()` | `lib/supabase/middleware.ts` | Cookie forwarding via NextResponse |
| Ingestion workers | `createServiceClient()` | `packages/database/src/client.ts` | Service role key (bypasses RLS) |

All paths above are relative to `apps/admin/src/` unless fully qualified.

### Import Conventions
- Supabase types: `import type { Database } from '@publisheriq/database'`
- Shared utilities: `import { logger } from '@publisheriq/shared'`
- Ingestion package: `@publisheriq/ingestion`

### Command Palette & Filters
Each page has its **own** filter system (NOT shared):
- Games: `app/(main)/apps/lib/filter-registry.ts` + `app/(main)/apps/components/command-palette/`
- Companies: `app/(main)/companies/lib/filter-registry.ts` + `app/(main)/companies/components/command-palette/`

---

## Database

### Scale (optimize all queries)

| Table | ~Rows | Notes |
|-------|-------|-------|
| `apps` | 200K | All Steam apps |
| `daily_metrics` | 15M+ | One row per app per day |
| `ccu_snapshots` | 5M+ | Hourly, 30-day retention |
| `review_deltas` | 3M+ | Daily review changes |
| `app_steam_tags` | 1.5M+ | Many tags per game |
| `sync_status` | 200K | One per app |
| `publishers` / `developers` | 50K each | Entity tables |

### Query Rules
1. **ALWAYS use LIMIT** - Start with `LIMIT 100` for exploration
2. **Use indexed columns** - `appid`, `metric_date`, `created_at`, `publisher_id`, `developer_id`
3. **Prefer materialized views** - Use `publisher_metrics`, `latest_daily_metrics` over raw aggregations
4. **Use RPC functions** - `get_companies_with_filters()`, `get_apps_with_filters()` are pre-optimized
5. **Avoid COUNT(\*)** - Use approximate counts or cached stats
6. **Time-bound queries** - Always filter `daily_metrics` and `ccu_snapshots` by date range

```sql
-- BAD: Full table scan
SELECT * FROM apps WHERE name ILIKE '%counter%';
-- GOOD: Limit results
SELECT appid, name FROM apps WHERE name ILIKE '%counter%' LIMIT 50;

-- BAD: Aggregate millions of rows
SELECT appid, AVG(ccu) FROM daily_metrics GROUP BY appid;
-- GOOD: Use materialized view
SELECT * FROM latest_daily_metrics WHERE ccu > 1000 LIMIT 100;
```

### Key Column Schemas

**apps** (use `appid` not `id`):
```
appid, name, type, is_released, is_delisted, release_date, release_date_raw,
platforms, controller_support, is_free, current_price_cents, current_discount_percent,
metacritic_score, metacritic_url, pics_review_score, pics_review_percentage,
parent_appid, created_at, updated_at, last_content_update
```
**NO `description` or `short_description` column exists.**

**daily_metrics** (use `metric_date` NOT `date`):
```
id, appid, metric_date, ccu_peak, ccu_source, total_reviews, positive_reviews,
negative_reviews, review_score, review_score_desc, owners_min, owners_max,
price_cents, discount_percent, average_playtime_forever, average_playtime_2weeks
```

**sync_status:**
```
appid, refresh_tier, priority_score, last_storefront_sync, last_reviews_sync,
last_steamspy_sync, last_histogram_sync, last_ccu_synced, ccu_tier,
consecutive_errors, storefront_accessible, created_at, updated_at
```

### Core Tables
| Table | Purpose |
|-------|---------|
| `apps` | Steam apps with metadata, prices, platforms |
| `publishers` / `developers` | Entity tables with game_count, embedding_hash |
| `app_publishers` / `app_developers` | Many-to-many relationships |
| `daily_metrics` | Daily snapshots (CCU, reviews, owners, price) |
| `ccu_snapshots` | Hourly CCU samples (30-day retention) |
| `review_histogram` | Monthly review buckets for trends |
| `review_deltas` | Daily review changes with interpolation flag |
| `app_trends` | Computed 30/90-day trends |
| `sync_status` | Per-app sync tracking with priority scores |
| `sync_jobs` | Job execution history |
| `chat_query_logs` | Chat analytics (7-day retention) |
| `pics_sync_state` | PICS change number tracking |
| `ccu_tier_assignments` | CCU tier assignment with reason |

### PICS Data Tables
`steam_tags`, `steam_genres`, `steam_categories`, `franchises`,
`app_steam_tags`, `app_genres`, `app_categories`, `app_franchises`, `app_steam_deck`

### User System Tables
`user_profiles`, `waitlist`, `credit_transactions`, `credit_reservations`, `rate_limit_state`

### Personalization Tables (v2.4)
`user_pins`, `user_alerts`, `user_alert_preferences`, `user_pin_alert_settings`, `alert_detection_state`

### Materialized Views (20 total)
| View | Purpose | Refresh |
|------|---------|---------|
| `latest_daily_metrics` | Most recent metrics per app | Auto |
| `publisher_metrics` | All-time publisher aggregations | `REFRESH MATERIALIZED VIEW CONCURRENTLY publisher_metrics;` |
| `developer_metrics` | All-time developer aggregations | `REFRESH MATERIALIZED VIEW CONCURRENTLY developer_metrics;` |
| `publisher_year_metrics` | Per-year publisher stats | View (auto) |
| `developer_year_metrics` | Per-year developer stats | View (auto) |
| `publisher_game_metrics` | Per-game publisher data | View (auto) |
| `developer_game_metrics` | Per-game developer data | View (auto) |
| `review_velocity_stats` | Velocity metrics per app | Daily via `refresh_mat_views()` |
| `monthly_game_metrics` | Monthly aggregated game stats | Daily via `refresh_mat_views()` |
| `monthly_publisher_metrics` | Monthly publisher stats | Daily via `refresh_mat_views()` |
| `app_filter_data` | Pre-computed content arrays | Every 6 hours |
| `mv_tag_counts` | Tag counts by app type | Daily via `refresh_filter_count_views()` |
| `mv_genre_counts` | Genre counts by app type | Daily |
| `mv_category_counts` | Category counts by app type | Daily |
| `mv_steam_deck_counts` | Steam Deck counts by app type | Daily |
| `mv_ccu_tier_counts` | CCU tier distribution | Daily |
| `mv_velocity_tier_counts` | Velocity tier distribution | Daily |
| `mv_apps_aggregate_stats` | Summary stats by app type | Daily |

### Key RPC Functions
| Function | Used By |
|----------|---------|
| `get_apps_with_filters()` | Games page |
| `get_apps_aggregate_stats()` | Games page stats bar |
| `get_app_sparkline_data()` | Games page sparklines |
| `get_apps_filter_option_counts()` | Games page filter dropdowns |
| `get_companies_with_filters()` | Companies page |
| `get_companies_aggregate_stats()` | Companies page stats |
| `get_company_sparkline_data()` | Companies page sparklines |
| `get_filter_option_counts()` | Companies page filter dropdowns |
| `get_companies_by_ids()` | Companies compare mode |
| `recalculate_ccu_tiers()` | CCU tier reassignment |
| `refresh_mat_views()` | Materialized view refresh |
| `refresh_filter_count_views()` | Filter count view refresh |

### Enums
```sql
app_type: 'game', 'dlc', 'demo', 'mod', 'video', 'hardware', 'music'
sync_source: 'steamspy', 'storefront', 'reviews', 'histogram', 'scraper', 'pics'
trend_direction: 'up', 'down', 'stable'
refresh_tier: 'active', 'moderate', 'dormant', 'dead'
steam_deck_category: 'unknown', 'unsupported', 'playable', 'verified'
ccu_tier: 'tier1', 'tier2', 'tier3'
user_role: 'user', 'admin'
alert_type: 'ccu_spike', 'ccu_drop', 'trend_reversal', 'review_surge', 'sentiment_shift', 'price_change', 'new_release', 'milestone'
alert_severity: 'low', 'medium', 'high'
```

---

## Chat System

The chat uses Cube.js semantic layer (NOT raw SQL) with 9 LLM tools.

**Default model:** `gpt-4o-mini` (configurable via `LLM_PROVIDER` env var)

### LLM Tools
| Tool | Purpose | Credit Cost |
|------|---------|-------------|
| `query_analytics` | Structured queries via Cube.js cubes | 8 |
| `find_similar` | Vector similarity search via Qdrant | 12 |
| `search_by_concept` | Semantic search by description | 0 |
| `search_games` | Tag/genre/category discovery with fuzzy matching | 8 |
| `discover_trending` | Trend-based: momentum, accelerating, breaking_out | 0 |
| `lookup_publishers` | Find exact publisher names (ILIKE) | 4 |
| `lookup_developers` | Find exact developer names (ILIKE) | 4 |
| `lookup_tags` | Discover available tags/genres/categories | 4 |
| `lookup_games` | Find exact game names (ILIKE) | 0 |

### Credit System
Feature-flagged via `CREDITS_ENABLED` env var. Token costs: input 2/1k, output 8/1k. Min charge: 4 credits. Default reservation: 25 credits.

### Chat-Exposed Cubes (11 cubes referenced in system prompt)
| Cube | Source | Purpose |
|------|--------|---------|
| `Discovery` | apps + latest_daily_metrics + app_trends + app_steam_deck | Game discovery |
| `PublisherMetrics` | publisher_metrics (materialized) | All-time publisher stats |
| `PublisherYearMetrics` | publisher_year_metrics | Publisher stats by year |
| `PublisherGameMetrics` | publisher_game_metrics | Per-game publisher data |
| `DeveloperMetrics` | developer_metrics (materialized) | All-time developer stats |
| `DeveloperYearMetrics` | developer_year_metrics | Developer stats by year |
| `DeveloperGameMetrics` | developer_game_metrics | Per-game developer data |
| `DailyMetrics` | daily_metrics | Historical time-series |
| `LatestMetrics` | latest_daily_metrics | Current snapshot |
| `ReviewVelocity` | review_velocity_stats | Velocity discovery |
| `ReviewDeltas` | review_deltas | Daily review delta analysis |

**16 additional cubes** (Apps, AppPublishers, AppDevelopers, AppTrends, AppSteamDeck, Genres, AppGenres, Tags, AppTags, Publishers, Developers, MonthlyGameMetrics, MonthlyPublisherMetrics, SyncJobs, SyncStatus, PicsSyncState) exist in model files but are not directly exposed to the chat LLM.

### Entity Linking
Pre-formatted before LLM sees results:
- Games: `[Name](game:APPID)` renders as link to `/apps/{appid}`
- Publishers: `[Name](/publishers/ID)` renders as link
- Developers: `[Name](/developers/ID)` renders as link

### Key Files
| File | Purpose |
|------|---------|
| `src/lib/llm/cube-system-prompt.ts` | System prompt with Cube schemas |
| `src/lib/llm/cube-tools.ts` | 9 tool definitions |
| `src/lib/cube-executor.ts` | Query executor (3 retries, 30s timeout) |
| `src/lib/llm/format-entity-links.ts` | Entity link pre-formatting |
| `src/app/api/chat/stream/route.ts` | SSE streaming API |

---

## Page Inventory

| Route | Page | Key Features |
|-------|------|-------------|
| `/dashboard` | Main dashboard | Overview |
| `/chat` | AI chat | Cube.js-powered analytics chat |
| `/insights` | Insights | CCU sparklines, top/newest/trending tabs, time ranges (24h/7d/30d) |
| `/apps` | Games | Discovery, 12 presets, command palette, compare mode, export |
| `/companies` | Companies | Unified pub/dev, presets, command palette, compare, export |
| `/publishers/[id]` | Publisher detail | Individual publisher analytics |
| `/developers/[id]` | Developer detail | Individual developer analytics |
| `/account` | Account | User settings |
| `/updates` | Patch notes | Changelog |
| `/admin` | Admin panel | Dashboard, users, waitlist, usage, chat-smoke test |

All routes under `(main)/` layout (authenticated). Login under `(auth)/`.

---

## Data Pipeline

### Sources & Rate Limits
| Source | Rate Limit | Data |
|--------|------------|------|
| Steam GetAppList | 100k/day | All appIDs |
| Steam Storefront | ~200/5min | Metadata, dev/pub (**authoritative**) |
| Steam Reviews | ~60/min | Review counts, scores |
| Steam Histogram | ~60/min | Monthly review buckets |
| Steam CCU API | 1/sec | Exact player counts |
| SteamSpy | 1/sec | CCU, owners, tags (NOT authoritative for dev/pub) |
| PICS Service | ~200 apps/req | Tags, genres, Steam Deck (real-time via SteamKit2) |

### Tier System (unified)

**Sync Priority Tiers** (refresh_tier):
| Tier | Criteria | Sync Interval |
|------|----------|---------------|
| `active` | CCU > 100 OR reviews/day > 1 | 6-12h |
| `moderate` | CCU > 0 | 24-48h |
| `dormant` | No activity 90 days | Weekly |
| `dead` | No activity 1 year | Monthly |

**CCU Polling Tiers** (ccu_tier):
| Tier | Criteria | Polling |
|------|----------|---------|
| `tier1` | Top 500 by 7-day peak CCU | Hourly |
| `tier2` | Top 1000 newest releases | Every 2h |
| `tier3` | All others (~120K+) | 3x daily (rotation) |

### GitHub Actions Schedule (UTC)
| Workflow | Schedule | Purpose |
|----------|----------|---------|
| applist-sync | 00:15 daily | Master app list |
| steamspy-sync | 02:15 daily | CCU, owners, tags |
| embedding-sync | 03:00 daily | Vector embeddings |
| histogram-sync | 04:15 daily | Monthly review trends |
| ccu-sync | :00 hourly | Tier 1+2 CCU polling |
| ccu-daily-sync | 04:30, 12:30, 20:30 | Tier 3 CCU rotation |
| ccu-cleanup | Sunday 03:00 | Snapshot cleanup + aggregation |
| storefront-sync | 06,10,14,18,22:00 | Game metadata |
| reviews-sync | +30 min after storefront | Review counts |
| velocity-calculation | 08:00, 16:00, 00:00 | Velocity tier calculation |
| interpolation | 05:00 daily | Review delta interpolation |
| refresh-views | 05:00 daily | Materialized view refresh |
| trends-calculation | 22:00 daily | Trend metrics |
| priority-calculation | 22:30 daily | Priority scores |
| cleanup-chat-logs | 03:00 daily | 7-day log retention |
| cleanup-reservations | :00 hourly | Stale credit reservation cleanup |
| alert-detection | :15 hourly | Alert detection for pinned entities |

### PICS Service (Python on Railway)
- `bulk_sync` mode: Initial load (~3 min for 70k apps)
- `change_monitor` mode: Continuous polling (every 30s)
- Data: Tags, genres, categories, franchises, Steam Deck, controller support, platforms, review scores, parent appid, last content update
- Health: `GET /`, `GET /health`, `GET /status`

---

## Common Pitfalls

### psql is NOT in PATH
```bash
# CORRECT - always use full path
source /Users/ryanbohmann/Desktop/publisheriq/.env && /opt/homebrew/opt/libpq/bin/psql "$DATABASE_URL" -c "YOUR_SQL_HERE"

# WRONG - will fail
psql "$DATABASE_URL" -c "..."
```

**\d commands fail** - Use `information_schema.columns` instead:
```sql
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'apps' ORDER BY ordinal_position;
```

### Common Mistakes
- Using `date` instead of `metric_date` in daily_metrics
- Looking for `description` column in `apps` table (doesn't exist)
- Using `getSupabase()` in client hooks (use `createBrowserClient()` instead)
- Referencing `LatestMetrics.js` as a separate file (it's defined inside `DailyMetrics.js`)
- Running `trends-calculate` or `priority-calculate` (correct: `calculate-trends`, `update-priorities`)
- Creating tests (no test framework configured; use `pnpm build` + `pnpm check-types`)

---

## Environment Variables

### Admin Dashboard (`apps/admin/.env.local`)
```bash
NEXT_PUBLIC_SITE_URL=https://publisheriq.app   # Required for OTP redirects (https://, no trailing slash)
AUTH_PASSWORD=xxx                                # Dashboard login password
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
LLM_PROVIDER=openai                              # "openai" or "anthropic"
OPENAI_API_KEY=sk-...                            # For gpt-4o-mini + text-embedding-3-small
USE_CUBE_CHAT=true                               # Enable Cube.js chat system
CUBE_API_URL=https://xxx.fly.dev
CUBE_API_SECRET=xxx                              # For JWT signing
QDRANT_URL=https://xxx.qdrant.io
QDRANT_API_KEY=xxx
CREDITS_ENABLED=true                             # Feature flag for credit system
```

### Root `.env` (sync workers)
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
STEAM_API_KEY=xxx
```

### PICS Service (`services/pics-service/.env`)
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
MODE=change_monitor    # "bulk_sync" or "change_monitor"
PORT=8080              # Health check port
```

### Cube.js (`packages/cube/.env`)
```bash
CUBEJS_DB_HOST=db.xxx.supabase.co
CUBEJS_DB_PORT=5432
CUBEJS_DB_NAME=postgres
CUBEJS_DB_USER=postgres
CUBEJS_DB_PASS=xxx
CUBEJS_API_SECRET=xxx
CUBEJS_DEV_MODE=true
CUBEJS_CACHE_AND_QUEUE_DRIVER=memory
CUBEJS_PRE_AGGREGATIONS_SCHEMA=cube_pre_aggs
```

---

## CLI Tools & psql

| Tool | Use For |
|------|---------|
| `supabase` | Migrations, schema inspection, type generation |
| `psql` | Direct SQL queries (use full path: `/opt/homebrew/opt/libpq/bin/psql`) |
| `vercel` | Environment variables, deployment status |

```bash
# Type generation (safe)
supabase gen types typescript --linked > packages/database/src/types.ts

# Database inspection (safe, no Docker)
supabase inspect db table-stats
supabase inspect db db-stats
supabase migration list
```

### Supabase CLI Docker Requirements
| Command | Docker? | Description |
|---------|---------|-------------|
| `supabase inspect db *` | No | Database stats, table info |
| `supabase gen types --linked` | No | Generate TypeScript types |
| `supabase migration list` | No | List applied migrations |
| `supabase db dump` | **Yes** | Dump schema/data |
| `supabase db push` | **Yes** | Apply migrations |
| `supabase start` | **Yes** | Local development |

---

## Vector Search (Qdrant)

| Collection | Entity | Purpose |
|------------|--------|---------|
| `publisheriq_games` | Games | Find similar games |
| `publisheriq_publishers_portfolio` | Publishers | Match by catalog |
| `publisheriq_publishers_identity` | Publishers | Match by top games |
| `publisheriq_developers_portfolio` | Developers | Match by catalog |
| `publisheriq_developers_identity` | Developers | Match by top games |

**Config:** 512 dimensions, int8 quantization, on-disk payloads, hash-based change detection.

---

## Adding Features

### New Cube Dimension/Measure
1. Update model in `packages/cube/model/`
2. Update system prompt in `src/lib/llm/cube-system-prompt.ts`
3. Rebuild: `pnpm --filter cube build`

### New Sync Worker
1. API client in `packages/ingestion/src/apis/`
2. Worker in `packages/ingestion/src/workers/`
3. Script in `packages/ingestion/package.json`
4. GitHub Action in `.github/workflows/`

### Database Schema Change
1. Migration in `supabase/migrations/` (timestamp prefix)
2. Apply via Supabase SQL Editor or `supabase db push`
3. Regenerate types: `pnpm --filter database generate`

### New Page
1. Directory in `apps/admin/src/app/(main)/your-page/`
2. `page.tsx` with server component (data fetching)
3. Client components in `components/` subdirectory

---

## Documentation

Full docs in `/docs/`:
- [Architecture Overview](docs/architecture/overview.md)
- [Chat Data System](docs/architecture/chat-data-system.md)
- [Database Schema](docs/architecture/database-schema.md)
- [Design System](docs/architecture/design-system.md)
- [Admin Dashboard](docs/architecture/admin-dashboard.md)
- [Companies Page](docs/architecture/companies-page.md)
- [Personalized Dashboard](docs/architecture/personalized-dashboard.md)
- [Data Sources](docs/architecture/data-sources.md)
- [Sync Pipeline](docs/architecture/sync-pipeline.md)
- Release notes: [v2.0](docs/releases/v2.0-new-design.md) | [v2.1](docs/releases/v2.1-velocity-auth.md) | [v2.2](docs/releases/v2.2-ccu-steamspy.md) | [v2.3](docs/releases/v2.3-embedding-optimization.md) | [v2.4](docs/releases/v2.4-personalization.md) | [v2.5](docs/releases/v2.5-companies-page.md) | [v2.6](docs/releases/v2.6-games-page.md) | [v2.7](docs/releases/v2.7-design-command-palette.md) | [v2.8](docs/releases/v2.8-security-fixes.md)
