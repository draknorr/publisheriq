# Roblox Integration Plan v2 -- Comprehensive Audit

**Audited document:** `docs/specs/roblox-integration-plan-v2.md`
**Audit date:** February 26, 2026
**Method:** Cross-referenced spec against live codebase (schema, workers, shared-layer, chat, Qdrant), Roblox API documentation, and DevForum reports.

---

## Executive Summary

The plan is structurally sound and correctly identifies the highest-risk areas. Table isolation, separate Qdrant collections, deferred broken endpoints, and phased rollout are all the right calls. However, this audit identifies **2 critical issues**, **5 high-risk gaps**, **7 medium-risk items**, and **4 open architecture questions** that should be resolved before implementation begins.

| Severity | Count | Summary |
|----------|-------|---------|
| Critical | 2 | Auth risk on core endpoint; shared-layer migration data integrity |
| High | 5 | API batch limits; game passes instability; missing mat views; alert state enum; missing triggers |
| Medium | 7 | Concurrency groups; TEXT vs ENUM; PostgREST limits; type gen; dedup keys; refresh views; cookie changes |
| Correct | 8 | Table isolation; separate Qdrant; deferred endpoints; BIGINT; idempotency; phases; RLS; circuit breaker |
| Open Questions | 4 | PK strategy; seeding; creator model; entity_type approach |

---

## 1. CRITICAL Issues

### 1.1 Authentication Risk on `games.roblox.com/v1/games` -- PHASE A BLOCKER

**Spec reference:** Section 3, line 34 ("200 / Usable")
**Affects:** Phase A core ingestion -- the entire pipeline foundation

**Problem:** The spec marks `games.roblox.com/v1/games?universeIds=...` as working (200). However:

- A February 2026 DevForum report states this endpoint now requires authentication ([source](https://devforum.roblox.com/t/games-api-endpoint-returning-no-data-in-request-but-shows-data-in-browser/4434338)).
- The official Roblox docs list auth as "Optional" for this endpoint.
- The `.ROBLOSECURITY` cookie format is changing on/after **May 1, 2026** ([source](https://devforum.roblox.com/t/upcoming-roblosecurity-cookie-format-changes/4328913)).

If auth IS required and the workers run unauthenticated, the `roblox-details-worker` silently gets no data and every downstream phase has nothing to operate on.

**Recommendation:**
1. Before writing Phase A code, build a probe script that calls this endpoint from a server IP (not browser) without auth headers. Run at multiple times over 48 hours to confirm.
2. If auth is required, add a **Phase 0: API Authentication Setup**:
   - Obtain Roblox Open Cloud API key (preferred over cookie).
   - Store in GitHub Actions secrets (matching existing `SUPABASE_SERVICE_KEY` pattern).
   - Build swappable auth middleware.
3. Add Phase A gate: "Details endpoint returns 200 from CI runner."
4. If cookie auth is used as a stopgap, set a hard deadline to migrate to API keys before May 1, 2026.

---

### 1.2 Shared-Layer Migration: `entity_id INTEGER` to `entity_platform_id TEXT`

**Spec reference:** Section 5, lines 113-121
**Affects:** Phase B -- all existing Steam pin/alert functionality

**Problem:** Current schema uses `entity_id INTEGER` with these constraints:

```
-- user_pins (from 20260112000001_add_personalization.sql)
entity_id INTEGER NOT NULL
UNIQUE(user_id, entity_type, entity_id)

-- alert_detection_state
UNIQUE(entity_type, entity_id)

-- user_alerts dedup_key format
{user_id}:{entity_type}:{entity_id}:{alert_type}:{date}
```

The spec says to add `entity_platform TEXT` + `entity_platform_id TEXT` and backfill, then "decommission Steam-only assumptions." But the spec does NOT specify:

- Whether the old `entity_id` column is dropped, left nullable, or kept alongside.
- How the UNIQUE constraint transitions (can't have two competing unique constraints).
- What happens to `get_pinned_entities_with_metrics()` which joins on `p.entity_id = a.appid`.
- What happens to `detect_price_change_alert()` trigger which matches `p.entity_id = NEW.appid`.

**Recommendation -- 6-step dual-column transition:**

| Step | Action | Breaking? |
|------|--------|-----------|
| B-1 | Add `entity_platform TEXT`, `entity_platform_id TEXT` columns (nullable) | No |
| B-2 | Backfill: `SET entity_platform='steam', entity_platform_id=entity_id::text` | No |
| B-3 | Add new unique index CONCURRENTLY on `(user_id, entity_platform, entity_platform_id)` | No |
| B-4 | Update all RPC functions + API routes to use new columns | No (if backward compatible) |
| B-5 | Drop old unique constraint, make `entity_id` nullable | Soft break (rollback point) |
| B-6 | After verification period, drop `entity_id` | Hard break |

Each step must be independently deployable and rollback-safe. The API at `apps/admin/src/app/api/pins/route.ts` currently accepts `entityId: number` -- during transition it must accept both `entityId` (legacy) and `platform` + `entityPlatformId` (new).

---

## 2. HIGH-Risk Items

### 2.1 API Batch Limit: Max 50 IDs per Request

**Spec reference:** Section 3, line 34
**Affects:** Phase A `roblox-details-worker`

The `games.roblox.com/v1/games?universeIds=...` endpoint accepts **maximum 50 universe IDs** per request ([Roblox docs](https://create.roblox.com/docs/cloud/reference/domains/games)). The spec does not mention this limit. Workers must chunk requests.

**Recommendation:** Add `ROBLOX_DETAILS_BATCH_SIZE = 50` to `packages/shared/src/constants.ts`. Chunk requests in the worker (same pattern as existing CCU batch logic).

---

### 2.2 Game Passes Endpoint Instability

**Spec reference:** Section 3, line 37
**Affects:** Phase C `roblox-passes-worker`

`apis.roblox.com/game-passes/v1/universes/{id}/game-passes` replaced the deprecated endpoint (Aug 2025) but has had documented outages ([DevForum report](https://devforum.roblox.com/t/gamepass-api-endpoint-stopped-returning-results/4050268)). The spec lists it as "200 / Use this" without qualification.

**Recommendation:**
1. Build `roblox-passes-worker` with a circuit breaker that degrades gracefully (skip passes, continue with badges/groups).
2. Add to Risk Register (Section 12): "Game passes endpoint has documented instability history."
3. Make game pass ingestion an optional enrichment, not a Phase C gate.

---

### 2.3 No Materialized Views for Roblox

**Spec reference:** Absent (not mentioned anywhere)
**Affects:** Phase D/E performance

Steam queries rely heavily on materialized views (`latest_daily_metrics`, `publisher_metrics`, `developer_metrics`, etc. -- 20+ total). The spec creates `roblox_daily_metrics` and `roblox_ccu_snapshots` but proposes no materialized views. Without at least `roblox_latest_daily_metrics`, every discovery/pin query scans the full metrics table.

**Recommendation:**
- Phase A: Create `roblox_latest_daily_metrics` (DISTINCT ON universe_id) with UNIQUE index on `universe_id`.
- Phase C: Create `roblox_group_metrics` (analogous to `publisher_metrics`).
- Add both to the `MATERIALIZED_VIEWS` array in `packages/ingestion/src/workers/refresh-views-worker.ts`.

---

### 2.4 `alert_detection_state` Enum Migration Gap

**Spec reference:** Section 5, lines 106-107 (mentions alert_detection_state but no detail)
**Affects:** Phase B alert detection

`alert_detection_state` has `UNIQUE(entity_type, entity_id)` where `entity_type` is the PostgreSQL ENUM `('game', 'publisher', 'developer')`. If Roblox games use `entity_type = 'game'`, a Roblox experience with `universe_id = 12345` collides with a Steam game with `appid = 12345`.

**Two options:**
- **Option A (simpler):** `ALTER TYPE entity_type ADD VALUE 'roblox_game';` -- non-reversible but safe for a permanent platform.
- **Option B (spec's approach):** Replace ENUM with `entity_platform TEXT` + `entity_platform_id TEXT`. More flexible but requires constraint migration.

The spec should explicitly choose one and detail the migration steps.

---

### 2.5 Missing Alert Triggers for Roblox Tables

**Spec reference:** Absent
**Affects:** Phase C/E (alerts for Roblox pinned entities)

Current triggers:
- `detect_price_change_alert()` fires on `apps` table UPDATE
- `detect_publisher_new_release_alert()` fires on `app_publishers` INSERT
- `detect_developer_new_release_alert()` fires on `app_developers` INSERT

No equivalent triggers are proposed for Roblox tables. Users who pin Roblox experiences/groups will never receive these alert types.

**Recommendation:** Add to Phase C:
1. `detect_roblox_group_new_release_alert()` trigger on the Roblox experience-group association.
2. Document whether game pass price changes should trigger alerts (Roblox experiences are mostly free-to-play).

---

## 3. MEDIUM-Risk Items

### 3.1 GitHub Actions Concurrency Groups -- Inconsistency

**Spec reference:** Section 6.3, lines 160-166

The spec requires concurrency groups for all Roblox workflows. However, **zero existing Steam workflows** use concurrency groups (confirmed via codebase search). This creates an operational inconsistency.

**Recommendation:** Either add concurrency groups to Roblox workflows only (accept asymmetry, document it) or add them to all workflows in a preparatory PR.

---

### 3.2 `entity_platform` as TEXT -- Correct but Needs CHECK Constraint

The spec proposes `entity_platform TEXT` rather than extending the PostgreSQL ENUM. This is the safer approach (ENUM values can't be removed). But without a CHECK constraint, any string is accepted.

**Recommendation:**
```sql
CHECK (entity_platform IN ('steam', 'roblox'))
```

---

### 3.3 PostgREST 1000-Row Default Limit

Supabase returns max 1000 rows by default. The spec doesn't mention this. New Roblox workers that query `roblox_sync_status` or `roblox_daily_metrics` without explicit `.range()` pagination will silently receive truncated results.

**Recommendation:** Add to implementation guidelines: "All Roblox workers must use RPC functions or explicit `.range()` pagination."

---

### 3.4 Type Generation After Migrations

The spec's checklist (Section 14) mentions `pnpm check-types` but not `pnpm --filter database generate`. Without regenerating types after adding Roblox tables, TypeScript has no Roblox table types.

**Recommendation:** Add after each migration phase: "Run `pnpm --filter database generate` then `pnpm check-types`."

---

### 3.5 Alert Dedup Key Must Include Platform

Current format: `{user_id}:{entity_type}:{entity_id}:{alert_type}:{date}`

A Steam game with `appid = 12345` and a Roblox experience with `universe_id = 12345` would produce identical dedup keys. Cross-platform collision.

**Recommendation:** New format: `{user_id}:{platform}:{entity_type}:{entity_id}:{alert_type}:{date}`. Update in:
- `alert-detection-worker.ts` generateDedupKey()
- `detect_price_change_alert()` trigger
- `detect_*_new_release_alert()` triggers
- Backfill existing keys with `steam:` prefix during Phase B

---

### 3.6 `refresh-views-worker.ts` Needs Roblox Views

The `MATERIALIZED_VIEWS` array in `refresh-views-worker.ts` is hardcoded. New Roblox views won't be refreshed unless explicitly added.

**Recommendation:** Add Roblox views to the array. Consider making it configurable rather than hardcoded.

---

### 3.7 `.ROBLOSECURITY` Cookie Format Change (May 2026)

Roblox will change the cookie format on/after May 1, 2026. If any endpoint requires cookie auth, it will break within ~2 months.

**Recommendation:** If cookie auth is used, treat as stopgap with hard deadline to migrate to Open Cloud API keys by April 15, 2026.

---

## 4. What the Plan Gets RIGHT (Preserve These)

| Decision | Why It's Correct |
|----------|-----------------|
| **Table isolation** (`roblox_*` tables, no Steam table mutation) | Protects 200K `apps` + 15M `daily_metrics` rows from schema-change downtime |
| **Separate Qdrant collection** (`publisheriq_roblox_games`) | Avoids payload type conflicts with Steam's `GamePayload` |
| **Deferred social links + discovery endpoints** | social-links requires auth cookie; discovery requires undocumented params |
| **BIGINT for counters** | Top Roblox experiences have 40B+ visits, exceeding INT range |
| **Idempotency constraints** `(universe_id, metric_date)` | Prevents duplicate rows during retries, matches existing pattern |
| **Phased approach with gates** | Each phase independently validatable before proceeding |
| **RLS on all Roblox tables** | Matches existing security pattern |
| **Circuit breaker fields** in sync_status | Matches existing error tracking pattern |

---

## 5. Open Architecture Questions

### 5.1 Primary Key for `roblox_experiences`

**Should it use `universe_id BIGINT` as PK or a surrogate key?**

Recommendation: Use `universe_id BIGINT` as PK. Roblox universe IDs are globally unique, stable, and used in all API calls. Matches the existing `apps.appid INTEGER` natural key pattern. Surrogate keys add indirection without benefit here.

### 5.2 Initial Seeding Strategy

**Without a working discovery endpoint, how are Roblox experiences loaded initially?**

The spec proposes a `roblox-discovery-worker` but defers it because the endpoint doesn't work. Phase A needs data to operate on.

**Recommended approach: Multi-layer seeding for durability**

This mirrors how Steam data enters the system (SteamSpy bulk + PICS real-time + store API individual):

| Layer | Purpose | Phase | Durability |
|-------|---------|-------|------------|
| **1. Curated seed** | Bootstrap top 5,000+ experiences by known popularity. Universe IDs from public game pages or community lists. | A | One-time, reliable |
| **2. Group crawl** | Automated discovery via `groups.roblox.com/v2/groups`. Seed with known studio group IDs, fetch their published experiences. Groups publish new experiences over time, so this grows organically. | A/C | Ongoing, self-expanding |
| **3. Admin curation tool** | UI for admins to add/import Roblox experiences by universe ID or URL. Matches the existing admin workflow for managing tracked entities. | E | Permanent, user-driven |
| **4. Discovery endpoint** (deferred) | If/when Roblox exposes a usable discovery API, build the `roblox-discovery-worker`. | Future | Automated at scale |

This layered approach means:
- Phase A has immediate data to work with (layer 1).
- The catalog grows automatically as groups publish (layer 2).
- Users can request specific experiences (layer 3).
- If a data source ends, the others continue working.

The spec should add a "Seeding Strategy" subsection to Phase A covering layers 1-2, with layer 3 in Phase E.

### 5.3 Roblox Creator Model (User vs Group)

**Roblox creators can be Users or Groups. Steam has publisher/developer. How to handle?**

The spec proposes `roblox_groups` (Section 4.2) but doesn't address individual User creators. The games API response includes `creatorType` ('User' or 'Group') and `creatorTargetId`.

Recommendation: Add `creator_type TEXT CHECK (creator_type IN ('User', 'Group'))` and `creator_id BIGINT` to `roblox_experiences`. For Phase A, only resolve Group creators (groups API works). Defer User creator resolution.

### 5.4 `entity_type` Approach

**Extend the PostgreSQL ENUM with 'roblox_game', or add a separate `entity_platform` TEXT column?**

This affects every table that currently uses the `entity_type` ENUM: `user_pins`, `alert_detection_state`, `user_pin_alert_settings`.

- ENUM extension is simpler but non-reversible.
- TEXT column is more flexible and matches the spec's proposal.

Either way, the spec must explicitly detail the migration steps (see Critical Issue 1.2).

---

## 6. Recommended Phase Adjustments

### Phase 0 (NEW): API Authentication Validation
- Build probe script for all Phase A endpoints
- Confirm auth requirements from server IP
- Set up credentials if needed
- **Gate:** All Phase A endpoints return 200 from CI runner

### Phase A Additions
- Add seeding strategy (how initial universe IDs are loaded)
- Create `roblox_latest_daily_metrics` materialized view
- Add 50-ID batch chunking to details worker
- Run type generation after migration

### Phase B Additions
- Follow 6-step dual-column transition (see Critical Issue 1.2)
- Update dedup key format to include platform
- Backfill existing dedup keys with `steam:` prefix

### Phase C Additions
- Circuit breaker for game passes endpoint
- Create `roblox_group_metrics` materialized view
- Create new-release triggers for Roblox groups
- Add `creator_type` handling

### Phase D Additions
- Update `refresh-views-worker.ts` with Roblox views

---

## 7. Amended Implementation Checklist

Add these items to the spec's Section 14:

1. [ ] Run authentication probe for all Roblox endpoints before Phase A code
2. [ ] Add `ROBLOX_*` rate limit and batch size constants to `packages/shared/src/constants.ts`
3. [ ] Add 50-ID batch chunking to details worker
4. [ ] Create `roblox_latest_daily_metrics` materialized view with UNIQUE index
5. [ ] Add Roblox views to `refresh-views-worker.ts` MATERIALIZED_VIEWS array
6. [ ] Run `pnpm --filter database generate` after each migration phase
7. [ ] Update dedup_key format to include platform prefix
8. [ ] Create Roblox alert triggers (group new release at minimum)
9. [ ] Add seeding mechanism for initial Roblox universe IDs
10. [ ] Add `creator_type` + `creator_id` fields to `roblox_experiences`
11. [ ] Test shared-layer migration with rollback before production deploy
12. [ ] Set calendar reminder for `.ROBLOSECURITY` cookie change (April 15, 2026)
13. [ ] Add CHECK constraint on `entity_platform` column
14. [ ] Handle PostgREST 1000-row limit in all Roblox workers

---

## Sources

- [Roblox Cloud API Rate Limits](https://create.roblox.com/docs/cloud/reference/rate-limits)
- [Roblox games.roblox.com API Docs](https://create.roblox.com/docs/cloud/reference/domains/games)
- [Game Pass Endpoint Migration (DevForum)](https://devforum.roblox.com/t/gamepass-api-endpoint-stopped-returning-results/4050268)
- [Deprecated Web Endpoints (DevForum)](https://devforum.roblox.com/t/official-list-of-deprecated-web-endpoints/62889/101)
- [Games API Auth Issue (DevForum)](https://devforum.roblox.com/t/games-api-endpoint-returning-no-data-in-request-but-shows-data-in-browser/4434338)
- [.ROBLOSECURITY Cookie Changes (DevForum)](https://devforum.roblox.com/t/upcoming-roblosecurity-cookie-format-changes/4328913)
- [games/list Endpoint Discussion (DevForum)](https://devforum.roblox.com/t/how-to-actually-use-the-gamesrobloxapiv1gameslist-endpoint/2839124)
- [Open Cloud Game Passes API (DevForum)](https://devforum.roblox.com/t/new-open-cloud-apis-for-configuring-developer-products-and-game-passes/4114297)
