# Steam Activity Architecture

This document describes the implementation of the `/changes` feature.

## Overview

Steam Activity is a signed-in dashboard surface that lets users inspect:

- one unified activity feed of grouped change cards and announcement cards
- readable before / after detail for grouped change activity
- related announcements and impact windows
- capture health status

## Main Route

- page route: `apps/admin/src/app/(main)/changes/page.tsx`
- client UI: `apps/admin/src/app/(main)/changes/ChangeFeedPageClient.tsx`
- legacy drawer: `apps/admin/src/app/(main)/changes/ChangeFeedDrawer.tsx`

## Data Model

The feature now works with these main response shapes:

- `ChangeFeedActivityResponse`
- `ChangeFeedActivityDetailResponse`
- legacy burst/news response types for fallback and app-specific drill-down

These are defined in `apps/admin/src/app/(main)/changes/lib/change-feed-types.ts`.

## Filters and Querying

The unified activity feed supports:

- quick view
- mode
- range
- app type
- signal family filters
- search
- sort
- cursor pagination

Parameter parsing and row mapping live in `change-feed-query.ts`.

## Server Access Layer

`change-feed-server.ts` is the server-side access layer.

It is responsible for:

- calling Supabase RPCs
- mapping raw rows into activity-card UI types
- falling back to legacy burst/news surfaces if the unified RPC is unavailable
- caching default activity responses for a short TTL

## Internal APIs

| Endpoint | Purpose |
|----------|---------|
| `/api/change-feed/activity` | unified activity list |
| `/api/change-feed/activity/[activityId]` | unified activity detail |
| `/api/change-feed/bursts` | burst list |
| `/api/change-feed/bursts/[burstId]` | burst detail |
| `/api/change-feed/news` | news list |
| `/api/change-feed/status` | capture health status |

All endpoints require an authenticated session.

## SQL Read Surfaces

The feature depends on these functions:

- `get_change_feed_activity`
- `get_change_feed_bursts`
- `get_change_feed_burst_detail`
- `get_change_feed_news`

They are created by:

- `20260315193000_add_change_feed_activity_read_surface.sql`
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
- `pics-service` must keep writing internal history and diff events

## Related Documentation

- [Steam Activity User Guide](../../user-guide/change-feed.md)
- [Steam Change Intelligence](../workers/steam-change-intelligence.md)
- [Internal API](../../api/internal-api.md)
