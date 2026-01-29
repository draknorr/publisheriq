# Chat Page Review (2026-01-29)

## Scope
Reviewed the `/chat` page end-to-end (Next.js App Router) with a focus on:
- All user entry points / query surfaces that can feed the chat
- How the chat loads and streams data (`POST /api/chat/stream` SSE)
- How results render (markdown, entity links, tool details panel)
- All supporting query endpoints used by the chat UI (`/api/search`, `/api/autocomplete/tags`)
- Security + correctness issues grounded in **direct database inspection** (read-only queries), not just migrations

Code areas covered (non-exhaustive):
- Page: `apps/admin/src/app/(main)/chat/page.tsx`
- UI: `apps/admin/src/components/chat/*`
- Streaming client: `apps/admin/src/hooks/useChatStream.ts`
- Streaming API: `apps/admin/src/app/api/chat/stream/route.ts`
- Search APIs: `apps/admin/src/app/api/search/route.ts`, `apps/admin/src/app/api/autocomplete/tags/route.ts`
- Search services: `apps/admin/src/lib/search/*`, `apps/admin/src/lib/qdrant/search-service.ts`
- Tool definitions: `apps/admin/src/lib/llm/tools.ts`, `apps/admin/src/lib/llm/cube-tools.ts`

## End-to-End Query Surfaces

### URL query params
The `/chat` page accepts:
- `q` (string): initial query auto-submitted on first load.

Notes:
- Only `q` is supported by `apps/admin/src/app/(main)/chat/page.tsx`.
- No normalization for `q` being `string[]` (repeated query params) is present.
- Navigating to a new `/chat?q=...` while staying on the same route may not re-submit if the component instance persists (see `hasSubmittedInitialQuery` in `ChatContainer`).

### In-app deep links to `/chat?q=...`
These routes push queries into chat:
- Global spotlight search:
  - `apps/admin/src/components/search/GlobalSearch.tsx` (`Tell me about ${query}`, `Find games similar to ${query}`)
- Dashboard search suggestions:
  - `apps/admin/src/app/(main)/dashboard/DashboardSearch.tsx`
- Admin dashboard chat logs links:
  - `apps/admin/src/app/(main)/admin/AdminDashboard.tsx`

### Manual input / UI-triggered queries
Within `/chat`:
- Empty state prompt chips (random examples): `ChatContainer` → `handleSend(suggestion)`
- Free-form text: `ChatInput` → send button or Enter
- Autocomplete dropdown:
  - Enter / Tab selects the highlighted suggestion if the dropdown is open
- Post-response suggestion chips:
  - `SuggestionChips` (generated from last assistant message tool calls)

### Network requests triggered by `/chat`
From the chat UI:
- `POST /api/chat/stream` (SSE stream of assistant response + tool events)
- `GET /api/autocomplete/tags` (prefetch tag/genre/category lists for instant autocomplete)
- `POST /api/search` (entity search for autocomplete suggestions)

### LLM tool calls that can appear in chat (server-side)
Tools depend on `USE_CUBE_CHAT` (`apps/admin/src/app/api/chat/stream/route.ts`):
- If `USE_CUBE_CHAT=false` (`apps/admin/src/lib/llm/tools.ts`):
  - `query_database`, `find_similar`, `search_games`, `lookup_tags`
- If `USE_CUBE_CHAT=true` (`apps/admin/src/lib/llm/cube-tools.ts`):
  - `query_analytics`, `find_similar`, `search_by_concept`, `search_games`, `discover_trending`
  - `lookup_tags`, `lookup_publishers`, `lookup_developers`, `lookup_games`

## Data Flow (Load → Stream → Render)

### Page load & initial query
1. `apps/admin/src/app/(main)/chat/page.tsx` reads `searchParams.q` and passes `initialQuery` to `ChatContainer`.
2. `ChatContainer` auto-submits `initialQuery` once (guarded by `hasSubmittedInitialQuery`).

### Sending a message & streaming response
1. `ChatContainer` calls `sendMessage()` from `useChatStream`.
2. `useChatStream.sendMessage()`:
   - Appends a user message + a placeholder assistant message.
   - Builds request history from current UI messages (role+content only) and sends:
     - `POST /api/chat/stream` with `{ messages: [{role, content}, ...] }`.
3. The client reads SSE and handles events:
   - `text_delta`: append to assistant content
   - `tool_start`: show “Executing …”
   - `tool_result`: accumulate tool calls + attach timing
   - `message_end`: finalize toolCalls + timing + debug metadata on the assistant message
   - `error`: surface error message and keep partial assistant content

### Server tool loop
`apps/admin/src/app/api/chat/stream/route.ts`:
- Requires an authenticated Supabase user (always).
- Optionally enforces credits/rate limit via RPCs if `CREDITS_ENABLED=true`.
- Builds messages with a system prompt + the client’s message history.
- Chooses tool set:
  - `USE_CUBE_CHAT=true` → `CUBE_TOOLS`
  - else → `TOOLS`
- Runs an iterative tool loop (max 5 iterations), streaming text deltas and tool events as SSE.
- Emits `message_end` with timing, debug stats, token usage, and (optionally) credits charged.
- Logs the last user query to `chat_query_logs`.

### Rendering
Assistant messages are rendered with:
- `apps/admin/src/components/chat/content/StreamingContent.tsx`
  - `react-markdown` + `remark-gfm`
  - Custom link renderer to convert `[Name](game:123)` / `/publishers/:id` / `/developers/:id` into Next links
  - Tables attempt auto-linking via `EntityLinkContext` mappings derived from tool results
  - Mermaid diagrams render SVG via `dangerouslySetInnerHTML`

## Key Findings

### 1) CRITICAL: `execute_readonly_query` is SECURITY DEFINER and executable by `PUBLIC`/`anon`
**What**
- The chat “raw SQL” tool (`query_database`) ultimately calls the PostgREST RPC `public.execute_readonly_query(text)` using the **anon key** (`apps/admin/src/lib/query-executor.ts`).
- Direct DB inspection shows:
  - `public.execute_readonly_query(text)` is `SECURITY DEFINER`, owned by `postgres`, and `EXECUTE` is granted to `PUBLIC` (and therefore `anon`).
  - It only checks that the query starts with `SELECT` and blocks a small keyword list, then dynamically executes `FROM ( <query_text> ) t` and aggregates all rows to JSONB.
  - It does **not** enforce a server-side `LIMIT`.

**Why it matters**
- In Supabase, **`anon` can call RPCs directly**. If `execute_readonly_query` is `SECURITY DEFINER` and owned by `postgres` (table owner), it can **bypass RLS** on tables where RLS is enabled but not forced.
- This is a major data exfiltration risk because:
  - The anon key is public by design.
  - `PUBLIC EXECUTE` means unauthenticated callers can invoke the function.

**Recommended fixes**
- Immediately `REVOKE EXECUTE` from `PUBLIC`/`anon` for `execute_readonly_query`.
- Prefer `SECURITY INVOKER` + strict RLS, or move this capability behind a server-only service role boundary.
- Add server-side guardrails in the function itself (hard `LIMIT`, allowlist of tables/columns, forbid `information_schema`, forbid `pg_catalog`, forbid `auth.*`, forbid sensitive tables).

### 2) CRITICAL: Credit + rate-limit RPCs are SECURITY DEFINER and executable by `PUBLIC`/`anon`
**What**
- `reserve_credits`, `finalize_credits`, `refund_reservation`, `check_and_increment_rate_limit` are all:
  - `SECURITY DEFINER`, owned by `postgres`
  - `EXECUTE` granted to `PUBLIC` (and therefore `anon`)
- These functions **mutate** `user_profiles`, `credit_reservations`, `credit_transactions`, and `rate_limit_state`.

**Why it matters**
- If callable by `anon`, an unauthenticated caller can potentially:
  - decrement or increment balances
  - create reservations/transactions
  - manipulate rate limit state
  - target arbitrary users via `p_user_id` parameters

**Recommended fixes**
- Immediately `REVOKE EXECUTE` from `PUBLIC`/`anon` for these write RPCs.
- Enforce `p_user_id = auth.uid()` inside the function body (or validate a service-only secret).
- Consider `FORCE ROW LEVEL SECURITY` on sensitive tables if any SECURITY DEFINER patterns remain.

### 3) HIGH: `/api/search` response shape mismatch breaks chat entity autocomplete
**What**
- `apps/admin/src/app/api/search/route.ts` returns `{ success, query, results: { games, publishers, developers } }`.
- `apps/admin/src/components/chat/ChatInput.tsx` incorrectly reads `data.games`, `data.publishers`, `data.developers`.

**Impact**
- Game/publisher/developer suggestions from the API never appear (only template/tag/example suggestions show).

### 4) HIGH: Autocomplete dropdown never shows “Searching…” / “No suggestions found”
**What**
- `AutocompleteDropdown` supports loading/empty states.
- But `ChatInput` only renders it when `isDropdownOpen && allSuggestions.length > 0`.

**Impact**
- When there are zero suggestions, the dropdown is hidden, so users never see “Searching…” or “No suggestions found”.

### 5) HIGH: Anthropic provider cannot stream; docs claim Claude
**What**
- `apps/admin/src/lib/llm/providers/anthropic.ts` implements `chat()` only (no `chatStream()`).
- `apps/admin/src/app/api/chat/stream/route.ts` requires `provider.chatStream` and emits an SSE error if missing.
- `docs/user-guide/chat-interface.md` states the system uses Claude (Anthropic).

**Impact**
- If `LLM_PROVIDER=anthropic`, streaming chat fails with “Provider does not support streaming”.
- Documentation and runtime capabilities are inconsistent.

### 6) MED: Non-2xx responses from `/api/chat/stream` lose actionable error details
**What**
- Server returns JSON errors for `401/402/429` (not SSE).
- Client throws `HTTP ${status}` and does not parse JSON error bodies.

**Impact**
- Users see opaque errors (“HTTP 402”) instead of actionable messages (e.g., insufficient credits, retry-after).

### 7) MED: Conversation context is lossy (tool context never sent back)
**What**
- `useChatStream` only sends `{role, content}` history; it drops tool calls and tool results.

**Impact**
- Follow-up questions may cause re-work and inconsistent responses because the LLM cannot see prior tool outputs.

### 8) MED: Auto-scroll likely causes jank during streaming
**What**
- `ChatContainer` calls `scrollIntoView({ behavior: 'smooth' })` on every `messages`/`isStreaming` change.
- Streaming updates can fire many times per second.

**Impact**
- Scrolling performance suffers and can “fight” the user when reading earlier messages.

### 9) MED: Tool details panel is missing handling for `lookup_tags`
**What**
- `ChatMessage` renders explicit UI for many tools, but not `lookup_tags`.

**Impact**
- “Unknown tool” appears even though the tool is supported and used.

### 10) MED: Mermaid SVG injection is un-hardened
**What**
- `MermaidBlock` injects rendered SVG via `dangerouslySetInnerHTML`.

**Impact**
- If mermaid output isn’t strictly sanitized/locked down, LLM-provided diagrams can become an XSS vector.

### 11) LOW/MED: Chat UI has unused or inconsistent components
**What**
- `ChatLoadingIndicator` exists but isn’t used on `/chat`.
- `MessageContent` + `CollapsibleSection` (collapse long output) exists, but `/chat` renders via `StreamingContent` without collapsing.
- Syntax highlighting is inconsistent (query details uses Shiki; streamed code blocks do not).

**Impact**
- Mismatch with docs (“long responses collapse”) and inconsistent UX.

### 12) LOW: Query templates include hard-coded “2025”
**What**
- `apps/admin/src/lib/chat/query-templates.ts` includes “best {input} games of 2025”.

**Impact**
- Autocomplete suggests stale queries in 2026.

### 13) MED: `search_games` tool schema is missing capabilities the backend supports (`on_sale`)
**What**
- `apps/admin/src/lib/search/game-search.ts` supports `on_sale?: boolean` and applies a discount filter when `on_sale === true`.
- Neither `apps/admin/src/lib/llm/tools.ts` nor `apps/admin/src/lib/llm/cube-tools.ts` exposes `on_sale` in the tool JSON schema.

**Impact**
- Users can ask “show me games on sale…”, but the LLM is unlikely to call the tool with `on_sale` because it’s not in the schema.

### 14) MED: Non-critical server work after `message_end` can still emit `error`
**What**
- `/api/chat/stream` enqueues `message_end`, then awaits `logChatQuery(...)` inside the same `try` block.
- If logging throws, the `catch` enqueues an `error` event and may attempt a refund.

**Impact**
- A client can receive `message_end` (done) followed by `error` (looks like failure), causing confusing UI state.

## Proposed Fixes

### Security (highest priority)
1. **Lock down SECURITY DEFINER RPCs**
   - `REVOKE EXECUTE` from `PUBLIC`/`anon` for:
     - `execute_readonly_query`
     - `reserve_credits`, `finalize_credits`, `refund_reservation`, `check_and_increment_rate_limit`
   - Re-grant only to `authenticated` (or a dedicated role), and enforce `auth.uid()` checks in the function body.
2. **Re-evaluate the raw SQL tool (`query_database`)**
   - If keeping it:
     - enforce server-side `LIMIT` inside the function (not just the client validator)
     - add allowlists and schema restrictions at the DB layer
   - Prefer moving to Cube-only (`query_analytics`) with strict semantic models.
3. **Harden mermaid rendering**
   - Configure Mermaid with a strict security model and sanitize SVG output before injecting.
   - Consider rendering diagrams server-side or in a sandboxed iframe if needed.

### Correctness
1. Fix `/api/search` response parsing in `ChatInput.tsx` to use `data.results.*`.
2. Render `AutocompleteDropdown` while open even if `allSuggestions.length === 0` so loading/empty UI is visible.
3. Add `lookup_tags` rendering to `ChatMessage` tool details.
4. Remove the unconditional `console.log` from `apps/admin/src/lib/llm/format-entity-links.ts` (server noise + potential data leakage).
5. Add missing `search_games` tool params that the backend already supports (e.g., `on_sale` exists in `SearchGamesArgs` but isn’t in the tool schema).

### UX / Behavior
1. **Scroll behavior**
   - Only auto-scroll if the user is already near the bottom.
   - Avoid `smooth` scrolling during streaming (use instant) or throttle updates.
2. **Enter key behavior**
   - Consider requiring explicit arrow navigation before Enter selects a suggestion (otherwise send typed message).
3. **Improve streaming affordances**
   - Use `ChatLoadingIndicator` for the gap between “send” and first `text_delta`.
4. **Add “Clear chat”**
   - Hook exists (`clearMessages`), but UI doesn’t expose it.
5. **Stop behavior**
   - When aborting a stream, update the placeholder assistant message explicitly (“Stopped”) to avoid empty assistant bubbles.

### Docs alignment
1. Update docs to match runtime reality:
   - whether Cube is always used (`USE_CUBE_CHAT`)
   - which LLM provider is used by default (OpenAI vs Anthropic)
   - whether long outputs actually collapse in the current `/chat` implementation
2. Fix stale docs link in `apps/admin/README.md` (it references `docs/guides/chat-interface.md`, but current guide is `docs/user-guide/chat-interface.md`).

### Quality improvements
1. Make query templates year-agnostic (“this year”) or dynamic.
2. Consider persisting chat sessions (optional) if users expect history after refresh.
3. Add basic request schema validation on `/api/chat/stream` (roles, content length, message count).
4. Ensure `/api/chat/stream` doesn’t emit an `error` event after a `message_end` due to non-critical failures (e.g., logging); isolate logging failures from the streaming lifecycle.

## Direct DB Verification Notes

### Environment
- Verified against the database configured by `.env` `DATABASE_URL` on **2026-01-29**.
- Only **read-only** queries were executed.

### Read-only SQL used (repro steps)
Below are the exact SQL statements used for verification (run them in a read-only session; do not include credentials in history/logs).

**Table existence**
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN (
    'chat_query_logs','user_profiles',
    'steam_tags','steam_genres','steam_categories',
    'ccu_snapshots',
    'credit_reservations','credit_transactions','rate_limit_state'
  )
ORDER BY table_name;
```

**RLS flags + owners (why SECURITY DEFINER is risky)**
```sql
SELECT
  c.relname,
  c.relrowsecurity,
  c.relforcerowsecurity,
  pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
  AND c.relname IN (
    'user_profiles','credit_reservations','credit_transactions','rate_limit_state',
    'chat_query_logs','steam_tags','steam_genres','steam_categories'
  )
ORDER BY c.relname;
```

**Function metadata + ACL (PUBLIC EXECUTE check)**
```sql
SELECT
  p.proname,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef,
  p.provolatile,
  p.proacl
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN (
    'execute_readonly_query',
    'reserve_credits','finalize_credits','refund_reservation','check_and_increment_rate_limit',
    'search_games_fuzzy','search_publishers_fuzzy','search_developers_fuzzy'
  )
ORDER BY p.proname;
```

**Critical function definitions**
```sql
SELECT pg_get_functiondef('public.execute_readonly_query(text)'::regprocedure);
SELECT pg_get_functiondef('public.reserve_credits(uuid,integer)'::regprocedure);
SELECT pg_get_functiondef('public.finalize_credits(uuid,integer,text,integer,integer,integer)'::regprocedure);
SELECT pg_get_functiondef('public.refund_reservation(uuid)'::regprocedure);
SELECT pg_get_functiondef('public.check_and_increment_rate_limit(uuid)'::regprocedure);
```

**Reference list sizes**
```sql
SELECT 'steam_tags' AS tbl, count(*) FROM public.steam_tags
UNION ALL
SELECT 'steam_genres', count(*) FROM public.steam_genres
UNION ALL
SELECT 'steam_categories', count(*) FROM public.steam_categories;
```

**Approx row counts**
```sql
SELECT relname, reltuples::bigint AS est_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
  AND relname IN ('apps','publishers','developers','ccu_snapshots')
ORDER BY relname;
```

**Trigram index presence**
```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname='public'
  AND tablename IN ('apps','publishers','developers')
  AND (indexdef ILIKE '%gin%' OR indexdef ILIKE '%trgm%')
ORDER BY tablename, indexname;
```

**Fuzzy search explain (representative)**
```sql
BEGIN READ ONLY;
SET LOCAL pg_trgm.similarity_threshold='0.3';
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.id, p.name, p.game_count
FROM publishers p
WHERE p.game_count > 0
  AND (LOWER(p.name) % 'valve' OR LOWER(p.name) ILIKE '%valve%')
ORDER BY (LOWER(p.name) ILIKE '%valve%') DESC, p.game_count DESC
LIMIT 5;
ROLLBACK;
```

### Tables (existence & size signals)
Confirmed existence:
- `chat_query_logs`, `user_profiles`, `steam_tags`, `steam_genres`, `steam_categories`, `ccu_snapshots`, `credit_reservations`, `credit_transactions`, `rate_limit_state`

Observed counts / estimates:
- `steam_tags`: 446 rows
- `steam_genres`: 42 rows
- `steam_categories`: 76 rows
- Estimated rows:
  - `apps`: ~160,312
  - `publishers`: ~89,700
  - `developers`: ~104,867
  - `ccu_snapshots`: ~1,494,889

### RLS flags (why SECURITY DEFINER is risky here)
For key tables (including `user_profiles`, credit tables, and `chat_query_logs`):
- `relrowsecurity = true`
- `relforcerowsecurity = false`
- `owner = postgres`

Implication:
- RLS is enabled but not forced, and the owner (`postgres`) can bypass it.
- SECURITY DEFINER functions owned by `postgres` can therefore bypass RLS.

### Function privilege checks (high risk)
Direct inspection showed these functions are all **SECURITY DEFINER** and have **PUBLIC EXECUTE**:
- `execute_readonly_query(text)`
- `reserve_credits(uuid, integer)`
- `finalize_credits(uuid, integer, text, integer, integer, integer)`
- `refund_reservation(uuid)`
- `check_and_increment_rate_limit(uuid)`

### Fuzzy search query performance & index usage (representative inputs)
Trigram indexes exist:
- `apps`: `idx_apps_name_lower_trgm`
- `publishers`: `idx_publishers_name_lower_trgm`
- `developers`: `idx_developers_name_lower_trgm`

Representative `EXPLAIN (ANALYZE, BUFFERS)` results (read-only session with `pg_trgm.similarity_threshold=0.3`):
- Games search (“elden”, limit 5):
  - Uses `Bitmap Index Scan` on `idx_apps_name_lower_trgm`
  - ~36 ms execution time (warm cache)
- Publishers search (“valve”, limit 5):
  - Uses `Bitmap Index Scan` on `idx_publishers_name_lower_trgm`
  - ~6 ms execution time (warm cache)
- Developers search (“from”, limit 5):
  - Uses `Bitmap Index Scan` on `idx_developers_name_lower_trgm`
  - ~11 ms execution time (warm cache)

## Verification Checklist
- Autocomplete:
  - Type “elden” and confirm `/api/search`-driven suggestions appear in chat input.
  - Confirm dropdown shows “Searching…” and “No suggestions found” states.
- Streaming:
  - Confirm `/api/chat/stream` renders meaningful errors for `401/402/429` (not just `HTTP 401`).
  - Confirm Stop leaves a sensible partial message state.
- Tools + rendering:
  - Trigger each tool (`lookup_tags`, `search_games`, `find_similar`, etc.) and confirm Query Details renders the tool.
  - Render tables with both pre-linked and plain text game names and confirm links are correct.
  - Render a mermaid code block and confirm it’s safe + stable.
- Security:
  - Confirm `execute_readonly_query` and credit/rate-limit RPCs are **not** callable by `anon` after privilege changes (separate task).

---

## Rapid Query QA Plan (Manual, UI + Chat Logs)

Goal: quickly reproduce “real chat” queries end-to-end, inspect tool usage/output, and decide what needs fixing.

### 0) Pre-flight (Cube mode recommended)
This repo supports two tool modes:
- `USE_CUBE_CHAT=true` → Cube tools (`apps/admin/src/lib/llm/cube-tools.ts`)
- `USE_CUBE_CHAT=false` → raw SQL tool (`apps/admin/src/lib/llm/tools.ts`)

For quality testing, prefer Cube mode:
1. Ensure env vars are set:
   - `USE_CUBE_CHAT=true`
   - `CUBE_API_URL`, `CUBE_API_SECRET` (required by `apps/admin/src/lib/cube-executor.ts`)
   - Streaming LLM provider (recommended): `LLM_PROVIDER=openai` + `OPENAI_API_KEY`
   - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Run admin: `pnpm --filter admin dev` (defaults to http://localhost:3001)
3. Log in to the dashboard in your browser.

### 1) The fast loop (per query)
For each query:
1. Open `/chat?q=<your query>` (URL param auto-submits on load).
2. Wait for the assistant to finish streaming.
3. Expand **Query Details** on the assistant message:
   - Confirm tool(s) used and args look sane (segments/filters/limit/order).
   - Sanity-check the rows returned (presence, sorting, and obvious filter application).
4. Open `/admin` (Admin Dashboard) and verify the new row in **Chat Logs**:
   - `tool_names`, `tool_count`, `iteration_count`, `timing_total_ms`, `response_length`
5. Record PASS/FAIL using the rubric below and note what looks broken.

### 2) Smoke-test suite (covers Cube tools)
Tip: use `/admin/chat-smoke` for one-click links to these queries.

Run these queries exactly (designed to force each tool):

**`query_analytics`**
- What are the top 10 games by total reviews?
- Top Steam Deck verified games with 90%+ reviews and at least 10,000 reviews

**`search_games`**
- Linux games with Workshop support and 90%+ reviews
- Metroidvania games under $20 with full controller support

**`search_by_concept`**
- Tactical roguelikes with deck building

**`discover_trending`**
- What’s breaking out right now?
- Declining multiplayer games

**`find_similar`**
- Games similar to Hades but less popular
- Publishers similar to Devolver Digital

**`lookup_games` → typically `query_analytics`**
- Tell me about Elden Ring

**`lookup_publishers` → typically `query_analytics`**
- Show me all games by Krafton

**`lookup_developers` → typically `query_analytics`**
- Show me all games by FromSoftware

**`lookup_tags`**
- What tags exist for colony sim games?

### 3) Output quality rubric (PASS/FAIL)
**Tool choice & args**
- Expected tool(s) for query type (see `docs/user-guide/chat-query-examples.md`).
- Args are reasonable (segments for common filters, limit present, order sensible).
- No unnecessary repeated tool calls / iteration thrash.

**Data correctness (sanity checks)**
- Sorting and thresholds match the prompt (“top by reviews” is actually top by reviews).
- Filters visibly applied (Steam Deck, platforms, release year, min reviews, etc.).
- Answer doesn’t introduce claims unsupported by the tool results.

**Rendering & UX**
- Tables render cleanly (no broken markdown).
- Entity links work: games `[Name](game:APPID)`, publishers/developers `/publishers/:id` / `/developers/:id`.
- “Query Details” reflects all tool calls used.

**Performance & reliability**
- No `error` after `message_end`.
- Timings are within reasonable range for your environment; large regressions get flagged.

### 4) Triage: map failures to likely code areas
- Wrong tool selection / poor prompt guidance: `apps/admin/src/lib/llm/cube-system-prompt.ts`, `apps/admin/src/lib/llm/cube-tools.ts`
- Tool schema missing needed params: `apps/admin/src/lib/llm/cube-tools.ts` + backend tool impls in `apps/admin/src/lib/search/*`
- Entity link formatting weirdness: `apps/admin/src/lib/llm/format-entity-links.ts`, `apps/admin/src/components/chat/content/*`
- Autocomplete/query entry UX: `apps/admin/src/components/chat/ChatInput.tsx`, `apps/admin/src/components/chat/AutocompleteDropdown.tsx`, `apps/admin/src/app/api/search/route.ts`
- Streaming/client errors: `apps/admin/src/hooks/useChatStream.ts`, `apps/admin/src/app/api/chat/stream/route.ts`
