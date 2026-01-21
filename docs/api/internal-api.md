# Internal API Reference

This document describes the internal API endpoints used by the PublisherIQ dashboard.

> **Note:** These are internal APIs for the dashboard frontend. For Steam API documentation, see [API Endpoints](./api-endpoints.md).

---

## Authentication

All internal APIs require authentication via Supabase Auth. Include the session cookie or Authorization header.

**Error Response (401):**
```json
{
  "error": "unauthorized",
  "message": "Authentication required"
}
```

---

## Chat API

### POST /api/chat/stream

Streaming chat endpoint using Server-Sent Events (SSE).

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "Show me top puzzle games" }
  ]
}
```

**Response:** SSE stream with event types:
- `text_delta` - Incremental text from LLM
- `tool_start` - Tool execution started
- `tool_result` - Tool execution completed
- `message_end` - Response complete
- `error` - Error occurred

See [Streaming API Protocol](../developer-guide/architecture/chat-data-system.md#streaming-api-protocol) for detailed event schemas.

**Error Responses:**
| Status | Error | Description |
|--------|-------|-------------|
| 401 | unauthorized | Not authenticated |
| 402 | insufficient_credits | Not enough credits |
| 429 | rate_limited | Too many requests |

---

## Pins API

### GET /api/pins

Fetch all pins for the current user.

**Response:**
```json
{
  "pins": [
    {
      "id": "uuid",
      "entity_type": "game",
      "entity_id": "730",
      "display_name": "Counter-Strike 2",
      "created_at": "2026-01-15T12:00:00Z"
    }
  ]
}
```

### POST /api/pins

Create a new pin.

**Request:**
```json
{
  "entity_type": "game",
  "entity_id": "730",
  "display_name": "Counter-Strike 2"
}
```

**Response:**
```json
{
  "id": "uuid",
  "entity_type": "game",
  "entity_id": "730",
  "display_name": "Counter-Strike 2",
  "created_at": "2026-01-15T12:00:00Z"
}
```

### DELETE /api/pins/[id]

Remove a pin.

**Response:** 204 No Content

### GET /api/pins/check

Check if an entity is pinned.

**Query Parameters:**
- `entity_type`: game, publisher, or developer
- `entity_id`: Entity ID

**Response:**
```json
{
  "isPinned": true,
  "pinId": "uuid"
}
```

### GET /api/pins/[id]/alert-settings

Get alert settings for a specific pin.

**Response:**
```json
{
  "alerts_enabled": true,
  "ccu_sensitivity": 1.0,
  "review_sensitivity": 1.0,
  "sentiment_sensitivity": 1.0,
  "alert_types": {
    "ccu_spike": true,
    "ccu_drop": true,
    "trend_reversal": true,
    "review_surge": true,
    "sentiment_shift": true,
    "price_change": true,
    "new_release": true,
    "milestone": true
  }
}
```

### PUT /api/pins/[id]/alert-settings

Update alert settings for a pin.

**Request:**
```json
{
  "alerts_enabled": true,
  "ccu_sensitivity": 1.5,
  "alert_types": {
    "ccu_spike": true,
    "price_change": false
  }
}
```

---

## Alerts API

### GET /api/alerts

Fetch alerts for the current user.

**Query Parameters:**
- `limit`: Maximum alerts to return (default: 50)
- `unread_only`: Only return unread alerts (default: false)

**Response:**
```json
{
  "alerts": [
    {
      "id": "uuid",
      "alert_type": "ccu_spike",
      "severity": "high",
      "title": "CCU Spike Detected",
      "description": "Counter-Strike 2 CCU increased by 150%",
      "entity_type": "game",
      "entity_id": "730",
      "entity_name": "Counter-Strike 2",
      "is_read": false,
      "created_at": "2026-01-15T12:00:00Z"
    }
  ]
}
```

### GET /api/alerts/count

Get unread alert count.

**Response:**
```json
{
  "unread_count": 5
}
```

### PUT /api/alerts/[id]/read

Mark an alert as read.

**Response:** 204 No Content

### DELETE /api/alerts/[id]

Delete an alert.

**Response:** 204 No Content

### GET /api/alerts/preferences

Get user's global alert preferences.

**Response:**
```json
{
  "alerts_enabled": true,
  "ccu_sensitivity": 1.0,
  "review_sensitivity": 1.0,
  "sentiment_sensitivity": 1.0,
  "alert_types": {
    "ccu_spike": true,
    "ccu_drop": true,
    "trend_reversal": true,
    "review_surge": true,
    "sentiment_shift": true,
    "price_change": true,
    "new_release": true,
    "milestone": true
  }
}
```

### PUT /api/alerts/preferences

Update global alert preferences.

**Request:** Same format as GET response.

---

## Apps API

### GET /api/apps

Fetch apps with filters.

**Query Parameters:**
- `type`: game, dlc, demo, or all
- `limit`: Maximum results (default: 50)
- `offset`: Pagination offset
- `sort`: Sort field
- `order`: asc or desc
- Various filter parameters (see Games Page)

**Response:**
```json
{
  "apps": [...],
  "total": 1000,
  "hasMore": true
}
```

---

## Search API

### GET /api/search

Unified search across entities.

**Query Parameters:**
- `q`: Search query
- `type`: game, publisher, developer, or all
- `limit`: Maximum results per type (default: 10)

**Response:**
```json
{
  "games": [
    { "appid": 730, "name": "Counter-Strike 2" }
  ],
  "publishers": [
    { "id": 1, "name": "Valve" }
  ],
  "developers": [
    { "id": 1, "name": "Valve" }
  ]
}
```

---

## Similarity API

### POST /api/similarity

Find similar entities using vector search.

**Request:**
```json
{
  "entity_type": "game",
  "reference_name": "Hades",
  "filters": {
    "popularity_comparison": "similar",
    "min_reviews": 100
  },
  "limit": 10
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "appid": 1145360,
      "name": "Hades II",
      "similarity": 0.95,
      "owners": 500000,
      "reviewScore": 95
    }
  ]
}
```

---

## Autocomplete API

### GET /api/autocomplete/tags

Tag autocomplete for filter inputs.

**Query Parameters:**
- `q`: Search query
- `type`: tags, genres, or categories
- `limit`: Maximum results (default: 20)

**Response:**
```json
{
  "results": [
    { "id": 1, "name": "Action", "count": 15000 }
  ]
}
```

---

## Admin APIs

> **Access:** Requires `admin` role.

### POST /api/admin/send-invite

Send signup invitation to a waitlist applicant.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Invite sent"
}
```

---

## Error Responses

All APIs return errors in a consistent format:

```json
{
  "error": "error_code",
  "message": "Human-readable description"
}
```

**Common Error Codes:**

| Code | Status | Description |
|------|--------|-------------|
| unauthorized | 401 | Not authenticated |
| forbidden | 403 | Insufficient permissions |
| not_found | 404 | Resource not found |
| validation_error | 400 | Invalid request parameters |
| rate_limited | 429 | Too many requests |
| insufficient_credits | 402 | Not enough credits |
| server_error | 500 | Internal server error |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| /api/chat/stream | 10/min, 100/hour per user |
| /api/search | 60/min |
| /api/similarity | 30/min |
| Other endpoints | 120/min |

---

## Related Documentation

- [Chat Data System](../developer-guide/architecture/chat-data-system.md) - Streaming API protocol
- [Steam API](./steam-api.md) - Steam API reference
