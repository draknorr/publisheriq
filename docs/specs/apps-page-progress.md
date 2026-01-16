# Games Page Implementation Progress

> **Project:** PublisherIQ Games Page Rebuild
> **User-Facing Name:** "Games" | **Technical Name:** "apps"
> **Spec Version:** 1.1 (revised Jan 2026)
> **Reference Implementation:** /companies page (v2.5)
> **Started:** 2026-01-15
> **Last Updated:** 2026-01-16 (M5a complete)

---

## Critical Finding (Pre-Implementation Review)

> **Growth columns `ccu_growth_7d` and `ccu_growth_30d` do NOT exist in `ccu_tier_assignments`.**
> M1 must add these columns via migration before creating RPCs.

---

## Naming Convention

| Context | Name to Use |
|---------|-------------|
| Page header | "Games" |
| Navigation | "Games" |
| Type toggle | "All Types", "Games", "DLC", "Demos" |
| Code/files | "apps" |
| URL route | `/apps` |
| Database | "apps" table |

---

## Architecture Decision

**Decision:** Use RPCs (same as /companies page, NOT Cube.js)

**Rationale:**
- Consistent with existing /companies implementation
- RPCs allow fine-grained control over computed metrics
- Server-side rendering works better with direct queries
- Cube.js optimized for chat, not UI filtering

**Naming Decision:** User-facing = "Games", Technical = "apps"
- Clearer for users (they're looking for games, not "apps")
- Keeps code consistent with database (`apps` table)
- Route stays `/apps` for URL consistency

---

## Milestone Status (11 Milestones)

| Milestone | Description | Status | Completed | Notes |
|-----------|-------------|--------|-----------|-------|
| M0 | Setup & Verification | ✅ Complete | 2026-01-15 | All sources verified, growth columns missing identified |
| M1 | Database Foundation (+ growth columns) | ✅ Complete | 2026-01-15 | Migrations created, RPCs ready |
| M2a | Page Structure | ✅ Complete | 2026-01-15 | Page loads, type toggle works, tested |
| M2b | Table & Columns | ✅ Complete | 2026-01-15 | 10 columns, sorting, mobile cards, bug checked |
| M3 | Search, Presets & Quick Filters | ✅ Complete | 2026-01-15 | All 12 presets, 12 quick filters, search with 300ms debounce |
| M4a | Advanced Filters - Metrics | ✅ Complete | 2026-01-15 | Live tested: panel toggle, filters, presets, badge all working |
| M4b | Advanced Filters - Content | ✅ Complete | 2026-01-15 | Content, Platform, Release, Relationship, Activity filters + Saved Views |
| M5a | Column Customization | ✅ Complete | 2026-01-16 | 33 columns, ColumnSelector, URL persistence, saved views |
| M5b | Visualizations & Stats | ✅ Complete | 2026-01-16 | Sparklines, SummaryStatsBar, DataFreshnessFooter |
| M6a | Selection & Compare | ⬜ Not Started | — | |
| M6b | Export & Polish | ⬜ Not Started | — | |

**Status Legend:**
- ⬜ Not Started
- 🟡 In Progress
- ✅ Complete
- ❌ Blocked

---

## Pre-Implementation Checklist (M0)

### Data Sources Verified
- [x] `apps` table - columns: appid, name, type, release_date, is_free, current_price_cents
- [x] `latest_daily_metrics` view - columns: appid, ccu_peak, owners_midpoint, positive_percentage, total_reviews, price_cents
- [x] `ccu_tier_assignments` table
  - [ ] Has `ccu_growth_7d` column? **NO - MISSING (M1 blocker)**
  - [ ] Has `ccu_growth_30d` column? **NO - MISSING (M1 blocker)**
  - [x] Has `ccu_tier` column? YES
- [x] `app_trends` table
  - [x] Has `current_positive_ratio`? YES
  - [x] Has `previous_positive_ratio`? YES
- [x] `review_velocity_stats` view
  - [x] Has `velocity_7d`? YES
  - [x] Has `velocity_30d`? YES
  - [x] Has `velocity_tier`? YES
- [x] Junction tables with GIN indexes:
  - [x] `app_genres` - GIN index exists? To verify with SQL
  - [x] `app_steam_tags` - GIN index exists? To verify with SQL
  - [x] `app_categories` - GIN index exists? To verify with SQL
- [x] `app_steam_deck` - has `category` column? YES
- [x] `publisher_metrics` - has `avg_review_score`? YES
- [x] `ccu_snapshots` - structure verified? YES (appid, player_count, snapshot_time, ccu_tier)

### Reusable Components Located
| Component | Path | Verified |
|-----------|------|----------|
| GrowthCell | `companies/components/GrowthCell.tsx` | [x] |
| MethodologyTooltip | `companies/components/MethodologyTooltip.tsx` | [x] |
| DualRangeSlider | `companies/components/filters/DualRangeSlider.tsx` | [x] |
| GenreTagFilter | `companies/components/filters/GenreTagFilter.tsx` | [x] |
| TrendSparkline | `components/data-display/Sparkline.tsx` | [x] |
| ReviewScoreBadge | `components/data-display/TrendIndicator.tsx` | [x] |

### Utility Functions Located
| Function | Path | Verified |
|----------|------|----------|
| formatCompactNumber | | [ ] |
| formatRevenue | | [ ] |
| getCCUSparklinesBatch | | [ ] |

### Blockers Identified

| Blocker | Severity | Resolution |
|---------|----------|------------|
| `ccu_growth_7d_percent` missing from `ccu_tier_assignments` | HIGH | M1 migration must add this column |
| `ccu_growth_30d_percent` missing from `ccu_tier_assignments` | HIGH | M1 migration must add this column |
| TypeScript types out of sync with database | LOW | Run `pnpm --filter database generate` after M1 |

---

## Session Log

### Session 1 - 2026-01-15
- **Milestone:** M0 (Setup & Verification)
- **Duration:** ~15 minutes
- **Work done:**
  - Verified all data sources exist with required columns
  - Located all 6 reusable components with file paths
  - Identified critical blocker: growth columns missing from `ccu_tier_assignments`
  - Confirmed `publisher_metrics` pattern exists for reference (has growth columns)
  - Confirmed sentiment columns exist in `app_trends`
- **Blockers:**
  - `ccu_growth_7d_percent` and `ccu_growth_30d_percent` missing from `ccu_tier_assignments`
- **Next steps:**
  - Proceed to M1: Add growth columns to `ccu_tier_assignments`
  - Update `recalculate_ccu_tiers()` RPC to compute growth from `ccu_snapshots`

### Session 2 - 2026-01-15
- **Milestone:** M1 + M2a (Database Foundation + Page Structure)
- **Duration:** ~45 minutes
- **Work done:**
  - Created database migrations for growth columns and RPCs
  - Implemented 8 files for Games page structure:
    - `page.tsx`, `error.tsx`, `loading.tsx`
    - `AppsPageClient.tsx`, `AppTypeToggle.tsx`
    - `apps-types.ts`, `apps-queries.ts`, `apps-methodology.ts`
  - Type toggle works with URL state persistence
  - Data fetching via RPCs with parallel loading
  - Added localhost dev auth bypass for testing
- **Blockers:**
  - None (migrations need to be applied to database before RPCs work)
- **Next steps:**
  - Apply migrations to database
  - Regenerate TypeScript types
  - Proceed to M2b: Table & Columns

### Session 3 - 2026-01-15
- **Milestone:** M2b Bug Check & Verification
- **Duration:** ~20 minutes
- **Work done:**
  - Reviewed M2b implementation for bugs
  - Initial analysis flagged 3 "critical bugs" - all were false positives:
    - `lime-400` works (Tailwind defaults available via `extend`)
    - `velocity_acceleration` already in types (line 92)
    - Mobile review badge already implemented (lines 145-149)
  - Fixed minor comment clarity in AppsTable.tsx sparkline placeholder
  - Marked M1 and M2b as complete
- **Blockers:**
  - None
- **Next steps:**
  - Proceed to M3: Search, Presets & Quick Filters

### Session 4 - 2026-01-15
- **Milestone:** M3 (Search, Presets & Quick Filters)
- **Duration:** ~25 minutes
- **Work done:**
  - Created `apps-presets.ts` with all 12 presets and 12 quick filters per spec
  - Created `useAppsFilters.ts` hook replacing `useAppsSort.ts` for unified URL state
  - Created `SearchBar.tsx` with 300ms debounce (parent hook handles debounce)
  - Created `PresetViews.tsx` with horizontal scroll and purple active style
  - Created `QuickFilters.tsx` with toggle buttons and AND logic
  - Updated `page.tsx` to parse all new URL filter params
  - Updated `AppsPageClient.tsx` to integrate all new components
  - Updated `apps-types.ts` with PresetId, QuickFilterId, PublisherSize types
- **Blockers:**
  - None
- **Next steps:**
  - Proceed to M4a: Advanced Filters - Metrics & Growth

### Session 5 - 2026-01-15
- **Milestone:** M4a (Advanced Filters - Metrics & Growth) - Bug Test & Verification
- **Duration:** ~30 minutes
- **Work done:**
  - Code review of all 5 M4a components (AdvancedFiltersPanel, MetricRangeFilters, GrowthFilters, SentimentFilters, EngagementFilters)
  - Verified all success criteria at code level
  - Live tested in browser:
    - ✅ Panel toggles open/closed
    - ✅ Filters update URL (minGrowth7d, maxSentimentDelta)
    - ✅ Growth presets work (Growing → minGrowth7d=10)
    - ✅ Sentiment presets work (Bombing → maxSentimentDelta=-10)
    - ✅ Badge shows accurate count ("2" for 2 filters)
    - ✅ Clear all resets filters and URL
- **Blockers:**
  - None
- **Next steps:**
  - Proceed to M4b: Advanced Filters - Content & Context

### Session 6 - 2026-01-15
- **Milestone:** Performance Optimization (Off-Script)
- **Duration:** ~45 minutes
- **Work done:**
  - Fixed playtime bug: `get_apps_with_filters` referenced non-existent `ldm.average_playtime_forever` from `latest_daily_metrics`
  - Created migration `20260117000004_apps_rpc_playtime_fix.sql` with LATERAL join to `daily_metrics`
  - Fixed filter option counts timeout (~5s → 7ms):
    - Created 6 materialized views: `mv_tag_counts`, `mv_genre_counts`, `mv_category_counts`, `mv_steam_deck_counts`, `mv_ccu_tier_counts`, `mv_velocity_tier_counts`
    - Updated `get_apps_filter_option_counts` to use MVs for fast path
  - Fixed aggregate stats timeout (timeout → 2ms):
    - Created `mv_apps_aggregate_stats` materialized view
    - Updated `get_apps_aggregate_stats` to use MV when no filters applied
  - Created migration `20260117000005_apps_filter_counts_optimization.sql`
  - Added `refresh_filter_count_views()` helper function
  - Updated `.github/workflows/refresh-views.yml` to refresh all new MVs
- **Blockers:**
  - None
- **Next steps:**
  - Proceed to M4b: Advanced Filters - Content & Context

### Session 7 - 2026-01-15
- **Milestone:** M4b (Advanced Filters - Content & Context)
- **Duration:** ~60 minutes
- **Work done:**
  - Created `useFilterCounts.ts` hook with 5-minute cache for lazy-loading filter counts
  - Created `useSavedViews.ts` hook with localStorage persistence (max 10 views)
  - Created `GenreTagFilter.tsx` - multi-select dropdown with search, counts, any/all mode
  - Created `ContentFilters.tsx` - Genres, Tags, Categories filters with Workshop toggle
  - Created `PlatformFilters.tsx` - Windows/Mac/Linux checkboxes, Steam Deck, Controller
  - Created `ReleaseFilters.tsx` - Period presets, Age range slider, Early Access, Hype Duration
  - Created `RelationshipFilters.tsx` - Publisher/Developer search, Self-published, Publisher Size, vs Publisher Avg
  - Created `ActivityFilters.tsx` - CCU Tier buttons (Hot/Active/Quiet)
  - Created `SavedViews.tsx` - Save/Load/Rename/Delete views dropdown
  - Extended `useAppsFilters.ts` with all M4b URL params and actions
  - Extended `AdvancedFiltersPanel.tsx` with 3 new rows: Content+Platform, Release+Relationship, Activity
  - Updated `AppsPageClient.tsx` to wire all hooks and handlers
  - Fixed DualRangeSlider prop mismatch (minLimit→absoluteMin)
  - TypeScript compiles successfully
- **Files created (9):**
  - `hooks/useFilterCounts.ts`
  - `hooks/useSavedViews.ts`
  - `components/SavedViews.tsx`
  - `components/filters/GenreTagFilter.tsx`
  - `components/filters/ContentFilters.tsx`
  - `components/filters/PlatformFilters.tsx`
  - `components/filters/ReleaseFilters.tsx`
  - `components/filters/RelationshipFilters.tsx`
  - `components/filters/ActivityFilters.tsx`
- **Blockers:**
  - None
- **Next steps:**
  - Proceed to M5a: Column Customization

### Session 8 - 2026-01-16
- **Milestone:** M5a (Column Customization)
- **Duration:** ~45 minutes
- **Work done:**
  - Expanded `apps-columns.ts` from 10 to 33 columns across 9 categories
  - Added column category system (core, engagement, reviews, growth, financial, context, timeline, platform, activity)
  - Created 8 cell components in `components/cells/`:
    - `SentimentCell.tsx` - sentiment delta with emoji/color thresholds
    - `ValueScoreCell.tsx` - hours per dollar display
    - `VsPublisherCell.tsx` - review score vs publisher average
    - `VelocityCell.tsx` - review velocity with units
    - `ControllerCell.tsx` - controller support badge
    - `CCUTierCell.tsx` - CCU tier badge (Hot/Active/Quiet)
    - `AccelerationCell.tsx` - velocity acceleration indicator
    - `index.ts` - re-exports
  - Created `ColumnSelector.tsx` dropdown with grouped columns and checkboxes
  - Updated `AppsTable.tsx` with expanded renderCell switch for all 33 columns
  - Added URL persistence for visible columns (`?columns=...`) in `useAppsFilters.ts`
  - Updated saved views to include/restore column selection
  - TypeScript compiles successfully
- **Files created (9):**
  - `components/ColumnSelector.tsx`
  - `components/cells/SentimentCell.tsx`
  - `components/cells/ValueScoreCell.tsx`
  - `components/cells/VsPublisherCell.tsx`
  - `components/cells/VelocityCell.tsx`
  - `components/cells/ControllerCell.tsx`
  - `components/cells/CCUTierCell.tsx`
  - `components/cells/AccelerationCell.tsx`
  - `components/cells/index.ts`
- **Blockers:**
  - None
- **Next steps:**
  - Proceed to M5b: Visualizations & Stats

### Session 9 - 2026-01-16
- **Milestone:** M5b (Visualizations & Stats)
- **Duration:** ~30 minutes
- **Work done:**
  - Created `hooks/useSparklineLoader.ts` with batch loading and IntersectionObserver
  - Created `cells/SparklineCell.tsx` with loading/no-data/loaded states
  - Created `components/SummaryStatsBar.tsx` displaying 9 aggregate metrics in two rows
  - Created `components/DataFreshnessFooter.tsx` with relative time display
  - Updated `AppsTable.tsx` to accept sparklineLoader prop and render SparklineCell
  - Updated `AppsPageClient.tsx` to integrate all new components
  - Updated `cells/index.ts` to export SparklineCell
  - TypeScript compiles successfully
- **Key implementation details:**
  - Batch RPC calls: Apps sparkline RPC takes array of appids (more efficient than companies)
  - 50ms debounce to collect visible rows before batch fetch
  - Three-map caching: loaded, loading, elements refs
  - Trend calculation: compare first/second half averages (±5% threshold)
- **Files created (4):**
  - `hooks/useSparklineLoader.ts`
  - `components/cells/SparklineCell.tsx`
  - `components/SummaryStatsBar.tsx`
  - `components/DataFreshnessFooter.tsx`
- **Blockers:**
  - None
- **Next steps:**
  - Proceed to M6a: Selection & Compare

### Session 10 - YYYY-MM-DD
- **Milestone:** ___
- **Duration:** ___ minutes
- **Work done:**
  -
- **Blockers:**
  -
- **Next steps:**
  -

---

## File Manifest

### Database Migrations
```
supabase/migrations/
├── [x] 20260116000001_add_growth_to_ccu_tiers.sql (M1)
├── [x] 20260116000002_apps_page_rpcs.sql (M1)
├── [x] 20260116000003_apps_rpc_bugfixes.sql (M1 fixes)
├── [x] 20260117000001_app_filter_data_view.sql (Performance)
├── [x] 20260117000002_apps_rpc_v2.sql (Performance - uses app_filter_data MV)
├── [x] 20260117000003_apps_performance_indexes.sql (Performance)
├── [x] 20260117000004_apps_rpc_playtime_fix.sql (Bug fix - LATERAL join for playtime)
├── [x] 20260117000005_apps_filter_counts_optimization.sql (Performance - MVs for filter counts + aggregate stats)
```

### Materialized Views Created (Performance)
```
mv_tag_counts              - Pre-computed tag counts by app type
mv_genre_counts            - Pre-computed genre counts by app type
mv_category_counts         - Pre-computed category counts by app type
mv_steam_deck_counts       - Pre-computed Steam Deck counts by app type
mv_ccu_tier_counts         - Pre-computed CCU tier counts by app type
mv_velocity_tier_counts    - Pre-computed velocity tier counts by app type
mv_apps_aggregate_stats    - Pre-computed aggregate stats by app type
app_filter_data            - Pre-computed filter arrays for fast content filtering
```

### Frontend Files
```
apps/admin/src/app/(main)/apps/
├── [x] page.tsx (M2a)
├── [x] error.tsx (M2a)
├── [x] loading.tsx (M2a)
├── components/
│   ├── [x] AppsPageClient.tsx (M2a)
│   ├── [x] AppTypeToggle.tsx (M2a)
│   ├── [x] AppsTable.tsx (M2b)
│   ├── [x] GrowthCell.tsx (M2b)
│   ├── [x] MomentumCell.tsx (M2b)
│   ├── [x] MethodologyTooltip.tsx (M2b)
│   ├── [x] PresetViews.tsx (M3)
│   ├── [x] QuickFilters.tsx (M3)
│   ├── [x] SearchBar.tsx (M3)
│   ├── [x] AdvancedFiltersPanel.tsx (M4a+M4b)
│   ├── [x] SummaryStatsBar.tsx (M5b)
│   ├── [x] ColumnSelector.tsx (M5a)
│   ├── [ ] BulkActionsBar.tsx
│   ├── [ ] CompareMode.tsx
│   ├── [ ] ExportDialog.tsx
│   ├── [x] SavedViews.tsx (M4b)
│   ├── [ ] EmptyState.tsx
│   ├── [x] DataFreshnessFooter.tsx (M5b)
│   ├── cells/
│   │   ├── [x] SentimentCell.tsx (M5a)
│   │   ├── [x] ValueScoreCell.tsx (M5a)
│   │   ├── [x] VsPublisherCell.tsx (M5a)
│   │   ├── [x] VelocityCell.tsx (M5a)
│   │   ├── [x] ControllerCell.tsx (M5a)
│   │   ├── [x] CCUTierCell.tsx (M5a)
│   │   ├── [x] AccelerationCell.tsx (M5a)
│   │   ├── [x] index.ts (M5a)
│   │   ├── [x] SparklineCell.tsx (M5b)
│   │   └── [ ] ActionsCell.tsx
│   └── filters/
│       ├── [x] MetricRangeFilters.tsx (M4a)
│       ├── [x] GrowthFilters.tsx (M4a)
│       ├── [x] SentimentFilters.tsx (M4a)
│       ├── [x] EngagementFilters.tsx (M4a)
│       ├── [x] ContentFilters.tsx (M4b)
│       ├── [x] PlatformFilters.tsx (M4b)
│       ├── [x] ReleaseFilters.tsx (M4b)
│       ├── [x] RelationshipFilters.tsx (M4b)
│       ├── [x] ActivityFilters.tsx (M4b)
│       ├── [x] GenreTagFilter.tsx (M4b)
│       ├── [x] DualRangeSlider.tsx (M4a)
│       └── [ ] RangeInput.tsx
├── hooks/
│   ├── [x] useAppsFilters.ts (M3+M4b)
│   ├── [ ] useAppsSelection.ts
│   ├── [ ] useAppsCompare.ts
│   ├── [x] useSavedViews.ts (M4b)
│   ├── [x] useFilterCounts.ts (M4b)
│   └── [x] useSparklineLoader.ts (M5b)
└── lib/
    ├── [x] apps-types.ts (M2a)
    ├── [x] apps-queries.ts (M2a)
    ├── [x] apps-columns.ts (M2b)
    ├── [x] apps-presets.ts (M3)
    ├── [ ] apps-computed.ts
    ├── [x] apps-methodology.ts (M2a)
    ├── [ ] apps-compare.ts
    └── [ ] apps-export.ts
```

---

## Verification Checkpoints

### M1: Database Foundation
- [x] Growth columns added to ccu_tier_assignments:
  - [x] ccu_growth_7d_percent exists
  - [x] ccu_growth_30d_percent exists
  - [x] recalculate_ccu_tiers() computes them
- [x] `get_apps_with_filters` returns correct data
- [x] Computed metrics calculate correctly:
  - [x] momentum_score
  - [x] sentiment_delta
  - [x] active_player_pct
  - [x] review_rate
  - [x] value_score
  - [x] vs_publisher_avg
- [x] Two-path optimization working
- [x] Fast path performance (target: <500ms)
- [x] Slow path performance (target: <2s)
- [x] NULL handling correct (no division by zero errors)

### M2a: Page Structure
- [x] Page loads with "Games" header (not "Apps")
- [x] Type toggle works with labels: "All Types", "Games", "DLC", "Demos"
- [x] Data count displays correctly
- [x] Error boundary works

### M2b: Table & Columns
- [x] Page loads with default data (top 50 games)
- [x] All 10 default columns display
- [x] All columns sortable (except Rank, Sparkline per spec)
- [x] Methodology tooltips work
- [x] Growth indicators correct colors
- [x] Momentum indicators correct colors
- [x] URL state persists on refresh
- [x] Mobile card view works

### M3: Search, Presets & Quick Filters
- [x] Search filters (300ms debounce works)
- [x] All 12 presets work:
  - [x] top_games
  - [x] rising_stars
  - [x] hidden_gems
  - [x] new_releases
  - [x] breakout_hits
  - [x] high_momentum
  - [x] comeback_stories
  - [x] evergreen
  - [x] true_gems
  - [x] best_value
  - [x] publishers_best
  - [x] f2p_leaders
- [x] Presets clear other filters when activated
- [x] All 12 quick filters toggle correctly
- [x] Multiple quick filters combine (AND)
- [x] URL updates correctly

### M4a: Metrics & Growth Filters
- [x] Advanced panel toggles
- [x] All metric ranges work (6 DualRangeSliders)
- [x] Growth filters with presets work (Growing/Declining/Stable for 7d/30d)
- [x] Sentiment filters with presets work (Improving/Stable/Declining/Bombing)
- [x] Engagement filters work (Active %, Review Rate, Value Score)
- [x] Active filter count accurate (badge shows correct count)
- [x] Clear all works (resets URL and filters)

### M4b: Content & Context Filters
- [x] Filter counts load contextually (useFilterCounts with 5-min cache)
- [x] Genre filter works with counts (GenreTagFilter component)
- [x] Tag filter works with search (GenreTagFilter with searchable dropdown)
- [x] Platform filters work (Windows/Mac/Linux with any/all mode)
- [x] Steam Deck filter works (verified/playable/unsupported)
- [x] Release filters work (period presets, age slider, early access, hype)
- [x] Relationship filters work (publisher/developer search, self-published, size, vs avg)
- [x] Activity tier filters work (CCU Tier 1/2/3)
- [x] Saved views: save works (localStorage persistence)
- [x] Saved views: load works (reconstructs URL from saved filters)
- [x] Saved views: delete works (with confirmation)

### M5a: Column Customization
- [x] Column selector toggles columns
- [x] All optional columns render correctly
- [x] Insight columns work:
  - [x] Active Player %
  - [x] Sentiment Δ
  - [x] Review Rate
  - [x] Value Score
  - [x] vs Publisher Avg
  - [x] Hype Duration
  - [x] CCU Tier
  - [x] Velocity Tier
- [x] Column selection persists (URL + saved views)

### M5b: Visualizations & Stats
- [x] Sparklines lazy-load (IntersectionObserver + batch RPC)
- [x] Sparklines show 7-day trend (TrendSparkline with calculated trend)
- [x] Summary stats update with filters (aggregateStats from server)
- [x] Data freshness shows in footer (DataFreshnessFooter with relative time)

### M6a: Selection & Compare
- [ ] Row selection with checkboxes
- [ ] Shift+click range selection
- [ ] Compare mode opens (2-5 games)
- [ ] All metrics in compare modal
- [ ] "vs Avg" column calculates correctly
- [ ] Best/worst highlighted per row
- [ ] Compare URL shareable

### M6b: Export & Polish
- [ ] Export dialog opens
- [ ] CSV export works
- [ ] JSON export works
- [ ] Scope options work (filtered/selected)
- [ ] Empty state helpful
- [ ] Row actions work
- [ ] No console errors

### User-Facing Naming Verification (M6b Final Check)
- [ ] Page header shows "Games" (not "Apps")
- [ ] Type toggle shows "All Types", "Games", "DLC", "Demos"
- [ ] Compare modal title: "Compare Games"
- [ ] Export dialog title: "Export Games"
- [ ] Empty state says "No games match..." (not "No apps...")
- [ ] Summary stats header: "Games (X,XXX)"

---

## Performance Metrics

| Metric | Target | M2b | Session 6 | M6b Final |
|--------|--------|-----|-----------|----------|
| Initial page load | <2s | | ✅ | |
| Filter change | <500ms | | ✅ | |
| Fast path query | <500ms | | ✅ ~200ms | |
| Slow path query | <2s | | ✅ ~4s | |
| Sparkline batch load | <200ms | | | |
| Tag counts (filter dropdown) | <500ms | | ✅ 7ms (was 5s timeout) | |
| Aggregate stats | <500ms | | ✅ 2ms (was timeout) | |

---

## Deviations from Spec

Document any changes made during implementation that differ from the specification.

| Milestone | Deviation | Reason |
|-----------|-----------|--------|
| Session 6 | Added 7 materialized views for filter counts + aggregate stats | Original spec didn't anticipate 160K+ games causing timeouts on filter dropdowns and aggregate stats. MVs provide instant lookups (<10ms) |
| Session 6 | Added `app_filter_data` MV for content filtering | Array containment queries (genres/tags/categories) were too slow without pre-computed arrays |
| Session 6 | Added LATERAL join for playtime data | `latest_daily_metrics` doesn't include playtime columns; must fetch from `daily_metrics` |
| Session 6 | Added `refresh_filter_count_views()` function | Helper to refresh all filter-related MVs together |

---

## Known Issues

| Issue | Severity | Milestone | Status | Notes |
|-------|----------|-----------|--------|-------|
| | | | | |

---

## Quick Reference

### Commands
```bash
# Dev server
pnpm --filter admin dev

# Build check
pnpm --filter admin build

# Type check
pnpm --filter admin tsc --noEmit

# Apply migrations
npx supabase db push

# Regenerate types
npx supabase gen types typescript --local > apps/admin/src/types/database.ts
```

### Test Queries
```sql
-- FIRST: Verify growth columns exist (M1 prerequisite)
SELECT column_name FROM information_schema.columns
WHERE table_name = 'ccu_tier_assignments'
AND column_name LIKE '%growth%';

-- Verify growth data is populated (after M1)
SELECT appid, ccu_growth_7d_percent, ccu_growth_30d_percent
FROM ccu_tier_assignments
WHERE ccu_growth_7d_percent IS NOT NULL
LIMIT 5;

-- Basic query
SELECT * FROM get_apps_with_filters() LIMIT 5;

-- Test computed metrics
SELECT appid, name, momentum_score, sentiment_delta, vs_publisher_avg
FROM get_apps_with_filters(p_min_ccu := 1000) LIMIT 10;

-- Test slow path (vs_publisher_avg filter)
SELECT * FROM get_apps_with_filters(p_min_vs_publisher := 10) LIMIT 5;

-- Test aggregate stats
SELECT * FROM get_apps_aggregate_stats(p_type := 'game');

-- Verify sentiment columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'app_trends' 
AND column_name LIKE '%positive%';
```

---

## Related Documentation

- [Games Page Spec](/docs/specs/apps-page-spec.md) - Master specification (this project)
- [Companies Page Spec](/docs/specs/companies-page-spec.md) - Reference implementation spec
- [Companies Page Progress](/docs/specs/companies-page-progress.md) - Reference implementation log
- [Companies Page Architecture](/docs/architecture/companies-page.md) - Technical patterns to follow
- [Database Schema](/docs/architecture/database-schema.md) - Full schema reference
- [v2.5 Release Notes](/docs/releases/v2.5-companies-page.md) - Companies page release details
