# API Documentation

This section covers the APIs used by PublisherIQ, including internal APIs and external data sources.

---

## API Categories

### Internal APIs

APIs implemented by PublisherIQ:

| API | Description | Guide |
|-----|-------------|-------|
| **Chat Streaming API** | SSE-based chat interface | [Streaming API](./streaming-api.md) |
| **Internal Endpoints** | Dashboard and data APIs | [Internal API](./internal-api.md) |

### External Data Sources

APIs PublisherIQ consumes for data collection:

| API | Description | Guide |
|-----|-------------|-------|
| **Steam Web API** | App list, reviews, CCU | [Steam API](./steam-api.md) |
| **SteamSpy** | Owners, playtime, tags | [Steam API](./steam-api.md) |
| **Steam Storefront** | Game metadata | [Steam API](./steam-api.md) |

---

## Quick Reference

### Chat API

```bash
# Stream a chat response
curl -X POST http://localhost:3001/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What are the top games?"}]}'
```

### Rate Limits

All external APIs have rate limits enforced by workers:

| Source | Rate Limit | Notes |
|--------|------------|-------|
| Steam GetAppList | 100k/day | Master app list |
| Steam Storefront | ~200/5min | Metadata fetch |
| Steam Reviews | ~60/min | Review data |
| SteamSpy | 1/sec | Player metrics |
| Steam CCU | 1/sec | Player counts |

See [Rate Limits](./rate-limits.md) for detailed limits.

---

## Related Documentation

- [Chat Data System](../developer-guide/architecture/chat-data-system.md) - Full chat system architecture
- [Data Sources](../developer-guide/architecture/data-sources.md) - External API specifications
- [Sync Pipeline](../developer-guide/architecture/sync-pipeline.md) - How data flows
