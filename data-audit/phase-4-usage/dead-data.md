# Phase 4.1: Dead Data Detection Report

Generated: 2026-01-09

This report cross-references the database schema with the codebase to identify unused, dead, or abandoned data.

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Tables never referenced in code | 0 | All tables are used |
| Columns never written | 7 | Cleanup recommended |
| Columns written but never read | 2 | Code exists but unused |
| Abandoned features | 3 | Partially implemented |
| Deprecated patterns | 2 | Legacy code present |
| Unused Cube.js models | 3 | Referenced but may be unused in practice |

---

## 1. Tables Never Referenced in Code

**Finding: All tables are referenced somewhere in the codebase.**

However, several tables have **no data** or **minimal usage**:

### Tables with Zero Rows (from Phase 1 analysis)
| Table | Purpose | Code References | Recommendation |
|-------|---------|-----------------|----------------|
| `credit_transactions` | User credit audit log | Migration + types only | Keep - user system not yet active |
| `credit_reservations` | Chat credit reservations | Migration + types only | Keep - user system not yet active |
| `rate_limit_state` | Per-user rate limiting | Migration + types only | Keep - user system not yet active |

### Tables with Minimal Data
| Table | Row Count | Purpose | Recommendation |
|-------|-----------|---------|----------------|
| `app_trends` | 9 rows | Computed 30/90-day trends | Investigate why only 9 rows - trends-worker may not be running |
| `dashboard_stats_cache` | Referenced in 1 file | Cache for dashboard stats | Keep - actively used |

### Assessment

The user system tables (`credit_transactions`, `credit_reservations`, `rate_limit_state`, `user_profiles`, `waitlist`) are part of a **planned but not fully active feature**. The infrastructure exists but the credit system is not processing real transactions.

---

## 2. Columns Written But Never Read

These columns have write code but no read code (data populated but never displayed/used):

### `apps` table
| Column | Write Location | Never Read | Recommendation |
|--------|----------------|------------|----------------|
| `page_creation_date` | `scraper-worker.ts:48` | Used in `AppDetailSections.tsx:468` | **FALSE POSITIVE** - Actually read |
| `page_creation_date_raw` | `scraper-worker.ts:49` | Not found in any read query | Remove column |

### `sync_status` table
| Column | Write Location | Never Read | Recommendation |
|--------|----------------|------------|----------------|
| `last_steamspy_individual_fetch` | `steamspy-worker.ts:172,196` | Only used in migration SQL for filtering | Keep - used for sync scheduling |

---

## 3. Columns Never Written OR Read (Schema Only)

These columns exist in the schema but have no write or read code - they are truly dead:

### `apps` table
| Column | Added In | Never Written | Never Read | Recommendation |
|--------|----------|---------------|------------|----------------|
| `page_creation_date` | Initial schema | Write code exists (scraper) | UI reads it | **Keep** - fully implemented |
| `page_creation_date_raw` | Initial schema | Write code exists | **Never read** | Remove column |

### `publishers` and `developers` tables
| Column | Never Populated | UI Tries to Display | Recommendation |
|--------|-----------------|---------------------|----------------|
| `steam_vanity_url` | Yes (100% NULL) | Yes - shows "Steam Page" link | Implement data source or remove |
| `first_game_release_date` | No - IS populated | Yes | **FALSE POSITIVE** - Working |
| `first_page_creation_date` | Yes (100% NULL) | Yes - shows "Page Created" | Implement data source or remove |

### `daily_metrics` table
| Column | From Phase 3 NULL Analysis | Recommendation |
|--------|---------------------------|----------------|
| `recent_total_reviews` | 100% NULL | Remove - never populated |
| `recent_positive` | 100% NULL | Remove - never populated |
| `recent_negative` | 100% NULL | Remove - never populated |
| `recent_score_desc` | 100% NULL | Remove - never populated |

These `recent_*` columns appear to be from a planned "recent reviews" feature that was never implemented.

---

## 4. Abandoned/Incomplete Features

### 4.1 Recent Reviews Feature
**Status:** Schema added, never implemented

**Evidence:**
- Columns `recent_total_reviews`, `recent_positive`, `recent_negative`, `recent_score_desc` in `daily_metrics`
- Referenced in `system-prompt.ts` (legacy SQL mode) as available data
- Never populated by any worker
- No API route uses these columns

**Recommendation:** Remove columns or implement data ingestion

### 4.2 Page Creation Date Scraper
**Status:** Implemented but not actively syncing (based on NULL analysis)

**Evidence:**
- `scraper-worker.ts` exists and writes to `page_creation_date`
- GitHub workflow `page-creation-scrape.yml` exists (runs every 30 min)
- `apps.page_creation_date` is 100% NULL
- UI in `AppDetailSections.tsx:468` tries to display it

**Possible Issues:**
1. Scraper may be failing silently
2. Rate limiting may prevent data collection
3. `get_apps_for_sync` RPC may not return apps for 'scraper' source

**Recommendation:** Investigate why scraper isn't populating data

### 4.3 Steam Vanity URLs
**Status:** Schema exists, no data source

**Evidence:**
- `steam_vanity_url` column in publishers/developers (100% NULL)
- UI tries to create links: `https://store.steampowered.com/publisher/${publisher.steam_vanity_url}`
- No worker populates this data
- PICS service doesn't extract vanity URLs

**Recommendation:** Either implement extraction from Steam API or remove column and UI

---

## 5. Deprecated Patterns Found

### 5.1 Legacy SQL Chat Mode
**Status:** Code exists, environment-variable controlled

**Files:**
- `apps/admin/src/app/api/chat/route.ts` - Line 20: `const USE_CUBE = process.env.USE_CUBE_CHAT === 'true';`
- `apps/admin/src/lib/llm/system-prompt.ts` - Full legacy SQL system prompt
- `apps/admin/src/lib/llm/tools.ts` - Legacy `query_database` tool

**Current Behavior:**
- When `USE_CUBE_CHAT=false`, uses raw SQL queries via `query_database` tool
- When `USE_CUBE_CHAT=true`, uses Cube.js semantic layer via `query_analytics` tool

**Comments Found:**
```typescript
// Set to true to use Cube.dev semantic layer, false for legacy SQL
// Legacy SQL mode (line 83)
```

**Recommendation:** If Cube.js mode is stable, remove legacy SQL mode entirely

### 5.2 Deprecated Steam API Comment
**File:** `packages/ingestion/src/apis/steam-web.ts:32`
```typescript
// This is the recommended endpoint as ISteamApps/GetAppList is deprecated.
```

**Status:** Informational - code is using the correct (non-deprecated) endpoint

---

## 6. Cube.js Models Analysis

### Cubes Defined vs Referenced in LLM System Prompt

| Cube | Defined In | In System Prompt | In cube-tools.ts | Used by UI |
|------|-----------|------------------|------------------|------------|
| `Discovery` | `Discovery.js` | Yes | Yes | No direct |
| `PublisherMetrics` | `Publishers.js` | Yes | Yes | No direct |
| `DeveloperMetrics` | `Developers.js` | Yes | Yes | No direct |
| `DailyMetrics` | `DailyMetrics.js` | Yes | Yes | No direct |
| `LatestMetrics` | `DailyMetrics.js` | Yes | Yes | insights-queries.ts |
| `ReviewVelocity` | `ReviewVelocity.js` | Yes | Yes | No direct |
| `ReviewDeltas` | `ReviewDeltas.js` | Yes | Yes | No direct |
| `MonthlyGameMetrics` | `MonthlyMetrics.js` | Yes | Yes | No direct |
| `MonthlyPublisherMetrics` | `MonthlyMetrics.js` | Yes | Yes | No direct |
| `Apps` | `Apps.js` | No | No | No |
| `AppTrends` | `Apps.js` | No | No | insights-queries.ts (SQL) |
| `AppSteamDeck` | `Apps.js` | No | No | No |
| `AppPublishers` | `Apps.js` | No | No | No |
| `AppDevelopers` | `Apps.js` | No | No | No |
| `SyncJobs` | `SyncHealth.js` | No | No | No |
| `SyncStatus` | `SyncHealth.js` | No | No | No |
| `PicsSyncState` | `SyncHealth.js` | No | No | No |

### Unused Cube Models
These cubes exist but are NOT referenced in the LLM tools or admin dashboard:

1. **`Apps`** cube - Superseded by `Discovery` which joins more data
2. **`SyncJobs`**, **`SyncStatus`**, **`PicsSyncState`** - Operational monitoring, not user-facing
3. **`AppTrends`**, **`AppSteamDeck`**, **`AppPublishers`**, **`AppDevelopers`** - Junction cubes, used internally

**Recommendation:** Keep these cubes - they serve internal purposes. The `Apps` cube could be removed if `Discovery` covers all use cases.

---

## 7. TODO/FIXME Comments Found

Only 1 TODO comment found in the codebase:

**File:** `apps/admin/src/lib/qdrant/search-service.ts:298`
```typescript
// TODO: Investigate why entity filter causes "Bad Request" from Qdrant
```

**Status:** Open issue - entity filtering in Qdrant may be broken

---

## 8. Cleanup Recommendations

### High Priority (Remove Dead Data)
1. **Remove `recent_*` columns** from `daily_metrics` table
   - `recent_total_reviews`, `recent_positive`, `recent_negative`, `recent_score_desc`
   - 100% NULL, never populated, no worker writes to them

2. **Remove `page_creation_date_raw`** from `apps` table
   - Written but never read
   - If needed, can be re-added later

### Medium Priority (Investigate/Fix)
3. **Fix page creation scraper** or remove feature
   - `apps.page_creation_date` is 100% NULL despite scraper existing
   - Either fix the scraper or remove the column and UI

4. **Implement or remove `steam_vanity_url`**
   - Column exists in publishers/developers
   - UI tries to display it but it's always NULL

5. **Investigate `app_trends`** table
   - Only 9 rows - trends-worker may not be running correctly

### Low Priority (Code Cleanup)
6. **Remove legacy SQL chat mode** if Cube.js mode is stable
   - `system-prompt.ts`, `tools.ts`, and `query_database` handler in `route.ts`

7. **Remove `first_page_creation_date`** from publishers/developers
   - 100% NULL, no data source

---

## 9. Data Retention Candidates

Based on this analysis, the following could be candidates for cleanup:

| Item | Type | Size Impact | Risk |
|------|------|-------------|------|
| `recent_*` columns | 4 columns | Low | None - never used |
| `page_creation_date_raw` | 1 column | Low | None - never read |
| `steam_vanity_url` | 2 columns | Low | UI will show nothing (already does) |
| `first_page_creation_date` | 2 columns | Low | UI will show nothing (already does) |
| Legacy SQL chat mode | Code files | None | Medium - backup for Cube.js issues |

**Total columns that could be removed:** 9 columns across 4 tables

---

## Appendix: File References

### Key Files for Cleanup
- `/Users/ryanbohmann/Desktop/publisheriq/supabase/migrations/` - Schema definitions
- `/Users/ryanbohmann/Desktop/publisheriq/packages/ingestion/src/workers/` - Data population
- `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/lib/llm/system-prompt.ts` - Legacy SQL prompt
- `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/lib/llm/tools.ts` - Legacy SQL tools
- `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/app/api/chat/route.ts` - Chat route with legacy handler
