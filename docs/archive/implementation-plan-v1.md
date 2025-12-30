# PublisherIQ Implementation Plan

## Overview

Build a Steam Publisher & Developer data acquisition platform to track games, reviews, trends, and historical metrics.

**Project:** `publisheriq` (private GitHub repo)

**Architecture:**
- **Database:** Supabase (PostgreSQL)
- **Workers:** GitHub Actions (scheduled data ingestion, conservative schedule)
- **Dashboard:** Next.js on Vercel (minimal admin UI)
- **Language:** TypeScript throughout

**Why this stack:**
- GitHub Actions: 2,000 free min/month for private repos, 6-hour timeout, native cron
- Supabase: Generous free tier (500MB), PostgreSQL with great TypeScript support
- Vercel: Easy Next.js deployment for the admin dashboard

---

## Quick Reference - API Endpoints

| API | Endpoint | Rate Limit | Data |
|-----|----------|------------|------|
| Steam App List | `api.steampowered.com/ISteamApps/GetAppList/v2/` | 100K/day | All appids |
| SteamSpy All | `steamspy.com/api.php?request=all&page={n}` | 1/60sec | 1000 apps/page |
| SteamSpy Detail | `steamspy.com/api.php?request=appdetails&appid={id}` | 1/sec | Full details |
| Storefront | `store.steampowered.com/api/appdetails/?appids={id}` | ~200/5min | Game metadata |
| Reviews | `store.steampowered.com/appreviews/{id}?json=1` | ~20/min | Review summary |
| Histogram | `store.steampowered.com/appreviewhistogram/{id}` | ~60/min | Monthly trends |
| Community Hub | `steamcommunity.com/app/{id}` | 1/1.5sec | Scrape for Founded date |

**Test commands:**
```bash
# Test SteamSpy
curl "https://steamspy.com/api.php?request=appdetails&appid=730"

# Test Storefront
curl "https://store.steampowered.com/api/appdetails/?appids=730"

# Test Review Histogram
curl "https://store.steampowered.com/appreviewhistogram/730?l=english"

# Test Reviews
curl "https://store.steampowered.com/appreviews/730?json=1"
```

---

## Getting Started Checklist

- [ ] Create GitHub repository (private)
- [ ] Create Supabase project at https://supabase.com
- [ ] Get Steam API key at https://steamcommunity.com/dev/apikey
- [ ] Create Vercel project (link to GitHub repo)
- [ ] Add GitHub Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `STEAM_API_KEY`
- [ ] Add Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Project Structure (Turborepo Monorepo)

```
publisheriq/
├── .github/workflows/           # GitHub Actions for data ingestion
│   ├── steamspy-sync.yml        # Daily full catalog (2:15 AM UTC)
│   ├── applist-sync.yml         # Daily Steam app list (12:15 AM UTC)
│   ├── storefront-details.yml   # Hourly 6AM-8PM UTC
│   ├── reviews-sync.yml         # Hourly 10AM-6PM UTC
│   ├── histogram-sync.yml       # Daily batch (4:15 AM UTC)
│   ├── page-creation-scrape.yml # Hourly 8AM-7PM UTC
│   ├── trends-calculation.yml   # Daily (10 PM UTC)
│   └── ci.yml                   # PR checks
├── apps/
│   └── admin/                   # Next.js admin dashboard
├── packages/
│   ├── database/                # Supabase client + generated types
│   ├── ingestion/               # API clients, scrapers, workers
│   └── shared/                  # Constants, utilities, logger
├── supabase/
│   └── migrations/              # Database schema
├── turbo.json
└── package.json
```

---

## Phase 1: Foundation (Days 1-5)

### Day 1-2: Project Setup

1. **Create GitHub repository**
2. **Initialize Turborepo monorepo:**
   ```bash
   npx create-turbo@latest publisheriq
   ```
3. **Set up packages:**
   - `packages/database` - Supabase client
   - `packages/ingestion` - Data fetching
   - `packages/shared` - Utilities
4. **Configure TypeScript, ESLint, Prettier**

### Day 2-3: Supabase Database

1. **Create Supabase project**
2. **Apply migrations:**

**Core tables:**
- `publishers` - Publisher names, game counts
- `developers` - Developer names, game counts
- `apps` - Games with appid, name, release_date, page_creation_date, has_workshop
- `app_developers` / `app_publishers` - Many-to-many relationships
- `app_tags` - Tags per game

**Historical tables:**
- `daily_metrics` - Daily snapshots (owners, CCU, reviews, pricing)
- `review_histogram` - Monthly positive/negative review counts

**Operational tables:**
- `app_trends` - Computed 30d/90d trends
- `sync_status` - Track last sync per source, priority scores
- `sync_jobs` - Job logging for monitoring

### Day 3-4: Database Package

```typescript
// packages/database/src/client.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export const createSupabaseClient = () =>
  createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
```

### Day 4-5: Shared Utilities

```typescript
// packages/ingestion/src/utils/rate-limiter.ts
// Token bucket rate limiter with queue

// Rate limits:
// - SteamSpy general: 1/sec
// - SteamSpy "all": 1/60sec
// - Storefront: ~200/5min (~0.67/sec)
// - Reviews: ~20/min (~0.33/sec)
// - Scraping: 1/1.5sec (conservative)
```

---

## Phase 2: Data Ingestion (Days 6-14)

### Day 6: Steam App List

**File:** `packages/ingestion/src/apis/steam-web.ts`

```typescript
// GET https://api.steampowered.com/ISteamApps/GetAppList/v2/
// Returns all ~70K appids on Steam
```

### Day 7: SteamSpy API

**File:** `packages/ingestion/src/apis/steamspy.ts`

```typescript
// Endpoints:
// - ?request=all&page={n} - 1000 games/page, 1 req/60sec
// - ?request=appdetails&appid={id} - Full details, 1 req/sec

// Returns: developer, publisher, owners, ccu, tags, price
```

### Day 8: Storefront API

**File:** `packages/ingestion/src/apis/storefront.ts`

```typescript
// GET https://store.steampowered.com/api/appdetails/?appids={id}
// Returns: developers[], publishers[], release_date,
//          categories (workshop check), price_overview
```

### Day 9: Reviews APIs

**File:** `packages/ingestion/src/apis/reviews.ts`

```typescript
// Summary: GET /appreviews/{appid}?json=1
// Returns: review_score, review_score_desc, total_positive/negative

// Histogram: GET /appreviewhistogram/{appid}?l=english
// Returns: monthly buckets of recommendations_up/down (for trends!)
```

### Day 10: Page Creation Scraper

**File:** `packages/ingestion/src/scrapers/page-creation.ts`

```typescript
// Scrape: https://steamcommunity.com/app/{appid}
// Look for "Founded" field in HTML
// Use Cheerio (not Puppeteer - pages are server-rendered)
// Rate limit: 1 req/1.5sec
```

### Day 11-12: Worker Entry Points

**Files:** `packages/ingestion/src/workers/*.ts`

Each worker:
1. Creates sync_jobs record
2. Fetches apps due for sync (by priority)
3. Processes in batches with rate limiting
4. Updates sync_status timestamps
5. Logs results

### Day 13-14: GitHub Actions Workflows

**Schedule (Conservative - fits in 2,000 free min/month):**
| Workflow | Schedule | Duration | Monthly |
|----------|----------|----------|---------|
| SteamSpy full | 2:15 AM daily | ~45 min | ~1,350 min |
| App list | 12:15 AM daily | ~1 min | ~30 min |
| Storefront | Every 3 hrs (5 runs) | ~20 min | ~300 min |
| Reviews | Every 3 hrs (5 runs) | ~15 min | ~225 min |
| Histogram | 4:15 AM daily | ~3 min | ~90 min |
| Page scraper | Twice daily | ~15 min | ~30 min |
| Trends calc | 10:00 PM daily | ~2 min | ~60 min |
| **Total** | | | **~2,085 min** |

*Note: Can scale up frequency later if you upgrade or switch to public repo.*

---

## Phase 3: Admin Dashboard (Days 15-18)

### Minimal Admin UI Pages

1. **Dashboard Home** - Sync status overview, recent jobs
2. **Sync Status** - Table of recent sync_jobs, errors
3. **Publishers** - List/search publishers, game counts
4. **Developers** - List/search developers, game counts
5. **Games** - Search games, view trends
6. **Chat Interface** - Natural language database queries

### Tech Stack
- Next.js 15 (App Router)
- Tailwind CSS
- Supabase client (read-only anon key)
- LLM: Claude 3.5 Haiku (Anthropic) / GPT-4o-mini (OpenAI)
- Deploy to Vercel

## Phase 4: Chat Interface (COMPLETE)

### AI-Powered Query Interface

Natural language interface for querying the Steam database using Claude AI.

**Features Implemented:**
- Query database using plain English
- Structured responses with markdown tables
- Clickable game links (`[Game Name](game:APPID)`)
- SQL syntax highlighting with Shiki
- Expandable query details (SQL + reasoning)
- Collapsible long responses
- Copy buttons for code blocks

**Key Files:**
- `apps/admin/src/app/chat/page.tsx` - Chat page
- `apps/admin/src/app/api/chat/route.ts` - Chat API endpoint
- `apps/admin/src/lib/query-executor.ts` - Query validation & execution
- `apps/admin/src/lib/llm/system-prompt.ts` - Schema documentation for AI
- `apps/admin/src/lib/llm/providers/` - LLM provider implementations

**Security:**
- Dual-layer query validation (client + database function)
- 31 blocked SQL keywords
- 50 row result limit
- 5000 character query limit

See [Chat Interface Guide](CHAT_INTERFACE.md) for user documentation.

---

## Environment Variables

**GitHub Secrets (for Actions):**
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
STEAM_API_KEY=xxx
```

**Vercel (for Dashboard):**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# Chat Interface (choose one provider)
LLM_PROVIDER=anthropic  # 'anthropic' or 'openai'
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

---

## Priority System

Since we can't update all 70K apps daily, use priority scoring:

```typescript
function calculatePriority(app) {
  let priority = 0;

  // CCU-based (popular games = higher priority)
  if (ccu > 10000) priority += 100;
  else if (ccu > 1000) priority += 50;
  else if (ccu > 100) priority += 25;

  // Review activity
  if (reviewVelocity7d > 10) priority += 40;

  // Trending games
  if (Math.abs(trend30dChange) > 10) priority += 25;

  // Dead game penalty
  if (ccu === 0 && reviewVelocity30d < 0.1) priority -= 50;

  return priority;
}
```

**Target:** Update top ~3,000-5,000 priority apps daily.

---

## Throughput Estimates

| Source | Rate Limit | Items/Day |
|--------|------------|-----------|
| SteamSpy (all) | 1/60s | ~30K (full catalog) |
| Storefront | ~200/5min | ~3,000 |
| Reviews | ~20/min | ~3,000 |
| Histogram | ~60/min | ~3,600 |
| Scraper | 1/1.5s | ~600 |

Page creation dates are immutable - only need to scrape once per app.

---

## Files to Create (in order)

### Phase 1
1. `package.json` (root) - Turborepo config
2. `turbo.json` - Turborepo pipeline
3. `supabase/migrations/001_initial_schema.sql`
4. `packages/database/src/client.ts`
5. `packages/shared/src/constants.ts` - Rate limits
6. `packages/ingestion/src/utils/rate-limiter.ts`
7. `packages/ingestion/src/utils/retry.ts`

### Phase 2
8. `packages/ingestion/src/apis/steam-web.ts`
9. `packages/ingestion/src/apis/steamspy.ts`
10. `packages/ingestion/src/apis/storefront.ts`
11. `packages/ingestion/src/apis/reviews.ts`
12. `packages/ingestion/src/scrapers/page-creation.ts`
13. `packages/ingestion/src/workers/steamspy-worker.ts`
14. `packages/ingestion/src/workers/details-worker.ts`
15. `packages/ingestion/src/processors/trends.ts`
16. `.github/workflows/steamspy-sync.yml`
17. `.github/workflows/storefront-details.yml`
18. (remaining workflows)

### Phase 3
19. `apps/admin/src/app/page.tsx`
20. `apps/admin/src/app/sync-status/page.tsx`
21. (remaining dashboard pages)

---

## Cost Estimate

| Service | Cost |
|---------|------|
| Supabase | Free tier (500MB) |
| GitHub Actions | Free 2,000 min/month (private repo) |
| Vercel | Free tier (hobby) |
| **Total MVP** | **$0/month** |

*Conservative schedule stays within free tier. If you need more frequent updates:*
- GitHub Actions overages: $0.008/min (~$8-10/month)
- Or switch to public repo for unlimited minutes
- Supabase Pro: $25/month (if you exceed 500MB)
- Vercel Pro: $20/month

---

## Appendix: Complete Database Schema

```sql
-- =============================================
-- ENUMS
-- =============================================
CREATE TYPE app_type AS ENUM ('game', 'dlc', 'demo', 'mod', 'video', 'hardware', 'music');
CREATE TYPE sync_source AS ENUM ('steamspy', 'storefront', 'reviews', 'histogram', 'scraper');
CREATE TYPE trend_direction AS ENUM ('up', 'down', 'stable');
CREATE TYPE refresh_tier AS ENUM ('active', 'moderate', 'dormant', 'dead');

-- =============================================
-- CORE ENTITIES
-- =============================================

CREATE TABLE publishers (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    normalized_name TEXT NOT NULL,
    steam_vanity_url TEXT,
    first_game_release_date DATE,
    first_page_creation_date DATE,
    game_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE developers (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    normalized_name TEXT NOT NULL,
    steam_vanity_url TEXT,
    first_game_release_date DATE,
    first_page_creation_date DATE,
    game_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE apps (
    appid INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type app_type DEFAULT 'game',
    is_free BOOLEAN DEFAULT FALSE,
    release_date DATE,
    release_date_raw TEXT,
    page_creation_date DATE,
    page_creation_date_raw TEXT,
    has_workshop BOOLEAN DEFAULT FALSE,
    has_developer_info BOOLEAN DEFAULT FALSE,  -- TRUE once dev/pub fetched
    current_price_cents INTEGER,
    current_discount_percent INTEGER DEFAULT 0,
    is_released BOOLEAN DEFAULT TRUE,
    is_delisted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_developers (
    appid INTEGER REFERENCES apps(appid) ON DELETE CASCADE,
    developer_id INTEGER REFERENCES developers(id) ON DELETE CASCADE,
    PRIMARY KEY (appid, developer_id)
);

CREATE TABLE app_publishers (
    appid INTEGER REFERENCES apps(appid) ON DELETE CASCADE,
    publisher_id INTEGER REFERENCES publishers(id) ON DELETE CASCADE,
    PRIMARY KEY (appid, publisher_id)
);

CREATE TABLE app_tags (
    appid INTEGER REFERENCES apps(appid) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    vote_count INTEGER DEFAULT 0,
    PRIMARY KEY (appid, tag)
);

-- =============================================
-- HISTORICAL METRICS
-- =============================================

CREATE TABLE daily_metrics (
    id BIGSERIAL PRIMARY KEY,
    appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    owners_min INTEGER,
    owners_max INTEGER,
    ccu_peak INTEGER,
    average_playtime_forever INTEGER,
    average_playtime_2weeks INTEGER,
    total_reviews INTEGER,
    positive_reviews INTEGER,
    negative_reviews INTEGER,
    review_score SMALLINT,
    review_score_desc TEXT,
    recent_total_reviews INTEGER,
    recent_positive INTEGER,
    recent_negative INTEGER,
    recent_score_desc TEXT,
    price_cents INTEGER,
    discount_percent SMALLINT DEFAULT 0,
    UNIQUE(appid, metric_date)
);

CREATE TABLE review_histogram (
    id BIGSERIAL PRIMARY KEY,
    appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
    month_start DATE NOT NULL,
    recommendations_up INTEGER NOT NULL,
    recommendations_down INTEGER NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(appid, month_start)
);

-- =============================================
-- COMPUTED TRENDS
-- =============================================

CREATE TABLE app_trends (
    appid INTEGER PRIMARY KEY REFERENCES apps(appid) ON DELETE CASCADE,
    trend_30d_direction trend_direction,
    trend_30d_change_pct DECIMAL(6,2),
    trend_90d_direction trend_direction,
    trend_90d_change_pct DECIMAL(6,2),
    current_positive_ratio DECIMAL(5,4),
    previous_positive_ratio DECIMAL(5,4),
    review_velocity_7d DECIMAL(10,2),
    review_velocity_30d DECIMAL(10,2),
    ccu_trend_7d_pct DECIMAL(6,2),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SYNC TRACKING
-- =============================================

CREATE TABLE sync_status (
    appid INTEGER PRIMARY KEY REFERENCES apps(appid) ON DELETE CASCADE,
    last_steamspy_sync TIMESTAMPTZ,
    last_storefront_sync TIMESTAMPTZ,
    last_reviews_sync TIMESTAMPTZ,
    last_histogram_sync TIMESTAMPTZ,
    last_page_creation_scrape TIMESTAMPTZ,
    priority_score INTEGER DEFAULT 0,
    priority_calculated_at TIMESTAMPTZ,
    refresh_tier refresh_tier DEFAULT 'moderate',
    next_sync_after TIMESTAMPTZ DEFAULT NOW(),
    sync_interval_hours INTEGER DEFAULT 24,
    consecutive_errors INTEGER DEFAULT 0,
    last_error_source sync_source,
    last_error_message TEXT,
    last_error_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    needs_page_creation_scrape BOOLEAN DEFAULT TRUE,
    is_syncable BOOLEAN DEFAULT TRUE
);

CREATE TABLE sync_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_type TEXT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'running',
    items_processed INTEGER DEFAULT 0,
    items_succeeded INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    batch_size INTEGER,
    error_message TEXT,
    github_run_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_publishers_normalized ON publishers(normalized_name);
CREATE INDEX idx_developers_normalized ON developers(normalized_name);
CREATE INDEX idx_apps_name ON apps(name);
CREATE INDEX idx_apps_type ON apps(type) WHERE type = 'game';
CREATE INDEX idx_daily_metrics_appid_date ON daily_metrics(appid, metric_date DESC);
CREATE INDEX idx_review_histogram_appid_month ON review_histogram(appid, month_start DESC);
CREATE INDEX idx_sync_status_priority ON sync_status(priority_score DESC) WHERE is_syncable = TRUE;
CREATE INDEX idx_sync_status_needs_scrape ON sync_status(appid) WHERE needs_page_creation_scrape = TRUE;
CREATE INDEX idx_app_tags_tag ON app_tags(tag);
```

---

## Appendix: Sample GitHub Actions Workflow

```yaml
# .github/workflows/steamspy-sync.yml
name: SteamSpy Sync

on:
  schedule:
    - cron: '15 2 * * *'  # 2:15 AM UTC daily
  workflow_dispatch:

env:
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 60

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm --filter @publisheriq/ingestion build

      - name: Run SteamSpy sync
        run: pnpm --filter @publisheriq/ingestion steamspy-sync
        env:
          GITHUB_RUN_ID: ${{ github.run_id }}
```

---

## Appendix: Useful SQL Queries

```sql
-- Find games trending UP in last 30 days
SELECT
    a.appid, a.name, t.trend_30d_change_pct,
    dm.total_reviews, dm.ccu_peak
FROM apps a
JOIN app_trends t ON a.appid = t.appid
JOIN daily_metrics dm ON a.appid = dm.appid
    AND dm.metric_date = CURRENT_DATE - 1
WHERE t.trend_30d_direction = 'up'
    AND t.trend_30d_change_pct > 5
    AND dm.total_reviews > 100
ORDER BY t.trend_30d_change_pct DESC
LIMIT 50;

-- Apps needing sync (by priority)
SELECT appid, priority_score, last_storefront_sync
FROM sync_status
WHERE is_syncable = TRUE
    AND next_sync_after <= NOW()
ORDER BY priority_score DESC
LIMIT 100;

-- Publisher game counts
SELECT p.name, COUNT(ap.appid) as game_count
FROM publishers p
JOIN app_publishers ap ON p.id = ap.publisher_id
GROUP BY p.id
ORDER BY game_count DESC
LIMIT 20;

-- Review histogram for trend analysis
SELECT month_start, recommendations_up, recommendations_down,
    ROUND(recommendations_up::decimal / NULLIF(recommendations_up + recommendations_down, 0) * 100, 2) as positive_pct
FROM review_histogram
WHERE appid = 730
ORDER BY month_start DESC
LIMIT 12;
```
