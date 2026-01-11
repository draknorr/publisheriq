# Phase 3.1: Duplicate Detection Analysis

**Generated:** January 9, 2026
**Database:** PublisherIQ Supabase PostgreSQL

---

## Executive Summary

The duplicate analysis reveals several categories of data quality issues in the PublisherIQ database. While the overall percentage of duplicates is relatively low (1-2%), the absolute numbers represent thousands of records that could impact data integrity, analytics accuracy, and user experience.

### Key Findings

| Entity | Duplicate Groups | Duplicate Records | Total Records | % Duplicated | Games Affected |
|--------|------------------|-------------------|---------------|--------------|----------------|
| Publishers (case-insensitive) | 807 | 1,635 | 89,769 | 1.82% | 5,975 |
| Developers (case-insensitive) | 983 | 1,989 | 105,091 | 1.89% | 4,793 |
| Franchises (case-insensitive) | 130 | 267 | 13,308 | 2.01% | 1,552 |
| Apps (same name) | 1,606 | 3,581 | 157,695 | 2.27% | 3,581 |
| Apps (whitespace) | - | 149 | 157,695 | 0.09% | 149 |

**Apps with both publisher AND developer case duplicates:** 2,593

---

## 1. Duplicate Detection Results by Category

### 1.1 Core Tables - No Exact Duplicates (Good)

The following tables have proper unique constraints and contain **no duplicate rows**:

- **daily_metrics**: No duplicate (appid, metric_date) combinations
- **review_histogram**: No duplicate (appid, month_start) combinations
- **app_publishers**: No duplicate (appid, publisher_id) combinations
- **app_developers**: No duplicate (appid, developer_id) combinations
- **app_steam_tags**: No duplicate (appid, tag_id) combinations
- **steam_tags**: No case-insensitive duplicates

### 1.2 Apps with Same Name (Different AppIDs)

**Status:** LEGITIMATE - Not a data quality issue

Apps sharing the same name are **different games** from different developers/publishers. This is expected behavior on Steam where game names are not unique.

**Examples:**

| Name | Count | AppIDs |
|------|-------|--------|
| (empty) | 32 | Various - see empty name section |
| No Way Out | 7 | Different publishers: Fiassink Games, bati, BitPixel Studios, etc. |
| The Tower | 6 | Different publishers: Narrow Monolith, Headroom.one, Immotion Studio, etc. |
| Escape | 6 | Different publishers: Stephane Bottin, Ragdoll Inc, CheYne_CY, etc. |
| Prism | 6 | Various indie developers |
| Aurora | 6 | Various developers (2017-2022) |
| Arena | 5 | Surreal Games (2017), FX GAMES (2019), Clay Peterson (2020), etc. |

**Detailed Example - "Arena":**
```
appid   | release_date | publisher
--------+--------------+--------------------------------
655200  | 2017-08-01   | Surreal Games
717300  | 2019-05-17   | FX GAMES
1291530 | 2020-05-19   | Clay Peterson
3204430 | 2025-05-13   | Deep Water Depth Studios
3775400 | 2025-06-21   | 30 Minute Games
```

**Conclusion:** These are distinct products that happen to share common names. No cleanup needed.

### 1.3 Apps with Empty Names

**Status:** DATA QUALITY ISSUE - Requires Investigation

Found **32 apps** with empty/null names. These appear to be apps that were added to Steam but never fully configured or were removed.

**Sample of empty-name apps:**
```
appid   | type | release_date
--------+------+--------------
1216780 | game | 2020-03-03
506630  | game | 2016-09-16
460250  | game | 2017-02-17
576960  | game | 2018-07-19
```

**Impact:** Low - These apps likely have no user-facing presence and may be internal/test entries.

### 1.4 Apps with Whitespace Issues

**Status:** DATA QUALITY ISSUE - Requires Cleanup

Found **149 apps** with leading or trailing whitespace in names.

**Breakdown by issue type:**
- **Trailing space:** ~90% of issues
- **Leading space:** ~8% of issues
- **Both:** ~2% of issues

**Examples:**

| AppID | Name (quoted) | Issue Type |
|-------|---------------|------------|
| 1886110 | "Surreal Deal " | trailing space |
| 3491960 | " Lost Liminal" | leading space |
| 681840 | " Chinese PaladinSword and Fairy 5 Prequel" | leading space |
| 3889860 | " Ash Survival " | both |

**Impact:** Medium - Causes inconsistent display and search issues.

---

## 2. Publisher Case-Insensitive Duplicates

**Status:** DATA QUALITY ISSUE - Significant Impact

Found **807 unique publisher names** that exist in multiple case variants, affecting **5,975 games**.

### Examples with Game Distribution

| lower_name | Variants | IDs | Game Counts |
|------------|----------|-----|-------------|
| redduckstudio | redduckstudio, Redduckstudio, RedDuckStudio | 32333, 41266, 117673 | Varies |
| storytaco | Storytaco, storytaco, STORYTACO | 13891, 112239, 112626 | Varies |
| indie | Indie, indie, INDIE | 4294, 56342, 111578 | Generic placeholder |
| real co.ltd | REAL co.Ltd, Real Co.Ltd, REAL Co.Ltd | 19199, 272528, 281028 | Varies |
| self published | Self Published, Self published, self published | 10379, 20007, 314248 | Placeholder |
| firefly studios | Firefly Studios, FireFly Studios | 1907, 272120 | 12 + 2 = 14 games |
| titanium armor | TITANIUM ARMOR, Titanium Armor | 17708, 10474 | 10 + 5 = 15 games |

### Specific Case Study: Firefly Studios

```
ID      | Name            | game_count | actual_games
--------+-----------------+------------+--------------
1907    | Firefly Studios |         12 |           12
272120  | FireFly Studios |          2 |            2
```

These should be merged into a single publisher entity with 14 games total.

### Common Patterns in Publisher Duplicates

1. **Legitimate publishers with case variants:** Professional studios that appear differently due to source data variations (e.g., Firefly Studios / FireFly Studios)
2. **Placeholder names:** "Self Published", "Indie", "N/A", "Self" - these are data quality issues from self-publishing
3. **Asian character handling:** Some entries have multiple romanization styles
4. **Punctuation variations:** "Co.Ltd" vs "Co. Ltd" vs "co.ltd"

---

## 3. Developer Case-Insensitive Duplicates

**Status:** DATA QUALITY ISSUE - Significant Impact

Found **983 unique developer names** that exist in multiple case variants, affecting **4,793 games**.

### Examples

| lower_name | Variants | IDs |
|------------|----------|-----|
| grandma studios | GrandMA Studios, Grandma Studios, GrandMa Studios, GrandMa studios | 10215, 34395, 114402, 378645 |
| seikagames | SeikaGames, Seikagames, seikagames | 42536, 52774, 58474 |
| kagami works | Kagami Works, KAGAMI WORKs, KAGAMI WORKS | 53543, 344325, 365046 |
| microprose | Microprose, MIcroprose, MicroProse | 7856, 278413, 357305 |
| alicesoft | Alicesoft, ALICESOFT, AliceSoft | 30488, 226695, 253316 |

### Notable Developer Example: Grandma Studios (4 variants)

```
ID      | Name              | Associated Games
--------+-------------------+------------------
10215   | GrandMA Studios   | Multiple
34395   | Grandma Studios   | Multiple
114402  | GrandMa Studios   | Multiple
378645  | GrandMa studios   | Fewer
```

---

## 4. Franchise Case-Insensitive Duplicates

**Status:** DATA QUALITY ISSUE - Moderate Impact

Found **130 franchise names** with case variants, affecting **1,552 apps**.

### Examples

| lower_name | Variants |
|------------|----------|
| hitman | Hitman, HITMAN |
| battlefield | Battlefield, BATTLEFIELD |
| dragon quest | DRAGON QUEST, Dragon Quest |
| star wars | Star Wars, STAR WARS |
| need for speed | Need for Speed, Need For Speed |
| mothergunship | MOTHERGUNSHIP, Mothergunship |
| colonial defence force | Colonial defence force, Colonial Defence Force, Colonial defence Force |

These are major gaming franchises that should have consistent naming.

---

## 5. Impact Assessment

### High Impact Issues

| Issue | Records | Games Affected | Business Impact |
|-------|---------|----------------|-----------------|
| Publisher duplicates | 1,635 | 5,975 | Fragmented analytics, incorrect portfolio counts |
| Developer duplicates | 1,989 | 4,793 | Fragmented analytics, incorrect portfolio counts |
| Apps with both pub/dev duplicates | - | 2,593 | Compounded analytics issues |

### Medium Impact Issues

| Issue | Records | Business Impact |
|-------|---------|-----------------|
| Franchise duplicates | 267 | Series tracking fragmented |
| App whitespace | 149 | Search and display inconsistencies |

### Low Impact Issues

| Issue | Records | Business Impact |
|-------|---------|-----------------|
| Empty app names | 32 | Likely defunct entries |
| Same app names | 3,581 | Legitimate - no action needed |

---

## 6. Cleanup Recommendations

### Priority 1: Publisher & Developer Deduplication (HIGH)

**Problem:** 807 publisher and 983 developer duplicates fragment analytics.

**Recommended Approach:**
1. Create a canonical name lookup table
2. Identify the "primary" record for each duplicate group (most games, earliest created)
3. Update `app_publishers` and `app_developers` to point to primary records
4. Archive or soft-delete secondary records
5. Add case-insensitive unique constraint or trigger

**SQL Strategy for Merging:**
```sql
-- Step 1: Identify merge targets
WITH merge_candidates AS (
  SELECT LOWER(name) as canonical,
         MIN(id) as primary_id,
         array_agg(id ORDER BY game_count DESC) as all_ids
  FROM publishers
  GROUP BY LOWER(name)
  HAVING COUNT(*) > 1
)
-- Step 2: Would update app_publishers to use primary_id
-- Step 3: Would delete or archive non-primary records
```

**Estimated Effort:** 2-4 hours
**Risk:** Medium - requires careful data migration

### Priority 2: App Name Whitespace Cleanup (MEDIUM)

**Problem:** 149 apps have leading/trailing whitespace.

**Recommended Fix:**
```sql
UPDATE apps
SET name = TRIM(name), updated_at = NOW()
WHERE name <> TRIM(name);
```

**Estimated Effort:** 15 minutes
**Risk:** Low - simple text cleanup

### Priority 3: Franchise Deduplication (MEDIUM)

**Problem:** 130 franchise names with case variants.

**Recommended Approach:** Similar to publisher/developer deduplication.

**Estimated Effort:** 1-2 hours
**Risk:** Low - smaller dataset

### Priority 4: Empty App Names Investigation (LOW)

**Problem:** 32 apps with empty names.

**Recommended Action:**
1. Query Steam API for these appids to verify status
2. Mark as `storefront_accessible = false` if delisted
3. Consider adding to exclusion list

**Estimated Effort:** 30 minutes
**Risk:** Very low

---

## 7. Prevention Recommendations

### Database-Level Constraints

1. **Case-insensitive unique indexes:**
```sql
CREATE UNIQUE INDEX publishers_name_lower_idx
ON publishers (LOWER(name));

CREATE UNIQUE INDEX developers_name_lower_idx
ON developers (LOWER(name));

CREATE UNIQUE INDEX franchises_name_lower_idx
ON franchises (LOWER(name));
```

2. **Whitespace trimming trigger:**
```sql
CREATE OR REPLACE FUNCTION trim_name_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name := TRIM(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER apps_trim_name
BEFORE INSERT OR UPDATE ON apps
FOR EACH ROW EXECUTE FUNCTION trim_name_fields();
```

### Ingestion Pipeline Changes

1. **Normalize names at ingestion:** Apply TRIM() and consistent casing rules
2. **Lookup before insert:** Check for existing case-variant records before creating new publishers/developers
3. **Canonical name mapping:** Maintain a mapping table for known variations

---

## 8. Summary Statistics

```
CLEAN TABLES (No duplicates):
- daily_metrics: OK
- review_histogram: OK
- app_publishers (junction): OK
- app_developers (junction): OK
- app_steam_tags (junction): OK
- steam_tags: OK

TABLES WITH DUPLICATES:
- publishers: 1.82% (807 groups, 1,635 records)
- developers: 1.89% (983 groups, 1,989 records)
- franchises: 2.01% (130 groups, 267 records)
- apps (whitespace): 0.09% (149 records)
- apps (empty name): 0.02% (32 records)

TOTAL UNIQUE GAMES AFFECTED: ~8,000-10,000 (estimates overlap)
```

---

## Appendix: Query Reference

All queries used in this analysis are documented in the task specification and can be re-run for ongoing monitoring.

### Quick Health Check Query

```sql
SELECT
  'Publishers (case dupes)' as issue,
  COUNT(*) as groups
FROM (
  SELECT LOWER(name) FROM publishers
  GROUP BY LOWER(name) HAVING COUNT(*) > 1
) t
UNION ALL
SELECT 'Developers (case dupes)', COUNT(*) FROM (
  SELECT LOWER(name) FROM developers
  GROUP BY LOWER(name) HAVING COUNT(*) > 1
) t
UNION ALL
SELECT 'Franchises (case dupes)', COUNT(*) FROM (
  SELECT LOWER(name) FROM franchises
  GROUP BY LOWER(name) HAVING COUNT(*) > 1
) t
UNION ALL
SELECT 'Apps (whitespace)', COUNT(*)
FROM apps WHERE name <> TRIM(name);
```
