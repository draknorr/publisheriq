# Design System Migration Plan: Warm Stone + Dusty Coral

## Overview

Incremental migration from current teal/cyan design to the new "Warm Stone + Dusty Coral" editorial design system. The migration preserves backward compatibility at each phase.

**Design Philosophy:**
- Warm stone-toned neutrals instead of cool grays
- Dusty coral accent — distinctive, desaturated for premium feel
- Editorial/sophisticated rather than "startup blue"
- Typography: DM Sans (body), JetBrains Mono (numbers/data)

---

# Phase 1: Foundation (COMPLETED)

## Summary
Migrated the design system foundation from Geist fonts + `.dark` class theming to DM Sans/JetBrains Mono fonts + `data-theme` attribute theming, while maintaining **zero visual changes** through compatibility aliases.

## What Was Done

### Step 1: Install Font Packages
**File:** `apps/admin/package.json`

Added dependencies:
```json
"@fontsource-variable/dm-sans": "^5.0.7",
"@fontsource-variable/jetbrains-mono": "^5.0.23"
```

### Step 2: Update globals.css
**File:** `apps/admin/src/app/globals.css`

- Added font imports at top (before @tailwind directives)
- Updated light theme selector: `:root` → `:root, [data-theme="light"]`
- Updated dark theme selector: `.dark` → `.dark, [data-theme="dark"]`
- Added typography variables (`--font-sans`, `--font-mono`)
- Added new design system variables alongside existing ones:
  - `--surface-base`, `--surface-secondary`, `--surface-tertiary`, `--surface-invert`
  - `--border-default`, `--border-hover`, `--border-active`
  - `--text-invert`, `--text-link`, `--text-link-hover`
  - `--semantic-success`, `--semantic-warning`, `--semantic-error`, `--semantic-info` (with `-muted` variants)
  - Component tokens: table, sidebar, card, input, badge, focus ring
- Updated `::selection` to support both selectors

### Step 3: Update Tailwind Config
**File:** `apps/admin/tailwind.config.cjs`

- Updated darkMode: `'class'` → `['class', '[data-theme="dark"]']`
- Updated fontFamily.sans to include `var(--font-sans)` with Geist fallback
- Updated fontFamily.mono to include `var(--font-mono)` with Geist fallback

### Step 4: Update ThemeContext
**File:** `apps/admin/src/contexts/ThemeContext.tsx`

- Added `applyTheme(resolved)` helper function that:
  - Sets `data-theme` attribute (new primary method)
  - Also sets `.dark` class (backward compatibility)
- Replaced direct class manipulation with `applyTheme()` calls

### Step 5: Update Root Layout
**File:** `apps/admin/src/app/layout.tsx`

- Added font imports: `@fontsource-variable/dm-sans` and `@fontsource-variable/jetbrains-mono`
- Added `data-theme="light"` default attribute on `<html>` element
- Updated theme script to set both `data-theme` attribute AND `.dark` class

## Files Modified
- `apps/admin/package.json`
- `apps/admin/src/app/globals.css`
- `apps/admin/tailwind.config.cjs`
- `apps/admin/src/contexts/ThemeContext.tsx`
- `apps/admin/src/app/layout.tsx`

## Status: COMPLETE

---

# Phase 2: Apply New Color Values

## Summary
Replace the current teal/cyan color values with the new Warm Stone + Dusty Coral palette. This phase changes the actual colors while keeping existing variable names working through aliases.

## Key Principle
After this phase, the app will look different (coral instead of teal), but all existing Tailwind classes (`bg-surface`, `text-accent-primary`, etc.) continue to work.

---

## Implementation Steps

### Step 1: Update globals.css with New Color Values
**File:** `apps/admin/src/app/globals.css`

Replace the color values in both light and dark theme sections with the new Warm Stone palette from `redesignv2/variables.css`.

**Light Theme Changes:**
```css
:root,
[data-theme="light"] {
  /* Surfaces - Warm Stone */
  --surface: #FAF9F7;           /* was: #ffffff */
  --surface-raised: #FFFFFF;    /* same */
  --surface-elevated: #F8F6F3;  /* was: #f1f5f9 */
  --surface-overlay: #27272a;   /* keep for modals */
  --surface-base: #FAF9F7;
  --surface-sunken: #F5F3EF;    /* NEW */

  /* Borders - Warm tones */
  --border-subtle: #F0EDE8;     /* was: #e2e8f0 */
  --border-muted: #E8E4DE;      /* was: #cbd5e1 */
  --border-prominent: #DDD8D0;  /* was: #94a3b8 */
  --border-default: #E8E4DE;
  --border-strong: #DDD8D0;
  --border-focus: #D4716A;      /* NEW - coral focus ring */

  /* Text - Warm neutrals */
  --text-primary: #2D2A26;      /* was: #0f172a */
  --text-secondary: #5C5752;    /* was: #475569 */
  --text-tertiary: #7A756D;     /* was: #64748b */
  --text-muted: #9A958D;        /* was: #94a3b8 */
  --text-placeholder: #9A958D;  /* NEW */

  /* Primary accent - Dusty Coral */
  --accent-primary: #D4716A;           /* was: #0891b2 (teal) */
  --accent-primary-hover: #C46359;     /* was: #0e7490 */
  --accent-primary-muted: rgba(212, 113, 106, 0.1);
  --accent-primary-subtle: #FBF0EF;    /* NEW */

  /* Semantic colors */
  --semantic-success: #2D8A6E;
  --semantic-success-text: #1E6B54;
  --semantic-success-muted: #E6F4EF;
  --semantic-error: #B54D42;
  --semantic-error-text: #9C4338;
  --semantic-error-muted: #FDF4F3;
  --semantic-warning: #D97706;
  --semantic-warning-muted: #FEF8E8;
  --semantic-info: #0E7490;
  --semantic-info-muted: #ECFEFF;

  /* Trend indicators - use semantic colors */
  --trend-positive: #1E6B54;    /* was: #10b981 */
  --trend-negative: #9C4338;    /* was: #ef4444 */
  --trend-neutral: #7A756D;     /* was: #64748b */

  /* Chart colors */
  --chart-1: #D4716A;           /* coral */
  --chart-2: #2D8A6E;           /* green */
  --chart-3: #D97706;           /* amber */
  --chart-4: #0E7490;           /* teal */
  --chart-5: #7C3AED;           /* purple */
  --chart-6: #EC4899;           /* pink */
  --chart-grid: #E8E4DE;
  --chart-axis: #7A756D;

  /* Shadows - warm tint */
  --shadow-xs: 0 1px 2px rgba(45, 42, 38, 0.04);
  --shadow-sm: 0 2px 4px rgba(45, 42, 38, 0.06), 0 1px 2px rgba(45, 42, 38, 0.04);
  --shadow-md: 0 4px 8px rgba(45, 42, 38, 0.08), 0 2px 4px rgba(45, 42, 38, 0.04);
  --shadow-focus: 0 0 0 3px rgba(212, 113, 106, 0.25);
}
```

**Dark Theme Changes:**
```css
.dark,
[data-theme="dark"] {
  /* Surfaces - Warm dark */
  --surface: #1A1816;           /* was: #09090b */
  --surface-raised: #211F1C;    /* was: #0f0f12 */
  --surface-elevated: #292623;  /* was: #18181b */
  --surface-overlay: #292623;
  --surface-base: #1A1816;
  --surface-sunken: #151311;

  /* Borders */
  --border-subtle: #292623;     /* was: #27272a */
  --border-muted: #332F2A;      /* was: #3f3f46 */
  --border-prominent: #3D3935;  /* was: #52525b */
  --border-default: #332F2A;
  --border-strong: #3D3935;
  --border-focus: #E07D75;

  /* Text */
  --text-primary: #E8E4DE;      /* was: #fafafa */
  --text-secondary: #B5B0A8;    /* was: #a1a1aa */
  --text-tertiary: #8A847A;     /* was: #71717a */
  --text-muted: #6B665E;        /* was: #52525b */
  --text-placeholder: #6B665E;

  /* Primary accent - Coral (brighter for dark) */
  --accent-primary: #E07D75;           /* was: #22d3ee (cyan) */
  --accent-primary-hover: #E68D86;     /* was: #06b6d4 */
  --accent-primary-muted: rgba(224, 125, 117, 0.12);
  --accent-primary-subtle: rgba(224, 125, 117, 0.12);

  /* Semantic colors (dark mode) */
  --semantic-success: #5DD4A8;
  --semantic-success-text: #5DD4A8;
  --semantic-success-muted: rgba(93, 212, 168, 0.12);
  --semantic-error: #CF7F76;
  --semantic-error-text: #CF7F76;
  --semantic-error-muted: rgba(207, 127, 118, 0.12);
  --semantic-warning: #FBBF24;
  --semantic-warning-muted: rgba(251, 191, 36, 0.12);
  --semantic-info: #38BDF8;
  --semantic-info-muted: rgba(56, 189, 248, 0.12);

  /* Trend indicators */
  --trend-positive: #5DD4A8;
  --trend-negative: #CF7F76;
  --trend-neutral: #8A847A;

  /* Chart colors (dark) */
  --chart-1: #E07D75;
  --chart-2: #5DD4A8;
  --chart-3: #FBBF24;
  --chart-4: #38BDF8;
  --chart-5: #A78BFA;
  --chart-6: #F472B6;
  --chart-grid: #332F2A;
  --chart-axis: #8A847A;

  /* Shadows (dark) */
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.16);
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.20), 0 1px 2px rgba(0, 0, 0, 0.12);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.24), 0 2px 4px rgba(0, 0, 0, 0.16);
  --shadow-focus: 0 0 0 3px rgba(224, 125, 117, 0.3);
}
```

### Step 2: Update Selection Colors
**File:** `apps/admin/src/app/globals.css`

```css
/* Selection - coral tint */
::selection {
  background-color: rgba(212, 113, 106, 0.2);
}

.dark ::selection,
[data-theme="dark"] ::selection {
  background-color: rgba(224, 125, 117, 0.2);
}
```

### Step 3: Add Compatibility Aliases for Old Accent Colors
**File:** `apps/admin/src/app/globals.css`

Some components may use the old accent color names. Add aliases:

```css
:root,
[data-theme="light"] {
  /* Compatibility: old accent colors point to semantic equivalents */
  --accent-green: var(--semantic-success);
  --accent-red: var(--semantic-error);
  --accent-yellow: var(--semantic-warning);
  --accent-blue: var(--semantic-info);
  --accent-cyan: var(--accent-primary);  /* coral replaces cyan as primary */
  --accent-purple: #7C3AED;
  --accent-orange: #F97316;
  --accent-pink: #EC4899;
}

.dark,
[data-theme="dark"] {
  --accent-green: var(--semantic-success);
  --accent-red: var(--semantic-error);
  --accent-yellow: var(--semantic-warning);
  --accent-blue: var(--semantic-info);
  --accent-cyan: var(--accent-primary);
  --accent-purple: #A78BFA;
  --accent-orange: #FB923C;
  --accent-pink: #F472B6;
}
```

### Step 4: Update Tailwind Config with New Shadow Utilities
**File:** `apps/admin/tailwind.config.cjs`

Add the new shadow variables:

```js
boxShadow: {
  'xs': 'var(--shadow-xs)',
  'sm': 'var(--shadow-sm)',
  'md': 'var(--shadow-md)',
  'focus': 'var(--shadow-focus)',
  // ... keep existing shadows
},
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/admin/src/app/globals.css` | Replace color values, add aliases |
| `apps/admin/tailwind.config.cjs` | Add shadow utilities |

---

## Verification

After implementation:

1. **Visual change**: App now shows coral accent instead of teal
2. **Light mode**: Warm stone backgrounds (#FAF9F7), coral buttons
3. **Dark mode**: Warm dark backgrounds (#1A1816), lighter coral
4. **Theme toggle**: Works, no flash
5. **All existing classes work**: `bg-surface`, `text-accent-primary`, etc.
6. **Build passes**: `pnpm --filter admin build`

---

# Phase 3: Home Page Polish

## Summary
Verify and polish the home page (`/`) with the new design. Minimal changes expected since it uses CSS variables.

---

## Implementation Steps

### Step 1: Verify Home Page Rendering
**File:** `apps/admin/src/app/page.tsx`

The home page uses these classes that should auto-update:
- `bg-surface` → warm stone background
- `bg-accent-primary` → coral icon background
- `text-text-primary`, `text-text-secondary` → warm neutrals

**Check these elements:**
- Hero icon: `bg-accent-primary` should be coral
- Buttons: Primary button should be coral
- Footer: Green pulse dot (`bg-accent-green`) → may need update

### Step 2: Update Footer Pulse Dot (if needed)
**File:** `apps/admin/src/app/page.tsx`

If `bg-accent-green` doesn't look right, update to use semantic token:

```tsx
// Before
<div className="h-2 w-2 rounded-full bg-accent-green animate-pulse-subtle" />

// After (if needed)
<div className="h-2 w-2 rounded-full bg-semantic-success animate-pulse-subtle" />
```

Or add Tailwind mapping for semantic colors in tailwind.config.cjs.

### Step 3: Add Semantic Color Utilities to Tailwind
**File:** `apps/admin/tailwind.config.cjs`

```js
colors: {
  // ... existing colors
  semantic: {
    success: 'var(--semantic-success)',
    'success-text': 'var(--semantic-success-text)',
    'success-subtle': 'var(--semantic-success-muted)',
    error: 'var(--semantic-error)',
    'error-text': 'var(--semantic-error-text)',
    'error-subtle': 'var(--semantic-error-muted)',
    warning: 'var(--semantic-warning)',
    'warning-subtle': 'var(--semantic-warning-muted)',
    info: 'var(--semantic-info)',
    'info-subtle': 'var(--semantic-info-muted)',
  },
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/admin/src/app/page.tsx` | Verify styling, update footer dot if needed |
| `apps/admin/tailwind.config.cjs` | Add semantic color utilities |

---

## Verification

1. **Home page renders**: Coral accent on icon and buttons
2. **Footer**: Green dot visible, theme toggle works
3. **Both themes**: Light and dark look correct
4. **No console errors**

---

# Phase 4: /apps Page Migration

## Summary
Update the Games page (`/apps`) with the new design. This is the most complex phase due to Sparklines (hardcoded colors) and data tables.

---

## Implementation Steps

### Step 1: Update Sparkline Colors
**File:** `apps/admin/src/components/data-display/Sparkline.tsx`

**Problem:** Recharts uses hardcoded hex colors that can't read CSS variables dynamically.

**Solution:** Create a color map that matches both themes:

```tsx
// New color map using design system chart colors
const colorMap = {
  // Primary colors
  coral: { stroke: '#D4716A', fill: '#D4716A' },      // --chart-1
  green: { stroke: '#2D8A6E', fill: '#2D8A6E' },      // --chart-2 (success)
  amber: { stroke: '#D97706', fill: '#D97706' },      // --chart-3
  teal: { stroke: '#0E7490', fill: '#0E7490' },       // --chart-4
  purple: { stroke: '#7C3AED', fill: '#7C3AED' },     // --chart-5
  pink: { stroke: '#EC4899', fill: '#EC4899' },       // --chart-6

  // Semantic (for trends)
  success: { stroke: '#2D8A6E', fill: '#2D8A6E' },
  error: { stroke: '#B54D42', fill: '#B54D42' },

  // Legacy aliases
  blue: { stroke: '#0E7490', fill: '#0E7490' },       // maps to teal
  red: { stroke: '#B54D42', fill: '#B54D42' },        // maps to error
  cyan: { stroke: '#D4716A', fill: '#D4716A' },       // maps to coral
  orange: { stroke: '#D97706', fill: '#D97706' },     // maps to amber
};

// Update type
interface SparklineProps {
  color?: keyof typeof colorMap;
  // ...
}
```

**Update TrendSparkline:**
```tsx
export function TrendSparkline({ trend = 'stable', ...props }: TrendSparklineProps) {
  const color = trend === 'up' ? 'success' : trend === 'down' ? 'error' : 'coral';
  return <Sparkline {...props} color={color} />;
}
```

### Step 2: Create Theme-Aware Sparkline (Optional Enhancement)
**File:** `apps/admin/src/components/data-display/Sparkline.tsx`

For proper dark mode support, use a hook to detect theme:

```tsx
import { useTheme } from '@/contexts/ThemeContext';

// Color maps for each theme
const lightColors = {
  coral: { stroke: '#D4716A', fill: '#D4716A' },
  success: { stroke: '#2D8A6E', fill: '#2D8A6E' },
  error: { stroke: '#B54D42', fill: '#B54D42' },
  // ...
};

const darkColors = {
  coral: { stroke: '#E07D75', fill: '#E07D75' },
  success: { stroke: '#5DD4A8', fill: '#5DD4A8' },
  error: { stroke: '#CF7F76', fill: '#CF7F76' },
  // ...
};

export function Sparkline({ color = 'coral', ... }: SparklineProps) {
  const { resolvedTheme } = useTheme();
  const colorMap = resolvedTheme === 'dark' ? darkColors : lightColors;
  const { stroke, fill } = colorMap[color];
  // ...
}
```

### Step 3: Update GrowthCell Colors
**File:** `apps/admin/src/app/(main)/apps/components/GrowthCell.tsx`

Update trend indicator colors to use new semantic tokens:

```tsx
// Before
className={`text-trend-positive`}  // or text-trend-negative

// Should work via CSS variables, but verify visually
```

### Step 4: Update MomentumCell Colors
**File:** `apps/admin/src/app/(main)/apps/components/MomentumCell.tsx`

Same as GrowthCell - verify trend colors work.

### Step 5: Update AppsTable Styling
**File:** `apps/admin/src/app/(main)/apps/components/AppsTable.tsx`

Verify table uses CSS variables:
- Header background: Should use `--table-header-bg`
- Row hover: Should use `--table-row-hover`
- Borders: Should use `--table-border`

If using hardcoded colors, update to use variables.

### Step 6: Update UnifiedFilterBar
**File:** `apps/admin/src/app/(main)/apps/components/UnifiedFilterBar.tsx`

- Filter pills: Verify `bg-accent-primary-muted` works
- Active states: Coral highlight

### Step 7: Update SearchBar
**File:** `apps/admin/src/app/(main)/apps/components/SearchBar.tsx`

- Focus ring: Should be coral (`--border-focus`)
- Placeholder: Should use `--input-placeholder`

### Step 8: Update ContextBar
**File:** `apps/admin/src/app/(main)/apps/components/ContextBar.tsx`

- Stats cards: Verify background colors
- Trend indicators: Verify green/red

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/admin/src/components/data-display/Sparkline.tsx` | **Critical:** Replace hardcoded colors |
| `apps/admin/src/app/(main)/apps/components/GrowthCell.tsx` | Verify trend colors |
| `apps/admin/src/app/(main)/apps/components/MomentumCell.tsx` | Verify trend colors |
| `apps/admin/src/app/(main)/apps/components/AppsTable.tsx` | Verify table styling |
| `apps/admin/src/app/(main)/apps/components/UnifiedFilterBar.tsx` | Verify filter styling |
| `apps/admin/src/app/(main)/apps/components/SearchBar.tsx` | Verify input styling |
| `apps/admin/src/app/(main)/apps/components/ContextBar.tsx` | Verify stats styling |

---

## Verification

1. **Sparklines**: Show coral/green/red correctly in both themes
2. **Table**: Header has warm elevated background
3. **Trend indicators**: Green for positive, muted red for negative
4. **Filters**: Active state shows coral
5. **Search**: Focus ring is coral
6. **Both themes**: Check light and dark mode
7. **Build passes**

---

# Phase 5: Shared Components

## Summary
Update base UI components to fully adopt the new design system. These changes affect all pages.

---

## Implementation Steps

### Step 1: Update Button Component
**File:** `apps/admin/src/components/ui/Button.tsx`

Verify variant colors use CSS variables:
- Primary: `bg-accent-primary` (coral)
- Secondary: `bg-surface-raised` with border
- Ghost: transparent with hover

### Step 2: Update Badge Component
**File:** `apps/admin/src/components/ui/Badge.tsx`

Update to use semantic badge tokens:
```tsx
// Success badge
className="bg-badge-success-bg text-badge-success-text"
// or
className="bg-semantic-success-subtle text-semantic-success-text"
```

### Step 3: Update Card Component
**File:** `apps/admin/src/components/ui/Card.tsx`

Verify uses:
- `--card-bg` for background
- `--card-border` for border
- `--card-shadow` (or shadow-sm utility)

### Step 4: Update Input Component
**File:** `apps/admin/src/components/ui/Input.tsx`

Verify uses:
- `--input-bg`, `--input-border`
- Focus: `--input-border-focus` (coral)
- Placeholder: `--input-placeholder`

### Step 5: Update TrendIndicator Component
**File:** `apps/admin/src/components/data-display/TrendIndicator.tsx` (if exists)

Use semantic success/error text colors:
```tsx
const colorClass = trend === 'up'
  ? 'text-semantic-success-text'
  : trend === 'down'
  ? 'text-semantic-error-text'
  : 'text-text-tertiary';
```

### Step 6: Add `.font-data` Utility Class
**File:** `apps/admin/src/app/globals.css`

Add utility for monospace numbers:
```css
@layer utilities {
  .font-data {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }
}
```

### Step 7: Update Focus Ring Styles
**File:** `apps/admin/src/app/globals.css`

Update global focus styles to use coral:
```css
*:focus-visible {
  @apply outline-none ring-2 ring-offset-2 ring-offset-surface;
  box-shadow: var(--shadow-focus);
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/admin/src/components/ui/Button.tsx` | Verify accent colors |
| `apps/admin/src/components/ui/Badge.tsx` | Update semantic colors |
| `apps/admin/src/components/ui/Card.tsx` | Verify surface/border |
| `apps/admin/src/components/ui/Input.tsx` | Verify focus ring |
| `apps/admin/src/app/globals.css` | Add `.font-data`, update focus |

---

## Verification

1. **Buttons**: Primary is coral, hover states work
2. **Badges**: Success/error/warning have correct colors
3. **Cards**: Warm background and borders
4. **Inputs**: Coral focus ring
5. **Data numbers**: Monospace with `.font-data`
6. **All themes**: Light and dark mode correct

---

# Reference Files

| Purpose | File |
|---------|------|
| Design spec | `redesignv2/DESIGN-SYSTEM-HANDOFF.md` |
| CSS variables | `redesignv2/variables.css` |
| Tailwind reference | `redesignv2/tailwind.config.js` |
| Component reference | `redesignv2/components.css` |
| Migration status | `MIGRATION-STATUS.md` |

---

# Quick Reference: Color Changes

| Purpose | Old (Teal) | New (Coral) |
|---------|------------|-------------|
| Primary accent (light) | `#0891b2` | `#D4716A` |
| Primary accent (dark) | `#22d3ee` | `#E07D75` |
| Page bg (light) | `#ffffff` | `#FAF9F7` |
| Page bg (dark) | `#09090b` | `#1A1816` |
| Primary text (light) | `#0f172a` | `#2D2A26` |
| Primary text (dark) | `#fafafa` | `#E8E4DE` |
| Success (light) | `#10b981` | `#1E6B54` |
| Error (light) | `#ef4444` | `#9C4338` |

---

# After /clear

Just say: **"continue the redesign"** or **"start Phase 2"**

Claude will read `MIGRATION-STATUS.md` to know current progress.

---

# Phase 6: Companies Page (COMPLETED)

## Summary
Migrate the Companies page (`/companies`) to use semantic design tokens.

## Changes Made

### GrowthCell.tsx
**File:** `apps/admin/src/app/(main)/companies/components/GrowthCell.tsx`

| Line | Before | After |
|------|--------|-------|
| 27 | `text-[#22c55e]` | `text-semantic-success` |

**Note:** Lines 34, 48, 54 already used CSS variables.

---

# Phase 7: Insights Page (COMPLETED)

## Summary
Migrate the Insights dashboard (`/insights`) components to use semantic design tokens.

## Files Modified (7)

### 7.1 TopGameCard.tsx
**File:** `apps/admin/src/app/(main)/insights/components/TopGameCard.tsx`

| Function/Line | Before | After |
|---------------|--------|-------|
| getReviewColor (≥80) | `text-accent-green` | `text-semantic-success-text` |
| getReviewColor (≥70) | `text-lime-400` | `text-semantic-warning` |
| getReviewColor (≥50) | `text-accent-yellow` | `text-semantic-warning` |
| getReviewColor (<50) | `text-accent-red` | `text-semantic-error-text` |
| Growth indicator | `text-accent-green`/`text-accent-red` | `text-trend-positive`/`text-trend-negative` |
| Free price | `text-accent-green` | `text-semantic-success-text` |
| Discount | `text-accent-green` | `text-semantic-success-text` |

### 7.2 GameInsightCard.tsx
**File:** `apps/admin/src/app/(main)/insights/components/GameInsightCard.tsx`

| Tier | Before | After |
|------|--------|-------|
| Tier 1 | `bg-accent-green/15 text-accent-green` | `bg-semantic-success-subtle text-semantic-success` |
| Tier 2 | `bg-accent-blue/15 text-accent-blue` | `bg-semantic-info-subtle text-semantic-info` |

### 7.3 TopGamesTab.tsx
**File:** `apps/admin/src/app/(main)/insights/components/TopGamesTab.tsx`

| Card | Before | After |
|------|--------|-------|
| Total Peak CCU | `bg-accent-cyan/15 text-accent-cyan` | `bg-accent-primary-subtle text-accent-primary` |
| Avg Review Score | `bg-accent-green/15 text-accent-green` | `bg-semantic-success-subtle text-semantic-success` |
| Top Game | `bg-accent-purple/15 text-accent-purple` | `bg-chart-5/15 text-chart-5` |

### 7.4 TrendingGamesTab.tsx
**File:** `apps/admin/src/app/(main)/insights/components/TrendingGamesTab.tsx`

| Card | Before | After |
|------|--------|-------|
| Avg Growth icon | `bg-accent-green/15 text-accent-green` | `bg-semantic-success-subtle text-semantic-success` |
| Avg Growth value | `text-accent-green` | `text-trend-positive` |
| High Growth | `bg-accent-orange/15 text-accent-orange` | `bg-semantic-warning-subtle text-semantic-warning` |
| Top Gainer | `bg-accent-cyan/15 text-accent-cyan` | `bg-accent-primary-subtle text-accent-primary` |

### 7.5 NewestGamesTab.tsx
**File:** `apps/admin/src/app/(main)/insights/components/NewestGamesTab.tsx`

| Card | Before | After |
|------|--------|-------|
| New Games | `bg-accent-blue/15 text-accent-blue` | `bg-semantic-info-subtle text-semantic-info` |
| Avg Review Score | `bg-accent-green/15 text-accent-green` | `bg-semantic-success-subtle text-semantic-success` |
| Most Recent/Top Gainer | `bg-accent-purple/15 text-accent-purple` | `bg-chart-5/15 text-chart-5` |

### 7.6 PinnedCard.tsx
**File:** `apps/admin/src/app/(main)/insights/components/PinnedCard.tsx`

| Element | Before | After |
|---------|--------|-------|
| Game badge | `bg-accent-cyan/15 text-accent-cyan` | `bg-accent-primary-subtle text-accent-primary` |
| Publisher badge | `bg-accent-purple/15 text-accent-purple` | `bg-chart-5/15 text-chart-5` |
| Developer badge | `bg-accent-blue/15 text-accent-blue` | `bg-semantic-info-subtle text-semantic-info` |
| Review colors | Old accent colors + lime-400 | Semantic success/warning/error-text |
| CCU change | `text-accent-green`/`text-accent-red` | `text-trend-positive`/`text-trend-negative` |
| Discount | `text-accent-green` | `text-semantic-success-text` |
| Trend up/down | `text-accent-green`/`text-accent-red` | `text-trend-positive`/`text-trend-negative` |

### 7.7 MyDashboardTab.tsx
**File:** `apps/admin/src/app/(main)/insights/components/MyDashboardTab.tsx`

| Element | Before | After |
|---------|--------|-------|
| Browse links | `text-accent-blue` | `text-accent-primary` |

---

# Phase 8: Chat Components (COMPLETED)

## Summary
Migrate chat interface components to use semantic design tokens.

## Changes Made

### StreamingContent.tsx
**File:** `apps/admin/src/components/chat/content/StreamingContent.tsx`

| Element | Before | After |
|---------|--------|-------|
| Table cell links | `text-accent-blue hover:text-accent-blue/80` | `text-accent-primary hover:text-accent-primary/80` |
| Inline code | `text-accent-cyan` | `text-accent-primary` |
| Blockquote border | `border-accent-blue` | `border-accent-primary` |
| Streaming cursor | `bg-accent-blue` | `bg-accent-primary` |

**Note:** Code block background (`#0d1117`) intentionally preserved for GitHub dark theme aesthetic.

---

# Phase 9: Tailwind Config (COMPLETED)

## Summary
Add missing utility class for `accent-primary-subtle`.

## Changes Made

### tailwind.config.cjs
**File:** `apps/admin/tailwind.config.cjs`

Added `'primary-subtle': 'var(--accent-primary-subtle)'` to the accent color object.

---

# Phase 10: Verification (COMPLETED)

## Build Verification
- `pnpm --filter admin build` - **PASSED** ✓

## Visual Testing Checklist
- [x] `/companies` - Growth indicators use semantic success color
- [x] `/insights/my-dashboard` - Pinned cards, entity badges use semantic/chart colors
- [x] `/insights/top-games` - Summary cards use semantic colors
- [x] `/insights/trending` - Growth metrics use trend-positive color
- [x] `/insights/newest` - New releases use semantic info color
- [x] `/chat` - Inline code, blockquotes, streaming cursor use accent-primary

---

# Summary of Phases 6-10

| Phase | Scope | Files | Changes |
|-------|-------|-------|---------|
| 6 | /companies | 1 | 1 hex → semantic |
| 7 | /insights | 7 | ~35 accent → semantic/trend/chart |
| 8 | /chat | 1 | 4 accent-blue/cyan → accent-primary |
| 9 | Tailwind | 1 | Add accent-primary-subtle utility |
| 10 | Verification | - | Build test + documentation |

**Total: ~10 files, ~41 color token migrations**
