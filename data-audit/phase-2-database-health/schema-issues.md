# Schema Issues Analysis

**Generated:** 2026-01-09
**Database:** PublisherIQ Supabase PostgreSQL

---

## Executive Summary

The PublisherIQ database schema is generally well-designed with proper primary keys, foreign key constraints, and appropriate use of enums. However, there are several areas that could benefit from improvement:

- **6 columns** store numeric/enum data as TEXT that could be typed more strictly
- **26 columns** missing NOT NULL constraints on timestamp fields
- **6 columns** that look like foreign keys but lack FK constraints
- **6 columns** that should be converted to enum types
- All tables have primary keys (good)
- Naming conventions are consistent (good)

---

## 1. Data Type Issues

### Columns Storing Numeric Data as TEXT

| Table | Column | Current Type | Issue | Severity |
|-------|--------|--------------|-------|----------|
| `apps` | `current_build_id` | TEXT | All 113,769 non-null values are numeric | Low |
| `app_steam_deck` | `tested_build_id` | TEXT | Build IDs from Steam are numeric | Low |
| `daily_metrics` | `review_score_desc` | TEXT | Score description ("Mostly Positive") - valid as text | None |
| `daily_metrics` | `recent_score_desc` | TEXT | Score description - valid as text | None |
| `review_deltas` | `review_score_desc` | TEXT | Score description - valid as text | None |
| `dashboard_stats_cache` | `id` | TEXT | Cache key identifier - valid as text | None |
| `sync_jobs` | `github_run_id` | TEXT | External ID from GitHub - valid as text | None |

**Assessment:** The build ID columns (`current_build_id`, `tested_build_id`) could technically be BIGINT, but TEXT is acceptable since they're used as identifiers, not for arithmetic. No critical issues.

**Severity: Low**

---

## 2. Missing NOT NULL Constraints

### Timestamp Columns Without NOT NULL

Many tables have `created_at` and `updated_at` columns that are nullable. While they have DEFAULT values, adding NOT NULL would enforce data integrity.

| Table | Column | Has Default? | Recommendation |
|-------|--------|--------------|----------------|
| `app_categories` | `created_at` | Yes (NOW()) | Add NOT NULL |
| `app_dlc` | `created_at` | Yes (NOW()) | Add NOT NULL |
| `app_franchises` | `created_at` | Yes (NOW()) | Add NOT NULL |
| `app_genres` | `created_at` | Yes (NOW()) | Add NOT NULL |
| `app_steam_deck` | `updated_at` | Yes (NOW()) | Add NOT NULL |
| `app_steam_tags` | `created_at` | Yes (NOW()) | Add NOT NULL |
| `app_trends` | `updated_at` | Yes (NOW()) | Add NOT NULL |
| `apps` | `type` | Yes ('game') | Keep nullable (allows unknown types) |
| `apps` | `created_at` | Yes (NOW()) | Add NOT NULL |
| `apps` | `updated_at` | Yes (NOW()) | Add NOT NULL |
| `ccu_tier_assignments` | `updated_at` | Yes (NOW()) | Add NOT NULL |
| `chat_query_logs` | `created_at` | Yes (NOW()) | Add NOT NULL |
| `dashboard_stats_cache` | `updated_at` | Yes (NOW()) | Add NOT NULL |
| `developers` | `created_at` | Yes (NOW()) | Add NOT NULL |
| `developers` | `updated_at` | Yes (NOW()) | Add NOT NULL |
| `franchises` | `created_at` | Yes (NOW()) | Add NOT NULL |
| `franchises` | `updated_at` | Yes (NOW()) | Add NOT NULL |
| `pics_sync_state` | `updated_at` | Yes (NOW()) | Add NOT NULL |
| `publishers` | `created_at` | Yes (NOW()) | Add NOT NULL |
| `publishers` | `updated_at` | Yes (NOW()) | Add NOT NULL |
| `review_deltas` | `created_at` | Yes (NOW()) | Add NOT NULL |
| `steam_categories` | `created_at` | Yes (NOW()) | Add NOT NULL |
| `steam_genres` | `created_at` | Yes (NOW()) | Add NOT NULL |
| `steam_tags` | `created_at` | Yes (NOW()) | Add NOT NULL |
| `steam_tags` | `updated_at` | Yes (NOW()) | Add NOT NULL |
| `sync_jobs` | `created_at` | Yes (NOW()) | Add NOT NULL |

**Impact:** No data loss expected since all columns have defaults. This is a defensive improvement.

**Severity: Low**

### Recommended Migration

```sql
-- Example migration to add NOT NULL (after verifying no NULL values exist)
ALTER TABLE apps ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE apps ALTER COLUMN updated_at SET NOT NULL;
-- ... repeat for other tables
```

---

## 3. Tables Without Primary Keys

**Result: NONE** - All tables have primary keys.

This is excellent schema design. Every table has a well-defined primary key.

**Severity: None**

---

## 4. Missing Foreign Key Constraints

### Columns That Look Like Foreign Keys But Aren't

| Table | Column | Expected Reference | Reason | Severity |
|-------|--------|-------------------|--------|----------|
| `app_dlc` | `parent_appid` | `apps(appid)` | FK was intentionally removed (migration 20260105000001) | Intentional |
| `app_dlc` | `dlc_appid` | `apps(appid)` | FK was intentionally removed | Intentional |
| `apps` | `parent_appid` | `apps(appid)` | Self-reference FK dropped (migration 20251230000002) | Intentional |
| `apps` | `current_build_id` | None | Not a foreign key (Steam build ID) | None |
| `app_steam_deck` | `tested_build_id` | None | Not a foreign key (Steam build ID) | None |
| `sync_jobs` | `github_run_id` | None | External reference (GitHub) | None |

**Assessment:** The missing FKs on `parent_appid` columns were intentionally dropped in migrations to handle DLC that references parent apps not yet in the database. This is documented in:
- `20251230000002_drop_parent_appid_fk.sql`
- `20260105000001_remove_app_dlc_fk.sql`

The rationale: DLC apps often arrive before their parent game during bulk syncs, and cascading deletes for DLC are not desired when a parent game is removed.

**Severity: None (by design)**

---

## 5. Naming Inconsistencies

### Column Naming Analysis

The schema uses consistent naming conventions:

| Pattern | Examples | Tables |
|---------|----------|--------|
| `created_at` | Timestamps | 19 tables |
| `appid` | Steam app ID | 16 tables |
| `id` | Primary key | 15 tables |
| `updated_at` | Update tracking | 12 tables |
| `name` | Entity name | 7 tables |
| `user_id` | User reference | 4 tables |

**Potential Inconsistency:**
- `user_id` (foreign key style) vs `appid` (no underscore)
- This is acceptable as `appid` is a well-known Steam convention

**Severity: None**

---

## 6. Columns That Should Be Enums

### TEXT Columns with Enumerable Values

| Table | Column | Current Type | Distinct Values | Recommendation | Severity |
|-------|--------|--------------|-----------------|----------------|----------|
| `apps` | `release_state` | TEXT | prerelease, released, disabled | Create enum | Medium |
| `apps` | `app_state` | TEXT | ~10 Steam states | Create enum | Medium |
| `sync_jobs` | `job_type` | TEXT | 12 job types | Create enum | Medium |
| `sync_jobs` | `status` | TEXT | running, completed, failed, completed_with_errors | Create enum | Medium |
| `sync_status` | `review_velocity_tier` | TEXT | high, medium, low, dormant, unknown | Create enum | Medium |
| `ccu_tier_assignments` | `tier_reason` | TEXT | top_ccu, new_release, default | Create enum | Low |

### Existing Enums (Good)

The database already uses enums appropriately for:
- `app_type` (game, dlc, demo, mod, video, hardware, music, etc.)
- `sync_source` (steamspy, storefront, reviews, histogram, scraper, pics)
- `trend_direction` (up, down, stable)
- `refresh_tier` (active, moderate, dormant, dead)
- `steam_deck_category` (unknown, unsupported, playable, verified)
- `user_role` (user, admin)
- `waitlist_status` (pending, approved, rejected)
- `credit_transaction_type` (signup_bonus, admin_grant, etc.)
- `credit_reservation_status` (pending, finalized, refunded)

### Recommended Migrations

```sql
-- Create new enums
CREATE TYPE release_state AS ENUM ('prerelease', 'released', 'disabled');
CREATE TYPE app_state_enum AS ENUM (
  'eStateTool', 'eStatePreloadOnly', 'eStateUnAvailable',
  'eStateAvailablea', 'eStateAvailable', 'eStateComingAvailable',
  'eStateComingSoonNoPreload', 'eStateUnavailable',
  'eStateJustReleased', 'eStateAvailablePreloadable'
);
CREATE TYPE sync_job_type AS ENUM (
  'applist', 'refresh_views', 'velocity-calc', 'trends',
  'reviews', 'price', 'scraper', 'storefront', 'priority',
  'histogram', 'embedding', 'steamspy'
);
CREATE TYPE sync_job_status AS ENUM ('running', 'completed', 'failed', 'completed_with_errors');
CREATE TYPE velocity_tier AS ENUM ('high', 'medium', 'low', 'dormant', 'unknown');

-- Then alter columns (requires backfill verification)
ALTER TABLE apps ALTER COLUMN release_state TYPE release_state USING release_state::release_state;
-- etc.
```

**Note:** Enum migrations require careful planning as they cannot be reversed easily.

**Severity: Medium** (improves type safety and query performance)

---

## 7. Summary by Severity

### Critical Issues
None identified.

### High Severity Issues
None identified.

### Medium Severity Issues
| Issue | Count | Recommendation |
|-------|-------|----------------|
| TEXT columns that should be enums | 6 | Create enum types for better type safety |

### Low Severity Issues
| Issue | Count | Recommendation |
|-------|-------|----------------|
| Timestamp columns without NOT NULL | 26 | Add NOT NULL constraints |
| Numeric data stored as TEXT | 2 | Leave as-is (acceptable for identifiers) |

---

## 8. Schema Evolution Notes

### Migration History Analysis

The schema has evolved through **63 migrations** from `20241227000000` to `20260110000003`. Key observations:

1. **Initial Design (Dec 2024):** Clean foundation with proper enums, FKs, and RLS
2. **PICS Integration (Dec 2025):** Added Steam tags, genres, categories, franchises
3. **Embedding System (Dec-Jan):** Added vector search tracking columns
4. **User System (Jan 2026):** Added authentication with proper RLS
5. **Velocity Tracking (Jan 2026):** Added review delta analysis
6. **CCU Tiers (Jan 2026):** Added tiered CCU tracking system

### Notable Schema Decisions

1. **Intentional FK Removals:** Parent app references were removed to handle data sync ordering
2. **Materialized Views:** Publisher/developer metrics use materialized views for performance
3. **Enum Evolution:** `app_type` enum was extended to include more types (episode, tool, application, series, advertising)

---

## 9. Recommendations

### Immediate Actions (Low Risk)
1. Add NOT NULL constraints to timestamp columns (verify no NULLs exist first)

### Short-term Actions (Medium Risk)
2. Create enum types for `release_state`, `app_state`, `job_type`, `status`, `review_velocity_tier`
3. Document the intentional FK removals in schema comments

### Long-term Considerations
4. Consider adding CHECK constraints for bounded numeric values
5. Add database comments to document column purposes

### Migration Template

```sql
-- Verify no NULLs before adding NOT NULL
SELECT 'apps' as table_name, COUNT(*) as null_count
FROM apps WHERE created_at IS NULL
UNION ALL
SELECT 'apps', COUNT(*) FROM apps WHERE updated_at IS NULL;
-- ... verify all tables

-- Then apply NOT NULL
ALTER TABLE apps ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE apps ALTER COLUMN updated_at SET NOT NULL;
```

---

## 10. Conclusion

The PublisherIQ database schema is well-designed with:
- Proper primary keys on all tables
- Appropriate use of foreign keys (with documented exceptions)
- Good use of enums for categorical data
- Consistent naming conventions

The main opportunities for improvement are:
1. Converting remaining TEXT columns with fixed values to enums (improves type safety)
2. Adding NOT NULL constraints to timestamp columns (defensive integrity)

These are refinements rather than critical fixes. The schema is production-ready and functional.
