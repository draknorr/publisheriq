# Keyboard Shortcuts

PublisherIQ supports keyboard shortcuts throughout the application for faster navigation and efficient workflows.

---

## Global Shortcuts

These shortcuts work from anywhere in the application.

| Shortcut | Action | Context |
|----------|--------|---------|
| **`⌘K`** / **`Ctrl+K`** | Open global search | From navigation bar |
| **`⌘K`** / **`Ctrl+K`** | Open command palette | On Games/Companies pages |
| **`Escape`** | Close current dialog/modal | Closes search, compare mode, export dialog, etc. |

> **Note:** On the Games (`/apps`) and Companies (`/companies`) pages, ⌘K opens the **Command Palette** instead of global search. Use the navigation search icon for global search on these pages.

---

## Command Palette (Games & Companies Pages)

The command palette provides unified filtering on the Games and Companies pages.

### Opening & Closing

| Shortcut | Action |
|----------|--------|
| **`⌘K`** / **`Ctrl+K`** | Open command palette |
| **`Escape`** | Close palette or go back to previous view |

### Navigation

| Shortcut | Action | Context |
|----------|--------|---------|
| **`↑`** / **`↓`** | Navigate through options | When palette is open |
| **`Enter`** | Apply selection | When option is highlighted |
| **`Backspace`** (empty input) | Go back to home view | When in Tags/Genres/Categories view |

### Filter Syntax Shortcuts

Type directly in the command palette search to apply filters:

| Syntax | Example | Result |
|--------|---------|--------|
| Range | `ccu > 50000` | CCU filter: greater than 50,000 |
| Range | `score >= 90` | Review score: 90% or higher |
| Range | `ccu 1000-50000` | CCU between 1,000 and 50,000 |
| Boolean | `free` or `free:yes` | Free-to-play games only |
| Boolean | `ea:no` | Exclude Early Access |
| Content | `genre:action` | Action games |
| Content | `tag:roguelike` | Games with roguelike tag |
| Content | `deck:verified` | Steam Deck verified |
| Preset | `rising stars` | Apply Rising Stars preset |

### Common Shortcuts

| Shortcut | Filter |
|----------|--------|
| `ccu` | Peak CCU |
| `owners` | Total owners |
| `reviews` | Review count |
| `score` | Review score % |
| `price` | Price in dollars |
| `growth` | 7-day CCU growth |
| `momentum` | Momentum score |
| `free` | Free-to-play |
| `ea` | Early Access |
| `workshop` | Steam Workshop |

---

## Search Dialog

When the global search dialog is open:

| Shortcut | Action |
|----------|--------|
| **`Escape`** | Close search dialog |
| **`Up Arrow`** / **`Down Arrow`** | Navigate through search results |
| **`Enter`** | Select highlighted result and navigate |

---

## Games Page

On the Games page (`/apps`):

| Shortcut | Action | Notes |
|----------|--------|-------|
| **`Escape`** | Close compare mode | When comparison modal is open |
| **`Escape`** | Close export dialog | When export modal is open |
| **`Escape`** | Close column customizer | When column dropdown is open |
| **`Shift+Click`** | Range selection | Select all games between last click and current click |

---

## Companies Page

On the Companies page (`/companies`):

| Shortcut | Action | Notes |
|----------|--------|-------|
| **`Escape`** | Close compare mode | When comparison modal is open |
| **`Escape`** | Close export dialog | When export modal is open |
| **`Escape`** | Close column customizer | When column dropdown is open |
| **`Shift+Click`** | Range selection | Select all companies between last click and current click |

---

## Modal Dialogs

All modal dialogs share these behaviors:

| Shortcut | Action |
|----------|--------|
| **`Escape`** | Close the dialog |
| **Click outside** | Close the dialog |

**Dialogs affected:**
- Global search
- Compare mode
- Export dialog
- Column customizer
- Filter dropdowns
- Saved views menu

---

## Focus Management

When modals open, focus is automatically moved to an appropriate element:
- **Search dialog**: Focus moves to search input
- **Compare mode**: Focus moves to close button
- **Export dialog**: Focus moves to close button

This ensures keyboard-only users can immediately interact with the modal content.

---

## Tips

### Quick Navigation
Press **`⌘K`** (Mac) or **`Ctrl+K`** (Windows/Linux) to instantly open search from anywhere. Type a game, publisher, or developer name and press **Enter** to navigate directly.

### Batch Selection
On data table pages, hold **Shift** and click to select a range of items. Combined with bulk actions, this makes it easy to compare or export multiple items quickly.

### Escape to Dismiss
**Escape** is your universal "go back" or "cancel" key. It closes any open modal, dropdown, or overlay.

---

## Related Documentation

- [Global Search](./search.md) - Full search feature documentation
- [Games Page](./games-page.md) - Complete Games page guide
- [Companies Page](./companies-page.md) - Complete Companies page guide
- [v2.7 Release Notes](../releases/v2.7-design-command-palette.md) - Command Palette and Design System
