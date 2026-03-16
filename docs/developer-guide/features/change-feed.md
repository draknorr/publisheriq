# Change Feed Architecture

This document describes the implementation of the `/changes` feature.

## Overview

The Change Feed is a signed-in dashboard surface that lets users inspect:

- grouped storefront, PICS, and media change bursts
- recent Steam news posts
- per-burst detail, related news, and impact windows
- capture health status

## Main Route

- page route: `apps/admin/src/app/(main)/changes/page.tsx`
- client UI: `apps/admin/src/app/(main)/changes/ChangeFeedPageClient.tsx`
- detail drawer: `apps/admin/src/app/(main)/changes/ChangeFeedDrawer.tsx`

## Data Model

The feature works with three main response shapes:

- `ChangeFeedBurstsResponse`
- `ChangeFeedNewsResponse`
- `ChangeBurstDetailResponse`

These are defined in `apps/admin/src/app/(main)/changes/lib/change-feed-types.ts`.

## Filters and Querying

### Feed Tab

Supports:

- preset
- range
- app type
- source filter
- search
- keyset cursor pagination

### News Tab

Supports:

- range
- app type
- search
- keyset cursor pagination

Parameter parsing and row mapping live in `change-feed-query.ts`.

## Server Access Layer

`change-feed-server.ts` is the server-side access layer.

It is responsible for:

- calling Supabase RPCs
- mapping raw rows into UI types
- handling “migration not applied yet” failures cleanly
- caching default bursts/news responses for a short TTL

## Internal APIs

| Endpoint | Purpose |
|----------|---------|
| `/api/change-feed/bursts` | burst list |
| `/api/change-feed/bursts/[burstId]` | burst detail |
| `/api/change-feed/news` | news list |
| `/api/change-feed/status` | capture health status |

All endpoints require an authenticated session.

## SQL Read Surfaces

The feature depends on these functions:

- `get_change_feed_bursts`
- `get_change_feed_burst_detail`
- `get_change_feed_news`

They are created by:

- `20260315114500_add_change_feed_read_surfaces.sql`
- `20260315143000_optimize_change_feed_news_rpc.sql`

## Status Semantics

The status endpoint derives one of three states:

- `healthy`
- `catching_up`
- `delayed`

The state is based on:

- queued storefront/news jobs
- age of the oldest queued item
- freshness of the latest storefront change event
- freshness of the latest news change event

## Dependencies on the Change-Intel Runtime

The UI is only as useful as the runtime beneath it:

- `app-change-hints` must continue seeding new storefront capture work
- `change-intel-worker` must keep draining `storefront`, `news`, and `hero_asset`
- `pics-service` must keep writing PICS-side history and diff events

## Related Documentation

- [Change Feed User Guide](../../user-guide/change-feed.md)
- [Steam Change Intelligence](../workers/steam-change-intelligence.md)
- [Internal API](../../api/internal-api.md)
