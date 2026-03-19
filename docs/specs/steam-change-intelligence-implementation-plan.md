# Steam Change Intelligence Implementation Plan

Last updated: 2026-03-18

## Goal And UX Principles

Build a production-grade Steam change-intelligence system that powers a natural `/chat` experience over Storefront, PICS, Steam News, media changes, and downstream price/review/CCU response.

Core product principles:

- `/chat` is the primary interface for this capability.
- Users should not need exact prompt wording to get the right answer.
- Users should not need exact entity spelling if the intended game, publisher, or developer is reasonably recoverable.
- Chat must prefer bounded typed tools over free-form SQL for change-intel workloads.
- On a database of this size, latency and bounded scans matter as much as feature completeness.
- Higher-inference answers must stay evidence-backed and say when confidence is only medium.

## Current State Snapshot

Implemented today:

- Storefront, PICS, News, media, and hero-asset change capture foundations are in repo code and migrations.
- `/changes` already has bounded read surfaces and typed server helpers.
- `/chat` now has initial change-intel tool contracts and a chat-specific change-intel service layer.
- The streaming `/api/chat/stream` runtime is now locked to the structured Cube plus change-intel tool registry instead of depending on the legacy SQL-mode toggle.
- The legacy JSON `/api/chat` route is now aligned to the same structured Cube plus change-intel tool surface as the streaming route.
- `/chat` entity resolution now prefers fuzzy trigram-backed RPCs instead of plain `ILIKE`.
- The raw change-intel bounds migration has been applied manually to the live database to hard-cap raw query windows for chat safety.
- `/admin/chat-smoke` now includes change-intelligence smoke queries and paraphrase variants.

Still incomplete:

- Bootstrap/backfill is not finished.
- PICS bootstrap/runbook coverage is still partial.
- Formal prompt evals and latency profiling for the new chat path are not complete.
- Ops docs for archive cohort rules and backlog/throttle playbooks still need tightening.
- The legacy non-streaming chat routes are not the canonical implementation path.

## Phase Tracker

| Phase | Status | Last Updated | Owner / Workstream | Next Action | Exit Criteria |
| --- | --- | --- | --- | --- | --- |
| Phase 0: Data Foundation Audit | partial | 2026-03-18 | Data / Ops | Finish bootstrap/backfill status accounting | Capture/runtime/read layer is fully mapped with no ambiguous ownership |
| Phase 1: SQL And Read-Layer Hardening For Chat | in_progress | 2026-03-18 | SQL / Perf | Optimize the remaining slow cross-app read paths | Raw change-intel reads are bounded, indexed, and profiled for chat workloads |
| Phase 2: Chat Data Service And Tool Contracts | in_progress | 2026-03-18 | Chat Tooling | Expand coverage and benchmark pattern heuristics | Typed tools cover change inspection, detail, comparison, and pattern questions |
| Phase 3: Unified `/chat` Orchestrator | in_progress | 2026-03-18 | Chat Runtime | Bring any stale non-streaming paths to parity or retire them | Streaming `/chat` is the clear single production path |
| Phase 4: Natural-Language Robustness And UX | in_progress | 2026-03-18 | Prompting / UX | Add paraphrase evals and ambiguity handling polish | Paraphrased prompts and fuzzy entity inputs resolve reliably |
| Phase 5: Eval, Billing, And Performance | partial | 2026-03-18 | Eval / Product Ops | Add prompt eval suite and latency SLO checks | Prompt families pass, costs are correct, and chat stays within latency targets |
| Phase 6: Ops, Backfill, And Completion | partial | 2026-03-18 | Ops / Platform | Finish runbooks and freshness coverage | Backfill is complete, freshness is visible, and operators have complete playbooks |

## Phase Details

### Phase 0: Data Foundation Audit

Status: `partial`

Shipped:

- Storefront, PICS, News, media, hero-asset, queue, and event schemas exist in `20260313130000_add_steam_change_intelligence.sql`.
- Change-feed product RPCs exist and were optimized in follow-up migrations.
- Worker/runtime docs exist in `docs/developer-guide/workers/steam-change-intelligence.md`.

Remaining:

- Finish backlog accounting for Storefront, News, and PICS bootstrap coverage.
- Add explicit status notes for which capture surfaces are fully backfilled versus forward-only.
- Keep this document synced with real implementation state instead of checkpoint-only state.

Exit criteria:

- Anyone resuming work can see which data surfaces are complete, partial, or still operationally incomplete without repo archaeology.

### Phase 1: SQL And Read-Layer Hardening For Chat

Status: `in_progress`

Why this phase exists:

- The database is very large. Chat cannot rely on unbounded time windows, broad text scans, or permissive generic query paths.
- Raw change-intel reads were originally designed as foundational interfaces, not final chat-safe interfaces.

Shipped in code:

- Chat entity resolution now uses the fuzzy RPCs `search_games_fuzzy`, `search_publishers_fuzzy`, and `search_developers_fuzzy` through the lookup helpers instead of plain `ILIKE`.
- Migration `20260318153000_harden_change_intel_chat_query_bounds.sql` is now applied to the live database and caps:
  - `get_app_change_feed` to a maximum effective lookback of `365 days`
  - `get_recent_app_changes` to a maximum effective lookback of `180 days`
  - both raw RPC limits to `1..100`
- The chat service layer already enforces tighter application-side bounds even before the migration is applied:
  - cross-app activity tools clamp to `1..180 days` and `1..25` results
  - per-app timeline tools clamp to `1..365 days` and `1..50` events
  - pattern detection clamps to `1..180 days` and `1..10` user-facing results

Remaining:

- Continue profiling `get_change_feed_activity`, `get_app_change_feed`, and `get_recent_app_changes` against representative chat workloads with `EXPLAIN`.
- Add a faster cross-app read path for the heavy `all-activity` case or narrow its usage, because it still misses the target envelope.
- Replace or substantially optimize `get_recent_app_changes`, which is still too slow for direct chat use.

Verified live database state on 2026-03-18:

- `apps`: `166,303`
- `latest_daily_metrics`: `166,293`
- `sync_status`: `166,293`
- `app_change_events`: `1,353,667`
- `steam_news_versions`: `1,300,757`
- `review_deltas`: `1,893,760`
- `app_steam_tags`: `2,491,834`
- `ccu_snapshots`: `8,155,808`
- `daily_metrics`: `9,008,757`

Verified live RPC state on 2026-03-18:

- `get_change_feed_activity` already caps `p_limit` to `100` in SQL.
- `get_app_change_feed` still allows `LIMIT ... <= 500` in the live database definition until the drafted migration is applied.
- `get_recent_app_changes` still allows `LIMIT ... <= 500` in the live database definition until the drafted migration is applied.
- Fuzzy entity search is backed by live trigram indexes on `apps`, `publishers`, and `developers`.
- `app_change_events` already has live indexes on `(appid, occurred_at)`, source plus time, and change type plus time.

Read-path benchmarks captured on 2026-03-18:

- Post-migration verification: `get_app_change_feed(1029780, now() - interval '720 days', now(), 200)` returned `100` rows in about `238 ms`, confirming the new SQL-side cap is enforced.
- Warm-cache activity path: `get_change_feed_activity(30, 'overview', 'all', ARRAY['game'], NULL, NULL, 'relevant', NULL, NULL, NULL, 10)` completed in about `949 ms`.
- Warm-cache heavy activity path: `get_change_feed_activity(30, 'all-activity', 'all', ARRAY['game'], NULL, NULL, 'relevant', NULL, NULL, NULL, 25)` completed in about `4.0 s`.
- Pre-migration cold-cache activity runs were materially slower, around `11.9 s` for `overview/10` and `17.3 s` for `all-activity/25`.
- `get_recent_app_changes(7, NULL, 5)` still hit the role-level `statement_timeout` even after raising the session timeout to `120s`.

Decision rules:

- Cross-app pattern tools default to `30` days and cap at `180`.
- Per-app timeline/comparison tools default to `90` days and cap at `365`.
- Cross-app chat tools should return at most `25` user-facing rows.
- Per-app timeline tools should return at most `50` user-facing events.
- Do not add full-body text search over `steam_news_versions.contents` in v1.
- If any common cross-app detector exceeds `P95 1500ms`, add a dedicated bounded SQL surface rather than pushing more logic into the LLM or app layer.

Exit criteria:

- Chat-safe raw reads are bounded in SQL, fuzzy entity resolution is the default, and representative workloads are benchmarked.

### Phase 2: Chat Data Service And Tool Contracts

Status: `in_progress`

Shipped in code:

- Added a chat-specific change-intel service layer in `apps/admin/src/lib/chat/change-intel-service.ts`.
- Added these typed tools:
  - `query_change_activity`
  - `get_game_change_timeline`
  - `get_change_activity_detail`
  - `compare_change_before_after`
  - `find_change_patterns`

Current behavior:

- Cross-game change discovery uses bounded activity reads.
- Single-game inspection uses fuzzy app resolution plus per-app timeline reads.
- Before/after questions can anchor on a known activity or infer the most relevant recent burst.
- Pattern questions route to deterministic app-layer heuristics instead of free-form model reasoning.

Remaining:

- Expand heuristic depth only where evals show real misses.
- Add a dedicated SQL surface for pattern candidates or a materially faster cross-app activity read path, because current cross-app benchmarks are outside the target envelope.
- Decide whether any additional low-level tool is needed for precise event-window or announcement-body retrieval.

Exit criteria:

- The typed tool layer covers direct change inspection, before/after comparison, and composite pattern discovery without relying on ad hoc SQL.

### Phase 3: Unified `/chat` Orchestrator

Status: `in_progress`

Shipped in code:

- The streaming `/api/chat/stream` path is wired to the new change-intel tools.
- The legacy JSON `/api/chat` route now uses the same structured change-intel plus Cube tool surface as the streaming route.
- Tool billing now includes the current discovery tools plus the new change-intel tools.

Locked decisions:

- `/chat` remains the only primary chat surface.
- Streaming chat is the production path.
- Change-intel chat answers should use typed tools, not generic SQL, as the default route.

Remaining:

- Either retire `cube-route.ts` or explicitly keep it as a non-production template.
- Consider extracting shared tool execution into a single module if route parity work becomes noisy.

Exit criteria:

- One canonical chat runtime exists in practice and docs, with no ambiguity about which route path is authoritative.

### Phase 4: Natural-Language Robustness And UX

Status: `in_progress`

Shipped in code:

- Added change-intel routing guidance to the Cube chat system prompt.
- Added change-intel example prompts and autocomplete templates.
- Added follow-up suggestions for change-intel outputs.
- Added generic tool-detail rendering so new tool results remain inspectable in the chat UI.
- Added ambiguity handling so fuzzy title resolution can ask for clarification instead of silently picking the wrong game.

Natural-language requirements:

- Prompts must route by intent family, not exact phrase.
- Fuzzy entity resolution should tolerate spacing differences, abbreviations, and common misspellings.
- Relative dates must be normalized into exact dates in the final answer.
- Multi-signal interpretations should explicitly say when evidence is suggestive rather than conclusive.

Remaining:

- Tune tool-selection guidance based on prompt eval misses.

Exit criteria:

- Example prompts and paraphrases behave similarly, and chat stays understandable even when the user is informal or imprecise.

### Phase 5: Eval, Billing, And Performance

Status: `partial`

Shipped in code:

- Credit costs now cover the current discovery tools and the new change-intel tools.
- `/admin/chat-smoke` now includes change-intelligence query groups and natural-language paraphrase coverage.

Required eval coverage:

- Every research-doc prompt example.
- `5-10` paraphrases per prompt family.
- typo and spacing variants for named entities.
- operator-style terse phrasing.
- conversational phrasing.

Required latency targets:

- fuzzy entity resolution: `P95 < 300ms`
- per-app change tools: `P95 < 800ms`
- cross-app activity and pattern tools: `P95 < 1500ms`

Remaining:

- Add prompt eval artifacts for the change-intel tool path.
- Track actual latency continuously instead of relying on one-off profiling snapshots.

Exit criteria:

- Prompt-family evals pass, tool billing is correct, and latency targets are met or explicitly documented as exceptions.

### Phase 6: Ops, Backfill, And Completion

Status: `partial`

Known incomplete items:

- Storefront/bootstrap backlog is still draining.
- PICS bootstrap is not documented as a first-class manual workflow the same way Storefront and News are.
- Archive cohort policy needs a more explicit operator doc.
- Backlog and throttle incident playbooks need fuller runbook detail.
- Current status surfaces do not yet expose the full freshness picture for PICS or completion progress.

Exit criteria:

- Backfill status is explicit, change freshness is visible, and the operator runbook is complete enough for handoff.

## SQL And Performance Workstream

Large-database assumptions:

- Verified live approximate row counts on 2026-03-18:
- `apps`: `166,303`
- `latest_daily_metrics`: `166,293`
- `sync_status`: `166,293`
- `app_change_events`: `1,353,667`
- `steam_news_versions`: `1,300,757`
- `review_deltas`: `1,893,760`
- `app_steam_tags`: `2,491,834`
- `ccu_snapshots`: `8,155,808`
- `daily_metrics`: `9,008,757`

Rules for change-intel chat:

- Never depend on unbounded raw change RPCs.
- Never require full-catalog text-body scans to answer common prompts.
- Prefer pre-bounded product RPCs or chat service composition over model-generated joins.
- Use existing trigram indexes and fuzzy RPCs for entity resolution.

Current SQL work items:

- Drafted: `20260318153000_harden_change_intel_chat_query_bounds.sql`
- To benchmark after approval:
  - `get_change_feed_activity`
  - `get_app_change_feed`
  - `get_recent_app_changes`
- To add only if profiling justifies it:
  - dedicated SQL surface for cross-app pattern candidate retrieval

## Prompt Coverage And Natural-Language Acceptance

Supported prompt families:

- direct app change inspection
- before/after update analysis
- recent cross-app change discovery
- release-date messaging changes
- tag/genre/category/platform drift
- announcement plus pricing plus asset-refresh questions
- relaunch-pattern and marketing-push questions
- weak versus strong downstream response questions
- under-marketed, signable, and rescue-candidate discovery

Acceptance standard:

- The system must work for natural variants of these prompts, not just the exact examples in the research doc.
- The answer path should be driven by:
  - fuzzy entity resolution
  - typed change-intel tools
  - existing analytics/search tools when supporting evidence is needed
- The answer should fail gracefully when evidence is weak or data freshness is incomplete.

## Agent Workstreams

Workstream 1: SQL / Perf

- own bounded raw RPCs
- own latency profiling
- own any dedicated SQL surfaces added later

Workstream 2: Chat Tooling

- own change-intel service layer
- own typed tool contracts
- own route wiring

Workstream 3: Prompting / UX

- own system-prompt routing
- own example prompts, autocomplete, and follow-ups
- own tool-detail rendering polish

Workstream 4: Eval / Ops

- own prompt evals and smoke coverage
- own runbooks, freshness/status, and handoff docs

## Iteration Log

### 2026-03-18

- Replaced the checkpoint-only spec with a phased roadmap and status tracker.
- Documented `/chat` as the primary product surface for change intelligence.
- Locked the streaming `/chat` runtime to the structured change-intel tool surface.
- Aligned the legacy JSON `/api/chat` route with the same structured tool surface.
- Recorded the need for bounded SQL on raw change-intel reads for large-database safety.
- Recorded the verified live database scale and the current live RPC bounds that still need migration hardening.
- Applied the raw change-intel bounds migration manually to the live database.
- Recorded live benchmark results showing per-app reads are healthy, `overview` is within target on a warm cache, `all-activity` is improved but still slow, and `get_recent_app_changes` still misses the target envelope.
- Recorded fuzzy entity resolution as a hard requirement for natural-language chat.
- Marked the chat tool/service implementation as in progress.

## Appendix: Checkpoint Mapping

Legacy checkpoints map into the phased plan as follows:

- Checkpoints 1-8 map primarily to `Phase 0`.
- Checkpoint 9 maps to `Phase 1`.
- Chat implementation work previously described as "follow-on" now maps to `Phases 2-5`.
- Checkpoint 10 maps to `Phase 6`.
- Checkpoint 11 maps to `Phase 6`, with some UX/status overlap in `Phase 4` and `Phase 5`.

Legacy status snapshot retained for reference:

- Checkpoints `1-8`: implemented
- Checkpoint `9`: partial
- Checkpoint `10`: in progress
- Checkpoint `11`: partial
