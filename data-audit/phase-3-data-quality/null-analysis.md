# NULL & Empty Value Analysis Report

**Generated:** January 9, 2026
**Database:** PublisherIQ Supabase PostgreSQL
**Scope:** apps (157K rows), publishers (89K), developers (105K), daily_metrics (1M), sync_status (157K)

---

## Executive Summary

This analysis identifies columns with NULL values, empty strings, and data quality issues across major tables. Key findings:

- **4 columns always NULL** (0% populated) - candidates for removal
- **7 columns mostly NULL** (>90% NULL) - some intentional, some need investigation
- **32 apps with empty names** - data integrity issue
- **402 released games missing release dates** - business logic violation
- **1,218 games without publishers** - missing relationship data

---

## 1. Columns Always NULL (0% Populated)

These columns have never been populated and are candidates for removal or schema cleanup.

### apps table
| Column | Type | Rows | Status |
|--------|------|------|--------|
| `page_creation_date` | date | 157,695 | **Never populated** |
| `page_creation_date_raw` | text | 157,695 | **Never populated** |

### sync_status table
| Column | Type | Rows | Status |
|--------|------|------|--------|
| `last_steamspy_individual_fetch` | timestamptz | 157,695 | **Never populated** |

### publishers / developers tables
| Column | Type | Publishers | Developers | Status |
|--------|------|------------|------------|--------|
| `steam_vanity_url` | text | 0 | 0 | **Never populated** |
| `first_game_release_date` | date | 0 | 0 | **Never populated** |
| `first_page_creation_date` | date | 0 | 0 | **Never populated** |

### daily_metrics table
| Column | Type | Rows | Status |
|--------|------|------|--------|
| `recent_total_reviews` | integer | 0 of 1,070,489 | **Never populated** |
| `recent_positive` | integer | 0 of 1,070,489 | **Never populated** |
| `recent_negative` | integer | 0 of 1,070,489 | **Never populated** |
| `recent_score_desc` | text | 0 of 1,070,489 | **Never populated** |

**Recommendation:** Consider removing these columns if they're no longer part of the data model, or document the planned data source if they're intended for future use.

---

## 2. Columns Mostly NULL (>90% NULL)

These columns have low population rates and may need investigation.

### apps table
| Column | Populated | Percentage | Expected? |
|--------|-----------|------------|-----------|
| `parent_appid` | 338 | 0.21% | **Yes** - Only DLC/demos have parents |
| `metacritic_score` | 4,214 | 2.67% | **Yes** - Limited Metacritic coverage |
| `app_state` | 2,197 | 1.39% | Investigate |
| `metacritic_url` | 476 | 0.30% | **Yes** - Limited Metacritic coverage |
| `languages` | 22,039 | 13.98% | Could improve |
| `content_descriptors` | 35,104 | 22.26% | Could improve |
| `homepage_url` | 49,929 | 31.66% | **Yes** - Not all games have homepages |
| `controller_support` | 55,375 | 35.12% | Could improve |
| `pics_review_score` | 75,071 | 47.61% | Could improve |

### sync_status table
| Column | Populated | Percentage | Expected? |
|--------|-----------|------------|-----------|
| `velocity_calculated_at` | 3 | 0.00% | **Bug?** - Should be more |
| `last_known_total_reviews` | 8,605 | 5.46% | Investigate |
| `last_price_sync` | 9,469 | 6.00% | Investigate |
| `last_activity_at` | 22,171 | 14.06% | Investigate |
| `last_error_source` | 27,284 | 17.30% | **Yes** - Only populated on errors |
| `last_steamspy_sync` | 82,475 | 52.30% | **Yes** - SteamSpy doesn't cover all apps |

### daily_metrics table
| Column | Populated | Percentage | Expected? |
|--------|-----------|------------|-----------|
| `review_score` | 244,115 | 22.80% | **Investigate** - Should match apps with reviews |
| `review_score_desc` | 244,115 | 22.80% | Same as review_score |
| `price_cents` | 808,865 | 75.56% | **Investigate** - Missing for 24% of records |
| `ccu_peak` | 933,325 | 87.19% | SteamSpy coverage gap |
| `owners_min/max` | 933,325 | 87.19% | SteamSpy coverage gap |
| `average_playtime_*` | 933,325 | 87.19% | SteamSpy coverage gap |

---

## 3. Empty String vs NULL Inconsistencies

### apps table - Empty Strings Found

| Field | Empty Strings | NULLs | Issue |
|-------|---------------|-------|-------|
| `name` | **32** | 0 | **Data integrity issue** - Names should not be empty |
| `release_date_raw` | 369 | 374 | **Inconsistent** - Mix of empty and NULL |

### Sample of apps with empty names:
```
appid   | name | type | is_released
--------+------+------+------------
1216780 |      | game | true
1673310 |      | game | false
3665180 |      | game | false
1071920 |      | game | true
```

### Consistent NULL usage (no empty strings):
- `platforms` - 0 empty, 18,482 NULL (correct)
- `controller_support` - 0 empty, 102,320 NULL (correct)
- `homepage_url` - 0 empty, 107,766 NULL (correct)
- `release_state` - 0 empty, 7,257 NULL (correct)
- `app_state` - 0 empty, 155,498 NULL (correct)
- `review_score_desc` - 0 empty, 826,374 NULL (correct)

**Recommendation:**
1. Fix 32 apps with empty names - either populate or mark as invalid
2. Standardize `release_date_raw` to use NULL instead of empty strings

---

## 4. Required Fields with Unexpected NULLs

### Business Logic Violations

| Issue | Count | Impact |
|-------|-------|--------|
| Released games without `release_date` | 402 | Medium - Affects analytics/sorting |
| Released games without daily_metrics | 1 | Low - Single edge case (future release) |
| Games without publisher link | 1,218 | Medium - Missing relationship data |
| Games without developer link | 688 | Medium - Missing relationship data |
| Games without PICS tags | 519 | Low - May be very new/removed |
| Games without genres | 665 | Low - May be very new/removed |
| Games without categories | 1,770 | Low - May be very new/removed |

### Released game without metrics (edge case):
```sql
appid   | name            | release_date | is_released
--------+-----------------+--------------+------------
4077160 | The Predecessor | 2025-11-03   | true
```
Note: This appears to be a future release date that's already marked as released.

### Sample games without publishers:
Many are unreleased games or playtests - this may be acceptable for pre-release apps.

---

## 5. Impact Assessment

### High Priority (Data Integrity)
| Issue | Impact | Recommendation |
|-------|--------|----------------|
| 32 apps with empty names | Breaks UI/queries | Clean up or delete invalid records |
| velocity_calculated_at only has 3 values | Velocity system not working | Debug velocity calculation worker |
| 4 daily_metrics "recent" columns never populated | Wasted storage | Remove columns or implement population |

### Medium Priority (Data Quality)
| Issue | Impact | Recommendation |
|-------|--------|----------------|
| 402 released games missing release_date | Affects sorting/analytics | Run targeted sync for these apps |
| 1,218 games without publishers | Missing relationships | Re-sync from storefront |
| Inconsistent release_date_raw (empty vs NULL) | Query complexity | Normalize to NULL |

### Low Priority (Schema Cleanup)
| Issue | Impact | Recommendation |
|-------|--------|----------------|
| page_creation_date always NULL | Unused column | Drop or document future use |
| steam_vanity_url always NULL | Unused column | Drop or document future use |
| first_game_release_date always NULL | Unused column | Implement population or drop |
| last_steamspy_individual_fetch always NULL | Unused column | Drop or implement |

---

## 6. Column Population Summary by Table

### apps (157,695 rows)
| Population Rate | Columns |
|-----------------|---------|
| 100% | name, type, is_released, is_delisted, is_free, current_discount_percent, has_workshop, has_developer_info |
| 95-99% | release_state (95.4%), release_date_raw (99.8%) |
| 70-95% | platforms (88.3%), release_date (79.5%), current_build_id (72.1%), last_content_update (69.8%), current_price_cents (61.4%) |
| 30-70% | pics_review_score (47.6%), pics_review_percentage (47.6%), controller_support (35.1%), homepage_url (31.7%) |
| <30% | content_descriptors (22.3%), languages (14.0%), metacritic_score (2.7%), app_state (1.4%), metacritic_url (0.3%), parent_appid (0.2%) |
| 0% | page_creation_date, page_creation_date_raw |

### sync_status (157,695 rows)
| Population Rate | Columns |
|-----------------|---------|
| 100% | consecutive_errors, refresh_tier, storefront_accessible, steamspy_available, next_reviews_sync, reviews_interval_hours, review_velocity_tier, last_histogram_sync, last_reviews_sync, priority_score, velocity_7d, next_sync_after, sync_interval_hours |
| ~100% | last_storefront_sync (100%), priority_calculated_at (100%), last_pics_sync (99.8%), embedding_hash (99.6%), last_embedding_sync (99.6%) |
| 50-70% | last_page_creation_scrape (68.6%), last_steamspy_sync (52.3%) |
| <20% | last_error_source (17.3%), last_activity_at (14.1%), last_price_sync (6.0%), last_known_total_reviews (5.5%), velocity_calculated_at (0.0%) |
| 0% | last_steamspy_individual_fetch |

### daily_metrics (1,070,489 rows)
| Population Rate | Columns |
|-----------------|---------|
| 100% | total_reviews, positive_reviews, negative_reviews, discount_percent |
| 87% | ccu_peak, owners_min, owners_max, average_playtime_forever, average_playtime_2weeks |
| 75% | price_cents |
| 23% | review_score, review_score_desc |
| 0% | recent_total_reviews, recent_positive, recent_negative, recent_score_desc |

### publishers (89,769 rows)
| Population Rate | Columns |
|-----------------|---------|
| 100% | normalized_name, game_count |
| ~100% | embedding_hash (99.8%), last_embedding_sync (99.8%) |
| 0% | steam_vanity_url, first_game_release_date, first_page_creation_date |

### developers (105,091 rows)
| Population Rate | Columns |
|-----------------|---------|
| 100% | normalized_name, game_count |
| ~100% | embedding_hash (99.8%), last_embedding_sync (99.8%) |
| 0% | steam_vanity_url, first_game_release_date, first_page_creation_date |

---

## 7. Recommendations Summary

### Immediate Actions
1. **Fix 32 apps with empty names** - Query: `SELECT appid FROM apps WHERE name = ''`
2. **Investigate velocity_calculated_at** - Only 3 rows populated, should be 157K+
3. **Normalize release_date_raw** - Convert 369 empty strings to NULL

### Schema Cleanup (Next Sprint)
1. Consider dropping unused columns in daily_metrics: `recent_total_reviews`, `recent_positive`, `recent_negative`, `recent_score_desc`
2. Consider dropping unused columns in apps: `page_creation_date`, `page_creation_date_raw`
3. Consider dropping unused columns in publishers/developers: `steam_vanity_url`, `first_game_release_date`, `first_page_creation_date`
4. Consider dropping `last_steamspy_individual_fetch` from sync_status

### Data Sync Improvements
1. Re-run storefront sync for 402 released games without release dates
2. Investigate why 1,218 games have no publisher links
3. Improve PICS coverage for tags/genres/categories on 500-1,700 games

---

## Appendix: Queries Used

```sql
-- Find apps with empty names
SELECT appid, name, type, is_released FROM apps WHERE name = '';

-- Find released games without release_date
SELECT appid, name, is_released, release_date_raw
FROM apps
WHERE type = 'game' AND is_released = true AND release_date IS NULL
LIMIT 20;

-- Check velocity_calculated_at
SELECT COUNT(*) FROM sync_status WHERE velocity_calculated_at IS NOT NULL;

-- Find games without publishers
SELECT a.appid, a.name, a.is_released
FROM apps a
WHERE a.type = 'game'
AND NOT EXISTS (SELECT 1 FROM app_publishers ap WHERE ap.appid = a.appid)
ORDER BY a.release_date DESC NULLS LAST
LIMIT 20;
```
