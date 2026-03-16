# Change Feed Guide

The Change Feed at `/changes` is the fastest way to see what recently changed across Steam storefront data, PICS-derived signals, media assets, and Steam news.

## What the Page Shows

The page has two tabs:

- **Feed** groups related storefront, PICS, and media events into bursts for a single app
- **News** shows recent Steam news posts with app context

## Feed Tab

Each feed row represents a grouped burst of changes for one app.

A row can show:

- app name and app type
- whether the app is still upcoming
- source badges such as `Storefront`, `PICS`, or `Media`
- headline change chips such as release-date, price, languages, tags, screenshots, or capsule/header updates
- related-news counts when nearby Steam news posts were captured

Selecting a row opens the detail drawer.

## Detail Drawer

The drawer shows:

- every individual change event in the burst
- before/after values when available
- related Steam news posts
- impact windows that compare baseline and post-change metrics

Use this when you need to move from “something changed” to “what changed and what happened next.”

## News Tab

The News tab lists captured Steam news items with:

- app name
- app type
- feed labels and feed names, when present
- published time or first-seen time
- direct outbound link to the post

## Presets

The Feed tab supports three presets:

| Preset | What it emphasizes |
|--------|--------------------|
| **High Signal** | Bursts with stronger product or commercial relevance |
| **Upcoming Radar** | Upcoming titles and recently released games |
| **All Changes** | Everything captured in recency order |

## Filters

You can refine both tabs with:

- **Time range**: `24h`, `7d`, `30d`
- **App type**
- **Source** on the Feed tab
- **Search** by app name

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
- connect bursts of product changes with nearby Steam announcements
- check whether a change was a pure technical churn event or a meaningful market signal

## Related Documentation

- [Games Page](./games-page.md)
- [Insights Page](./insights-page.md)
- [Change Feed Developer Guide](../developer-guide/features/change-feed.md)
- [Steam Change Intelligence](../developer-guide/workers/steam-change-intelligence.md)
