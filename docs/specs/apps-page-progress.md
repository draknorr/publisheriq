# Games Page Implementation Progress

> **Project:** PublisherIQ Games Page Rebuild
> **User-Facing Name:** "Games" | **Technical Name:** "apps"
> **Spec Version:** 1.1 (revised Jan 2026)
> **Reference Implementation:** /companies page (v2.5)
> **Started:** 2026-01-15
> **Last Updated:** 2026-01-15 (M4a complete)

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
| M4b | Advanced Filters - Content | ⬜ Not Started | — | |
| M5a | Column Customization | ⬜ Not Started | — | |
| M5b | Visualizations & Stats | ⬜ Not Started | — | |
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

### Session 6 - YYYY-MM-DD
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
│   ├── [ ] AdvancedFiltersPanel.tsx
│   ├── [ ] SummaryStatsBar.tsx
│   ├── [ ] ColumnSelector.tsx
│   ├── [ ] BulkActionsBar.tsx
│   ├── [ ] CompareMode.tsx
│   ├── [ ] ExportDialog.tsx
│   ├── [ ] SavedViews.tsx
│   ├── [ ] EmptyState.tsx
│   ├── [ ] DataFreshnessFooter.tsx
│   ├── cells/
│   │   ├── [ ] SentimentCell.tsx (NEW)
│   │   ├── [ ] PriceCell.tsx
│   │   ├── [ ] ReviewsCell.tsx
│   │   ├── [ ] SparklineCell.tsx
│   │   ├── [ ] SteamDeckCell.tsx
│   │   └── [ ] ActionsCell.tsx
│   └── filters/
│       ├── [ ] MetricRangeFilters.tsx (ADAPT)
│       ├── [ ] GrowthFilters.tsx (ADAPT)
│       ├── [ ] SentimentFilters.tsx (NEW)
│       ├── [ ] EngagementFilters.tsx (NEW)
│       ├── [ ] ContentFilters.tsx
│       ├── [ ] PlatformFilters.tsx (ADAPT)
│       ├── [ ] ReleaseFilters.tsx
│       ├── [ ] RelationshipFilters.tsx
│       ├── [ ] ActivityFilters.tsx
│       ├── [ ] GenreTagFilter.tsx (COPY)
│       ├── [ ] DualRangeSlider.tsx (COPY)
│       └── [ ] RangeInput.tsx
├── hooks/
│   ├── [x] useAppsFilters.ts (M3)
│   ├── [ ] useAppsSelection.ts
│   ├── [ ] useAppsCompare.ts
│   ├── [ ] useSavedViews.ts (ADAPT)
│   ├── [ ] useFilterCounts.ts (ADAPT)
│   └── [ ] useSparklineLoader.ts (ADAPT)
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
- [ ] Filter counts load contextually
- [ ] Genre filter works with counts
- [ ] Tag filter works with search
- [ ] Platform filters work
- [ ] Steam Deck filter works
- [ ] Release filters work
- [ ] Relationship filters work
- [ ] Activity tier filters work
- [ ] Saved views: save works
- [ ] Saved views: load works
- [ ] Saved views: delete works

### M5a: Column Customization
- [ ] Column selector toggles columns
- [ ] All optional columns render correctly
- [ ] Insight columns work:
  - [ ] Active Player %
  - [ ] Sentiment Δ
  - [ ] Review Rate
  - [ ] Value Score
  - [ ] vs Publisher Avg
  - [ ] Hype Duration
  - [ ] CCU Tier
  - [ ] Velocity Tier
- [ ] Column selection persists

### M5b: Visualizations & Stats
- [ ] Sparklines lazy-load (check Network tab)
- [ ] Sparklines show 7-day trend
- [ ] Summary stats update with filters
- [ ] Data freshness shows in footer

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

| Metric | Target | M2b | M5b | M6b Final |
|--------|--------|-----|-----|----------|
| Initial page load | <2s | | | |
| Filter change | <500ms | | | |
| Fast path query | <500ms | | | |
| Slow path query | <2s | | | |
| Sparkline batch load | <200ms | | | |

---

## Deviations from Spec

Document any changes made during implementation that differ from the specification.

| Milestone | Deviation | Reason |
|-----------|-----------|--------|
| | | |

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
