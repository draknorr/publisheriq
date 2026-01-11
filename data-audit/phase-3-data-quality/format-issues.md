# Format Inconsistency Analysis

**Report Date:** January 9, 2026
**Database:** PublisherIQ Supabase PostgreSQL
**Scope:** Format variations, case inconsistencies, whitespace issues, and data standardization analysis

---

## Executive Summary

This analysis examines format inconsistencies across the PublisherIQ database, identifying issues that may impact data quality, querying accuracy, and user experience. Key findings include:

- **32,210 unparseable release dates** (20.5% of apps with raw dates)
- **46 apps with platform order variations** requiring standardization
- **149 apps** with leading/trailing whitespace in names
- **40 homepage URLs** missing protocol prefix
- **22 publishers and 27 developers** with numeric-only names

---

## 1. Date Format Inconsistencies

### 1.1 Release Date Raw Formats

**Total apps with raw dates:** 157,321
**Total apps with parsed dates:** 125,390
**Unparseable release dates:** 32,210 (20.5%)

#### Format Variations Found

| Format Type | Example | Count | Parseable |
|------------|---------|-------|-----------|
| Full date | "Oct 23, 2025" | ~100,000+ | Yes |
| Coming Soon | "Coming soon" | 19,772 | No |
| To Be Announced | "To be announced" | 10,917 | No |
| Year only | "2026" | 3,610 | Partially |
| Quarter | "Q1 2026" | 1,561 | No |
| Month + Year | "March 2026" | 291+ | Partially |
| Empty string | "" | 369 | No |

#### Unparseable Date Breakdown

| Category | Count | % of Unparseable |
|----------|-------|------------------|
| Coming soon | 19,740 | 61.3% |
| To be announced | 10,916 | 33.9% |
| Empty/blank | 369 | 1.1% |
| Future date formats (year/quarter/month) | 1,185 | 3.7% |

**Severity:** MEDIUM
**Impact:** Analytics queries for release date trends exclude ~20% of apps. Future games are difficult to query programmatically.

### 1.2 Page Creation Date Raw

**Total with raw dates:** 0
**Unparseable:** 0

**Status:** This field appears unused in the database.

---

## 2. Case Inconsistencies in Categorical Data

### 2.1 Platform Values

| Value | Count | Notes |
|-------|-------|-------|
| windows | 107,834 | Correct format |
| windows,macos,linux | 13,367 | Correct format |
| windows,macos | 12,129 | Correct format |
| windows,linux | 5,781 | Correct format |
| **macos,windows** | **43** | **Wrong order** |
| macos | 41 | Correct |
| linux | 12 | Correct |
| **macos,windows,linux** | **3** | **Wrong order** |
| windows,android | 2 | Edge case |
| macos,linux | 1 | Correct |

**Severity:** LOW
**Impact:** 46 apps (0.03%) have non-canonical platform ordering. Queries filtering by exact platform string would miss these.

**Recommendation:** Standardize to alphabetical order or canonical `windows,macos,linux` order.

### 2.2 Controller Support

| Value | Count | Notes |
|-------|-------|-------|
| full | 37,991 | Consistent |
| partial | 17,383 | Consistent |
| none | 1 | Anomaly |

**Severity:** NEGLIGIBLE
**Impact:** Values are consistent. Single "none" value may be intentional.

### 2.3 Release State

| Value | Count | Notes |
|-------|-------|-------|
| released | 112,290 | Consistent |
| prerelease | 38,147 | Consistent |
| disabled | 1 | Edge case |

**Severity:** NEGLIGIBLE
**Impact:** Values are well-standardized.

### 2.4 App State (PICS Data)

| Value | Count | Notes |
|-------|-------|-------|
| eStateAvailable | 1,902 | Normal |
| eStateComingSoonNoPreload | 279 | Normal |
| eStateUnAvailable | 4 | Normal |
| eStateTool | 4 | Normal |
| eStateJustReleased | 3 | Normal |
| eStateAvailablePreloadable | 1 | Normal |
| eStatePreloadOnly | 1 | Normal |
| **eStateAvailablea** | **1** | **Typo?** |
| **eStateComingAvailable** | **1** | **Unusual** |
| **eStateUnavailable** | **1** | **Case variant** |

**Severity:** LOW
**Impact:** 3 potentially malformed values:
- `eStateAvailablea` - appears to be a typo of `eStateAvailable`
- `eStateUnavailable` vs `eStateUnAvailable` - case inconsistency
- `eStateComingAvailable` - non-standard state

---

## 3. Whitespace Issues

### 3.1 Entity Names with Leading/Trailing Whitespace

| Entity | Count | % of Total |
|--------|-------|------------|
| Apps | 149 | 0.09% |
| Publishers | 0 | 0% |
| Developers | 0 | 0% |
| Franchises | 0 | 0% |
| Steam Tags | 2 | <1% |

**Sample App Names with Whitespace:**
- " Lost Liminal" (leading space)
- "Surreal Deal " (trailing space)
- "VR Long March " (trailing space)
- "SKETCHY MASSAGE " (trailing space)

**Tags with Whitespace:**
- "Parody " (trailing space, length 7)
- "Dystopian " (trailing space, length 10)

**Severity:** LOW
**Impact:** Search queries may not match these entries. String comparisons become inconsistent.

**Recommendation:** Run cleanup query:
```sql
UPDATE apps SET name = TRIM(name) WHERE name != TRIM(name);
UPDATE steam_tags SET name = TRIM(name) WHERE name != TRIM(name);
```

---

## 4. URL Format Issues

### 4.1 Homepage URLs

**Total with homepage URLs:** ~10,000+
**Missing http/https prefix:** 40

**Sample Invalid URLs:**
```
herebedragonz.com
light-echo.pl
playrushbros.com
www.ackkstudios.com
www.callofduty.com
www.depressionquest.com
```

**Severity:** LOW
**Impact:** URLs cannot be used as direct links without prepending protocol.

**Recommendation:** Add `https://` prefix:
```sql
UPDATE apps
SET homepage_url = 'https://' || homepage_url
WHERE homepage_url IS NOT NULL
  AND homepage_url NOT LIKE 'http%';
```

### 4.2 Metacritic URLs

**Total Metacritic URLs:** 476
**Format:** Relative paths (e.g., `pc/borderlands`)

| Pattern | Count | Notes |
|---------|-------|-------|
| Empty string | 5 | Should be NULL |
| Valid paths | ~470 | Intentionally relative |
| Query strings | 1 | `pc/ageofwondersshadowmagic?q=age of wonders` |

**Severity:** NEGLIGIBLE
**Impact:** URLs are intentionally stored as relative paths. Application layer must prepend base URL.

### 4.3 Steam Vanity URLs (Publishers)

**Total:** 0

**Status:** This field is not populated.

---

## 5. Name Format Anomalies

### 5.1 Numeric-Only Names

| Entity | Count | Examples |
|--------|-------|----------|
| Publishers | 22 | "1704", "107", "3193", "01010101", "2816292563" |
| Developers | 27 | "93", "773", "0", "2015", "460" |

**Severity:** MEDIUM
**Impact:** These appear to be Steam internal IDs or placeholder values rather than actual company names. They pollute search results and analytics.

**Recommendation:** Flag these for manual review or mark as `needs_review`:
```sql
-- Publishers with numeric-only names
SELECT id, name FROM publishers WHERE name ~ '^[0-9]+$';
```

### 5.2 Non-ASCII Characters

| Entity | Count with Non-ASCII |
|--------|---------------------|
| Publishers | 4,331 |

**Severity:** INFORMATIONAL
**Impact:** These are legitimate international publisher/developer names (Chinese, Japanese, Korean, Polish, etc.). This is expected behavior for a global platform.

**Examples:**
- Chinese: "一只零零发工作室", "上海狂暴网络科技有限公司"
- Japanese: "IEOIサイコスリラーホラー研究所"
- Korean: "처음 만든 게임회사"
- Polish: "Adam Stepiński"
- German with special chars: "Gameforge 4D GmbH‬"

### 5.3 Very Short Names (< 3 characters)

| Entity | Count | Examples |
|--------|-------|----------|
| Publishers | 425 | "8i", "D6", "GJ", "QG", "Lx", "ac", "NP", "PM" |
| Developers | 530 | "Aq", "CH", "Ry", "NS", "WP", "VN", "VS", "IW" |

**Note:** Many short names are valid 2-character Chinese names ("八萩", "文若", "海鸣") which are legitimate.

**Severity:** LOW
**Impact:** Some may be placeholder values or abbreviations, but many are valid Asian names.

### 5.4 Very Long Names (> 200 characters)

| Count | Example |
|-------|---------|
| 2 | 498-character multilingual game title |
| - | 250-character English game title |

**Examples:**
1. Multi-language title (498 chars): Contains Chinese, Japanese, Korean, Russian, German translations in single name field
2. Long English title (250 chars): "Shattered Dreams: that one time when all my applications got rejected..."

**Severity:** LOW
**Impact:** UI display issues possible. These appear to be intentional stylistic choices by developers.

---

## 6. Review Score Consistency

### 6.1 Score Distribution

| Score | Description | Count | Status |
|-------|-------------|-------|--------|
| 0 | No/insufficient reviews | 183,496 | Correct |
| 1 | Overwhelmingly Negative | 5 | Correct |
| 2 | Very Negative | 44 | Correct |
| 3 | Negative | 265 | Correct |
| 4 | Mostly Negative | 1,691 | Correct |
| 5 | Mixed | 12,522 | Correct |
| 6 | Mostly Positive | 10,034 | Correct |
| 7 | Positive | 18,171 | Correct |
| 8 | Very Positive | 16,239 | Correct |
| 9 | Overwhelmingly Positive | 1,648 | Correct |

### 6.2 Score-Description Mapping

All score values correctly map to their expected descriptions:

| Score | Expected Description | Actual Description | Match |
|-------|---------------------|-------------------|-------|
| 0 | No user reviews / N reviews | Multiple descriptions | Expected |
| 1 | Overwhelmingly Negative | Overwhelmingly Negative | Yes |
| 2 | Very Negative | Very Negative | Yes |
| 3 | Negative | Negative | Yes |
| 4 | Mostly Negative | Mostly Negative | Yes |
| 5 | Mixed | Mixed | Yes |
| 6 | Mostly Positive | Mostly Positive | Yes |
| 7 | Positive | Positive | Yes |
| 8 | Very Positive | Very Positive | Yes |
| 9 | Overwhelmingly Positive | Overwhelmingly Positive | Yes |

**Note:** Score 0 has multiple description values representing review count thresholds:
- "No user reviews"
- "1 user reviews" through "9 user reviews"

**Severity:** NEGLIGIBLE
**Impact:** Score-to-description mapping is consistent and correct.

---

## 7. Job Type and Status Consistency

### 7.1 Job Types

| Job Type | Count | Expected | Status |
|----------|-------|----------|--------|
| storefront | 937 | Yes | Valid |
| scraper | 475 | Yes | Valid |
| reviews | 432 | Yes | Valid |
| histogram | 428 | Yes | Valid |
| embedding | 29 | Yes | Valid |
| priority | 22 | Yes | Valid |
| steamspy | 19 | Yes | Valid |
| price | 18 | Yes | Valid |
| applist | 15 | Yes | Valid |
| trends | 13 | Yes | Valid |
| velocity-calc | 3 | Yes | Valid |
| refresh_views | 3 | Yes | Valid |

**Note:** All job types are documented in CLAUDE.md and match expected worker names.

### 7.2 Job Statuses

| Status | Count | Notes |
|--------|-------|-------|
| completed | 2,151 | Normal |
| running | 187 | May include stale jobs |
| failed | 53 | Expected failures |
| completed_with_errors | 3 | Partial success |

**Severity:** INFORMATIONAL
**Impact:** 187 jobs in "running" status may include stale jobs (>2 hour timeout). This is documented as expected behavior with cleanup mechanisms.

---

## Summary of Issues by Severity

### HIGH SEVERITY
*None identified*

### MEDIUM SEVERITY
| Issue | Count | Recommendation |
|-------|-------|----------------|
| Unparseable release dates | 32,210 | Parse "Coming soon" and "To be announced" as NULL release_date with a flag |
| Numeric-only publisher/developer names | 49 | Flag for manual review |

### LOW SEVERITY
| Issue | Count | Recommendation |
|-------|-------|----------------|
| App names with whitespace | 149 | TRIM cleanup |
| Tags with whitespace | 2 | TRIM cleanup |
| Platform order inconsistency | 46 | Standardize order |
| Homepage URLs missing protocol | 40 | Prepend https:// |
| Malformed app_state values | 3 | Manual review |
| Very short publisher/developer names | 955 | Review (many are valid Asian names) |

### NEGLIGIBLE/INFORMATIONAL
| Issue | Notes |
|-------|-------|
| Non-ASCII publisher names | Expected for international publishers |
| Very long game names | Intentional stylistic choices |
| Review score consistency | Perfect mapping |
| Job types/statuses | Consistent with documentation |

---

## Recommended Actions

### Immediate (Automated Fix)
```sql
-- 1. Trim whitespace from app names
UPDATE apps SET name = TRIM(name) WHERE name != TRIM(name);

-- 2. Trim whitespace from tags
UPDATE steam_tags SET name = TRIM(name) WHERE name != TRIM(name);

-- 3. Fix homepage URLs missing protocol
UPDATE apps
SET homepage_url = 'https://' || homepage_url
WHERE homepage_url IS NOT NULL
  AND homepage_url NOT LIKE 'http%';

-- 4. Standardize platform ordering (example)
UPDATE apps
SET platforms = 'macos,windows'
WHERE platforms = 'windows,macos';
-- (Repeat for other variations)
```

### Short-term (Manual Review Required)
1. Review 49 numeric-only publisher/developer names
2. Review 3 malformed app_state values
3. Consider adding `is_unreleased` flag for "Coming soon" and "To be announced" games

### Long-term (System Improvements)
1. Add validation constraints for new data:
   - Platform values should use consistent ordering
   - Homepage URLs should include protocol
   - Entity names should be trimmed on insert
2. Create materialized view for "upcoming games" based on release_date patterns
3. Document expected format variations in data dictionary

---

*Report generated: January 9, 2026*
