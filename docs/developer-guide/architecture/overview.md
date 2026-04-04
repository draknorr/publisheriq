# System Architecture Overview

PublisherIQ is a Steam analytics platform built around three product surfaces:

- analytics pages for games and companies
- a Change Feed for recent storefront, media, PICS, and news activity
- an AI chat interface over curated warehouse data and change-intelligence projections

**Last Updated:** March 30, 2026

## High-Level Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 15 + React 19 | Signed-in dashboard and public entry surfaces |
| Database | Supabase Postgres | Warehouse tables, queues, auth, RPCs, and cached admin stats |
| Semantic Layer | Cube.js | Chat analytics, screeners, and structured discovery |
| Tiger Query API | `apps/query-api` + `packages/data-plane` | Tiger-backed chat contracts, semantic retrieval, and continuation |
| TS Workers | `@publisheriq/ingestion` | Scheduled syncs, queue workers, and change-intel maintenance |
| Python Service | `services/pics-service` | PICS ingestion plus history capture and first-pass bootstrap |

## Main Product Routes

| Route | Role |
|------|------|
| `/dashboard` | Signed-in home |
| `/chat` | AI query interface |
| `/insights` | Curated analytics and personalization |
| `/changes` | Unified Change Feed and Steam news exploration |
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
Supabase (tables, queues, projections, RPCs, auth)
        ↓
Cube.js + Tiger query-api
        ↓
Next.js dashboard
```

## Major Subsystems

### Dashboard App

The dashboard in `apps/admin` owns:

- OTP-first login and callback handling
- games, companies, insights, chat, and Change Feed pages
- admin pages for users, waitlist, usage, and system health
- internal APIs for chat, alerts, pins, and Change Feed

### Ingestion Workers

`packages/ingestion` owns scheduled warehouse updates and long-running queue workers:

- catalog and metadata sync (`applist-sync`, `storefront-sync`, `steamspy-sync`)
- reviews, histogram, CCU, and derived metrics
- `app-change-hints` to seed change-intel capture work
- `change-intel-worker` to drain `storefront`, `news`, `projection_refresh`, and `hero_asset` work

### PICS Service

`services/pics-service` owns:

- direct PICS polling
- bulk backfill and the bounded `first_pass` bootstrap mode
- normalized PICS snapshot history
- PICS diff event generation
- latest-state app and relationship upserts

### Database and Read Surfaces

Supabase stores:

- the warehouse tables and derived views
- auth/session state
- capture queue state and coalesced work-state rows
- change-intel projections and change-feed read surfaces
- cached admin stats for catalog control and CCU quality

Cube.js and the Tiger query-api support the AI chat and search/discovery surfaces.

## Auth Model

PublisherIQ uses an OTP-first auth flow:

- protected routes redirect to `/login?next=...`
- `/login` verifies an 8-digit code
- the browser waits for an authoritative authenticated user before redirecting
- `/auth/callback` and `/auth/confirm` remain as compatibility handlers
- redirect origins are normalized through `NEXT_PUBLIC_SITE_URL`

## Change-Intelligence Flow

The current change-intelligence system has four cooperating layers:

1. `app-change-hints` reads Steam hint cursors and enqueues storefront capture work.
2. `change-intel-worker` captures storefront snapshots, Steam news, projection refreshes, and hero assets, then writes change events and refreshes downstream projections.
3. `app_capture_work_state` coalesces repeated dirty signals so the worker maintains one live task per app/source.
4. `pics-service` captures normalized PICS history and diff events inline before latest-state writes, while `first_pass` can bootstrap prioritized catalog gaps.

The `/changes` page reads from SQL functions and internal APIs on top of those stored events and projections.

## Monorepo Structure

```text
publisheriq/
├── apps/admin/
├── apps/query-api/
├── packages/data-plane/
├── packages/database/
├── packages/ingestion/
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
