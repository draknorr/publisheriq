# Data Pipeline Reference

Use this skill when working on sync workers, ingestion, PICS service, or data source integrations.

## Sources & Rate Limits

| Source | Rate Limit | Data |
|--------|------------|------|
| Steam GetAppList | 100k/day | All appIDs |
| Steam Storefront | ~200/5min | Metadata, dev/pub (**authoritative**) |
| Steam Reviews | ~60/min | Review counts, scores |
| Steam Histogram | ~60/min | Monthly review buckets |
| Steam CCU API | 1/sec | Exact player counts |
| SteamSpy | 1/sec | CCU, owners, tags (NOT authoritative for dev/pub) |
| PICS Service | ~200 apps/req | Tags, genres, Steam Deck (real-time via SteamKit2) |

## Sync Priority Tiers (refresh_tier)

| Tier | Criteria | Sync Interval |
|------|----------|---------------|
| `active` | CCU > 100 OR reviews/day > 1 | 6-12h |
| `moderate` | CCU > 0 | 24-48h |
| `dormant` | No activity 90 days | Weekly |
| `dead` | No activity 1 year | Monthly |

## CCU Polling Tiers (ccu_tier)

| Tier | Criteria | Polling |
|------|----------|---------|
| `tier1` | Top 500 by 7-day peak CCU | Hourly |
| `tier2` | Top 1000 newest releases | Every 2h |
| `tier3` | All others (~120K+) | 3x daily (rotation) |

## PICS Service (Python on Railway)

- `bulk_sync` mode: Initial load (~3 min for 70k apps)
- `change_monitor` mode: Continuous polling (every 30s)
- Data: Tags, genres, categories, franchises, Steam Deck, controller support, platforms, review scores, parent appid, last content update
- Health: `GET /`, `GET /health`, `GET /status`

## Worker Scripts

All run via `pnpm --filter @publisheriq/ingestion <script-name>`:

| Script | Purpose |
|--------|---------|
| `applist-sync` | Master app list from Steam |
| `steamspy-sync` | CCU, owners, tags from SteamSpy |
| `storefront-sync` | Game metadata from Steam Store |
| `reviews-sync` | Review counts and scores |
| `histogram-sync` | Monthly review buckets |
| `calculate-trends` | 30/90-day trend computation |
| `update-priorities` | Priority score recalculation |
| `embedding-sync` | Vector embeddings for similarity |
| `price-sync` | Price data updates |
| `ccu-tiered-sync` | Tier 1+2 CCU polling |
| `ccu-daily-sync` | Tier 3 CCU rotation |
| `calculate-velocity` | Review velocity tiers |
| `interpolate-reviews` | Review delta interpolation |
| `refresh-views` | Materialized view refresh |
| `alert-detection` | Alert detection for pinned entities |

**Common name mistakes:** `calculate-trends` NOT "trends-calculate", `update-priorities` NOT "priority-calculate".

## GitHub Actions Schedules

Workflow schedules are defined in `.github/workflows/*.yml`. Read those files directly for current cron expressions - they are the source of truth.

## Vector Search (Qdrant)

| Collection | Entity | Purpose |
|------------|--------|---------|
| `publisheriq_games` | Games | Find similar games |
| `publisheriq_publishers_portfolio` | Publishers | Match by catalog |
| `publisheriq_publishers_identity` | Publishers | Match by top games |
| `publisheriq_developers_portfolio` | Developers | Match by catalog |
| `publisheriq_developers_identity` | Developers | Match by top games |

**Config:** 512 dimensions, int8 quantization, on-disk payloads, hash-based change detection.
