# PublisherIQ Table Size & Growth Analysis

**Generated:** January 9, 2026
**Database Size:** 1,623 MB (1.6 GB)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Database Size | 1,623 MB |
| Total Table Data | 803 MB |
| Total Index Size | 807 MB (50% of database) |
| Unused Index Space | 267 MB (50 indexes never used) |
| Number of Tables | 41 |
| Number of Indexes | 152 |

### Key Findings

1. **Indexes consume 50% of database** - Equal to table data, indicating potential over-indexing
2. **267 MB in unused indexes** - 50 indexes with >1MB size have never been scanned
3. **Review histogram is largest table** (407 MB) - Grows ~223K rows/day
4. **Daily metrics growing rapidly** - ~82K rows/day with 13 days of data
5. **Table bloat is moderate** - Autovacuum is running but some tables show 14-16% dead tuples

---

## Complete Size Inventory

### Tables by Size (Descending)

| Table | Row Count | Total Size | Table Data | Index Size | Avg Row Size |
|-------|-----------|------------|------------|------------|--------------|
| review_histogram | 2,902,080 | 407 MB | 171 MB | 236 MB | 61 bytes |
| app_steam_tags | 2,413,318 | 233 MB | 127 MB | 106 MB | 55 bytes |
| daily_metrics | 1,070,489 | 197 MB | 98 MB | 99 MB | 95 bytes |
| sync_status | 157,695 | 124 MB | 48 MB | 76 MB | 316 bytes |
| apps | 157,695 | 75 MB | 42 MB | 33 MB | 276 bytes |
| developer_metrics | 139,927 | 71 MB | 43 MB | 28 MB | 322 bytes |
| app_categories | 778,889 | 71 MB | 34 MB | 37 MB | 45 bytes |
| publisher_metrics | 89,704 | 68 MB | 36 MB | 32 MB | 423 bytes |
| app_genres | 456,073 | 53 MB | 24 MB | 29 MB | 54 bytes |
| monthly_game_metrics | 247,224 | 35 MB | 20 MB | 14 MB | 86 bytes |
| developers | 105,090 | 33 MB | 14 MB | 19 MB | 142 bytes |
| developer_game_metrics | 134,115 | 30 MB | 19 MB | 11 MB | 146 bytes |
| publishers | 89,767 | 28 MB | 13 MB | 16 MB | 147 bytes |
| publisher_game_metrics | 127,445 | 28 MB | 18 MB | 10 MB | 146 bytes |
| developer_year_metrics | 109,333 | 27 MB | 13 MB | 14 MB | 126 bytes |
| latest_daily_metrics | 151,133 | 27 MB | 19 MB | 8 MB | 130 bytes |
| publisher_year_metrics | 93,308 | 23 MB | 11 MB | 11 MB | 128 bytes |
| ccu_tier_assignments | 117,766 | 20 MB | 15 MB | 5 MB | 136 bytes |
| app_steam_deck | 30,547 | 17 MB | 16 MB | 1.4 MB | 544 bytes |
| app_developers | 170,872 | 11 MB | 6.3 MB | 5.1 MB | 37 bytes |
| app_publishers | 162,683 | 11 MB | 5.9 MB | 5 MB | 37 bytes |
| app_dlc | 65,170 | 10 MB | 4.4 MB | 5.6 MB | 69 bytes |
| app_franchises | 36,952 | 3.7 MB | 1.6 MB | 2.2 MB | 44 bytes |
| franchises | 13,307 | 2.7 MB | 1.1 MB | 1.5 MB | 87 bytes |
| review_deltas | 8,605 | 2 MB | 904 KB | 1.1 MB | 107 bytes |
| review_velocity_stats | 5,605 | 808 KB | 376 KB | 392 KB | - |
| sync_jobs | 2,390 | 720 KB | 360 KB | 320 KB | - |
| ccu_snapshots | 2,998 | 648 KB | 184 KB | 432 KB | - |
| steam_tags | 446 | 248 KB | 88 KB | 120 KB | - |
| chat_query_logs | 100 | 152 KB | 24 KB | 96 KB | - |

*Tables < 100KB omitted for brevity*

---

## Materialized Views

| View Name | Total Size | Purpose |
|-----------|------------|---------|
| developer_metrics | 71 MB | ALL-TIME developer aggregations |
| publisher_metrics | 68 MB | ALL-TIME publisher aggregations |
| monthly_game_metrics | 35 MB | Monthly game metrics |
| developer_game_metrics | 30 MB | Per-game developer data |
| publisher_game_metrics | 28 MB | Per-game publisher data |
| developer_year_metrics | 27 MB | Per-year developer stats |
| latest_daily_metrics | 27 MB | Current snapshot |
| publisher_year_metrics | 23 MB | Per-year publisher stats |
| review_velocity_stats | 808 KB | Velocity metrics per app |

**Total Materialized Views:** 309 MB (19% of database)

---

## Table Bloat Analysis

Tables with significant dead tuple accumulation:

| Table | Live Rows | Dead Rows | Dead % | Last Autovacuum | Est. Bloat |
|-------|-----------|-----------|--------|-----------------|------------|
| app_categories | 778,889 | 148,886 | 16.05% | 2026-01-07 | 5.5 MB |
| app_steam_tags | 2,413,318 | 142,056 | 5.56% | 2026-01-09 | 7.2 MB |
| review_histogram | 2,902,080 | 48,777 | 1.65% | 2026-01-06 | 2.7 MB |
| developer_game_metrics | 134,115 | 22,857 | 14.56% | 2026-01-08 | 2.8 MB |
| publisher_game_metrics | 127,445 | 21,599 | 14.49% | 2026-01-08 | 2.6 MB |
| apps | 157,695 | 21,210 | 11.86% | 2026-01-09 | 5.1 MB |
| monthly_game_metrics | 247,224 | 18,956 | 7.12% | 2026-01-08 | 1.5 MB |
| developer_year_metrics | 109,333 | 17,896 | 14.07% | 2026-01-08 | 1.9 MB |
| publisher_year_metrics | 93,308 | 15,741 | 14.43% | 2026-01-08 | 1.7 MB |
| publishers | 89,767 | 12,852 | 12.52% | 2026-01-07 | 1.6 MB |

**Total Estimated Bloat:** ~35 MB

### Bloat Observations

1. **app_categories** has highest dead tuple percentage (16%) - last vacuumed 2 days ago
2. **Materialized views** show 14-15% dead tuples after refresh operations
3. Autovacuum is running but may need more aggressive settings for frequently updated tables
4. Consider manual VACUUM ANALYZE for tables with >10% dead tuples

---

## Unused Indexes (Optimization Opportunity)

**50 indexes (267 MB) have never been used** since stats reset. Top candidates for removal:

| Table | Index Name | Size | Status |
|-------|------------|------|--------|
| review_histogram | review_histogram_pkey | 62 MB | NEVER USED |
| daily_metrics | daily_metrics_pkey | 27 MB | NEVER USED |
| developer_year_metrics | idx_developer_year_metrics_name | 5 MB | NEVER USED |
| developers | idx_developers_normalized | 5 MB | NEVER USED |
| developer_year_metrics | idx_developer_year_metrics_pk | 4.1 MB | NEVER USED |
| publishers | idx_publishers_normalized | 4.5 MB | NEVER USED |
| publisher_year_metrics | idx_publisher_year_metrics_name | 4.2 MB | NEVER USED |
| publisher_game_metrics | idx_publisher_game_metrics_pub | 3.2 MB | NEVER USED |
| publisher_year_metrics | idx_publisher_year_metrics_pk | 3.2 MB | NEVER USED |
| monthly_game_metrics | idx_monthly_game_metrics_year_month | 2.2 MB | NEVER USED |

**Note:** Primary keys (pkey) may be unused for lookups but required for constraints. Non-pkey indexes are safer to review for removal.

---

## Unbounded Growth Risk Assessment

### HIGH RISK - Time-Series Tables

| Table | Current Size | Rows/Day | 30-Day Growth | 1-Year Growth |
|-------|--------------|----------|---------------|---------------|
| review_histogram | 407 MB | 223,236 | +516 MB | +6.2 GB |
| daily_metrics | 197 MB | 82,345 | +240 MB | +2.9 GB |

### MEDIUM RISK - Event/Log Tables

| Table | Current Size | Rows/Day | 30-Day Growth | Notes |
|-------|--------------|----------|---------------|-------|
| sync_jobs | 720 KB | 184 | +2.2 MB | No cleanup policy visible |
| chat_query_logs | 152 KB | 13 | +400 KB | 7-day retention (has cleanup) |
| ccu_snapshots | 648 KB | ~1,500* | +4.5 MB | 30-day retention (has cleanup) |

*Estimated based on tier 1+2 hourly polling

### LOW RISK - Bounded Tables

| Table | Size | Growth Pattern |
|-------|------|----------------|
| apps | 75 MB | Grows with Steam catalog (~100-200 new apps/day) |
| publishers/developers | 28-33 MB | Grows with new entities only |
| app_steam_tags | 233 MB | Bounded by app count x avg tags |
| sync_status | 124 MB | 1:1 with apps table |

---

## Time-Series Data Analysis

### review_histogram

- **Date Range:** October 2010 - January 2026 (15+ years of data)
- **Unique Apps:** 112,057
- **Avg Records/App:** 25.9 monthly buckets
- **Growth Rate:** 223K rows/day during initial sync
- **Projection:** Will stabilize after initial sync; ongoing growth ~1K rows/day for new reviews

### daily_metrics

- **Date Range:** December 28, 2025 - January 9, 2026 (13 days)
- **Unique Apps:** 157,694
- **Avg Records/App:** 6.8 days
- **Growth Rate:** 82K rows/day (one row per app per day)
- **1-Year Projection:** 30M rows, ~3 GB

### ccu_snapshots

- **Date Range:** January 9, 2026 (just started)
- **Unique Apps:** 999
- **Retention:** 30 days with weekly cleanup
- **Design:** Already has cleanup workflow running weekly

---

## Partitioning & Archival Recommendations

### Immediate Candidates for Partitioning

1. **daily_metrics** (HIGH PRIORITY)
   - Current: 1M rows, 197 MB
   - 1-Year projection: 30M rows, 3 GB
   - Recommendation: Range partition by `metric_date` (monthly)
   - Benefit: Fast pruning for recent queries, easy archival

2. **review_histogram** (MEDIUM PRIORITY)
   - Current: 2.9M rows, 407 MB
   - Already has date-based data (month_start)
   - Recommendation: Range partition by `month_start` (yearly)
   - Benefit: Historical data rarely accessed, can archive old years

### Archival Candidates

| Table | Archive After | Estimated Savings |
|-------|---------------|-------------------|
| daily_metrics | 90 days | 75% of table size |
| review_histogram | 2 years | 50% of table size |
| sync_jobs | 30 days | 90% of table size |

---

## Storage Optimization Opportunities

### Quick Wins (No Schema Changes)

| Optimization | Estimated Savings | Risk |
|--------------|-------------------|------|
| Drop 50 unused indexes | 267 MB (16%) | Low* |
| VACUUM FULL on bloated tables | 35 MB (2%) | Medium (table lock) |
| Remove duplicate indexes | 10-20 MB | Low |

*Requires analysis to ensure indexes aren't needed for constraints

### Medium-Term (Schema Changes)

| Optimization | Estimated Savings | Effort |
|--------------|-------------------|--------|
| Partition daily_metrics | N/A (enables archival) | Medium |
| Archive 90+ day daily_metrics | 150 MB | Medium |
| Partition review_histogram | N/A (enables archival) | Medium |
| Compress historical data | 50% of archived | High |

### Long-Term Considerations

1. **TimescaleDB Extension** - Native time-series optimization for daily_metrics
2. **Columnar Storage** - For analytics-heavy tables (citus_columnar)
3. **External Storage** - Archive old histogram data to S3/cold storage

---

## Projected Growth Estimates

### Current Trajectory (No Changes)

| Period | daily_metrics | review_histogram | Total DB |
|--------|---------------|------------------|----------|
| Current | 197 MB | 407 MB | 1.6 GB |
| +30 days | 437 MB | 450 MB* | 1.9 GB |
| +90 days | 917 MB | 480 MB* | 2.5 GB |
| +1 year | 2.9 GB | 600 MB* | 5.5 GB |

*review_histogram growth slows after initial sync completes

### With Optimizations

| Period | With Archival | With Partitioning | With Both |
|--------|---------------|-------------------|-----------|
| +30 days | 1.8 GB | 1.9 GB | 1.7 GB |
| +90 days | 2.0 GB | 2.5 GB | 1.8 GB |
| +1 year | 2.5 GB | 5.5 GB | 2.2 GB |

---

## Recommended Actions

### Immediate (This Week)

1. **Analyze unused indexes** - Review the 50 unused indexes, prioritize non-pkey indexes for removal
2. **Run VACUUM ANALYZE** on tables with >10% dead tuples:
   ```sql
   VACUUM ANALYZE app_categories;
   VACUUM ANALYZE developer_game_metrics;
   VACUUM ANALYZE publisher_game_metrics;
   VACUUM ANALYZE developer_year_metrics;
   VACUUM ANALYZE publisher_year_metrics;
   ```

### Short-Term (This Month)

1. **Implement daily_metrics retention policy** - Delete records older than 90-180 days
2. **Add sync_jobs cleanup** - Currently no cleanup workflow, add 30-day retention
3. **Drop confirmed unused indexes** - After verification, remove to save 100-200 MB

### Medium-Term (Next Quarter)

1. **Partition daily_metrics** by month for efficient pruning and archival
2. **Partition review_histogram** by year for historical data management
3. **Implement automated archival** - Move old data to separate archive schema or external storage

---

## Appendix: Index Usage Details

### Most Used Indexes

| Index | Table | Scans |
|-------|-------|-------|
| apps_pkey | apps | 487,383,861 |
| app_steam_tags_pkey | app_steam_tags | 54,134,347 |
| app_genres_pkey | app_genres | 52,057,348 |
| sync_status_pkey | sync_status | 7,379,473 |
| review_histogram_appid_month_start_key | review_histogram | 3,544,398 |
| app_categories_pkey | app_categories | 3,559,837 |

### Duplicate/Redundant Indexes

| Table | Potential Duplicates | Notes |
|-------|---------------------|-------|
| review_histogram | idx_review_histogram_appid_month (85 MB) overlaps with unique key (89 MB) | Review if both needed |
| daily_metrics | idx_daily_metrics_appid_date (30 MB) overlaps with unique key (30 MB) | Review if both needed |
