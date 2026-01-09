# CLAUDE.md - PublisherIQ

> Steam data acquisition platform with natural language chat interface. Last updated: January 9, 2026.

---

## ❓ When Uncertain, Ask

**Don't assume - ask questions using AskUserQuestion with clear options.**

Ask before:
- Choosing between multiple valid implementation approaches
- Making architectural decisions (new files, patterns, dependencies)
- Changing existing behavior that might be intentional
- Any destructive or hard-to-reverse operations

Example scenarios:
- "Should I add this to the existing file or create a new module?"
- "This could use Redis or in-memory caching - which fits your infrastructure?"
- "I found 3 places this could go - which matches your conventions?"

**Always provide 2-4 concrete options** with brief explanations of trade-offs.

---

## ⛔ Database Safety Rules

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

## Available CLI Tools

| Tool | Use For |
|------|---------|
| `supabase` | Migrations, schema inspection, type generation |
| `psql` | Direct SQL queries against the database |
| `vercel` | Environment variables, deployment status |

```bash
# Type generation (safe)
supabase gen types typescript --linked > packages/database/src/types.ts

# Database inspection (safe, no Docker required)
supabase inspect db table-stats
supabase inspect db db-stats
supabase migration list

# ⚠️ Schema changes (requires approval + Docker)
supabase migration new <name>
supabase db push
```

---

## Direct Database Access (psql)

### Prerequisites
PostgreSQL client is installed via Homebrew:
```bash
brew install libpq
echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Running SQL Queries
```bash
# Load DATABASE_URL from .env and run interactive session
source .env && psql "$DATABASE_URL"

# Single query
source .env && psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM apps;"

# Query with formatted output
source .env && psql "$DATABASE_URL" -c "SELECT name, game_count FROM publishers ORDER BY game_count DESC LIMIT 10;"
```

### Supabase CLI Docker Requirements
| Command | Docker Required? | Description |
|---------|------------------|-------------|
| `supabase inspect db *` | No | Database stats, table info, locks |
| `supabase gen types --linked` | No | Generate TypeScript types |
| `supabase migration list` | No | List applied migrations |
| `supabase db dump` | **Yes** | Dump schema/data |
| `supabase db push` | **Yes** | Apply migrations |
| `supabase start` | **Yes** | Local development |

## Project Overview

PublisherIQ collects, stores, and analyzes Steam game metadata, publisher/developer information, review trends, and player metrics. Features an AI-powered chat interface using Cube.js semantic layer for type-safe analytics queries.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router), React 19, TailwindCSS |
| Database | Supabase (PostgreSQL) |
| Semantic Layer | Cube.js (Fly.io) |
| Vector DB | Qdrant Cloud |
| Embeddings | OpenAI text-embedding-3-small (1536 dims) |
| Workers | GitHub Actions (scheduled) |
| PICS Service | Python + SteamKit2 (Railway) |
| AI Chat | OpenAI Chat GPT with tool use |
| Deployment | Vercel (dashboard), Railway (PICS), Fly.io (Cube.js) |

## Monorepo Structure

```
publisheriq/
├── apps/
│   └── admin/                     # Next.js 15 dashboard
│       ├── src/app/               # App router pages
│       ├── src/components/        # React components (theme, ui, data-display)
│       └── src/lib/               # Utilities, LLM integration
│           ├── llm/               # Chat system
│           │   ├── cube-tools.ts           # Tool definitions (7 tools)
│           │   ├── cube-system-prompt.ts   # System prompt with Cube schemas
│           │   ├── format-entity-links.ts  # Entity link pre-formatting
│           │   └── streaming-types.ts      # SSE event types
│           ├── cube-executor.ts   # Cube.js query executor with retry
│           └── chat-query-logger.ts # Query analytics logging
│
├── packages/
│   ├── cube/                      # Cube.js semantic layer
│   │   └── model/                 # Cube definitions
│   │       ├── Discovery.js       # Game discovery (main cube)
│   │       ├── Publishers.js      # Publisher metrics (3 cubes)
│   │       ├── Developers.js      # Developer metrics (3 cubes)
│   │       ├── DailyMetrics.js    # Time-series metrics
│   │       ├── LatestMetrics.js   # Current snapshot
│   │       ├── ReviewVelocity.js  # Velocity-based discovery (v2.1)
│   │       └── ReviewDeltas.js    # Daily review deltas (v2.1)
│   │
│   ├── database/                  # Supabase client & types
│   │   ├── src/client.ts          # createServiceClient()
│   │   └── src/types.ts           # Generated types
│   │
│   ├── ingestion/                 # Data collection
│   │   ├── src/apis/              # API clients
│   │   │   ├── steam-web.ts       # Steam app list
│   │   │   ├── storefront.ts      # Game metadata (AUTHORITATIVE for dev/pub)
│   │   │   ├── reviews.ts         # Reviews + histogram
│   │   │   ├── steamspy.ts        # CCU, owners, tags
│   │   │   └── steam-ccu.ts       # Exact player counts (v2.2)
│   │   ├── src/workers/           # Sync workers
│   │   └── src/utils/             # Rate limiter (token bucket), retry
│   │
│   ├── qdrant/                    # Vector database client
│   │   ├── src/client.ts          # Qdrant singleton
│   │   ├── src/collections.ts     # 5 collection schemas
│   │   └── src/filter-builder.ts  # Query filters
│   │
│   └── shared/                    # Shared utilities
│       ├── src/constants.ts       # Rate limits, thresholds
│       ├── src/logger.ts          # Pino logging
│       └── src/errors.ts          # Error types
│
├── services/
│   └── pics-service/              # Python microservice
│       ├── src/steam/             # SteamKit2 client
│       ├── src/workers/           # bulk_sync, change_monitor
│       └── src/database/          # Supabase operations
│
├── supabase/
│   └── migrations/                # Database schema (apply in order)
│
├── .github/
│   └── workflows/                 # Scheduled sync jobs
│
└── docs/                          # Full documentation
```

## Key Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Type check
pnpm check-types

# Run admin dashboard locally
pnpm --filter admin dev

# Regenerate database types
pnpm --filter database generate

# Run sync workers manually
pnpm --filter @publisheriq/ingestion applist-sync
pnpm --filter @publisheriq/ingestion steamspy-sync
pnpm --filter @publisheriq/ingestion storefront-sync
pnpm --filter @publisheriq/ingestion reviews-sync
pnpm --filter @publisheriq/ingestion histogram-sync
pnpm --filter @publisheriq/ingestion trends-calculate
pnpm --filter @publisheriq/ingestion priority-calculate
pnpm --filter @publisheriq/ingestion embedding-sync

# CCU tracking (v2.2)
pnpm --filter @publisheriq/ingestion ccu-tiered-sync
pnpm --filter @publisheriq/ingestion ccu-daily-sync

# Velocity & view refresh (v2.1)
pnpm --filter @publisheriq/ingestion calculate-velocity
pnpm --filter @publisheriq/ingestion interpolate-reviews
pnpm --filter @publisheriq/ingestion refresh-views
pnpm --filter @publisheriq/ingestion price-sync
```

## Environment Variables

### Root `.env` (sync workers)
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
STEAM_API_KEY=xxx
```

### Admin Dashboard `apps/admin/.env.local`
```bash
# Authentication
AUTH_PASSWORD=xxx               # Dashboard login password

# Supabase (server-side)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Supabase (client-side)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Chat interface
LLM_PROVIDER=openai             # "openai" or "anthropic"
OPENAI_API_KEY=sk-...           # GPT-4o + text-embedding-3-small
USE_CUBE_CHAT=true              # Enable Cube.js chat system

# Cube.js semantic layer
CUBE_API_URL=https://xxx.fly.dev
CUBE_API_SECRET=xxx             # For JWT signing

# Vector similarity search
QDRANT_URL=https://xxx.qdrant.io
QDRANT_API_KEY=xxx
```

### PICS Service `services/pics-service/.env`
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
MODE=change_monitor             # "bulk_sync" or "change_monitor"
PORT=8080                       # Health check port (Railway injects)

# Bulk sync options
BULK_BATCH_SIZE=200
BULK_REQUEST_DELAY=0.5

# Change monitor options
POLL_INTERVAL=30
PROCESS_BATCH_SIZE=100
MAX_QUEUE_SIZE=10000

# Logging
LOG_LEVEL=INFO
LOG_JSON=true
```

### Cube.js `packages/cube/.env` (Fly.io)
```bash
CUBEJS_DB_HOST=db.xxx.supabase.co
CUBEJS_DB_PORT=5432
CUBEJS_DB_NAME=postgres
CUBEJS_DB_USER=postgres
CUBEJS_DB_PASS=xxx
CUBEJS_API_SECRET=xxx           # Generate: openssl rand -hex 32
CUBEJS_DEV_MODE=true            # Enables Playground UI
CUBEJS_CACHE_AND_QUEUE_DRIVER=memory
CUBEJS_PRE_AGGREGATIONS_SCHEMA=cube_pre_aggs
```

## Database Schema

### Enums
```sql
app_type: 'game', 'dlc', 'demo', 'mod', 'video', 'hardware', 'music'
sync_source: 'steamspy', 'storefront', 'reviews', 'histogram', 'scraper', 'pics'
trend_direction: 'up', 'down', 'stable'
refresh_tier: 'active', 'moderate', 'dormant', 'dead'
steam_deck_category: 'unknown', 'unsupported', 'playable', 'verified'
ccu_tier: 'tier1', 'tier2', 'tier3'
user_role: 'user', 'admin'
waitlist_status: 'pending', 'approved', 'rejected'
credit_transaction_type: 'signup_bonus', 'usage', 'refund', 'admin_adjustment'
```

### Core Tables
| Table | Purpose |
|-------|---------|
| `apps` | Steam apps with metadata, prices, platforms, controller support |
| `publishers` | Publisher entities with game_count, embedding_hash |
| `developers` | Developer entities with game_count, embedding_hash |
| `app_publishers` / `app_developers` | Many-to-many relationships |

### PICS Data (from Steam's Product Info Cache)
| Table | Purpose |
|-------|---------|
| `steam_tags` | Tag ID → name mapping |
| `steam_genres` | Genre ID → name (seeded) |
| `steam_categories` | Feature categories (70 categories) |
| `franchises` | Game series names |
| `app_steam_tags` | App-tag relationships with rank |
| `app_genres` | App-genre with is_primary flag |
| `app_categories` | App-category relationships |
| `app_franchises` | App-franchise relationships |
| `app_steam_deck` | Steam Deck compatibility data |

### Metrics
| Table | Purpose |
|-------|---------|
| `daily_metrics` | Daily snapshots (CCU, reviews, owners, price) |
| `review_histogram` | Monthly review buckets for trends |
| `app_trends` | Computed 30/90-day trends |
| `app_tags` | SteamSpy user-voted tags (separate from PICS tags) |

### Materialized Views
| View | Purpose | Refresh Command |
|------|---------|-----------------|
| `latest_daily_metrics` | Most recent metrics per app | Auto |
| `publisher_metrics` | ALL-TIME publisher aggregations | `REFRESH MATERIALIZED VIEW CONCURRENTLY publisher_metrics;` |
| `developer_metrics` | ALL-TIME developer aggregations | `REFRESH MATERIALIZED VIEW CONCURRENTLY developer_metrics;` |
| `publisher_year_metrics` | Per-year publisher stats | View (auto) |
| `developer_year_metrics` | Per-year developer stats | View (auto) |
| `publisher_game_metrics` | Per-game publisher data | View (auto) |
| `developer_game_metrics` | Per-game developer data | View (auto) |
| `review_velocity_stats` | Velocity metrics per app | Daily via `refresh_mat_views()` |

### Operational
| Table | Purpose |
|-------|---------|
| `sync_status` | Per-app sync tracking with priority scores |
| `sync_jobs` | Job execution history with GitHub run IDs |
| `chat_query_logs` | Chat analytics (7-day retention, auto-cleanup) |
| `pics_sync_state` | PICS change number tracking |

### CCU Tracking (v2.2)
| Table | Purpose |
|-------|---------|
| `ccu_snapshots` | Hourly CCU samples with 30-day retention |
| `ccu_tier_assignments` | Tier assignment with reason tracking |

### Velocity Tracking (v2.1)
| Table | Purpose |
|-------|---------|
| `review_deltas` | Daily review changes with interpolation flag |

### User System (v2.1)
| Table | Purpose |
|-------|---------|
| `user_profiles` | User data with role, credit balance |
| `waitlist` | Email signup queue with status |
| `credit_transactions` | Immutable credit audit log |
| `credit_reservations` | Deduct-at-start pattern for chat |
| `rate_limit_state` | Per-user rate limiting |

## Chat System Architecture

The chat uses Cube.js semantic layer (NOT raw SQL) with 7 LLM tools:

### LLM Tools
| Tool | Purpose |
|------|---------|
| `query_analytics` | Structured queries via Cube.js cubes |
| `find_similar` | Vector similarity search via Qdrant |
| `search_games` | Tag/genre/category-based discovery with fuzzy matching |
| `lookup_publishers` | Find exact publisher names (ILIKE) before filtering |
| `lookup_developers` | Find exact developer names (ILIKE) before filtering |
| `lookup_tags` | Discover available tags/genres/categories |
| `lookup_games` | Find exact game names (ILIKE) before filtering |

### Cube.js Cubes
| Cube | Data Source | Purpose |
|------|-------------|---------|
| `Discovery` | apps + latest_daily_metrics + app_trends + app_steam_deck | Game discovery with all metrics |
| `PublisherMetrics` | publisher_metrics (materialized) | ALL-TIME publisher aggregations |
| `PublisherYearMetrics` | publisher_year_metrics | By release year |
| `PublisherGameMetrics` | publisher_game_metrics | Per-game with rolling periods |
| `DeveloperMetrics` | developer_metrics (materialized) | ALL-TIME developer aggregations |
| `DeveloperYearMetrics` | developer_year_metrics | By release year |
| `DeveloperGameMetrics` | developer_game_metrics | Per-game with rolling periods |
| `DailyMetrics` | daily_metrics | Historical time-series |
| `LatestMetrics` | latest_daily_metrics | Current snapshot |
| `ReviewVelocity` | review_velocity_stats | Velocity-based discovery |
| `ReviewDeltas` | review_deltas | Daily review delta analysis |

### Key Segments (Pre-computed Filters)
```
Discovery: trending, highlyRated, veryPositive, steamDeckVerified, steamDeckPlayable, freeToPlay, recentlyReleased
PublisherMetrics: trending, highRevenue (>$1M), highOwners (>100K)
DeveloperMetrics: trending, highRevenue (>$100K), highOwners (>50K)
*GameMetrics: lastYear, last6Months, last3Months, last30Days
```

### Entity Linking (Pre-formatted before LLM sees results)
- Games: `[Name](game:APPID)` → renders as link to `/apps/{appid}`
- Publishers: `[Name](/publishers/ID)` → renders as link
- Developers: `[Name](/developers/ID)` → renders as link

### Key Files
| File | Purpose |
|------|---------|
| `apps/admin/src/lib/llm/cube-system-prompt.ts` | System prompt with full Cube schema |
| `apps/admin/src/lib/llm/cube-tools.ts` | Tool definitions |
| `apps/admin/src/lib/cube-executor.ts` | Query executor with 3 retries, 30s timeout |
| `apps/admin/src/lib/llm/format-entity-links.ts` | Entity link pre-formatting |
| `apps/admin/src/app/api/chat/stream/route.ts` | SSE streaming API |

### Recent Improvements
- Retry logic: 3 retries with exponential backoff (500ms-4s) for 502/503/504
- 30s timeout: AbortController prevents hanging queries
- Tag normalization: "coop" → "co-op" automatically
- Category fallback: Falls back to category search when tags return 0
- NULL handling: Improved game search with NULL review percentage support

## Data Sources & Rate Limits

| Source | Rate Limit | Data | Notes |
|--------|------------|------|-------|
| Steam GetAppList | 100k/day | All appIDs | Master list |
| Steam Storefront | ~200/5min | Metadata, dev/pub | **AUTHORITATIVE for dev/pub** |
| Steam Reviews | ~60/min | Review counts, scores | 3x throughput (v2.2) |
| Steam Histogram | ~60/min | Monthly review buckets | |
| Steam CCU API | 1/sec | Exact player counts | GetNumberOfCurrentPlayers (v2.2) |
| SteamSpy | 1/sec | CCU, owners, tags | Has gaps, NOT authoritative for dev/pub |
| PICS Service | ~200 apps/req | Tags, genres, Steam Deck | Real-time via SteamKit2 |

## Priority-Based Sync Scheduling

| Tier | Criteria | Interval |
|------|----------|----------|
| `active` | CCU > 100 OR reviews/day > 1 | 6-12h |
| `moderate` | CCU > 0 | 24-48h |
| `dormant` | No activity 90 days | Weekly |
| `dead` | No activity 1 year | Monthly |

**Priority Scoring:**
- CCU > 10,000: +100 pts | CCU > 1,000: +50 pts | CCU > 100: +25 pts
- Review velocity > 10/day: +40 pts
- Trending (>10% change): +25 pts
- Dead game: -50 pts
- Never-synced apps: +25 pts base (v2.2 fix)

## Review Velocity Tiers (v2.1)

Adaptive sync intervals based on 7-day review activity:

| Tier | Reviews/Day | Sync Interval |
|------|-------------|---------------|
| High | ≥5 | 4 hours |
| Medium | 1-5 | 12 hours |
| Low | 0.1-1 | 24 hours |
| Dormant | <0.1 | 72 hours |

## CCU Tier System (v2.2)

Three-tier polling with Steam API for exact player counts:

| Tier | Criteria | Polling | Games |
|------|----------|---------|-------|
| 1 | Top 500 by 7-day peak CCU | Hourly | ~500 |
| 2 | Top 1000 newest releases (past year) | Every 2h | ~1000 |
| 3 | All other games | Daily | ~60,000+ |

**Key Features:**
- `ccu_source` column tracks provenance: `'steam_api'` vs `'steamspy'`
- 30-day snapshot retention with weekly aggregation
- Automatic tier reassignment via `recalculate_ccu_tiers()` RPC

## GitHub Actions Schedule (UTC)

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| applist-sync | 00:15 daily | Master app list |
| steamspy-sync | 02:15 daily | CCU, owners, tags |
| embedding-sync | 03:00 daily | Vector embeddings (games, publishers, developers) |
| histogram-sync | 04:15 daily | Monthly review trends |
| ccu-sync | :00 hourly | Tier 1+2 CCU polling |
| ccu-daily-sync | 04:30 daily | Tier 3 CCU polling |
| ccu-cleanup | Sunday 03:00 | Snapshot cleanup + aggregation |
| storefront-sync | 06,10,14,18,22:00 | Game metadata |
| reviews-sync | +30 min after storefront | Review counts |
| velocity-calculation | 08:00, 16:00, 00:00 | Velocity tier calculation |
| interpolation | 05:00 daily | Review delta interpolation |
| refresh-views | 05:00 daily | Materialized view refresh |
| trends-calculation | 22:00 daily | Trend metrics |
| priority-calculation | 22:30 daily | Priority scores |
| cleanup-chat-logs | 03:00 daily | 7-day log retention |

## PICS Service (Python on Railway)

**Modes:**
- `bulk_sync` - Initial load (~3 min for 70k apps)
- `change_monitor` - Continuous polling (every 30s)

**Data Extracted:** Tags, genres, categories, franchises, Steam Deck status, controller support, platforms, review scores, parent appid (for DLC), last content update

**Health Endpoints:** `GET /`, `GET /health`, `GET /status`

## Vector Similarity Search (Qdrant)

| Collection | Entity | Purpose |
|------------|--------|---------|
| `publisheriq_games` | Games | Find similar games |
| `publisheriq_publishers_portfolio` | Publishers | Match by entire catalog |
| `publisheriq_publishers_identity` | Publishers | Match by top games |
| `publisheriq_developers_portfolio` | Developers | Match by entire catalog |
| `publisheriq_developers_identity` | Developers | Match by top games |

**Embedding Model:** OpenAI text-embedding-3-small (1536 dimensions)
**Change Detection:** Hash-based (only re-embeds when data changes)

## Design System (v2.0)

- **Themes:** Light (default) + Dark with system preference detection
- **Persistence:** localStorage key `publisheriq-theme`
- **Fonts:** Geist Sans, Geist Mono
- **Color Tokens:** CSS variables (--surface, --text-primary, --accent-*, --trend-*)
- **Components:** ThemeProvider, ThemeToggle, CollapsibleSection, DenseMetricGrid, StatusBar

## Common Patterns

### Adding a New Cube Dimension/Measure
1. Update cube model in `packages/cube/model/`
2. Update system prompt in `apps/admin/src/lib/llm/cube-system-prompt.ts`
3. Rebuild Cube.js: `pnpm --filter cube build`

### Adding a New Sync Worker
1. Create API client in `packages/ingestion/src/apis/`
2. Create worker in `packages/ingestion/src/workers/`
3. Add script to `packages/ingestion/package.json`
4. Create GitHub Action in `.github/workflows/`
5. Update database schema if needed

### Modifying Database Schema
1. Create migration in `supabase/migrations/` with timestamp prefix
2. Apply via Supabase SQL Editor or CLI: `supabase db push`
3. Regenerate types: `pnpm --filter database generate`

### Refreshing Materialized Views
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY publisher_metrics;
REFRESH MATERIALIZED VIEW CONCURRENTLY developer_metrics;
```

## Debugging Tips

### Chat Not Working
1. Check `LLM_PROVIDER` and API key in env
2. Check Cube.js connection (`CUBE_API_URL`, `CUBE_API_SECRET`)
3. View chat logs at `/admin` (Chat Logs section)
4. Check browser console for streaming errors
5. High iteration count (4-5) indicates LLM struggling

### Sync Failures
1. Check `sync_jobs` table for error messages
2. Check `sync_status` for apps with `consecutive_errors > 0`
3. Verify rate limiting isn't being exceeded
4. Check GitHub Actions logs
5. 2-hour timeout detection for stale jobs

### Missing Data
1. Verify migrations are applied (check tables exist)
2. Check if `storefront_accessible = false`
3. Run bulk sync workers if needed
4. Check PICS service logs on Railway
5. Check `pics_sync_state` for last change number

## Documentation

Full documentation in `/docs/`:
- [Architecture Overview](docs/architecture/overview.md)
- [Chat Data System](docs/architecture/chat-data-system.md) - Complete chat/Cube.js reference
- [Database Schema](docs/architecture/database-schema.md) - Full schema with SQL examples
- [Design System](docs/architecture/design-system.md) - Theme system and components
- [Admin Dashboard](docs/architecture/admin-dashboard.md) - Dashboard architecture
- [Data Sources](docs/architecture/data-sources.md) - API specifications
- [Sync Pipeline](docs/architecture/sync-pipeline.md) - Data flow details
- [v2.0 Release Notes](docs/releases/v2.0-new-design.md) - Design system, query optimization
- [v2.1 Release Notes](docs/releases/v2.1-velocity-auth.md) - Velocity sync, authentication
- [v2.2 Release Notes](docs/releases/v2.2-ccu-steamspy.md) - CCU tiers, SteamSpy improvements
