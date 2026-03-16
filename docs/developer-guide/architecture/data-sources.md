# Data Sources

PublisherIQ combines official Steam APIs, SteamSpy, Steam news, and PICS-derived metadata.

**Last Updated:** March 15, 2026

## Source Hierarchy

| Tier | Source | Role |
|------|--------|------|
| 1 | Steam App List | Catalog and app-list hint cursors |
| 1 | Steam Storefront | Authoritative storefront metadata |
| 1 | Steam Reviews + Histogram | Reviews and review history |
| 1 | Steam CCU API | Exact current player counts |
| 1 | Steam News | Public announcements and update posts |
| 2 | SteamSpy | Owners, playtime, tag enrichment |
| 3 | PICS | Specialized metadata, relationships, Steam Deck, PICS-side change history |

## Authority Rules

### Storefront

Storefront is authoritative for:

- developers and publishers
- parsed `release_date`
- `is_free`
- pricing and discount state

When Storefront only exposes non-parseable text such as “Coming soon”, PublisherIQ preserves the raw text and leaves the typed `release_date` unset.

### PICS

PICS is enrichment and fallback data for:

- store tags
- genres and categories
- franchises and relationships
- Steam Deck compatibility
- release-state and store-asset timestamps
- PICS-side history and diff events

PICS does not override authoritative Storefront values for `release_date` or `is_free`.

## Change-Intelligence Sources

PublisherIQ’s change-intelligence runtime depends on four source families:

| Source | Captures |
|--------|----------|
| App List hints | `last_modified` and `price_change_number` for recapture seeding |
| Storefront | copy, languages, pricing, release text, platforms, categories, genres, media URLs |
| Steam News | announcements and post history |
| PICS | release state, build/update signals, tags, categories, genres, Steam Deck, relationships |

## Source Notes

### Steam App List

- endpoint: `IStoreService/GetAppList`
- used for catalog discovery and hint cursor changes
- powers `app-change-hints`

### Steam Storefront

- endpoint: `https://store.steampowered.com/api/appdetails`
- current-state source for most product-facing metadata
- storefront snapshots are part of the change-intelligence system

### Steam News

- endpoint family: `ISteamNews/GetNewsForApp`
- used for `/changes?tab=news`
- nearby posts are attached to change bursts when they fall within the related-news window

### SteamSpy

- owner estimates and playtime remain useful enrichment
- CCU is no longer authoritative here; current CCU comes from Steam’s native player-count API

### PICS

- direct Steam client-protocol data, not a standard public Web API
- current-state enrichment and historical PICS snapshotting are both implemented in this repo

## Related Documentation

- [Sync Pipeline](./sync-pipeline.md)
- [PICS Data Fields](../../reference/pics-data-fields.md)
- [Steam Change Intelligence](../workers/steam-change-intelligence.md)
