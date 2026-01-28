# Design System Migration Summary: Warm Stone + Dusty Coral

## Overview

Migrated the PublisherIQ admin dashboard from a **teal/cyan color scheme** to a new **Warm Stone + Dusty Coral** editorial design system. The migration was done incrementally across 5 phases to maintain backward compatibility.

### Design Philosophy
- **Warm stone-toned neutrals** instead of cool grays
- **Dusty coral accent** (`#D4716A`) — distinctive, desaturated for premium feel
- **Editorial/sophisticated** aesthetic rather than "startup blue"
- **Typography**: DM Sans (body), JetBrains Mono (data/numbers)

---

## Overall Progress

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Foundation | **COMPLETE** | Fonts, CSS variables, Tailwind, ThemeContext, data-theme attribute |
| 2. Apply New Colors | **COMPLETE** | Replace teal/cyan with Warm Stone + Dusty Coral palette |
| 3. Home Page Polish | **COMPLETE** | Verify `/` with new colors, add semantic Tailwind utilities |
| 4. /apps Page | **COMPLETE** | Sparklines, tables, cells - all theme-aware |
| 5. Shared Components | **COMPLETE** | Input, BarChart, AreaChart - all theme-aware |
| 6. /companies Page | **COMPLETE** | GrowthCell hex → semantic |
| 7. /insights Page | **COMPLETE** | 7 files - all accent colors → semantic/trend/chart |
| 8. /chat Components | **COMPLETE** | StreamingContent accent colors → accent-primary |
| 9. Tailwind Config | **COMPLETE** | Add accent-primary-subtle utility |
| 10. Verification | **COMPLETE** | Build passed, documentation updated |

---

## Phase 1: Foundation

### Changes
| File | Change |
|------|--------|
| `package.json` | Added `@fontsource-variable/dm-sans` and `@fontsource-variable/jetbrains-mono` |
| `globals.css` | Added font imports, updated theme selectors to support `[data-theme]` |
| `tailwind.config.cjs` | Updated `darkMode` to `['class', '[data-theme="dark"]']` |
| `ThemeContext.tsx` | Added `applyTheme()` helper that sets both `data-theme` attr and `.dark` class |
| `layout.tsx` | Added font imports, `data-theme="light"` default on `<html>` |

---

## Phase 2: Apply New Color Values

### Light Theme (`globals.css`)
| Category | Old Value | New Value |
|----------|-----------|-----------|
| **Surface base** | `#ffffff` | `#FAF9F7` (warm stone) |
| **Surface raised** | `#f8fafc` | `#FFFFFF` |
| **Surface elevated** | `#f1f5f9` | `#F8F6F3` |
| **Border subtle** | `#e2e8f0` | `#F0EDE8` |
| **Border default** | `#cbd5e1` | `#E8E4DE` |
| **Text primary** | `#0f172a` | `#2D2A26` |
| **Text secondary** | `#475569` | `#5C5752` |
| **Accent primary** | `#0891b2` (teal) | `#D4716A` (coral) |
| **Accent hover** | `#0e7490` | `#C46359` |
| **Success** | `#10b981` | `#2D8A6E` / `#1E6B54` |
| **Error** | `#ef4444` | `#B54D42` / `#9C4338` |

### Dark Theme (`globals.css`)
| Category | Old Value | New Value |
|----------|-----------|-----------|
| **Surface base** | `#09090b` | `#1A1816` (warm dark) |
| **Surface raised** | `#0f0f12` | `#211F1C` |
| **Surface elevated** | `#18181b` | `#292623` |
| **Border subtle** | `#27272a` | `#292623` |
| **Border default** | `#3f3f46` | `#332F2A` |
| **Text primary** | `#fafafa` | `#E8E4DE` |
| **Text secondary** | `#a1a1aa` | `#B5B0A8` |
| **Accent primary** | `#22d3ee` (cyan) | `#E07D75` (coral) |
| **Success** | `#34d399` | `#5DD4A8` |
| **Error** | `#f87171` | `#CF7F76` |

### New CSS Variables Added
- `--surface-sunken` - recessed areas
- `--border-strong`, `--border-focus` - emphasis states
- `--accent-primary-subtle` - subtle accent backgrounds
- `--text-placeholder` - placeholder text
- `--semantic-*-text` - semantic text colors
- `--chart-1` through `--chart-6` - chart palette
- `--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-focus` - warm-tinted shadows
- Selection colors updated to coral tint

### Tailwind Config (`tailwind.config.cjs`)
- Added shadow utilities: `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-focus`
- Updated glow colors to match new palette

---

## Phase 3: Home Page Polish

### Tailwind Config Additions
```javascript
surface: { sunken: 'var(--surface-sunken)' }
border: { strong: 'var(--border-strong)', focus: 'var(--border-focus)' }
semantic: {
  success, 'success-text', 'success-subtle',
  error, 'error-text', 'error-subtle',
  warning, 'warning-subtle',
  info, 'info-subtle'
}
chart: { 1-6, grid, axis }
```

---

## Phase 4: /apps Page Migration

### Sparkline.tsx - Complete Rewrite
- Added `useTheme` hook for automatic light/dark detection
- **New color palette**: `coral`, `green`, `amber`, `teal`, `purple`, `pink`
- **Semantic colors**: `success`, `error`
- **Legacy aliases**: `blue`→teal, `red`→error, `cyan`→coral, `orange`→amber
- Default color changed from `blue` to `coral`
- `TrendSparkline` uses `success`/`error`/`coral` for up/down/stable

### Cell Components Updated
| Component | Changes |
|-----------|---------|
| `GrowthCell.tsx` | `#22c55e` → `text-semantic-success`, uses `text-trend-positive/negative` |
| `MomentumCell.tsx` | `#22c55e` → `text-semantic-success`, `lime-400` → `semantic-success/70` |
| `SentimentCell.tsx` | `#00d084` → `text-semantic-success`, uses trend colors |
| `ValueScoreCell.tsx` | `#00d084` → `text-semantic-success`, `lime-400` → `semantic-success/70` |

---

## Phase 5: Shared Components

### Input.tsx
- Focus ring changed from `accent-blue` to `accent-primary` (coral)

### BarChart.tsx - Theme-Aware Rewrite
- Added `useTheme` hook
- Light/dark color maps with new palette
- Theme-aware styling for:
  - Grid lines (`#E8E4DE` light / `#332F2A` dark)
  - Tick text (`#7A756D` light / `#8A847A` dark)
  - Tooltip background, border, text
  - Positive/negative bar colors
- Default color changed from `blue` to `coral`

### AreaChart.tsx - Theme-Aware Rewrite
- Same approach as BarChart
- Both `AreaChartComponent` and `MultiAreaChart` updated
- Theme-aware gradients and styling

---

## Files Modified (23 total)

| File | Lines Changed |
|------|---------------|
| **Phase 1-5** | |
| `apps/admin/package.json` | +2 dependencies |
| `apps/admin/src/app/globals.css` | ~200 lines (complete color system) |
| `apps/admin/src/app/layout.tsx` | Theme script updates |
| `apps/admin/tailwind.config.cjs` | +50 lines (colors, shadows, utilities) |
| `apps/admin/src/contexts/ThemeContext.tsx` | `applyTheme()` helper |
| `apps/admin/src/components/data-display/Sparkline.tsx` | Complete rewrite |
| `apps/admin/src/components/data-display/BarChart.tsx` | Theme-aware rewrite |
| `apps/admin/src/components/data-display/AreaChart.tsx` | Theme-aware rewrite |
| `apps/admin/src/components/ui/Input.tsx` | Focus ring color |
| `apps/admin/src/app/(main)/apps/components/GrowthCell.tsx` | Semantic colors |
| `apps/admin/src/app/(main)/apps/components/MomentumCell.tsx` | Semantic colors |
| `apps/admin/src/app/(main)/apps/components/cells/SentimentCell.tsx` | Semantic colors |
| `apps/admin/src/app/(main)/apps/components/cells/ValueScoreCell.tsx` | Semantic colors |
| **Phase 6-10** | |
| `apps/admin/src/app/(main)/companies/components/GrowthCell.tsx` | 1 hex → semantic |
| `apps/admin/src/app/(main)/insights/components/TopGameCard.tsx` | Review/trend colors |
| `apps/admin/src/app/(main)/insights/components/GameInsightCard.tsx` | Tier badge colors |
| `apps/admin/src/app/(main)/insights/components/TopGamesTab.tsx` | Summary card colors |
| `apps/admin/src/app/(main)/insights/components/TrendingGamesTab.tsx` | Summary card colors |
| `apps/admin/src/app/(main)/insights/components/NewestGamesTab.tsx` | Summary card colors |
| `apps/admin/src/app/(main)/insights/components/PinnedCard.tsx` | Entity/trend colors |
| `apps/admin/src/app/(main)/insights/components/MyDashboardTab.tsx` | Link colors |
| `apps/admin/src/components/chat/content/StreamingContent.tsx` | Accent colors |

---

## Color Palette Quick Reference

### Light Mode
| Purpose | Hex |
|---------|-----|
| Background | `#FAF9F7` |
| Accent (coral) | `#D4716A` |
| Success | `#1E6B54` |
| Error | `#9C4338` |
| Warning | `#D97706` |
| Info | `#0E7490` |

### Dark Mode
| Purpose | Hex |
|---------|-----|
| Background | `#1A1816` |
| Accent (coral) | `#E07D75` |
| Success | `#5DD4A8` |
| Error | `#CF7F76` |
| Warning | `#FBBF24` |
| Info | `#38BDF8` |

---

## What's NOT Changed (Intentional)
- `CodeBlock.tsx` / `StreamingContent.tsx` - GitHub dark theme (`#0d1117`) for code blocks
- `MermaidBlock.tsx` - Mermaid diagram colors (can be addressed separately)
- Button, Badge, Card components - Already use CSS variables, auto-update

---

## Phase 6: /companies Page

### Changes
| File | Change |
|------|--------|
| `apps/admin/src/app/(main)/companies/components/GrowthCell.tsx` | `#22c55e` → `text-semantic-success` |

---

## Phase 7: /insights Page

### Files Modified (7)
| File | Changes |
|------|---------|
| `TopGameCard.tsx` | Review colors, growth indicator, price colors → semantic/trend tokens |
| `GameInsightCard.tsx` | Tier badge colors → semantic-success/info-subtle |
| `TopGamesTab.tsx` | Summary cards → accent-primary, semantic-success, chart-5 |
| `TrendingGamesTab.tsx` | Summary cards → semantic-success, warning, accent-primary |
| `NewestGamesTab.tsx` | Summary cards → semantic-info, success, chart-5 |
| `PinnedCard.tsx` | Entity badges, review colors, trend indicators → semantic/trend tokens |
| `MyDashboardTab.tsx` | Browse links → accent-primary |

---

## Phase 8: /chat Components

### Changes
| Element | Before | After |
|---------|--------|-------|
| Table cell links | `text-accent-blue` | `text-accent-primary` |
| Inline code | `text-accent-cyan` | `text-accent-primary` |
| Blockquote border | `border-accent-blue` | `border-accent-primary` |
| Streaming cursor | `bg-accent-blue` | `bg-accent-primary` |

---

## Phase 9: Tailwind Config

### Addition
```javascript
accent: {
  'primary-subtle': 'var(--accent-primary-subtle)',  // NEW
}
```

---

## Phase 10: Verification

- Build: **PASSED** ✓ (`pnpm --filter admin build`)
- All pages compile without errors
- Documentation updated in PLAN.md and MIGRATION-STATUS.md

---

## Verification
Run dev server at `http://localhost:3001` and check:
- Home page: Coral accent, warm stone background
- /apps page: Theme-aware sparklines, growth indicators
- Charts: Coral primary, adapts to light/dark
- Inputs: Coral focus rings
- Theme toggle: Smooth warm light ↔ dark transitions

---

## Key Files

| Purpose | File |
|---------|------|
| Design spec | `redesignv2/DESIGN-SYSTEM-HANDOFF.md` |
| New variables | `redesignv2/variables.css` |
| New Tailwind | `redesignv2/tailwind.config.js` |
| Component reference | `redesignv2/components.css` |
| Full plan | `PLAN.md` |
