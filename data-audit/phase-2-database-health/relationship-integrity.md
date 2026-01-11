# Relationship Integrity Audit

**Generated:** 2026-01-09
**Database:** PublisherIQ Supabase PostgreSQL

---

## Executive Summary

The PublisherIQ database has **excellent referential integrity** overall, with 26 properly defined foreign key constraints protecting most relationships. The only significant issue is the **app_dlc table**, which lacks foreign key constraints and contains approximately 65,000 orphan records (99.5% of total DLC records).

| Category | Status |
|----------|--------|
| Junction Table Orphans | No issues found |
| Metrics Table Orphans | No issues found |
| User System Orphans | No issues found |
| DLC Table Orphans | 64,833 orphans (99.5%) |
| Foreign Key Coverage | Good (26 FKs defined) |
| Cascade Rules | Appropriate |
| Circular Dependencies | None detected |

---

## 1. Orphan Record Analysis

### 1.1 Publisher/Developer Junction Tables

| Table | Relationship | Orphan Count | Status |
|-------|--------------|--------------|--------|
| app_publishers | Missing apps | 0 | OK |
| app_publishers | Missing publishers | 0 | OK |
| app_developers | Missing apps | 0 | OK |
| app_developers | Missing developers | 0 | OK |

**Assessment:** Junction tables for publishers and developers have proper FK constraints with CASCADE delete rules, keeping data consistent.

### 1.2 Tag/Genre/Category Junction Tables

| Table | Relationship | Orphan Count | Status |
|-------|--------------|--------------|--------|
| app_steam_tags | Missing apps | 0 | OK |
| app_steam_tags | Missing tags | 0 | OK |
| app_genres | Missing apps | 0 | OK |
| app_genres | Missing genres | 0 | OK |
| app_categories | Missing apps | 0 | OK |
| app_categories | Missing categories | 0 | OK |
| app_franchises | Missing apps | 0 | OK |
| app_franchises | Missing franchises | 0 | OK |

**Assessment:** All PICS-related junction tables have proper FK constraints with CASCADE delete rules.

### 1.3 Metrics Tables

| Table | Relationship | Orphan Count | Status |
|-------|--------------|--------------|--------|
| daily_metrics | Missing apps | 0 | OK |
| review_histogram | Missing apps | 0 | OK |
| sync_status | Missing apps | 0 | OK |
| ccu_tier_assignments | Missing apps | 0 | OK |

**Assessment:** Metrics tables properly reference the apps table with FK constraints.

### 1.4 User System Tables

| Table | Relationship | Orphan Count | Status |
|-------|--------------|--------------|--------|
| credit_transactions | Missing user | 0 | OK |
| credit_reservations | Missing user | 0 | OK |
| chat_query_logs | Missing user | 0 | OK |

**Assessment:** User system tables have proper FK relationships.

### 1.5 DLC Table (ISSUE IDENTIFIED)

| Table | Relationship | Orphan Count | Status |
|-------|--------------|--------------|--------|
| app_dlc | Missing parent app | 165 | ISSUE |
| app_dlc | DLC not in apps | 64,668 | ISSUE |

**Breakdown of app_dlc integrity:**

| Status | Count | Percentage |
|--------|-------|------------|
| Both parent and DLC present | 339 | 0.52% |
| DLC appid missing from apps | 64,668 | 99.24% |
| Parent appid missing from apps | 165 | 0.25% |
| **Total records** | **65,172** | 100% |

**Root Cause Analysis:**
- The `app_dlc` table stores DLC relationships discovered by PICS service
- Most DLC appids have not been synced to the main `apps` table yet
- PICS discovers DLC relationships before the DLC apps themselves are fully ingested
- The 165 missing parent apps are likely delisted games

**Sample Orphaned DLC Records:**

| DLC AppID | Parent Game |
|-----------|-------------|
| 2555210 | Do Not Feed the Monkeys 2099 |
| 592373 | TEKKEN 7 |
| 548770 | Fantasy Grounds VTT |
| 297790 | Euro Truck Simulator 2 |
| 2252253 | The Legend of Heroes: Kuro no Kiseki II |

---

## 2. Foreign Key Constraint Analysis

### 2.1 Existing Foreign Key Constraints (26 total)

| Table | Column | References | Delete Rule |
|-------|--------|------------|-------------|
| app_categories | appid | apps(appid) | CASCADE |
| app_categories | category_id | steam_categories(category_id) | CASCADE |
| app_developers | appid | apps(appid) | CASCADE |
| app_developers | developer_id | developers(id) | CASCADE |
| app_franchises | appid | apps(appid) | CASCADE |
| app_franchises | franchise_id | franchises(id) | CASCADE |
| app_genres | appid | apps(appid) | CASCADE |
| app_genres | genre_id | steam_genres(genre_id) | CASCADE |
| app_publishers | appid | apps(appid) | CASCADE |
| app_publishers | publisher_id | publishers(id) | CASCADE |
| app_steam_deck | appid | apps(appid) | CASCADE |
| app_steam_tags | appid | apps(appid) | CASCADE |
| app_steam_tags | tag_id | steam_tags(tag_id) | CASCADE |
| app_tags | appid | apps(appid) | CASCADE |
| app_trends | appid | apps(appid) | CASCADE |
| ccu_snapshots | appid | apps(appid) | CASCADE |
| ccu_tier_assignments | appid | apps(appid) | CASCADE |
| chat_query_logs | user_id | user_profiles(id) | NO ACTION |
| chat_query_logs | reservation_id | credit_reservations(id) | NO ACTION |
| credit_reservations | user_id | user_profiles(id) | CASCADE |
| credit_transactions | user_id | user_profiles(id) | CASCADE |
| daily_metrics | appid | apps(appid) | CASCADE |
| rate_limit_state | user_id | user_profiles(id) | CASCADE |
| review_deltas | appid | apps(appid) | CASCADE |
| review_histogram | appid | apps(appid) | CASCADE |
| sync_status | appid | apps(appid) | CASCADE |

### 2.2 Missing Foreign Key Constraints

| Table | Column | Should Reference | Priority |
|-------|--------|------------------|----------|
| app_dlc | parent_appid | apps(appid) | Medium |
| app_dlc | dlc_appid | apps(appid) | Medium |

**Note:** The `app_dlc` table intentionally lacks FK constraints because DLC relationships are discovered before the DLC apps are fully synced. Adding FKs would require:
1. Pre-populating apps table with all DLC appids before PICS sync
2. Or using deferred constraint checking
3. Or cleaning up orphans after sync completion

### 2.3 Tables Without FK Relationships (by design)

| Table | Reason |
|-------|--------|
| apps | Root entity table |
| publishers | Root entity table |
| developers | Root entity table |
| steam_tags | Reference table |
| steam_genres | Reference table |
| steam_categories | Reference table |
| franchises | Reference table |
| pics_sync_state | Singleton state table |
| sync_jobs | Operational log (no entity references) |
| waitlist | Standalone user signup queue |
| dashboard_stats_cache | Aggregated cache table |

---

## 3. Cascade Rule Analysis

### 3.1 Tables Referencing `apps` (15 tables)

All 15 tables use **CASCADE** delete rule, meaning:
- Deleting an app removes all associated metrics, tags, genres, etc.
- This is appropriate for data consistency
- No historical data retention on app deletion

**Impact of deleting an app:**
```
DELETE FROM apps WHERE appid = X;
-- Automatically removes:
-- - app_categories (app category assignments)
-- - app_developers (developer relationships)
-- - app_franchises (franchise assignments)
-- - app_genres (genre assignments)
-- - app_publishers (publisher relationships)
-- - app_steam_deck (Steam Deck compatibility)
-- - app_steam_tags (PICS tag assignments)
-- - app_tags (SteamSpy tag assignments)
-- - app_trends (trend calculations)
-- - ccu_snapshots (CCU history)
-- - ccu_tier_assignments (tier assignments)
-- - daily_metrics (all historical metrics)
-- - review_deltas (review change history)
-- - review_histogram (review distribution history)
-- - sync_status (sync tracking)
```

### 3.2 Tables Referencing `user_profiles` (4 tables)

| Table | Delete Rule | Behavior |
|-------|-------------|----------|
| credit_reservations | CASCADE | Removes pending reservations |
| credit_transactions | CASCADE | Removes transaction history |
| rate_limit_state | CASCADE | Removes rate limit tracking |
| chat_query_logs | NO ACTION | Preserves logs (user_id becomes orphan reference) |

**Note:** `chat_query_logs` uses NO ACTION, which preserves audit trail but could create orphan references. This appears intentional for analytics preservation.

### 3.3 Tables Referencing Entity Tables

| Referenced Table | Referencing Table | Delete Rule |
|------------------|-------------------|-------------|
| publishers | app_publishers | CASCADE |
| developers | app_developers | CASCADE |
| franchises | app_franchises | CASCADE |
| steam_tags | app_steam_tags | CASCADE |
| steam_genres | app_genres | CASCADE |
| steam_categories | app_categories | CASCADE |
| credit_reservations | chat_query_logs | NO ACTION |

---

## 4. Circular Dependency Assessment

**Result:** No circular dependencies detected.

The schema follows a clean hierarchical structure:
```
apps (root)
  |-- app_publishers --> publishers
  |-- app_developers --> developers
  |-- app_steam_tags --> steam_tags
  |-- app_genres --> steam_genres
  |-- app_categories --> steam_categories
  |-- app_franchises --> franchises
  |-- daily_metrics
  |-- review_histogram
  |-- sync_status
  |-- ccu_snapshots
  |-- ccu_tier_assignments
  |-- app_trends
  |-- review_deltas
  |-- app_steam_deck

user_profiles (root)
  |-- credit_transactions
  |-- credit_reservations --> chat_query_logs
  |-- rate_limit_state
```

---

## 5. Materialized Views

The database contains 9 materialized views that depend on underlying tables:

| View | Dependencies |
|------|--------------|
| latest_daily_metrics | daily_metrics |
| publisher_metrics | publishers, apps, app_publishers, daily_metrics |
| publisher_year_metrics | publishers, apps, app_publishers, daily_metrics |
| publisher_game_metrics | publishers, apps, app_publishers, daily_metrics |
| developer_metrics | developers, apps, app_developers, daily_metrics |
| developer_year_metrics | developers, apps, app_developers, daily_metrics |
| developer_game_metrics | developers, apps, app_developers, daily_metrics |
| review_velocity_stats | apps, review_deltas |
| monthly_game_metrics | apps, daily_metrics |

**Note:** Materialized views do not have FK constraints but rely on underlying table data. They require periodic refresh via `REFRESH MATERIALIZED VIEW CONCURRENTLY`.

---

## 6. Recommendations

### 6.1 High Priority

**1. DLC Orphan Cleanup Strategy**
```sql
-- Option A: Delete orphan DLC records (if parent apps are truly gone)
DELETE FROM app_dlc
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE appid = app_dlc.parent_appid);
-- Removes: 165 records

-- Option B: Keep DLC relationships, add apps as placeholders
-- (Not recommended - inflates app count with incomplete data)
```

**2. Consider NOT adding FK constraints to app_dlc**
- The current design allows PICS to discover DLC relationships before apps are fully synced
- Adding FKs would require significant workflow changes
- Current orphan rate (64,668 DLC missing from apps) is expected behavior

### 6.2 Medium Priority

**3. Audit chat_query_logs NO ACTION rule**
- Verify this is intentional for preserving analytics after user deletion
- Consider adding a scheduled job to anonymize old orphaned user_ids

**4. Document cascade behavior**
- The current CASCADE rules mean deleting an app removes all historical data
- This may be undesirable for audit/analytics purposes
- Consider changing to SET NULL or NO ACTION for historical tables if data retention is important

### 6.3 Low Priority

**5. Monitor DLC sync progress**
- Track how many DLC appids are missing from apps table
- Consider batch syncing missing DLC metadata periodically

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Orphan DLC accumulation | High | Low | Expected behavior; no data loss |
| Cascade delete data loss | Low | High | Document and communicate cascade rules |
| User orphans in chat_query_logs | Low | Low | Design decision for audit preservation |
| Missing FK on app_dlc | N/A | Low | Intentional design for async data discovery |

**Overall Risk Level: LOW**

The database has solid referential integrity. The only orphan issue (app_dlc) is a known consequence of the async data ingestion pattern and does not impact query correctness or application functionality.

---

## 8. Summary Statistics

| Metric | Value |
|--------|-------|
| Total FK constraints | 26 |
| Tables with FK constraints | 16 |
| Tables without FK constraints | 16 |
| Orphan records (junction tables) | 0 |
| Orphan records (metrics tables) | 0 |
| Orphan records (user tables) | 0 |
| Orphan records (app_dlc) | 64,833 |
| Circular dependencies | 0 |
| CASCADE delete rules | 24 |
| NO ACTION delete rules | 2 |

---

*Report generated by PublisherIQ Database Health Audit*
