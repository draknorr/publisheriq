# Global Search

PublisherIQ includes a global search feature that lets you quickly find games, publishers, and developers from anywhere in the application.

---

## Opening Search

Press **⌘K** (Mac) or **Ctrl+K** (Windows/Linux) to open the search dialog.

You can also close search by:
- Pressing **ESC**
- Clicking outside the dialog

---

## How It Works

1. Start typing to search (minimum 2 characters required)
2. Results appear as you type (150ms debounce for performance)
3. Use arrow keys to navigate results
4. Press **Enter** to go to the selected item

### Search Behavior

| Feature | Behavior |
|---------|----------|
| **Minimum characters** | 2 characters required to trigger search |
| **Debounce delay** | 150ms - prevents excessive API calls |
| **Request cancellation** | New searches cancel pending requests |
| **Case sensitivity** | Case-insensitive matching |

### What's Searched

The search queries three entity types simultaneously:

| Type | What's Matched | Navigates To |
|------|----------------|--------------|
| **Games** | Game titles | `/apps/{appid}` |
| **Publishers** | Publisher names | `/publishers/{id}` |
| **Developers** | Developer names | `/developers/{id}` |

Results are ranked by match quality, with near-exact matches appearing first.

---

## Result Display

Each result shows relevant metrics at a glance for quick evaluation.

### Games

| Element | Description |
|---------|-------------|
| **Game title** | Full name of the game |
| **Release year** | Year the game was released (if available) |
| **Review score** | Positive review percentage, color-coded |
| **Review count** | Total reviews (formatted as "1.2K" or "1.5M") |
| **Free badge** | Cyan "Free" label for free-to-play games |
| **CCU sparkline** | 7-day concurrent user trend visualization |

**Score color coding:**
- Green (80%+): Very positive
- Yellow (70-79%): Mostly positive
- Gray (<70%): Mixed or negative

### Publishers & Developers

| Element | Description |
|---------|-------------|
| **Company name** | Publisher or developer name |
| **Game count** | Total number of games published/developed |
| **Icon color** | Purple for publishers, green for developers |

---

## Smart Ordering

Search results use intelligent ordering based on match quality and context.

### How It Works

The search calculates a match score for each result. When a publisher or developer has a **near-exact match** (score >= 0.9), that section is shown first.

### Examples

| Search Query | First Result | Reason |
|--------------|--------------|--------|
| "valve" | Valve (Publisher) | Exact publisher name match |
| "elden" | Elden Ring (Game) | Game title is closest match |
| "rockstar" | Rockstar Games (Publisher) | Exact company match |
| "portal" | Portal (Game) | Game title match |

### Section Order Logic

1. Calculate match scores for best result in each section
2. If publisher/developer has score >= 0.9, prioritize that section
3. Otherwise, sort sections by highest score
4. Empty sections are hidden

This ensures you find what you're looking for without scrolling through irrelevant categories.

---

## Chat Integration

When search results don't have what you need, quick actions at the bottom let you transition to the AI chat.

### Available Actions

| Action | Icon | What It Does |
|--------|------|--------------|
| **Ask in Chat** | Message icon (blue) | Opens chat with "Tell me about {query}" |
| **Find Similar** | Sparkles icon (orange) | Opens chat with "Find games similar to {query}" |

### When Actions Appear

Actions appear automatically when you've typed at least 2 characters, even if no results are found.

### Use Cases

**Ask in Chat:**
- Get detailed information about a topic
- Ask follow-up questions
- Explore related games, publishers, or genres

**Find Similar:**
- Discover games like ones you enjoy
- Find alternatives to a specific title
- Explore a genre through a reference game

### How It Works

Clicking an action:
1. Closes the search dialog
2. Navigates to `/chat`
3. Pre-fills the chat input with a query
4. The AI begins processing your request

---

## Tips

- **Be specific**: "Half-Life 2" finds the exact game faster than "half life"
- **Search publishers**: Type a publisher name to see all their games
- **Quick navigation**: Use search as a fast way to jump between pages
- **Partial matches work**: "rock" finds "Rockstar Games" and games with "rock" in the title

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **`⌘K`** / **`Ctrl+K`** | Open search from anywhere |
| **`Escape`** | Close search dialog |
| **`Up Arrow`** / **`Down Arrow`** | Navigate through results |
| **`Enter`** | Select highlighted result |

For a complete list of application shortcuts, see [Keyboard Shortcuts](./keyboard-shortcuts.md).

---

## Related Documentation

- [Keyboard Shortcuts](./keyboard-shortcuts.md) - Complete shortcut reference
- [Games Page](./games-page.md) - Browse and filter all games
- [Companies Page](./companies-page.md) - Browse publishers and developers
- [Chat Interface](./chat-interface.md) - Natural language queries
