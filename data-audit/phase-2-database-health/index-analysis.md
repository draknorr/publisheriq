# Index Analysis Report - PublisherIQ Database

**Date:** January 9, 2026
**Database:** Supabase PostgreSQL
**Total Index Size:** 806 MB
**Unused Index Size (< 10 scans):** 313 MB (38.8% of total)

---

## Executive Summary

The database has **152 indexes** across all public tables. Analysis reveals:
- **96 indexes with fewer than 10 scans** (potential candidates for removal)
- **No redundant/duplicate indexes detected** by the prefix analysis
- **Several large unused indexes** consuming significant storage
- **Some missing indexes** identified from common query patterns

### Key Recommendations

1. **Remove 313 MB of unused indexes** to improve write performance
2. **Consider consolidating duplicate functional indexes** (embedding_needed patterns)
3. **Add missing indexes** for frequently filtered columns
4. **Monitor before dropping** - reset stats and verify after 30 days

---

## Complete Index Inventory by Table

### High-Traffic Tables (apps, sync_status, daily_metrics)

#### `apps` Table
| Index Name | Size | Scans | Definition | Status |
|------------|------|-------|------------|--------|
| `apps_pkey` | 6.6 MB | 487M | btree (appid) | **Active - Primary Key** |
| `idx_apps_type` | 3.4 MB | 303 | btree (type) WHERE type = 'game' | Active |
| `idx_apps_released` | 4.1 MB | 284 | btree (is_released, is_delisted) | Active |
| `idx_apps_name` | 10 MB | 5 | btree (name) | **Review - Low usage for size** |
| `idx_apps_platforms` | 2.2 MB | 4 | btree (platforms) WHERE NOT NULL | Low usage |
| `idx_apps_needs_dev_info` | 5.5 MB | 0 | btree (appid) WHERE has_developer_info = false | **Unused** |
| `idx_apps_embedding_filter` | 2.2 MB | 0 | btree (type, is_delisted) partial | **Unused** |
| `idx_apps_parent_appid` | 40 KB | 1,227 | btree (parent_appid) WHERE NOT NULL | Active |

#### `sync_status` Table
| Index Name | Size | Scans | Definition | Status |
|------------|------|-------|------------|--------|
| `sync_status_pkey` | 6.7 MB | 7.4M | btree (appid) | **Active - Primary Key** |
| `idx_sync_status_priority` | 5.5 MB | 987 | btree (priority_score DESC) WHERE syncable | Active |
| `idx_sync_status_next_sync` | 6.1 MB | 5,378 | btree (next_sync_after) WHERE syncable | Active |
| `idx_sync_status_pics` | 5.0 MB | 956 | btree (last_pics_sync) WHERE syncable | Active |
| `idx_sync_status_embedding_needed` | 8.8 MB | 360 | btree (priority_score DESC, last_embedding_sync) WHERE syncable | Active |
| `idx_sync_status_interval_storefront` | 17 MB | 15 | btree (sync_interval_hours, last_storefront_sync, priority_score) | Low usage |
| `idx_sync_status_refresh_tier` | 6.4 MB | 15 | btree (refresh_tier) | Low usage |
| `idx_sync_status_price_sync` | 4.0 MB | 52 | btree (last_price_sync, priority_score DESC) WHERE syncable | Active |
| `idx_sync_status_reviews_sync` | 2.3 MB | 3 | btree (next_reviews_sync, review_velocity_tier) WHERE syncable | Low usage |
| `idx_sync_status_needs_scrape` | 7.0 MB | 0 | btree (appid) WHERE needs_page_creation_scrape = true | **Unused** |
| `idx_sync_status_steamspy_available` | 2.7 MB | 0 | btree (steamspy_available) WHERE false | **Unused** |
| `idx_sync_status_steamspy_individual_candidates` | 3.3 MB | 0 | btree (appid) WHERE specific conditions | **Unused** |
| `idx_sync_status_unembedded` | 2.6 MB | 0 | btree (appid) WHERE syncable AND last_embedding_sync IS NULL | **Unused** |

#### `daily_metrics` Table
| Index Name | Size | Scans | Definition | Status |
|------------|------|-------|------------|--------|
| `daily_metrics_pkey` | 27 MB | 0 | btree (id) | **Unused - Surrogate key** |
| `daily_metrics_appid_metric_date_key` | 30 MB | 1.6M | btree (appid, metric_date) UNIQUE | Active |
| `idx_daily_metrics_appid_date` | 30 MB | 912K | btree (appid, metric_date DESC) | Active |
| `idx_daily_metrics_date` | 11 MB | 583 | btree (metric_date) | Active |

### Junction Tables (app_steam_tags, app_genres, app_categories)

#### `app_steam_tags` Table
| Index Name | Size | Scans | Definition | Status |
|------------|------|-------|------------|--------|
| `app_steam_tags_pkey` | 58 MB | 54M | btree (appid, tag_id) | **Active - Primary Key** |
| `idx_app_steam_tags_tag_id` | 26 MB | 70K | btree (tag_id) | Active |
| `idx_app_steam_tags_created_at` | 22 MB | 0 | btree (created_at) | **Unused** |

#### `app_genres` Table
| Index Name | Size | Scans | Definition | Status |
|------------|------|-------|------------|--------|
| `app_genres_pkey` | 13 MB | 52M | btree (appid, genre_id) | **Active - Primary Key** |
| `idx_app_genres_genre_id` | 5.8 MB | 70K | btree (genre_id) | Active |
| `idx_app_genres_primary` | 6.1 MB | 0 | btree (appid) WHERE is_primary = true | **Unused** |
| `idx_app_genres_created_at` | 4.9 MB | 0 | btree (created_at) | **Unused** |

#### `app_categories` Table
| Index Name | Size | Scans | Definition | Status |
|------------|------|-------|------------|--------|
| `app_categories_pkey` | 19 MB | 3.6M | btree (appid, category_id) | **Active - Primary Key** |
| `idx_app_categories_category_id` | 10 MB | 50K | btree (category_id) | Active |
| `idx_app_categories_created_at` | 8.5 MB | 0 | btree (created_at) | **Unused** |

### Review Tables

#### `review_histogram` Table
| Index Name | Size | Scans | Definition | Status |
|------------|------|-------|------------|--------|
| `review_histogram_pkey` | 62 MB | 0 | btree (id) | **Unused - Surrogate key** |
| `review_histogram_appid_month_start_key` | 89 MB | 3.5M | btree (appid, month_start) UNIQUE | Active |
| `idx_review_histogram_appid_month` | 85 MB | 3K | btree (appid, month_start DESC) | **Duplicate of unique key** |

### Entity Metrics (Materialized Views)

#### `publisher_metrics` Materialized View
| Index Name | Size | Scans | Definition | Status |
|------------|------|-------|------------|--------|
| `idx_publisher_metrics_pk` | 4.6 MB | 0 | btree (publisher_id) UNIQUE | Used via joins |
| `idx_publisher_metrics_name` | 6.7 MB | 0 | btree (publisher_name) | **Unused** |
| `idx_publisher_metrics_owners` | 2.9 MB | 0 | btree (total_owners DESC) | **Unused** |
| `idx_publisher_metrics_ccu` | 3.0 MB | 0 | btree (total_ccu DESC) | **Unused** |
| `idx_publisher_metrics_revenue` | 3.1 MB | 0 | btree (revenue_estimate_cents DESC) | **Unused** |
| `idx_publisher_metrics_score` | 2.8 MB | 0 | btree (avg_review_score DESC NULLS LAST) | **Unused** |
| `idx_publisher_metrics_trending` | 3.0 MB | 0 | btree (games_trending_up DESC) | **Unused** |
| `idx_publisher_metrics_developers` | 3.1 MB | 0 | btree (unique_developers DESC) | **Unused** |
| `idx_publisher_metrics_weekly_hours` | 3.0 MB | 3 | btree (estimated_weekly_hours DESC) | Low usage |

#### `developer_metrics` Materialized View
| Index Name | Size | Scans | Definition | Status |
|------------|------|-------|------------|--------|
| `idx_developer_metrics_pk` | 5.0 MB | 0 | btree (developer_id) UNIQUE | Used via joins |
| `idx_developer_metrics_name` | 7.6 MB | 0 | btree (developer_name) | **Unused** |
| `idx_developer_metrics_owners` | 2.7 MB | 0 | btree (total_owners DESC) | **Unused** |
| `idx_developer_metrics_ccu` | 2.7 MB | 0 | btree (total_ccu DESC) | **Unused** |
| `idx_developer_metrics_revenue` | 2.9 MB | 0 | btree (revenue_estimate_cents DESC) | **Unused** |
| `idx_developer_metrics_score` | 2.8 MB | 0 | btree (avg_review_score DESC NULLS LAST) | **Unused** |
| `idx_developer_metrics_trending` | 2.6 MB | 0 | btree (games_trending_up DESC) | **Unused** |
| `idx_developer_metrics_weekly_hours` | 2.6 MB | 1 | btree (estimated_weekly_hours DESC) | Low usage |

### CCU Tables (New in v2.2)

#### `ccu_snapshots` Table
| Index Name | Size | Scans | Definition | Status |
|------------|------|-------|------------|--------|
| `ccu_snapshots_pkey` | 88 KB | 0 | btree (id) | **Unused - Surrogate key** |
| `ccu_snapshots_appid_snapshot_time_key` | 120 KB | 0 | btree (appid, snapshot_time) UNIQUE | Active |
| `idx_ccu_snapshots_appid_time` | 120 KB | 368 | btree (appid, snapshot_time DESC) | Active |
| `idx_ccu_snapshots_time` | 56 KB | 46 | btree (snapshot_time DESC) | Active |
| `idx_ccu_snapshots_tier_time` | 48 KB | 0 | btree (ccu_tier, snapshot_time DESC) | **Unused** |

---

## Unused Indexes (Candidates for Removal)

### High-Priority Removal (Large + Zero Scans)

| Table | Index Name | Size | Recommendation |
|-------|------------|------|----------------|
| `review_histogram` | `review_histogram_pkey` | 62 MB | Consider removing surrogate PK |
| `review_histogram` | `idx_review_histogram_appid_month` | 85 MB | Duplicate of unique constraint |
| `daily_metrics` | `daily_metrics_pkey` | 27 MB | Consider removing surrogate PK |
| `app_steam_tags` | `idx_app_steam_tags_created_at` | 22 MB | Remove - never used |
| `sync_status` | `idx_sync_status_interval_storefront` | 17 MB | Review - only 15 scans |
| `apps` | `idx_apps_name` | 10 MB | Keep - needed for search |
| `app_categories` | `idx_app_categories_created_at` | 8.5 MB | Remove - never used |
| `sync_status` | `idx_sync_status_needs_scrape` | 7.0 MB | Remove - feature deprecated |
| `publisher_metrics` | `idx_publisher_metrics_name` | 6.7 MB | Review - may be used by Cube.js |
| `developer_metrics` | `idx_developer_metrics_name` | 7.6 MB | Review - may be used by Cube.js |

### Medium-Priority Removal (Unused Partial/Conditional Indexes)

| Table | Index Name | Size | Reason |
|-------|------------|------|--------|
| `apps` | `idx_apps_needs_dev_info` | 5.5 MB | Feature likely complete |
| `apps` | `idx_apps_embedding_filter` | 2.2 MB | No scans |
| `sync_status` | `idx_sync_status_steamspy_individual_candidates` | 3.3 MB | No scans |
| `sync_status` | `idx_sync_status_steamspy_available` | 2.7 MB | No scans |
| `sync_status` | `idx_sync_status_unembedded` | 2.6 MB | Superseded by embedding_needed |
| `app_genres` | `idx_app_genres_created_at` | 4.9 MB | No scans |
| `app_genres` | `idx_app_genres_primary` | 6.1 MB | No scans - check if needed |

### Low-Priority (Small or Potentially Used Later)

| Table | Index Name | Size | Notes |
|-------|------------|------|-------|
| `publishers` | `idx_publishers_normalized` | 4.5 MB | No scans but may be used for lookups |
| `developers` | `idx_developers_normalized` | 5.0 MB | No scans but may be used for lookups |
| `franchises` | `idx_franchises_normalized` | 608 KB | No scans but may be used for lookups |
| `app_franchises` | `idx_app_franchises_created_at` | 280 KB | No scans |
| Various `*_year_metrics` | Multiple indexes | ~15 MB | New tables, give time |

---

## Duplicate/Redundant Indexes

### Functional Duplicates

1. **`developers` table:**
   - `idx_developers_embedding_needed` (2.4 MB)
   - `idx_developers_needs_embedding` (2.0 MB)
   - Both have identical definitions - **remove one**

2. **`publishers` table:**
   - `idx_publishers_embedding_needed` (1.7 MB)
   - `idx_publishers_needs_embedding` (1.4 MB)
   - Both have identical definitions - **remove one**

3. **`review_histogram` table:**
   - `review_histogram_appid_month_start_key` (UNIQUE constraint)
   - `idx_review_histogram_appid_month` (regular index on same columns)
   - **Remove the non-unique index** (saves 85 MB!)

---

## Missing Index Recommendations

Based on code analysis of query patterns:

### High Priority (Frequent Query Patterns)

1. **`apps.is_free` column**
   - Used in: game-search.ts, Discovery cube
   - Pattern: `.eq('is_free', is_free)`
   - Recommendation: `CREATE INDEX idx_apps_is_free ON apps(is_free);`

2. **`apps.release_date` column for range queries**
   - Used in: game-search.ts, insights-queries.ts
   - Pattern: `.gte('release_date', date)`, `.lte('release_date', date)`
   - Recommendation: `CREATE INDEX idx_apps_release_date ON apps(release_date DESC);`

3. **`apps.controller_support` column**
   - Used in: game-search.ts
   - Pattern: `.eq('controller_support', 'full')`, `.in('controller_support', [...])`
   - Recommendation: `CREATE INDEX idx_apps_controller_support ON apps(controller_support) WHERE controller_support IS NOT NULL;`

4. **`apps.current_discount_percent` column**
   - Used in: game-search.ts (on_sale filter)
   - Pattern: `.gt('current_discount_percent', 0)`
   - Recommendation: `CREATE INDEX idx_apps_on_sale ON apps(current_discount_percent) WHERE current_discount_percent > 0;`

5. **`steam_genres.name` column (ILIKE queries)**
   - Used in: game-search.ts for fuzzy matching
   - Pattern: `.ilike('name', '%genre%')`
   - Recommendation: `CREATE INDEX idx_steam_genres_name ON steam_genres USING gin(name gin_trgm_ops);`
   - Requires: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`

6. **`steam_categories.name` column (ILIKE queries)**
   - Used in: game-search.ts for fuzzy matching
   - Recommendation: `CREATE INDEX idx_steam_categories_name ON steam_categories USING gin(name gin_trgm_ops);`

### Medium Priority (Cube.js Query Patterns)

7. **Composite index for Discovery cube filters**
   - The Discovery cube frequently filters: `type = 'game' AND is_delisted = false AND is_released = true`
   - Recommendation: `CREATE INDEX idx_apps_discovery_base ON apps(appid) WHERE type = 'game' AND is_delisted = false AND is_released = true;`

8. **`latest_daily_metrics.positive_percentage` column**
   - Used in: Discovery cube segments (highlyRated, veryPositive)
   - Recommendation: `CREATE INDEX idx_ldm_positive_pct ON latest_daily_metrics(positive_percentage DESC NULLS LAST);`

### Low Priority (New Tables / Infrequent)

9. **`ccu_snapshots` for time-range queries**
   - Current index is good but consider adding:
   - `CREATE INDEX idx_ccu_snapshots_appid_player ON ccu_snapshots(appid, player_count DESC);`

---

## Overall Index Health Assessment

### Positive Findings
- Primary keys are well-indexed and highly used
- Junction tables have appropriate composite indexes
- Partial indexes are used correctly for sync operations
- No truly redundant prefix-overlapping indexes detected

### Areas of Concern
1. **38.8% of index storage is unused** - significant waste
2. **Surrogate key PKs on metrics tables** - never used, should switch to natural keys
3. **created_at indexes on junction tables** - no apparent use case
4. **Materialized view indexes** - mostly unused, queries likely go through Cube.js
5. **Duplicate embedding indexes** - clean up legacy migrations

### Estimated Space Recovery

| Action | Estimated Savings |
|--------|-------------------|
| Remove duplicate `idx_review_histogram_appid_month` | 85 MB |
| Remove surrogate PK on `review_histogram` | 62 MB |
| Remove surrogate PK on `daily_metrics` | 27 MB |
| Remove `idx_app_steam_tags_created_at` | 22 MB |
| Remove `idx_sync_status_interval_storefront` | 17 MB |
| Remove other unused indexes | ~100 MB |
| **Total Potential Savings** | **~313 MB** |

### Recommended Actions

1. **Immediate (Low Risk)**
   - Remove `idx_review_histogram_appid_month` (duplicate of unique constraint)
   - Remove all `*_created_at` indexes on junction tables

2. **After 30-Day Monitoring**
   - Remove unused materialized view indexes if Cube.js handles all queries
   - Remove legacy sync indexes (`needs_scrape`, `steamspy_*`)

3. **Consider Adding**
   - `idx_apps_release_date` for date range queries
   - `idx_apps_is_free` for free-to-play filtering
   - Trigram indexes for fuzzy name matching

---

## Appendix: SQL to Generate Removal Script

```sql
-- Generate DROP statements for unused indexes
SELECT 'DROP INDEX IF EXISTS ' || indexrelname || ';'
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey'
  AND indexrelname NOT LIKE '%_key'
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

*Report generated by Claude Code - Database Health Audit Phase 2*
