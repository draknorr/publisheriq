# M4b Bug List - Games Page Advanced Filters

> **Page:** /apps (Games Page)
> **Milestone:** M4b - Advanced Filters - Content & Context
> **Created:** 2026-01-15
> **Last Updated:** 2026-01-15
> **Status:** Active - Bugs to be fixed

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 3 | Open |
| High | 3 | Open |
| Medium | 4 | Open |
| Low | 3 | Open |
| **Total** | **13** | **Open** |

---

## Critical Bugs

### BUG-001: Tags dropdown shows "No tags found"
- **Severity:** Critical
- **Component:** `ContentFilters.tsx` / `GenreTagFilter.tsx`
- **Status:** Open
- **Observed:** Tags dropdown opens but displays "No tags found" instead of tag options with counts
- **Expected:** Tags dropdown should show tag options with app counts (like Genres does)
- **Steps to Reproduce:**
  1. Open Advanced Filters panel
  2. Click on "Select tags..." dropdown
  3. Observe "No tags found" message
- **Root Cause Analysis:**
  - The `handleTagOpen` callback in `AppsPageClient.tsx` (line 119-121) calls `fetchCounts('tag', type, { minCcu: advancedFilters.minCcu })`
  - The RPC `get_apps_filter_option_counts` with `p_filter_type = 'tag'` is defined correctly (migration lines 981-997)
  - **Likely issue:** RPC not returning data, or data not being set in state correctly
  - Need to check: Is the RPC being called? Is there a Supabase error? Is state being updated?
- **Fix in /companies?** Companies uses the same pattern but with different RPC (`get_filter_option_counts`)
- **Suggested Fix:** Add console.log debugging to trace the RPC call and response

---

### BUG-002: React Hydration Mismatch Error
- **Severity:** Critical
- **Component:** `AppsPageClient.tsx` / `ToastProvider`
- **Status:** Open
- **Observed:** Console shows "Hydration failed because the server rendered HTML didn't match the client"
- **Console Error:**
  ```
  Error: Hydration failed because the server rendered HTML didn't match the client.
  This tree will be regenerated on the client.
  ```
- **Stack Trace Points To:** `<ToastContainer>` component with `<div className="fixed bottom-4 right-4...">`
- **Root Cause Analysis:**
  - SSR renders different HTML than client
  - `ToastContainer` likely renders different content on server vs client
  - Could also be caused by `useSavedViews` reading from localStorage (client-only)
- **Fix in /companies?** Need to check if /companies has same issue
- **Suggested Fix:**
  1. Wrap client-only components in `suppressHydrationWarning` or use `useEffect` for client-only state
  2. Use `dynamic(() => import(...), { ssr: false })` for ToastProvider
  3. Check `useSavedViews` hook - ensure `isLoaded` prevents rendering until client-side

---

### BUG-003: React Hooks Order Error
- **Severity:** Critical
- **Component:** Unknown (likely `AppsPageClientInner`)
- **Status:** Open
- **Observed:** Console shows "React has detected a change in the order of Hooks called"
- **Console Error:**
  ```
  React has detected a change in the order of Hooks called by %s.
  This will lead to bugs and errors if not fixed.
  ```
- **Root Cause Analysis:**
  - Hooks are being called conditionally or in different order between renders
  - Could be caused by early returns or conditional hook calls
- **Fix in /companies?** Need to check if /companies has same issue
- **Suggested Fix:** Review all hooks in `AppsPageClientInner` - ensure no conditional hook calls

---

## High Severity Bugs

### BUG-004: Type assertion bypass in useFilterCounts
- **Severity:** High
- **Component:** `apps/hooks/useFilterCounts.ts:92`
- **Status:** Open
- **Observed:** Code uses `(supabase.rpc as any)` to bypass TypeScript type checking
- **Code:**
  ```typescript
  const response = await (supabase.rpc as any)('get_apps_filter_option_counts', {...});
  ```
- **Root Cause:** RPC types not generated or not matching
- **Fix in /companies?** Yes - Companies version properly types the RPC call without `as any`
  ```typescript
  const response = await supabase.rpc('get_filter_option_counts', {...});
  ```
- **Suggested Fix:**
  1. Regenerate Supabase types: `pnpm --filter database generate`
  2. Ensure RPC function signature matches generated types
  3. Remove `as any` and fix any type errors

---

### BUG-005: Limited context filters passed to dropdowns
- **Severity:** High
- **Component:** `AppsPageClient.tsx` lines 115-125
- **Status:** Open
- **Observed:** Filter count queries only receive `minCcu` as context, missing other relevant filters
- **Code:**
  ```typescript
  const handleGenreOpen = useCallback(() => {
    fetchCounts('genre', type, { minCcu: advancedFilters.minCcu });
  }, [fetchCounts, type, advancedFilters.minCcu]);
  ```
- **Expected:** Should pass more context filters for accurate counts
- **Fix in /companies?** Yes - Companies passes more context:
  ```typescript
  const contextFilters = {
    minGames: filters.minGames,
    minRevenue: filters.minRevenue,
    status: filters.status,
  };
  ```
- **Suggested Fix:** Expand context object to include `minReviews`, `minScore`, etc.

---

### BUG-006: Workshop "No Workshop" filter logic incomplete
- **Severity:** High
- **Component:** RPC `get_apps_with_filters` lines 321-323
- **Status:** Open
- **Observed:** RPC only handles `p_has_workshop = TRUE` case
- **Code (RPC):**
  ```sql
  AND (p_has_workshop IS NULL OR (p_has_workshop = TRUE AND EXISTS (
    SELECT 1 FROM app_categories ac WHERE ac.appid = c.appid AND ac.category_id = 30
  )))
  ```
- **Problem:** When user selects "No Workshop", `p_has_workshop = FALSE` is passed but RPC doesn't filter for games WITHOUT workshop
- **Expected:** Should filter OUT games that have category_id = 30 when FALSE
- **Fix in /companies?** N/A (companies doesn't have workshop filter)
- **Suggested Fix:** Update RPC to handle FALSE case:
  ```sql
  AND (p_has_workshop IS NULL
       OR (p_has_workshop = TRUE AND EXISTS (...))
       OR (p_has_workshop = FALSE AND NOT EXISTS (...)))
  ```

---

## Medium Severity Bugs

### BUG-007: Early Access "Released" filter logic incomplete
- **Severity:** Medium
- **Component:** RPC `get_apps_with_filters` line 349
- **Status:** Open
- **Observed:** RPC only handles `p_early_access = TRUE` case
- **Code (RPC):**
  ```sql
  AND (p_early_access IS NULL OR (p_early_access = TRUE AND c.release_state = 'prerelease'))
  ```
- **Problem:** When user selects "Released", `p_early_access = FALSE` should filter for released games only
- **Expected:** FALSE should filter for games NOT in 'prerelease' state
- **Suggested Fix:** Update RPC:
  ```sql
  AND (p_early_access IS NULL
       OR (p_early_access = TRUE AND c.release_state = 'prerelease')
       OR (p_early_access = FALSE AND c.release_state != 'prerelease'))
  ```

---

### BUG-008: Categories dropdown needs verification
- **Severity:** Medium
- **Component:** `ContentFilters.tsx` / `CategoryDropdown`
- **Status:** Open (needs testing)
- **Observed:** Need to verify if Categories dropdown loads correctly (same pattern as Tags)
- **Testing Required:** Click on Categories dropdown and verify options load with counts
- **Suggested Fix:** Same debugging approach as BUG-001

---

### BUG-009: Missing debug logging in useFilterCounts
- **Severity:** Medium
- **Component:** `apps/hooks/useFilterCounts.ts`
- **Status:** Open
- **Observed:** No console.log statements for debugging RPC calls
- **Fix in /companies?** Yes - Companies has debug logging:
  ```typescript
  console.log(`Fetching ${filterType} counts with params:`, rpcParams);
  console.log(`Raw RPC response for ${filterType}:`, response);
  console.log(`${filterType} counts result:`, result?.length ?? 0, 'options');
  ```
- **Suggested Fix:** Add same debug logging pattern for easier troubleshooting

---

### BUG-010: Velocity tier filter not loading counts
- **Severity:** Medium
- **Component:** `SentimentFilters.tsx` / `useFilterCounts.ts`
- **Status:** Open
- **Observed:** Velocity Tier is a static dropdown, doesn't load dynamic counts
- **Code:** Velocity Tier dropdown shows "All Tiers" as static options
- **RPC Support:** `get_apps_filter_option_counts` DOES support `p_filter_type = 'velocity_tier'` (lines 1053-1081)
- **Problem:** UI doesn't call the RPC to get velocity tier counts
- **Suggested Fix:** Add `fetchCounts('velocity_tier', type, context)` call and display counts

---

## Low Severity Bugs

### BUG-011: Saved Views component not fully integrated
- **Severity:** Low
- **Component:** `SavedViews.tsx` / `useSavedViews.ts`
- **Status:** Open (needs testing)
- **Testing Required:**
  1. Save a view with filters
  2. Load the saved view
  3. Verify all filters restore correctly
  4. Delete and rename views
- **Potential Issue:** handleLoadView uses `window.location.href` which causes full page reload instead of router navigation

---

### BUG-012: Platform filter mode toggle not showing initially
- **Severity:** Low
- **Component:** `PlatformFilters.tsx`
- **Status:** Open
- **Observed:** Any/All mode toggle for platforms only shows when platforms are selected (by design, but inconsistent with UX expectations)
- **Comparison:** Genres/Tags also do this, so it may be intentional
- **Suggested Fix:** Consider showing mode toggle always, or add help text explaining it appears on selection

---

### BUG-013: CCU Tier filter not loading counts
- **Severity:** Low
- **Component:** `ActivityFilters.tsx` / `useFilterCounts.ts`
- **Status:** Open
- **Observed:** CCU Tier is static button group, doesn't show dynamic counts
- **RPC Support:** `get_apps_filter_option_counts` supports `p_filter_type = 'ccu_tier'` (lines 1033-1051)
- **Problem:** UI doesn't call RPC to get tier counts
- **Suggested Fix:** Add counts to button labels (e.g., "Tier 1: Hot (523)")

---

## Testing Checklist

### Verified Working:
- [x] Advanced Filters panel toggles open/close
- [x] Genres dropdown loads options with counts
- [x] Genre selection updates URL (`?genres=1`)
- [x] Genre badge with X to remove appears
- [x] Genre Any/All mode toggle works
- [x] Steam Deck filter buttons work
- [x] Steam Deck updates URL (`&steamDeck=verified`)
- [x] Release Period presets work (7d/30d/90d/1yr)
- [x] Release Period updates URL (`&maxAge=7`)
- [x] Age slider updates with preset
- [x] Clear button appears for Release Period
- [x] Multiple filters combine correctly in URL
- [x] Filter count badge updates (shows "3" for 3 filters)
- [x] Result count updates (shows "Games (7.4K)")
- [x] Clear all button works

### Needs Testing:
- [ ] Tags dropdown (currently broken - BUG-001)
- [ ] Categories dropdown
- [ ] Workshop toggle (Has Workshop / No Workshop)
- [ ] Platform buttons (Windows/Mac/Linux)
- [ ] Platform Any/All mode
- [ ] Controller filter
- [ ] Year presets (2026/2025/2024)
- [ ] Early Access toggle
- [ ] Hype Duration inputs
- [ ] Publisher/Developer search
- [ ] Self-Published toggle
- [ ] Publisher Size buttons
- [ ] vs Publisher Avg buttons
- [ ] CCU Tier buttons
- [ ] Saved Views save/load/delete/rename
- [ ] Filter persistence on page refresh

---

## Performance Notes

| Metric | Observed | Target | Status |
|--------|----------|--------|--------|
| Page load | ~1.5s | <2s | OK |
| Filter change | ~200ms | <500ms | OK |
| Genre dropdown open | ~300ms | <500ms | OK |
| Filter count badge | Accurate | Accurate | OK |

---

## Related Files

| File | Purpose |
|------|---------|
| `apps/admin/src/app/(main)/apps/components/AdvancedFiltersPanel.tsx` | Main panel component |
| `apps/admin/src/app/(main)/apps/components/AppsPageClient.tsx` | Page client with filter wiring |
| `apps/admin/src/app/(main)/apps/hooks/useFilterCounts.ts` | Filter counts hook |
| `apps/admin/src/app/(main)/apps/hooks/useSavedViews.ts` | Saved views hook |
| `apps/admin/src/app/(main)/apps/components/filters/*.tsx` | Individual filter components |
| `supabase/migrations/20260116000002_apps_page_rpcs.sql` | RPC definitions |

---

## Reference Implementation

See `/companies` page for working patterns:
- `apps/admin/src/app/(main)/companies/hooks/useFilterCounts.ts` - Has debug logging
- `apps/admin/src/app/(main)/companies/components/AdvancedFiltersPanel.tsx` - Context filter passing

---

## Changelog

### 2026-01-15
- Initial bug list created from code review and live testing
- Identified 13 bugs across Critical (3), High (3), Medium (4), Low (3) severity
- Verified 15 features working correctly
- Noted 16 features needing additional testing
