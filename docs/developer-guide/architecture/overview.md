# System Architecture Overview

PublisherIQ is a Steam analytics platform built around three product surfaces:

- analytics pages for games and companies
- a Change Feed for recent storefront, media, PICS, and news activity
- an AI chat interface over curated warehouse data

**Last Updated:** March 15, 2026

## High-Level Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 15 + React 19 | Signed-in dashboard and public landing page |
| Database | Supabase Postgres | Core warehouse, auth, queueing, RPCs |
| Semantic Layer | Cube.js | Chat analytics queries |
| Vector Search | Qdrant Cloud | Similarity and concept search |
| TS Workers | `@publisheriq/ingestion` | Scheduled syncs and change-intel workers |
| Python Service | `services/pics-service` | PICS ingestion and PICS-side change history |

## Main Product Routes

| Route | Role |
|------|------|
| `/dashboard` | Signed-in home |
| `/chat` | AI query interface |
| `/insights` | Curated analytics and personalization |
| `/changes` | Change Feed and Steam news |
| `/apps` | Games analytics |
| `/companies` | Unified publishers/developers browse |
| `/admin` | Admin system status |
| `/updates` | In-app patch notes |

## Runtime Layout

```text
Steam APIs / Steam News / SteamSpy / PICS
        ↓
TypeScript workers + PICS service
        ↓
Supabase (tables, queues, RPCs, auth)
        ↓
Cube.js + Qdrant
        ↓
Next.js dashboard
```

## Major Subsystems

### Dashboard App

The dashboard in `apps/admin` owns:

- OTP-first login and callback handling
- games, companies, insights, and Change Feed pages
- admin pages and waitlist flows
- internal APIs for chat, alerts, pins, and Change Feed

### Ingestion Workers

`packages/ingestion` owns scheduled warehouse updates and long-running queue workers:

- catalog and metadata sync (`applist-sync`, `storefront-sync`, `steamspy-sync`)
- reviews, histogram, CCU, and derived metrics
- `app-change-hints` to seed change-intel capture work
- `change-intel-worker` to drain `storefront`, `news`, and `hero_asset` queue sources

### PICS Service

`services/pics-service` owns:

- direct PICS polling
- normalized PICS snapshot history
- PICS diff event generation
- latest-state app and relationship upserts

### Database and Read Surfaces

Supabase stores:

- the warehouse tables and derived views
- auth/session state
- the capture queue and change events
- Change Feed SQL read surfaces such as `get_change_feed_bursts`

Cube.js and Qdrant support the AI chat and search/discovery surfaces.

## Auth Model

PublisherIQ now uses an OTP-first auth flow:

- protected routes redirect to `/login?next=...`
- `/login` verifies an 8-digit code
- the browser waits for an authoritative authenticated user before redirecting
- `/auth/callback` and `/auth/confirm` remain as compatibility handlers
- redirect origins are normalized through `NEXT_PUBLIC_SITE_URL`

## Change-Intelligence Flow

The current change-intelligence system has three runtimes:

1. `app-change-hints` reads Steam hint cursors and enqueues capture work.
2. `change-intel-worker` captures storefront snapshots, Steam news, and hero assets, then writes change events.
3. `pics-service` captures normalized PICS history and PICS diff events inline before latest-state writes.

The `/changes` page reads from SQL functions and internal APIs on top of those stored events.

## Monorepo Structure

```text
publisheriq/
├── apps/admin/
├── packages/database/
├── packages/ingestion/
├── packages/qdrant/
├── packages/shared/
├── packages/cube/
├── services/pics-service/
├── supabase/migrations/
└── docs/
```

## Related Documentation

- [Sync Pipeline](./sync-pipeline.md)
- [Data Sources](./data-sources.md)
- [Chat Data System](./chat-data-system.md)
- [Change Feed Feature](../features/change-feed.md)
