# Companies Page Column Bugs - Fix Plan

## Quick Context (for resuming after context clear)

**Task:** Fix bugs in the /companies page columns feature
**Key files:**
- `apps/admin/src/app/(main)/companies/lib/companies-columns.ts` - Column definitions
- `apps/admin/src/app/(main)/companies/components/CompaniesTable.tsx` - Table rendering & sorting
- `apps/admin/src/app/(main)/companies/hooks/useCompaniesFilters.ts` - URL state management
- `apps/admin/src/app/(main)/companies/lib/companies-types.ts` - Type definitions
- `apps/admin/src/app/(main)/companies/components/ColumnSelector.tsx` - Column selector UI
- `apps/admin/src/app/(main)/companies/components/CompaniesPageClient.tsx` - Parent component

**Dev server:** Running on `localhost:3001`

---

## Summary of Bugs Found (ALL VERIFIED VIA BROWSER)

### Bug 1: Non-Sortable Columns Accept Clicks (VERIFIED)
**Symptom:** Clicking column headers for non-sortable columns changes URL but doesn't work:
- URL changes (e.g., `sort=unique_developers`)
- No sort arrow appears on clicked column (Hours ↓ stays)
- Data remains unsorted by clicked column

**Affected columns (all have `sortable: false` but allow clicks):**
- `unique_developers` (Devs) - VERIFIED: URL changes to `sort=unique_developers`
- `review_velocity` (Velocity) - VERIFIED: URL changes to `sort=review_velocity`
- `growth_30d` (30d Growth) - VERIFIED: URL changes to `sort=growth_30d`
- `sparkline` (CCU Trend) - not clickable (has `isVisualization: true`)

**Root Cause:** `SortHeader` in `CompaniesTable.tsx` (line 74-78) only checks `isRatio` before calling `onSort()`. Columns with `sortable: false` but no `isRatio: true` still trigger sort attempts.

### Bug 2: "Role" Column Not Toggleable (VERIFIED)
**Symptom:** The Role column (showing "Pub"/"Dev" badges) cannot be hidden via the column selector.

**Root Cause:** Role column is hardcoded in `CompaniesTable.tsx` lines 536-538, not part of the `COLUMN_DEFINITIONS` system.

### Bug 3: "Role" Column Redundant When Filtering by Type (VERIFIED)
**Symptom:** When viewing only Publishers or only Developers, every row shows the same badge ("Pub" or "Dev"), which is useless information.

**Root Cause:** No conditional logic to hide the Role column when `type !== 'all'`.

### Bug 4: "Unique Devs" Column Shows 0 for All Developers (VERIFIED)
**Symptom:** When viewing Developers, the "Devs" column shows "0" for every row.

**Root Cause:** The column semantically means "number of unique developers this PUBLISHER works with" - it's publisher-specific data. Developers don't have this metric, so it's always 0.

**Verified:** Publishers show actual values (SEGA: 46, Square Enix: 66, EA: 68, Ubisoft: 81)

### Bug 5: "Velocity" Column Shows "—" for All Rows (VERIFIED - lower priority)
**Symptom:** Review Velocity column shows dash (—) for ALL companies on "All Companies" view.

**Possible causes:** Data not populated, or Company aggregate doesn't include velocity data. This may be a data issue rather than UI bug. Lower priority than the sorting/column bugs above.

### Additional Verified Behaviors:
- ✅ Ratio columns (Revenue/Game, Owners/Game, Reviews/1K) work correctly with client-side sorting
- ✅ Sparkline column correctly non-clickable (has `isVisualization: true`)
- ✅ All 16 columns visible in column selector (Role missing - Bug 2)
- ✅ Default sortable columns (Hours, Games, Owners, etc.) work correctly

---

## Files to Modify

| File | Changes |
|------|---------|
| `companies-columns.ts` | Add `role` column to ColumnId, COLUMN_DEFINITIONS, COLUMN_CATEGORIES |
| `CompaniesTable.tsx` | Fix SortHeader (lines 74-91), remove hardcoded Role (536-538, 612-614), add role to renderCell, add companyType prop + effectiveColumns |
| `ColumnSelector.tsx` | Add companyType prop, filter inapplicable columns |
| `CompaniesPageClient.tsx` | Pass companyType to CompaniesTable and ColumnSelector |

---

## Implementation Plan

### Step 1: Fix Sorting for Non-Sortable Columns

**File:** `apps/admin/src/app/(main)/companies/components/CompaniesTable.tsx`

**Current code (lines 74-79):**
```typescript
const handleClick = () => {
  // For ratio columns, we'll handle sorting differently
  if (!isRatio && field) {
    onSort(field as SortField);
  }
};
```

**Fix:** Also check `sortable` property from COLUMN_DEFINITIONS:
```typescript
const handleClick = () => {
  const column = COLUMN_DEFINITIONS[field as ColumnId];
  const canSort = !isRatio && column?.sortable !== false;
  if (canSort && field) {
    onSort(field as SortField);
  }
};
```

**Also update disabled state (lines 90-91):**

Current:
```typescript
disabled={isRatio}
title={isRatio ? 'Ratio columns cannot be sorted on server' : undefined}
```

Fix:
```typescript
const column = COLUMN_DEFINITIONS[field as ColumnId];
const isDisabled = isRatio || column?.sortable === false;
// ...
disabled={isDisabled}
title={isDisabled ? 'This column cannot be sorted' : undefined}
```

### Step 2: Add "Role" Column to Column Definitions

**File:** `apps/admin/src/app/(main)/companies/lib/companies-columns.ts`

Add 'role' to the `ColumnId` type and `COLUMN_DEFINITIONS`:

```typescript
// Add to ColumnId type (around line 11)
| 'role'

// Add to COLUMN_DEFINITIONS (in content section, around line 128)
role: {
  id: 'role',
  label: 'Role',
  category: 'content',
  width: 60,
  sortable: false,
  methodology: 'Whether this is a Publisher or Developer.',
  getValue: (c) => c.type,
},

// Add to COLUMN_CATEGORIES.content.columns (around line 275)
columns: ['games', 'unique_developers', 'role'],
```

### Step 3: Make Role Column Dynamic in Table

**File:** `apps/admin/src/app/(main)/companies/components/CompaniesTable.tsx`

**3a. Remove hardcoded Role column header (lines 536-538):**
```typescript
// DELETE this <th> element:
<th className="px-3 py-2 text-left text-caption font-medium text-text-tertiary">
  Role
</th>
```

**3b. Remove hardcoded Role cell (lines 612-614):**
```typescript
// DELETE this <td> element:
<td className="px-3 py-2">
  <RoleBadge type={company.type} />
</td>
```

**3c. Add role rendering to `renderCell()` function (around line 145):**
```typescript
// Add this case to the switch statement:
case 'role':
  return <RoleBadge type={company.type} />;
```

The Role column will now be controlled by `effectiveColumns` like other dynamic columns.

### Step 4: Auto-Hide Role and Unique Devs Columns Based on Type

**Approach:** Auto-exclude columns that are redundant/meaningless for the current view

**File 1:** `apps/admin/src/app/(main)/companies/components/CompaniesTable.tsx`

Add a prop for current company type:
```typescript
interface CompaniesTableProps {
  // ... existing props (lines 28-48)
  companyType: CompanyType; // Add this new prop
}
```

In the component, add useMemo to filter columns (add near line 372):
```typescript
// Filter columns based on company type
const effectiveColumns = useMemo(() => {
  let cols = visibleColumns;

  // Hide Role column when viewing specific type (redundant info)
  if (companyType !== 'all') {
    cols = cols.filter(col => col !== 'role');
  }

  // Hide Unique Devs when viewing developers (always 0, meaningless)
  if (companyType === 'developer') {
    cols = cols.filter(col => col !== 'unique_developers');
  }

  return cols;
}, [visibleColumns, companyType]);
```

Then use `effectiveColumns` instead of `visibleColumns` in the table rendering.

**File 2:** `apps/admin/src/app/(main)/companies/components/CompaniesPageClient.tsx`

Pass `companyType` prop to CompaniesTable (around line 340):
```typescript
<CompaniesTable
  companies={initialData}
  sortField={initialSort}
  sortOrder={initialOrder}
  onSort={setSort}
  visibleColumns={visibleColumns}
  sparklineLoader={sparklineLoader}
  companyType={initialType}  // ADD THIS LINE
  // M6a: Selection props...
```

### Step 5: Update Column Selector to Show Context-Appropriate Columns

**File 1:** `apps/admin/src/app/(main)/companies/components/ColumnSelector.tsx`

Add `companyType` prop and filter columns:
```typescript
interface ColumnSelectorProps {
  visibleColumns: ColumnId[];
  onChange: (columns: ColumnId[]) => void;
  disabled?: boolean;
  companyType: CompanyType;  // ADD THIS
}
```

Filter columns based on type (add helper function and modify the category rendering):
```typescript
// Helper to check if column is applicable for current type
const isColumnApplicable = (columnId: ColumnId): boolean => {
  // Role only makes sense when viewing all types
  if (columnId === 'role' && companyType !== 'all') return false;
  // Unique devs only makes sense for publishers
  if (columnId === 'unique_developers' && companyType === 'developer') return false;
  return true;
};

// In the category mapping (line 96), filter columns:
{category.columns.filter(id => isColumnApplicable(id as ColumnId)).map((columnId) => {
```

**File 2:** `apps/admin/src/app/(main)/companies/components/CompaniesPageClient.tsx`

Pass `companyType` prop to ColumnSelector (around line 261):
```typescript
<ColumnSelector
  visibleColumns={visibleColumns}
  onChange={setColumns}
  disabled={isPending}
  companyType={initialType}  // ADD THIS LINE
/>
```

---

## Verification Steps

1. **Test sorting fix:**
   - Navigate to `/companies`
   - Enable "Devs" column via column selector
   - Click "Devs" header → should NOT trigger sort or change URL
   - Click "Hours" header → should still sort properly with arrow indicator

2. **Test Role column toggleability:**
   - On "All Companies" view, open column selector
   - Find "Role" in Content category
   - Toggle it off → Role column should disappear
   - Toggle it on → Role column should reappear

3. **Test Role auto-hide:**
   - Enable Role column on "All Companies"
   - Switch to "Publishers" tab → Role column should auto-hide, not in selector
   - Switch to "Developers" tab → Role column should auto-hide, not in selector
   - Switch to "All Companies" → Role column should reappear (if was enabled)

4. **Test Unique Devs auto-hide:**
   - Enable "Devs" column on "All Companies"
   - Switch to "Developers" tab → "Devs" column should auto-hide, not in selector
   - Switch to "Publishers" tab → "Devs" column should show with actual non-zero values

5. **Browser testing with Chrome automation:**
   - Use browser tools to verify all UI behaviors visually
   - Test URL state persistence after page reload

6. **TypeScript & Build verification:**
   - Run `pnpm --filter admin check-types` to verify no type errors
   - Verify dev server still runs without errors
