# Design System Architecture

This document describes the design system for PublisherIQ, including the theme system, color palette, typography, and component library.

**Last Updated:** January 25, 2026

---

## Overview

The design system provides:
- Dual light/dark theme support with system preference detection
- CSS variable-based color tokens for consistent theming
- Warm Stone color palette with Dusty Coral accents
- DM Sans and JetBrains Mono font families
- Pre-built animation utilities
- A library of reusable UI components

---

## Theme System

### Architecture

```
ThemeProvider (Context)
    ├── Theme State ('light' | 'dark' | 'system')
    ├── localStorage Persistence (key: 'publisheriq-theme')
    └── System Preference Detection (prefers-color-scheme)
```

### Theme Modes

| Mode | Description |
|------|-------------|
| `light` | Light theme with warm stone surfaces and coral accent |
| `dark` | Dark theme with warm dark surfaces and coral accent |
| `system` | Follows OS preference |

### Implementation

The theme system uses React Context with the following structure:

```tsx
// ThemeContext provides:
interface ThemeContextType {
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}
```

Theme is persisted to `localStorage` with key `publisheriq-theme` and applied using dual selectors:
- `.dark` class on the `<html>` element
- `[data-theme="dark"]` attribute on the `<html>` element

Both selectors are supported for compatibility with different theme implementations.

---

## Color Palette - Warm Stone Theme

### Surface Hierarchy

Surfaces provide visual depth and separation between UI layers.

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--surface` | `#FAF9F7` | `#1A1816` | Base background (warm off-white / warm dark) |
| `--surface-sunken` | `#F5F3F0` | `#141210` | Recessed areas, page backgrounds |
| `--surface-raised` | `#FFFFFF` | `#1E1C1A` | Cards, elevated content |
| `--surface-elevated` | `#FFFFFF` | `#252320` | Hover states, nested cards |
| `--surface-overlay` | `#FFFFFF` | `#2A2826` | Modals, dropdowns |

### Border Hierarchy

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--border-muted` | `#E8E4DE` | `#2A2826` | Default borders |
| `--border-prominent` | `#D4D0C8` | `#3A3836` | Secondary borders |
| `--border-strong` | `#B8B4AC` | `#4A4846` | Emphasized borders |
| `--border-focus` | `#D4716A` | `#E07D75` | Focus ring (uses accent) |

### Text Hierarchy

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--text-primary` | `#2D2A26` | `#E8E4DE` | Main text (warm black / warm white) |
| `--text-secondary` | `#5C5852` | `#A8A49C` | Supporting text |
| `--text-tertiary` | `#7A756C` | `#8A8680` | Labels, captions |
| `--text-placeholder` | `#9A958C` | `#6A6660` | Input placeholders |
| `--text-muted` | `#B8B4AC` | `#4A4846` | Disabled, hints |

### Primary Accent - Dusty Coral

| Token | Light Mode | Dark Mode |
|-------|------------|-----------|
| `--accent-primary` | `#D4716A` | `#E07D75` |
| `--accent-primary-hover` | `#C4615A` | `#F08D85` |
| `--accent-primary-muted` | `rgba(212,113,106,0.1)` | `rgba(224,125,117,0.1)` |

### Semantic Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--semantic-success` | `#10b981` | `#34d399` | Success states |
| `--semantic-warning` | `#f59e0b` | `#fbbf24` | Warning states |
| `--semantic-error` | `#ef4444` | `#f87171` | Error states |
| `--semantic-info` | `#0ea5e9` | `#38bdf8` | Info states |

### Accent Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--accent-green` | `#10b981` | `#34d399` | Positive trends |
| `--accent-yellow` | `#f59e0b` | `#fbbf24` | Warnings |
| `--accent-red` | `#ef4444` | `#f87171` | Negative trends |
| `--accent-blue` | `#0ea5e9` | `#38bdf8` | Information |
| `--accent-purple` | `#8b5cf6` | `#a78bfa` | Presets, special |
| `--accent-cyan` | `#06b6d4` | `#22d3ee` | Alternate accent |
| `--accent-orange` | `#f97316` | `#fb923c` | Platform filters |
| `--accent-pink` | `#ec4899` | `#f472b6` | Relationship filters |

### Interactive States

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--interactive-hover` | `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.04)` | Hover backgrounds |
| `--interactive-active` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.08)` | Active/pressed |
| `--interactive-selected` | `rgba(212,113,106,0.1)` | `rgba(224,125,117,0.1)` | Selected items |

### Trend Indicators

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--trend-positive` | `#10b981` | `#34d399` | Trending up |
| `--trend-negative` | `#ef4444` | `#f87171` | Trending down |
| `--trend-neutral` | `#7A756C` | `#8A8680` | No change |

---

## Typography

### Font Families

| Font | Variable | CSS | Usage |
|------|----------|-----|-------|
| DM Sans Variable | `--font-sans` | `'DM Sans Variable', system-ui, sans-serif` | Primary UI text |
| JetBrains Mono Variable | `--font-mono` | `'JetBrains Mono Variable', monospace` | Code, data display |

### Type Scale

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `display-lg` | 3rem | 1.1 | 600 | Hero headings |
| `display` | 2.25rem | 1.2 | 600 | Page titles |
| `display-sm` | 1.875rem | 1.25 | 600 | Section titles |
| `heading` | 1.5rem | 1.35 | 600 | Card titles |
| `subheading` | 1.125rem | 1.4 | 500 | Subheadings |
| `body-lg` | 1rem | 1.6 | 400 | Large body text |
| `body` | 0.875rem | 1.5 | 400 | Default body |
| `body-sm` | 0.8125rem | 1.4 | 400 | Small body |
| `caption` | 0.75rem | 1.35 | 500 | Labels |
| `caption-sm` | 0.6875rem | 1.3 | 500 | Tiny labels |

### Tailwind Usage

```tsx
<h1 className="text-display">Page Title</h1>
<p className="text-body text-text-secondary">Body content</p>
<span className="text-caption text-text-tertiary">Label</span>
```

### Font Data Utility

For tabular numeric data in tables:

```css
.font-data {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
```

```tsx
<td className="font-data">1,234,567</td>
```

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 4px | Small elements, pills |
| `rounded` | 6px | Default radius (buttons, inputs) |
| `rounded-md` | 6px | Components (cards, panels) |
| `rounded-lg` | 8px | Large components (modals) |
| `rounded-xl` | 12px | Extra large elements |
| `rounded-full` | 9999px | Circular elements |

---

## Shadows

Theme-aware shadows that adapt to light/dark mode:

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.04)` | `0 1px 2px rgba(0,0,0,0.2)` | Minimal elevation |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.06)` | `0 1px 3px rgba(0,0,0,0.25)` | Cards |
| `--shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.08)` | `0 4px 6px rgba(0,0,0,0.3)` | Hover states |
| `--shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` | `0 10px 15px rgba(0,0,0,0.35)` | Modals |
| `--shadow-xl` | `0 20px 25px -5px rgba(0,0,0,0.1)` | `0 20px 25px rgba(0,0,0,0.4)` | Popovers |

### Glow Effects

| Token | Value | Usage |
|-------|-------|-------|
| `glow-primary` | `0 0 20px var(--accent-primary-muted)` | Focus glow |
| `glow-green` | `0 0 20px rgba(16,185,129,0.15)` | Success glow |
| `glow-red` | `0 0 20px rgba(239,68,68,0.15)` | Error glow |

---

## Component Tokens

### Input Tokens

| Token | Usage |
|-------|-------|
| `--input-bg` | Input background |
| `--input-border` | Default border color |
| `--input-border-hover` | Hover border color |
| `--input-border-focus` | Focus border (uses accent) |
| `--input-placeholder` | Placeholder text color |

### Badge Tokens

| Variant | Background Token | Text Token |
|---------|------------------|------------|
| default | `--badge-default-bg` | `--badge-default-text` |
| primary | `--badge-primary-bg` | `--badge-primary-text` |
| secondary | `--badge-secondary-bg` | `--badge-secondary-text` |
| success | `--badge-success-bg` | `--badge-success-text` |
| warning | `--badge-warning-bg` | `--badge-warning-text` |
| error | `--badge-error-bg` | `--badge-error-text` |

### Table Tokens

| Token | Usage |
|-------|-------|
| `--table-header-bg` | Table header background |
| `--table-row-hover` | Row hover background |
| `--table-row-selected` | Selected row background |
| `--table-border` | Cell border color |

### Card Tokens

| Token | Usage |
|-------|-------|
| `--card-bg` | Card background |
| `--card-border` | Card border color |
| `--card-shadow` | Card shadow |

---

## Animation System

### Built-in Animations

| Name | Duration | Effect |
|------|----------|--------|
| `fade-in` | 200ms | Opacity 0 → 1 |
| `fade-in-up` | 300ms | Fade + translateY(8px) → 0 |
| `slide-up` | 300ms | Opacity + translateY(10px) → 0 |
| `slide-down` | 300ms | Opacity + translateY(-10px) → 0 |
| `scale-in` | 200ms | Opacity + scale(0.95) → 1 |
| `pulse-subtle` | 2s infinite | Opacity 1 → 0.7 → 1 |

### Usage

```tsx
<div className="animate-fade-in">Fades in</div>
<div className="animate-slide-up">Slides up</div>
```

### Animation Delay Utilities

```tsx
<div className="animate-fade-in animation-delay-100">100ms delay</div>
<div className="animate-fade-in animation-delay-200">200ms delay</div>
<div className="animate-fade-in animation-delay-300">300ms delay</div>
```

---

## Component Library

### StatusBar

Top-level status indicator bar for dashboards.

```tsx
<StatusBar
  metrics={[
    { label: 'Running', value: 3, status: 'info' },
    { label: 'Success', value: '95%', status: 'success' },
    { label: 'Errors', value: 2, status: 'error' },
  ]}
/>
```

**Status options:** `success` | `warning` | `error` | `info` | `neutral`

### CollapsibleSection

Expandable section with optional badge.

```tsx
<CollapsibleSection
  title="Data Completion"
  badge={{ value: '85%', variant: 'success' }}
  defaultOpen={true}
>
  <p>Content here</p>
</CollapsibleSection>
```

**Badge variants:** `default` | `success` | `warning` | `error` | `info`

### DenseMetricGrid

Compact metric display with status indicators.

```tsx
<DenseMetricGrid
  metrics={[
    { label: 'Total', value: 1234, status: 'neutral' },
    { label: 'Active', value: 89, status: 'success' },
  ]}
/>
```

### MiniProgressBar

Small progress indicator with automatic status coloring.

```tsx
<MiniProgressBar value={75} max={100} />
```

The bar automatically selects colors based on percentage:
- < 25%: Red
- 25-50%: Orange
- 50-75%: Yellow
- 75-90%: Blue
- >= 90%: Green

### Badge

CSS variable-based badge component.

```tsx
<Badge variant="success" size="sm">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="primary" size="lg">Featured</Badge>
```

**Variants:** `default`, `primary`, `secondary`, `success`, `warning`, `error`, `info`
**Sizes:** `sm`, `md` (default), `lg`

### Button

Primary action button with variants.

```tsx
<Button variant="primary">Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="ghost">More options</Button>
```

**Variants:** `primary`, `secondary`, `ghost`, `danger`
**Sizes:** `sm`, `md` (default), `lg`

### FilterPill

Active filter display chip with category coloring.

```tsx
<FilterPill
  label="CCU > 1,000"
  category="metric"
  onRemove={() => handleRemove()}
  onClick={() => handleEdit()}
/>
```

**Categories:** `preset`, `quickFilter`, `metric`, `content`, `platform`, `release`, `relationship`, `activity`

### ActiveFilterBar

Container for filter pills with category grouping.

```tsx
<ActiveFilterBar
  filters={activeFilters}
  onRemoveFilter={handleRemove}
  onEditFilter={handleEdit}
/>
```

---

## Utility Classes

### Custom Scrollbar

```tsx
<div className="scrollbar-thin">Thin scrollbar</div>
<div className="scrollbar-none">Hidden scrollbar</div>
```

### Text Gradient

```tsx
<span className="text-gradient">Gradient text</span>
```

### Glass Effect

```tsx
<div className="glass">Frosted glass background</div>
```

### Hover Lift

```tsx
<div className="hover-lift">Lifts on hover</div>
```

---

## File Locations

| File | Purpose |
|------|---------|
| `apps/admin/src/app/globals.css` | CSS variables, base styles |
| `apps/admin/tailwind.config.cjs` | Tailwind theme extensions |
| `apps/admin/src/components/theme/ThemeContext.tsx` | Theme context provider |
| `apps/admin/src/components/theme/ThemeToggle.tsx` | Theme toggle button |
| `apps/admin/src/components/ui/Badge.tsx` | Badge component |
| `apps/admin/src/components/ui/Button.tsx` | Button component |
| `apps/admin/src/components/ui/Card.tsx` | Card component |
| `apps/admin/src/components/ui/Input.tsx` | Input component |
| `apps/admin/src/components/ui/CollapsibleSection.tsx` | Collapsible sections |
| `apps/admin/src/components/data-display/DenseMetricGrid.tsx` | Metric displays |
| `apps/admin/src/components/data-display/MiniProgressBar.tsx` | Progress bars |
| `apps/admin/src/components/FilterPill.tsx` | Filter chip display |
| `apps/admin/src/components/ActiveFilterBar.tsx` | Filter bar container |

---

## Migration from v2.0

### Color Changes

If upgrading from v2.0, update any hardcoded colors:

| v2.0 (Teal) | v2.7 (Coral) |
|-------------|--------------|
| `#0891b2` | `#D4716A` (light) |
| `#22d3ee` | `#E07D75` (dark) |

### Font Changes

| v2.0 | v2.7 |
|------|------|
| `--font-geist-sans` | `--font-sans` (DM Sans) |
| `--font-geist-mono` | `--font-mono` (JetBrains Mono) |

### Surface Changes

| v2.0 | v2.7 |
|------|------|
| `#ffffff` (pure white) | `#FAF9F7` (warm off-white) |
| `#09090b` (pure dark) | `#1A1816` (warm dark) |

---

## Related Documentation

- [Theming Guide](../../user-guide/theming.md) - How to use and customize themes
- [v2.0 Release Notes](../../releases/v2.0-new-design.md) - Original design system
- [v2.7 Release Notes](../../releases/v2.7-design-command-palette.md) - Latest design changes
