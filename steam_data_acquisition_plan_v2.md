# Steam Publisher & Developer Data Acquisition Plan
## Version 2.0 - Updated with User Requirements

## Executive Summary

This document outlines a comprehensive data acquisition strategy for building a near real-time database of Steam publisher and developer information. The plan prioritizes free services and APIs, with paid options noted as fallbacks.

**Key User Requirements:**
- Track both game release dates AND Steam page creation dates
- Review ratings/sentiment over time for trend analysis (NOT review text)
- Workshop support as boolean only
- Historical tracking of all metrics
- 24-hour update cycles, distributed across the day to manage load

---

## Data Requirements Recap

| Data Category | Description | Update Frequency | Source |
|---------------|-------------|------------------|--------|
| **Publishers/Developers** | List of all publishers and developers | Daily | SteamSpy + Storefront API |
| **Games Catalog** | All games per publisher/developer | Daily | Steam API + SteamSpy |
| **Game Release Date** | Official release date on Steam | Once (immutable) | Storefront API |
| **Page Creation Date** | When the Steam page was first created | Once (immutable) | Community Hub scraping |
| **Review Trends** | Monthly positive/negative reviews over time | Daily | Review Histogram API |
| **Current Sentiment** | Overall + Recent review scores | Daily | Reviews API |
| **Workshop Support** | Boolean - does game support workshop? | Weekly | Storefront API |
| **CCU/Players** | Peak concurrent users | Daily | SteamSpy |
| **Metadata** | Tags, genres, pricing | Daily | SteamSpy + Storefront |

---

## Tier 1: Third-Party Services (Recommended First)

### 1.1 SteamSpy API ⭐ FREE

**Best for:** Developer/publisher names, owner estimates, CCU, playtime, tags, genres

**Base URL:** `https://steamspy.com/api.php`

**Available Endpoints:**
| Endpoint | Parameters | Returns |
|----------|------------|---------|
| `?request=appdetails&appid={id}` | appid | Full game details including developer, publisher |
| `?request=all&page={n}` | page (0-indexed) | 1,000 games per page with basic info |
| `?request=genre&genre={name}` | genre | Games filtered by genre |
| `?request=tag&tag={name}` | tag | Games filtered by tag |
| `?request=top100in2weeks` | - | Top 100 games by recent players |
| `?request=top100forever` | - | Top 100 games by all-time players |

**Data Fields Returned:**
```json
{
  "appid": 730,
  "name": "Counter-Strike 2",
  "developer": "Valve",
  "publisher": "Valve", 
  "score_rank": 85,
  "owners": "50,000,000 .. 100,000,000",
  "average_forever": 35000,
  "average_2weeks": 1200,
  "median_forever": 8000,
  "median_2weeks": 400,
  "ccu": 850000,
  "price": 0,
  "initialprice": 0,
  "discount": 0,
  "tags": {"FPS": 12000, "Shooter": 11500, ...},
  "languages": "English, French, German, ...",
  "genre": "Action, Free to Play"
}
```

**Rate Limits:**
- General requests: 1 request/second
- `?request=all`: 1 request/60 seconds
- Data refreshes once daily

**Python Example:**
```python
import requests
import time

def get_all_steam_games_from_steamspy():
    """Fetch all games from SteamSpy API"""
    all_games = {}
    page = 0
    
    while True:
        url = f"https://steamspy.com/api.php?request=all&page={page}"
        response = requests.get(url)
        data = response.json()
        
        if not data:
            break
            
        all_games.update(data)
        page += 1
        time.sleep(60)  # Rate limit for 'all' requests
        
    return all_games
```

**Limitations:**
- Owner data is estimates (ranges), not exact numbers
- Some developers request data removal
- Updates only once daily
- No historical data via API

---

### 1.2 SteamDB (Limited API Access) ⚠️ RESTRICTED

**Reality Check:** SteamDB does NOT provide a public API or data dumps. They explicitly prohibit scraping and AI training usage.

**What SteamDB offers:**
- Web interface for browsing Steam data
- Discord bot for queries
- GitHub tools (SteamKit2-based)

**Alternative approach - Use their open-source tools:**
- **SteamKit2** (C#): https://github.com/SteamRE/SteamKit
- Can connect to Steam network directly
- Used by SteamDB internally

**When to contact SteamDB:**
- Academic research only
- May grant limited access on case-by-case basis
- Requires university email and detailed project description

---

### 1.3 VG Insights ⭐ FREEMIUM

**Website:** https://vginsights.com

**Free Tier Includes:**
- Basic game searches
- Revenue estimates (limited)
- Genre/tag statistics
- Release trend data

**Paid Tier ($14.50/month via Patreon):**
- Full revenue/sales estimates
- Historical data since 2014
- Player insights for 7,500+ games
- Country split data
- Follower tracking since May 2021

**No public API** - Data must be accessed via web interface or scraped (carefully).

---

### 1.4 Gamalytic 💰 PAID

**Website:** https://gamalytic.com

**Pricing:**
| Tier | Price | Features |
|------|-------|----------|
| Basic | Free | Limited browsing |
| Pro | $19/month | Full game data, country split |
| Business | $49/month | Wishlist data, API access |
| Enterprise | Custom | Full API, bulk exports |

**Unique Data:**
- Wishlist overlaps
- Regional sales data (from June 2024)
- Player overlap analysis (up to 500 games)
- Detailed playtime distributions

**Recommendation:** Skip for MVP; consider for advanced analytics later.

---

### 1.5 SteamApis.com 💰 PAID (Market Data Focus)

**Website:** https://steamapis.com

**Focus:** Market/trading data, inventory management, item pricing

**Not ideal for:** Publisher/developer metadata (better alternatives exist)

---

## Tier 2: Official Steam APIs ⭐ FREE

### 2.1 Steam Web API (Public)

**Get API Key:** https://steamcommunity.com/dev/apikey

**Base URL:** `https://api.steampowered.com`

**Key Endpoints for Your Use Case:**

#### Get Full App List
```
GET /ISteamApps/GetAppList/v2/
```
Returns: All appIDs on Steam (70,000+ entries including demos, DLC, videos)

**Note:** No filtering available - you get everything and must filter client-side.

#### Get News for App
```
GET /ISteamNews/GetNewsForApp/v2/?appid={appid}&count=10
```
Returns: News/announcements for a game (useful for activity tracking)

#### Get Global Stats for Game
```
GET /ISteamUserStats/GetGlobalStatsForGame/v1/?appid={appid}&count=1&name[0]=stat_name
```

**Rate Limits:** 100,000 requests/day

---

### 2.2 Steam Storefront API (Undocumented) ⭐ FREE

**Critical for your use case** - this provides detailed game metadata including developer/publisher!

**Base URL:** `https://store.steampowered.com/api/`

#### App Details (MOST IMPORTANT)
```
GET /appdetails/?appids={appid}
```

**Returns:**
```json
{
  "success": true,
  "data": {
    "type": "game",
    "name": "Game Name",
    "steam_appid": 123456,
    "required_age": 0,
    "is_free": false,
    "developers": ["Developer Name"],
    "publishers": ["Publisher Name"],
    "price_overview": {
      "currency": "USD",
      "initial": 2999,
      "final": 2999,
      "discount_percent": 0
    },
    "platforms": {"windows": true, "mac": true, "linux": false},
    "metacritic": {"score": 85, "url": "..."},
    "categories": [...],
    "genres": [...],
    "release_date": {
      "coming_soon": false,
      "date": "Mar 15, 2020"
    },
    "recommendations": {"total": 50000},
    "screenshots": [...],
    "movies": [...]
  }
}
```

**Rate Limits:** ~200 requests per 5 minutes (unofficial)

**Bulk Requests:** Can request multiple appids with comma separation:
```
GET /appdetails/?appids=730,440,570&filters=price_overview
```
**Warning:** Only works with `filters=price_overview` for multiple apps.

---

### 2.3 Steam Review Histogram API ⭐ FREE (KEY FOR TRENDING)

**This is critical for your trend analysis!**

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
    "weeks": [],
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
      // ... monthly buckets going forward
    ],
    "rollup_type": "month"
  }
}
```

**Use Cases:**
- Calculate "trending up/down" over past 30/60/90 days
- Detect review bombing events
- Track sentiment changes after updates/DLC releases
- Compare sentiment before/after major patches

**Python Example for Trend Detection:**
```python
import requests
from datetime import datetime, timedelta

def get_review_trend(appid, days=30):
    """Calculate if a game is trending up or down in reviews"""
    url = f"https://store.steampowered.com/appreviewhistogram/{appid}?l=english"
    response = requests.get(url)
    data = response.json()
    
    if data['success'] != 1:
        return None
    
    rollups = data['results']['rollups']
    cutoff = datetime.now() - timedelta(days=days)
    cutoff_ts = int(cutoff.timestamp())
    
    recent = [r for r in rollups if r['date'] >= cutoff_ts]
    older = [r for r in rollups if r['date'] < cutoff_ts][-3:]  # Last 3 months before
    
    def calc_ratio(periods):
        total_up = sum(p['recommendations_up'] for p in periods)
        total_down = sum(p['recommendations_down'] for p in periods)
        return total_up / (total_up + total_down) if (total_up + total_down) > 0 else 0
    
    recent_ratio = calc_ratio(recent)
    older_ratio = calc_ratio(older)
    
    return {
        'current_positive_ratio': recent_ratio,
        'previous_positive_ratio': older_ratio,
        'trend': 'up' if recent_ratio > older_ratio else 'down',
        'change_pct': ((recent_ratio - older_ratio) / older_ratio * 100) if older_ratio > 0 else 0
    }
```

---

### 2.4 Steam Reviews API ⭐ FREE

**Endpoint:**
```
GET https://store.steampowered.com/appreviews/{appid}?json=1
```

**Parameters:**
| Parameter | Values | Description |
|-----------|--------|-------------|
| `json` | 1 | Return JSON format |
| `cursor` | * or encoded string | Pagination cursor |
| `num_per_page` | 20-100 | Reviews per page |
| `filter` | recent, updated, all | Sort order |
| `language` | all, english, etc. | Language filter |
| `purchase_type` | all, steam, non_steam_purchase | Purchase source |
| `day_range` | integer | Reviews from last N days |

**Response includes:**
```json
{
  "success": 1,
  "query_summary": {
    "num_reviews": 20,
    "review_score": 8,
    "review_score_desc": "Very Positive",
    "total_positive": 45000,
    "total_negative": 5000,
    "total_reviews": 50000
  },
  "reviews": [
    {
      "recommendationid": "123456",
      "author": {
        "steamid": "76561198...",
        "num_games_owned": 500,
        "num_reviews": 50,
        "playtime_forever": 12000,
        "playtime_last_two_weeks": 500
      },
      "language": "english",
      "review": "Great game...",
      "timestamp_created": 1700000000,
      "voted_up": true,
      "votes_up": 100,
      "votes_funny": 10,
      "comment_count": 5,
      "steam_purchase": true,
      "received_for_free": false,
      "written_during_early_access": false
    }
  ],
  "cursor": "AoJw..."
}
```

**Community Activity Metrics from Reviews:**
- Total reviews (positive/negative)
- Review score/sentiment
- Recent review activity
- Community engagement (votes, comments)

---

### 2.4 Steam Search/Browse (Internal API)

**Useful for discovering developer/publisher pages:**

```
GET https://store.steampowered.com/search/?developer={name}&json=1
GET https://store.steampowered.com/search/?publisher={name}&json=1
```

---

## Tier 3: Scraping (Required for Page Creation Dates)

### 3.1 Steam Community Hub - Page Creation Date ⚠️ REQUIRES SCRAPING

**Why scraping is needed:** The "Founded" date (when a Steam page was created) is NOT available via any API. It's only visible on the Steam Community hub pages.

**URL Pattern:**
```
https://steamcommunity.com/app/{appid}
```

**What to scrape:** Look for the "Founded" field in the page HTML, typically in the group info section.

**Python Scraping Example:**
```python
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re
import time

def get_page_creation_date(appid):
    """
    Scrape the Steam community page to get the 'Founded' date.
    Returns datetime object or None if not found.
    """
    url = f"https://steamcommunity.com/app/{appid}"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Look for "Founded" text - format varies but typically:
        # "Founded: March 15, 2020" or similar
        founded_elem = soup.find(string=re.compile(r'Founded', re.IGNORECASE))
        
        if founded_elem:
            # Extract the date from surrounding context
            parent = founded_elem.find_parent()
            date_text = parent.get_text() if parent else str(founded_elem)
            
            # Parse various date formats
            date_patterns = [
                r'(\w+ \d{1,2}, \d{4})',  # "March 15, 2020"
                r'(\d{1,2} \w+ \d{4})',    # "15 March 2020"
            ]
            
            for pattern in date_patterns:
                match = re.search(pattern, date_text)
                if match:
                    date_str = match.group(1)
                    try:
                        return datetime.strptime(date_str, '%B %d, %Y')
                    except:
                        try:
                            return datetime.strptime(date_str, '%d %B %Y')
                        except:
                            pass
        
        return None
        
    except Exception as e:
        print(f"Error scraping appid {appid}: {e}")
        return None

def batch_scrape_creation_dates(appids, delay=1.0):
    """
    Scrape creation dates for multiple apps with rate limiting.
    
    Args:
        appids: List of Steam app IDs
        delay: Seconds between requests (be respectful!)
    """
    results = {}
    
    for i, appid in enumerate(appids):
        results[appid] = get_page_creation_date(appid)
        
        if (i + 1) % 100 == 0:
            print(f"Processed {i + 1}/{len(appids)} apps")
        
        time.sleep(delay)  # Rate limit!
    
    return results
```

**Important Scraping Guidelines:**
1. **Rate limit:** Max 1 request per second
2. **Headers:** Use realistic User-Agent
3. **Respect robots.txt:** Steam generally allows scraping but throttle aggressively
4. **Cache results:** Page creation dates are immutable - only scrape once per app
5. **Error handling:** Some apps may not have community hubs (DLC, removed games)

---

### 3.2 Alternative: SteamDB History (If Available)

SteamDB tracks when apps were first added to the Steam database. While they don't provide an API, you can:

1. **Use Internet Archive/Wayback Machine** to find earliest snapshot of a game's store page
2. **Use SteamKit2** (open source) to query Steam network directly for app metadata including creation timestamps

**SteamKit2 Approach (More Reliable):**
```bash
# Install SteamKit2 (C# library) or use the Python port
pip install steam  # Python Steam library

# This can get PICSProductInfo which includes creation timestamps
```

---

### 3.3 Developer/Publisher Homepage List

**URL:** `https://store.steampowered.com/publisher/` (lists all publishers)
**URL:** `https://store.steampowered.com/developer/` (lists all developers)

These pages list publishers/developers who have set up official homepages. Not all publishers/developers have them, but it's a good starting point.

**Individual Publisher Page Example:**
```
https://store.steampowered.com/publisher/valve
```

### 3.2 SteamDB Pages (If Allowed)

SteamDB tracks:
- App creation dates (proxy for "foundation date")
- Price history
- Player count history
- Update/patch history

**Scraping SteamDB is discouraged** - use their GitHub tools instead.

### 3.3 Community Hub Pages

Each game has community activity at:
```
https://steamcommunity.com/app/{appid}
```

Can scrape for:
- Discussion thread counts
- Screenshot/video counts
- Guide counts
- Active members

---

## Tier 4: Alternative Data Sources

### 4.1 ITAD (IsThereAnyDeal)

**Website:** https://isthereanydeal.com

**Useful for:**
- Price history
- Release date verification
- Multi-store pricing

**Has limited API access** - contact for academic/research use.

### 4.2 IGDB (Twitch-owned)

**API:** https://api-docs.igdb.com/

**Provides:**
- Company/developer information
- Game metadata
- Cross-platform data (not Steam-specific)

**Free tier available** with reasonable limits.

---

## Recommended Architecture

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     DATA ACQUISITION LAYER                       │
├──────────────────┬──────────────────┬──────────────────────────┤
│   SteamSpy API   │  Steam Store API │   Steam Reviews API      │
│   (Daily sync)   │  (4-6hr cycle)   │   (Daily aggregates)     │
└────────┬─────────┴────────┬─────────┴────────────┬─────────────┘
         │                  │                      │
         ▼                  ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ETL / PROCESSING LAYER                       │
│  • Normalize developer/publisher names                           │
│  • Deduplicate entries                                          │
│  • Calculate derived metrics                                     │
│  • Handle rate limiting & retries                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE LAYER                            │
│  Tables: apps, developers, publishers, reviews_summary,          │
│          community_metrics, price_history                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API LAYER                                │
│  REST API for users to query publisher/developer data            │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema (Optimized for Historical Tracking & Trends)

```sql
-- =============================================
-- CORE ENTITIES (Rarely change)
-- =============================================

CREATE TABLE developers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    steam_url VARCHAR(500),
    first_game_release_date DATE,      -- Earliest game release by this developer
    first_page_creation_date DATE,     -- Earliest Steam page creation (scraped)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE publishers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    steam_url VARCHAR(500),
    first_game_release_date DATE,
    first_page_creation_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE apps (
    appid INTEGER PRIMARY KEY,
    name VARCHAR(500),
    type VARCHAR(50),                   -- game, dlc, demo, etc.
    is_free BOOLEAN,
    release_date DATE,                  -- Official release date
    page_creation_date DATE,            -- When Steam page was created (scraped)
    has_workshop BOOLEAN DEFAULT FALSE, -- Workshop support (boolean only)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Many-to-many relationships
CREATE TABLE app_developers (
    appid INTEGER REFERENCES apps(appid),
    developer_id INTEGER REFERENCES developers(id),
    PRIMARY KEY (appid, developer_id)
);

CREATE TABLE app_publishers (
    appid INTEGER REFERENCES apps(appid),
    publisher_id INTEGER REFERENCES publishers(id),
    PRIMARY KEY (appid, publisher_id)
);

-- =============================================
-- HISTORICAL METRICS (Daily snapshots)
-- =============================================

CREATE TABLE daily_metrics (
    id SERIAL PRIMARY KEY,
    appid INTEGER REFERENCES apps(appid),
    metric_date DATE NOT NULL,
    
    -- Ownership & Players
    owners_estimate VARCHAR(100),       -- SteamSpy range estimate
    ccu_peak INTEGER,                   -- Peak CCU that day
    
    -- Review Summary (Overall)
    total_reviews INTEGER,
    positive_reviews INTEGER,
    negative_reviews INTEGER,
    review_score INTEGER,               -- 1-9 scale from Steam
    review_score_desc VARCHAR(50),      -- "Overwhelmingly Positive", etc.
    
    -- Review Summary (Recent - last 30 days as of this date)
    recent_positive INTEGER,
    recent_negative INTEGER,
    recent_score_desc VARCHAR(50),
    
    -- Pricing
    price_cents INTEGER,
    discount_percent INTEGER,
    
    UNIQUE(appid, metric_date)
);

-- Index for fast trending queries
CREATE INDEX idx_daily_metrics_appid_date ON daily_metrics(appid, metric_date DESC);
CREATE INDEX idx_daily_metrics_date ON daily_metrics(metric_date);

-- =============================================
-- REVIEW HISTOGRAM (Monthly buckets from Steam)
-- =============================================

CREATE TABLE review_histogram (
    id SERIAL PRIMARY KEY,
    appid INTEGER REFERENCES apps(appid),
    month_date DATE NOT NULL,           -- First day of the month
    recommendations_up INTEGER,
    recommendations_down INTEGER,
    fetched_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(appid, month_date)
);

-- Index for trend analysis
CREATE INDEX idx_review_histogram_appid_month ON review_histogram(appid, month_date DESC);

-- =============================================
-- COMPUTED TRENDS (Updated daily)
-- =============================================

CREATE TABLE app_trends (
    appid INTEGER PRIMARY KEY REFERENCES apps(appid),
    
    -- 30-day trend
    trend_30d_direction VARCHAR(10),    -- 'up', 'down', 'stable'
    trend_30d_change_pct DECIMAL(5,2),  -- Percentage change in positive ratio
    
    -- 90-day trend
    trend_90d_direction VARCHAR(10),
    trend_90d_change_pct DECIMAL(5,2),
    
    -- Current sentiment
    current_positive_ratio DECIMAL(5,4),
    previous_positive_ratio DECIMAL(5,4),
    
    -- Review velocity (reviews per day)
    review_velocity_7d DECIMAL(10,2),
    review_velocity_30d DECIMAL(10,2),
    
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- SYNC TRACKING (For distributed updates)
-- =============================================

CREATE TABLE sync_status (
    appid INTEGER PRIMARY KEY REFERENCES apps(appid),
    last_details_sync TIMESTAMP,        -- Storefront API
    last_reviews_sync TIMESTAMP,        -- Reviews API
    last_histogram_sync TIMESTAMP,      -- Histogram API
    last_steamspy_sync TIMESTAMP,       -- SteamSpy API
    last_community_scrape TIMESTAMP,    -- Page creation date scrape
    priority_score INTEGER DEFAULT 0,   -- Higher = sync more often
    
    -- Error tracking
    consecutive_errors INTEGER DEFAULT 0,
    last_error_message TEXT,
    last_error_at TIMESTAMP
);

-- Index for finding apps due for sync
CREATE INDEX idx_sync_status_priority ON sync_status(priority_score DESC);
```

---

### Useful SQL Queries for Trend Analysis

```sql
-- Find games trending UP in last 30 days
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
    AND t.trend_30d_change_pct > 5  -- At least 5% improvement
    AND dm.total_reviews > 100       -- Minimum reviews for significance
ORDER BY t.trend_30d_change_pct DESC
LIMIT 50;

-- Get review trend history for a specific game
SELECT 
    month_date,
    recommendations_up,
    recommendations_down,
    ROUND(recommendations_up::decimal / NULLIF(recommendations_up + recommendations_down, 0) * 100, 2) as positive_pct
FROM review_histogram
WHERE appid = 730  -- CS2
ORDER BY month_date DESC
LIMIT 24;  -- Last 2 years

-- Publisher performance over time
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

## Cron Schedule - Distributed Throughout Day

Since you want updates spread across the day to manage queue load, here's an optimized schedule:

### Schedule Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HOUR  │ 00 │ 02 │ 04 │ 06 │ 08 │ 10 │ 12 │ 14 │ 16 │ 18 │ 20 │ 22 │       │
├───────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼───────┤
│SteamSpy│    │ ██ │    │    │    │    │    │    │    │    │    │    │ Full  │
│AppList │ ██ │    │    │    │    │    │    │    │    │    │    │    │ Full  │
│Details │    │    │    │ ─► │ ─► │ ─► │ ─► │ ─► │ ─► │ ─► │ ─► │    │Stream │
│Reviews │    │    │    │    │    │ ─► │ ─► │ ─► │ ─► │ ─► │    │    │Stream │
│Histgrm │    │    │ ██ │    │    │    │    │    │    │    │    │    │ Batch │
│Trends  │    │    │    │    │    │    │    │    │    │    │    │ ██ │ Calc  │
│Scrape  │    │    │    │    │ ─► │ ─► │ ─► │ ─► │ ─► │ ─► │ ─► │    │ New   │
└─────────────────────────────────────────────────────────────────────────────┘

██ = Batch job (runs once)
─► = Streaming job (processes N items per hour)
```

### Crontab Configuration

```bash
# ============================================
# STEAM DATA ACQUISITION - CRON SCHEDULE
# ============================================

# --- BATCH JOBS (Run once daily) ---

# 00:00 - Fetch full app list from Steam API
0 0 * * * /opt/steam-sync/scripts/fetch_app_list.py >> /var/log/steam-sync/app_list.log 2>&1

# 02:00 - Fetch SteamSpy data (after their daily refresh ~1-2 AM)
0 2 * * * /opt/steam-sync/scripts/fetch_steamspy.py >> /var/log/steam-sync/steamspy.log 2>&1

# 04:00 - Fetch review histograms for trending analysis
0 4 * * * /opt/steam-sync/scripts/fetch_histograms.py >> /var/log/steam-sync/histogram.log 2>&1

# 22:00 - Calculate trends and update app_trends table
0 22 * * * /opt/steam-sync/scripts/calculate_trends.py >> /var/log/steam-sync/trends.log 2>&1


# --- STREAMING JOBS (Distributed throughout day) ---

# Every hour from 06:00-20:00 - Process app details (Storefront API)
# Processes ~250 apps per hour = ~3,500 apps/day with rate limiting
0 6-20 * * * /opt/steam-sync/scripts/stream_app_details.py --batch-size 250 >> /var/log/steam-sync/details.log 2>&1

# Every hour from 10:00-18:00 - Process review summaries
# Processes ~400 apps per hour = ~3,200 apps/day
0 10-18 * * * /opt/steam-sync/scripts/stream_reviews.py --batch-size 400 >> /var/log/steam-sync/reviews.log 2>&1

# Every hour from 08:00-19:00 - Scrape page creation dates (only new/missing apps)
# Processes ~50 apps per hour (slower due to scraping rate limits)
0 8-19 * * * /opt/steam-sync/scripts/scrape_creation_dates.py --batch-size 50 >> /var/log/steam-sync/scrape.log 2>&1


# --- WEEKLY JOBS ---

# Sunday 03:00 - Full consistency check and data repair
0 3 * * 0 /opt/steam-sync/scripts/consistency_check.py >> /var/log/steam-sync/consistency.log 2>&1

# Sunday 05:00 - Archive old daily_metrics to cold storage (keep 2 years hot)
0 5 * * 0 /opt/steam-sync/scripts/archive_metrics.py --older-than 730 >> /var/log/steam-sync/archive.log 2>&1
```

### Priority-Based Processing

Since you can't update all ~70K apps daily, use a priority system:

```python
# Priority scoring for which apps to update first
def calculate_priority(app):
    priority = 0
    
    # Higher priority for popular games
    if app.ccu_peak > 10000:
        priority += 100
    elif app.ccu_peak > 1000:
        priority += 50
    elif app.ccu_peak > 100:
        priority += 25
    
    # Higher priority for recently updated games
    days_since_update = (datetime.now() - app.last_details_sync).days
    if days_since_update > 7:
        priority += 30
    elif days_since_update > 3:
        priority += 15
    
    # Higher priority for games with recent review activity
    if app.review_velocity_7d > 10:
        priority += 40
    
    # Higher priority for trending games
    if abs(app.trend_30d_change_pct or 0) > 10:
        priority += 25
    
    # Lower priority for dead games
    if app.ccu_peak == 0 and app.review_velocity_30d < 0.1:
        priority -= 50
    
    return priority
```

### Throughput Estimates

| Job Type | Rate Limit | Items/Hour | Items/Day | Days for Full Catalog |
|----------|------------|------------|-----------|----------------------|
| SteamSpy | 1/sec for all | ~1,000 pages | 30,000+ | ~3 days |
| Storefront API | ~200/5min | ~2,400 | ~3,500* | ~20 days |
| Reviews Summary | ~20/min | ~1,200 | ~3,200* | ~22 days |
| Review Histogram | ~60/min | ~3,600 | ~3,600* | ~20 days |
| Community Scrape | 1/sec | ~3,600 | ~600* | ~116 days |

*With streaming jobs only running part of the day

**Recommendation:** Focus daily updates on top ~5,000 priority apps. Run full catalog sync weekly.

---

## Cost Summary

| Service | Cost | Priority |
|---------|------|----------|
| Steam Web API | FREE | ✅ Required |
| Steam Storefront API | FREE | ✅ Required |
| Steam Reviews API | FREE | ✅ Required |
| SteamSpy API | FREE | ✅ Required |
| VG Insights | $14.50/mo | 🔶 Optional |
| Gamalytic | $19-49/mo | ❌ Not needed initially |
| Server/Database | $20-100/mo | ✅ Required |

**Total Estimated Cost (MVP):** $20-100/month (infrastructure only)

---

## Next Steps

Now that requirements are clear, here's the implementation roadmap:

### Phase 1: Core Infrastructure (Week 1)
1. ✅ Set up PostgreSQL database with schema above
2. ✅ Create Python project structure with rate-limiting utilities
3. ✅ Implement SteamSpy ingestion (full catalog baseline)
4. ✅ Implement Steam API app list sync
5. ✅ Get Steam API key

### Phase 2: Data Ingestion (Week 2)
1. Build Storefront API details fetcher
2. Build Reviews API summary fetcher  
3. Build Review Histogram fetcher (critical for trends!)
4. Build community page scraper for creation dates
5. Test rate limiting and error handling

### Phase 3: Historical Tracking (Week 3)
1. Set up daily_metrics table population
2. Implement review_histogram ingestion
3. Build trend calculation job
4. Set up cron jobs with distributed scheduling
5. Build priority scoring system

### Phase 4: API & Polish (Week 4)
1. Build REST API for querying data
2. Add trending endpoints
3. Add alerting for data freshness issues
4. Documentation
5. Monitoring dashboards

---

## Quick Start Commands

```bash
# 1. Get your Steam API key
# Visit: https://steamcommunity.com/dev/apikey

# 2. Test SteamSpy API
curl "https://steamspy.com/api.php?request=appdetails&appid=730"

# 3. Test Storefront API
curl "https://store.steampowered.com/api/appdetails/?appids=730"

# 4. Test Review Histogram (KEY FOR TRENDS!)
curl "https://store.steampowered.com/appreviewhistogram/730?l=english"

# 5. Test Reviews Summary
curl "https://store.steampowered.com/appreviews/730?json=1"
```

---

Would you like me to start building any of these components? I can create:
1. **Python ingestion scripts** - Ready-to-run scripts for each data source
2. **Database migrations** - SQL files to create all tables
3. **Docker setup** - Containerized deployment with PostgreSQL
4. **Sample trending queries** - SQL to identify games trending up/down
