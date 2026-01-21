# Smart Query Suggestions Feature

**Implemented:** January 12, 2026
**Branch:** `personalization`
**Commit:** `055a072`

## Overview

Two complementary features for helping users write better queries in the chat interface:

1. **Type-Ahead Autocomplete** - Suggestions appear as you type
2. **Post-Response Suggestions** - Follow-up queries appear after assistant responds

Both are pattern-based (no LLM calls) for speed and zero marginal cost.

---

## Feature 1: Type-Ahead Autocomplete

### Architecture

```
User types "roguel..."
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  INSTANT (client-side, <50ms)                           │
│  - Filter query templates matching input                │
│  - Filter cached tags/genres                            │
└─────────────────────────────────────────────────────────┘
         │
         ▼ (after 150ms debounce)
┌─────────────────────────────────────────────────────────┐
│  ASYNC (API call to /api/search)                        │
│  - Search games/publishers/developers                   │
│  - Generate query suggestions from results              │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  COMBINED DROPDOWN                                      │
│  - Templates section                                    │
│  - Tags section                                         │
│  - Games section                                        │
│  - Publishers/Developers section                        │
└─────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `lib/chat/query-templates.ts` | Hardcoded query patterns, matching logic |
| `hooks/useAutocompleteData.ts` | Pre-fetch tags, localStorage cache (1h TTL) |
| `components/chat/AutocompleteDropdown.tsx` | Dropdown UI with grouped sections |
| `components/chat/ChatInput.tsx` | Input with autocomplete integration |
| `app/api/autocomplete/tags/route.ts` | API to fetch all tags/genres/categories |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| Arrow Down/Up | Navigate suggestions |
| Enter | Select highlighted suggestion |
| Tab | Complete with top suggestion |
| Escape | Close dropdown |

### Data Flow

1. On chat page mount → `useAutocompleteData` checks localStorage
2. If cache expired → Fetches `/api/autocomplete/tags` → Caches in localStorage
3. User types → Instant filtering of templates + cached tags
4. After 150ms pause → Debounced fetch to `/api/search` for entities
5. Results combined and displayed in dropdown

---

## Feature 2: Post-Response Suggestions

### Architecture

```
Assistant response completes
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Extract entities from tool results                     │
│  - Games (names, appids)                                │
│  - Publishers/Developers                                │
│  - Tags used in search                                  │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Generate suggestions by tool type                      │
│  - find_similar → "Hidden gems like X", "Steam Deck..." │
│  - search_games → "Trending X", "X on Steam Deck"       │
│  - discover_trending → "What's breaking out?"           │
│  - lookup_games → "Games similar to X"                  │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Render 3-4 chips below assistant message               │
│  Click → Auto-submit query                              │
└─────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `lib/chat/suggestion-generator.ts` | Pattern-based suggestion generation |
| `components/chat/SuggestionChips.tsx` | Clickable chips UI |
| `components/chat/ChatMessage.tsx` | Integrates chips into message |
| `components/chat/ChatContainer.tsx` | Generates suggestions, handles clicks |

### Suggestion Patterns by Tool

| Tool | Suggestions Generated |
|------|----------------------|
| `find_similar` | "Hidden gems like X", "Steam Deck games like X" |
| `search_games` | "Trending X games", "X on Steam Deck" |
| `search_by_concept` | "Add Steam Deck filter", "Find hidden gems" |
| `discover_trending` | "What's breaking out?", "Tell me about X" |
| `lookup_games` | "Games similar to X", "More by developer" |
| `lookup_publishers` | "X's best rated games" |

---

## Cost & Performance

| Aspect | Autocomplete | Post-Response |
|--------|--------------|---------------|
| **LLM Cost** | $0 | $0 |
| **API Calls** | 1 pre-fetch + debounced search | 0 |
| **Latency** | <50ms (instant) + 150ms (async) | 0ms |
| **Storage** | ~50KB localStorage | None |

---

## Testing

1. Run `pnpm --filter admin dev`
2. Navigate to `/chat`
3. Test autocomplete:
   - Focus input (empty) → See example prompts
   - Type "roguel" → See template suggestions
   - Type game name → See game-based suggestions
   - Use arrow keys, enter, tab, escape
4. Test post-response suggestions:
   - Ask "Show me roguelike games"
   - Wait for response
   - See suggestion chips below response
   - Click a chip → Auto-submits

---

## Future Enhancements

- [ ] Track suggestion click analytics
- [ ] Personalize based on user query history
- [ ] Add "popular queries" section from chat_query_logs
- [ ] Cache recent entity searches in sessionStorage
