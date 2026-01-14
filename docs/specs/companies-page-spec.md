# PublisherIQ Companies Page - Master Specification

> **Document Version:** 3.0  
> **Last Updated:** January 13, 2026  
> **Status:** Ready for Implementation  
> **Target:** Claude Code Implementation  
> **Changelog:** 
> - v3.0 - Restructured for Claude Code workflow with milestone recovery sections, split large milestones, added progress tracking
> - v2.0 - Added growth metrics, comparison mode, ratio columns, preset views, filter counts, relationship flags

---

## Table of Contents

1. [How to Use This Document](#how-to-use-this-document)
2. [Executive Summary](#executive-summary)
3. [Product Vision](#product-vision)
4. [Data Foundation](#data-foundation)
5. [Feature Specification](#feature-specification)
6. [UI/UX Design](#uiux-design)
7. [Technical Architecture](#technical-architecture)
8. [Reference Data](#reference-data)
9. [Milestone Prompts](#milestone-prompts)

---

## How to Use This Document

### For Claude Code Implementation

This document is the **single source of truth** for the Companies page implementation. Each milestone prompt references specific sections of this document.

**Workflow:**
1. Store this file at: `/docs/specs/companies-page-spec.md`
2. Create progress tracker at: `/docs/specs/companies-page-progress.md` (template provided)
3. For each milestone:
   - Start fresh session (or `/clear`)
   - Paste the milestone prompt
   - Claude Code reads this spec + progress tracker
   - Implement the milestone
   - Verify success criteria
   - Update progress tracker
   - Commit changes
   - `/clear` and repeat

**Key Principle:** Milestone prompts are intentionally brief. Detailed specifications live in this document. Always reference this document for:
- Complete column definitions
- Full filter specifications
- Exact SQL signatures
- UI wireframes
- Number formatting rules
- Color/threshold definitions

---

## Executive Summary

### What We're Building

A unified **`/companies`** page that replaces the separate `/publishers` and `/developers` index pages. This page will be the most powerful data exploration tool in PublisherIQ, designed for executives, BI analysts, and data-driven decision makers who need granular control over Steam publisher/developer analytics.

### Key Principles

1. **Filter First** - Powerful filters mean users find what they need without pagination
2. **Everything Customizable** - Every metric, column, visualization should be toggleable
3. **Data Dense** - Show maximum information without overwhelming
4. **Snappy Performance** - Server-side filtering, lazy-loaded visualizations
5. **Shareable** - All state in URL for bookmarking and sharing
6. **Trustworthy** - Clear methodology, data provenance, and freshness indicators
7. **Comparative** - Easy to benchmark companies against each other and market averages

### Default Experience

- Shows **Top 50 companies by Estimated Weekly Played Hours**
- Unified view of both Publishers and Developers (with role filter)
- Rich visualizations: sparklines, trend indicators, mini-charts
- Growth metrics prominently displayed alongside absolute metrics
- One-click access to detailed company pages
- Preset views for common analysis patterns

---

## Product Vision

### Target Users

| User Type | Primary Goals | Key Features They Need |
|-----------|---------------|------------------------|
| **Executive** | Market overview, competitor tracking | Top-level metrics, trends, comparisons, preset views |
| **BI Analyst** | Deep data exploration, report generation | Granular filters, CSV export, custom columns, ratio metrics |
| **BD/Partnerships** | Find potential partners | Filter by genre, platform, revenue tier, partnership readiness signals |
| **Investor** | Portfolio analysis, market trends | Growth metrics, revenue estimates, comparison mode, percentile ranks |

### User Stories

1. *"As an executive, I want to see the top 50 companies by player engagement so I can understand market leaders."*
2. *"As an executive, I want one-click preset views so I don't have to rebuild filters every time."*
3. *"As a BI analyst, I want to filter companies by genre, platform, and revenue tier so I can identify partnership opportunities."*
4. *"As a BI analyst, I want ratio columns (Revenue per Game) so I can analyze efficiency without exporting data."*
5. *"As an investor, I want to see which companies are trending up and compare their growth rates side-by-side."*
6. *"As an investor, I want to understand how metrics are calculated so I can trust the data."*
7. *"As a product manager, I want to export filtered company data to CSV for external analysis."*
8. *"As a BD manager, I want to identify self-published developers who might need a publishing partner."*
9. *"As a frequent user, I want to save my filter combinations for quick access."*

---

## Data Foundation

### Available Data Sources

Based on the PublisherIQ database schema and materialized views:

#### Core Aggregated Metrics (from `publisher_metrics` / `developer_metrics`)

| Metric | Type | Description |
|--------|------|-------------|
| `game_count` | INT | Total games published/developed |
| `total_owners` | BIGINT | Sum of estimated owners across all games |
| `total_ccu` | INT | Sum of peak CCU across all games |
| `estimated_weekly_hours` | BIGINT | Estimated weekly played hours (CCU × playtime) |
| `total_reviews` | INT | Total reviews across all games |
| `positive_reviews` | INT | Total positive reviews |
| `avg_review_score` | DECIMAL | Average review score (weighted) |
| `revenue_estimate_cents` | BIGINT | Estimated total revenue |
| `is_trending` | BOOL | Has at least one trending game |
| `games_trending_up` | INT | Count of games with positive trend |
| `unique_developers` | INT | (Publishers only) Number of dev partners |
| `first_game_release_date` | DATE | Earliest game release |

#### Growth Metrics (computed from `ccu_snapshots`)

| Metric | Type | Description |
|--------|------|-------------|
| `ccu_growth_7d_percent` | DECIMAL | % change in CCU over last 7 days |
| `ccu_growth_30d_percent` | DECIMAL | % change in CCU over last 30 days |
| `review_velocity_7d` | INT | New reviews in last 7 days |
| `review_velocity_30d` | INT | New reviews in last 30 days |

#### Relationship Flags (computed from game associations)

| Metric | Type | Description |
|--------|------|-------------|
| `is_self_published` | BOOL | All games have publisher_id = developer_id |
| `works_with_external_devs` | BOOL | Publisher has games from other developers |
| `external_dev_count` | INT | Count of unique external developers |
| `external_publisher_count` | INT | (Developers) Count of publishers they've worked with |

#### Time-Filtered Metrics (from `publisher_year_metrics` / `developer_year_metrics`)

- All above metrics filtered by `release_year`
- Enables "Show only 2024 releases" type queries

#### Per-Game Rollups (from `publisher_game_metrics` / `developer_game_metrics`)

- Enables "Last 12 months", "Last 6 months", "Last 30 days" rolling windows
- Per-game breakdown for drill-down

#### Monthly Time-Series (from `monthly_publisher_metrics`)

- `month` - Time bucket
- `estimated_monthly_hours` - Monthly played hours
- `game_count` - Games released that month
- Enables sparklines and trend charts

#### Game-Level Attributes (aggregatable from junction tables)

| Attribute | Source Table | Aggregation |
|-----------|--------------|-------------|
| Genres | `app_genres` → `steam_genres` | Count of games per genre |
| Tags | `app_steam_tags` → `steam_tags` | Count of games per tag |
| Categories | `app_categories` → `steam_categories` | Count of games with feature |
| Steam Deck | `app_steam_deck` | Count verified/playable/unsupported |
| Platforms | `apps.platforms` | Count with Linux/Mac/Windows |
| Franchises | `app_franchises` → `franchises` | Associated franchises |
| Price tiers | `daily_metrics.price_cents` | Avg price, free game count |

#### CCU Time-Series (from `ccu_snapshots`)

- Enables sparklines showing CCU trends over 7d/30d
- Company-level aggregation of game CCU

---

## Feature Specification

### 1. Company Type Toggle

```
┌─────────────────────────────────────────────────────────┐
│  [All Companies] [Publishers Only] [Developers Only]    │
└─────────────────────────────────────────────────────────┘
```

- **All Companies**: Shows both, with a "Role" column indicator
- **Publishers Only**: Filters to publisher metrics, shows publisher-specific columns
- **Developers Only**: Filters to developer metrics

**Note**: Some entities are BOTH publisher AND developer (e.g., Valve). These appear in "All" and in both filtered views.

---

### 2. Preset Views

Quick-access buttons for common analysis patterns:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Preset Views: [Market Leaders] [Rising Indies] [🚀 Breakout] [Active Pubs] │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Preset | Filters Applied | Sort |
|--------|-----------------|------|
| **Market Leaders** | `revenue >= $10M` | Revenue DESC |
| **Rising Indies** | `games <= 10`, `trending = true` | CCU Growth 7d DESC |
| **🚀 Breakout** | `ccu_growth_7d >= 50%`, `owners < 1M` | CCU Growth 7d DESC |
| **Active Publishers** | `type = publisher`, `status = active` | Weekly Hours DESC |

Clicking a preset:
1. Clears existing filters
2. Applies preset filters
3. Sets appropriate sort
4. Updates URL params

---

### 3. Primary Metrics Display (Default Columns)

| Column | Description | Format | Sortable | Methodology Tooltip |
|--------|-------------|--------|----------|---------------------|
| **Rank** | Position based on current sort | #1, #2... | No | — |
| **Company** | Name + link to detail page | Text + icon | Yes | — |
| **Role** | Publisher/Developer/Both badge | Badge | Filterable | — |
| **Est. Weekly Hours** | Estimated weekly played hours | "15.2M hrs" | Yes (default) | "CCU × avg session length × 168 hours/week" |
| **Games** | Total game count | "47" | Yes | "Count of released, non-delisted games" |
| **Total Owners** | Sum of all game owners | "125M" | Yes | "Estimated from SteamSpy data + review ratios" |
| **Peak CCU** | Sum of peak concurrent users | "1.2M" | Yes | "Highest concurrent players in last 24h, summed across all games" |
| **Reviews** | Total reviews + positive % | "5.2M (94%)" | Yes | "All-time Steam reviews" |
| **Est. Revenue** | Estimated total revenue | "$450M" | Yes | "Median price × estimated owners × regional adjustments. Confidence: ±30%" |
| **CCU Growth (7d)** | Week-over-week CCU change | "↑12.5%" | Yes | "% change comparing last 7 days to prior 7 days" |
| **Trending** | Games trending up/down | "↑12 ↓3" | Yes | "Games with >10% CCU change in either direction" |
| **CCU Trend** | 7-day sparkline | Mini chart | Yes (by growth %) | — |

**Methodology Tooltips**: Every metric column header has an ⓘ icon that shows calculation methodology on hover. This is critical for trust.

---

### 4. Column Customization

Users can show/hide any column from an expanded set:

#### Engagement Metrics
- [x] Est. Weekly Hours ✓ (default)
- [ ] Est. Monthly Hours
- [x] Total Owners ✓ (default)
- [x] Peak CCU ✓ (default)
- [ ] Avg Playtime (forever)
- [ ] Avg Playtime (2 weeks)

#### Content Metrics
- [x] Game Count ✓ (default)
- [ ] Games Released (this year)
- [ ] Games Released (last 12mo)
- [ ] Avg Games/Year
- [ ] Unique Developers (publishers)
- [ ] Unique Publishers (developers)

#### Review Metrics
- [x] Total Reviews ✓ (default)
- [ ] Positive Reviews
- [ ] Negative Reviews
- [ ] Avg Review Score
- [ ] Review Velocity (7d)

#### Financial Metrics
- [x] Est. Revenue ✓ (default)
- [ ] Avg Price
- [ ] Free Game Count
- [ ] Paid Game Count

#### Growth Metrics
- [x] CCU Growth (7d) ✓ (default)
- [ ] CCU Growth (30d)
- [x] Trending Games ✓ (default)
- [ ] Review Growth (30d)
- [ ] Owner Growth (30d)

#### Ratio Metrics (Computed)
- [ ] Revenue per Game
- [ ] Owners per Game
- [ ] Reviews per 1K Owners

#### Timeline
- [ ] First Release Date
- [ ] Latest Release Date
- [ ] Years Active

#### Relationship Metrics
- [ ] Self-Published (Yes/No)
- [ ] External Dev Partners (count)
- [ ] External Publishers (count)

---

### 5. Filtering System

#### 5.1 Quick Filters (Toggle Buttons)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [Major 10+] [Prolific 5+] [Active] [Trending] [🚀 Breakout] [$1M+] [$10M+] [100K+] │
└──────────────────────────────────────────────────────────────────────────────────┘
```

| Filter | Logic |
|--------|-------|
| Major | game_count >= 10 |
| Prolific | game_count >= 5 |
| Active | games_released_last_year > 0 |
| Trending | games_trending_up > 0 |
| 🚀 Breakout | ccu_growth_7d >= 50% AND total_owners < 1M |
| $1M+ Revenue | revenue_estimate > 1,000,000 |
| $10M+ Revenue | revenue_estimate > 10,000,000 |
| 100K+ Owners | total_owners > 100,000 |

#### 5.2 Advanced Filters (Collapsible Panel)

**Metric Range Filters** (min/max sliders or inputs):

| Filter | Range | Default |
|--------|-------|---------|
| Game Count | 1 - 500+ | Any |
| Total Owners | 0 - 1B+ | Any |
| Peak CCU | 0 - 10M+ | Any |
| Est. Weekly Hours | 0 - 100M+ | Any |
| Est. Revenue | $0 - $1B+ | Any |
| Review Score | 0% - 100% | Any |
| Total Reviews | 0 - 10M+ | Any |
| CCU Growth (7d) | -100% - 500%+ | Any |
| CCU Growth (30d) | -100% - 500%+ | Any |

**Time Period Filter**:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Time Period: [All Time] [2025] [2024] [2023] [Last 12mo] [Last 6mo] │
│              [Last 90d] [Last 30d] [Custom Range...]                │
└─────────────────────────────────────────────────────────────────────┘
```

- When filtered by time period, metrics show ONLY games released in that period

**Genre Filter** (multi-select with counts):

```
┌─────────────────────────────────────────────────────────────────────┐
│ Genres: [Action (1,247) ×] [RPG (892) ×] [+ Add Genre...]          │
│ Mode: (•) Has Any  ( ) Has All                                      │
└─────────────────────────────────────────────────────────────────────┘
```

- Shows companies with games in selected genre(s)
- **Count shown next to each option** - updates based on other active filters
- "Has Any" = games in Action OR RPG
- "Has All" = has games in BOTH Action AND RPG

**Tag Filter** (multi-select with search and counts):

```
┌─────────────────────────────────────────────────────────────────────┐
│ Tags: [Roguelike (234) ×] [Souls-like (89) ×] [🔍 Search...]       │
└─────────────────────────────────────────────────────────────────────┘
```

- Counts shown for popular tags (top 50)
- Additional tags searchable, counts load on search

**Category/Feature Filter** (checkboxes with counts):

```
┌─────────────────────────────────────────────────────────────────────┐
│ Features:                                                            │
│ □ Steam Workshop (456)    □ Steam Cloud (2,341)    □ Achievements (3,102) │
│ □ Controller Support (1,876)    □ VR Support (234)    □ Co-op (987) │
│ □ Multiplayer (1,234)    □ Cross-Platform (345)    □ Remote Play (567) │
└─────────────────────────────────────────────────────────────────────┘
```

**Steam Deck Filter**:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Steam Deck:                                                          │
│ ( ) Any    (•) Has Verified Games    ( ) Has Playable Games         │
│                                                                      │
│ Min Verified Games: [___] Min Playable Games: [___]                 │
└─────────────────────────────────────────────────────────────────────┘
```

**Platform Filter**:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Platforms:                                                          │
│ [x] Windows (4,521)    [x] Mac (1,234)    [ ] Linux (876)          │
│ Mode: ( ) Has Any    (•) Has All Selected                          │
└─────────────────────────────────────────────────────────────────────┘
```

**Partnership/Relationship Filter**:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Relationship Type:                                                   │
│ ( ) Any                                                              │
│ (•) Self-Published Only (publisher = developer on all games)        │
│ ( ) Works with External Devs (publishers with outside developers)   │
│ ( ) Has Multiple Publishers (developers with 2+ publishing partners)│
└─────────────────────────────────────────────────────────────────────┘
```

**Activity Status**:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Activity: [All] [Active (released in 12mo)]                        │
│           [Dormant (no release in 2+ years)]                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Free/Paid Mix**:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Pricing:                                                            │
│ ( ) Any                                                             │
│ ( ) Primarily Free (>50% F2P)                                       │
│ ( ) Primarily Paid (>50% paid)                                      │
│ ( ) Mixed                                                           │
└─────────────────────────────────────────────────────────────────────┘
```

#### 5.3 Text Search

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🔍 Search companies by name...                                     │
└─────────────────────────────────────────────────────────────────────┘
```

- ILIKE search on company name
- Instant filtering as you type (debounced 300ms)

#### 5.4 Saved Views

```
┌─────────────────────────────────────────────────────────────────────┐
│ 💾 Saved Views: [My Competitors ▾] [+ Save Current View]           │
└─────────────────────────────────────────────────────────────────────┘
```

- Save current filter + column + sort state with a name
- Stored in localStorage (no backend required)
- Dropdown to quickly load saved views
- Delete/rename saved views in dropdown

---

### 6. Sorting System

**Sortable by any visible column**, plus hidden sort options:

| Sort Option | Direction Options |
|-------------|-------------------|
| Est. Weekly Hours | Desc (default) / Asc |
| Game Count | Desc / Asc |
| Total Owners | Desc / Asc |
| Peak CCU | Desc / Asc |
| Review Score | Desc / Asc |
| Total Reviews | Desc / Asc |
| Est. Revenue | Desc / Asc |
| Trending Count | Desc / Asc |
| **CCU Growth % (7d)** | Desc / Asc |
| **CCU Growth % (30d)** | Desc / Asc |
| **Revenue per Game** | Desc / Asc |
| **Owners per Game** | Desc / Asc |
| First Release | Oldest First / Newest First |
| Latest Release | Newest First / Oldest First |
| Name | A-Z / Z-A |

---

### 7. Visualizations

#### 7.1 Inline Sparklines (Per Row)

**CCU Trend Sparkline** (70x24px):
- Shows 7-day or 30-day CCU trend (user toggle)
- Color coded: Green (>5% growth), Red (>5% decline), Blue (stable)
- Displays growth percentage next to sparkline
- **Uses pre-computed growth data from main query** (sparkline visual loaded lazily)

**Review Trend Sparkline** (optional column):
- Shows review velocity over time
- Helps identify momentum

#### 7.2 Company Mini-Profile (Hover/Expand)

On row hover or click-to-expand:

```
┌─────────────────────────────────────────────────────────────────────┐
│ VALVE CORPORATION                                    [View Full →]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  Top Games:                                      │
│  │   CCU Chart  │  1. Counter-Strike 2 (1.2M CCU)                  │
│  │   (30 days)  │  2. Dota 2 (680K CCU)                            │
│  │              │  3. Half-Life 2 (45K CCU)                        │
│  └──────────────┘                                                   │
│                                                                     │
│  Genre Distribution:          Platform Coverage:                    │
│  ████████░░ Action 80%        ✓ Windows  ✓ Mac  ✓ Linux            │
│  ██████░░░░ FPS 60%                                                 │
│  ████░░░░░░ Strategy 40%      Steam Deck: 12 Verified, 5 Playable  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 7.3 Summary Stats Bar (Top of Page)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Showing 47 companies matching filters                                       │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   TOTAL     │  │   TOTAL     │  │   TOTAL     │  │   AVG       │        │
│  │   GAMES     │  │   OWNERS    │  │   REVENUE   │  │   SCORE     │        │
│  │   1,247     │  │   2.4B      │  │   $15.2B    │  │   84%       │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

- Shows aggregate stats for currently filtered results
- Updates dynamically as filters change

#### 7.4 Visual Indicators

**Review Score Badge** (color-coded):
- 95%+: Bright green + "Exceptional"
- 85-94%: Green + "Very Positive"
- 70-84%: Light green + "Positive"
- 50-69%: Yellow + "Mixed"
- <50%: Red + "Negative"

**Growth Indicator** (color-coded):
- ≥50%: Bright green + "🚀" rocket
- 10-49%: Green + "↑"
- -10% to 10%: Gray + "→"
- -49% to -10%: Orange + "↓"
- ≤-50%: Red + "📉"

**Trend Indicator**:
- ↑ Green chevron with "+X" for trending up
- ↓ Red chevron with "-X" for trending down
- — Gray dash for stable

**Activity Badge**:
- 🟢 Active (release in last 12mo)
- 🟡 Slowing (release 1-2 years ago)
- 🔴 Dormant (no release in 2+ years)

**Relationship Badge** (for BD users):
- 🏠 Self-Published
- 🤝 Partners with X devs
- 📤 Works with X publishers

**Data Freshness Badge** (per-metric where relevant):
- ⚡ Live (< 1 hour old)
- 📅 Recent (< 24 hours)
- ⚠️ Stale (> 7 days) - shown in orange

---

### 8. Compare Mode

When 2-5 companies are selected, a "Compare" button appears:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Selected: 3 companies    [Compare] [Pin All] [Export] [Clear]       │
└─────────────────────────────────────────────────────────────────────┘
```

Clicking "Compare" opens a modal/drawer:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ COMPARE COMPANIES                                              [×]              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                    │ Valve          │ Riot Games     │ Blizzard       │ vs Avg │
├────────────────────┼────────────────┼────────────────┼────────────────┼────────┤
│ Est. Weekly Hours  │ 45.2M          │ 32.1M          │ 28.4M          │ +180%  │
│ Games              │ 47             │ 3              │ 12             │ +106%  │
│ Total Owners       │ 1.2B           │ 890M           │ 650M           │ +450%  │
│ Est. Revenue       │ $15B           │ $8.2B          │ $6.1B          │ +320%  │
│ Avg Review Score   │ 92%            │ 88%            │ 76%            │ +8%    │
│ CCU Growth (7d)    │ ↑ 5.2%         │ ↑ 12.3%        │ ↓ -3.1%        │ —      │
│ Revenue/Game       │ $319M          │ $2.7B          │ $508M          │ +280%  │
│ Owners/Game        │ 25.5M          │ 297M           │ 54.2M          │ +195%  │
├────────────────────┴────────────────┴────────────────┴────────────────┴────────┤
│ CCU Trend (30d)    │ [sparkline]    │ [sparkline]    │ [sparkline]    │        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- First selected company is the "baseline" for % comparisons
- "vs Avg" column shows comparison to filtered result average
- All metrics shown, not just visible columns
- Sparklines shown side-by-side
- Can export comparison as CSV
- Shareable URL: `?compare=123,456,789`

---

### 9. Actions & Export

#### 9.1 Row Actions

| Action | Description |
|--------|-------------|
| **View Details** | Navigate to `/publishers/[id]` or `/developers/[id]` |
| **Pin to Dashboard** | Add to personalized dashboard for monitoring |
| **View Games** | Quick link to their game catalog |
| **Open on Steam** | External link to Steam publisher/developer page |
| **Add to Compare** | Add to comparison selection |

#### 9.2 Bulk Actions

```
┌─────────────────────────────────────────────────────────────────────┐
│ Selected: 5 companies   [Compare] [Pin All] [Export Selected] [Clear] │
└─────────────────────────────────────────────────────────────────────┘
```

#### 9.3 Export Options

```
┌─────────────────────────────────────────────────────────────────────┐
│ Export                                                              │
│                                                                     │
│ Format: (•) CSV  ( ) Excel                                         │
│                                                                     │
│ Scope:                                                              │
│ (•) Filtered results (47 companies)                                │
│ ( ) Selected only (5 companies)                                    │
│                                                                     │
│ Include:                                                            │
│ [x] Visible columns only                                           │
│ [ ] All available metrics                                          │
│ [ ] Include per-game breakdown                                     │
│                                                                     │
│ [Download]                                                          │
└─────────────────────────────────────────────────────────────────────┘
```

**Per-Game Breakdown Export Format:**

When "Include per-game breakdown" is selected, CSV includes:

```csv
company_id,company_name,company_role,game_id,game_name,game_owners,game_ccu,game_revenue,game_review_score
123,Valve,Both,730,Counter-Strike 2,85000000,1200000,450000000,94
123,Valve,Both,570,Dota 2,120000000,680000,320000000,88
...
```

---

### 10. URL State Management

All filter state persisted to URL for bookmarking/sharing:

```
/companies?
  type=publisher                    # Company type filter
  &sort=estimated_weekly_hours      # Sort column
  &order=desc                       # Sort direction
  &search=Valve                     # Text search
  &minGames=5                       # Metric filters
  &maxGames=100
  &minOwners=100000
  &minRevenue=1000000
  &minScore=80
  &minGrowth7d=10                   # Growth filters
  &genres=1,25                      # Genre IDs (Action, Adventure)
  &tags=19,597                      # Tag IDs
  &features=22,23                   # Category IDs (Achievements, Cloud)
  &steamDeck=verified               # Steam Deck filter
  &platforms=windows,linux          # Platform filter
  &period=2024                      # Time period
  &status=active                    # Activity status
  &relationship=self_published      # Relationship filter
  &columns=hours,games,owners,ccu,growth7d  # Visible columns
  &limit=50                         # Result limit
  &compare=123,456                  # Companies in compare mode
  &preset=rising_indies             # Active preset (if any)
```

---

### 11. Result Limits & Performance

| Scenario | Limit | Behavior |
|----------|-------|----------|
| Default view | 50 | Top 50 by sort |
| Filtered view | 50-100 | Based on filter specificity |
| Extended view | 500 | User can increase, with performance warning |
| Export | Unlimited | Server-side generation |

**Performance Strategy**:
- Server-side filtering via database RPC
- **Growth metrics computed in main query** (not lazy-loaded)
- Lazy-load sparkline visuals as rows enter viewport
- **Filter counts cached** with 5-minute TTL, loaded on dropdown open
- Debounce filter changes (300ms)
- Cache aggregations with 5-minute TTL
- Virtualized table for smooth scrolling at 500 rows

---

## UI/UX Design

### Page Layout (Top to Bottom)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HEADER: Companies | {result count}           [Export] [⚙ Settings] [? Help] │
├─────────────────────────────────────────────────────────────────────────────┤
│ SUMMARY STATS BAR                                                           │
│ Total Games: X | Total Owners: X | Total Revenue: X | Avg Score: X%        │
├─────────────────────────────────────────────────────────────────────────────┤
│ PRESET VIEWS: [Market Leaders] [Rising Indies] [🚀 Breakout] [Active Pubs] │
├─────────────────────────────────────────────────────────────────────────────┤
│ TYPE TOGGLE: [All] [Publishers] [Developers]                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ SEARCH: 🔍 Search companies...     SAVED VIEWS: [My Views ▾] [+ Save]      │
├─────────────────────────────────────────────────────────────────────────────┤
│ QUICK FILTERS: [Major] [Active] [Trending] [🚀 Breakout] [$1M+] [100K+]    │
├─────────────────────────────────────────────────────────────────────────────┤
│ ADVANCED FILTERS (collapsible)                                    [3 active]│
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Metrics | Growth | Time | Genres | Tags | Features | Platform | More   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ COLUMN TOGGLE: [Columns ▾] showing 10 of 28                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ RESULTS TABLE                                                               │
│ ┌───┬─────────────┬──────┬───────────┬───────┬─────────┬─────────┬───────┐ │
│ │ ☐ │ Company     │ Role │ Weekly Hr │ Games │ Growth  │ Revenue │ Trend │ │
│ │   │             │      │     ⓘ     │   ⓘ   │  (7d) ⓘ │    ⓘ    │       │ │
│ ├───┼─────────────┼──────┼───────────┼───────┼─────────┼─────────┼───────┤ │
│ │ ☐ │ Valve       │ Both │ 45.2M     │ 47    │ ↑ 5.2%  │ $15B    │ ▃▅▇█  │ │
│ │ ☐ │ Riot Games  │ Pub  │ 32.1M     │ 3     │ ↑ 12.3% │ $8.2B   │ ▅▆▇▇  │ │
│ │...│ ...         │ ...  │ ...       │ ...   │ ...     │ ...     │ ...   │ │
│ └───┴─────────────┴──────┴───────────┴───────┴─────────┴─────────┴───────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ BULK ACTIONS (when selected): Selected: 3 [Compare] [Pin] [Export] [Clear] │
├─────────────────────────────────────────────────────────────────────────────┤
│ FOOTER: Showing 50 of 1,247 | Limit: [50 ▾] | Load more...                 │
│ Data freshness: CCU ⚡ 1h ago | Revenue 📅 24h ago                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Design System Integration

Use existing PublisherIQ design system:
- Color tokens from `globals.css`
- Components: Card, CollapsibleSection, MetricCard, StatusBar
- Sparklines: TrendSparkline from insights page
- Badges: ReviewScoreBadge, TierBadge, TrendingBadge
- Typography: Geist font, text-body, text-caption scales

### Empty State

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│         🔍 No companies match your filters                          │
│                                                                     │
│     Try adjusting your search or filter criteria                    │
│                                                                     │
│     Suggestions:                                                    │
│     • Remove the "🚀 Breakout" filter (very restrictive)           │
│     • Expand the revenue range                                      │
│     • Try a different time period                                   │
│                                                                     │
│              [Clear All Filters]                                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### Database RPC Functions

#### 1. `get_companies_with_filters`

Unified function that supports both publishers and developers with full filter set:

```sql
CREATE OR REPLACE FUNCTION get_companies_with_filters(
  p_type TEXT DEFAULT 'all',              -- 'all', 'publisher', 'developer'
  p_search TEXT DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'estimated_weekly_hours',
  p_sort_order TEXT DEFAULT 'desc',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  -- Metric filters
  p_min_games INT DEFAULT NULL,
  p_max_games INT DEFAULT NULL,
  p_min_owners BIGINT DEFAULT NULL,
  p_min_ccu INT DEFAULT NULL,
  p_min_hours BIGINT DEFAULT NULL,
  p_min_revenue BIGINT DEFAULT NULL,
  p_min_score INT DEFAULT NULL,
  p_min_reviews INT DEFAULT NULL,
  -- Growth filters
  p_min_growth_7d DECIMAL DEFAULT NULL,
  p_max_growth_7d DECIMAL DEFAULT NULL,
  p_min_growth_30d DECIMAL DEFAULT NULL,
  p_max_growth_30d DECIMAL DEFAULT NULL,
  -- Time period
  p_period TEXT DEFAULT 'all',            -- 'all', '2024', 'last_12mo', etc.
  -- Content filters
  p_genres INT[] DEFAULT NULL,
  p_genre_mode TEXT DEFAULT 'any',        -- 'any' or 'all'
  p_tags INT[] DEFAULT NULL,
  p_categories INT[] DEFAULT NULL,
  p_steam_deck TEXT DEFAULT NULL,         -- 'verified', 'playable', 'any'
  p_platforms TEXT[] DEFAULT NULL,
  p_platform_mode TEXT DEFAULT 'any',     -- 'any' or 'all'
  p_status TEXT DEFAULT NULL,             -- 'active', 'dormant'
  -- Relationship filters
  p_relationship TEXT DEFAULT NULL        -- 'self_published', 'external_devs', 'multi_publisher'
)
RETURNS TABLE (
  id INT,
  name TEXT,
  type TEXT,                              -- 'publisher', 'developer', 'both'
  game_count INT,
  total_owners BIGINT,
  total_ccu INT,
  estimated_weekly_hours BIGINT,
  estimated_monthly_hours BIGINT,
  total_reviews INT,
  positive_reviews INT,
  avg_review_score DECIMAL,
  revenue_estimate_cents BIGINT,
  avg_price_cents INT,
  free_game_count INT,
  games_trending_up INT,
  games_trending_down INT,
  -- Growth metrics (computed, not lazy-loaded)
  ccu_growth_7d_percent DECIMAL,
  ccu_growth_30d_percent DECIMAL,
  review_velocity_7d INT,
  review_velocity_30d INT,
  -- Relationship flags
  is_self_published BOOLEAN,
  works_with_external_devs BOOLEAN,
  external_dev_count INT,
  external_publisher_count INT,
  -- Timeline
  first_release_date DATE,
  latest_release_date DATE,
  years_active INT,
  -- Metadata
  steam_vanity_url TEXT,
  data_updated_at TIMESTAMPTZ
);
```

**Growth Calculation Logic:**
- Compare average CCU of last 7 days to average CCU of prior 7 days
- Formula: `((current_period_avg - prior_period_avg) / prior_period_avg) * 100`
- Handle divide-by-zero (return NULL if prior period is 0)

**Relationship Flag Logic:**
- `is_self_published`: TRUE if ALL games have matching publisher_id and developer_id
- `works_with_external_devs`: TRUE if publisher has games where developer_id != publisher_id
- `external_dev_count`: `COUNT(DISTINCT developer_id) WHERE developer_id != company_id`

**Column Mapping from Existing RPCs:**

The existing `get_publishers_with_metrics` and `get_developers_with_metrics` RPCs use different column names. Map as follows:

| Existing Column | New Unified Column | Conversion |
|-----------------|-------------------|------------|
| `total_owners_min`, `total_owners_max` | `total_owners` | `(min + max) / 2` (midpoint) |
| `estimated_revenue_usd` | `revenue_estimate_cents` | `usd * 100` |
| `weighted_review_score` | `avg_review_score` | Already 0-100 range |
| `total_ccu_peak` | `total_ccu` | Sum across games |
| `max_ccu_peak` | — | Use for sparkline peak annotation |

#### 2. `get_companies_aggregate_stats`

```sql
CREATE OR REPLACE FUNCTION get_companies_aggregate_stats(
  -- Same filters as get_companies_with_filters
)
RETURNS TABLE (
  total_companies INT,
  total_games INT,
  total_owners BIGINT,
  total_revenue BIGINT,
  avg_review_score DECIMAL,
  avg_growth_7d DECIMAL                   -- For "vs Avg" in compare mode
);
```

#### 3. `get_company_sparkline_data`

```sql
CREATE OR REPLACE FUNCTION get_company_sparkline_data(
  p_company_id INT,
  p_company_type TEXT,                    -- 'publisher' or 'developer'
  p_days INT DEFAULT 7
)
RETURNS TABLE (
  day DATE,
  total_ccu INT,
  peak_ccu INT
);
```

#### 4. `get_filter_option_counts`

```sql
CREATE OR REPLACE FUNCTION get_filter_option_counts(
  p_filter_type TEXT,                     -- 'genre', 'tag', 'category', 'platform'
  p_company_type TEXT DEFAULT 'all',
  -- Pass current filters to show contextual counts
  p_current_genres INT[] DEFAULT NULL,
  p_current_tags INT[] DEFAULT NULL,
  p_min_revenue BIGINT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
  -- ... other active filters
)
RETURNS TABLE (
  option_id INT,
  option_name TEXT,
  company_count INT
);
```

### File Structure

```
apps/admin/src/app/(main)/companies/
├── page.tsx                          # Server component, data fetching
├── error.tsx                         # Error boundary
├── loading.tsx                       # Loading skeleton
├── components/
│   ├── CompaniesPageClient.tsx       # Main client component
│   ├── CompanyTypeToggle.tsx         # Publisher/Developer/All toggle
│   ├── PresetViews.tsx               # Preset view buttons
│   ├── QuickFilters.tsx              # Quick filter button bar
│   ├── AdvancedFilters.tsx           # Collapsible advanced filter panel
│   │   ├── MetricFilters.tsx
│   │   ├── GrowthFilters.tsx
│   │   ├── TimePeriodFilter.tsx
│   │   ├── GenreTagFilter.tsx
│   │   ├── FeatureFilter.tsx
│   │   ├── PlatformFilter.tsx
│   │   ├── SteamDeckFilter.tsx
│   │   └── RelationshipFilter.tsx
│   ├── SavedViews.tsx
│   ├── ColumnSelector.tsx
│   ├── CompaniesTable.tsx
│   │   ├── CompanyRow.tsx
│   │   ├── CompanyRowExpanded.tsx
│   │   ├── SparklineCell.tsx
│   │   ├── GrowthCell.tsx
│   │   └── MethodologyTooltip.tsx
│   ├── SummaryStatsBar.tsx
│   ├── CompareMode.tsx
│   ├── ExportDialog.tsx
│   ├── BulkActionsBar.tsx
│   └── EmptyState.tsx
├── lib/
│   ├── companies-queries.ts
│   ├── companies-types.ts
│   ├── companies-filters.ts
│   ├── companies-columns.ts
│   ├── companies-presets.ts
│   ├── companies-ratios.ts
│   ├── companies-export.ts
│   └── companies-methodology.ts
└── hooks/
    ├── useCompaniesFilters.ts
    ├── useCompaniesSort.ts
    ├── useCompaniesSelection.ts
    ├── useCompaniesCompare.ts
    ├── useSavedViews.ts
    └── useFilterCounts.ts
```

---

## Reference Data

### Genre IDs (Most Common)

| ID | Name |
|----|------|
| 1 | Action |
| 2 | Strategy |
| 3 | RPG |
| 4 | Casual |
| 23 | Indie |
| 25 | Adventure |
| 28 | Simulation |
| 37 | Free to Play |

### Category IDs (Most Common)

| ID | Name |
|----|------|
| 1 | Multi-player |
| 2 | Single-player |
| 22 | Steam Achievements |
| 23 | Steam Cloud |
| 28 | Full Controller Support |
| 29 | Steam Trading Cards |
| 30 | Steam Workshop |

### Number Formatting

| Value | Format |
|-------|--------|
| 1,234 | "1.2K" |
| 1,234,567 | "1.2M" |
| 1,234,567,890 | "1.2B" |
| $1234567 | "$1.2M" |
| 94.5% | "95%" |
| +12.34% | "↑ 12.3%" |
| -5.67% | "↓ 5.7%" |

### Data Format Notes

When mapping data from existing views/RPCs to the unified format:

| Field | Existing Format | Expected Format | Conversion |
|-------|-----------------|-----------------|------------|
| Revenue | USD (float) | Cents (integer) | `Math.round(usd * 100)` |
| Owners | Min/Max range | Single estimate | `Math.round((min + max) / 2)` |
| Review Score | 0-100 decimal | 0-100 integer | `Math.round(score)` |
| Weekly Hours | Integer | Integer | None needed |

### Growth Thresholds

| Range | Display | Color |
|-------|---------|-------|
| ≥50% | 🚀 +X% | Bright Green |
| 10-49% | ↑ +X% | Green |
| -10% to 10% | → X% | Gray |
| -49% to -10% | ↓ X% | Orange |
| ≤-50% | 📉 X% | Red |

### Preset Definitions

| Preset | Filters | Sort |
|--------|---------|------|
| Market Leaders | revenue ≥ $10M | Revenue DESC |
| Rising Indies | games ≤ 10, trending | Growth 7d DESC |
| 🚀 Breakout | growth_7d ≥ 50%, owners < 1M | Growth 7d DESC |
| Active Publishers | type=publisher, status=active | Weekly Hours DESC |

### Methodology Tooltip Content

```typescript
export const methodologyContent = {
  estimated_weekly_hours: "CCU × avg session length × 168 hours/week. Based on Steam API data.",
  game_count: "Count of released, non-delisted games on Steam.",
  total_owners: "Estimated from SteamSpy data combined with review-to-owner ratios. Confidence: ±20%.",
  total_ccu: "Highest concurrent players in last 24h, summed across all games.",
  revenue_estimate: "Median price × estimated owners × regional adjustments. Confidence: ±30%. Does not include DLC or MTX.",
  ccu_growth_7d: "% change comparing average CCU of last 7 days to prior 7 days.",
  ccu_growth_30d: "% change comparing average CCU of last 30 days to prior 30 days.",
  avg_review_score: "Positive reviews ÷ total reviews, weighted by recency.",
  review_velocity_7d: "Number of new reviews received in the last 7 days.",
  revenue_per_game: "Total estimated revenue ÷ game count.",
  owners_per_game: "Total owners ÷ game count.",
  reviews_per_1k_owners: "Review rate per 1,000 owners. Higher = more engaged audience.",
};
```

### Ratio Column Definitions

```typescript
export const ratioColumns = {
  revenue_per_game: {
    label: "Revenue/Game",
    compute: (row) => row.revenue_estimate_cents / row.game_count,
    format: formatRevenue,
    methodology: "Total estimated revenue ÷ game count"
  },
  owners_per_game: {
    label: "Owners/Game", 
    compute: (row) => row.total_owners / row.game_count,
    format: formatCompactNumber,
    methodology: "Total owners ÷ game count"
  },
  reviews_per_1k_owners: {
    label: "Reviews/1K Owners",
    compute: (row) => (row.total_reviews / row.total_owners) * 1000,
    format: (n) => n.toFixed(1),
    methodology: "Review rate per 1,000 owners. Higher = more engaged audience."
  }
};
```

### Component Import Paths

For implementation convenience, use these import paths:

```typescript
// Layout
import { PageHeader, PageSubHeader } from '@/components/layout/PageHeader';
import { Section, Grid } from '@/components/layout/Section';

// Data Display
import { MetricCard, DenseMetricGrid } from '@/components/data-display';
import { Sparkline, TrendSparkline } from '@/components/data-display/Sparkline';
import { TrendIndicator } from '@/components/data-display/TrendIndicator';
import { DataTable, type Column } from '@/components/data-display/DataTable';

// Badges
import { ReviewScoreBadge, TierBadge } from '@/components/data-display';

// UI
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';

// Filters & Actions
import { AdvancedFilters } from '@/components/filters/AdvancedFilters';
import { PinButton } from '@/components/PinButton';

// Utils
import { getSupabase } from '@/lib/supabase';
import { getCCUSparklinesBatch } from '@/lib/ccu-queries';
```

---

## Milestone Prompts

The following prompts are designed for Claude Code. Each milestone is self-contained and can be `/clear`ed between runs.

**Important:** Each prompt references this master document. Store it at `/docs/specs/companies-page-spec.md` before starting.

---

### MILESTONE 0: Setup & Verification

```markdown
# Milestone 0: Setup & Verification

## Reference Documentation
Read the master specification at: `/docs/specs/companies-page-spec.md`
Focus on: "Data Foundation" section

## Goal
Verify existing resources and set up progress tracking before implementation begins.

## Tasks
1. Read the master spec and confirm understanding of the overall scope
2. Verify these existing resources exist and document their current state:
   - [ ] `publisher_metrics` materialized view - list columns
   - [ ] `developer_metrics` materialized view - list columns  
   - [ ] `ccu_snapshots` table - verify structure
   - [ ] `publisher_year_metrics` view - verify existence
   - [ ] `developer_year_metrics` view - verify existence
   - [ ] Existing design system components at `/components/ui/`
   - [ ] Existing utilities: `formatCompactNumber`, `formatRevenue`
3. Create progress tracker at `/docs/specs/companies-page-progress.md` using the template
4. Document any gaps or differences from what the spec assumes

## Success Criteria
- [ ] All data sources verified
- [ ] Progress tracker file created
- [ ] Any blockers identified and documented

## Do NOT
- Write any implementation code yet
- Modify any existing files
- Create any new components
```

---

### MILESTONE 1: Database Foundation

```markdown
# Milestone 1: Database Foundation

## Reference Documentation
- Master spec: `/docs/specs/companies-page-spec.md`
  - Read: "Data Foundation", "Technical Architecture > Database RPC Functions"
- Progress tracker: `/docs/specs/companies-page-progress.md`

## Goal
Create all necessary database RPC functions with growth metrics, relationship flags, and filter counts.

## Tasks
1. Create migration file: `supabase/migrations/YYYYMMDD_companies_page_rpcs.sql`
2. Implement `get_companies_with_filters` function per spec
3. Implement `get_companies_aggregate_stats` function per spec
4. Implement `get_company_sparkline_data` function per spec
5. Implement `get_filter_option_counts` function per spec
6. Test all functions work correctly

## Key Implementation Details
- Growth calculation: `((current_7d_avg - prior_7d_avg) / prior_7d_avg) * 100`
- Handle divide-by-zero in growth calc (return NULL)
- `is_self_published`: TRUE only if ALL games have publisher_id = developer_id
- See spec for full SQL signatures and return types

## Success Criteria
- [ ] All 4 RPC functions created and working
- [ ] Functions handle NULL filters gracefully
- [ ] Growth metrics computed correctly (test with known data)
- [ ] Relationship flags computed correctly
- [ ] Performance is acceptable (<500ms for typical queries)
- [ ] Migration file properly formatted

## Verify Before Proceeding
```sql
-- Test basic query
SELECT * FROM get_companies_with_filters() LIMIT 5;

-- Test growth filter
SELECT * FROM get_companies_with_filters(p_min_growth_7d := 10) LIMIT 5;

-- Test relationship filter
SELECT * FROM get_companies_with_filters(p_relationship := 'self_published') LIMIT 5;
```

## Do NOT
- Modify existing materialized views
- Create new tables (only functions)
- Build any UI yet

## After Completion
Update `/docs/specs/companies-page-progress.md`:
- Mark M1 complete
- List migration file created
- Note any deviations from spec
```

---

### MILESTONE 2: Page Structure & Basic Table

```markdown
# Milestone 2: Page Structure & Basic Table

## Reference Documentation
- Master spec: `/docs/specs/companies-page-spec.md`
  - Read: "Feature Specification §3" (Primary Metrics Display), "UI/UX Design", "Reference Data > Methodology Tooltip Content"
- Progress tracker: `/docs/specs/companies-page-progress.md`
- M1 output: `supabase/migrations/YYYYMMDD_companies_page_rpcs.sql`

## Context Recovery (if resuming after /clear)
1. Read master spec sections listed above
2. Check progress tracker for M1 completion status
3. Verify database functions exist: `SELECT * FROM get_companies_with_filters() LIMIT 1;`

## Goal
Create the basic /companies page with table, type toggle, growth column, and methodology tooltips.

## Tasks
1. Create page files at `apps/admin/src/app/(main)/companies/`:
   - `page.tsx` - Server component with data fetching
   - `error.tsx` - Error boundary
   - `loading.tsx` - Loading skeleton
   - `components/CompaniesPageClient.tsx` - Main client component
   - `lib/companies-types.ts` - TypeScript types
   - `lib/companies-queries.ts` - Data fetching functions
   - `lib/companies-methodology.ts` - Tooltip content (copy from spec)
2. Implement company type toggle: [All] [Publishers] [Developers]
3. Build table with default columns per spec §3
4. Add `MethodologyTooltip.tsx` component with ⓘ icons on column headers
5. Implement `GrowthCell.tsx` with color-coded indicators (see spec thresholds)
6. Wire up sorting including growth column
7. Persist type and sort to URL params

## Key Implementation Details
- Growth thresholds: ≥50% = 🚀 bright green, 10-49% = ↑ green, etc. (see spec Reference Data)
- Reuse existing components: PageHeader, Card, ReviewScoreBadge, formatCompactNumber
- Growth data already in RPC response (no lazy loading needed for the number)
- Default sort: estimated_weekly_hours DESC
- Default limit: 50

## Success Criteria
- [ ] /companies loads with top 50 by weekly hours
- [ ] Type toggle filters correctly (All/Publishers/Developers)
- [ ] All columns sortable including growth
- [ ] Methodology tooltips appear on hover for each metric column
- [ ] Growth column shows correct colors per threshold
- [ ] URL reflects current state (?type=publisher&sort=...)

## Verify Before Proceeding
1. `npm run build` - completes without errors
2. Visit `/companies` - loads top 50 companies
3. Click column headers - sorting works
4. Toggle type filter - data updates
5. Hover ⓘ icons - tooltips appear
6. Check URL - params persist on refresh

## Do NOT
- Implement search or filters yet (M3)
- Implement presets yet (M3)
- Implement sparklines yet (M5)
- Implement export/compare yet (M6)

## After Completion
Update `/docs/specs/companies-page-progress.md`
```

---

### MILESTONE 3: Search, Quick Filters & Presets

```markdown
# Milestone 3: Search, Quick Filters & Presets

## Reference Documentation
- Master spec: `/docs/specs/companies-page-spec.md`
  - Read: "Feature Specification §2" (Preset Views), "Feature Specification §5.1" (Quick Filters), "Feature Specification §5.3" (Text Search)
- Progress tracker: `/docs/specs/companies-page-progress.md`
- M2 output: `apps/admin/src/app/(main)/companies/`

## Context Recovery (if resuming after /clear)
1. Read master spec sections listed above
2. Check progress tracker for M2 completion status
3. Visit `/companies` and verify basic table works

## Goal
Add search bar, quick filter buttons, and preset views with breakout filter.

## Tasks
1. Create `lib/companies-presets.ts` with preset definitions (copy from spec)
2. Create `components/PresetViews.tsx` - row of preset buttons above type toggle
3. Create `components/SearchBar.tsx` - debounced search input
4. Create `components/QuickFilters.tsx` - toggle buttons per spec
5. Create `hooks/useCompaniesFilters.ts` - filter state management
6. Update data fetching to pass all filter params to RPC

## Key Implementation Details
- Presets: Market Leaders, Rising Indies, 🚀 Breakout, Active Publishers (see spec for exact filters)
- Clicking preset CLEARS other filters then applies preset filters
- Quick filters ADD to existing filters (AND logic)
- 🚀 Breakout appears as both preset AND quick filter
- Search debounce: 300ms
- URL params for all filter state

## Success Criteria
- [ ] Search filters results as you type
- [ ] Quick filters toggle on/off correctly
- [ ] Preset views work and clear other filters
- [ ] Breakout filter works (uses growth data)
- [ ] Multiple quick filters combine correctly (AND)
- [ ] URL updates with all filter state
- [ ] Active preset is visually highlighted

## Verify Before Proceeding
1. Type in search - results filter after 300ms
2. Toggle Major + Trending - both applied
3. Click "Rising Indies" preset - other filters clear
4. Click 🚀 Breakout quick filter - adds to existing filters
5. Refresh page - filters persist from URL

## Do NOT
- Implement advanced filters panel yet (M4)
- Implement column customization yet (M5)
- Implement saved views yet (M4)

## After Completion
Update `/docs/specs/companies-page-progress.md`
```

---

### MILESTONE 4a: Advanced Filters - Core

```markdown
# Milestone 4a: Advanced Filters - Core

## Reference Documentation
- Master spec: `/docs/specs/companies-page-spec.md`
  - Read: "Feature Specification §5.2" (Advanced Filters) - Metric Range, Growth, Time Period sections only
- Progress tracker: `/docs/specs/companies-page-progress.md`
- M3 output: Search, quick filters, presets working

## Context Recovery (if resuming after /clear)
1. Read master spec section listed above
2. Check progress tracker for M3 completion status
3. Visit `/companies`, verify search/presets work

## Goal
Build the collapsible advanced filters panel with metric range, growth, and time period filters.

## Tasks
1. Create `components/AdvancedFilters.tsx` - collapsible container with tabs/sections
2. Create `components/filters/MetricFilters.tsx` - min/max inputs for:
   - Game Count, Total Owners, Peak CCU, Est. Weekly Hours
   - Est. Revenue, Review Score, Total Reviews
3. Create `components/filters/GrowthFilters.tsx` - min/max for:
   - CCU Growth 7d (-100% to 500%+)
   - CCU Growth 30d (-100% to 500%+)
   - Quick presets: "Growing (>10%)", "Declining (<-10%)", "Stable"
4. Create `components/filters/TimePeriodFilter.tsx` - toggle buttons for:
   - All Time, 2025, 2024, 2023, Last 12mo, Last 6mo, Last 90d, Last 30d
5. Show active filter count badge on collapsed panel
6. Add "Clear all" button

## Key Implementation Details
- Use sliders or dual-input fields for ranges
- Debounce filter changes (300ms)
- Time period changes which metrics view to use (year vs all-time)
- All filters persist to URL params

## Success Criteria
- [ ] Advanced filters panel expands/collapses
- [ ] Metric range filters work correctly
- [ ] Growth filters work correctly
- [ ] Time period filter switches data source
- [ ] Active filter count badge accurate
- [ ] Clear all resets everything
- [ ] URL params persist all state

## Verify Before Proceeding
1. Set min revenue to $1M - results filter
2. Set growth 7d min to 20% - results filter
3. Select "2024" time period - metrics reflect 2024 releases only
4. Check badge shows correct active count
5. Click "Clear all" - all filters reset

## Do NOT
- Implement genre/tag/feature filters yet (M4b)
- Implement relationship filters yet (M4b)
- Implement saved views yet (M4b)

## After Completion
Update `/docs/specs/companies-page-progress.md`
```

---

### MILESTONE 4b: Advanced Filters - Content & Relationship

```markdown
# Milestone 4b: Advanced Filters - Content & Relationship

## Reference Documentation
- Master spec: `/docs/specs/companies-page-spec.md`
  - Read: "Feature Specification §5.2" - Genre, Tag, Feature, Platform, Steam Deck, Relationship, Activity, Pricing sections
  - Read: "Feature Specification §5.4" (Saved Views)
- Progress tracker: `/docs/specs/companies-page-progress.md`
- M4a output: Metric/Growth/Time filters working

## Context Recovery (if resuming after /clear)
1. Read master spec sections listed above
2. Check progress tracker for M4a completion status
3. Visit `/companies`, verify metric/growth filters work

## Goal
Complete advanced filters with genre/tag/feature filters (with counts), relationship filters, and saved views.

## Tasks
1. Create `hooks/useFilterCounts.ts` - lazy-load counts via `get_filter_option_counts` RPC
2. Create `components/filters/GenreTagFilter.tsx`:
   - Multi-select dropdown with search
   - Show count next to each option: "Action (1,247)"
   - Mode toggle: Has Any / Has All
   - Cache counts for 5 minutes
3. Create `components/filters/FeatureFilter.tsx`:
   - Checkbox grid with counts for common features
4. Create `components/filters/PlatformFilter.tsx`:
   - Checkboxes with counts: Windows / Mac / Linux
   - Mode: Has Any / Has All
5. Create `components/filters/SteamDeckFilter.tsx`:
   - Radio: Any / Has Verified / Has Playable
6. Create `components/filters/RelationshipFilter.tsx`:
   - Radio: Any / Self-Published Only / Works with External Devs / Multiple Publishers
7. Create `components/filters/ActivityFilter.tsx`:
   - Radio: All / Active / Dormant
8. Create `components/SavedViews.tsx` and `hooks/useSavedViews.ts`:
   - Save current filters + columns + sort to localStorage
   - Dropdown to load saved views
   - Delete/rename saved views

## Key Implementation Details
- Filter counts should reflect OTHER active filters (contextual)
- Lazy-load counts when dropdown opens (not on page load)
- Cache counts for 5 minutes
- Relationship filters use flags from M1 RPC
- Saved views stored in localStorage with schema: `{ name, filters, columns, sort }`

## Success Criteria
- [ ] Genre filter shows counts, updates contextually
- [ ] Tag filter works with search
- [ ] Feature checkboxes work with counts
- [ ] Platform filter works with mode toggle
- [ ] Steam Deck filter works
- [ ] Relationship filters work (self-published returns only self-published)
- [ ] Activity filter works
- [ ] Saved views: save, load, delete all work
- [ ] Filter counts cached (don't refetch every dropdown open)

## Verify Before Proceeding
1. Open genre dropdown - counts load
2. Apply revenue filter, reopen genre - counts updated
3. Select "Self-Published Only" - only self-published companies shown
4. Save current view, clear filters, load view - filters restored
5. Check localStorage - saved view persisted

## Do NOT
- Implement sparklines yet (M5)
- Implement column customization yet (M5)
- Implement compare mode yet (M6)

## After Completion
Update `/docs/specs/companies-page-progress.md`
```

---

### MILESTONE 5: Column Customization & Visualizations

```markdown
# Milestone 5: Column Customization & Visualizations

## Reference Documentation
- Master spec: `/docs/specs/companies-page-spec.md`
  - Read: "Feature Specification §4" (Column Customization)
  - Read: "Feature Specification §7" (Visualizations)
  - Read: "Reference Data > Ratio Column Definitions"
- Progress tracker: `/docs/specs/companies-page-progress.md`
- M4b output: All filters working

## Context Recovery (if resuming after /clear)
1. Read master spec sections listed above
2. Check progress tracker for M4b completion status
3. Visit `/companies`, verify all filters work including saved views

## Goal
Add column selector, ratio columns, sparklines, summary stats bar, and visual indicators.

## Tasks
1. Create `lib/companies-columns.ts` - define all available columns with metadata
2. Create `lib/companies-ratios.ts` - ratio column computations (copy from spec)
3. Create `components/ColumnSelector.tsx`:
   - Dropdown with checkbox list grouped by category
   - Shows "X of Y visible"
   - Persist to URL: ?columns=hours,games,owners,growth7d
4. Implement ratio columns (Revenue/Game, Owners/Game, Reviews/1K Owners):
   - Computed on frontend from existing data
   - Sortable (client-side sort when active)
5. Create `components/SparklineCell.tsx`:
   - Use existing TrendSparkline component
   - Lazy-load sparkline data via IntersectionObserver
   - Color based on growth % (already in row data)
6. Create `components/SummaryStatsBar.tsx`:
   - Display: Total Companies, Total Games, Total Owners, Total Revenue, Avg Score, Avg Growth
   - Use `get_companies_aggregate_stats` RPC
   - Updates as filters change
7. Implement data freshness indicator in footer

## Key Implementation Details
- Ratio columns computed client-side (no new queries)
- Client-side sort when ratio columns are sort key
- Sparkline data fetched lazily as rows scroll into view
- Summary stats call happens in parallel with main query
- Data freshness uses `data_updated_at` from RPC response

## Success Criteria
- [ ] Column selector shows/hides columns correctly
- [ ] Selected columns persist in URL
- [ ] Ratio columns compute and display correctly
- [ ] Ratio columns are sortable (client-side)
- [ ] Sparklines load lazily (check network tab)
- [ ] Summary stats update with filter changes
- [ ] Data freshness indicator shows in footer
- [ ] Performance remains good (<2s page load)

## Verify Before Proceeding
1. Toggle columns in selector - table updates
2. Add "Revenue/Game" column - values computed correctly
3. Sort by "Revenue/Game" - sorting works
4. Scroll down - sparklines load as rows appear
5. Apply filter - summary stats update
6. Check footer - freshness indicator shows

## Do NOT
- Implement row selection yet (M6)
- Implement compare mode yet (M6)
- Implement export yet (M6)

## After Completion
Update `/docs/specs/companies-page-progress.md`
```

---

### MILESTONE 6a: Selection & Compare Mode

```markdown
# Milestone 6a: Selection & Compare Mode

## Reference Documentation
- Master spec: `/docs/specs/companies-page-spec.md`
  - Read: "Feature Specification §8" (Compare Mode)
  - Read: "Feature Specification §9.2" (Bulk Actions)
- Progress tracker: `/docs/specs/companies-page-progress.md`
- M5 output: Column customization, sparklines, summary stats working

## Context Recovery (if resuming after /clear)
1. Read master spec sections listed above
2. Check progress tracker for M5 completion status
3. Visit `/companies`, verify columns and sparklines work

## Goal
Add row selection checkboxes, bulk actions bar, and compare mode.

## Tasks
1. Create `hooks/useCompaniesSelection.ts`:
   - Checkbox state for each row
   - "Select all visible" in header
   - Selection count tracking
2. Create `components/BulkActionsBar.tsx`:
   - Shows when 1+ rows selected
   - Displays: "Selected: X companies"
   - Buttons: [Compare] [Pin All] [Export Selected] [Clear]
   - Compare enabled only when 2-5 selected
3. Create `hooks/useCompaniesCompare.ts`:
   - Manages compare mode state
   - URL param: ?compare=123,456,789
4. Create `components/CompareMode.tsx`:
   - Modal or slide-out drawer
   - Companies as columns, metrics as rows
   - First selected = baseline for % diff calculation
   - "vs Avg" column using aggregate stats
   - All metrics + ratios + sparklines side-by-side
   - Color coding for best/worst per row
   - Actions: Export comparison CSV, Close, Remove company

## Key Implementation Details
- Selection NOT persisted to URL (too volatile)
- Compare state IS persisted to URL (shareable)
- % diff = ((company_value - baseline_value) / baseline_value) * 100
- "vs Avg" uses avg_growth_7d from aggregate stats RPC

## Success Criteria
- [ ] Row checkboxes work (single click)
- [ ] "Select all" selects visible rows
- [ ] Bulk actions bar appears when 1+ selected
- [ ] Compare button only enabled for 2-5 selections
- [ ] Compare modal shows all metrics side-by-side
- [ ] % diff calculated correctly from baseline
- [ ] "vs Avg" column shows comparison to filtered average
- [ ] Compare URL is shareable (?compare=123,456)

## Verify Before Proceeding
1. Click row checkbox - row selected
2. Click header checkbox - all visible selected
3. Select 3 companies, click Compare - modal opens
4. Verify % diff calculations are correct
5. Share compare URL in new tab - same comparison loads

## Do NOT
- Implement export yet (M6b)
- Implement pin to dashboard yet (M6b)

## After Completion
Update `/docs/specs/companies-page-progress.md`
```

---

### MILESTONE 6b: Export & Dashboard Integration

```markdown
# Milestone 6b: Export & Dashboard Integration

## Reference Documentation
- Master spec: `/docs/specs/companies-page-spec.md`
  - Read: "Feature Specification §9" (Actions & Export)
- Progress tracker: `/docs/specs/companies-page-progress.md`
- M6a output: Selection and compare mode working

## Context Recovery (if resuming after /clear)
1. Read master spec sections listed above
2. Check progress tracker for M6a completion status
3. Visit `/companies`, verify selection and compare work

## Goal
Add CSV export functionality and pin-to-dashboard integration.

## Tasks
1. Create `components/ExportDialog.tsx`:
   - Modal with options:
   - Format: CSV (Excel future)
   - Scope: Filtered results OR Selected only
   - Include: Visible columns only / All metrics / Per-game breakdown
2. Create `lib/companies-export.ts`:
   - `generateCSV(companies, columns, options)` function
   - `generatePerGameCSV(companyIds)` for per-game breakdown
   - Include filter summary as CSV comment header
3. Implement per-game export format (see spec for CSV structure)
4. Add pin icon to each row:
   - Clicking pins company to dashboard
   - Visual indicator for already-pinned (filled star)
   - Reference existing dashboard system: `/docs/architecture/personalized-dashboard.md`
5. Implement bulk pin for selected companies
6. Add Steam link icon - opens Steam publisher/developer page
7. Add toast confirmation on pin actions

## Key Implementation Details
- CSV download via Blob URL
- Per-game breakdown requires additional query (game-level data)
- Pin integration uses existing dashboard API/context
- Steam URL built from `steam_vanity_url` or fallback to ID

## Success Criteria
- [ ] Export dialog opens from header button
- [ ] CSV downloads with correct data
- [ ] Scope option works (filtered vs selected)
- [ ] Visible columns only option works
- [ ] Per-game breakdown export works
- [ ] Pin to dashboard works (single row)
- [ ] Bulk pin works
- [ ] Steam links open correctly
- [ ] Toast confirmations appear

## Verify Before Proceeding
1. Click Export - dialog opens
2. Export filtered results - CSV downloads with all visible companies
3. Select 3, export selected only - CSV has only 3
4. Check "Per-game breakdown" - CSV has one row per game
5. Click pin icon - company pinned (check dashboard)
6. Click Steam link - opens Steam page

## Do NOT
- Over-engineer the export (keep it simple)
- Add features not in spec

## After Completion
Update `/docs/specs/companies-page-progress.md`
```

---

### MILESTONE 7: Polish & Performance

```markdown
# Milestone 7: Polish & Performance

## Reference Documentation
- Master spec: `/docs/specs/companies-page-spec.md`
  - Read: "UI/UX Design > Empty State"
  - Read: "Feature Specification §11" (Result Limits & Performance)
- Progress tracker: `/docs/specs/companies-page-progress.md`

## Context Recovery (if resuming after /clear)
1. Read master spec sections listed above
2. Check progress tracker for M6b completion status
3. Visit `/companies` and test all features work

## Goal
Final polish, performance optimization, error handling, and testing.

## Tasks

### Performance
1. Profile page load time (target: <2s)
2. Profile filter change response time (target: <500ms)
3. Add database indexes if needed
4. Verify sparklines lazy-load (not blocking)
5. Verify filter counts are cached

### Loading States
1. Skeleton loading for initial load
2. Inline spinners for filter changes
3. Sparkline loading indicators
4. Button loading states
5. Progress indicator for exports

### Error Handling
1. Error states for failed data fetch
2. Error states for failed export
3. Retry buttons
4. User-friendly error messages

### Empty State
1. Implement empty state per spec
2. Show contextual suggestions based on active filters
3. Prominent "Clear all filters" button

### Accessibility
1. Keyboard navigation
2. Screen reader labels
3. Focus management
4. ARIA attributes
5. Color contrast check

### Documentation & Cleanup
1. Add redirects: `/publishers` → `/companies?type=publisher`
2. Add redirects: `/developers` → `/companies?type=developer`
3. Update navigation links
4. Code comments for complex logic
5. JSDoc for exported functions

### Testing Checklist
- [ ] All filter combinations work
- [ ] URL state persistence works
- [ ] Export downloads correct data
- [ ] Compare mode calculates correctly
- [ ] Empty data handled
- [ ] Single result handled
- [ ] Maximum results (500) handled
- [ ] Special characters in search handled
- [ ] Network errors handled gracefully

## Success Criteria
- [ ] Page loads in <2 seconds
- [ ] Filter changes respond in <500ms
- [ ] No console errors
- [ ] All accessibility checks pass
- [ ] Empty state is helpful
- [ ] Error states are graceful
- [ ] Redirects work
- [ ] Mobile doesn't break (basic responsive)

## Final QA Checklist
Run through complete user flows:
1. Executive: Load page → Click preset → View top companies
2. BI Analyst: Search → Apply filters → Customize columns → Export
3. Investor: Select companies → Compare → Share URL
4. BD Manager: Filter self-published → Pin interesting ones → View on dashboard

## After Completion
Update `/docs/specs/companies-page-progress.md`:
- Mark all milestones complete
- Document any known issues
- Note production deployment date
```

---

*End of Master Specification v3.0*
