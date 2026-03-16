# Steam Activity Guide

Steam Activity at `/changes` is the fastest way to scan what is happening across Steam in one readable feed.

## What the Page Shows

The page is one activity stream with three modes:

- **All activity** mixes grouped change cards and standalone announcements
- **Changes only** hides announcement-only cards
- **Announcements only** shows just Steam posts

Each row is an activity card with:

- app name and app type
- whether the title is upcoming
- a readable headline and summary
- signal pills such as `Release`, `Pricing`, `Store page`, `Media`, `Platform`, `Build activity`, and `Announcement`
- expandable before / after detail when available

Expanding a card shows:

- the actual before / after evidence
- related announcements
- impact windows when enough response data exists

Use this when you need to move from “something happened” to “what changed and what happened next.”

## Quick Views

The page supports these top-level views:

| View | What it emphasizes |
|------|--------------------|
| **Overview** | Most relevant recent activity across Steam |
| **Launch Watch** | Upcoming titles, recent launches, and date-locking activity |
| **Commercial Moves** | Pricing, discount, package, and monetization shifts |
| **Store Refreshes** | Copy, artwork, screenshots, trailers, tags, and presentation changes |
| **All Activity** | The raw recent stream in strict recency order |

## Filters

You can refine the stream with:

- **Time range**: `24h`, `7d`, `30d`
- **Signal family**
- **App type**
- **Search** by app name, headline, or theme
- **Sort**

## Status Badge

The page shows a health badge for change capture:

| State | Meaning |
|-------|---------|
| `healthy` | capture is current |
| `catching_up` | queue backlog or event freshness needs attention |
| `delayed` | backlog or capture freshness is materially behind |

This is a monitoring hint, not a guarantee that no events are missing.

## Best Uses

- monitor unreleased games for launch-prep activity
- spot pricing, release-date, or merchandising changes quickly
- review announcement cadence alongside product changes
- scan the broader market as a live exploration surface

## Related Documentation

- [Games Page](./games-page.md)
- [Insights Page](./insights-page.md)
- [Steam Activity Developer Guide](../developer-guide/features/change-feed.md)
- [Steam Change Intelligence](../developer-guide/workers/steam-change-intelligence.md)
