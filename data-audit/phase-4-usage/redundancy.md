# Redundant Storage Analysis

This document identifies data stored in multiple locations that could become inconsistent, calculated values that could be computed on-the-fly, and sync risks between different data sources.

## Executive Summary

| Category | Finding | Severity | Impact |
|----------|---------|----------|--------|
| Price Redundancy | `apps.current_price_cents` vs `daily_metrics.price_cents` | Medium | 1,822 mismatches |
| Review Score Redundancy | `apps.pics_review_score` vs `daily_metrics.review_score` | High | 15,717 mismatches |
| Discount Redundancy | `apps.current_discount_percent` vs `daily_metrics.discount_percent` | Medium | 8,268 mismatches |
| CCU Redundancy | `ccu_tier_assignments.recent_peak_ccu` vs `ccu_snapshots` | Medium | Stale data |
| Review Histogram Drift | `review_histogram` totals vs `daily_metrics.total_reviews` | High | 14,700 mismatches |
| Velocity Redundancy | `sync_status.velocity_7d` vs `app_trends.review_velocity_7d` | Low | 7 mismatches |
| Materialized View Staleness | 9 views with daily refresh | Medium | Query staleness |

---

## 1. Duplicate Data Storage

### 1.1 Price Data (Medium Priority)

**Location 1:** `apps.current_price_cents` (updated by storefront sync)
**Location 2:** `daily_metrics.price_cents` (daily snapshot)

```sql
-- 1,822 price mismatches found
SELECT COUNT(*)
FROM apps a
JOIN daily_metrics dm ON a.appid = dm.appid
WHERE a.current_price_cents != dm.price_cents
  AND dm.metric_date = (SELECT MAX(metric_date) FROM daily_metrics WHERE appid = a.appid);
-- Result: 1,822 mismatches
```

**Why This Happens:**
- `apps.current_price_cents` is updated during storefront sync (5x daily)
- `daily_metrics.price_cents` captures a daily snapshot
- Sale prices can change multiple times per day

**Example Mismatches:**
| App | apps.price | daily_metrics.price | Reason |
|-----|------------|---------------------|--------|
| Luxor 2 HD | $9.99 | $3.29 | Sale ended |
| Tennis World Tour | $29.99 | $2.99 | Sale ended |
| Split Souls | $0.99 | $0.49 | Sale ended |

**Recommendation:** Keep both - `apps` is current state, `daily_metrics` is historical. Document that they serve different purposes.

### 1.2 Review Score Data (High Priority)

**Location 1:** `apps.pics_review_score` (from PICS service)
**Location 2:** `daily_metrics.review_score` (from Reviews API)

```sql
-- 15,717 review score mismatches
-- 12,777 where daily_metrics.review_score = 0 (missing data)
-- 2,940 actual score differences
```

**Root Cause Analysis:**
- PICS provides `pics_review_score` (1-9 scale, Steam's internal score)
- Reviews API provides `review_score` (same 1-9 scale)
- 12,777 games have PICS data but no Reviews API data (score = 0)
- 2,940 have legitimate differences (timing, calculation method)

**Example Conflicts:**
| App | PICS Score | Reviews Score | PICS % | Calculated % |
|-----|-----------|---------------|--------|--------------|
| Gundroid | 8 | 7 | 96% | 96% |
| La-Mulana | 6 | 8 | 79% | 81% |
| The Secret Order 5 | 8 | 6 | 82% | 78% |

**Recommendation:**
1. Use PICS score as fallback when Reviews API returns 0
2. Consider removing `pics_review_score` if Reviews API is authoritative
3. Document that scores may differ by 1-2 points due to timing

### 1.3 Discount Data (Medium Priority)

**Location 1:** `apps.current_discount_percent`
**Location 2:** `daily_metrics.discount_percent`

```sql
-- 8,268 discount mismatches
-- Caused by same timing issue as prices
```

**Recommendation:** Same as prices - keep both, document purpose difference.

### 1.4 CCU Peak Data (Medium Priority)

**Location 1:** `ccu_tier_assignments.recent_peak_ccu` (7-day peak)
**Location 2:** `ccu_snapshots.player_count` (hourly samples)
**Location 3:** `daily_metrics.ccu_peak` (daily peak from SteamSpy)

```sql
-- Significant drift between recent_peak_ccu and actual max from snapshots
-- Example: Counter-Strike (appid 10)
-- recent_peak_ccu: 7,323
-- Actual 7-day max: 13,997 (90% higher!)
```

**Sample Mismatches:**
| App | Stored Peak | Actual Peak | Difference |
|-----|-------------|-------------|------------|
| Counter-Strike 2 (730) | 1,013,936 | 1,401,319 | +38% |
| Dota 2 (570) | ~600K | ~1M | +67% |
| Half-Life 2 (220) | 1,555 | 3,249 | +109% |

**Root Cause:** `recent_peak_ccu` is only updated when tier assignments change, not continuously.

**Recommendation:**
1. Either compute peak dynamically from `ccu_snapshots`
2. Or refresh `recent_peak_ccu` more frequently (daily)

### 1.5 Velocity Data (Low Priority)

**Location 1:** `sync_status.velocity_7d`
**Location 2:** `app_trends.review_velocity_7d`

```sql
-- Only 7 mismatches found
-- sync_status.velocity_7d: 0.0000 for all mismatched rows
-- app_trends.review_velocity_7d: varies (48.43, 2.29, etc.)
```

**Analysis:** These track the same metric but `sync_status.velocity_7d` appears to be initialization zeros that were never updated for some legacy apps (appids 10, 20, 30, 40, 50, 60, 70).

**Recommendation:** Remove `sync_status.velocity_7d` since `app_trends.review_velocity_7d` is authoritative.

---

## 2. Calculated Values Stored Instead of Computed

### 2.1 owners_midpoint (Correctly Computed)

`latest_daily_metrics.owners_midpoint` is computed in the view definition:
```sql
((lr.owners_min + lr.owners_max) / 2) AS owners_midpoint
```

**Status:** Good - not redundantly stored.

### 2.2 app_trends Calculations (Stored)

The `app_trends` table stores pre-computed trend data:

| Column | Could Be Computed From |
|--------|----------------------|
| `trend_30d_direction` | `daily_metrics` (last 30 days) |
| `trend_30d_change_pct` | `daily_metrics` (last 30 days) |
| `trend_90d_direction` | `daily_metrics` (last 90 days) |
| `current_positive_ratio` | Latest `daily_metrics.positive_reviews / total_reviews` |
| `review_velocity_7d` | `review_deltas` (last 7 days) |
| `ccu_trend_7d_pct` | `daily_metrics` (last 7 days) |

**Justification:** These are expensive to compute (joins across 1M+ daily_metrics rows) and are updated daily by `trends-calculation` workflow. Acceptable trade-off.

### 2.3 publishers.game_count / developers.game_count (Stored)

```sql
-- Verified: 0 mismatches between stored count and actual count
-- Total: 89,769 publishers, 105,092 developers
```

**Status:** In sync. Updated by triggers when app relationships change.

### 2.4 dashboard_stats_cache (Stored)

Caches counts that could be computed:

| Cached Value | Can Compute Via |
|--------------|----------------|
| apps_count | `COUNT(*) FROM apps` |
| publishers_count | `COUNT(*) FROM publishers` |
| developers_count | `COUNT(*) FROM developers` |
| pics_synced | `COUNT(*) FROM sync_status WHERE is_syncable AND last_pics_sync IS NOT NULL` |

```sql
-- Verified accurate as of 2026-01-09 23:30:00
-- Refreshed via refresh_dashboard_stats() function
```

**Justification:** Expensive count queries avoided. Updated every 30 minutes. Acceptable.

---

## 3. Materialized View Sync Risks

### 3.1 View Inventory

| View | Size | Last Computed | Refresh Trigger |
|------|------|---------------|-----------------|
| `publisher_metrics` | 68 MB | 2026-01-09 05:16:01 | Daily via `refresh_entity_metrics()` |
| `developer_metrics` | 71 MB | 2026-01-09 05:16:16 | Daily via `refresh_entity_metrics()` |
| `latest_daily_metrics` | 27 MB | Dynamic | Via `refresh_latest_daily_metrics()` |
| `publisher_year_metrics` | 23 MB | Unknown | Via `refresh_all_metrics_views()` |
| `developer_year_metrics` | 27 MB | Unknown | Via `refresh_all_metrics_views()` |
| `publisher_game_metrics` | 28 MB | Unknown | Via `refresh_all_metrics_views()` |
| `developer_game_metrics` | 30 MB | Unknown | Via `refresh_all_metrics_views()` |
| `monthly_game_metrics` | 35 MB | Unknown | Via `refresh_monthly_game_metrics()` |
| `review_velocity_stats` | 808 KB | Unknown | Via `refresh_review_velocity_stats()` |

### 3.2 Staleness Window

The `refresh-views` workflow runs at 05:00 UTC daily, meaning:
- Views can be up to 24 hours stale
- New games added won't appear in entity metrics until next refresh
- Trending status can be outdated by a full day

### 3.3 Queries That Bypass Views

Potential for different results when:
1. Cube.js queries hit `publisher_metrics` (stale)
2. Direct SQL queries aggregate from `apps` + `daily_metrics` (fresh)

**Example Discrepancy:**
```sql
-- Via materialized view (stale)
SELECT total_reviews FROM publisher_metrics WHERE publisher_id = 123;
-- Via direct aggregation (fresh)
SELECT SUM(total_reviews) FROM daily_metrics dm
JOIN app_publishers ap ON dm.appid = ap.appid
WHERE ap.publisher_id = 123;
```

### 3.4 latest_daily_metrics Discrepancy Found

```sql
-- Found rows where view shows different review counts than raw data
-- Example: Portal (appid 400)
-- View: 177,741 reviews
-- Raw: 79,145 reviews
```

**Root Cause:** This appears to be a view refresh timing issue - the view was computed when there was older data. The `DISTINCT ON` clause should work correctly, but the materialized view needs refreshing.

**Recommendation:**
1. Add `computed_at` timestamp to all materialized views for visibility
2. Alert if views are >24h stale
3. Consider more frequent refresh for `latest_daily_metrics` (affects Discovery queries)

---

## 4. Denormalized Data Sync Risks

### 4.1 Publisher/Developer Names in Materialized Views

`publisher_metrics` and `developer_metrics` store:
- `publisher_name` / `developer_name` (copied from entity table)

```sql
-- Verified: 0 mismatches between view names and table names
-- Names are re-copied on each refresh
```

**Risk:** If publisher name changes, view will show old name until refresh.

### 4.2 CCU Tier Assignments

`ccu_tier_assignments.recent_peak_ccu` stores a snapshot that drifts significantly.

**Current Coverage:**
```
Total apps: 157,695
Apps with tier assignment: 117,766 (75%)
Apps without tier: 39,929 (25%)
```

**Risk:** Apps without tier assignments don't get CCU polling.

### 4.3 sync_status and apps 1:1 Relationship

```sql
-- Verified: 0 apps without sync_status records
-- The relationship is maintained correctly
```

---

## 5. Data Conflicts Between Sources

### 5.1 PICS vs Reviews API (Review Scores)

Per CLAUDE.md, **Storefront is authoritative for dev/pub** but for reviews:
- PICS provides `pics_review_score` and `pics_review_percentage`
- Reviews API provides `review_score` in `daily_metrics`

**Conflict Summary:**
| Source | Apps with Data | Description |
|--------|---------------|-------------|
| PICS (`apps.pics_review_score`) | 75,071 | Steam's internal score |
| Reviews API (`daily_metrics.review_score`) | 157,645 | Review count-based score |
| Review Histogram | 112,057 | Monthly review buckets |

**Recommendation:** Document which source to use:
- For **current review score**: `daily_metrics.review_score` (more apps)
- For **fallback**: `apps.pics_review_score` when Reviews returns 0
- For **trend analysis**: `review_histogram` (monthly granularity)

### 5.2 Review Histogram vs Total Reviews

```sql
-- 14,700 apps where histogram sum differs from total_reviews by >10%
-- Average difference: 2,071 reviews
```

**Example Discrepancies:**
| App | Histogram Total | daily_metrics Total | Difference |
|-----|----------------|---------------------|------------|
| Counter-Strike | 181,400 | 250,245 | -27% |
| Counter-Strike: Source | 145,661 | 43,797 | +233% |
| Portal | 178,168 | 79,145 | +125% |

**Root Cause:**
- Histogram counts reviews **by month of posting**
- daily_metrics counts **current total reviews**
- Reviews can be deleted/changed, causing drift

**Recommendation:** Use `daily_metrics.total_reviews` as authoritative current count.

### 5.3 SteamSpy vs Steam API CCU

`daily_metrics.ccu_peak` comes from SteamSpy (estimated)
`ccu_snapshots.player_count` comes from Steam API (exact)

No explicit source tracking exists to distinguish them.

**Recommendation:** Add `ccu_source` column to `daily_metrics` to track provenance.

---

## 6. Schema Duplication Analysis

### 6.1 Publishers and Developers Tables

Both tables have identical schema (11 columns each):

| Column | publishers | developers |
|--------|------------|------------|
| id | integer | integer |
| name | text | text |
| normalized_name | text | text |
| steam_vanity_url | text | text |
| game_count | integer | integer |
| first_game_release_date | date | date |
| first_page_creation_date | date | date |
| embedding_hash | text | text |
| last_embedding_sync | timestamp | timestamp |
| created_at | timestamp | timestamp |
| updated_at | timestamp | timestamp |

**Assessment:** Intentional - these are separate entity types with identical attributes. No action needed.

### 6.2 Materialized View Schema Similarity

`publisher_metrics` (17 columns) and `developer_metrics` (16 columns) are nearly identical:

| Shared Columns | publisher_metrics Only |
|----------------|----------------------|
| game_count | unique_developers |
| total_owners | - |
| total_ccu | - |
| estimated_weekly_hours | - |
| total_reviews | - |
| positive_reviews | - |
| avg_review_score | - |
| revenue_estimate_cents | - |
| is_trending | - |
| games_trending_up/down/stable | - |
| games_released_last_year | - |
| computed_at | - |

**Assessment:** Intentional parallel structure. `unique_developers` is specific to publishers (tracks development partners).

### 6.3 review_deltas vs daily_metrics Overlap

`review_deltas` (14 columns) includes columns that duplicate `daily_metrics`:

| Overlapping | review_deltas Purpose |
|-------------|----------------------|
| total_reviews | Snapshot at delta time |
| positive_reviews | Snapshot at delta time |
| review_score | Snapshot at delta time |
| review_score_desc | Snapshot at delta time |

Plus unique columns:
- reviews_added, positive_added, negative_added
- hours_since_last_sync, daily_velocity, is_interpolated

**Current Size Comparison:**
- review_deltas: 8,605 records (2 MB)
- daily_metrics: 1,070,489 records (197 MB)

**Assessment:** `review_deltas` is a specialized table for velocity tracking. The overlap is justified for denormalized query performance.

---

## 7. Storage Impact Analysis

### 7.1 Redundant Storage Size Estimate

| Redundancy | Estimated Waste |
|------------|----------------|
| Price in both tables | ~2 MB |
| Discount in both tables | ~1 MB |
| Review scores duplicated | ~3 MB |
| CCU stored multiple ways | ~5 MB |
| Materialized view duplication | ~200 MB |

**Total Estimated Redundancy:** ~211 MB

**Context:** Total database is ~1.5 GB, so redundancy is ~14% of storage.

### 7.2 Largest Tables

| Table | Total Size | Notes |
|-------|-----------|-------|
| review_histogram | 408 MB | Historical data, cannot reduce |
| app_steam_tags | 233 MB | Core relationship data |
| daily_metrics | 197 MB | Historical data, cannot reduce |
| sync_status | 124 MB | Operational tracking |
| Materialized Views | ~300 MB | Trade-off for query speed |

---

## 8. Recommendations

### High Priority

1. **Document Review Score Sources**
   - Add comment to `apps.pics_review_score`: "Fallback when Reviews API returns 0"
   - Cube.js should prefer `daily_metrics.review_score`

2. **Fix CCU Tier Peak Staleness**
   - Add daily refresh of `ccu_tier_assignments.recent_peak_ccu`
   - Or compute dynamically: `SELECT MAX(player_count) FROM ccu_snapshots WHERE snapshot_time > NOW() - INTERVAL '7 days'`

3. **Add Source Tracking**
   - Add `ccu_source` enum to `daily_metrics`: `'steamspy'`, `'steam_api'`
   - Helps debug data quality issues

### Medium Priority

4. **Remove sync_status.velocity_7d**
   - Redundant with `app_trends.review_velocity_7d`
   - Migration: `ALTER TABLE sync_status DROP COLUMN velocity_7d;`

5. **Add computed_at to All Views**
   - Enables staleness detection
   - Alerting when views are >24h old

6. **Document Price/Discount Purpose**
   - `apps.*`: Current price (may change hourly during sales)
   - `daily_metrics.*`: Historical snapshot for trend analysis

### Low Priority

7. **Consider Consolidating Review Sources**
   - If PICS and Reviews API scores are redundant, choose one
   - Current state: PICS used as fallback, but could simplify

8. **Monitor Histogram Drift**
   - 14,700 apps have >10% drift between histogram and total
   - Add monitoring job to detect significant drift

---

## Appendix: Validation Queries

### A. Check Price Sync Status
```sql
SELECT
  COUNT(*) as mismatches,
  AVG(ABS(a.current_price_cents - dm.price_cents)) as avg_diff_cents
FROM apps a
JOIN latest_daily_metrics dm ON a.appid = dm.appid
WHERE a.current_price_cents IS NOT NULL
  AND dm.price_cents IS NOT NULL
  AND a.current_price_cents != dm.price_cents;
```

### B. Check Review Score Conflicts
```sql
SELECT
  COUNT(*) FILTER (WHERE dm.review_score = 0) as reviews_api_missing,
  COUNT(*) FILTER (WHERE dm.review_score > 0 AND a.pics_review_score != dm.review_score) as actual_diff
FROM apps a
JOIN latest_daily_metrics dm ON a.appid = dm.appid
WHERE a.pics_review_score IS NOT NULL
  AND dm.review_score IS NOT NULL;
```

### C. Check CCU Peak Accuracy
```sql
SELECT
  cta.appid,
  cta.recent_peak_ccu,
  MAX(cs.player_count) as actual_7d_peak,
  ROUND((MAX(cs.player_count) - cta.recent_peak_ccu) * 100.0 / NULLIF(cta.recent_peak_ccu, 0)) as drift_pct
FROM ccu_tier_assignments cta
JOIN ccu_snapshots cs ON cta.appid = cs.appid
WHERE cs.snapshot_time > NOW() - INTERVAL '7 days'
GROUP BY cta.appid, cta.recent_peak_ccu
HAVING MAX(cs.player_count) != cta.recent_peak_ccu
ORDER BY drift_pct DESC NULLS LAST
LIMIT 20;
```

### D. Check Materialized View Freshness
```sql
SELECT
  'publisher_metrics' as view_name,
  MAX(computed_at) as last_refresh,
  EXTRACT(EPOCH FROM (NOW() - MAX(computed_at)))/3600 as hours_stale
FROM publisher_metrics
UNION ALL
SELECT
  'developer_metrics',
  MAX(computed_at),
  EXTRACT(EPOCH FROM (NOW() - MAX(computed_at)))/3600
FROM developer_metrics;
```
