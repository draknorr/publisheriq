# Theming Guide

This guide covers how to use and customize the PublisherIQ theme system.

**Last Updated:** January 7, 2026

## Quick Start

### Using the ThemeProvider

The app is already wrapped with `ThemeProvider` in the root layout. To access theme functionality in your components:

```tsx
import { useTheme } from '@/components/theme/ThemeContext';

function MyComponent() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div>
      <p>Current theme: {theme}</p>
      <p>Resolved theme: {resolvedTheme}</p>
      <button onClick={() => setTheme('dark')}>Dark Mode</button>
    </div>
  );
}
```

### Theme Values

| Value | Description |
|-------|-------------|
| `'light'` | Force light theme |
| `'dark'` | Force dark theme |
| `'system'` | Follow OS preference |

---

## useTheme Hook

The `useTheme` hook provides access to theme state and controls.

### API Reference

```tsx
const {
  theme,         // 'light' | 'dark' | 'system' - User's preference
  resolvedTheme, // 'light' | 'dark' - Actual applied theme
  setTheme,      // (theme) => void - Update theme
} = useTheme();
```

### Example: Conditional Rendering

```tsx
function Logo() {
  const { resolvedTheme } = useTheme();

  return (
    <img
      src={resolvedTheme === 'dark' ? '/logo-dark.svg' : '/logo-light.svg'}
      alt="Logo"
    />
  );
}
```

---

## ThemeToggle Component

The built-in `ThemeToggle` component provides an animated button to cycle through themes.

### Basic Usage

```tsx
import { ThemeToggle } from '@/components/theme/ThemeToggle';

function Header() {
  return (
    <header>
      <h1>My App</h1>
      <ThemeToggle />
    </header>
  );
}
```

### Features

- Animated sun/moon icons
- Smooth color transitions
- Click to cycle: light → dark → system → light
- Accessible with keyboard navigation

---

## Creating Theme-Aware Components

### Using CSS Variables

All components should use CSS variable tokens instead of hardcoded colors:

```tsx
// Good - Uses design tokens
<div className="bg-surface text-text-primary border border-border-subtle">
  <p className="text-text-secondary">Content</p>
</div>

// Bad - Hardcoded colors
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  <p className="text-gray-600 dark:text-gray-400">Content</p>
</div>
```

### Surface Hierarchy

Use the appropriate surface level for visual depth:

```tsx
// Base page background
<div className="bg-surface">

  {/* Card on the page */}
  <div className="bg-surface-raised">

    {/* Nested element */}
    <div className="bg-surface-elevated">

      {/* Modal overlay */}
      <div className="bg-surface-overlay">
```

### Text Hierarchy

Match text importance to the hierarchy:

```tsx
<article>
  {/* Main heading */}
  <h1 className="text-text-primary text-heading">Title</h1>

  {/* Supporting info */}
  <p className="text-text-secondary text-body">Description</p>

  {/* Labels and metadata */}
  <span className="text-text-tertiary text-caption">Label</span>

  {/* Disabled or hints */}
  <span className="text-text-muted text-caption">Hint</span>
</article>
```

### Semantic Colors

Use semantic colors for meaning:

```tsx
{/* Success state */}
<span className="text-accent-green">Completed</span>

{/* Warning state */}
<span className="text-accent-yellow">Pending</span>

{/* Error state */}
<span className="text-accent-red">Failed</span>

{/* Info/Active state */}
<span className="text-accent-primary">Active</span>

{/* Trends */}
<span className="text-trend-positive">+15%</span>
<span className="text-trend-negative">-5%</span>
<span className="text-trend-neutral">0%</span>
```

---

## Customizing the Color Palette

### Editing CSS Variables

To customize colors, edit `apps/admin/src/app/globals.css`:

```css
:root {
  /* Change the primary accent to blue */
  --accent-primary: #3b82f6;
  --accent-primary-hover: #2563eb;
  --accent-primary-muted: rgba(59, 130, 246, 0.1);
}

.dark {
  /* Lighter blue for dark mode */
  --accent-primary: #60a5fa;
  --accent-primary-hover: #3b82f6;
  --accent-primary-muted: rgba(96, 165, 250, 0.1);
}
```

### Adding New Colors

1. Add the CSS variable in `globals.css`:

```css
:root {
  --accent-custom: #your-color;
}

.dark {
  --accent-custom: #your-dark-color;
}
```

2. Add to Tailwind config in `tailwind.config.cjs`:

```js
colors: {
  accent: {
    // ... existing colors
    custom: 'var(--accent-custom)',
  },
}
```

3. Use in components:

```tsx
<div className="text-accent-custom bg-accent-custom/10">
```

---

## Best Practices

### Do

- Use CSS variable tokens for all colors
- Use the appropriate surface level for depth
- Match text color to content importance
- Use semantic colors for status indicators
- Test in both light and dark modes

### Don't

- Hardcode color values (e.g., `#ffffff`)
- Use `dark:` variants when CSS variables handle it
- Mix old Tailwind colors with new design tokens
- Forget to check contrast ratios

---

## Transition Effects

Theme changes include smooth transitions. The body element has:

```css
body {
  transition: background-color 200ms ease, color 200ms ease;
}
```

To add transitions to custom elements:

```tsx
<div className="transition-colors duration-200">
  Content with smooth color transitions
</div>
```

---

## Server-Side Rendering

The theme system handles SSR by:

1. Defaulting to light theme on server
2. Checking localStorage on client mount
3. Applying theme class before paint (prevents flash)

If you see a flash of wrong theme, ensure the `ThemeProvider` is high in the component tree and wraps all themed content.

---

## Troubleshooting

### Theme not persisting

Check that localStorage is available:

```tsx
if (typeof window !== 'undefined') {
  console.log(localStorage.getItem('publisheriq-theme'));
}
```

### Colors not changing

Ensure you're using CSS variable tokens, not hardcoded colors:

```tsx
// Won't respond to theme changes
<div className="bg-white text-black">

// Will respond to theme changes
<div className="bg-surface text-text-primary">
```

### Dark mode not working in specific component

Check for overriding styles or missing dark class propagation. The `dark` class must be on an ancestor element.

---

## Related Documentation

- [Design System Architecture](../architecture/design-system.md) - Full design system reference
- [v2.0 Release Notes](../releases/v2.0-new-design.md) - Changelog
