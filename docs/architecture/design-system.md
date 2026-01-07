# Design System Architecture

This document describes the design system introduced in PublisherIQ v2.0, including the theme system, color palette, typography, and component library.

**Last Updated:** January 7, 2026

## Recent Fixes

- **iPad Scrollbar Issues**: Fixed scrollbar styling for iPad Safari
- **Theme Toggle Visibility**: Improved visibility of theme toggle button

## Overview

The design system provides:
- Dual light/dark theme support with system preference detection
- CSS variable-based color tokens for consistent theming
- Geist font family for modern typography
- Pre-built animation utilities
- A library of reusable UI components

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
| `light` | Light theme with teal accent |
| `dark` | Dark theme with cyan accent |
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

Theme is persisted to `localStorage` with key `publisheriq-theme` and applied by adding/removing the `dark` class on the `<html>` element.

---

## Color Palette

### Surface Hierarchy

Surfaces provide visual depth and separation between UI layers.

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--surface` | `#ffffff` | `#09090b` | Base background |
| `--surface-raised` | `#f8fafc` | `#0f0f12` | Cards, elevated content |
| `--surface-elevated` | `#f1f5f9` | `#18181b` | Hover states, nested cards |
| `--surface-overlay` | `#e2e8f0` | `#27272a` | Modals, dropdowns |

### Border Hierarchy

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--border-subtle` | `#e2e8f0` | `#27272a` | Default borders |
| `--border-muted` | `#cbd5e1` | `#3f3f46` | Secondary borders |
| `--border-prominent` | `#94a3b8` | `#52525b` | Emphasized borders |

### Text Hierarchy

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--text-primary` | `#0f172a` | `#fafafa` | Main text |
| `--text-secondary` | `#475569` | `#a1a1aa` | Supporting text |
| `--text-tertiary` | `#64748b` | `#71717a` | Labels, captions |
| `--text-muted` | `#94a3b8` | `#52525b` | Disabled, hints |

### Primary Accent

| Token | Light Mode | Dark Mode |
|-------|------------|-----------|
| `--accent-primary` | `#0891b2` (teal) | `#22d3ee` (cyan) |
| `--accent-primary-hover` | `#0e7490` | `#06b6d4` |
| `--accent-primary-muted` | `rgba(8,145,178,0.1)` | `rgba(34,211,238,0.1)` |

### Semantic Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--accent-green` | `#10b981` | `#34d399` | Success, positive |
| `--accent-yellow` | `#f59e0b` | `#fbbf24` | Warning |
| `--accent-red` | `#ef4444` | `#f87171` | Error, negative |
| `--accent-blue` | `#0ea5e9` | `#38bdf8` | Info |
| `--accent-purple` | `#8b5cf6` | `#a78bfa` | Special |
| `--accent-cyan` | `#06b6d4` | `#22d3ee` | Accent alternate |
| `--accent-orange` | `#f97316` | `#fb923c` | Alert |
| `--accent-pink` | `#ec4899` | `#f472b6` | Highlight |

### Trend Indicators

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--trend-positive` | `#10b981` | `#34d399` | Trending up |
| `--trend-negative` | `#ef4444` | `#f87171` | Trending down |
| `--trend-neutral` | `#64748b` | `#71717a` | No change |

---

## Typography

### Font Families

```css
--font-geist-sans: 'Geist', 'Inter', system-ui, -apple-system, sans-serif;
--font-geist-mono: 'Geist Mono', 'JetBrains Mono', 'Menlo', monospace;
```

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
<span className="text-caption text-text-muted">Label</span>
```

---

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `subtle` | `0 1px 2px rgba(0,0,0,0.03)` | Minimal elevation |
| `card` | `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)` | Cards |
| `elevated` | `0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.08)` | Hover states |
| `overlay` | `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)` | Modals |
| `glow-primary` | `0 0 20px var(--accent-primary-muted)` | Focus glow |
| `glow-green` | `0 0 20px rgba(16,185,129,0.15)` | Success glow |
| `glow-red` | `0 0 20px rgba(239,68,68,0.15)` | Error glow |

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
- ≥ 90%: Green

### SourceCompletionCard

Data source completion display card.

```tsx
<SourceCompletionCard
  source="SteamSpy"
  icon="📊"
  synced={8500}
  total={10000}
  lastSync="2 hours ago"
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
| `apps/admin/src/components/ui/CollapsibleSection.tsx` | Collapsible sections |
| `apps/admin/src/components/data-display/DenseMetricGrid.tsx` | Metric displays |
| `apps/admin/src/components/data-display/MiniProgressBar.tsx` | Progress bars |

---

## Related Documentation

- [Theming Guide](../guides/theming.md) - How to use and customize themes
- [v2.0 Release Notes](../releases/v2.0-new-design.md) - Complete changelog
