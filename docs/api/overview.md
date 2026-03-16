# API Documentation

This section covers the product-facing internal APIs and the external data sources PublisherIQ consumes.

## Internal APIs

| API | Purpose | Guide |
|-----|---------|-------|
| Chat streaming | SSE-based AI responses | [Streaming API](./streaming-api.md) |
| Dashboard internals | Pins, alerts, auth validation, app data | [Internal API](./internal-api.md) |
| Change Feed internals | Burst list, detail, news, status | [Internal API](./internal-api.md) |

## External Source APIs

| Source | Purpose | Guide |
|--------|---------|-------|
| Steam Web / Storefront / Reviews / CCU | Official Steam data | [Steam API](./steam-api.md) |
| SteamSpy | Owner and playtime enrichment | [Steam API](./steam-api.md) |

## Auth Model

Internal APIs are generally protected by the signed-in Supabase session cookie.

Common failure response:

```json
{
  "error": "unauthorized",
  "message": "Authentication required"
}
```

## Related Documentation

- [Internal API](./internal-api.md)
- [Streaming API](./streaming-api.md)
- [Sync Pipeline](../developer-guide/architecture/sync-pipeline.md)
