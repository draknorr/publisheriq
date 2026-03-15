# Roblox Integration Plan v2

Canonical status: supersedes prior Roblox draft plan.
Date: February 26, 2026
Scope: Add Roblox to PublisherIQ with verified API contracts, isolated platform tables, and platform-aware shared-layer identity.

## 1. Summary

This plan integrates Roblox as a first-class platform without modifying existing Steam core tables. Roblox data remains table-isolated (`roblox_*`), while shared features (pins, alerts, chat links) become platform-aware before Roblox UI/chat launch.

Key revisions vs prior draft:

- Replace deprecated/invalid endpoints with verified contracts.
- Move shared-layer identity migration earlier (before chat/UI phase).
- Add endpoint-specific throttling and workflow concurrency controls.
- Add idempotency constraints and safer data types from day one.
- Defer uncertain endpoints (social links, discovery route) until contract is validated.

## 2. Non-Negotiable Design Decisions

1. No Roblox columns added to existing Steam tables (`apps`, `daily_metrics`, `sync_status`, etc.).
2. Roblox tables use native Roblox IDs (`universe_id`, `group_id`, etc.).
3. Shared game references use platform-aware identity:
   - `entity_platform` + `entity_platform_id`
4. Steam behavior must remain unchanged during migration.
5. Service-role ingestion remains server-side; no direct anonymous Roblox table access by default.

## 3. Verified API Contract (as of February 26, 2026)

Live probe baseline from implementation review:

| Purpose | Endpoint | Status | Notes |
|---|---|---|---|
| Experience details | `games.roblox.com/v1/games?universeIds=...` | 200 | Usable |
| Votes | `games.roblox.com/v1/games/votes?universeIds=...` | 200 | Usable |
| Game passes (old) | `games.roblox.com/v1/games/{id}/game-passes` | 404 | Deprecated/invalid |
| Game passes (new) | `apis.roblox.com/game-passes/v1/universes/{id}/game-passes` | 200 | Use this |
| Badges | `badges.roblox.com/v1/universes/{id}/badges` | 200 | Usable |
| Groups | `groups.roblox.com/v2/groups?groupIds=...` | 200 | Usable; strict per-second limit |
| Thumbnails/icons | `thumbnails.roblox.com/v1/games/icons?...` | 200 | Usable |
| Discovery list (planned path) | `games.roblox.com/v1/games/list...` | 404 | Not usable as planned |
| Social links (planned path) | `games.roblox.com/v1/games/{id}/social-links/list` | 401 | Requires auth cookie |

References:

- Game passes endpoint update: https://devforum.roblox.com/t/updated-endpoints-for-game-passes-api/3919373
- Roblox web endpoint deprecation thread: https://devforum.roblox.com/t/official-list-of-deprecated-web-endpoints/62889/103

## 4. Database Architecture

### 4.1 Roblox Core Tables (Phase A)

Create:

1. `roblox_experiences`
2. `roblox_daily_metrics`
3. `roblox_ccu_snapshots`
4. `roblox_sync_status`
5. `roblox_sync_jobs`

### 4.2 Roblox Detail Tables (Phase C)

Create:

1. `roblox_groups`
2. `roblox_game_passes`
3. `roblox_badges`
4. `roblox_thumbnails`
5. `roblox_trends` (computed)

Deferred until endpoint contract is validated:

1. `roblox_social_links`
2. Discovery-driven expansion table(s) dependent on validated discovery API

### 4.3 Required Constraints and Indexes

Must be included with table creation (not deferred):

1. `roblox_daily_metrics` unique: `(universe_id, metric_date)`
2. `roblox_ccu_snapshots` unique: `(universe_id, snapshot_time)` when write retries can duplicate
3. `roblox_game_passes` unique: `(pass_id)` primary key
4. `roblox_badges` unique: `(badge_id)` primary key
5. `roblox_thumbnails` unique: `(universe_id, image_type, url)`
6. Core read indexes:
   - `(universe_id, metric_date DESC)`
   - `(universe_id, snapshot_time DESC)`
   - `metric_date DESC`
   - `snapshot_time DESC`
   - sync/job health indexes aligned to Steam patterns

### 4.4 Data Type Rules

1. Use `BIGINT` for cumulative counters and large deltas (`visits`, `favorites`, vote counts where needed).
2. Use generated columns only where deterministic and index-safe.
3. Preserve timezone-aware timestamps (`TIMESTAMPTZ`) for all operational sync fields.

## 5. Shared-Layer Migration (Move Before Chat/UI)

Current system is Steam-centric for game identity. Before Roblox chat/UI, migrate shared tables and RPCs:

Targets:

1. `user_pins`
2. `alert_detection_state`
3. `user_alerts` dedup logic that includes game identity
4. `get_user_pins_with_metrics`
5. `get_pinned_entities_with_metrics`
6. API routes that currently assume `entity_id: number`

Migration shape:

1. Add columns:
   - `entity_platform TEXT`
   - `entity_platform_id TEXT`
2. Backfill Steam game rows:
   - `entity_platform='steam'`
   - `entity_platform_id=entity_id::text`
3. Keep publisher/developer behavior unchanged.
4. Update uniqueness and indexes to include platform identity for game records.
5. Decommission Steam-only assumptions once app code is switched.

## 6. Ingestion Strategy

### 6.1 Workers in Scope

Phase A:

1. `roblox-details-worker`
2. `roblox-votes-worker`
3. `roblox-ccu-worker` (snapshot writer + daily peak rollup)
4. `roblox-sync-job-logger` (embedded in workers via `roblox_sync_jobs`)

Phase C:

1. `roblox-badges-worker`
2. `roblox-passes-worker`
3. `roblox-groups-worker`
4. `roblox-trends-worker`
5. `roblox-embedding-worker`

Deferred:

1. `roblox-social-worker` (until server-safe endpoint confirmed)
2. `roblox-discovery-worker` (until discovery endpoint contract confirmed)

### 6.2 Rate Limiting and Backoff

Do not use one global budget model. Implement per-endpoint controls:

1. Endpoint token buckets keyed by host+path group.
2. Honor `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`.
3. On `429` or transient `5xx`: exponential backoff + jitter.
4. Circuit breaker fields in `roblox_sync_status`:
   - `consecutive_errors`
   - `last_error_message`
   - `last_error_at`
   - `is_syncable`

### 6.3 Workflow Concurrency Controls

Every Roblox workflow must declare concurrency group to prevent overlap:

1. `concurrency.group: roblox-details-sync`
2. `concurrency.cancel-in-progress: false` for scheduled jobs
3. One active run per worker category

## 7. Qdrant Integration

### 7.1 Collections

Add:

1. `publisheriq_roblox_games`

Keep existing Steam collections unchanged.

### 7.2 Payload and Filter Types

Do not reuse Steam `GamePayload` shape. Add Roblox-specific payload type with Roblox-relevant fields:

1. `universe_id`
2. `genre`
3. `creator_type`
4. `creator_id`
5. `creator_verified`
6. engagement tiers (visits/favorites/approval/ccu)
7. passes/badges token summaries

Add corresponding filter builder logic for Roblox collection fields.

## 8. Cube and Chat Integration

### 8.1 Cube Models

Add new Roblox cubes without changing Steam cubes:

1. `RobloxDiscovery`
2. `RobloxDailyMetrics`
3. `RobloxCreators` (or split groups/creators cubes if needed)

### 8.2 Tool and Prompt Updates

Update together in one deployment unit:

1. `query_analytics` cube enum to include Roblox cubes
2. Tool docs/system prompt to explain when to use Steam vs Roblox cubes
3. `search_games` extension or new `search_roblox_games` tool with explicit platform routing

### 8.3 Entity Link Format

Adopt platform-prefixed game links:

1. Steam: `[Name](steam:appid)`
2. Roblox: `[Name](roblox:universe_id)`

Update:

1. link formatter
2. markdown parser/link renderer
3. entity mapping extraction logic that currently assumes `appid`

## 9. Migration Order

### Phase A: Core Schema + Core Ingestion

1. Add migration for core Roblox tables + required indexes + unique constraints + RLS.
2. Build details/votes/ccu ingestion workers.
3. Add sync job logging and health visibility.

Gate:

- Core rows are landing.
- No duplicate daily/snapshot rows under retries.
- No sustained 429 loops.

### Phase B: Shared-Layer Platform Identity

1. Migrate pins/alerts schema and RPCs to platform-aware game identity.
2. Backfill Steam pin data.
3. Update API route types and consumers.

Gate:

- Existing Steam pins/alerts still function.
- Platform-aware game pin records can be inserted/read.

### Phase C: Detail Data

1. Add groups/passes/badges/thumbnails ingestion.
2. Defer social/discovery until contract validation.

Gate:

- Detail tables stable and deduplicated.

### Phase D: Trends + Embeddings

1. Add Roblox trends compute.
2. Add Roblox Qdrant collection and embedding sync.

Gate:

- Similarity output is non-homogeneous and relevant.

### Phase E: Cube + Chat + UI

1. Add Roblox cubes.
2. Update tool enum/system prompt.
3. Add platform link rendering in frontend.
4. Add Roblox filters/tabs on target pages.

Gate:

- Chat answers Roblox queries with correct linked entities.

## 10. RLS and Access Policy

1. Enable RLS on all Roblox tables.
2. Use service-role for ingestion and server analytics paths.
3. Only add direct `authenticated` read policies for tables explicitly required by client-side queries.
4. Operational tables (`roblox_sync_status`, `roblox_sync_jobs`) remain admin-restricted.

## 11. Test and Validation Matrix

1. Endpoint contract smoke tests:
   - fail if required endpoints return 401/404 unexpectedly.
2. Idempotency tests:
   - rerun same batch, verify no duplicate rows for constrained tables.
3. Rate-limit resilience:
   - simulate/observe 429 handling with recoverable completion.
4. Shared-layer migration tests:
   - Steam pins/alerts pre/post migration parity.
5. Chat/entity-link tests:
   - `steam:` and `roblox:` links parsed/rendered correctly.
6. Cube query tests:
   - Roblox cubes return expected dimensions/measures for seeded data.

## 12. Risk Register

1. API contract churn risk:
   - Mitigation: endpoint contract tests + feature flags.
2. Shared-layer migration blast radius:
   - Mitigation: staged dual-column migration and rollback scripts.
3. Rate-limit bottleneck (groups endpoint):
   - Mitigation: strict per-endpoint bucket and queueing.
4. Embedding quality risk:
   - Mitigation: iterative text construction and offline eval set.
5. Workflow overlap risk:
   - Mitigation: GitHub Actions concurrency groups.

## 13. Rollback Strategy

1. Schema rollback:
   - Drop new Roblox tables only (no Steam table mutation).
2. Shared-layer rollback:
   - Keep old Steam fields during transition until cutover verified.
3. Worker rollback:
   - Disable Roblox workflows independently.
4. Chat rollback:
   - Remove Roblox cubes from tool enum/prompt and disable Roblox UI filters.

## 14. Implementation Checklist

1. Add Phase A migration SQLs.
2. Add Roblox workers and scripts.
3. Add shared-layer migration SQL + RPC updates.
4. Add Qdrant Roblox payload/collection support.
5. Add Cube Roblox models.
6. Add chat tool/prompt/entity link updates.
7. Add UI platform handling.
8. Run `pnpm check-types` and `pnpm lint`.

