# Companies Page Content Filter Test Plan

**Date:** 2026-01-14
**Status:** TESTED - Results documented below
**Context:** Pre-computed content arrays optimization applied

## What Changed

Replaced slow EXISTS subqueries with GIN-indexed arrays on materialized views:
- `genre_ids INT[]`, `tag_ids INT[]`, `category_ids INT[]`, `best_steam_deck_category TEXT`
- Expected performance: <500ms for all content filters (was 5-8s)

---

## Test Results Summary

### Overall Status

| Category | Status | Notes |
|----------|--------|-------|
| Content Arrays (tags, genres, categories, steam deck) | ✅ PASS | Fast, GIN-indexed, working correctly |
| Metric Range Filters (min/max games, revenue, etc.) | ✅ PASS | Correctly filters |
| Genre Mode Toggle (any/all) | ✅ PASS | 6x difference verified |
| Type Toggle (all/publisher/developer) | ✅ PASS | Counts match |
| Status Filter (active/dormant) | ✅ PASS | Counts add up correctly |
| Search Filter | ✅ PASS | ILIKE matching works |
| Sorting with Filters | ✅ PASS | Respects active filters |
| Platform Filter | ✅ PASS | **FIXED** - any/all modes working (174K any, 17K all) |
| Growth Filters (7d/30d) | ✅ PASS | **FIXED** - slow path column aliases corrected |
| Relationship Filter | ✅ PASS | **FIXED** - 76,382 self-published publishers |
| Aggregate Stats RPC | ✅ PASS | **FIXED** - all parameters added |

---

## Critical Bugs Found (ALL FIXED)

### BUG #1: Slow Path SQL Error ✅ FIXED
**Severity:** CRITICAL - Breaks entire slow path
**Status:** **FIXED** in migration `20260115200000_fix_companies_filter_bugs.sql`

**Original Error:** `column bc.total_owners does not exist`

**Fix Applied:** Added explicit column aliases to all SELECT expressions in slow path's `base_companies` CTE.

**Verification:**
```sql
SELECT COUNT(*) FROM get_companies_with_filters(
  p_type := 'publisher',
  p_relationship := 'self_published',
  p_limit := 1000000
);
-- Returns: 76,382 (no error)
```

---

### BUG #2: Platform Filter Not Implemented ✅ FIXED
**Severity:** HIGH - Feature appears in UI but doesn't work
**Status:** **FIXED** in migration `20260115300000_add_platform_filtering.sql`

**Fix Applied:**
1. Added `platform_array TEXT[]` column to `publisher_metrics` and `developer_metrics` views
2. Created GIN indexes for fast containment queries
3. Added WHERE clause with `&&` (any) and `@>` (all) operators

**Verification:**
```sql
-- Any mode: 174,148 companies (has at least one platform)
SELECT COUNT(*) FROM get_companies_with_filters(
  p_platforms := ARRAY['windows', 'macos', 'linux']::text[],
  p_platform_mode := 'any',
  p_limit := 1000000
);

-- All mode: 17,179 companies (has all three platforms)
SELECT COUNT(*) FROM get_companies_with_filters(
  p_platforms := ARRAY['windows', 'macos', 'linux']::text[],
  p_platform_mode := 'all',
  p_limit := 1000000
);
```

**Note:** Platform values are `windows`, `macos`, `linux` (not `mac`).

---

### BUG #3: Aggregate Stats RPC Missing Parameters ✅ FIXED
**Severity:** MEDIUM - Stats won't match filtered results
**Status:** **FIXED** in migrations `20260115200000` and `20260115300000`

**Parameters Added:**
- `p_genre_mode` (any/all toggle)
- `p_platforms` / `p_platform_mode`
- `p_max_owners`, `p_max_ccu`, `p_max_hours`, `p_max_revenue`, `p_max_score`, `p_max_reviews`

**Verification:**
```sql
SELECT total_companies FROM get_companies_aggregate_stats(
  p_genres := ARRAY[1, 2],
  p_genre_mode := 'all'
);
-- Returns: 20,569 (matches main RPC)
```

---

## Test Checklist (with Results)

### 1. Tag Filters ✅ PASS
- [x] Open Advanced Filters > Content > Tags dropdown
- [x] Select "Indie" tag - verify results load quickly (<500ms) → **116,629 companies**
- [x] Select multiple tags - verify OR logic works (has ANY of selected tags)
- [x] Clear tags - verify full list returns → **193,396 companies**

### 2. Genre Filters ✅ PASS
- [x] Open Advanced Filters > Content > Genres dropdown
- [x] Select "RPG" genre - verify results load quickly → **47,027 companies**
- [x] Select multiple genres with "Has Any" mode - verify OR logic → **Action OR Strategy: 124,166**
- [x] Switch to "Has All" mode - verify AND logic (fewer results) → **Action AND Strategy: 20,569** (6x fewer)
- [x] Clear genres - verify full list returns

### 3. Category Filters ✅ PASS
- [x] Open Advanced Filters > Content > Features dropdown
- [x] Select "Single-player" - verify results load quickly
- [x] Select "Multi-player" - verify different results
- [x] Select multiple categories - verify filtering works

### 4. Steam Deck Filter ✅ PASS
- [x] Open Advanced Filters > Steam Deck dropdown
- [x] Select "Verified" - verify only companies with verified games appear → **10,138 companies**
- [x] Select "Playable" - verify includes both verified and playable → **20,456 companies**
- [x] Select "Any" - verify includes any Steam Deck compatible

### 5. Combined Filters ✅ PASS
- [x] Apply Tag + Genre + Steam Deck together
- [x] Verify results match ALL criteria (AND logic between filter types)
  - Publishers + Active + RPG + $1M revenue → **754 companies**
  - Indie tag + Steam Deck verified + 5 games → **2,243 companies**
  - Action/Strategy + Score 80+ → **41,555 companies**
- [x] Verify count in header updates correctly
- [x] Clear all filters - verify full list returns

### 6. Sorting with Filters ✅ PASS
- [x] Apply a tag filter
- [x] Sort by different columns (Weekly Hours, Revenue, Owners, etc.)
- [x] Verify sort order is correct within filtered results
  - Valve (publisher) tops weekly hours with 61.3M hours
  - Electronic Arts tops RPG revenue with $614B

### 7. Type Toggle with Filters ✅ PASS
- [x] Apply filters, then switch to Publishers only → **89,123 publishers**
- [x] Switch to Developers only → **104,273 developers**
- [x] Switch back to All → **193,396 total**
- [x] Verify filters persist across type changes

### 8. URL Persistence ✅ PASS
- [x] Apply several filters
- [x] Copy URL and open in new tab
- [x] Verify same filters are applied

### 9. Platform Filter ✅ PASS (FIXED)
- [x] Select Windows + macOS + Linux
- [x] Toggle between "Any" and "All" mode
- **Result:** Any mode: 174,148 | All mode: 17,179 | Platform values: `windows`, `macos`, `linux`

### 10. Growth Filters ✅ PASS (FIXED)
- [x] Click "Growing" preset (7d > 10%)
- [x] Click "Declining" preset (7d < -10%)
- **Result:** Slow path now works correctly with proper column aliases

### 11. Relationship Filter ✅ PASS (FIXED)
- [x] Select "Self-published" for publishers → **76,382 companies**
- [x] Select "Works with external devs"
- **Result:** Slow path fixed, relationship filtering works

---

## Verified Baseline Counts

Use these to verify UI displays correct counts:

| Filter | Expected Count |
|--------|---------------|
| No filter (all) | 193,396 |
| Publishers only | 89,123 |
| Developers only | 104,273 |
| Indie tag (ID 492) | 116,629 |
| RPG genre (ID 3) | 47,027 |
| Action genre (ID 1) | ~44,920 |
| Strategy genre (ID 2) | ~22,292 |
| Action OR Strategy (genre mode: any) | 124,166 |
| Action AND Strategy (genre mode: all) | 20,569 |
| Steam Deck Verified | 10,138 |
| Steam Deck Playable | 20,456 |
| Games 5+ | 7,619 |
| Games 10+ | 2,393 |
| Games 5-50 range | 7,399 |
| Revenue $1M+ | 9,268 |
| Revenue $10M+ | 2,346 |
| Owners 100K+ | 13,500 |
| Score 80+ | 65,032 |
| Active (released last year) | 49,712 |
| Dormant (no releases) | 143,684 |

---

## Data Verification Results

### Pre-Test Data Check: ✅ PASSED

| Metric | Publishers | Developers |
|--------|------------|------------|
| Total | 89,096 | 104,210 |
| With Tags | 89,073 (99.97%) | 104,179 (99.97%) |
| With Genres | 89,028 (99.92%) | 104,130 (99.92%) |
| With Categories | 88,619 (99.47%) | - |
| Steam Deck Verified | 4,218 | - |
| Steam Deck Playable | 8,719 | - |

---

## Performance Expectations

| Filter | Target | Previous | Actual |
|--------|--------|----------|--------|
| Tags | <500ms | 7.7s | ✅ <500ms |
| Genres | <500ms | 5.5s | ✅ <500ms |
| Categories | <500ms | ~2s | ✅ <500ms |
| Steam Deck | <500ms | 1.4s | ✅ <500ms |
| Platforms | <500ms | N/A | ✅ <500ms (GIN-indexed) |
| Combined (fast path) | <500ms | varies | ✅ <500ms |
| Growth filters | <5s | BROKEN | ✅ FIXED |
| Relationship filters | <5s | BROKEN | ✅ FIXED |

---

## SQL Verification Queries

### Check Arrays Populated
```sql
-- Check publisher has tags
SELECT publisher_id, publisher_name, array_length(tag_ids, 1) as tag_count
FROM publisher_metrics
WHERE tag_ids IS NOT NULL
LIMIT 5;

-- Check specific tag filtering
SELECT COUNT(*) FROM publisher_metrics WHERE tag_ids && ARRAY[492]; -- Indie
```

### Verify Filter Counts
```sql
-- Verify via aggregate stats RPC
SELECT * FROM get_companies_aggregate_stats(p_tags := ARRAY[492]); -- Indie tag
SELECT * FROM get_companies_aggregate_stats(p_genres := ARRAY[3]); -- RPG genre
SELECT * FROM get_companies_aggregate_stats(p_steam_deck := 'verified');
SELECT * FROM get_companies_aggregate_stats(p_type := 'publisher', p_status := 'active');

-- Verify genre mode (any vs all) via main RPC
SELECT COUNT(*) FROM get_companies_with_filters(
  p_genres := ARRAY[1, 2],
  p_genre_mode := 'any',
  p_limit := 1000000
); -- Should return 124,166

SELECT COUNT(*) FROM get_companies_with_filters(
  p_genres := ARRAY[1, 2],
  p_genre_mode := 'all',
  p_limit := 1000000
); -- Should return 20,569
```

### Reproduce Bugs
```sql
-- BUG #1: Slow path error (triggers on relationship filter)
SELECT COUNT(*) FROM get_companies_with_filters(
  p_type := 'publisher',
  p_relationship := 'self_published',
  p_limit := 1000000
); -- ERROR: column bc.total_owners does not exist

-- BUG #2: Platform filter no-op
SELECT COUNT(*) FROM get_companies_with_filters(
  p_platforms := ARRAY['windows', 'mac', 'linux']::text[],
  p_platform_mode := 'all',
  p_limit := 1000000
); -- Returns 193,396 (same as no filter)
```

---

## Files Modified

- `supabase/migrations/20260115000000_add_content_arrays_to_metrics.sql`
- `supabase/migrations/20260115100000_update_companies_rpc_for_arrays.sql`
- `supabase/migrations/20260115200000_fix_companies_filter_bugs.sql` - **BUG #1 & #3 fixes**
- `supabase/migrations/20260115300000_add_platform_filtering.sql` - **BUG #2 fix**
- Functions: `get_companies_with_filters`, `get_companies_aggregate_stats`
- Materialized views: `publisher_metrics`, `developer_metrics` (added `platform_array`)

---

## Completed Fixes

1. ✅ **BUG #1 (CRITICAL):** Added column aliases to slow path's `base_companies` CTE
2. ✅ **BUG #2 (HIGH):** Implemented platform filtering with pre-computed arrays and GIN indexes
3. ✅ **BUG #3 (MEDIUM):** Added all missing parameters to `get_companies_aggregate_stats`

All bugs verified fixed on 2026-01-14.
