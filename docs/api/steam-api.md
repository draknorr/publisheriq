# Steam API Endpoints Reference

Complete reference for all Steam APIs used by PublisherIQ.

## Official Steam APIs

### Steam IStoreService API (App List)

**Purpose:** Get complete list of all Steam apps

**Endpoint:**
```
GET https://api.steampowered.com/IStoreService/GetAppList/v1/
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | Steam API key |
| `include_games` | boolean | No | Include games (default: false) |
| `include_dlc` | boolean | No | Include DLC (default: false) |
| `include_software` | boolean | No | Include software (default: false) |
| `include_videos` | boolean | No | Include videos (default: false) |
| `include_hardware` | boolean | No | Include hardware (default: false) |
| `max_results` | int | No | Max items per page (up to 50,000) |
| `last_appid` | int | No | Pagination cursor |

**Example Request:**
```
https://api.steampowered.com/IStoreService/GetAppList/v1/?key=YOUR_KEY&include_games=true&max_results=50000
```

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

**Rate Limit:** 100,000 requests/day

---

### Steam Storefront API

**Purpose:** Get detailed app metadata

**Endpoint:**
```
GET https://store.steampowered.com/api/appdetails/
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `appids` | string | Yes | App ID(s), comma-separated |
| `cc` | string | No | Country code (default: US) |
| `l` | string | No | Language (default: english) |

**Example Request:**
```
https://store.steampowered.com/api/appdetails/?appids=730
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
      "detailed_description": "...",
      "about_the_game": "...",
      "short_description": "...",
      "developers": ["Valve"],
      "publishers": ["Valve"],
      "price_overview": {
        "currency": "USD",
        "initial": 0,
        "final": 0,
        "discount_percent": 0,
        "initial_formatted": "",
        "final_formatted": "Free"
      },
      "platforms": {
        "windows": true,
        "mac": true,
        "linux": true
      },
      "categories": [
        {"id": 1, "description": "Multi-player"},
        {"id": 30, "description": "Steam Workshop"}
      ],
      "genres": [
        {"id": "1", "description": "Action"},
        {"id": "37", "description": "Free to Play"}
      ],
      "release_date": {
        "coming_soon": false,
        "date": "Aug 21, 2012"
      }
    }
  }
}
```

**Rate Limit:** ~200 requests per 5 minutes

**Notes:**
- Returns `success: false` for age-gated, private, or removed apps
- Developers/publishers arrays are AUTHORITATIVE source
- Check `categories` for Workshop support (id: 30)

---

### Steam Reviews API

**Purpose:** Get review counts and sentiment

**Endpoint:**
```
GET https://store.steampowered.com/appreviews/{appid}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `json` | int | Yes | Set to 1 for JSON response |
| `num_per_page` | int | No | Reviews to return (0 for summary only) |
| `filter` | string | No | all, recent, updated |
| `language` | string | No | Language filter |
| `purchase_type` | string | No | all, steam, non_steam_purchase |

**Example Request:**
```
https://store.steampowered.com/appreviews/730?json=1&num_per_page=0
```

**Response:**
```json
{
  "success": 1,
  "query_summary": {
    "num_reviews": 0,
    "review_score": 8,
    "review_score_desc": "Very Positive",
    "total_positive": 4500000,
    "total_negative": 500000,
    "total_reviews": 5000000
  },
  "reviews": [],
  "cursor": "*"
}
```

**Rate Limit:** ~20 requests per minute

---

### Steam Review Histogram API

**Purpose:** Get monthly review aggregates

**Endpoint:**
```
GET https://store.steampowered.com/appreviewhistogram/{appid}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `l` | string | No | Language (default: english) |

**Example Request:**
```
https://store.steampowered.com/appreviewhistogram/730?l=english
```

**Response:**
```json
{
  "success": 1,
  "results": {
    "start_date": 1577836800,
    "end_date": 1703980800,
    "weeks": [],
    "recent_events": [],
    "rollups": [
      {
        "date": 1577836800,
        "recommendations_up": 125000,
        "recommendations_down": 8500
      },
      {
        "date": 1580515200,
        "recommendations_up": 98000,
        "recommendations_down": 6200
      }
    ],
    "rollup_type": "month"
  }
}
```

**Rate Limit:** ~60 requests per minute

---

## Third-Party APIs

### SteamSpy API

**Purpose:** Get player counts, owner estimates, tags

**Base URL:** `https://steamspy.com/api.php`

#### All Apps (Paginated)

**Endpoint:**
```
GET https://steamspy.com/api.php?request=all&page={page}
```

**Response:**
```json
{
  "730": {
    "appid": 730,
    "name": "Counter-Strike 2",
    "developer": "Valve",
    "publisher": "Valve",
    "score_rank": "",
    "positive": 4500000,
    "negative": 500000,
    "userscore": 0,
    "owners": "50,000,000 .. 100,000,000",
    "average_forever": 35000,
    "average_2weeks": 1200,
    "median_forever": 15000,
    "median_2weeks": 800,
    "ccu": 850000,
    "price": "0"
  }
}
```

**Rate Limit:** 1 request per 60 seconds

#### App Details

**Endpoint:**
```
GET https://steamspy.com/api.php?request=appdetails&appid={appid}
```

**Response:**
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
  "tags": {
    "FPS": 12000,
    "Shooter": 11500,
    "Multiplayer": 10000,
    "Action": 9500,
    "Competitive": 8000
  }
}
```

**Rate Limit:** 1 request per second

**Notes:**
- Developer/publisher fields have gaps - use Steam Storefront API instead
- Owner estimates are ranges, not exact numbers
- Tags include vote counts

---

## Error Handling

### Common HTTP Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| 200 | Success | Process response |
| 400 | Bad request | Check parameters |
| 401 | Unauthorized | Check API key |
| 403 | Forbidden | Rate limited or blocked |
| 404 | Not found | App doesn't exist |
| 429 | Too many requests | Wait and retry |
| 500 | Server error | Retry with backoff |
| 503 | Service unavailable | Wait and retry |

### Retry Strategy

```typescript
const retryConfig = {
  maxRetries: 3,
  initialDelay: 1000,     // 1 second
  maxDelay: 30000,        // 30 seconds
  backoffMultiplier: 2    // Exponential backoff
};
```

## Related Documentation

- [Rate Limits](./rate-limits.md) - Detailed rate limit reference
- [Data Sources](../developer-guide/architecture/data-sources.md) - Source hierarchy
- [Sync Pipeline](../developer-guide/architecture/sync-pipeline.md) - How data flows
