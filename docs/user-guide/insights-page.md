# Insights Page Guide

The Insights page provides real-time analytics on game performance, featuring top games, newest releases, and trending titles.

---

## Overview

The Insights page at `/insights` offers:

- **My Dashboard**: Your pinned items and alerts (personalized view)
- **Top Games**: Games ranked by peak concurrent users
- **Newest**: Recently released games with growth data
- **Trending**: Games with the highest growth percentages

---

## Accessing the Page

Navigate to **Insights** from the main navigation, or go directly to `/insights`.

---

## Time Range Selector

All tabs use a shared time range selector in the header.

| Option | Description |
|--------|-------------|
| **24h** | Last 24 hours of data |
| **7d** | Last 7 days (default) |
| **30d** | Last 30 days |

Changing the time range refreshes data across all tabs.

---

## Tabs

### My Dashboard

Your personalized view showing:

- **Recent Alerts**: Latest 5 alerts for your pinned items
- **Pinned Items**: Games, publishers, and developers you're tracking

This tab requires being signed in and having pinned items.

See [Personalization Guide](./personalization.md) for details on pinning and alerts.

### Top Games

Shows the top 50 games by peak CCU (concurrent users).

| Column | Description |
|--------|-------------|
| **Rank** | Position by peak CCU |
| **Game** | Game title with link to detail page |
| **Peak CCU** | Highest concurrent users in time period |
| **Reviews** | Total review count |
| **Trend** | CCU sparkline visualization |

### Newest

Shows recently released games with two sort modes:

| Sort Mode | Description |
|-----------|-------------|
| **By Release** | Newest releases first (default) |
| **By Growth** | Highest growth percentage first |

Toggle between modes using the sort buttons at the top of the tab.

**Columns:**
- Release date
- Game title
- Peak CCU
- Growth percentage
- Sparkline trend

### Trending

Shows the top 50 games by CCU growth percentage.

| Column | Description |
|--------|-------------|
| **Rank** | Position by growth % |
| **Game** | Game title with link |
| **Growth** | Percentage change in time period |
| **Peak CCU** | Current peak concurrent users |
| **Trend** | Sparkline visualization |

---

## Sparkline Visualizations

Each game row includes a sparkline showing CCU trends:

| Line Color | Meaning |
|------------|---------|
| **Green** | Upward trend (>5% increase) |
| **Red** | Downward trend (>5% decrease) |
| **Blue/Gray** | Stable |

Sparklines are compact (70x24px) and show 12 data points.

---

## URL Parameters

The page state is preserved in the URL for bookmarking and sharing.

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `timeRange` | `24h`, `7d`, `30d` | `7d` | Data time period |
| `tab` | `dashboard`, `top`, `newest`, `trending` | `dashboard` | Active tab |
| `sort` | `release`, `growth` | `release` | Sort mode (Newest tab only) |

### Example URLs

**Top games over 30 days:**
```
/insights?timeRange=30d&tab=top
```

**Newest games sorted by growth:**
```
/insights?tab=newest&sort=growth
```

**Trending games last 24 hours:**
```
/insights?timeRange=24h&tab=trending
```

---

## Interacting with Game Rows

Click any game row to navigate to its detail page at `/apps/{appid}`.

From there you can:
- View full metrics and history
- Pin the game to your dashboard
- See publisher/developer information

---

## Tips

### Finding Breakout Games
1. Select **7d** or **30d** time range
2. Go to **Trending** tab
3. Look for games with high growth AND reasonable CCU

### Staying Current on Releases
1. Go to **Newest** tab
2. Sort by **Release** for chronological view
3. Sort by **Growth** to find successful launches

### Building Your Watchlist
1. Find interesting games in any tab
2. Click to view details
3. Use the **Pin** button to add to your dashboard
4. Check **My Dashboard** for updates

---

## Related Documentation

- [Personalization Guide](./personalization.md) - Pinning and alerts
- [Games Page](./games-page.md) - Full game discovery with filters
- [Companies Page](./companies-page.md) - Publisher and developer analytics
