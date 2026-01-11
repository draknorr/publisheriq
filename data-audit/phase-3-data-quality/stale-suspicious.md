# Phase 3.4: Stale & Suspicious Data Analysis

**Audit Date:** 2026-01-09
**Database:** PublisherIQ Supabase PostgreSQL

---

## Executive Summary

| Category | Status | Risk Level |
|----------|--------|------------|
| Stale Sync Records | Clean | Low |
| Future Timestamps | 2,904 apps with placeholder dates | Medium |
| Impossible Values | 15 apps with corrupt prices | High |
| Test Data in Production | 474 entities with test-like names | Low |
| Stuck Sync Jobs | 184 jobs stuck in 'running' status | Critical |
| Missing Expected Data | 139,123 games with zero CCU | Medium |
| Embedding Staleness | 374 entities without embeddings | Low |

---

## 1. Stale Sync Records

### Summary: Excellent
All apps have been synced recently. No stale sync records found.

| Metric | Count |
|--------|-------|
| Apps Never Synced | 0 |
| Stale Storefront (>30 days) | 0 |
| Stale Reviews (>30 days) | 0 |
| Apps with Consecutive Errors | 0 |

### Sync Timestamp Range

| Source | Oldest Sync | Most Recent Sync |
|--------|-------------|------------------|
| Storefront | 2025-12-30 00:59:48 UTC | 2026-01-09 23:22:18 UTC |
| Reviews | 2025-12-28 03:53:36 UTC | 2026-01-09 20:55:26 UTC |
| SteamSpy | 2025-12-30 04:00:15 UTC | 2026-01-09 18:38:14 UTC |
| PICS | 2025-12-29 09:27:01 UTC | 2026-01-09 23:21:46 UTC |

**Assessment:** The sync pipeline is operating within acceptable parameters. All sources have been active within the past 10 days.

---

## 2. Future Timestamps

### Apps with Future Release Dates: 2,904

These are likely placeholder dates set by developers for unreleased games.

**Sample of Extreme Future Dates:**

| AppID | Name | Release Date | Notes |
|-------|------|--------------|-------|
| 2201700 | Beyond The Lens | 9998-12-31 | Invalid placeholder |
| 2973000 | ZRAGG | 9000-05-29 | Invalid placeholder |
| 1706960 | The Mysterious Cat Tower | 6969-06-09 | Invalid placeholder |
| 1565070 | Aletheia: Return of Odysseus | 2099-12-31 | Far future placeholder |
| 2112370 | World of Yggdrasil | 2096-12-31 | Far future placeholder |
| 2418840 | Schoolmare | 2077-11-09 | Cyberpunk reference date |
| 1883930 | Donuts in Space | 2069-04-20 | Meme date |
| 1217950 | Dr Dick Dong: Stripper Underworld | 2052-03-01 | Placeholder |

### Other Timestamp Checks

| Check | Count | Status |
|-------|-------|--------|
| Future sync_status timestamps | 0 | Clean |
| Future daily_metrics dates | 0 | Clean |
| Future histogram months | 0 | Clean (current month is valid) |

**Assessment:** The 2,904 future release dates are expected for unreleased games. The extreme dates (year 9998, 6969) should be normalized to NULL or a standard placeholder.

**Recommendation:** Create a cleanup query to normalize dates > 2030-01-01 to NULL:
```sql
UPDATE apps
SET release_date = NULL
WHERE release_date > '2030-01-01';
```

---

## 3. Impossible/Suspicious Values

### Price Anomalies: HIGH RISK

**15 apps with prices > $1,000 (likely data corruption):**

| AppID | Name | Price (cents) | Price (dollars) | Expected Price |
|-------|------|--------------|-----------------|----------------|
| 1142710 | Total War: WARHAMMER III | 64,899,900 | $648,999.00 | ~$59.99 |
| 1245620 | ELDEN RING | 59,900,000 | $599,000.00 | ~$59.99 |
| 1086940 | Baldur's Gate 3 | 19,900,000 | $199,000.00 | ~$69.99 |
| 3668370 | Night Swarm | 1,100,000 | $11,000.00 | Unknown |
| 3761780 | Menhera Farm | 1,055,000 | $10,550.00 | Unknown |
| 2345770 | SuperPantsu Tentikun | 469,000 | $4,690.00 | Unknown |
| 3259600 | Atelier Resleriana | 420,000 | $4,200.00 | Unknown |
| 2358720 | Black Myth: Wukong | 359,900 | $3,599.00 | ~$59.99 |
| 2691920 | MolCollabo v2 | 190,000 | $1,900.00 | Unknown |
| 221100 | DayZ | 149,900 | $1,499.00 | ~$44.99 |
| 1203620 | Enshrouded | 139,900 | $1,399.00 | ~$29.99 |
| 227300 | Euro Truck Simulator 2 | 124,900 | $1,249.00 | ~$19.99 |
| 1244090 | Sea of Stars | 120,000 | $1,200.00 | ~$34.99 |
| 2240620 | UNBEATABLE | 110,000 | $1,100.00 | Unknown |
| 2753970 | MARVEL Cosmic Invasion | 106,300 | $1,063.00 | Unknown |

**Root Cause Analysis:** These appear to be foreign currency prices (possibly Korean Won or Japanese Yen) being stored without conversion to USD cents. For example:
- ELDEN RING at 59,900,000 cents could be 59,900 KRW (Korean Won) misinterpreted
- Total War at 64,899,900 could be similar currency confusion

**Recommendation:**
1. Investigate the price sync source for currency handling
2. Add validation to reject prices > $500 (50000 cents) as anomalies
3. Clean corrupt price data:
```sql
-- Identify and flag for manual review
SELECT appid, name, current_price_cents
FROM apps
WHERE current_price_cents > 50000
ORDER BY current_price_cents DESC;

-- Temporary fix: Set to NULL for re-sync
UPDATE apps SET current_price_cents = NULL
WHERE current_price_cents > 50000;
```

### Other Value Checks

| Check | Count | Status |
|-------|-------|--------|
| Negative prices | 0 | Clean |
| Negative review counts | 0 | Clean |
| Reviews that don't add up | 0 | Clean |
| Pre-Steam release dates (<2003) | 11 | Valid (legacy games added to Steam) |
| Impossibly high CCU (>5M) | 0 | Clean |

**Pre-Steam Games (Valid):**
- Counter-Strike (2000)
- Half-Life: Opposing Force (1999)
- POSTAL (1997)
- Carmageddon Max Pack (1997)
- Gothic 1 (2001)

These are legitimate games released before Steam existed that were later added to the platform.

---

## 4. Test Data in Production

### Apps with Test-Like Names: 353

Many are legitimate games with "test" in their title:
- "Dinolords Playtest" - Steam playtest feature
- "God Test" - Actual game title
- "Brain Test All-Star: IQ Boost" - Actual game
- "Dummy Life" - Actual game
- "The Faked" - Actual game

**Sample Suspicious Entries:**
- "TEST RE" (appid: 1704550)
- "A Test" (appid: 2448550)

### Publishers with Test-Like Names: 54

**Potentially Legitimate:**
- "Acid Test Games" - Likely real studio
- "TESTOSTERONE" - Likely real studio
- "Fake Boss" - Likely real studio

**Potentially Test Data:**
- "xiaocai_test" (id: 340309)
- "jackal_dev_test" (id: 11258)
- "TestOneDev" (id: 37411)
- "Placeholder Studios" (id: 50587)
- "PlaceholderBit" (id: 240997)

### Developers with Test-Like Names: 67

**Potentially Test Data:**
- "test" (id: 251307)
- "Test" (id: 15026)
- "jackal_dev_test" (id: 11774)
- "Studio Test Run" (id: 18708)

### User Profiles with Test Names: 0
No test user accounts found.

**Assessment:** Most "test" entries are legitimate games/studios. Only ~10-15 entries appear to be actual test data from Steam.

**Recommendation:** Low priority cleanup. These entities come from Steam's data and represent real (if oddly named) publishers/developers.

---

## 5. Sync Job Issues

### CRITICAL: 184 Stuck Jobs in 'running' Status

Jobs stuck for more than 2 hours (as of 2026-01-09):

| Job Type | Stuck Count | Oldest Stuck | Newest Stuck |
|----------|-------------|--------------|--------------|
| storefront | 172 | 2026-01-05 06:33 | 2026-01-08 22:45 |
| reviews | 8 | 2026-01-05 06:57 | 2026-01-09 18:06 |
| embedding | 4 | 2026-01-06 04:00 | 2026-01-09 04:00 |

**Root Cause:** Jobs are not being marked as completed or failed when they finish. This creates orphaned "running" records.

### Job Failure Rates

| Job Type | Total | Completed | Failed | Fail % |
|----------|-------|-----------|--------|--------|
| priority | 22 | 8 | 14 | 63.64% |
| steamspy | 19 | 10 | 9 | 47.37% |
| applist | 15 | 13 | 2 | 13.33% |
| embedding | 29 | 22 | 3 | 10.34% |
| histogram | 428 | 412 | 16 | 3.74% |
| storefront | 937 | 753 | 9 | 0.96% |
| reviews | 432 | 424 | 0 | 0.00% |
| trends | 13 | 13 | 0 | 0.00% |
| price | 18 | 18 | 0 | 0.00% |

**Critical Issues:**
1. **priority** job: 63.64% failure rate - needs investigation
2. **steamspy** job: 47.37% failure rate - likely rate limiting issues
3. **184 orphaned "running" jobs** - causing resource tracking issues

### Recent Failures by Type

| Job Type | Failed Count | Last Failure |
|----------|--------------|--------------|
| histogram | 16 | 2025-12-29 |
| priority | 14 | 2026-01-04 |
| storefront | 9 | 2026-01-05 |
| steamspy | 9 | 2025-12-29 |
| embedding | 3 | 2025-12-31 |
| applist | 2 | 2025-12-28 |

**Immediate Actions Required:**
```sql
-- Clean up stuck jobs older than 24 hours
UPDATE sync_jobs
SET status = 'failed',
    error_message = 'Auto-failed: Job exceeded maximum runtime',
    completed_at = NOW()
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '24 hours';

-- Verify cleanup
SELECT job_type, COUNT(*)
FROM sync_jobs
WHERE status = 'running'
GROUP BY job_type;
```

---

## 6. Missing Expected Data

### Games with Zero CCU (Always): 139,123

88.4% of apps with metrics have never recorded any concurrent users. This is expected behavior:
- Many games are DLC, demos, or defunct
- Small indie games may genuinely have 0 players
- CCU data may not be available for all games

### Apps Without Metrics: 1

Only 1 app (out of 157,695) lacks daily metrics entirely - excellent coverage.

### Old Released Games Without Metrics: 0

All released games from before 2020 have metric data.

**Assessment:** Data coverage is excellent. The high zero-CCU count reflects the reality of Steam's long-tail of inactive games.

---

## 7. Embedding Staleness

### Publishers Without Embeddings: 186
- Total publishers with games: 89,769
- Missing rate: 0.21%

### Developers Without Embeddings: 188
- Total developers with games: 105,091
- Missing rate: 0.18%

### Old Embeddings (>30 days): 0

All existing embeddings are fresh.

**Assessment:** Embedding coverage is excellent (>99.7%). The 374 missing entities are likely new additions awaiting the next embedding sync cycle.

---

## Risk Assessment Summary

| Issue | Risk | Impact | Priority | Effort |
|-------|------|--------|----------|--------|
| 184 Stuck Sync Jobs | Critical | Job tracking, resource management | P0 | Low |
| 15 Corrupt Prices | High | Incorrect analytics, bad UX | P1 | Low |
| 2,904 Future Dates | Medium | Minor UX issue | P2 | Low |
| 374 Missing Embeddings | Low | Search completeness | P3 | Auto-resolved |
| Test Data in Production | Low | Cosmetic | P4 | Low |
| Zero CCU Games | Info | Expected behavior | N/A | N/A |

---

## Recommended Cleanup Actions

### P0: Fix Stuck Jobs (Do Immediately)
```sql
-- Auto-fail stuck jobs
UPDATE sync_jobs
SET status = 'failed',
    error_message = 'Auto-failed: Job exceeded maximum runtime (24h)',
    completed_at = NOW()
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '24 hours';
```

### P1: Fix Corrupt Prices
```sql
-- Investigate and nullify corrupt prices for re-sync
UPDATE apps
SET current_price_cents = NULL,
    original_price_cents = NULL
WHERE current_price_cents > 50000;
```

### P2: Normalize Future Dates
```sql
-- Set extreme future dates to NULL
UPDATE apps
SET release_date = NULL,
    is_released = false
WHERE release_date > '2030-01-01';
```

### Process Improvements

1. **Add job timeout detection**: Implement 2-hour timeout auto-cleanup in sync workers
2. **Add price validation**: Reject prices > $500 during ingestion
3. **Add date validation**: Normalize dates > 2030 to NULL during ingestion
4. **Monitor job failure rates**: Alert when priority/steamspy exceed 20% failure rate

---

## Appendix: Query Reference

All queries used in this analysis are documented in the task specification and can be re-run for verification.
