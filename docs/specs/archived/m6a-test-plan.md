# M6a: Selection & Compare Mode - Test Plan

## Quick Start
1. Run dev server: `pnpm --filter admin dev`
2. Open: http://localhost:3001/companies

---

## Bugs Found & Fixed (Jan 14, 2026)

### Bug 1: Client/Server Boundary Error
- **Error**: `parseCompareParam()` was imported from a client-tainted module chain
- **Fix**: Inlined the function directly in `page.tsx` to avoid module boundary issue
- **File**: `apps/admin/src/app/(main)/companies/page.tsx:79-108`

### Bug 2: Database Query Error
- **Error**: `getCompaniesByIds` used non-existent column names (`id` instead of `publisher_id`)
- **Fix**: Updated query to use correct column names from materialized views
- **File**: `apps/admin/src/app/(main)/companies/lib/companies-queries.ts:184-296`

### Bug 3: Compare Modal Layout Issues
- **Error**: Invalid nested `<tbody>`, column misalignment, headers not matching data
- **Fix**: Replaced with `React.Fragment`, added `table-fixed` layout with explicit widths, `min-w-max` wrapper for horizontal scroll
- **File**: `apps/admin/src/app/(main)/companies/components/CompareMode.tsx`

---

## Test 1: Row Selection (Desktop)

### 1.1 Single Selection
- [ ] Click checkbox on any row → row highlights with blue background
- [ ] Click same checkbox again → row deselects
- [ ] Bulk actions bar appears at bottom when 1+ selected

### 1.2 Header Checkbox
- [ ] Click header checkbox → all visible rows selected
- [ ] Click header checkbox again → all rows deselected
- [ ] With some rows selected, header shows indeterminate state (dash icon)

### 1.3 Shift+Click Range Selection
- [ ] Click checkbox on row 2
- [ ] Shift+click checkbox on row 5 → rows 2-5 all selected

### 1.4 Selection Limit
- [ ] Select more than 5 rows → Compare button stays disabled
- [ ] Selection counter updates correctly in bulk actions bar

---

## Test 2: Row Selection (Mobile)

- [ ] Resize browser to mobile width (< 768px)
- [ ] Card view shows with checkbox on left side
- [ ] Tap checkbox → card gets ring highlight
- [ ] Bulk actions bar appears at bottom

---

## Test 3: Bulk Actions Bar

### 3.1 Visibility
- [ ] Bar hidden when nothing selected
- [ ] Bar appears (slides up) when 1+ selected
- [ ] Bar shows correct count: "1 selected", "3 selected", etc.

### 3.2 Button States
- [ ] **Compare**: Disabled when < 2 or > 5 selected
- [ ] **Compare**: Enabled when 2-5 selected
- [ ] **Pin All**: Disabled (M6b - shows "Coming soon" tooltip)
- [ ] **Export**: Disabled (M6b - shows "Coming soon" tooltip)
- [ ] **Clear**: Always enabled, clears all selections

---

## Test 4: Compare Mode

### 4.1 Opening Compare Modal
- [ ] Select 2-5 companies
- [ ] Click "Compare" button
- [ ] URL updates to include `?compare=pub:123,dev:456,...`
- [ ] Modal opens with selected companies

### 4.2 Modal Layout
- [ ] Header shows "Compare Companies" with company count badge
- [ ] Companies displayed as columns
- [ ] First company shows "Baseline" badge
- [ ] Each company header has (×) remove button
- [ ] Metrics grouped by category (Engagement, Content, Reviews, etc.)

### 4.3 Comparison Data
- [ ] First company shows "—" for % diff (it's the baseline)
- [ ] Other companies show % diff from baseline
- [ ] Best value per row highlighted in green
- [ ] Worst value per row highlighted in red
- [ ] "vs Avg" column shows comparison to filtered average
- [ ] Sparkline row shows CCU trends for each company

### 4.4 Modal Actions
- [ ] Click (×) on company header → removes from comparison
- [ ] If < 2 companies remain → modal closes automatically
- [ ] Click backdrop → modal closes
- [ ] Click "Close" button → modal closes
- [ ] "Export CSV" button disabled (M6b)

---

## Test 5: URL Persistence

### 5.1 Compare URL is Shareable
- [ ] Open compare for 3 companies
- [ ] Copy URL (e.g., `/companies?compare=pub:123,dev:456,pub:789`)
- [ ] Open URL in new tab → same comparison loads
- [ ] Close compare → `compare` param removed from URL

### 5.2 Selection is NOT Persisted
- [ ] Select 3 companies
- [ ] Refresh page → selection cleared (expected behavior)
- [ ] Selection is ephemeral by design

### 5.3 Compare + Filters
- [ ] Apply some filters (type, search, etc.)
- [ ] Open compare mode
- [ ] URL contains both filter params and compare param
- [ ] Closing compare preserves filter params

---

## Test 6: Edge Cases

### 6.1 Invalid Compare URL
- [ ] Navigate to `/companies?compare=invalid`
- [ ] Page loads normally, no compare modal
- [ ] Navigate to `/companies?compare=pub:1` (only 1 ID)
- [ ] Page loads normally, no compare modal (need 2+)

### 6.2 Mixed Publisher/Developer
- [ ] Select 2 publishers and 1 developer
- [ ] Open compare → all 3 shown correctly with Pub/Dev badges

### 6.3 Empty State
- [ ] With no companies matching filters
- [ ] Table shows "No companies found"
- [ ] No checkboxes visible (nothing to select)

---

## Expected Files Changed

```
apps/admin/src/app/(main)/companies/
├── components/
│   ├── BulkActionsBar.tsx      (NEW)
│   ├── CompareMode.tsx         (NEW)
│   ├── CompaniesPageClient.tsx (MODIFIED)
│   └── CompaniesTable.tsx      (MODIFIED)
├── hooks/
│   ├── useCompaniesCompare.ts  (NEW)
│   └── useCompaniesSelection.ts (NEW)
├── lib/
│   ├── companies-compare.ts    (NEW)
│   ├── companies-queries.ts    (MODIFIED)
│   └── companies-types.ts      (MODIFIED)
└── page.tsx                    (MODIFIED)
```

---

## Success Criteria Checklist

- [ ] Row checkboxes work (single click)
- [ ] "Select all" selects visible rows
- [ ] Bulk actions bar appears when 1+ selected
- [ ] Compare button only enabled for 2-5 selections
- [ ] Compare modal shows all metrics side-by-side
- [ ] % diff calculated correctly from baseline
- [ ] "vs Avg" column shows comparison to filtered average
- [ ] Compare URL is shareable (`?compare=pub:123,dev:456`)
- [ ] Best/worst values color-coded per metric row
