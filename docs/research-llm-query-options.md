# Research: Giving Users Claude Code-Level Query Power

## Context

PublisherIQ has an existing `/chat` feature with 15 LLM tools, a Cube.js semantic layer (27+ cubes), and guardrails. It works well for standard questions but is constrained compared to what you get when running Claude Code directly against the database — arbitrary SQL, iterative refinement, multi-step analysis, and model choice. The goal is to close that gap for product users.

**What makes Claude Code powerful for data analysis:**
1. **Iterative reasoning** — run a query, see results, refine, run again (unlimited loops)
2. **Arbitrary SQL** — not constrained to pre-defined cubes or tools
3. **Model choice** — use the best model for the job (Opus for complex reasoning, Haiku for speed)
4. **Full schema awareness** — the LLM understands the entire database structure
5. **No artificial limits** — no 5-iteration cap, no 50-row limit on intermediate results

---

## Option A: Add SQL Tool to Existing Chat (Quick Win)

### What it is
Add a `run_sql` tool alongside the existing 15 tools, letting the LLM write and execute read-only SQL directly. You already have `execute_readonly_query` RPC and `query-executor.ts` — this just exposes them as an LLM tool.

### How it works
- New tool definition in `cube-tools.ts`: `run_sql(query, reasoning)`
- LLM writes SELECT queries; they pass through existing validation (blocked tables, keyword checks, SELECT-only)
- System prompt gets a schema appendix (table names, key columns, indexes)
- Results returned to LLM for interpretation, same as other tools
- Raise row limit from 50 to 200-500 for this tool (intermediate results need more rows)

### Key changes
- `apps/admin/src/lib/llm/cube-tools.ts` — add tool definition
- `apps/admin/src/lib/llm/cube-system-prompt.ts` — add schema reference
- `apps/admin/src/lib/query-executor.ts` — raise row limit, add tool-specific config
- `apps/admin/src/lib/credits/calculator.ts` — add cost for SQL tool

### Model choice angle
None — still uses whatever model the server is configured with (GPT-4o-mini or Haiku).

### Pros
- **Tiny effort** — 1-2 days, mostly prompt engineering
- Leverages all existing safety infrastructure
- Immediately unlocks complex queries (JOINs, subqueries, window functions, CTEs)
- Works within existing credit/rate-limit system

### Cons
- Still limited to 5 tool iterations (can't do deep iterative analysis)
- Model is server-chosen, not user-chosen
- GPT-4o-mini / Haiku may struggle with complex SQL on a 15M+ row schema
- No user visibility into the SQL being run (trust the LLM)

### Effort: S (Small)
### Quality vs Claude Code: 4/10
Gets you arbitrary SQL but without iteration depth or model choice.

---

## Option B: BYO API Key + Model Selection

### What it is
Let users bring their own API keys and pick their preferred model (Claude Opus, GPT-4o, Gemini, etc.). Combined with Option A, this addresses the "LLMs of their choice" requirement directly.

### How it works
- User settings page where users enter API keys (encrypted at rest in `user_profiles` or a new `user_api_keys` table)
- Model picker in the chat UI (dropdown: Claude Opus 4, Sonnet 4, GPT-4o, GPT-4o-mini, etc.)
- Server-side provider routing: read user's key + model preference, instantiate the right provider
- When using own key: no credit charge for tokens (only tool execution costs)
- Existing provider abstraction (`BaseLLMProvider`) already supports this pattern

### Key changes
- New `user_api_keys` table (encrypted, RLS-protected)
- `apps/admin/src/lib/llm/providers/` — add provider factory, possibly Google/Gemini provider
- `apps/admin/src/app/api/chat/stream/route.ts` — read user model preference, instantiate provider
- Settings UI for API key management
- `apps/admin/src/lib/credits/calculator.ts` — skip token costs when BYO key

### Model choice angle
**This IS the model choice option.** Users pick exactly which model runs their queries.

### Pros
- Users can use Opus/GPT-4o for complex analysis, Haiku for quick lookups
- Reduces your LLM costs (users pay their own token costs)
- Power users get the exact model they want
- Relatively clean — the provider abstraction already exists

### Cons
- API key management is a security surface (encryption, rotation, breach risk)
- Must validate keys before use (bad keys = confusing errors)
- Different models have different tool-calling formats (already handled by provider abstraction, but more models = more edge cases)
- Support burden: "why doesn't my Gemini key work with screen_games?"
- Doesn't help with iteration depth or SQL access (combine with A and/or C)

### Effort: M (Medium)
### Quality vs Claude Code: 5/10 (alone), 7/10 (combined with A+C)
Model choice is a big part of the Claude Code experience, but without deeper iteration it's still constrained.

---

## Option C: Deep Agent Loop (The Big Unlock)

### What it is
Replace the 5-iteration tool loop with a proper agent loop that can reason across 15-25+ steps — plan a query strategy, execute, examine results, refine, cross-reference, and synthesize. This is what makes Claude Code feel magical for complex analysis.

### How it works
- Increase max iterations from 5 to 20-25 (configurable, with a hard ceiling)
- Add a `think` tool (scratchpad for intermediate reasoning without consuming output tokens)
- Add result caching within a conversation turn (so the LLM can reference earlier query results)
- Implement a "query plan" phase: LLM first outlines its approach, then executes step by step
- Progressive credit charging (charge per iteration, not flat reservation)
- Timeout protection: hard wall-clock limit (60-90 seconds) with graceful summarization

### Key changes
- `apps/admin/src/app/api/chat/stream/route.ts` — increase iteration cap, add timeout logic
- `apps/admin/src/lib/llm/cube-tools.ts` — add `think` tool, add result-reference tool
- `apps/admin/src/lib/llm/cube-system-prompt.ts` — add agent-mode instructions (plan then execute)
- `apps/admin/src/lib/credits/calculator.ts` — per-iteration charging model
- Streaming UX: show "Step 1/N: Looking up publisher..." progress indicators

### Model choice angle
Works with any model, but benefits dramatically from stronger models. Natural pairing with Option B — users who BYO an Opus key get much better multi-step reasoning than Haiku.

### Pros
- **This is the single biggest quality improvement** — iteration depth is what separates "nice chatbot" from "powerful analyst"
- Complex analyses become possible: "Compare the top 5 publishers by revenue growth over the last 6 months, breaking down by genre"
- LLM can self-correct (run query, notice issue, fix and retry)
- Progressive streaming gives users visibility into the reasoning process

### Cons
- Cost: 20 iterations of Opus is expensive (~$0.50-2.00 per complex query)
- Latency: multi-step analysis can take 30-90 seconds
- Runaway queries: need solid timeout and circuit-breaker logic
- Complex streaming UX (show progress without overwhelming)
- Risk of the LLM going in circles (need loop detection)

### Effort: L (Large)
### Quality vs Claude Code: 7/10
Gets you the iterative depth. Combined with A (SQL tool) and B (model choice), this reaches 8-9/10.

---

## Option D: MCP Server (Let Users Connect Their Own Tools)

### What it is
Expose your database and analytics as an MCP (Model Context Protocol) server. Users connect from Claude Code, Cursor, Windsurf, or any MCP-compatible client and query your data using their own tools and models.

### How it works
- Build an MCP server (Node.js or Python) that exposes tools:
  - `query_analytics` (existing Cube.js tool)
  - `run_sql` (read-only SQL with existing guardrails)
  - `search_games`, `find_similar`, etc. (existing tools)
  - `get_schema` (returns table/column descriptions)
- Authenticate via API tokens (user generates token in PublisherIQ settings)
- Server runs on your infrastructure, enforces same security (blocked tables, rate limits, credits)
- Users add the MCP server URL to their Claude Code / Cursor config
- The user's own LLM (whatever they're running locally) calls your tools

### Key changes
- New service: `services/mcp-server/` (standalone Node.js server)
- API token generation UI + `user_api_tokens` table
- Reuse existing tool implementations from `cube-tools.ts` and `query-executor.ts`
- Rate limiting per API token
- Usage tracking and optional credit deduction per tool call

### Model choice angle
**Maximum flexibility** — users use literally whatever model and client they want. Claude Code with Opus, Cursor with GPT-4o, their own custom scripts.

### Pros
- **Literally gives users the Claude Code experience** — they ARE using Claude Code, just connected to your data
- Zero LLM cost to you (users bring their own)
- MCP is an emerging standard with growing ecosystem support
- Power users (your primary audience for complex queries) already use these tools
- Your existing tool implementations are directly reusable
- Users get unlimited iteration, their own context, their own prompts

### Cons
- Only serves technical users comfortable with CLI tools (Claude Code, Cursor)
- No UI — users must set up MCP client configuration themselves
- Harder to monetize (can't charge per-token, only per-tool-call)
- You lose control over the user experience (prompt quality, guardrails)
- MCP ecosystem is still early — client support varies
- Separate infrastructure to maintain and monitor

### Effort: M (Medium)
### Quality vs Claude Code: 9.5/10
This IS Claude Code connected to your database. The only gap is users needing to set it up themselves.

---

## Option E: Analysis Notebook / Report Builder

### What it is
A notebook-style UI where users describe what they want in natural language, the LLM generates a multi-step analysis plan with SQL/Cube queries, and users can inspect, edit, re-run, and export each step. Think Jupyter notebook meets AI analyst.

### How it works
- New `/analyze` route with a notebook-style interface
- User types a question → LLM generates an analysis plan (3-10 steps)
- Each step shows: natural language description + generated query + results + visualization
- Users can edit any query before running, re-run individual steps, add steps
- Results from earlier steps feed into later steps (chained context)
- Export to PDF/CSV for reporting
- Saved analyses can be shared or re-run with different parameters

### Key changes
- New route: `apps/admin/src/app/(main)/analyze/`
- Analysis engine: orchestrates multi-step LLM + query execution
- Notebook UI components (step cards, query editor, result tables, charts)
- Analysis storage table (save/share/re-run)
- Chart/visualization library integration (recharts or similar — already in use for sparklines)

### Model choice angle
Can support BYO key (Option B) for the LLM that generates the plan and queries.

### Pros
- Best UX for non-technical users who want deep analysis
- Transparency: users see every query and can verify/edit
- Shareable/exportable reports (high business value)
- Natural place to upsell premium features
- Combines the depth of multi-step analysis with human oversight at each step

### Cons
- **Largest engineering effort** by far
- Complex UI to build well (notebook editors are notoriously tricky)
- Needs good visualization components
- Different UX paradigm from chat — users must learn a new interface
- Risk of building too much before validating demand

### Effort: XL (Extra Large)
### Quality vs Claude Code: 8/10
Very high quality for structured analysis, but less flexible for ad-hoc exploration than actual Claude Code.

---

## Recommended Phased Approach

### Phase 1: Quick wins (1-2 weeks)
**Do A + partial C together.**
- Add `run_sql` tool to existing chat
- Increase iteration cap from 5 to 15
- Add schema context to system prompt
- Raise row limit to 200 for SQL tool

This alone dramatically improves query capability. Users can now do complex SQL-backed analysis with multi-step reasoning.

### Phase 2: Model choice (2-3 weeks)
**Do B.**
- BYO API key support
- Model picker in chat UI
- Skip token credit charges for BYO keys

Power users immediately benefit — Opus + SQL tool + 15 iterations is a massive upgrade.

### Phase 3: MCP for power users (2-3 weeks, can parallel with Phase 2)
**Do D.**
- MCP server exposing all tools
- API token management
- Per-tool-call usage tracking

This serves your most technical users (who are likely the ones asking for "Claude Code-level" access) and costs you nothing in LLM spend.

### Phase 4: Evaluate demand for notebook (later)
**Validate E before building.**
- Monitor which Phase 1-3 features get used most
- Talk to users about their analysis workflows
- If there's demand for shareable/exportable reports, build the notebook UI

---

## Summary Matrix

| Option | Effort | Quality vs Claude Code | Model Choice | Best For |
|--------|--------|----------------------|--------------|----------|
| A: SQL Tool | S | 4/10 | No | Quick capability boost |
| B: BYO Key | M | 5/10 alone | Yes | Model flexibility |
| C: Agent Loop | L | 7/10 | Indirect | Deep multi-step analysis |
| D: MCP Server | M | 9.5/10 | Full | Technical power users |
| E: Notebook | XL | 8/10 | Optional | Non-technical analysts |
| **A+B+C combined** | **L** | **8-9/10** | **Yes** | **Best in-app experience** |
| **D standalone** | **M** | **9.5/10** | **Full** | **Cheapest path to max quality** |

**The fastest path to Claude Code-level quality is Option D (MCP server)** — it literally is Claude Code, just connected to your data. But it only serves technical users.

**For the broadest user impact, Phase 1 (A+C) is the highest ROI** — SQL tool + deeper agent loop, using your existing infrastructure, unlocks 80% of the value with 20% of the effort.
