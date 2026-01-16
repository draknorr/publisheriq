# Games Page Performance Optimization - Status Update

**Date:** January 15, 2026
**Status:** 90% Complete - One bug to fix

---

## What Was Done

### Phase 1: Database Migrations (APPLIED)

1. **`supabase/migrations/20260117000001_app_filter_data_view.sql`** ✅
   - Created `app_filter_data` materialized view (121,588 rows)
   - Pre-computes genre_ids, tag_ids, category_ids as arrays
   - 8 indexes created (GIN for arrays, B-tree for scalars)

2. **`supabase/migrations/20260117000002_apps_rpc_v2.sql`** ✅ (HAS BUG)
   - Replaced `get_apps_with_filters`, `get_apps_aggregate_stats`, `get_apps_filter_option_counts`
   - Uses array containment operators (`&&`, `@>`) instead of EXISTS subqueries

3. **`supabase/migrations/20260117000003_apps_performance_indexes.sql`** ✅
   - Created 10 compound/covering indexes
   - Analyzed 6 tables

### Phase 2: Frontend Changes (COMPLETE)

4. **`apps/admin/package.json`** - Added `@tanstack/react-query`

5. **`apps/admin/src/app/providers.tsx`** - NEW: QueryClientProvider (5min stale, 30min gc)

6. **`apps/admin/src/app/layout.tsx`** - Added `<Providers>` wrapper

7. **`apps/admin/src/app/api/apps/route.ts`** - NEW: API route for client-side fetching

8. **`apps/admin/src/app/(main)/apps/hooks/useAppsQuery.ts`** - NEW: React Query hook

9. **`apps/admin/src/app/(main)/apps/hooks/useAppsFilters.ts`** - Changed debounce 300ms → 400ms

10. **`apps/admin/src/app/(main)/apps/components/AppsPageClient.tsx`** - Uses React Query

11. **`apps/admin/src/app/(main)/apps/components/AppsTable.tsx`** - Added `isLoading` prop

### Phase 4: GitHub Actions (COMPLETE)

12. **`.github/workflows/refresh-views.yml`** - Added 6-hour schedule, added `app_filter_data` to views

---

## BUG TO FIX

**Error:** `column ldm.average_playtime_forever does not exist`

**Cause:** The new RPC tries to get playtime from `latest_daily_metrics`, but those columns are in `daily_metrics`.

**Fix needed:** Update `20260117000002_apps_rpc_v2.sql` to use LATERAL join for playtime like the original:

```sql
-- Add this LATERAL join after app_filter_data join:
LEFT JOIN LATERAL (
  SELECT dm.average_playtime_forever, dm.average_playtime_2weeks
  FROM daily_metrics dm
  WHERE dm.appid = a.appid
  ORDER BY dm.metric_date DESC
  LIMIT 1
) dm_playtime ON true

-- Change these lines:
ldm.average_playtime_forever::INT,
ldm.average_playtime_2weeks::INT,

-- To:
dm_playtime.average_playtime_forever::INT,
dm_playtime.average_playtime_2weeks::INT,
```

This fix needs to be applied in BOTH the fast path and slow path of the function.

---

## Files Created/Modified Summary

| File | Status |
|------|--------|
| `supabase/migrations/20260117000001_app_filter_data_view.sql` | NEW, APPLIED |
| `supabase/migrations/20260117000002_apps_rpc_v2.sql` | NEW, APPLIED, **NEEDS FIX** |
| `supabase/migrations/20260117000003_apps_performance_indexes.sql` | NEW, APPLIED |
| `apps/admin/package.json` | MODIFIED |
| `apps/admin/src/app/providers.tsx` | NEW |
| `apps/admin/src/app/layout.tsx` | MODIFIED |
| `apps/admin/src/app/api/apps/route.ts` | NEW |
| `apps/admin/src/app/(main)/apps/hooks/useAppsQuery.ts` | NEW |
| `apps/admin/src/app/(main)/apps/hooks/useAppsFilters.ts` | MODIFIED |
| `apps/admin/src/app/(main)/apps/components/AppsPageClient.tsx` | MODIFIED |
| `apps/admin/src/app/(main)/apps/components/AppsTable.tsx` | MODIFIED |
| `.github/workflows/refresh-views.yml` | MODIFIED |

---

## Next Steps

1. Create fix migration `20260117000004_apps_rpc_playtime_fix.sql` that:
   - Adds LATERAL join for `dm_playtime` in both fast and slow paths
   - Changes `ldm.average_playtime_*` to `dm_playtime.average_playtime_*`

2. Apply the fix migration

3. Test the query works

4. Run `pnpm --filter admin dev` and test the Games page

---

## Expected Performance After Fix

| Scenario | Before | After |
|----------|--------|-------|
| Genre + Tag filter | 5-30s (timeout) | 50-200ms |
| Repeat same filter | 5-30s | <10ms (cache) |
| Default page load | 2-5s | 200ms |
