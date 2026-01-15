# Companies Page Guide

This guide explains how to use the Companies page in PublisherIQ to browse, filter, compare, and export publisher and developer data.

> **Related Documentation:**
> - [Companies Page Architecture](../architecture/companies-page.md)
> - [v2.5 Release Notes](../releases/v2.5-companies-page.md)

---

## Overview

The Companies page at `/companies` lets you:

- **Browse** all Steam publishers and developers in one unified view
- **Filter** by metrics, growth, content, platforms, and more
- **Compare** up to 5 companies side-by-side
- **Export** data as CSV or JSON
- **Save** filter configurations as named views

---

## Getting Started

### Accessing the Page

Navigate to **Companies** from the main navigation, or go directly to `/companies`.

### Default View

By default, you'll see:
- All companies (publishers and developers combined)
- Sorted by **Est. Weekly Hours** (descending)
- 8 default columns visible
- 50 companies per page

---

## Company Type Toggle

Switch between viewing publishers, developers, or both.

| Option | Description |
|--------|-------------|
| **All** | Shows both publishers and developers with a Role badge |
| **Publishers** | Publishers only (hides Role column) |
| **Developers** | Developers only (hides Role and Unique Devs columns) |

**URL:** `?type=all`, `?type=publisher`, or `?type=developer`

---

## Searching

Use the search bar to find companies by name:

1. Click the search bar or press `/` to focus
2. Type the company name
3. Results filter as you type (no submit needed)

**Features:**
- Case-insensitive matching
- Partial name matching (e.g., "valve" matches "Valve Corporation")
- Clear button (×) to reset search

---

## Using Preset Views

Presets are pre-configured filter combinations for common use cases:

### Available Presets

| Preset | What It Shows |
|--------|---------------|
| **Market Leaders** | Companies with $10M+ revenue, sorted by revenue |
| **Rising Indies** | Studios with ≤10 games and 10%+ weekly growth |
| **Breakout** | Rapidly growing companies (50%+) under 1M owners |
| **Growing Publishers** | Publishers with 10%+ weekly growth |

### How to Use

1. Click a preset button in the filter bar
2. Filters and sort order are automatically applied
3. Click again to deactivate

**Note:** Presets are exclusive - selecting one clears other presets.

---

## Quick Filters

Quick filters are stackable toggles that can be combined:

| Filter | Criteria |
|--------|----------|
| **Major 10+** | 10 or more games |
| **Prolific 5+** | 5 or more games |
| **Active** | Released a game in the last 12 months |
| **Trending** | Positive CCU growth |
| **$1M+** | Over $1M estimated revenue |
| **$10M+** | Over $10M estimated revenue |
| **100K+** | Over 100K total owners |

### How to Use

1. Click one or more quick filter buttons
2. Filters stack (e.g., "Major 10+" + "$1M+" shows companies with both)
3. Click an active filter to remove it

**Tip:** Combine quick filters with presets for powerful queries.

---

## Advanced Filters

Click **Advanced Filters** to expand the full filter panel.

### Metric Filters

Set minimum and/or maximum values for any metric:

| Metric | Description |
|--------|-------------|
| Game Count | Number of published/developed games |
| Total Owners | Total estimated owners across all games |
| Peak CCU | Highest concurrent users (24h) |
| Est. Weekly Hours | Estimated total weekly play time |
| Est. Revenue | Total estimated gross revenue |
| Avg Review Score | Weighted average review percentage |
| Total Reviews | Total review count |

**How to Use:**
1. Enter a minimum value, maximum value, or both
2. Click outside the input or press Enter to apply

### Growth Filters

Filter by CCU growth percentage:

| Filter | Time Period |
|--------|-------------|
| CCU Growth (7d) | Week-over-week change |
| CCU Growth (30d) | Month-over-month change |

**Preset Buttons:**
- **Growing**: Positive growth only
- **Declining**: Negative growth only
- **Stable**: Growth between -10% and +10%

### Content Filters

Filter by game content characteristics:

#### Genres
- Select one or more genres
- Mode toggle: **Has Any** (OR) vs **Has All** (AND)

#### Tags
- Searchable dropdown with tag counts
- Shows how many companies have games with each tag

#### Categories/Features
- Checkbox grid of Steam categories
- E.g., Single-player, Multiplayer, VR Support

#### Steam Deck
- **Any**: No filter
- **Verified**: Only companies with Deck-verified games
- **Playable**: Companies with playable (or verified) games

#### Platforms
- **Windows** / **Mac** / **Linux**
- Mode toggle: **Any** vs **All**

### Status & Relationship Filters

| Filter | Options |
|--------|---------|
| **Activity** | Active (released in 12mo) / Dormant |
| **Relationship** | Self-Published / Works with External Devs / Multi-Publisher |

---

## Customizing Columns

### Showing/Hiding Columns

1. Click the **Columns** button (grid icon)
2. Check/uncheck columns to show/hide
3. Changes apply immediately

### Available Columns by Category

| Category | Columns |
|----------|---------|
| **Engagement** | Est. Weekly Hours, Total Owners, Peak CCU |
| **Content** | Games, Unique Devs, Role |
| **Reviews** | Reviews, Avg Score, Review Velocity |
| **Financial** | Est. Gross Revenue |
| **Growth** | CCU Growth (7d), CCU Growth (30d), Trending |
| **Ratios** | Revenue/Game, Owners/Game, Reviews/1K Owners |
| **Visualization** | CCU Sparkline |

### Default Columns

Hours, Games, Owners, CCU, Reviews, Revenue, 7d Growth, Trending

### Understanding Ratio Columns

| Column | Formula | Higher Is |
|--------|---------|-----------|
| Revenue/Game | Total Revenue ÷ Game Count | Better (successful titles) |
| Owners/Game | Total Owners ÷ Game Count | Better (wider reach) |
| Reviews/1K Owners | (Reviews ÷ Owners) × 1000 | Better (engaged audience) |

---

## Sorting

### How to Sort

1. Click any column header with sort arrows
2. Click again to reverse sort direction
3. Arrow indicates current sort: ↑ (ascending) / ↓ (descending)

### Sortable Columns

Most columns support sorting:
- **Server-side:** Hours, Games, Owners, CCU, Revenue, Score, Reviews, Growth (7d), Trending
- **Client-side:** Ratio columns, Growth (30d), Review Velocity

---

## Comparing Companies

Compare 2-5 companies side-by-side.

### Selecting Companies

1. Check the checkbox next to each company you want to compare
2. Select 2-5 companies
3. A floating action bar appears at the bottom

### Opening Compare Mode

1. Click **Compare** in the action bar
2. A full-screen comparison table opens

### Understanding the Comparison

| Element | Description |
|---------|-------------|
| **Baseline** | First company selected (leftmost column) |
| **% Diff** | Percentage difference from baseline |
| **vs Avg** | How baseline compares to filtered average |
| **Best** | Green highlight on best value in row |
| **Worst** | Red highlight on worst value in row |

### Exiting Compare Mode

Click the **× Close** button or press Escape.

---

## Exporting Data

### Export Options

1. Click **Export** in the action bar (with selections) or column menu
2. Choose options:
   - **Scope:** All filtered results or selected only
   - **Columns:** Visible columns or all metrics
   - **Format:** CSV or JSON
3. Click **Download**

### CSV Format

- Includes filter summary as comments
- One row per company
- All requested metrics as columns

---

## Saving Views

Save your current filter configuration for later.

### Saving a View

1. Set up your desired filters, columns, and sort
2. Click **Saved Views** dropdown
3. Click **Save Current View**
4. Enter a name (e.g., "My Competitors")
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

## Understanding Growth Indicators

Growth cells are color-coded for quick scanning:

| Growth | Display | Color |
|--------|---------|-------|
| ≥50% | 🚀 +75% | Bright green |
| 10-49% | ↑ +25% | Green |
| -10% to 10% | → +2% | Gray |
| -49% to -10% | ↓ -30% | Orange |
| ≤-50% | 📉 -60% | Red |

---

## Understanding Sparklines

The CCU Sparkline column shows a 7-day CCU trend visualization:

- **Green line:** Upward trend
- **Red line:** Downward trend
- **Gray line:** Stable

Sparklines load as you scroll (lazy loading).

---

## Tips & Best Practices

### For Finding Market Leaders
1. Apply **Market Leaders** preset, OR
2. Set **Min Revenue** to $10M+ and sort by Revenue

### For Finding Rising Studios
1. Apply **Rising Indies** preset, OR
2. Set **Max Games** to 10 and **Min Growth (7d)** to 10%

### For Competitive Analysis
1. Search for your competitors by name
2. Select them with checkboxes
3. Click **Compare** to see side-by-side metrics

### For Export Reports
1. Apply filters to narrow down companies
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
/companies?type=publisher
          &sort=revenue_estimate_cents
          &order=desc
          &minRevenue=1000000000
          &minGrowth7d=10
          &genres=1,2,3
          &columns=hours,games,revenue
          &compare=pub:123,dev:456
```

Share the full URL with colleagues to give them the exact same view.

---

## Related Documentation

- [Companies Page Architecture](../architecture/companies-page.md) - Technical details
- [v2.5 Release Notes](../releases/v2.5-companies-page.md) - Full feature list
- [Companies Page Spec](../specs/companies-page-spec.md) - Original design specification
