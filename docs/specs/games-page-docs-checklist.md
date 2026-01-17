# Games Page Documentation Update Checklist

> **Task:** Update all documentation for the Games page (/apps) project
> **Reference Plan:** `~/.claude/plans/agile-growing-snail.md`
> **Created:** 2026-01-16
> **Completed:** 2026-01-16

---

## NEW FILES TO CREATE

### 1. Release Notes
**File:** `/docs/releases/v2.6-games-page.md`
**Template:** `/docs/releases/v2.5-companies-page.md`
**Status:** [x] Complete

Content to include:
- [ ] Overview with highlights table
- [ ] Unified Games Page feature (type toggle, default view)
- [ ] 12 Preset Views table (top_games, rising_stars, hidden_gems, new_releases, breakout_hits, high_momentum, comeback_stories, evergreen, true_gems, best_value, publishers_best, f2p_leaders)
- [ ] 12 Quick Filters table (popular, trending, well_reviewed, free, indie, steam_deck, momentum_up, sentiment_up, workshop, early_access, on_sale, this_week)
- [ ] 33 Columns across 9 categories
- [ ] 6 Computed Insight Metrics with formulas (Momentum, Sentiment Delta, Active Player %, Review Rate, Value Score, vs Publisher Avg)
- [ ] Compare Mode (2-5 games)
- [ ] Export (CSV/JSON)
- [ ] Database Changes section (4 RPCs, 7 MVs, indexes)
- [ ] 9 Migrations list
- [ ] Components list (62+ files)
- [ ] 8 Hooks list
- [ ] Performance optimizations
- [ ] Files summary

---

### 2. Architecture Doc
**File:** `/docs/architecture/games-page.md`
**Template:** `/docs/architecture/companies-page.md`
**Status:** [x] Complete

Content to include:
- [ ] Overview with key capabilities
- [ ] Component hierarchy (ASCII tree of 62+ files)
- [ ] Data flow diagram (server → client)
- [ ] State management (URL-first architecture)
- [ ] Hook details (useAppsFilters, useAppsSelection, useAppsCompare, useSavedViews)
- [ ] Database layer (RPCs with performance metrics)
- [ ] Two-path optimization explanation
- [ ] Pre-computed content arrays (app_filter_data MV)
- [ ] GIN indexes list
- [ ] Filtering system (9 categories, URL schema)
- [ ] Column system (33 columns, sort mapping)
- [ ] Performance considerations
- [ ] File reference with LOC

---

### 3. User Guide
**File:** `/docs/guides/games-page.md`
**Status:** [x] Complete

Content to include:
- [ ] Overview (what page does, /apps route vs "Games" name)
- [ ] Navigation (type toggle explanation)
- [ ] Using Presets (12 presets with use cases)
- [ ] Using Quick Filters (12 filters, stacking behavior)
- [ ] Advanced Filters (9 categories explained)
- [ ] Column Customization
- [ ] Compare Mode (how to use, sharing URLs)
- [ ] Export functionality
- [ ] Saved Views
- [ ] Tips & Tricks

---

## EXISTING FILES TO UPDATE

### 4. Spec Document
**File:** `/docs/specs/apps-page-spec.md`
**Status:** [x] Complete

Changes to make:
- [ ] Add header: "**Status:** Implementation Complete (January 16, 2026)"
- [ ] Update migration count to 9 (not 8)
- [ ] Add "Performance Achieved" section with actual metrics
- [ ] Add "Implementation Notes" section (7 MVs, 3-day growth windows, LATERAL join)

---

### 5. Progress Document
**File:** `/docs/specs/apps-page-progress.md`
**Status:** [x] Complete

Changes to make:
- [ ] Add "**Status:** COMPLETE" header
- [ ] Update "Last Updated" date
- [ ] Fill in all verification checkboxes
- [ ] Complete Performance Metrics table with actual values
- [ ] Add "Final Notes" section

---

### 6. CLAUDE.md
**File:** `/CLAUDE.md` (root)
**Status:** [x] Complete

Changes to make:
- [ ] Add "Games Page (v2.6)" section after "Companies Page (v2.5)"
- [ ] Include feature table (Type Toggle, Presets, Quick Filters, Advanced Filters, Columns, Computed Metrics, Compare Mode, Export, Saved Views)
- [ ] Add RPC Functions table (get_apps_with_filters, get_apps_aggregate_stats, get_app_sparkline_data, get_apps_filter_option_counts)
- [ ] Add files location reference
- [ ] Update "Monorepo Structure" section with apps/ folder
- [ ] Update "Database Schema" with new MVs

---

### 7. Database Schema Doc
**File:** `/docs/architecture/database-schema.md`
**Status:** [x] Complete

Changes to make:
- [ ] Add "Games Page Materialized Views" section with 7 MVs:
  - app_filter_data (6hr refresh)
  - mv_tag_counts (daily)
  - mv_genre_counts (daily)
  - mv_category_counts (daily)
  - mv_steam_deck_counts (daily)
  - mv_ccu_tier_counts (daily)
  - mv_apps_aggregate_stats (daily)
- [ ] Add new indexes section

---

### 8. Admin Dashboard Doc
**File:** `/docs/architecture/admin-dashboard.md`
**Status:** [x] Complete

Changes to make:
- [ ] Add /apps route to routes section
- [ ] Add /apps/[appid] route
- [ ] Add cross-reference to games-page.md

---

## KEY DATA REFERENCE

### Migrations (9 total)
```
20260116000001_add_growth_to_ccu_tiers.sql
20260116000002_apps_page_rpcs.sql
20260116000003_apps_rpc_bugfixes.sql
20260117000001_app_filter_data_view.sql
20260117000002_apps_rpc_v2.sql
20260117000003_apps_performance_indexes.sql
20260117000004_apps_rpc_playtime_fix.sql
20260117000005_apps_filter_counts_optimization.sql
20260117000006_fix_ccu_growth_calculation.sql
```

### Materialized Views (7)
```
app_filter_data          - Content filtering arrays (6hr refresh)
mv_tag_counts            - Tag counts by type (daily)
mv_genre_counts          - Genre counts by type (daily)
mv_category_counts       - Category counts by type (daily)
mv_steam_deck_counts     - Steam Deck counts by type (daily)
mv_ccu_tier_counts       - CCU tier counts by type (daily)
mv_apps_aggregate_stats  - Pre-computed stats by type (daily)
```

### RPC Functions (4)
```
get_apps_with_filters()        - Main query (~200ms fast, ~4s slow path)
get_apps_aggregate_stats()     - Summary statistics
get_app_sparkline_data()       - CCU time-series
get_apps_filter_option_counts() - Filter dropdown counts
```

### Computed Metrics (6)
| Metric | Formula |
|--------|---------|
| Momentum Score | (growth_7d + velocity_acceleration) / 2 |
| Sentiment Delta | current_positive_ratio - previous_positive_ratio |
| Active Player % | (ccu_peak / owners_midpoint) × 100 |
| Review Rate | (reviews / owners_midpoint) × 1000 |
| Value Score | playtime_hours / price_dollars |
| vs Publisher Avg | game_score - publisher_avg_score |

### Performance Achieved
| Operation | Target | Actual |
|-----------|--------|--------|
| Page load | <2s | ~200ms |
| Fast path query | <500ms | ~200ms |
| Slow path query | <2s | ~4s |
| Filter counts | <500ms | <10ms |
| Aggregate stats | <500ms | <10ms |

### File Counts
- Frontend files: 62+
- Components: 18
- Cells: 8
- Filters: 11
- Hooks: 8
- Lib files: 8

### Template Files to Reference
- `/docs/releases/v2.5-companies-page.md` - Release notes format
- `/docs/architecture/companies-page.md` - Architecture doc format

### Source Files for Accurate Data
- `/apps/admin/src/app/(main)/apps/lib/apps-presets.ts` - Presets & quick filters
- `/apps/admin/src/app/(main)/apps/lib/apps-columns.ts` - 33 column definitions
- `/apps/admin/src/app/(main)/apps/lib/apps-types.ts` - TypeScript interfaces
- `/supabase/migrations/2026011*.sql` - All migrations

---

## VERIFICATION

After completing all docs:
- [x] Check all internal markdown links resolve
- [x] Verify file counts are consistent across docs
- [x] Verify migration list is consistent (9 migrations)
- [x] Verify RPC list is consistent (4 RPCs)
- [x] All 12 presets documented
- [x] All 12 quick filters documented
- [x] All 33 columns listed
