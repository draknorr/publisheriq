# Steam Publisher & Developer Data Acquisition Plan
## Version 2.0 - Implementation Complete

## Executive Summary

This document describes the implemented data acquisition system for building a near real-time database of Steam publisher and developer information. The system uses free APIs with intelligent caching and priority-based scheduling.

**Implementation Status: COMPLETE**

**Key Features:**
- Track both game release dates AND Steam page creation dates
- Review ratings/sentiment over time for trend analysis (NOT review text)
- Workshop support as boolean only
- Historical tracking of all metrics
- Priority-based update cycles distributed via GitHub Actions

---

## Data Requirements Recap

| Data Category | Description | Update Frequency | Source |
|---------------|-------------|------------------|--------|
| **App List** | Master list of all Steam apps | Daily | Steam IStoreService API |
| **Games Catalog** | All games per publisher/developer | 5x/day | Storefront API |
| **Game Release Date** | Official release date on Steam | Once (immutable) | Storefront API |
| **Page Creation Date** | When the Steam page was first created | Once (immutable) | Community Hub scraping |
| **Review Trends** | Monthly positive/negative reviews over time | Daily | Review Histogram API |
| **Current Sentiment** | Overall + Recent review scores | 5x/day | Reviews API |
| **Workshop Support** | Boolean - does game support workshop? | Once | Storefront API (category 30) |
| **CCU/Players** | Peak concurrent users | Daily | SteamSpy |
| **Metadata** | Tags, genres, ownership estimates | Daily | SteamSpy |

---

## Tier 1: Official Steam APIs (FREE)

### 1.1 Steam IStoreService API (App List)

**Best for:** Complete list of all Steam apps (paginated)

**Endpoint:**
```
GET https://api.steampowered.com/IStoreService/GetAppList/v1/?key={API_KEY}&include_games=true&include_dlc=true&include_software=true&include_videos=true&include_hardware=true&max_results=50000
```

**Parameters:**
| Parameter | Description |
|-----------|-------------|
| `key` | Required Steam API key |
| `include_games` | Include games |
| `include_dlc` | Include DLC |
| `include_software` | Include software |
| `include_videos` | Include videos |
| `include_hardware` | Include hardware |
| `max_results` | Max items per page (up to 50,000) |
| `last_appid` | Pagination cursor |

**Response:**
```json
{
  "response": {
    "apps": [
      {
        "appid": 730,
        "name": "Counter-Strike 2",
        "last_modified": 1703980800,
        "price_change_number": 12345
      }
    ],
    "have_more_results": true,
    "last_appid": 12345
  }
}
```

**Rate Limits:** 100,000 requests/day with API key

**Implementation:** `packages/ingestion/src/apis/steam-web.ts`

---

### 1.2 Steam Storefront API

**Best for:** Detailed game metadata including developers/publishers

**Endpoint:**
```
GET https://store.steampowered.com/api/appdetails/?appids={appid}
```

**Response:**
```json
{
  "730": {
    "success": true,
    "data": {
      "type": "game",
      "name": "Counter-Strike 2",
      "steam_appid": 730,
      "is_free": true,
      "developers": ["Valve"],
      "publishers": ["Valve"],
      "price_overview": {
        "currency": "USD",
        "initial": 0,
        "final": 0,
        "discount_percent": 0
      },
      "platforms": {"windows": true, "mac": true, "linux": true},
      "categories": [
        {"id": 1, "description": "Multi-player"},
        {"id": 30, "description": "Steam Workshop"}
      ],
      "release_date": {
        "coming_soon": false,
        "date": "Aug 21, 2012"
      }
    }
  }
}
```

**Key Fields:**
- `developers[]` - Array of developer names (AUTHORITATIVE SOURCE)
- `publishers[]` - Array of publisher names (AUTHORITATIVE SOURCE)
- `categories[]` - Check for `id: 30` to detect Workshop support
- `release_date.date` - Official release date

**Rate Limits:** ~200 requests per 5 minutes (0.67 req/sec)

**Implementation:** `packages/ingestion/src/apis/storefront.ts`

---

### 1.3 Steam Review Histogram API (Critical for Trending)

**Best for:** Monthly review aggregates for trend analysis

**Endpoint:**
```
GET https://store.steampowered.com/appreviewhistogram/{appid}?l=english
```

**Response:**
```json
{
  "success": 1,
  "results": {
    "start_date": 1577836800,
    "end_date": 1703980800,
    "rollups": [
      {
        "date": 1577836800,
        "recommendations_up": 1250,
        "recommendations_down": 85
      },
      {
        "date": 1580515200,
        "recommendations_up": 980,
        "recommendations_down": 62
      }
    ],
    "rollup_type": "month"
  }
}
```

**Use Cases:**
- Calculate 30/90-day trend direction
- Detect review bombing events
- Track sentiment changes after updates

**Rate Limits:** ~60 requests per minute (1 req/sec)

**Implementation:** `packages/ingestion/src/apis/reviews.ts` (`fetchReviewHistogram()`)

---

### 1.4 Steam Reviews API

**Best for:** Current review counts and sentiment scores

**Endpoint:**
```
GET https://store.steampowered.com/appreviews/{appid}?json=1&num_per_page=0
```

**Response:**
```json
{
  "success": 1,
  "query_summary": {
    "num_reviews": 0,
    "review_score": 8,
    "review_score_desc": "Very Positive",
    "total_positive": 45000,
    "total_negative": 5000,
    "total_reviews": 50000
  }
}
```

**Rate Limits:** ~20 requests per minute (0.33 req/sec)

**Implementation:** `packages/ingestion/src/apis/reviews.ts` (`fetchReviewSummary()`)

---

## Tier 2: Third-Party Services

### 2.1 SteamSpy API (FREE - Enrichment Only)

**Best for:** CCU, owner estimates, playtime, tags

**Endpoints:**
| Endpoint | Rate Limit | Use |
|----------|------------|-----|
| `?request=all&page={n}` | 1 req/60sec | Full catalog |
| `?request=appdetails&appid={id}` | 1 req/sec | Single app details |
| `?request=top100in2weeks` | 1 req/sec | Popular games |

**Response (appdetails):**
```json
{
  "appid": 730,
  "name": "Counter-Strike 2",
  "developer": "Valve",
  "publisher": "Valve",
  "owners": "50,000,000 .. 100,000,000",
  "ccu": 850000,
  "average_forever": 35000,
  "average_2weeks": 1200,
  "positive": 4500000,
  "negative": 500000,
  "tags": {"FPS": 12000, "Shooter": 11500}
}
```

**IMPORTANT:** Do NOT use SteamSpy's `developer` and `publisher` fields - they have gaps. Use Steam Storefront API instead.

**Implementation:** `packages/ingestion/src/apis/steamspy.ts`

---

## Tier 3: Scraping (Page Creation Dates)

### 3.1 Steam Community Hub Scraping

The "Founded" date (when a Steam page was created) is NOT available via any API.

**URL Pattern:**
```
https://steamcommunity.com/app/{appid}
```

**Scraping Logic:**
1. Fetch page HTML
2. Look for "Founded" text in group info section
3. Parse date from surrounding context
4. Cache result forever (date is immutable)

**Rate Limits:** 1 request per 1.5 seconds (conservative)

**Implementation:** `packages/ingestion/src/scrapers/page-creation.ts`

---

## Database Schema (Supabase PostgreSQL)

### Core Tables

```sql
-- Enums
CREATE TYPE app_type AS ENUM ('game', 'dlc', 'demo', 'mod', 'video', 'hardware', 'music');
CREATE TYPE sync_source AS ENUM ('steamspy', 'storefront', 'reviews', 'histogram', 'scraper');
CREATE TYPE trend_direction AS ENUM ('up', 'down', 'stable');
CREATE TYPE refresh_tier AS ENUM ('active', 'moderate', 'dormant', 'dead');

-- Publishers
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

-- Developers
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

-- Apps
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
    has_developer_info BOOLEAN DEFAULT FALSE,
    current_price_cents INTEGER,
    current_discount_percent INTEGER DEFAULT 0,
    is_released BOOLEAN DEFAULT TRUE,
    is_delisted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Many-to-many relationships
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

-- App tags (from SteamSpy)
CREATE TABLE app_tags (
    appid INTEGER REFERENCES apps(appid) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    vote_count INTEGER DEFAULT 0,
    PRIMARY KEY (appid, tag)
);
```

### Historical Metrics Tables

```sql
-- Daily metrics (snapshots)
CREATE TABLE daily_metrics (
    id BIGSERIAL PRIMARY KEY,
    appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
    metric_date DATE NOT NULL,

    -- From SteamSpy
    owners_min INTEGER,
    owners_max INTEGER,
    ccu_peak INTEGER,
    average_playtime_forever INTEGER,
    average_playtime_2weeks INTEGER,

    -- From Reviews API
    total_reviews INTEGER,
    positive_reviews INTEGER,
    negative_reviews INTEGER,
    review_score SMALLINT,
    review_score_desc TEXT,
    recent_total_reviews INTEGER,
    recent_positive INTEGER,
    recent_negative INTEGER,
    recent_score_desc TEXT,

    -- From Storefront API
    price_cents INTEGER,
    discount_percent SMALLINT DEFAULT 0,

    UNIQUE(appid, metric_date)
);

-- Review histogram (monthly aggregates)
CREATE TABLE review_histogram (
    id BIGSERIAL PRIMARY KEY,
    appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
    month_start DATE NOT NULL,
    recommendations_up INTEGER NOT NULL,
    recommendations_down INTEGER NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(appid, month_start)
);

-- Computed trends
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
```

### Sync Tracking Tables

```sql
-- Per-app sync status
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

-- Job execution history
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
```

### Database Functions

```sql
-- Upsert developer and return ID
CREATE FUNCTION upsert_developer(p_name TEXT) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
    v_normalized TEXT;
BEGIN
    v_normalized := LOWER(TRIM(p_name));
    INSERT INTO developers (name, normalized_name)
    VALUES (TRIM(p_name), v_normalized)
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Get apps due for sync (priority-ordered)
CREATE FUNCTION get_apps_for_sync(p_source sync_source, p_limit INTEGER)
RETURNS TABLE(appid INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT s.appid
  FROM sync_status s
  JOIN apps a ON s.appid = a.appid
  WHERE s.is_syncable = TRUE
    AND s.next_sync_after <= NOW()
    AND (
      (p_source = 'storefront' AND (s.last_storefront_sync IS NULL OR s.last_storefront_sync < NOW() - INTERVAL '1 day'))
      OR (p_source = 'reviews' AND (s.last_reviews_sync IS NULL OR s.last_reviews_sync < NOW() - INTERVAL '1 day'))
      OR (p_source = 'histogram' AND (s.last_histogram_sync IS NULL OR s.last_histogram_sync < NOW() - INTERVAL '1 day'))
      OR (p_source = 'steamspy' AND (s.last_steamspy_sync IS NULL OR s.last_steamspy_sync < NOW() - INTERVAL '1 day'))
      OR (p_source = 'scraper' AND s.needs_page_creation_scrape = TRUE)
    )
  ORDER BY
    CASE WHEN p_source = 'storefront' AND a.has_developer_info = FALSE THEN 0 ELSE 1 END,
    s.priority_score DESC,
    s.next_sync_after ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

---

## GitHub Actions Schedule

### Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HOUR  │ 00 │ 02 │ 04 │ 06 │ 08 │ 10 │ 12 │ 14 │ 16 │ 18 │ 20 │ 22 │       │
├───────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼───────┤
│AppList│ ██ │    │    │    │    │    │    │    │    │    │    │    │ Batch │
│SteamSpy│   │ ██ │    │    │    │    │    │    │    │    │    │    │ Batch │
│Histgrm │   │    │ ██ │    │    │    │    │    │    │    │    │    │ Batch │
│Storfnt │   │    │    │ ██ │    │ ██ │    │ ██ │    │ ██ │    │ ██ │ 5x/day│
│Reviews │   │    │    │ ─► │    │ ─► │    │ ─► │    │ ─► │    │ ─► │ 5x/day│
│Trends  │   │    │    │    │    │    │    │    │    │    │    │ ██ │ Calc  │
│Priority│   │    │    │    │    │    │    │    │    │    │    │ ─► │ Calc  │
└─────────────────────────────────────────────────────────────────────────────┘

██ = Batch job runs
─► = Stream job runs (30 min after storefront)
```

### Workflow Files

| File | Schedule (UTC) | Timeout | Worker |
|------|----------------|---------|--------|
| `applist-sync.yml` | 00:15 daily | 10 min | `applist-worker.ts` |
| `steamspy-sync.yml` | 02:15 daily | 180 min | `steamspy-worker.ts` |
| `histogram-sync.yml` | 04:15 daily | 15 min | `histogram-worker.ts` |
| `storefront-sync.yml` | 06:00, 10:00, 14:00, 18:00, 22:00 | 120 min | `storefront-worker.ts` |
| `reviews-sync.yml` | 06:30, 10:30, 14:30, 18:30, 22:30 | 120 min | `reviews-worker.ts` |
| `trends-calculation.yml` | 22:00 daily | 10 min | `trends-worker.ts` |
| `priority-calculation.yml` | 22:30 daily | 60 min | `priority-worker.ts` |

---

## Rate Limiting Implementation

### Token Bucket Algorithm

```typescript
// packages/shared/src/constants.ts
export const RATE_LIMITS = {
  STEAMSPY_GENERAL: { requestsPerSecond: 1, burst: 1 },
  STEAMSPY_ALL: { requestsPerSecond: 1/60, burst: 1 },
  STOREFRONT: { requestsPerSecond: 0.67, burst: 10 },
  REVIEWS: { requestsPerSecond: 0.33, burst: 5 },
  HISTOGRAM: { requestsPerSecond: 1, burst: 5 },
  COMMUNITY_SCRAPE: { requestsPerSecond: 0.67, burst: 1 },
};
```

### Retry Configuration

```typescript
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 30000,
  BACKOFF_MULTIPLIER: 2,
};
```

---

## Priority Scoring System

### Score Calculation

```typescript
// packages/shared/src/constants.ts
export const PRIORITY_THRESHOLDS = {
  CCU_HIGH: 10000,
  CCU_MEDIUM: 1000,
  CCU_LOW: 100,
  REVIEW_VELOCITY_HIGH: 10,
  TREND_SIGNIFICANT: 10,
  DEAD_GAME_VELOCITY: 0.1,
};

export const PRIORITY_SCORES = {
  CCU_HIGH: 100,       // CCU > 10,000
  CCU_MEDIUM: 50,      // CCU > 1,000
  CCU_LOW: 25,         // CCU > 100
  REVIEW_ACTIVITY_HIGH: 40,  // velocity > 10/day
  TRENDING: 25,        // trend change > 10%
  DEAD_GAME_PENALTY: -50,
};
```

### Refresh Tier Mapping

| Tier | Criteria | Sync Interval |
|------|----------|---------------|
| active | CCU > 100 OR reviews/day > 1 | 6-12 hours |
| moderate | CCU > 0 | 24-48 hours |
| dormant | No activity 90 days | Weekly |
| dead | No activity 1 year | Monthly+ |

---

## Trend Calculation

### Algorithm

1. Fetch last 12 months of histogram data
2. Split into "recent" (last 30 days) and "previous" (30-90 days)
3. Calculate positive ratio for each period: `up / (up + down)`
4. Determine direction:
   - Change > 2%: "up"
   - Change < -2%: "down"
   - Otherwise: "stable"
5. Calculate percentage change: `(recent - previous) / previous * 100`

### Review Velocity

```typescript
// reviews per day = total reviews in period / days in period
review_velocity_7d = reviews_last_7_days / 7
review_velocity_30d = reviews_last_30_days / 30
```

---

## Cost Summary

| Service | Cost | Status |
|---------|------|--------|
| Steam Web API | FREE | Implemented |
| Steam Storefront API | FREE | Implemented |
| Steam Reviews API | FREE | Implemented |
| SteamSpy API | FREE | Implemented |
| Supabase (Free Tier) | FREE | Implemented |
| GitHub Actions | FREE (2000 min/mo) | Implemented |

**Total Cost: $0/month** (using free tiers)

---

## Quick Start Commands

```bash
# Test APIs
curl "https://steamspy.com/api.php?request=appdetails&appid=730"
curl "https://store.steampowered.com/api/appdetails/?appids=730"
curl "https://store.steampowered.com/appreviewhistogram/730?l=english"
curl "https://store.steampowered.com/appreviews/730?json=1"

# Run workers locally
pnpm --filter @publisheriq/ingestion applist-sync
pnpm --filter @publisheriq/ingestion steamspy-sync
pnpm --filter @publisheriq/ingestion storefront-sync
pnpm --filter @publisheriq/ingestion reviews-sync
pnpm --filter @publisheriq/ingestion histogram-sync
pnpm --filter @publisheriq/ingestion calculate-trends
pnpm --filter @publisheriq/ingestion update-priorities
```

---

## Sample Queries

### Find Games Trending Up

```sql
SELECT
    a.appid,
    a.name,
    d.name as developer,
    t.trend_30d_change_pct,
    t.current_positive_ratio,
    dm.total_reviews
FROM apps a
JOIN app_trends t ON a.appid = t.appid
JOIN daily_metrics dm ON a.appid = dm.appid
    AND dm.metric_date = CURRENT_DATE - 1
LEFT JOIN app_developers ad ON a.appid = ad.appid
LEFT JOIN developers d ON ad.developer_id = d.id
WHERE t.trend_30d_direction = 'up'
    AND t.trend_30d_change_pct > 5
    AND dm.total_reviews > 100
ORDER BY t.trend_30d_change_pct DESC
LIMIT 50;
```

### Publisher Performance Over Time

```sql
SELECT
    p.name as publisher,
    DATE_TRUNC('month', dm.metric_date) as month,
    AVG(dm.review_score) as avg_review_score,
    SUM(dm.ccu_peak) as total_ccu,
    COUNT(DISTINCT dm.appid) as active_games
FROM publishers p
JOIN app_publishers ap ON p.id = ap.publisher_id
JOIN daily_metrics dm ON ap.appid = dm.appid
WHERE dm.metric_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY p.name, DATE_TRUNC('month', dm.metric_date)
ORDER BY p.name, month DESC;
```

---

## File Locations

| Purpose | Path |
|---------|------|
| API Clients | `packages/ingestion/src/apis/` |
| Workers | `packages/ingestion/src/workers/` |
| Scraper | `packages/ingestion/src/scrapers/page-creation.ts` |
| Rate Limiter | `packages/ingestion/src/utils/rate-limiter.ts` |
| Retry Logic | `packages/ingestion/src/utils/retry.ts` |
| Constants | `packages/shared/src/constants.ts` |
| DB Types | `packages/database/src/types.ts` |
| Migrations | `supabase/migrations/` |
| GitHub Actions | `.github/workflows/` |
| Admin Dashboard | `apps/admin/` |
