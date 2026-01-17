# Games Page Guide

This guide explains how to use the Games page in PublisherIQ to discover, filter, compare, and export game data.

> **Related Documentation:**
> - [Games Page Architecture](../architecture/games-page.md)
> - [v2.6 Release Notes](../releases/v2.6-games-page.md)

---

## Overview

The Games page at `/apps` lets you:

- **Discover** Steam games using powerful presets and filters
- **Filter** by metrics, growth, sentiment, engagement, and more
- **Compare** up to 5 games side-by-side
- **Export** data as CSV or JSON
- **Save** filter configurations as named views

> **Naming Note:** The page displays "Games" in the UI, but uses `/apps` as the URL route for technical consistency with the database.

---

## Getting Started

### Accessing the Page

Navigate to **Games** from the main navigation, or go directly to `/apps`.

### Default View

By default, you'll see:
- Games only (excludes DLC and demos)
- Sorted by **Peak CCU** (descending)
- 10 default columns visible (including Momentum and Sparkline)
- 50 games per page

---

## Game Type Toggle

Switch between viewing different content types.

| Option | Description |
|--------|-------------|
| **All Types** | Shows all apps (games, DLC, demos) |
| **Games** | Games only (default) |
| **DLC** | Downloadable content only |
| **Demos** | Demos only |

**URL:** `?type=game`, `?type=all`, `?type=dlc`, or `?type=demo`

---

## Searching

Use the search bar to find games by name:

1. Click the search bar or press `/` to focus
2. Type the game name
3. Results filter as you type (300ms debounce)

**Features:**
- Case-insensitive matching
- Partial name matching (e.g., "counter" matches "Counter-Strike 2")
- Clear button (×) to reset search

---

## Using Preset Views

Presets are pre-configured filter combinations for common discovery patterns.

### Available Presets

| Preset | What It Shows | Use Case |
|--------|---------------|----------|
| **Top Games** | Games with 1,000+ CCU, sorted by CCU | Find most-played games |
| **Rising Stars** | Growing games (25%+) under 500K owners | Find emerging hits |
| **Hidden Gems** | Highly rated (90%+) games under 50K owners | Discover undiscovered gems |
| **New Releases** | Games released in last 30 days | Stay current on launches |
| **Breakout Hits** | New games (90 days) with 50%+ growth | Catch explosive launches |
| **🔥 High Momentum** | Strong trajectory (15+ momentum, 500+ CCU) | Identify games "taking off" |
| **📈 Comeback Stories** | Improving sentiment (5%+) with 1K+ reviews | Find recovering games |
| **🌲 Evergreen** | Classic games (2+ years) still thriving | Find timeless hits |
| **💎 True Gems** | Highly rated with engaged community | Discover passionate fanbases |
| **💰 Best Value** | Most entertainment per dollar | Find value-for-money games |
| **🏆 Publisher's Best** | Outperforming publisher's average | Find publisher standouts |
| **🆓 F2P Leaders** | Top free-to-play games | Track F2P market |

### How to Use

1. Click a preset button in the filter bar
2. Filters and sort order are automatically applied
3. Click again to deactivate

**Note:** Presets are exclusive - selecting one clears other presets and filters.

---

## Quick Filters

Quick filters are stackable toggles that can be combined with AND logic:

| Filter | Criteria |
|--------|----------|
| **Popular** | 1,000+ concurrent players |
| **Trending ↑** | 10%+ weekly growth |
| **Well Reviewed** | 85%+ positive reviews |
| **Free** | Free-to-play games |
| **Indie** | Small publisher (<10 games) |
| **Steam Deck** | Verified or Playable on Steam Deck |
| **Momentum ↑** | Momentum score 10+ |
| **Sentiment ↑** | Sentiment improving (3%+ delta) |
| **Workshop** | Has Steam Workshop support |
| **Early Access** | Currently in Early Access |
| **On Sale** | Currently discounted |
| **This Week** | Released in last 7 days |

### How to Use

1. Click one or more quick filter buttons
2. Filters stack (e.g., "Popular" + "Trending" shows games with both)
3. Click an active filter to remove it

**Tip:** Combine quick filters with presets for powerful queries.

---

## Advanced Filters

Click **Advanced Filters** to expand the full filter panel with 9 categories.

### Metric Filters

Set minimum and/or maximum values for core metrics:

| Metric | Description |
|--------|-------------|
| Peak CCU | Highest concurrent users (24h) |
| Owners | Estimated total owners |
| Reviews | Total review count |
| Review Score | Positive review percentage |
| Price | Current price in dollars |
| Playtime | Average playtime in hours |

### Growth Filters

Filter by CCU growth percentage:

| Filter | Time Period |
|--------|-------------|
| CCU Growth (7d) | Week-over-week change |
| CCU Growth (30d) | Month-over-month change |
| Momentum | Combined growth + velocity signal |

**Preset Buttons:**
- **Growing**: 10%+ growth
- **Stable**: Between -10% and +10%
- **Declining**: Below -10%

### Sentiment Filters

Filter by review sentiment changes:

| Filter | Description |
|--------|-------------|
| Sentiment Delta | Change in positive review percentage |
| Velocity Tier | Review activity level (High/Medium/Low/Dormant) |

**Preset Buttons:**
- **Improving**: 3%+ sentiment increase
- **Stable**: Between -3% and +3%
- **Declining**: Below -3%
- **Bombing**: Below -10% (review bomb)

### Engagement Filters

Filter by engagement metrics:

| Metric | Description |
|--------|-------------|
| Active Player % | What % of owners are playing now |
| Review Rate | Reviews per 1,000 owners |
| Value Score | Hours of entertainment per dollar |

### Content Filters

Filter by game content characteristics:

#### Genres
- Select one or more genres
- Mode toggle: **Any** (OR) vs **All** (AND)

#### Tags
- Searchable dropdown with tag counts
- Shows how many games have each tag

#### Categories/Features
- Checkbox grid of Steam categories
- E.g., Single-player, Multiplayer, VR Support

#### Workshop
- Toggle to require Steam Workshop support

### Platform Filters

| Filter | Options |
|--------|---------|
| **Platforms** | Windows / Mac / Linux (with Any/All mode) |
| **Steam Deck** | Verified / Playable / Unsupported |
| **Controller** | Full / Partial support |

### Release Filters

| Filter | Description |
|--------|-------------|
| Period | Presets: 7d, 30d, 90d, year, 2024, 2023... |
| Age | Min/max days since release |
| Early Access | Filter by Early Access status |
| Hype Duration | Pre-release marketing period (days) |

### Relationship Filters

Filter by publisher/developer context:

| Filter | Description |
|--------|-------------|
| Publisher Search | Find games by publisher name |
| Developer Search | Find games by developer name |
| Self-Published | Publisher = Developer |
| vs Publisher Avg | Performance vs publisher's catalog average |
| Publisher Size | Indie (<5) / Mid (5-20) / Major (20+) |

### Activity Filters

| Filter | Description |
|--------|-------------|
| CCU Tier | Hot (Tier 1) / Active (Tier 2) / Quiet (Tier 3) |

---

## Customizing Columns

### Showing/Hiding Columns

1. Click the **Columns** button
2. Check/uncheck columns to show/hide by category
3. Changes apply immediately and persist in URL

### Available Columns (33 Total)

| Category | Columns |
|----------|---------|
| **Core** | Rank, Name |
| **Engagement** | Avg Playtime, Playtime 2w, Active Player % |
| **Reviews** | Reviews, Score %, Velocity 7d/30d, Velocity Tier, Sentiment Δ, Review Rate |
| **Growth** | Peak CCU, Growth 7d/30d, Momentum, Acceleration, Sparkline |
| **Financial** | Price, Discount, Owners, Value Score |
| **Context** | Publisher, Developer, vs Publisher Avg, Publisher Games |
| **Timeline** | Release Date, Days Live, Hype Duration |
| **Platform** | Steam Deck, Platforms, Controller |
| **Activity** | CCU Tier |

### Default Columns

Rank, Name, Peak CCU, Growth 7d, Momentum, Owners, Reviews, Price, Release, Sparkline

---

## Understanding Computed Metrics

### Momentum Score

Combined signal showing both player count AND review activity trajectory.

| Score | Display | Meaning |
|-------|---------|---------|
| ≥20 | 🚀🚀 | Explosive momentum |
| 10-19 | 🚀 | Strong momentum |
| 0-9 | ↗ | Positive trajectory |
| -9 to 0 | → | Flat |
| -19 to -10 | ↘ | Declining |
| ≤-20 | 📉 | Severe decline |

**Formula:** (CCU Growth 7d + Velocity Acceleration) / 2

### Sentiment Delta

Change in review sentiment over time.

| Change | Display | Meaning |
|--------|---------|---------|
| ≥+10% | ⬆ Surging | Major improvement |
| +3% to +9% | ↑ Improving | Getting better |
| -3% to +3% | → Stable | No change |
| -9% to -3% | ↓ Declining | Getting worse |
| ≤-10% | ⬇ Review Bomb | Major decline |

### Other Insight Metrics

| Metric | What It Shows |
|--------|---------------|
| **Active Player %** | Engagement depth (CCU ÷ Owners × 100) |
| **Review Rate** | Community engagement (Reviews per 1K owners) |
| **Value Score** | Entertainment per dollar (Playtime ÷ Price) |
| **vs Publisher Avg** | Performance vs publisher's catalog |

---

## Sorting

### How to Sort

1. Click any sortable column header
2. Click again to reverse sort direction
3. Arrow indicates current sort: ↑ (ascending) / ↓ (descending)

### Sortable Columns

Most columns support server-side sorting:
- Name, Peak CCU, Owners, Reviews, Score, Price, Release Date
- Growth 7d/30d, Momentum, Sentiment Delta
- Active %, Review Rate, Value Score, vs Publisher Avg

---

## Comparing Games

Compare 2-5 games side-by-side.

### Selecting Games

1. Check the checkbox next to each game you want to compare
2. Select 2-5 games (max 50 selections total)
3. A floating action bar appears at the bottom

### Shift+Click Range Selection

Hold Shift and click to select a range of games between your last click and current click.

### Opening Compare Mode

1. Click **Compare** in the action bar
2. A full-screen comparison table opens

### Understanding the Comparison

| Element | Description |
|---------|-------------|
| **Baseline** | First game selected (leftmost column) |
| **vs Avg** | How each game compares to selected games average |
| **Best** | Green highlight on best value in row |
| **Worst** | Red highlight on worst value in row |

**Metrics Compared (17):**
- Peak CCU, Owners, Reviews, Score %, Price
- Growth 7d/30d, Momentum, Sentiment Delta
- Velocity 7d/30d, Active %, Review Rate
- Value Score, Playtime, Discount

### Sharing Comparisons

The comparison is URL-encoded: `?compare=730,1245620,553850`

Share the URL with colleagues to show them the same comparison.

### Exiting Compare Mode

Click the **× Close** button or press Escape.

---

## Exporting Data

### Export Options

1. Click **Export** in the action bar (with selections) or from the toolbar
2. Choose options:
   - **Format:** CSV or JSON
   - **Scope:** All filtered results or selected only
   - **Columns:** Visible columns or all metrics
   - **Metadata:** Include filter description as CSV comments
3. Click **Download**

### CSV Format

- Includes filter summary as header comments
- One row per game
- All requested metrics as columns
- Filename: `games-export-{timestamp}.csv`

---

## Saving Views

Save your current filter configuration for later.

### Saving a View

1. Set up your desired filters, columns, and sort
2. Click **Saved Views** dropdown
3. Click **Save Current View**
4. Enter a name (e.g., "My Watchlist")
5. Click **Save**

### Loading a View

1. Click **Saved Views** dropdown
2. Click on a saved view name
3. Filters, columns, and sort are restored

### Managing Views

- **Rename:** Click the pencil icon next to a view
- **Delete:** Click the trash icon next to a view
- **Limit:** Maximum 10 saved views

---

## Understanding Sparklines

The CCU Sparkline column shows a 7-day CCU trend visualization:

- **Green line:** Upward trend (>5% increase)
- **Red line:** Downward trend (>5% decrease)
- **Blue line:** Stable

Sparklines load as you scroll (lazy loading).

---

## Tips & Best Practices

### Finding Breakout Games
1. Apply **Breakout Hits** preset, OR
2. Set **Min Growth 7d** to 50% and **Max Age** to 90 days

### Finding Hidden Gems
1. Apply **Hidden Gems** preset, OR
2. Set **Min Score** to 90%, **Max Owners** to 50K, **Min Reviews** to 100

### Finding Games to Cover (Content Creators)
1. Apply **High Momentum** preset
2. Add **Well Reviewed** quick filter
3. Focus on Momentum and Sentiment columns

### Finding Comeback Stories
1. Apply **Comeback Stories** preset
2. Sort by Sentiment Delta descending
3. Look for games with positive sentiment and high review counts

### Finding Best Value Games
1. Apply **Best Value** preset
2. Add **Well Reviewed** quick filter
3. Sort by Value Score

### Competitive Analysis
1. Search for competitor games by name
2. Select them with checkboxes
3. Click **Compare** to see side-by-side metrics

### For Export Reports
1. Apply filters to narrow down games
2. Customize columns for the metrics you need
3. Export as CSV for spreadsheet analysis

### For Recurring Analysis
1. Set up your filters once
2. Save as a named view
3. Load the view each time you return

---

## URL Parameters Reference

All filters are stored in the URL for bookmarking and sharing:

```
/apps?type=game
     &sort=momentum_score
     &order=desc
     &preset=rising_stars
     &filters=popular,trending
     &minCcu=1000
     &minGrowth7d=10
     &genres=1,5
     &steamDeck=verified
     &columns=rank,name,ccu_peak,momentum_score,reviews
     &compare=730,1245620,553850
```

Share the full URL with colleagues to give them the exact same view.

---

## Related Documentation

- [Games Page Architecture](../architecture/games-page.md) - Technical details
- [v2.6 Release Notes](../releases/v2.6-games-page.md) - Full feature list
- [Games Page Spec](../specs/apps-page-spec.md) - Original design specification
