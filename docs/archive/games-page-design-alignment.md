# Games Page Design Alignment Checklist

> Align `/apps` (Games) page with `/companies` page design language and patterns.
> Reference: Companies page is the gold standard for design consistency.

---

## Overview

The Companies page represents the polished design standard. The Games page needs to be updated to match its patterns, naming conventions, component usage, and visual styling exactly.

**Key Differences Identified (with code evidence):**

| Area | Companies | Apps | Action |
|------|-----------|------|--------|
| Filter Architecture | `UnifiedFilterBar.tsx` (single component) | `PresetViews.tsx` + `QuickFilters.tsx` (separate) | Consolidate |
| Active Preset Color | `bg-accent-primary/20 text-accent-primary` (teal) | `bg-accent-purple/15 text-accent-purple` (purple) | Change to teal |
| Pill Shape | `rounded-full` everywhere | Presets: `rounded-full`, Quick: `rounded-md` | Standardize to rounded-full |
| Pill Component | Dedicated `FilterPill.tsx` | Inline styles | Create FilterPill |
| Inactive Preset Style | Purple tint + dot indicator | No tint, no dot | Add purple tint + dot |
| Summary Bar | `ContextBar.tsx` - simple inline with dots | `SummaryStatsBar.tsx` - card with icons, 2 rows | Simplify to inline |
| BulkActionsBar | Has "Pin All" button | Missing "Pin All" button | Add Pin All |
| GrowthCell | Identical | Identical | None needed |

---

## Quick File-by-File Checklist

### Files to CREATE (copy from companies, adapt):
- [ ] `apps/components/FilterPill.tsx` ← copy from companies
- [ ] `apps/components/UnifiedFilterBar.tsx` ← copy from companies

### Files to RENAME:
- [ ] `SummaryStatsBar.tsx` → `ContextBar.tsx`

### Files to DELETE:
- [ ] `apps/components/PresetViews.tsx`
- [ ] `apps/components/QuickFilters.tsx`

### Files to MODIFY:
- [ ] `apps/components/BulkActionsBar.tsx` - Add "Pin All" button
- [ ] `apps/components/AppsPageClient.tsx` - Use UnifiedFilterBar, ContextBar
- [ ] `apps/lib/apps-presets.ts` - Merge PRESETS + QUICK_FILTERS → UNIFIED_FILTERS

### Files ALREADY MATCHING (no changes):
- [x] `apps/components/GrowthCell.tsx` ← identical
- [x] `apps/components/BulkActionsBar.tsx` (styling) ← identical except Pin All

---

## Phase 1: Component Architecture Alignment

### 1.1 Unified Filter Bar Refactor
**Status:** [ ] Not Started

**Current (Apps) - TWO SEPARATE COMPONENTS:**

```tsx
// PresetViews.tsx - Line 99-108 (WRONG: uses purple for active)
${isActive
  ? 'bg-accent-purple/15 text-accent-purple border border-accent-purple/30'  // ❌ WRONG
  : 'bg-surface-elevated text-text-secondary border border-border-subtle...'
}

// QuickFilters.tsx - Line 32-41 (WRONG: uses rounded-md)
className={`px-3 py-1.5 rounded-md text-body-sm...`}  // ❌ Should be rounded-full
${isActive
  ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/30'
  : ...
}
```

**Target (Companies) - SINGLE UNIFIED COMPONENT:**

```tsx
// UnifiedFilterBar.tsx - Uses FilterPill component with consistent states
<FilterPill
  isActive={isFilterActive(filter)}
  isPreset={filter.type === 'preset'}  // Different styling for presets vs quick
  ...
/>

// Layout: Advanced toggle | Divider | Scrollable pills | Divider | Tools
<div className="flex items-center gap-2">
  <button>{/* Advanced Filters Toggle */}</button>
  <div className="h-6 w-px bg-border-subtle flex-shrink-0" />  // Divider
  <div className="flex-1 flex items-center gap-1 min-w-0">
    {/* Scroll arrows + pills */}
  </div>
  <div className="flex items-center gap-2 flex-shrink-0 border-l border-border-subtle pl-3">
    {/* Clear | Columns | Saved Views | Export */}
  </div>
</div>
```

**Tasks:**
- [ ] Create `apps/components/UnifiedFilterBar.tsx` matching companies pattern exactly
- [ ] Create `apps/components/FilterPill.tsx` (copy from companies, adjust entity name)
- [ ] Merge preset + quick filter data into single `UNIFIED_FILTERS` array in `apps-presets.ts`
- [ ] Add `type: 'preset' | 'quick'` to filter definitions
- [ ] Implement horizontal scroll with chevron arrows (left/right)
- [ ] Add ResizeObserver for scroll state detection
- [ ] Integrate tools section with vertical divider separator
- [ ] Delete old `PresetViews.tsx` and `QuickFilters.tsx`
- [ ] Update `AppsPageClient.tsx` to use new UnifiedFilterBar

### 1.2 FilterPill Component
**Status:** [ ] Not Started

**Current (Apps):** No dedicated component - inline styles scattered

**Target (Companies FilterPill.tsx):**

```tsx
// EXACT implementation from companies/components/FilterPill.tsx
interface FilterPillProps {
  label: string;
  emoji?: string;
  tooltip?: string;
  isActive: boolean;
  isPreset: boolean;
  onClick: () => void;
  disabled?: boolean;
}

// Base classes (all states):
'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-body-sm'
'font-medium whitespace-nowrap transition-all duration-150'
'border focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2'

// State-specific classes:
// ACTIVE (both preset and quick):
'bg-accent-primary/20 text-accent-primary border-accent-primary/40 shadow-sm'

// INACTIVE PRESET (purple tint):
'bg-accent-purple/5 text-text-secondary border-accent-purple/20'
// + hover: 'hover:border-accent-purple/40 hover:bg-accent-purple/10'

// INACTIVE QUICK (neutral):
'bg-surface-elevated text-text-secondary border-border-subtle'
// + hover: 'hover:border-border-prominent hover:bg-surface-overlay'

// DISABLED:
'opacity-50 cursor-not-allowed'

// DOT INDICATOR (inactive presets only):
{isPreset && !isActive && (
  <span className="w-1.5 h-1.5 rounded-full bg-accent-purple/50 ml-0.5" />
)}
```

**Tasks:**
- [ ] Create `apps/components/FilterPill.tsx` - copy exact implementation from companies
- [ ] Ensure all 4 visual states match exactly
- [ ] Verify dot indicator appears for inactive presets
- [ ] Test focus ring styling matches

### 1.3 Context Bar (Summary Stats)
**Status:** [ ] Not Started

**Current (Apps SummaryStatsBar.tsx) - ELABORATE CARD LAYOUT:**

```tsx
// Line 27-28: Card-based container (TOO HEAVY)
<div className="p-4 bg-surface-elevated border border-border-muted rounded-lg">

// Two-row layout with icons and dividers
<StatItem icon={<BarChart3 />} label="Avg CCU" value={...} />
<Divider />  // Uses "|" character, hidden on mobile

// Second row with border-top
<div className="mt-2 pt-2 border-t border-border-muted">
```

**Target (Companies ContextBar.tsx) - SIMPLE INLINE:**

```tsx
// Simple inline flex with dot separators
<div className="flex items-center gap-3 py-2 px-3 bg-surface-elevated/50 rounded-lg border border-border-subtle text-body-sm text-text-tertiary">

  {/* Loading state */}
  {isLoading ? (
    <div className="flex gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-4 w-20 bg-surface-overlay rounded animate-pulse" />
      ))}
    </div>
  ) : (
    <>
      <span className="whitespace-nowrap">
        <span className="font-medium text-text-secondary">{count}</span> games
      </span>
      <span className="text-border-muted">·</span>  {/* Dot separator */}
      <span className="whitespace-nowrap">
        <span className="font-medium text-text-secondary">{ccu}</span> CCU
      </span>
      <span className="text-border-muted hidden sm:inline">·</span>
      <span className="whitespace-nowrap hidden sm:inline">
        <span className="font-medium text-text-secondary">{reviews}</span> reviews
      </span>
    </>
  )}
</div>
```

**Key Differences:**
| Aspect | Companies | Apps (Current) |
|--------|-----------|----------------|
| Container | `py-2 px-3 bg-surface-elevated/50` | `p-4 bg-surface-elevated` |
| Border | `border-border-subtle` | `border-border-muted` |
| Layout | Single row inline | Two rows with border-t |
| Icons | None | Has icons (BarChart3, TrendingUp) |
| Separator | Dot `·` | Pipe `|` |

**Design Decision: HYBRID APPROACH**
- Use companies-style inline layout (single row, no icons, dot separators)
- But show games-specific metrics (momentum, sentiment) instead of revenue

**Target Implementation:**
```tsx
<div className="flex items-center gap-3 py-2 px-3 bg-surface-elevated/50 rounded-lg border border-border-subtle text-body-sm text-text-tertiary">
  <span className="whitespace-nowrap">
    <span className="font-medium text-text-secondary">{count}</span> games
  </span>
  <span className="text-border-muted">·</span>
  <span className="whitespace-nowrap">
    <span className="font-medium text-text-secondary">{avgCcu}</span> avg CCU
  </span>
  <span className="text-border-muted">·</span>
  <span className="whitespace-nowrap">
    <span className="font-medium text-trend-positive">{trendingUp}</span> trending
  </span>
  <span className="text-border-muted hidden sm:inline">·</span>
  <span className="whitespace-nowrap hidden sm:inline">
    <span className="font-medium text-text-secondary">{avgMomentum}</span> momentum
  </span>
</div>
```

**Tasks:**
- [ ] Rename `SummaryStatsBar.tsx` to `ContextBar.tsx`
- [ ] Rewrite to single-row inline layout (companies style)
- [ ] Remove icons - use text only
- [ ] Change container: `py-2 px-3 bg-surface-elevated/50`
- [ ] Change separator from `|` to `·` (dot)
- [ ] Change border: `border-border-subtle`
- [ ] Add loading skeleton: `h-4 w-20 bg-surface-overlay rounded animate-pulse`
- [ ] Make last items hide on mobile: `hidden sm:inline`
- [ ] Keep games-specific metrics: count, avg CCU, trending count, avg momentum

---

## Phase 2: Typography & Text Patterns

### 2.1 Section Headers in Advanced Filters
**Status:** [ ] Not Started

**Current (Apps):**
- May use inconsistent header styling

**Target (Companies):**
```tsx
<h4 className="text-caption font-medium text-text-tertiary uppercase tracking-wide">
  METRIC RANGES
</h4>
```

**Tasks:**
- [ ] Audit all section headers in `AdvancedFiltersPanel.tsx`
- [ ] Apply consistent pattern: `text-caption font-medium text-text-tertiary uppercase tracking-wide`
- [ ] Ensure `mb-3` spacing below headers
- [ ] Verify dividers use: `h-px bg-border-subtle my-6`

### 2.2 Form Labels
**Status:** [ ] Not Started

**Target Pattern:**
```tsx
<label className="text-caption text-text-secondary">
  {label}
</label>
```

**Tasks:**
- [ ] Audit all form labels in filter components
- [ ] Standardize to `text-caption text-text-secondary`
- [ ] Ensure consistent `mb-1.5` spacing between label and input

### 2.3 Empty State Text
**Status:** [ ] Not Started

**Target (Companies EmptyState.tsx):**
```tsx
<h3 className="text-heading-md font-semibold text-text-primary mb-2">
  No games match your filters
</h3>
<p className="text-body text-text-secondary text-center max-w-md mb-6">
  Try adjusting your search or filter criteria...
</p>
```

**Tasks:**
- [ ] Verify `EmptyState.tsx` matches companies typography exactly
- [ ] Check suggestion bullet styling: `<span className="text-accent-blue mt-0.5">•</span>`
- [ ] Verify icon circle: `w-16 h-16 rounded-full bg-surface-overlay`

---

## Phase 3: Cell Renderers & Data Display

### 3.1 GrowthCell Alignment
**Status:** [x] Already Matching

**Target Thresholds (Companies):**
```typescript
>= 50%:  🚀 #22c55e (font-semibold) → "+X.X%"
10-49%:  ↑  --accent-green          → "+X.X%"
-10-10%: →  --text-tertiary         → "±X.X%"
-49--10%:↓  --accent-orange         → "-X.X%"
<= -50%: 📉 --accent-red (font-semibold) → "-X.X%"
null:    —  (em dash, muted)
```

**Tasks:**
- [x] Verify `GrowthCell.tsx` uses exact same thresholds - CONFIRMED IDENTICAL

### 3.2 SparklineCell Loading State
**Status:** [ ] Not Started

**Target (Companies):**
- Loading: `w-[70px] h-[24px] bg-surface-overlay animate-pulse rounded`
- No Data: `w-[70px] h-[24px] flex items-center justify-center` → "—"

**Tasks:**
- [ ] Verify `SparklineCell.tsx` loading skeleton matches exactly
- [ ] Verify dimensions: 70x24px
- [ ] Verify empty state shows em dash centered

### 3.3 Table Row Styling
**Status:** [ ] Not Started

**Target (Companies):**
```tsx
// Default row
<tr className="hover:bg-surface-overlay transition-colors">

// Selected row
<tr className={isSelected ? 'bg-accent-blue/5' : ''}>
```

**Tasks:**
- [ ] Verify `AppsTable.tsx` row hover: `hover:bg-surface-overlay transition-colors`
- [ ] Verify selected row: `bg-accent-blue/5`
- [ ] Verify mobile card selection: `ring-2 ring-accent-blue/50`

### 3.4 Sort Header Styling
**Status:** [ ] Not Started

**Target (Companies):**
- Active: `text-accent-blue` with arrow indicator (↑ asc, ↓ desc)
- Inactive: `text-text-tertiary hover:text-text-primary transition-colors`
- Non-sortable: disabled styling

**Tasks:**
- [ ] Verify sort header active state uses `text-accent-blue`
- [ ] Verify arrow indicators (↑/↓) appear correctly
- [ ] Verify hover transition on inactive headers

---

## Phase 4: Interactive Elements

### 4.1 Search Bar
**Status:** [ ] Not Started

**Target (Companies SearchBar.tsx):**
```tsx
className="pl-10 pr-10" // Icons on both sides
// Left: Search icon (or spinner when pending)
// Right: X clear button (only when value exists)
// Focus: focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary
```

**Tasks:**
- [ ] Verify padding for dual icons: `pl-10 pr-10`
- [ ] Verify spinner replaces search icon when loading
- [ ] Verify X button only shows when value exists
- [ ] Verify focus ring styling matches

### 4.2 Checkbox Styling
**Status:** [ ] Not Started

**Target (Companies):**
```tsx
<div className="w-4 h-4 rounded border transition-colors flex items-center justify-center"
     style={{
       backgroundColor: isSelected ? 'var(--accent-blue)' : 'transparent',
       borderColor: isSelected ? 'var(--accent-blue)' : 'var(--border-subtle)',
     }}>
  {isSelected && <Check className="w-3 h-3 text-white" />}
</div>
```

**Tasks:**
- [ ] Verify checkbox uses CSS variables, not Tailwind classes for dynamic colors
- [ ] Verify dimensions: `w-4 h-4`
- [ ] Verify check icon: `w-3 h-3 text-white`
- [ ] Verify indeterminate state uses `<Minus />` icon

### 4.3 Dropdown Patterns
**Status:** [ ] Not Started

**Target (Companies ColumnSelector):**
```tsx
// Button
className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-subtle bg-surface hover:bg-surface-elevated"

// Chevron rotation
className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}

// Menu
className="absolute right-0 top-full mt-1 w-72 bg-surface-elevated rounded-lg border border-border-subtle shadow-lg z-50"
```

**Tasks:**
- [ ] Verify `ColumnSelector.tsx` dropdown button styling
- [ ] Verify chevron rotates 180° on open with transition
- [ ] Verify menu positioning and shadow
- [ ] Verify close on outside click via `mousedown` listener

### 4.4 DualRangeSlider
**Status:** [ ] Not Started

**Target (Companies):**
```tsx
// Track highlight
<div className="absolute top-0 h-full bg-accent-primary/40 rounded-full" />

// Thumbs
className="w-4 h-4 rounded-full bg-surface border-2 border-accent-primary shadow-sm"

// Hover state
hover:scale-110 → drag: scale-110 cursor-grabbing
```

**Tasks:**
- [ ] Verify track highlight color: `bg-accent-primary/40`
- [ ] Verify thumb styling: `w-4 h-4 rounded-full bg-surface border-2 border-accent-primary`
- [ ] Verify hover scale: `hover:scale-110`
- [ ] Verify dragging state: `scale-110 cursor-grabbing`

---

## Phase 5: Bulk Actions & Modals

### 5.1 BulkActionsBar
**Status:** [ ] Not Started

**Current (Apps) - MISSING PIN ALL BUTTON:**

```tsx
// apps/components/BulkActionsBar.tsx - Only has 3 buttons
<Button variant="primary">Compare</Button>
{onExport && <Button variant="secondary">Export</Button>}
<Button variant="ghost">Clear</Button>
```

**Target (Companies) - HAS PIN ALL BUTTON:**

```tsx
// companies/components/BulkActionsBar.tsx - Has 4 buttons
<Button variant="primary">Compare</Button>
<Button variant="secondary" disabled={isPinning}>
  {isPinning ? <Loader2 className="animate-spin" /> : <Pin />}
  {isPinning ? 'Pinning...' : 'Pin All'}
</Button>
<Button variant="secondary">Export</Button>
<Button variant="ghost">Clear</Button>
```

**Styling is IDENTICAL for both - just missing the Pin All button:**
```tsx
// Position & container (both have this)
className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40"
className="flex items-center gap-2 px-4 py-3 bg-surface-elevated border border-border-subtle rounded-xl shadow-lg"

// Count badge (both have this)
<div className="w-5 h-5 rounded bg-accent-blue flex items-center justify-center">
  <span className="text-white text-caption font-medium">{selectedCount > 9 ? '9+' : selectedCount}</span>
</div>

// Animation (both have this)
animation: slide-up 0.2s ease-out;
```

**Tasks:**
- [ ] Add `isPinning` prop to BulkActionsBar
- [ ] Add `onPinAll` callback prop
- [ ] Add "Pin All" button between Compare and Export
- [ ] Add loading state with Loader2 spinner
- [ ] Import Pin and Loader2 from lucide-react
- [ ] Add title tooltip: `Pin ${selectedCount} games to dashboard`

### 5.2 CompareMode Modal
**Status:** [ ] Not Started

**Target (Companies):**
```tsx
// Backdrop
className="fixed inset-0 z-50 flex items-center justify-center"
<div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

// Modal
className="w-full max-w-5xl mx-4 rounded-xl max-h-[90vh] flex flex-col"

// Best value highlight
className="bg-accent-green/10 text-accent-green font-medium"

// Worst value highlight
className="bg-accent-red/10 text-accent-red"
```

**Tasks:**
- [ ] Verify backdrop: `bg-black/50 backdrop-blur-sm`
- [ ] Verify modal max-width: `max-w-5xl`
- [ ] Verify best/worst value highlighting colors
- [ ] Verify baseline badge styling
- [ ] Verify ESC key closes modal
- [ ] Verify focus management (close button focused on open)

### 5.3 ExportDialog
**Status:** [ ] Not Started

**Target Pattern:**
- Radio buttons for format (CSV/JSON)
- Radio buttons for scope (Filtered/Selected)
- Checkboxes for options (Visible columns, Metadata)
- Footer with Cancel/Export buttons

**Tasks:**
- [ ] Verify radio button styling matches companies pattern
- [ ] Verify checkbox styling matches
- [ ] Verify button variants: Cancel (ghost), Export (primary)
- [ ] Verify icon usage in buttons

---

## Phase 6: Advanced Filters Panel

### 6.1 Panel Container
**Status:** [ ] Not Started

**Target (Companies):**
```tsx
<div className="rounded-lg border border-border-subtle bg-surface-raised">
  {/* Active count header (conditional) */}
  {activeCount > 0 && (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle bg-surface-overlay/30">
      {activeCount} filter{s} active
      <button className="flex items-center gap-1.5 px-2.5 py-1 rounded text-caption font-medium text-accent-red hover:bg-accent-red/10">
        <X className="h-3.5 w-3.5" /> Clear all
      </button>
    </div>
  )}
  <div className="p-4">
    {/* Grid sections */}
  </div>
</div>
```

**Tasks:**
- [ ] Verify panel uses `bg-surface-raised` (not elevated)
- [ ] Add active filter count header if not present
- [ ] Verify "Clear all" button styling: `text-accent-red hover:bg-accent-red/10`
- [ ] Verify X icon size: `h-3.5 w-3.5`

### 6.2 Grid Layout
**Status:** [ ] Not Started

**Target (Companies):**
```tsx
<div className="grid grid-cols-12 gap-6">
  <div className="col-span-12 lg:col-span-8">
    {/* Metrics (2-column grid inside) */}
  </div>
  <div className="col-span-12 lg:col-span-4">
    {/* Growth */}
  </div>
</div>

{/* Divider */}
<div className="h-px bg-border-subtle my-6" />
```

**Tasks:**
- [ ] Verify 12-column grid: `grid grid-cols-12 gap-6`
- [ ] Verify responsive columns: `col-span-12 lg:col-span-8`
- [ ] Verify dividers: `h-px bg-border-subtle my-6`
- [ ] Verify inner grids use `grid-cols-1 md:grid-cols-2`

### 6.3 Filter Section Organization
**Status:** [ ] Not Started

**Companies Organization:**
1. Metrics (8 cols) + Growth (4 cols)
2. Content (8 cols) + Platform & Deck (4 cols)
3. Relationship + Activity (12 cols, 2-column grid inside)

**Tasks:**
- [ ] Verify filter sections match this organization
- [ ] Verify section headers are consistent
- [ ] Verify spacing between sections

---

## Phase 7: Responsive Patterns

### 7.1 Mobile Table → Cards
**Status:** [ ] Not Started

**Target (Companies):**
```tsx
{/* Desktop: hidden on mobile */}
<div className="hidden md:block overflow-x-auto scrollbar-thin rounded-lg border">
  <table>...</table>
</div>

{/* Mobile: hidden on desktop */}
<div className="md:hidden space-y-2">
  {apps.map((app) => (
    <div className="flex items-stretch gap-2">
      <button>Checkbox</button>
      <Link>
        <Card variant="interactive" padding="sm">
          {/* 2x3 grid of metrics */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        </Card>
      </Link>
    </div>
  ))}
</div>
```

**Tasks:**
- [ ] Verify desktop table uses `hidden md:block`
- [ ] Verify mobile cards use `md:hidden space-y-2`
- [ ] Verify mobile card layout: checkbox + card link
- [ ] Verify mobile card metric grid: `grid-cols-2 gap-x-4 gap-y-1`

### 7.2 Filter Bar Responsiveness
**Status:** [ ] Not Started

**Target (Companies):**
```tsx
// Row 1
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

// Search bar
<div className="w-full sm:max-w-md">

// Tool button labels
<span className="hidden sm:inline">Export</span>
```

**Tasks:**
- [ ] Verify type toggle + search stack vertically on mobile
- [ ] Verify search bar: `w-full sm:max-w-md`
- [ ] Verify tool button labels hide on mobile: `hidden sm:inline`

---

## Phase 8: Animation & Transitions

### 8.1 Standard Transitions
**Status:** [ ] Not Started

**Target:**
```css
/* Color changes */
transition-colors duration-150

/* Transform (scale) */
transition-transform duration-100

/* Rotation (chevrons) */
transition-transform duration-200

/* All interactive elements should have at least one */
```

**Tasks:**
- [ ] Audit all interactive elements for transitions
- [ ] Add `transition-colors duration-150` to buttons/links
- [ ] Add `transition-transform` to elements that scale/rotate
- [ ] Verify no elements "pop" without smooth transition

### 8.2 Slide-Up Animation
**Status:** [ ] Not Started

**Target (BulkActionsBar):**
```css
@keyframes slide-up {
  from { opacity: 0; transform: translateX(-50%) translateY(20px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
animation: slide-up 0.2s ease-out;
```

**Tasks:**
- [ ] Verify slide-up animation exists in globals.css or component
- [ ] Verify BulkActionsBar uses this animation
- [ ] Verify timing: `0.2s ease-out`

---

## Phase 9: Accessibility

### 9.1 ARIA Attributes
**Status:** [ ] Not Started

**Target (Companies):**
```tsx
// Modals
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">

// Selection announcements
<div role="status" aria-live="polite">{count} selected</div>

// Icon buttons
<button aria-label="Close" title="Close">
<button aria-label="Pin to dashboard" title="Pin to dashboard">
```

**Tasks:**
- [ ] Verify CompareMode modal has `role="dialog" aria-modal="true"`
- [ ] Verify selection count uses `role="status" aria-live="polite"`
- [ ] Verify all icon-only buttons have `aria-label` and `title`
- [ ] Verify decorative elements have `aria-hidden="true"`

### 9.2 Focus Management
**Status:** [ ] Not Started

**Tasks:**
- [ ] Verify modals trap focus
- [ ] Verify ESC key closes modals
- [ ] Verify focus moves to close button on modal open
- [ ] Verify all interactive elements have `focus-visible:ring-2`

---

## Phase 10: Naming Conventions

### 10.1 File Naming
**Status:** [ ] Not Started

**Companies Pattern:**
- `CompaniesPageClient.tsx` (main orchestrator)
- `CompaniesTable.tsx` (table component)
- `companies-types.ts` (types)
- `companies-columns.ts` (column definitions)
- `companies-presets.ts` (presets + quick filters)
- `companies-queries.ts` (data fetching)
- `companies-export.ts` (export logic)
- `companies-compare.ts` (compare logic)
- `companies-methodology.ts` (tooltips)

**Apps Current:**
- Similar pattern but verify exact naming

**Tasks:**
- [ ] Verify all lib files use `apps-` prefix consistently
- [ ] Verify hooks use `useApps` prefix consistently
- [ ] Verify component files use PascalCase

### 10.2 Hook Naming
**Status:** [ ] Not Started

**Companies Pattern:**
- `useCompaniesFilters` → `useAppsFilters` ✓
- `useCompaniesSelection` → `useAppsSelection` ✓
- `useCompaniesCompare` → `useAppsCompare` ✓
- `useSparklineLoader` (shared pattern)
- `useFilterCounts` (shared pattern)

**Tasks:**
- [ ] Verify all hooks follow this naming pattern
- [ ] Verify hook return shapes are consistent

---

## Verification Checklist

After all changes, verify:

- [ ] Visual comparison: Open /companies and /apps side by side
- [ ] Filter pills look identical (active/inactive states)
- [ ] Table row hover/selection looks identical
- [ ] Growth cells use same colors and thresholds
- [ ] Sparklines have same dimensions and loading states
- [ ] Bulk actions bar animates the same way
- [ ] Compare modal has same highlighting
- [ ] Empty state has same styling
- [ ] All transitions are smooth (150-200ms)
- [ ] Mobile view matches (card layout, spacing)
- [ ] Dark mode works correctly for all components

---

## Quick Reference: Key CSS Classes

### Colors (use CSS variables, not Tailwind colors)
```
bg-surface, bg-surface-elevated, bg-surface-raised, bg-surface-overlay
text-text-primary, text-text-secondary, text-text-tertiary, text-text-muted
border-border-subtle, border-border-prominent, border-border-muted
bg-accent-primary, bg-accent-blue, bg-accent-green, bg-accent-red, bg-accent-orange, bg-accent-purple
```

### Typography
```
text-heading-md font-semibold    /* Section titles */
text-heading-sm font-semibold    /* Component titles */
text-body font-medium            /* Body text */
text-body-sm                     /* Smaller body */
text-caption font-medium         /* Labels (often uppercase tracking-wide) */
```

### Spacing
```
gap-1.5, gap-2, gap-3, gap-4, gap-6   /* Standard gaps */
p-2, p-3, p-4, p-6                    /* Padding */
px-3 py-2                             /* Button padding */
my-6                                  /* Section dividers */
mb-3                                  /* Header to content */
```

### Interactive
```
hover:bg-surface-overlay transition-colors duration-150
focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2
disabled:opacity-50 disabled:cursor-not-allowed
```

---

## Implementation Order (Prioritized by Impact)

### HIGH PRIORITY (Major Differences)
These are the components that are visibly different and need immediate attention:

1. **Create FilterPill.tsx** (copy from companies)
   - Single source of truth for pill styling
   - Enables consistent active/inactive states

2. **Create UnifiedFilterBar.tsx** (new architecture)
   - Merge PresetViews + QuickFilters
   - Add tools section (Columns, Saved Views, Export)
   - Delete old separate components

3. **Rewrite ContextBar.tsx** (was SummaryStatsBar)
   - Simplify from card layout to inline
   - Use dot separators instead of pipes
   - Remove icons

4. **Add Pin All to BulkActionsBar.tsx**
   - Add isPinning state and onPinAll callback
   - Add loading spinner

### MEDIUM PRIORITY (Minor Differences)
These may already be close but should be audited:

5. **Audit AdvancedFiltersPanel.tsx**
   - Verify grid layout matches (12-col)
   - Check section header styling
   - Verify divider styling

6. **Audit Typography**
   - Check all section headers use `text-caption uppercase tracking-wide`
   - Verify form labels use `text-caption text-text-secondary`

### LOW PRIORITY (Likely Already Matching)
Based on code review, these are likely already consistent:

7. GrowthCell - Already identical
8. SparklineCell - Verify dimensions (70x24)
9. Table row styling - Verify hover/selection states
10. Animation timing - Verify 150-200ms transitions

---

## Verification Steps

After implementation, test in this order:

### 1. Visual Comparison
```
1. Open /companies in one browser tab
2. Open /apps in another tab
3. Toggle between tabs, comparing:
   - Filter bar layout and pill styles
   - Active preset color (should be teal, not purple)
   - Dot indicator on inactive presets
   - Context/summary bar appearance
```

### 2. Interactive Testing
```
1. Select multiple items on both pages
2. Verify bulk actions bar looks identical
3. Verify "Pin All" button exists on apps page
4. Test compare mode on both pages
5. Test export dialog on both pages
```

### 3. Responsive Testing
```
1. Resize browser to mobile width (<768px)
2. Verify filter pills scroll horizontally
3. Verify mobile card layout matches
4. Verify tool labels hide on mobile
```

### 4. Dark Mode Testing
```
1. Toggle to dark mode
2. Verify all components render correctly
3. Check for any hardcoded colors that don't adapt
```

---

## Files Changed Summary

| Action | File | Description |
|--------|------|-------------|
| CREATE | `apps/components/FilterPill.tsx` | Copy from companies |
| CREATE | `apps/components/UnifiedFilterBar.tsx` | Copy from companies, adapt |
| RENAME | `SummaryStatsBar.tsx` → `ContextBar.tsx` | Then rewrite |
| DELETE | `apps/components/PresetViews.tsx` | Merged into UnifiedFilterBar |
| DELETE | `apps/components/QuickFilters.tsx` | Merged into UnifiedFilterBar |
| MODIFY | `apps/components/BulkActionsBar.tsx` | Add Pin All button |
| MODIFY | `apps/components/AppsPageClient.tsx` | Use new components |
| MODIFY | `apps/lib/apps-presets.ts` | Add UNIFIED_FILTERS |

---

*Last updated: January 16, 2026*
