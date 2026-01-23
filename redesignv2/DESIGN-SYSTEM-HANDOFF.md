# PublisherIQ Design System — Implementation Guide

## Overview

This document contains the complete design system for PublisherIQ, a Steam/gaming data intelligence platform. The design direction is **"Warm Stone + Dusty Coral"** — an editorial, premium aesthetic that differentiates from typical cold/blue data tools.

**Tech Stack:** Next.js, Tailwind CSS, CSS Variables for theming
**Theme Support:** Light and dark modes (both intentionally designed, not just inverted)

---

## Design Philosophy

- **Warm stone-toned neutrals** instead of cool grays
- **Dusty coral accent** — distinctive and memorable, desaturated for a premium feel
- **Editorial/sophisticated** rather than "startup blue"
- **Data-focused** — monospace numbers, clear hierarchy, trend indicators
- **Typography:** DM Sans (body), JetBrains Mono (numbers/data)

---

## Color Palette

### Light Mode

#### Surfaces
| Token | Value | Usage |
|-------|-------|-------|
| `--surface-base` | `#FAF9F7` | Page background |
| `--surface-raised` | `#FFFFFF` | Cards, modals, dropdowns |
| `--surface-elevated` | `#F8F6F3` | Table headers, subtle backgrounds |
| `--surface-sunken` | `#F5F3EF` | Inset areas, disabled states |

#### Borders
| Token | Value | Usage |
|-------|-------|-------|
| `--border-default` | `#E8E4DE` | Standard borders |
| `--border-subtle` | `#F0EDE8` | Dividers, table rows |
| `--border-strong` | `#DDD8D0` | Input borders, emphasized |
| `--border-focus` | `#D4716A` | Focus rings |

#### Text
| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `#2D2A26` | Headings, body text |
| `--text-secondary` | `#5C5752` | Secondary info, descriptions |
| `--text-tertiary` | `#7A756D` | Labels, hints, metadata |
| `--text-placeholder` | `#9A958D` | Input placeholders |

#### Accent (Dusty Coral)
| Token | Value | Usage |
|-------|-------|-------|
| `--accent-primary` | `#D4716A` | Primary buttons, links, active states |
| `--accent-primary-hover` | `#C46359` | Hover state |
| `--accent-primary-active` | `#B4564C` | Pressed state |
| `--accent-primary-subtle` | `#FBF0EF` | Subtle backgrounds |

#### Semantic Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--semantic-success` | `#2D8A6E` | Success states, trend up |
| `--semantic-success-text` | `#1E6B54` | Success text (better contrast) |
| `--semantic-success-subtle` | `#E6F4EF` | Success backgrounds |
| `--semantic-error` | `#B54D42` | Error states, trend down |
| `--semantic-error-text` | `#9C4338` | Error text |
| `--semantic-error-subtle` | `#FDF4F3` | Error backgrounds |
| `--semantic-warning` | `#D97706` | Warnings |
| `--semantic-warning-subtle` | `#FEF8E8` | Warning backgrounds |
| `--semantic-info` | `#0E7490` | Info states |
| `--semantic-info-subtle` | `#ECFEFF` | Info backgrounds |

---

### Dark Mode

#### Surfaces
| Token | Value | Usage |
|-------|-------|-------|
| `--surface-base` | `#1A1816` | Page background |
| `--surface-raised` | `#211F1C` | Cards, modals |
| `--surface-elevated` | `#292623` | Table headers |
| `--surface-sunken` | `#151311` | Inset areas |

#### Borders
| Token | Value | Usage |
|-------|-------|-------|
| `--border-default` | `#332F2A` | Standard borders |
| `--border-subtle` | `#292623` | Dividers |
| `--border-strong` | `#3D3935` | Emphasized borders |
| `--border-focus` | `#E07D75` | Focus rings |

#### Text
| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `#E8E4DE` | Headings, body |
| `--text-secondary` | `#B5B0A8` | Secondary info |
| `--text-tertiary` | `#8A847A` | Labels, hints |
| `--text-placeholder` | `#6B665E` | Placeholders |

#### Accent (Dusty Coral — Dark)
| Token | Value | Usage |
|-------|-------|-------|
| `--accent-primary` | `#E07D75` | Primary buttons, links |
| `--accent-primary-hover` | `#E68D86` | Hover state |
| `--accent-primary-active` | `#EC9D97` | Pressed state |
| `--accent-primary-subtle` | `rgba(224, 125, 117, 0.12)` | Subtle backgrounds |

#### Semantic Colors (Dark)
| Token | Value |
|-------|-------|
| `--semantic-success` | `#5DD4A8` |
| `--semantic-success-text` | `#5DD4A8` |
| `--semantic-success-subtle` | `rgba(93, 212, 168, 0.12)` |
| `--semantic-error` | `#CF7F76` |
| `--semantic-error-text` | `#CF7F76` |
| `--semantic-error-subtle` | `rgba(207, 127, 118, 0.12)` |
| `--semantic-warning` | `#FBBF24` |
| `--semantic-warning-subtle` | `rgba(251, 191, 36, 0.12)` |
| `--semantic-info` | `#38BDF8` |
| `--semantic-info-subtle` | `rgba(56, 189, 248, 0.12)` |

---

## Typography

### Font Families
```css
--font-sans: 'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
```

### Font Sizes
| Token | Size | Usage |
|-------|------|-------|
| `--text-xs` | 11px | Badges, tiny labels |
| `--text-sm` | 13px | Secondary text, table cells |
| `--text-base` | 14px | Body text (default) |
| `--text-lg` | 16px | Subheadings |
| `--text-xl` | 18px | Section titles |
| `--text-2xl` | 20px | Page titles |
| `--text-3xl` | 24px | Large numbers/stats |
| `--text-4xl` | 30px | Hero numbers |

### Data Display
For all numeric data (CCU, hours, percentages, etc.):
```css
.font-data {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
```

---

## Shadows

### Light Mode
```css
--shadow-xs: 0 1px 2px rgba(45, 42, 38, 0.04);
--shadow-sm: 0 2px 4px rgba(45, 42, 38, 0.06), 0 1px 2px rgba(45, 42, 38, 0.04);
--shadow-md: 0 4px 8px rgba(45, 42, 38, 0.08), 0 2px 4px rgba(45, 42, 38, 0.04);
--shadow-lg: 0 8px 16px rgba(45, 42, 38, 0.10), 0 4px 8px rgba(45, 42, 38, 0.06);
--shadow-xl: 0 16px 32px rgba(45, 42, 38, 0.12), 0 8px 16px rgba(45, 42, 38, 0.08);
--shadow-focus: 0 0 0 3px rgba(212, 113, 106, 0.25);
```

### Dark Mode
```css
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.16);
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.20), 0 1px 2px rgba(0, 0, 0, 0.12);
--shadow-md: 0 4px 8px rgba(0, 0, 0, 0.24), 0 2px 4px rgba(0, 0, 0, 0.16);
--shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.28), 0 4px 8px rgba(0, 0, 0, 0.20);
--shadow-xl: 0 16px 32px rgba(0, 0, 0, 0.32), 0 8px 16px rgba(0, 0, 0, 0.24);
--shadow-focus: 0 0 0 3px rgba(224, 125, 117, 0.3);
```

---

## Border Radius

```css
--radius-sm: 4px;   /* Checkboxes, small badges */
--radius-md: 6px;   /* Buttons, inputs, badges */
--radius-lg: 8px;   /* Cards, dropdowns */
--radius-xl: 12px;  /* Modals, large cards */
--radius-2xl: 16px; /* Feature cards */
--radius-full: 9999px; /* Pills, avatars */
```

---

## Component-Specific Tokens

### Tables
```css
/* Light */
--table-header-bg: #F8F6F3;
--table-row-hover: rgba(45, 42, 38, 0.02);
--table-row-selected: rgba(212, 113, 106, 0.06);
--table-border: #F0EDE8;

/* Dark */
--table-header-bg: #252320;
--table-row-hover: rgba(232, 228, 222, 0.02);
--table-row-selected: rgba(224, 125, 117, 0.08);
--table-border: #292623;
```

### Sidebar
```css
/* Light */
--sidebar-bg: #FFFFFF;
--sidebar-item-hover: rgba(45, 42, 38, 0.04);
--sidebar-item-active: rgba(212, 113, 106, 0.08);

/* Dark */
--sidebar-bg: #211F1C;
--sidebar-item-hover: rgba(232, 228, 222, 0.04);
--sidebar-item-active: rgba(224, 125, 117, 0.12);
```

### Inputs
```css
/* Light */
--input-bg: #FFFFFF;
--input-border: #DDD8D0;
--input-border-hover: #C9C4BC;
--input-border-focus: #D4716A;
--input-placeholder: #9A958D;

/* Dark */
--input-bg: #252320;
--input-border: #3D3935;
--input-border-hover: #4A453E;
--input-border-focus: #E07D75;
--input-placeholder: #6B665E;
```

---

## Implementation Instructions

### 1. Install Fonts

Add to your `<head>` or import in your CSS:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### 2. CSS Variables File

Create `styles/variables.css` (or add to your global CSS) with all the CSS custom properties. The complete file is provided separately as `variables.css`.

Import it in your global styles:
```css
@import './variables.css';
```

### 3. Tailwind Configuration

Update `tailwind.config.js` to use the CSS variables. The complete config is provided separately as `tailwind.config.js`.

Key points:
- Colors reference CSS variables for automatic theme switching
- Custom font families configured
- Extended shadows using CSS variables
- Custom utilities for `.font-data`, `.trend-up`, `.trend-down`

### 4. Theme Switching

Apply theme via `data-theme` attribute on `<html>`:

```html
<html data-theme="light">  <!-- or "dark" -->
```

The CSS includes a `@media (prefers-color-scheme: dark)` fallback that automatically applies dark mode if no explicit theme is set and the user's system preference is dark.

### 5. Key CSS Classes to Implement

#### Trend Indicators
```jsx
<span className="trend-up">+4.2%</span>   // Green, positive
<span className="trend-down">-2.1%</span>  // Muted red, negative
```

#### Data Numbers
```jsx
<span className="font-data">1,547,832</span>  // Monospace, tabular
```

#### Buttons
```jsx
<button className="btn btn-primary">Export</button>
<button className="btn btn-secondary">Cancel</button>
<button className="btn btn-ghost">Options</button>
```

#### Badges
```jsx
<span className="badge badge-default">Default</span>
<span className="badge badge-success">Active</span>
<span className="badge badge-error">Error</span>
```

---

## File Attachments

The following files are provided with this document:

1. **`variables.css`** — Complete CSS custom properties for light/dark modes
2. **`tailwind.config.js`** — Tailwind configuration with all design tokens
3. **`components.css`** — Base component styles (buttons, inputs, cards, tables, modals, etc.)
4. **`component-library.html`** — Interactive preview of all components (open in browser to test)

---

## Quick Reference: Most Used Colors

| Purpose | Light | Dark |
|---------|-------|------|
| Page background | `#FAF9F7` | `#1A1816` |
| Card background | `#FFFFFF` | `#211F1C` |
| Primary text | `#2D2A26` | `#E8E4DE` |
| Secondary text | `#5C5752` | `#B5B0A8` |
| Border | `#E8E4DE` | `#332F2A` |
| Accent/CTA | `#D4716A` | `#E07D75` |
| Trend up | `#1E6B54` | `#5DD4A8` |
| Trend down | `#9C4338` | `#CF7F76` |

---

## Notes

- The coral accent is intentionally **desaturated** ("dusty") for a premium, editorial feel
- Error colors are separated from accent colors to avoid semantic confusion
- Dark mode is **intentionally designed**, not just inverted — colors are adjusted for proper contrast and warmth
- All interactive elements should have visible focus states using `--shadow-focus`
- Numbers in data tables should always use `font-data` class for alignment
