# M6b Test Plan: Export & Dashboard Integration

## Quick Start
Run the dev server and navigate to `/companies`:
```bash
pnpm --filter admin dev
```

Then open: http://localhost:3000/companies

---

## Test Cases

### 1. Header Export Button
**Location:** Top-right area, next to Column Selector and Saved Views

- [ ] Export button is visible with Download icon
- [ ] Button is disabled when no companies are loaded
- [ ] Clicking Export opens the Export Dialog

### 2. Export Dialog
**Trigger:** Click header Export button

- [ ] Dialog opens as modal with backdrop
- [ ] Format section shows CSV selected, Excel disabled ("coming soon")
- [ ] Scope section shows:
  - "Filtered results (X companies)" - default selected
  - "Selected only (0 companies)" - disabled when no selection
- [ ] Include section shows:
  - "Visible columns only (X columns)" - checkbox
  - "Include per-game breakdown" - disabled ("coming soon")
- [ ] Cancel button closes dialog
- [ ] Export button shows company count

### 3. CSV Export - Filtered Results
**Steps:**
1. Apply some filters (e.g., search "Valve", or Quick Filter "Major")
2. Click header Export button
3. Keep "Filtered results" selected
4. Click "Export X Companies"

**Verify:**
- [ ] CSV file downloads with name `companies-filtered-YYYY-MM-DD.csv`
- [ ] CSV has header comments (# Export from PublisherIQ...)
- [ ] CSV has column headers matching visible columns
- [ ] Data rows match filtered table results
- [ ] Numbers are formatted (revenue in dollars, not cents)

### 4. CSV Export - Selected Only
**Steps:**
1. Select 3-5 companies using checkboxes
2. Click header Export button
3. Select "Selected only (X companies)"
4. Click Export

**Verify:**
- [ ] CSV contains only selected companies
- [ ] Filename is `companies-selected-YYYY-MM-DD.csv`

### 5. CSV Export - Visible Columns Only
**Steps:**
1. Use Column Selector to show only 3-4 columns
2. Export with "Visible columns only" checked
3. Export again with it unchecked

**Verify:**
- [ ] Checked: CSV has only visible columns + id/name/type
- [ ] Unchecked: CSV has all 15 metrics

### 6. Bulk Actions Bar - Export
**Steps:**
1. Select 2+ companies
2. Bulk Actions Bar appears at bottom
3. Click "Export" button in bar

**Verify:**
- [ ] Export dialog opens with "Selected only" pre-selected
- [ ] Scope shows correct selection count

### 7. Bulk Actions Bar - Pin All
**Steps:**
1. Select 3-5 companies
2. Click "Pin All" in Bulk Actions Bar

**Verify:**
- [ ] Button shows "Pinning..." with spinner
- [ ] Toast appears: "Pinned X companies to dashboard"
- [ ] Selection is cleared after pinning
- [ ] Check /insights - companies appear in My Dashboard

### 8. Compare Mode - Export CSV
**Steps:**
1. Select 2-5 companies
2. Click "Compare" in Bulk Actions Bar
3. In Compare modal, click "Export CSV"

**Verify:**
- [ ] CSV downloads with name `companies-comparison-YYYY-MM-DD.csv`
- [ ] CSV has header comments
- [ ] Columns: Metric, Company1, Company2, Company2 vs Company1, etc.
- [ ] % diff values included (e.g., "+25.3%")

### 9. Row Actions - Pin Icon
**Location:** Actions column (rightmost) in table

- [ ] Pin icon visible for each row
- [ ] Icon is outline style when unpinned
- [ ] Clicking pin icon:
  - Shows loading state briefly
  - Icon becomes filled/blue when pinned
- [ ] Clicking again shows loading then reverts to outline
- [ ] Pinned company appears in /insights My Dashboard

### 10. Row Actions - Steam Link
**Location:** Actions column, next to pin icon

- [ ] External link icon visible
- [ ] Clicking opens new tab
- [ ] URL format: `https://store.steampowered.com/publisher/NAME` or `/developer/NAME`
- [ ] Works for both publishers and developers

### 11. Toast Notifications
**Trigger:** Pin operations

- [ ] Toast appears in bottom-right corner
- [ ] Success toast is green-tinted
- [ ] Error toast is red-tinted (test by pinning same company twice rapidly)
- [ ] Toast auto-dismisses after ~4 seconds
- [ ] X button dismisses toast immediately

### 12. Edge Cases

**Empty selection:**
- [ ] Header Export still works (exports filtered results)
- [ ] Bulk Actions Bar hidden when 0 selected

**Large export:**
- [ ] Export 100+ companies works without freezing
- [ ] CSV file size reasonable

**Already pinned:**
- [ ] Pinning already-pinned company shows as pinned (no error)
- [ ] Bulk pin handles mix of new and already-pinned

---

## Files to Reference

If bugs are found, check these files:

| Feature | File |
|---------|------|
| Toast system | `apps/admin/src/components/ui/Toast.tsx` |
| Export dialog | `apps/admin/src/app/(main)/companies/components/ExportDialog.tsx` |
| CSV utilities | `apps/admin/src/app/(main)/companies/lib/companies-export.ts` |
| Main page client | `apps/admin/src/app/(main)/companies/components/CompaniesPageClient.tsx` |
| Bulk actions bar | `apps/admin/src/app/(main)/companies/components/BulkActionsBar.tsx` |
| Compare modal | `apps/admin/src/app/(main)/companies/components/CompareMode.tsx` |
| Table with actions | `apps/admin/src/app/(main)/companies/components/CompaniesTable.tsx` |

---

## Known Limitations (Not Bugs)

1. **Per-game breakdown** - Marked "coming soon", requires additional RPC
2. **Excel format** - Not implemented, CSV only
3. **Pin state not persisted** - Row pin icons reset on page reload (would need batch pin check API)
4. **Unpin from table** - Pin icon only pins, doesn't unpin (would need pin ID tracking)

---

## Quick Smoke Test

Minimal test to verify M6b works:

1. Go to `/companies`
2. Click Export → Export dialog opens ✓
3. Click Export button → CSV downloads ✓
4. Select 2 companies → Bulk Actions Bar appears ✓
5. Click Compare → Compare modal opens ✓
6. Click Export CSV in modal → CSV downloads ✓
7. Click pin icon on any row → Icon changes to filled ✓
8. Click Steam link → New tab opens Steam page ✓
9. Select 2 companies, click Pin All → Toast shows success ✓
