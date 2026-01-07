# Data Sources

PublisherIQ collects data from multiple sources organized into tiers based on reliability and coverage.

**Last Updated:** January 7, 2026

## Data Source Hierarchy

```
TIER 1 - AUTHORITATIVE (100% coverage)
├── Steam IStoreService API    → Master list of all appIDs
├── Steam Storefront API       → Developers, publishers, release dates
├── Steam Reviews API          → Review counts, sentiment scores
└── Steam Review Histogram     → Monthly review trends

TIER 2 - ENRICHMENT (80-90% coverage)
└── SteamSpy API               → CCU, owner estimates, playtime, tags
    ⚠️ NOT authoritative for publishers/developers

TIER 3 - SPECIALIZED
├── PICS Service               → Tags, genres, relationships, Steam Deck
└── Community Hub Scraping     → Page creation dates (historical)
```

---

## Tier 1: Steam Official APIs

### Steam App List API

**Purpose:** Complete list of all Steam apps

**Endpoint:**
```
GET https://api.steampowered.com/IStoreService/GetAppList/v1/
    ?key={API_KEY}
    &include_games=true
    &include_dlc=true
    &max_results=50000
    &last_appid={cursor}
```

**Response:**
```json
{
  "response": {
    "apps": [
      {"appid": 730, "name": "Counter-Strike 2", "last_modified": 1703980800}
    ],
    "have_more_results": true,
    "last_appid": 12345
  }
}
```

**Rate Limit:** 100,000 requests/day with API key

**Implementation:** `packages/ingestion/src/apis/steam-web.ts`

---

### Steam Storefront API

**Purpose:** Detailed game metadata (AUTHORITATIVE for developers/publishers)

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
      "is_free": true,
      "developers": ["Valve"],
      "publishers": ["Valve"],
      "categories": [
        {"id": 1, "description": "Multi-player"},
        {"id": 30, "description": "Steam Workshop"}
      ],
      "release_date": {
        "coming_soon": false,
        "date": "Aug 21, 2012"
      },
      "price_overview": {
        "currency": "USD",
        "initial": 5999,
        "final": 2999,
        "discount_percent": 50
      }
    }
  }
}
```

**Key Fields:**
| Field | Description |
|-------|-------------|
| `developers[]` | Developer names (AUTHORITATIVE) |
| `publishers[]` | Publisher names (AUTHORITATIVE) |
| `categories[]` | Feature flags (Workshop = id:30) |
| `release_date.date` | Official release date |
| `is_free` | Free-to-play status |

**Rate Limit:** ~200 requests per 5 minutes

**Implementation:** `packages/ingestion/src/apis/storefront.ts`

---

### Steam Reviews API

**Purpose:** Current review counts and sentiment

**Endpoint:**
```
GET https://store.steampowered.com/appreviews/{appid}?json=1&num_per_page=0
```

**Response:**
```json
{
  "success": 1,
  "query_summary": {
    "review_score": 8,
    "review_score_desc": "Very Positive",
    "total_positive": 45000,
    "total_negative": 5000,
    "total_reviews": 50000
  }
}
```

**Review Score Reference:**
| Score | Description | Positive % |
|-------|-------------|------------|
| 9 | Overwhelmingly Positive | 95%+ |
| 8 | Very Positive | 80-94% |
| 7 | Positive | 70-79% |
| 6 | Mostly Positive | 40-69% |
| 5 | Mixed | 40-69% |
| 4 | Mostly Negative | 20-39% |
| 3 | Negative | 10-19% |
| 2 | Very Negative | 0-9% |

**Rate Limit:** ~20 requests per minute

**Implementation:** `packages/ingestion/src/apis/reviews.ts`

---

### Steam Review Histogram API

**Purpose:** Monthly review aggregates for trend analysis

**Endpoint:**
```
GET https://store.steampowered.com/appreviewhistogram/{appid}?l=english
```

**Response:**
```json
{
  "success": 1,
  "results": {
    "rollups": [
      {"date": 1577836800, "recommendations_up": 1250, "recommendations_down": 85},
      {"date": 1580515200, "recommendations_up": 980, "recommendations_down": 62}
    ],
    "rollup_type": "month"
  }
}
```

**Use Cases:**
- Calculate 30/90-day trend direction
- Detect review bombing events
- Track sentiment changes after updates

**Rate Limit:** ~60 requests per minute

**Implementation:** `packages/ingestion/src/apis/reviews.ts` (`fetchReviewHistogram()`)

---

## Tier 2: Third-Party Services

### SteamSpy API

**Purpose:** Player counts, owner estimates, playtime, tags

**Endpoints:**
| Endpoint | Rate Limit | Use |
|----------|------------|-----|
| `?request=all&page={n}` | 1/60sec | Full catalog |
| `?request=appdetails&appid={id}` | 1/sec | Single app |

**Response:**
```json
{
  "appid": 730,
  "name": "Counter-Strike 2",
  "owners": "50,000,000 .. 100,000,000",
  "ccu": 850000,
  "average_forever": 35000,
  "average_2weeks": 1200,
  "positive": 4500000,
  "negative": 500000,
  "tags": {"FPS": 12000, "Shooter": 11500}
}
```

**Important:** Do NOT use SteamSpy's `developer` and `publisher` fields - they have gaps. Use Steam Storefront API instead.

**Implementation:** `packages/ingestion/src/apis/steamspy.ts`

---

## Tier 3: Specialized Sources

### PICS Service

**Purpose:** Real-time access to Steam's Product Info Cache Server

The Python PICS service connects directly to Steam's internal data system, providing:
- Store tags with vote counts
- Genres and categories
- DLC and franchise relationships
- Steam Deck compatibility
- Controller support

**Data Not Available Elsewhere:**
- Tag vote counts (popularity)
- Franchise groupings
- Parent app relationships
- Detailed platform support

**Implementation:** `services/pics-service/`

See [PICS Data Fields](../reference/pics-data-fields.md) for field reference.

---

### Community Hub Scraping

**Purpose:** Page creation dates (historical)

**URL Pattern:**
```
https://steamcommunity.com/app/{appid}
```

The "Founded" date (when a Steam page was created) is only available by scraping the community hub page.

**Rate Limit:** 1 request per 1.5 seconds (conservative)

**Implementation:** `packages/ingestion/src/scrapers/page-creation.ts`

---

## Data Source Summary

| Source | Data | Coverage | Rate Limit | Update Frequency |
|--------|------|----------|------------|------------------|
| Steam App List | All app IDs | 100% | 100k/day | Daily |
| Steam Storefront | Dev/Pub, metadata | 100% | ~200/5min | 5x daily |
| Steam Reviews | Scores, counts | 100% | ~20/min | 5x daily |
| Steam Histogram | Monthly trends | 100% | ~60/min | Daily |
| SteamSpy | CCU, owners, tags | 80-90% | 1/sec | Daily |
| PICS | Tags, genres, deck | 100% | Variable | Real-time |

## Related Documentation

- [Rate Limits](../reference/rate-limits.md) - Detailed rate limit reference
- [API Endpoints](../reference/api-endpoints.md) - Complete API documentation
- [Sync Pipeline](sync-pipeline.md) - How data is collected
