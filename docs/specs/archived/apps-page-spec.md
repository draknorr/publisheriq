# PublisherIQ Apps Page - Master Specification

> **Document Version:** 1.1
> **Created:** January 15, 2026
> **Revised:** January 16, 2026 (implementation complete)
> **Status:** Implementation Complete (January 16, 2026)
> **Target:** Claude Code Implementation
> **Reference Implementation:** `/companies` page (v2.5) - follow same patterns

---

## Implementation Status

**All 11 milestones completed.** See [Progress Document](./apps-page-progress.md) for full implementation log.

### Performance Achieved

| Operation | Target | Actual |
|-----------|--------|--------|
| Page load | <2s | ~200ms |
| Fast path query | <500ms | ~200ms |
| Slow path query | <2s | ~4s (exceeds target due to publisher JOIN) |
| Filter counts | <500ms | <10ms |
| Aggregate stats | <500ms | <10ms |

### Implementation Notes

- **9 Migrations** created (vs. 8 estimated) - additional migration for MV optimizations
- **7 Materialized Views** for performance (not in original spec):
  - `app_filter_data` - pre-computed content arrays for O(1) filtering
  - `mv_tag_counts`, `mv_genre_counts`, `mv_category_counts` - filter dropdown counts
  - `mv_steam_deck_counts`, `mv_ccu_tier_counts`, `mv_velocity_tier_counts` - tier counts
  - `mv_apps_aggregate_stats` - pre-computed summary stats
- **3-day growth windows** used instead of 7-day (limited CCU snapshot history)
- **LATERAL join** for playtime data (not in `latest_daily_metrics`)

---

## Table of Contents

1. [How to Use This Document](#how-to-use-this-document)
2. [Executive Summary](#executive-summary)
3. [Companies Page Reference](#companies-page-reference)
4. [Product Vision](#product-vision)
5. [Data Foundation](#data-foundation)
6. [Feature Specification](#feature-specification)
7. [UI/UX Design](#uiux-design)
8. [Technical Architecture](#technical-architecture)
9. [Reference Data](#reference-data)
10. [Milestone Prompts](#milestone-prompts)
11. [Progress Tracker Template](#progress-tracker-template)

---

## How to Use This Document

### For Claude Code Implementation

This document is the **single source of truth** for the Apps page implementation. Each milestone prompt references specific sections of this document.

**Workflow:**
1. Store this file at: `/docs/specs/apps-page-spec.md`
2. Create progress tracker at: `/docs/specs/apps-page-progress.md` (template at end)
3. For each milestone:
   - Start fresh session (or `/clear`)
   - Paste the milestone prompt
   - Claude Code reads this spec + progress tracker
   - Implement the milestone
   - Verify success criteria
   - Update progress tracker
   - Commit changes
   - `/clear` and repeat

**Key Principle:** Milestone prompts are intentionally brief. Detailed specifications live in this document. Always reference this document for complete details.

---

## Executive Summary

### What We're Building

A completely rebuilt **Games page** (`/apps` route) that transforms the current basic game list into the most powerful game discovery and analysis tool in PublisherIQ. This page follows the same architectural patterns as the `/companies` page (v2.5) but with game-specific features and **novel computed insight metrics**.

> **Naming Convention:** User-facing = "Games". Technical/code = "apps". The route remains `/apps` but the page title, headers, and all UI text refer to "Games".

### Key Innovations (Beyond Companies Page)

| Feature | Description | Why It Matters |
|---------|-------------|----------------|
| **Momentum Score** | Combined CCU growth + review velocity trajectory | Single signal for "is this game taking off?" |
| **Sentiment Delta** | Change in review sentiment over time | Catch comeback stories and review bombs |
| **Active Player %** | What fraction of owners are playing now | Engagement depth vs historical reach |
| **Review Rate** | Reviews per 1K owners | Community engagement/vocal fanbase |
| **Value Score** | Hours of entertainment per dollar | Quality-adjusted price assessment |
| **vs Publisher Avg** | Performance relative to publisher's catalog | Context for publisher's other games |

### Key Principles (Inherited from Companies Page)

1. **Filter First** - Powerful filters over pagination
2. **Everything Customizable** - Toggleable columns, metrics, visualizations
3. **Data Dense** - Maximum info without overwhelming
4. **Snappy Performance** - <2s load, <500ms filter changes
5. **Shareable** - All state in URL
6. **Trustworthy** - Methodology tooltips, data freshness indicators

### Default Experience

- Page header shows **"Games"**
- Shows **Top 50 games by Peak CCU**
- Games only (excludes DLC/Demos by default)
- 10 default columns including Momentum Score and CCU Sparkline
- One-click presets for common discovery patterns

---

## Companies Page Reference

### Critical Implementation Patterns to Follow

The `/companies` page implementation (v2.5, ~62 files, ~14 migrations) established patterns that MUST be followed for consistency:

#### 1. Two-Path Query Optimization

```sql
-- From companies-page-rpcs.sql
-- Check if expensive computations needed
v_needs_growth := (p_min_growth_7d IS NOT NULL OR p_sort_by IN ('ccu_growth_7d'));

IF NOT v_needs_growth THEN
  -- Fast path (~214ms): Simple queries, NULL for expensive columns
  RETURN QUERY SELECT ... FROM apps JOIN latest_daily_metrics ...
ELSE
  -- Slow path (~4s): Full computation with all metrics
  RETURN QUERY WITH computed AS (...) SELECT ...
END IF;
```

**For Apps Page:** Use same pattern. Fast path for basic browsing, slow path when filtering/sorting by computed metrics (momentum, sentiment_delta, vs_publisher_avg).

#### 2. Pre-Computed Content Arrays with GIN Indexes

The companies page added pre-computed arrays for O(1) filtering:

```sql
-- Already exists on apps via junction tables
-- Use array containment operators:
WHERE genre_ids @> ARRAY[1,2,3]::INT[]   -- Contains ALL (All mode)
WHERE genre_ids && ARRAY[1,2,3]::INT[]   -- Overlaps ANY (Any mode)
```

**For Apps Page:** The junction tables (`app_genres`, `app_steam_tags`, `app_categories`) already have GIN indexes. Use same query patterns.

#### 3. URL State Management

```typescript
// From useCompaniesFilters.ts pattern
const router = useRouter();
const searchParams = useSearchParams();
const [isPending, startTransition] = useTransition();

// Read from URL
const type = searchParams.get('type') || 'game';
const sort = searchParams.get('sort') || 'ccu_peak';

// Write to URL (replaces state)
startTransition(() => {
  router.push(`/apps?${newParams.toString()}`, { scroll: false });
});
```

#### 4. Lazy-Loaded Sparklines

```typescript
// From useSparklineLoader.ts pattern
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const appid = entry.target.dataset.appid;
      loadSparkline(appid);
    }
  });
});
```

#### 5. File Structure Pattern

```
apps/admin/src/app/(main)/companies/
├── page.tsx                    # Server component
├── error.tsx                   # Error boundary with retry
├── loading.tsx                 # Skeleton loading
├── components/
│   ├── CompaniesPageClient.tsx # Main client orchestrator
│   ├── CompaniesTable.tsx      # Desktop + mobile
│   ├── GrowthCell.tsx          # Reusable indicator
│   ├── MethodologyTooltip.tsx  # Info popover
│   └── filters/                # Filter components
├── hooks/
│   ├── useCompaniesFilters.ts  # URL state (777 LOC)
│   └── useSparklineLoader.ts   # IntersectionObserver
└── lib/
    ├── companies-types.ts      # TypeScript interfaces
    ├── companies-queries.ts    # RPC wrappers
    ├── companies-presets.ts    # Preset definitions
    └── companies-methodology.ts # Tooltip content
```

### Components to Reuse Directly

| Component | Location | Use Case |
|-----------|----------|----------|
| `GrowthCell` | `/companies/components/GrowthCell.tsx` | CCU growth indicators |
| `MethodologyTooltip` | `/companies/components/MethodologyTooltip.tsx` | Column info popovers |
| `DualRangeSlider` | `/companies/components/filters/DualRangeSlider.tsx` | Min/max range inputs |
| `GenreTagFilter` | `/companies/components/filters/GenreTagFilter.tsx` | Multi-select with counts |
| `TrendSparkline` | `/components/data-display/Sparkline.tsx` | CCU trend visualization |
| `ReviewScoreBadge` | `/components/data-display/ReviewScoreBadge.tsx` | Review score display |

### Migrations Created for Companies Page (Reference)

| Migration | Purpose |
|-----------|---------|
| `20260113000000_companies_page_rpcs.sql` | Initial 4 RPC functions |
| `20260114000000_add_max_filter_params.sql` | Max filter parameters |
| `20260114200000_optimize_companies_content_filters.sql` | Pre-computed arrays |
| `20260115000000_add_content_arrays_to_metrics.sql` | Genre/tag arrays |
| `20260115300000_add_platform_filtering.sql` | Platform arrays + GIN |
| `20260115400000_precompute_growth_metrics.sql` | Growth pre-computation |

### Key Deviations from Companies Page

| Aspect | Companies Page | Games Page |
|--------|---------------|-----------|
| **User-facing name** | "Companies" | "Games" |
| **Technical name** | "companies" | "apps" |
| Entity | Aggregated publisher/developer | Individual games |
| Growth source | Aggregated from games (computed) | Direct from `ccu_tier_assignments` (pre-computed) |
| Content filters | Aggregate counts across games | Direct per-game attributes |
| Relationships | Has games below | Has publisher/developer above |
| Compare use case | "Which publisher is better?" | "Which game to play/cover?" |
| URL format | `?compare=pub:123,dev:456` | `?compare=730,1245620` (appids only) |

---

## Product Vision

### Target Users

| User Type | Primary Goals | Key Features |
|-----------|---------------|--------------|
| **Executive** | Market overview, top performers | Presets, trends, summary stats |
| **BI Analyst** | Deep exploration, reports | Granular filters, export, computed metrics |
| **Content Creator** | Find games to cover | Breakout detection, hidden gems, momentum |
| **Investor** | Growth signals, breakouts | Momentum score, sentiment trajectory |
| **BD/Partnerships** | Find games for deals | Publisher filters, relationship context |

### User Stories

1. *"As an executive, I want to see top 50 games by current players."*
2. *"As an analyst, I want to filter by multiple growth signals to find breakouts."*
3. *"As a content creator, I want to find hidden gems with engaged communities."*
4. *"As an investor, I want to see games with improving sentiment (comeback stories)."*
5. *"As a BD manager, I want to find games outperforming their publisher's average."*

---

## Data Foundation

### Primary Data Sources

| Source | Tables/Views | Key Data | Notes |
|--------|--------------|----------|-------|
| Core | `apps` | appid, name, type, release_date, is_free, platforms | ~157K games |
| Metrics | `latest_daily_metrics` | ccu_peak, owners, playtime, reviews, price | Materialized view |
| Growth | `ccu_tier_assignments` | ccu_growth_7d, ccu_growth_30d, ccu_tier | Pre-computed hourly |
| Trends | `app_trends` | trend_direction, current/previous_positive_ratio | For sentiment calc |
| Velocity | `review_velocity_stats` | velocity_7d, velocity_30d, velocity_tier | Pre-computed |
| Content | `app_genres`, `app_steam_tags`, `app_categories` | GIN-indexed arrays | Use && and @> operators |
| Platform | `app_steam_deck` | Steam Deck compatibility | category column |
| Relationships | `app_publishers`, `app_developers` | Publisher/developer links | Junction tables |
| Publisher Context | `publisher_metrics` | avg_review_score | For vs_publisher calc |
| Sparklines | `ccu_snapshots` | Time-series CCU data | Tier 1/2 hourly, Tier 3 3x/day |

### Key Difference from Companies Page

**Companies page** had to AGGREGATE growth from games (computed at query time, slow path ~4s).

**Apps page** already has growth PRE-COMPUTED at game level in `ccu_tier_assignments`:
- `ccu_growth_7d` - 7-day growth %
- `ccu_growth_30d` - 30-day growth %
- Refreshed hourly by `recalculate_ccu_tiers()` function

This means the Apps page can be FASTER than Companies for growth queries.

### Computed Metrics (Calculated in RPC)

| Metric | Formula | Notes |
|--------|---------|-------|
| `sentiment_delta` | `current_positive_ratio - previous_positive_ratio` | From app_trends |
| `momentum_score` | `(ccu_growth_7d + velocity_acceleration) / 2` | Combined signal |
| `velocity_acceleration` | `velocity_7d - velocity_30d` | Is velocity increasing? |
| `active_player_pct` | `(ccu_peak / owner_midpoint) * 100` | Handle zero owners |
| `review_rate` | `(total_reviews / owner_midpoint) * 1000` | Reviews per 1K owners |
| `value_score` | `avg_playtime_hours / price_dollars` | NULL for free games |
| `vs_publisher_avg` | `review_score - publisher_avg_score` | Requires JOIN |
| `days_live` | `CURRENT_DATE - release_date` | Simple calc |
| `hype_duration` | `release_date - store_asset_mtime` | Pre-release period |
| `owner_midpoint` | `(owners_min + owners_max) / 2` | For other calcs |

---

## Feature Specification

### 1. App Type Toggle

**User-facing labels:**
```
[All Types] [Games] [DLC] [Demos]
```

| Option | Label | Filter | Default |
|--------|-------|--------|---------|
| All Types | "All Types" | No type filter | |
| Games | "Games" | `type = 'game'` | ✓ |
| DLC | "DLC" | `type = 'dlc'` | |
| Demos | "Demos" | `type = 'demo'` | |

**URL:** `?type=game` (default) | `?type=all` | `?type=dlc` | `?type=demo`

---

### 2. Preset Views (12 Total)

| Preset | Label | Filters | Sort |
|--------|-------|---------|------|
| `top_games` | Top Games | `ccu >= 1000` | CCU DESC |
| `rising_stars` | Rising Stars | `growth_7d >= 25`, `owners < 500K` | Growth DESC |
| `hidden_gems` | Hidden Gems | `score >= 90`, `owners < 50K`, `reviews >= 100` | Score DESC |
| `new_releases` | New Releases | `age <= 30 days` | Release DESC |
| `breakout_hits` | Breakout Hits | `growth_7d >= 50`, `age <= 90 days` | Growth DESC |
| `high_momentum` | 🔥 High Momentum | `momentum >= 15`, `ccu >= 500` | Momentum DESC |
| `comeback_stories` | 📈 Comeback Stories | `sentiment_delta >= 5`, `reviews >= 1000` | Sentiment DESC |
| `evergreen` | 🌲 Evergreen | `age >= 730 days`, `ccu >= 1000`, `score >= 80` | CCU DESC |
| `true_gems` | 💎 True Gems | `score >= 90`, `owners < 50K`, `review_rate >= 5` | Review Rate DESC |
| `best_value` | 💰 Best Value | `value_score >= 2`, `score >= 75` | Value DESC |
| `publishers_best` | 🏆 Publisher's Best | `vs_publisher >= 10` | vs Publisher DESC |
| `f2p_leaders` | 🆓 F2P Leaders | `is_free = true`, `ccu >= 5000` | CCU DESC |

**Behavior:** Clicking preset CLEARS other filters, applies preset, sets sort.

---

### 3. Quick Filters (12 Stackable Toggles)

| ID | Label | Filter |
|----|-------|--------|
| `popular` | Popular | `ccu >= 1000` |
| `trending` | Trending ↑ | `growth_7d >= 10` |
| `well_reviewed` | Well Reviewed | `score >= 85` |
| `free` | Free | `is_free = true` |
| `indie` | Indie | Publisher game count < 10 |
| `steam_deck` | Steam Deck | Verified or Playable |
| `momentum_up` | Momentum ↑ | `momentum >= 10` |
| `sentiment_up` | Sentiment ↑ | `sentiment_delta >= 3` |
| `workshop` | Workshop | Has category 30 |
| `early_access` | Early Access | `release_state = 'prerelease'` |
| `on_sale` | On Sale | `discount > 0` |
| `this_week` | This Week | `age <= 7 days` |

**Behavior:** Quick filters are ADDITIVE (AND logic). Toggle on/off.

---

### 4. Default Columns (10)

| # | Column | Description | Sortable | Width |
|---|--------|-------------|----------|-------|
| 1 | Rank | Position by sort | No | 50px |
| 2 | Game | Name + link to `/apps/{appid}` | Yes | 250px |
| 3 | Peak CCU | 24h peak concurrent | Yes | 100px |
| 4 | CCU Growth (7d) | Week-over-week % | Yes | 120px |
| 5 | Momentum | Combined trajectory | Yes | 100px |
| 6 | Owners | Estimated owners | Yes | 100px |
| 7 | Reviews | Count + positive % | Yes | 120px |
| 8 | Price | Current + discount | Yes | 100px |
| 9 | Release | Release date | Yes | 100px |
| 10 | CCU Trend | 7-day sparkline | No | 80px |

---

### 5. Optional Columns (25+)

#### Engagement
- Est. Weekly Hours
- Avg Playtime (forever)
- Avg Playtime (2 weeks)
- Median Playtime
- **Active Player %** ⭐

#### Reviews
- Positive Reviews
- Negative Reviews
- Review Score (% only)
- Review Velocity (7d)
- Review Velocity (30d)
- Velocity Tier
- **Sentiment Δ** ⭐
- **Review Rate** ⭐

#### Growth
- CCU Growth (30d)
- Velocity Acceleration
- Trend Direction

#### Financial
- Revenue Estimate
- Original Price
- Discount %
- **Value Score** ⭐

#### Context
- Publisher (name + link)
- Developer (name + link)
- **vs Publisher Avg** ⭐
- Publisher Game Count

#### Timeline
- Days Live
- **Hype Duration** ⭐
- Page Created Date

#### Platform
- Steam Deck Status
- Platforms (Win/Mac/Linux)
- Controller Support

#### Activity Tiers
- **CCU Tier** ⭐ (Hot/Active/Quiet)
- **Velocity Tier** ⭐ (High/Medium/Low/Dormant)

---

### 6. Advanced Filters

#### Metric Ranges (min/max)
- Peak CCU, Owners, Reviews, Score, Price, Playtime, Weekly Hours

#### Growth Filters
- CCU Growth 7d/30d with presets (Growing >10% / Stable -10 to 10% / Declining <-10%)
- Momentum Score range

#### Sentiment Filters
- Sentiment Δ with presets (Improving >3% / Stable / Declining <-3% / Bombing <-10%)
- Velocity Tier (High/Medium/Low/Dormant)

#### Engagement Filters
- Active Player %, Review Rate, Value Score (min values)

#### Content Filters
- Genres (multi-select, Any/All mode, with counts)
- Tags (searchable multi-select, top 50, with counts)
- Features/Categories (checkboxes: Workshop, Achievements, Co-op, etc.)

#### Platform Filters
- Platforms (Windows/Mac/Linux, Any/All mode)
- Steam Deck (Any/Verified/Playable/Unsupported)
- Controller (Any/Full/Partial)

#### Release Filters
- Period presets (7d, 30d, 90d, year, 2024, 2023...)
- Age range (min/max days)
- Early Access toggle
- Hype Duration range

#### Relationship Filters
- Publisher search (text input)
- Developer search (text input)
- Self-Published toggle
- vs Publisher Avg presets (Above +5 / Top +10 / Below -5)
- Publisher Size (Indie <5 / Mid 5-20 / Major 20+)

#### Activity Filters
- CCU Tier (Hot Tier 1 / Active Tier 2 / Quiet Tier 3)
- Velocity Tier (High/Medium/Low/Dormant)

---

### 7. Visualizations

#### Growth Indicator Thresholds

| Growth | Emoji | Color |
|--------|-------|-------|
| ≥50% | 🚀 | Bright green |
| 10-49% | ↑ | Green |
| -10 to 10% | → | Gray |
| -49 to -10% | ↓ | Orange |
| ≤-50% | 📉 | Red |

#### Momentum Thresholds

| Score | Emoji | Color |
|-------|-------|-------|
| ≥20 | 🚀🚀 | Bright green |
| 10-19 | 🚀 | Green |
| 0-9 | ↗ | Light green |
| -9 to 0 | → | Gray |
| -19 to -10 | ↘ | Orange |
| ≤-20 | 📉 | Red |

#### Sentiment Δ Thresholds

| Change | Emoji | Color | Label |
|--------|-------|-------|-------|
| ≥+10% | ⬆ | Bright green | Surging |
| +3 to +9% | ↑ | Green | Improving |
| -3 to +3% | → | Gray | Stable |
| -9 to -3% | ↓ | Orange | Declining |
| ≤-10% | ⬇ | Red | Review Bomb |

---

### 8. Compare Mode

- Select 2-5 games via checkboxes
- Side-by-side comparison modal
- All metrics shown with "vs Avg" column
- Best/worst highlighted per row
- URL: `?compare=730,1245620,553850`

---

### 9. Export

- Format: CSV or JSON
- Scope: Filtered results or selected only
- Columns: Visible only or all
- Options: Include methodology notes

---

### 10. Summary Stats Bar

**Header:** "Games" with result count

```
Games (1,247) │ Avg CCU: 2.4K │ Avg Score: 76% │ ↑ 312 Trending │ ↓ 89 Declining
Avg Momentum: +8.2 │ Sentiment ↑: 156 │ Sentiment ↓: 43 │ Avg Value: 1.8 hrs/$
```

---

## Technical Architecture

### Database RPC Functions

#### 1. `get_apps_with_filters`

Main query function. Parameters:

```sql
-- Type filter
p_type TEXT DEFAULT 'game',

-- Text search
p_search TEXT DEFAULT NULL,

-- Metric ranges (all have min/max)
p_min_ccu INT, p_max_ccu INT,
p_min_owners BIGINT, p_max_owners BIGINT,
p_min_reviews INT, p_max_reviews INT,
p_min_score INT, p_max_score INT,
p_min_price INT, p_max_price INT,
p_min_playtime INT, p_max_playtime INT,

-- Growth filters
p_min_growth_7d DECIMAL, p_max_growth_7d DECIMAL,
p_min_growth_30d DECIMAL, p_max_growth_30d DECIMAL,
p_min_momentum DECIMAL, p_max_momentum DECIMAL,

-- Sentiment filters
p_min_sentiment_delta DECIMAL, p_max_sentiment_delta DECIMAL,
p_velocity_tier TEXT,

-- Engagement filters
p_min_active_pct DECIMAL,
p_min_review_rate DECIMAL,
p_min_value_score DECIMAL,

-- Content filters
p_genres INT[], p_genre_mode TEXT DEFAULT 'any',
p_tags INT[], p_tag_mode TEXT DEFAULT 'any',
p_categories INT[],
p_has_workshop BOOLEAN,

-- Platform filters
p_platforms TEXT[], p_platform_mode TEXT DEFAULT 'any',
p_steam_deck TEXT,
p_controller TEXT,

-- Release filters
p_min_age INT, p_max_age INT,
p_release_year INT,
p_early_access BOOLEAN,
p_min_hype INT, p_max_hype INT,

-- Relationship filters
p_publisher_search TEXT,
p_developer_search TEXT,
p_self_published BOOLEAN,
p_min_vs_publisher DECIMAL,
p_publisher_size TEXT,

-- Activity filters
p_ccu_tier INT,

-- Sort and pagination
p_sort_field TEXT DEFAULT 'ccu_peak',
p_sort_order TEXT DEFAULT 'desc',
p_limit INT DEFAULT 50,
p_offset INT DEFAULT 0
```

Returns all fields needed for display including computed metrics.

#### 2. `get_apps_aggregate_stats`

Summary statistics. Same filter params, returns:
- total_games, avg_ccu, avg_score, avg_momentum
- trending_up_count, trending_down_count
- sentiment_improving_count, sentiment_declining_count
- avg_value_score

#### 3. `get_app_sparkline_data`

CCU time-series for sparklines:
```sql
p_appids INT[],
p_days INT DEFAULT 7
```
Returns array of {appid, sparkline_data JSONB}.

#### 4. `get_apps_filter_option_counts`

Filter option counts for dropdowns:
```sql
p_filter_type TEXT,  -- 'genre', 'tag', 'category', 'steam_deck', 'platform'
p_type TEXT DEFAULT 'game',
-- Pass current filters for contextual counts
```

### Performance Optimization: Materialized Views

> **Added January 2026:** With 160K+ games, real-time aggregations caused timeouts. Solution: pre-computed materialized views.

#### Filter Count MVs (refreshed daily)

| View | Purpose | Query Time |
|------|---------|------------|
| `mv_tag_counts` | Tag counts by app type | <10ms |
| `mv_genre_counts` | Genre counts by app type | <10ms |
| `mv_category_counts` | Category counts by app type | <10ms |
| `mv_steam_deck_counts` | Steam Deck status counts | <10ms |
| `mv_ccu_tier_counts` | CCU tier counts | <10ms |
| `mv_velocity_tier_counts` | Velocity tier counts | <10ms |

#### Aggregate Stats MV

| View | Purpose | Query Time |
|------|---------|------------|
| `mv_apps_aggregate_stats` | Pre-computed totals, averages, trending counts by app type | <10ms |

#### Content Filter MV

| View | Purpose | Query Time |
|------|---------|------------|
| `app_filter_data` | Pre-computed arrays (genre_ids, tag_ids, category_ids, platform_array) with GIN indexes | Enables <500ms content filtering |

#### Fast Path vs Slow Path

```sql
-- Fast path: No filters → read from MV (<10ms)
IF NOT v_has_filters THEN
  RETURN QUERY SELECT * FROM mv_apps_aggregate_stats WHERE app_type = p_type;
ELSE
  -- Slow path: Filters applied → compute on-the-fly (~4s)
  RETURN QUERY WITH computed AS (...) SELECT ...;
END IF;
```

#### Refresh Schedule

All MVs refreshed via `.github/workflows/refresh-views.yml`:
- **Daily at 5:00 AM UTC** (after nightly syncs)
- **Every 6 hours** for `app_filter_data`
- Helper function: `refresh_filter_count_views()` refreshes all filter MVs together

#### Playtime Data

`latest_daily_metrics` does NOT include playtime columns. Must use LATERAL join to `daily_metrics`:

```sql
LEFT JOIN LATERAL (
  SELECT dm.average_playtime_forever, dm.average_playtime_2weeks
  FROM daily_metrics dm
  WHERE dm.appid = a.appid
  ORDER BY dm.metric_date DESC
  LIMIT 1
) dm_playtime ON true
```

### File Structure

> **Naming:** Files and code use "apps" (technical). UI text uses "Games" (user-facing).

```
apps/admin/src/app/(main)/apps/
├── page.tsx                          # Server component (page title: "Games")
├── error.tsx                         # Error boundary with retry
├── loading.tsx                       # Skeleton loading
├── components/
│   ├── AppsPageClient.tsx            # Main client orchestrator (~400 LOC)
│   ├── AppTypeToggle.tsx             # Type filter tabs
│   ├── AppsTable.tsx                 # Desktop table + mobile cards (~500 LOC)
│   ├── PresetViews.tsx               # Preset buttons row
│   ├── QuickFilters.tsx              # Toggle buttons row
│   ├── SearchBar.tsx                 # Debounced search
│   ├── AdvancedFiltersPanel.tsx      # Collapsible filter panel
│   ├── SummaryStatsBar.tsx           # Aggregate stats
│   ├── ColumnSelector.tsx            # Column visibility dropdown
│   ├── BulkActionsBar.tsx            # Selection actions
│   ├── CompareMode.tsx               # Comparison modal
│   ├── ExportDialog.tsx              # Export options
│   ├── SavedViews.tsx                # Save/load filter views
│   ├── EmptyState.tsx                # No results messaging
│   ├── DataFreshnessFooter.tsx       # Data sync status
│   │
│   ├── cells/
│   │   ├── GrowthCell.tsx            # REUSE from /companies
│   │   ├── MomentumCell.tsx          # NEW - momentum indicator
│   │   ├── SentimentCell.tsx         # NEW - sentiment delta indicator
│   │   ├── PriceCell.tsx             # Price + discount
│   │   ├── ReviewsCell.tsx           # Count + score badge
│   │   ├── SparklineCell.tsx         # Lazy-loaded sparkline
│   │   ├── SteamDeckCell.tsx         # Deck badge
│   │   └── ActionsCell.tsx           # Row actions
│   │
│   └── filters/
│       ├── MetricRangeFilters.tsx    # ADAPT from /companies
│       ├── GrowthFilters.tsx         # ADAPT from /companies
│       ├── SentimentFilters.tsx      # NEW
│       ├── EngagementFilters.tsx     # NEW
│       ├── ContentFilters.tsx        # Genres/tags/features
│       ├── PlatformFilters.tsx       # ADAPT from /companies
│       ├── ReleaseFilters.tsx        # Time period/age
│       ├── RelationshipFilters.tsx   # Publisher/developer
│       ├── ActivityFilters.tsx       # CCU tier/velocity tier
│       ├── GenreTagFilter.tsx        # REUSE from /companies
│       ├── DualRangeSlider.tsx       # REUSE from /companies
│       └── RangeInput.tsx            # Min/max input pair
│
├── hooks/
│   ├── useAppsFilters.ts             # URL state (~700 LOC)
│   ├── useAppsSelection.ts           # Row selection
│   ├── useAppsCompare.ts             # Compare mode
│   ├── useSavedViews.ts              # REUSE pattern from /companies
│   ├── useFilterCounts.ts            # REUSE pattern from /companies
│   └── useSparklineLoader.ts         # REUSE pattern from /companies
│
└── lib/
    ├── apps-types.ts                 # TypeScript interfaces
    ├── apps-queries.ts               # RPC wrappers
    ├── apps-columns.ts               # Column definitions
    ├── apps-presets.ts               # Preset/quick filter definitions
    ├── apps-computed.ts              # Computed metric formulas
    ├── apps-methodology.ts           # Tooltip content
    ├── apps-compare.ts               # Comparison logic
    └── apps-export.ts                # Export formatting
```

### Expected Migration Count

Based on companies page (~14 migrations), expect ~8-12 migrations for apps page:

| Migration | Purpose |
|-----------|---------|
| `_apps_page_rpcs.sql` | Initial 4 RPC functions |
| `_apps_max_filter_params.sql` | Max filter parameters |
| `_apps_sentiment_filters.sql` | Sentiment-based filtering |
| `_apps_publisher_context.sql` | vs_publisher_avg calculation |
| `_apps_activity_filters.sql` | CCU tier / velocity tier exposure |
| (additional as needed) | Bug fixes, optimization |

---

## Reference Data

### User-Facing Naming Convention

| Context | Use |
|---------|-----|
| Page header/title | "Games" |
| Navigation menu | "Games" |
| Type toggle labels | "All Types", "Games", "DLC", "Demos" |
| Summary stats | "Games (1,247)" |
| Export dialog | "Export Games" |
| Empty state | "No games match your filters" |
| Compare mode | "Compare Games" |
| Code/files/routes | "apps" (technical) |
| Database tables | "apps" (unchanged) |
| URL route | `/apps` (unchanged) |

### Methodology Tooltips

```typescript
export const methodology = {
  ccu_peak: "Highest concurrent players in last 24 hours from Steam API.",
  ccu_growth_7d: "Percentage change comparing average CCU of last 7 days to prior 7 days. Pre-computed hourly.",
  ccu_growth_30d: "Percentage change comparing average CCU of last 30 days to prior 30 days.",
  momentum_score: "Combined trajectory: (CCU Growth 7d + Review Velocity Acceleration) / 2. Positive = both trending up.",
  sentiment_delta: "Change in positive review percentage: recent period vs prior period. Positive = improving perception.",
  velocity_7d: "Average new reviews per day over the last 7 days.",
  velocity_30d: "Average new reviews per day over the last 30 days.",
  velocity_acceleration: "Velocity 7d minus Velocity 30d. Positive = review rate increasing.",
  active_player_pct: "Peak CCU divided by estimated owners. Shows what % of owners are playing now.",
  review_rate: "Reviews per 1,000 owners. Higher = more engaged/vocal community.",
  value_score: "Average playtime (hours) divided by price (dollars). Free games excluded.",
  vs_publisher_avg: "This game's review score minus publisher's average review score across all their games.",
  owners: "Estimated from SteamSpy data combined with review-to-owner ratios. Confidence: ±20%.",
  days_live: "Days since Steam release.",
  hype_duration: "Days between Steam page creation and release. Longer = more pre-release marketing.",
  ccu_tier: "Activity tier: Tier 1 (Hot) = top 500 by CCU, Tier 2 (Active) = top 1000 new releases, Tier 3 (Quiet) = all others.",
  velocity_tier: "Review activity: High (5+ reviews/day), Medium (1-5), Low (0.1-1), Dormant (<0.1).",
};
```

### Preset Definitions

```typescript
export const presets = {
  top_games: {
    label: "Top Games",
    filters: { minCcu: 1000 },
    sort: { field: "ccu_peak", order: "desc" }
  },
  rising_stars: {
    label: "Rising Stars",
    filters: { minGrowth7d: 25, maxOwners: 500000 },
    sort: { field: "ccu_growth_7d", order: "desc" }
  },
  hidden_gems: {
    label: "Hidden Gems",
    filters: { minScore: 90, maxOwners: 50000, minReviews: 100 },
    sort: { field: "review_score", order: "desc" }
  },
  new_releases: {
    label: "New Releases",
    filters: { maxAge: 30 },
    sort: { field: "release_date", order: "desc" }
  },
  breakout_hits: {
    label: "Breakout Hits",
    filters: { minGrowth7d: 50, maxAge: 90 },
    sort: { field: "ccu_growth_7d", order: "desc" }
  },
  high_momentum: {
    label: "🔥 High Momentum",
    filters: { minMomentum: 15, minCcu: 500 },
    sort: { field: "momentum_score", order: "desc" }
  },
  comeback_stories: {
    label: "📈 Comeback Stories",
    filters: { minSentimentDelta: 5, minReviews: 1000 },
    sort: { field: "sentiment_delta", order: "desc" }
  },
  evergreen: {
    label: "🌲 Evergreen",
    filters: { minAge: 730, minCcu: 1000, minScore: 80 },
    sort: { field: "ccu_peak", order: "desc" }
  },
  true_gems: {
    label: "💎 True Gems",
    filters: { minScore: 90, maxOwners: 50000, minReviewRate: 5 },
    sort: { field: "review_rate", order: "desc" }
  },
  best_value: {
    label: "💰 Best Value",
    filters: { minValueScore: 2, minScore: 75 },
    sort: { field: "value_score", order: "desc" }
  },
  publishers_best: {
    label: "🏆 Publisher's Best",
    filters: { minVsPublisher: 10 },
    sort: { field: "vs_publisher_avg", order: "desc" }
  },
  f2p_leaders: {
    label: "🆓 F2P Leaders",
    filters: { isFree: true, minCcu: 5000 },
    sort: { field: "ccu_peak", order: "desc" }
  }
};
```

### Quick Filter Definitions

```typescript
export const quickFilters = {
  popular: { label: "Popular", filter: { minCcu: 1000 } },
  trending: { label: "Trending ↑", filter: { minGrowth7d: 10 } },
  well_reviewed: { label: "Well Reviewed", filter: { minScore: 85 } },
  free: { label: "Free", filter: { isFree: true } },
  indie: { label: "Indie", filter: { publisherSize: "indie" } },
  steam_deck: { label: "Steam Deck", filter: { steamDeck: ["verified", "playable"] } },
  momentum_up: { label: "Momentum ↑", filter: { minMomentum: 10 } },
  sentiment_up: { label: "Sentiment ↑", filter: { minSentimentDelta: 3 } },
  workshop: { label: "Workshop", filter: { hasWorkshop: true } },
  early_access: { label: "Early Access", filter: { earlyAccess: true } },
  on_sale: { label: "On Sale", filter: { minDiscount: 1 } },
  this_week: { label: "This Week", filter: { maxAge: 7 } }
};
```

---

## Milestone Prompts

The following prompts are designed for Claude Code. Each milestone is self-contained.

> **CRITICAL FINDING (Jan 2026 Review):** The spec originally assumed `ccu_growth_7d` and `ccu_growth_30d` exist in `ccu_tier_assignments`. **They do not.** M1 must add these columns via migration before creating RPCs. See M1 tasks.

> **Milestone Structure Update:** Original 8 milestones split into 11 for better session management:
> - M2 → M2a (page structure) + M2b (table & columns)
> - M5 → M5a (column customization) + M5b (visualizations & stats)
> - M6 → M6a (selection & compare) + M6b (export & polish)

---

### MILESTONE 0: Setup & Verification

```
# Milestone 0: Setup & Verification

## Reference Documentation
Read: `/docs/specs/apps-page-spec.md` - "Data Foundation" and "Companies Page Reference"

## Goal
Verify existing resources and set up progress tracking.

## Tasks
1. Verify data sources exist:
   - [ ] `apps` table - list key columns
   - [ ] `latest_daily_metrics` view
   - [ ] `ccu_tier_assignments` - CRITICAL: verify ccu_growth_7d, ccu_growth_30d exist
   - [ ] `app_trends` - verify current_positive_ratio, previous_positive_ratio
   - [ ] `review_velocity_stats` - verify velocity_7d, velocity_30d, velocity_tier
   - [ ] Junction tables with GIN indexes: app_genres, app_steam_tags, app_categories
   - [ ] `app_steam_deck` - verify category column
   - [ ] `publisher_metrics` - verify avg_review_score
   - [ ] `ccu_snapshots` - for sparklines

2. Verify reusable components from /companies:
   - [ ] GrowthCell, MethodologyTooltip, DualRangeSlider, GenreTagFilter
   - [ ] TrendSparkline, ReviewScoreBadge

3. Create progress tracker at `/docs/specs/apps-page-progress.md`

## Success Criteria
- All data sources verified with column listings
- Growth columns confirmed in ccu_tier_assignments
- Progress tracker created

## Do NOT
- Write implementation code
- Modify existing files
```

---

### MILESTONE 1: Database Foundation

```
# Milestone 1: Database Foundation

## Reference Documentation
Read: `/docs/specs/apps-page-spec.md`
- "Data Foundation" - computed metrics table
- "Technical Architecture > Database RPC Functions"
- "Companies Page Reference > Two-Path Query Optimization"

## Goal
Add growth columns to ccu_tier_assignments, then create 4 RPC functions with computed metrics.

## Tasks
### Part A: Growth Column Migration (CRITICAL - do this first)
1. Create migration: `supabase/migrations/YYYYMMDDHHMMSS_add_growth_to_ccu_tiers.sql`
   - Add `ccu_growth_7d_percent DECIMAL` to ccu_tier_assignments
   - Add `ccu_growth_30d_percent DECIMAL` to ccu_tier_assignments
   - Add indexes for sorting/filtering

2. Update `recalculate_ccu_tiers()` function to compute growth:
   - 7d growth: compare last 7 days avg vs prior 7 days avg from ccu_snapshots
   - 30d growth: compare last 7 days avg vs 30-day baseline

### Part B: RPC Functions
3. Create migration: `supabase/migrations/YYYYMMDDHHMMSS_apps_page_rpcs.sql`

4. Implement `get_apps_with_filters`:
   - All filter parameters from spec
   - Computed metrics: sentiment_delta, momentum_score, active_player_pct, review_rate, value_score, vs_publisher_avg
   - Two-path optimization: fast path skips expensive JOINs (vs_publisher_avg)

5. Implement `get_apps_aggregate_stats`

6. Implement `get_app_sparkline_data`

7. Implement `get_apps_filter_option_counts`

## Key Details
- Growth MUST be pre-computed in ccu_tier_assignments (add columns first!)
- Simple arithmetic metrics (sentiment_delta, active_player_pct, etc.) computed at runtime
- vs_publisher_avg requires JOIN to publisher_metrics - use slow path only when filtering by it
- Handle NULL/zero division in all computed metrics

## Success Criteria
- Growth columns exist and populated
- All 4 RPC functions working
- Computed metrics correct
- Fast path < 500ms

## Verify
```sql
-- Verify growth columns exist
SELECT appid, ccu_growth_7d_percent, ccu_growth_30d_percent
FROM ccu_tier_assignments WHERE ccu_growth_7d_percent IS NOT NULL LIMIT 5;

-- Test main RPC
SELECT * FROM get_apps_with_filters() LIMIT 5;
SELECT appid, name, momentum_score, sentiment_delta FROM get_apps_with_filters(p_min_ccu := 1000) LIMIT 10;
```
```

---

### MILESTONE 2a: Page Structure

```
# Milestone 2a: Page Structure

## Reference Documentation
Read: `/docs/specs/apps-page-spec.md`
- "Technical Architecture > File Structure"
- "Reference Data > User-Facing Naming Convention"

## Goal
Create basic Games page structure with data fetching (no table yet).

## Tasks
1. Create page files at `apps/admin/src/app/(main)/apps/`:
   - page.tsx (server component, fetches initial data)
   - error.tsx (error boundary with retry)
   - loading.tsx (skeleton loading)

2. Create core files:
   - components/AppsPageClient.tsx (orchestrator, ~200 LOC initially)
   - lib/apps-types.ts (TypeScript interfaces for RPC returns)
   - lib/apps-queries.ts (RPC wrapper functions)
   - lib/apps-methodology.ts (tooltip content)

3. Implement type toggle: [All Types] [Games] [DLC] [Demos]
   - NOTE: User-facing labels use "Games" terminology
   - Page header/title should be "Games"

4. Wire up basic data fetch and display count

## Key Details
- Default: type=game, limit=50
- Page title: "Games" (not "Apps")
- Copy patterns from /companies page structure

## Success Criteria
- /apps loads with "Games" header
- Type toggle switches and refetches
- Data count displays correctly
- Error boundary works
```

---

### MILESTONE 2b: Table & Columns

```
# Milestone 2b: Table & Columns

## Reference Documentation
Read: `/docs/specs/apps-page-spec.md`
- "Feature Specification §4" (Default Columns)
- "Feature Specification §7" (Visualizations - thresholds)

## Goal
Build data table with 10 default columns, sorting, and URL state.

## Tasks
1. Create components/AppsTable.tsx (~500 LOC)
   - Desktop table view
   - Mobile card view

2. Create cell components in components/cells/:
   - GrowthCell.tsx (copy from /companies)
   - MomentumCell.tsx (NEW - momentum indicator with thresholds)
   - PriceCell.tsx (price + discount badge)
   - ReviewsCell.tsx (count + score badge)

3. Copy from /companies:
   - MethodologyTooltip component

4. Implement 10 default columns from spec:
   - Rank, Game, Peak CCU, CCU Growth (7d), Momentum
   - Owners, Reviews, Price, Release, CCU Trend (placeholder)

5. Wire up sorting, persist to URL

## Key Details
- Growth thresholds: ≥50% 🚀, 10-49% ↑, -10 to 10% →, -49 to -10% ↓, ≤-50% 📉
- Momentum thresholds: ≥20 🚀🚀, 10-19 🚀, 0-9 ↗, -9 to 0 →, -19 to -10 ↘, ≤-20 📉
- Sort state in URL: ?sort=ccu_peak&order=desc

## Success Criteria
- Table displays 10 columns
- All columns sortable (except Rank, CCU Trend)
- Mobile view shows card layout
- URL reflects sort state
- Tooltips appear on column headers
```

---

### MILESTONE 3: Search, Quick Filters & Presets

```
# Milestone 3: Search, Quick Filters & Presets

## Reference Documentation
Read: `/docs/specs/apps-page-spec.md`
- "Feature Specification §2" (12 Presets)
- "Feature Specification §3" (12 Quick Filters)
- "Reference Data" - exact definitions

## Goal
Add search, 12 presets, 12 quick filters.

## Tasks
1. Create lib/apps-presets.ts (copy all 12 from spec)
2. Create components/PresetViews.tsx
3. Create components/QuickFilters.tsx
4. Create components/SearchBar.tsx (300ms debounce)
5. Create hooks/useAppsFilters.ts (URL state)
6. Update data fetching

## Key Details
- Presets CLEAR other filters
- Quick filters ADD (AND logic)
- All 12 presets including insight-based (Momentum, Sentiment)

## Success Criteria
- Search works with debounce
- All 12 presets work
- All 12 quick filters toggle
- URL updates correctly
```

---

### MILESTONE 4a: Advanced Filters - Metrics & Growth

```
# Milestone 4a: Advanced Filters - Metrics & Growth

## Reference Documentation
Read: `/docs/specs/apps-page-spec.md` - "Feature Specification §6"
Focus: Metric Ranges, Growth, Sentiment, Engagement sections

## Goal
Build collapsible advanced filters panel with metric, growth, sentiment, engagement filters.

## Tasks
1. Create components/AdvancedFiltersPanel.tsx
2. Create filters/MetricRangeFilters.tsx (CCU, Owners, Reviews, Score, Price, Playtime)
3. Create filters/GrowthFilters.tsx with presets
4. Create filters/SentimentFilters.tsx with presets
5. Create filters/EngagementFilters.tsx (Active %, Review Rate, Value Score)
6. Update useAppsFilters and RPC calls

## Success Criteria
- Panel toggles open/closed
- All filters work
- Presets set values correctly
- Active filter count badge accurate
```

---

### MILESTONE 4b: Advanced Filters - Content & Context

```
# Milestone 4b: Advanced Filters - Content, Platform, Release, Relationships

## Reference Documentation
Read: `/docs/specs/apps-page-spec.md` - "Feature Specification §6"
Focus: Content, Platform, Release, Relationship, Activity sections

## Goal
Complete advanced filters, add saved views.

## Tasks
1. Create hooks/useFilterCounts.ts (lazy-load, 5-min cache)
2. Create filters/ContentFilters.tsx (genres, tags, features)
3. Create filters/PlatformFilters.tsx
4. Create filters/ReleaseFilters.tsx
5. Create filters/RelationshipFilters.tsx
6. Create filters/ActivityFilters.tsx
7. Create components/SavedViews.tsx + hooks/useSavedViews.ts

## Success Criteria
- Filter counts load contextually
- All filters work
- Saved views: save, load, delete
```

---

### MILESTONE 5a: Column Customization

```
# Milestone 5a: Column Customization

## Reference Documentation
Read: `/docs/specs/apps-page-spec.md`
- "Feature Specification §5" (Optional Columns - all 25+)

## Goal
Add column selector and implement all optional columns.

## Tasks
1. Create lib/apps-columns.ts (all column definitions with getValue functions)

2. Create components/ColumnSelector.tsx
   - Dropdown with grouped columns (Engagement, Reviews, Growth, Financial, Context, Timeline, Platform, Activity)
   - Persist selection to URL or localStorage

3. Create additional cell components:
   - cells/SentimentCell.tsx (sentiment delta with threshold colors)
   - cells/SteamDeckCell.tsx (verified/playable/unsupported badges)
   - cells/ValueScoreCell.tsx (hrs/$ display)
   - cells/VsPublisherCell.tsx (+/- vs publisher avg)

4. Implement all 25+ optional columns from spec

## Success Criteria
- Column selector dropdown works
- All optional columns render correctly
- Selection persists across page loads
- Column groups are organized logically
```

---

### MILESTONE 5b: Visualizations & Stats

```
# Milestone 5b: Visualizations & Stats

## Reference Documentation
Read: `/docs/specs/apps-page-spec.md`
- "Feature Specification §7" (Visualizations)
- "Feature Specification §10" (Summary Stats)

## Goal
Add lazy-loaded sparklines, summary stats bar, and data freshness footer.

## Tasks
1. Create hooks/useSparklineLoader.ts
   - IntersectionObserver pattern (copy from /companies)
   - Batch fetch sparkline data for visible rows
   - Cache results

2. Create cells/SparklineCell.tsx
   - Use TrendSparkline component
   - Loading skeleton while fetching

3. Create components/SummaryStatsBar.tsx
   - Display: count, avg CCU, avg score, trending up/down counts
   - Momentum/sentiment aggregates
   - Update when filters change

4. Create components/DataFreshnessFooter.tsx
   - Show last data sync time
   - Methodology link

## Success Criteria
- Sparklines lazy-load as rows scroll into view
- Sparklines show 7-day CCU trend
- Summary stats update with filter changes
- Data freshness timestamp displays
```

---

### MILESTONE 6a: Selection & Compare

```
# Milestone 6a: Selection & Compare

## Reference Documentation
Read: `/docs/specs/apps-page-spec.md`
- "Feature Specification §8" (Compare Mode)

## Goal
Add row selection and compare mode for side-by-side game comparison.

## Tasks
1. Create hooks/useAppsSelection.ts
   - Track selected appids
   - Shift+click range selection
   - Max 50 selections

2. Create components/BulkActionsBar.tsx
   - Shows when items selected
   - "Compare" and "Export" buttons
   - Clear selection button

3. Create hooks/useAppsCompare.ts
   - URL state: ?compare=730,1245620,553850
   - Validate 2-5 games selected

4. Create components/CompareMode.tsx
   - Modal with side-by-side metrics
   - "vs Avg" column showing deviation from mean
   - Best/worst highlighted per row
   - Title: "Compare Games"

5. Create lib/apps-compare.ts
   - Comparison metric calculations
   - Formatting helpers

## Success Criteria
- Checkbox selection works
- Shift+click selects range
- Compare opens with 2-5 games
- All metrics shown in comparison
- Best/worst highlighted per row
- Compare URL is shareable
```

---

### MILESTONE 6b: Export & Polish

```
# Milestone 6b: Export & Polish

## Reference Documentation
Read: `/docs/specs/apps-page-spec.md`
- "Feature Specification §9" (Export)
- "Reference Data > User-Facing Naming Convention"

## Goal
Add export functionality and final polish.

## Tasks
### Export
1. Create components/ExportDialog.tsx
   - Title: "Export Games"
   - Format: CSV or JSON radio
   - Scope: Filtered results or Selected only
   - Columns: Visible only or All
   - Include methodology notes checkbox

2. Create lib/apps-export.ts
   - CSV generation with proper escaping
   - JSON generation
   - Filename with timestamp

### Polish
3. Create components/EmptyState.tsx
   - Text: "No games match your filters"
   - Suggest clearing filters

4. Add row actions menu (view details, pin, etc.)

5. Performance optimization
   - Verify page load < 2s
   - Verify filter change < 500ms
   - Profile and fix any bottlenecks

6. Final testing
   - All user-facing text uses "Games" (not "Apps")
   - No console errors
   - Mobile responsive

## User-Facing Text Checklist
- [ ] Page header says "Games"
- [ ] Compare modal title: "Compare Games"
- [ ] Export dialog title: "Export Games"
- [ ] Empty state: "No games match your filters"
- [ ] Type toggle: "All Types", "Games", "DLC", "Demos"

## Success Criteria
- Export CSV/JSON works
- Empty state displays when no results
- Page load < 2s
- Filter change < 500ms
- No console errors
- All naming conventions correct
```

---

## Progress Tracker Template

Create at `/docs/specs/apps-page-progress.md`:

```markdown
# Games Page Implementation Progress

> **Spec Version:** 1.1 (revised Jan 2026)
> **User-Facing:** "Games" | **Technical:** "apps"
> **Reference:** /companies page (v2.5)
> **Started:** _______________

## Naming Convention
- Page header: "Games"
- Type toggle: "All Types", "Games", "DLC", "Demos"
- Code/files/route: "apps"

## Milestone Status (11 Milestones)

| Milestone | Description | Status | Completed |
|-----------|-------------|--------|-----------|
| M0 | Setup & Verification | ⬜ | — |
| M1 | Database Foundation (+ growth columns) | ⬜ | — |
| M2a | Page Structure | ⬜ | — |
| M2b | Table & Columns | ⬜ | — |
| M3 | Search, Presets, Quick Filters | ⬜ | — |
| M4a | Advanced Filters - Metrics | ⬜ | — |
| M4b | Advanced Filters - Content | ⬜ | — |
| M5a | Column Customization | ⬜ | — |
| M5b | Visualizations & Stats | ⬜ | — |
| M6a | Selection & Compare | ⬜ | — |
| M6b | Export & Polish | ⬜ | — |

## Critical Finding (Pre-Implementation)
> **Growth columns `ccu_growth_7d` and `ccu_growth_30d` do NOT exist in `ccu_tier_assignments`.**
> M1 must add these columns via migration before creating RPCs.

## Data Sources Verified (M0)
- [ ] ccu_tier_assignments - NOTE: growth columns need to be ADDED
- [ ] app_trends has sentiment columns
- [ ] review_velocity_stats has velocity columns
- [ ] publisher_metrics has avg_review_score

## Components Located (M0)
- [ ] GrowthCell: _______________
- [ ] MethodologyTooltip: _______________
- [ ] TrendSparkline: _______________

## Session Log

### Session 1 - YYYY-MM-DD
- Milestone: M0
- Work done:
- Next steps:

## Performance Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Page load | <2s | |
| Filter change | <500ms | |
| Fast path query | <500ms | |

## Deviations from Spec

| Milestone | Deviation | Reason |
|-----------|-----------|--------|

## Test Queries
```sql
-- Verify growth columns exist (after M1)
SELECT appid, ccu_growth_7d_percent, ccu_growth_30d_percent
FROM ccu_tier_assignments WHERE ccu_growth_7d_percent IS NOT NULL LIMIT 5;

-- Test main RPC
SELECT * FROM get_apps_with_filters() LIMIT 5;
SELECT * FROM get_apps_with_filters(p_min_momentum := 10) LIMIT 5;
```
```

---

*End of Master Specification v1.1 (revised Jan 2026)*
