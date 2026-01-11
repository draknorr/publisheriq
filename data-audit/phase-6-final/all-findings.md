# Complete Findings Compilation
## PublisherIQ Data Infrastructure Audit

**Generated:** January 9, 2026

---

## Table of Contents

1. [Security Issues](#1-security-issues)
2. [Data Quality Issues](#2-data-quality-issues)
3. [Database Health Issues](#3-database-health-issues)
4. [Code & Usage Issues](#4-code--usage-issues)
5. [Retention & Compliance Issues](#5-retention--compliance-issues)

---

## 1. Security Issues

### CRITICAL

| ID | Finding | Location | Impact | Effort |
|----|---------|----------|--------|--------|
| SEC-01 | **Waitlist SELECT policy allows reading ALL entries** | `waitlist` table RLS | Anyone can read all applicant emails, names, use cases | Quick |
| SEC-02 | **chat_query_logs publicly readable** | `chat_query_logs` RLS | User prompts visible to anyone | Quick |
| SEC-03 | **DELETE/TRUNCATE granted to anon role** | `user_profiles`, `credit_transactions`, `waitlist`, `rate_limit_state` | Anonymous users could delete/truncate sensitive tables | Quick |

**Fix for SEC-01:**
```sql
DROP POLICY IF EXISTS "Public can select own waitlist entry" ON waitlist;
CREATE POLICY "Users can select own waitlist entry" ON waitlist
  FOR SELECT USING (email = auth.jwt() ->> 'email');
```

**Fix for SEC-02:**
```sql
DROP POLICY IF EXISTS "Allow public read access" ON chat_query_logs;
CREATE POLICY "Users can read own logs" ON chat_query_logs
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
```

**Fix for SEC-03:**
```sql
REVOKE DELETE, TRUNCATE ON user_profiles, credit_transactions,
  credit_reservations, waitlist, rate_limit_state, chat_query_logs
FROM anon, authenticated;
```

### HIGH

| ID | Finding | Location | Impact | Effort |
|----|---------|----------|--------|--------|
| SEC-04 | **User deletion blocked by FK constraint** | `chat_query_logs.user_id` | Cannot comply with GDPR/CCPA "right to be forgotten" | Moderate |
| SEC-05 | **No rate limiting on email validation endpoint** | `/api/auth/validate-email` | Email enumeration attacks possible | Moderate |
| SEC-06 | **rate_limit_state has RLS enabled but no policies** | `rate_limit_state` table | Relying entirely on SECURITY DEFINER functions | Quick |

### MEDIUM

| ID | Finding | Location | Impact | Effort |
|----|---------|----------|--------|--------|
| SEC-07 | **Legacy chat routes lack auth checks** | `/api/chat/route.ts`, `/api/chat/cube-route.ts` | Potential unauthorized access (may be unused) | Quick |
| SEC-08 | **Production credentials in local .env files** | `/.env`, `/apps/admin/.env.local` | Developers using prod data locally | Quick |

### LOW

| ID | Finding | Location | Impact | Effort |
|----|---------|----------|--------|--------|
| SEC-09 | **No environment validation schema** | TypeScript codebase | Missing env vars cause runtime errors | Moderate |
| SEC-10 | **Missing .env.example in root and apps/admin** | Project root | Onboarding friction | Quick |

---

## 2. Data Quality Issues

### HIGH

| ID | Finding | Location | Count | Effort |
|----|---------|----------|-------|--------|
| DQ-01 | **15 games have corrupt prices** (ELDEN RING: $599K) | `apps.current_price_cents` | 15 | Quick |
| DQ-02 | **184 sync jobs stuck in "running" status** | `sync_jobs` | 184 | Quick |
| DQ-03 | **1,790 publisher/developer duplicates** (case variants) | `publishers`, `developers` | 1,790 | Moderate |

**Corrupt price examples:**
- ELDEN RING: $599,000 (should be ~$60)
- Baldur's Gate 3: $199,000 (should be ~$70)
- Total War: WARHAMMER III: $648,999 (should be ~$60)

### MEDIUM

| ID | Finding | Location | Count | Effort |
|----|---------|----------|-------|--------|
| DQ-04 | **32 apps have empty string names** | `apps.name` | 32 | Quick |
| DQ-05 | **149 apps have whitespace in names** | `apps.name` | 149 | Quick |
| DQ-06 | **2,904 apps with placeholder release dates** (year 9998, 6969) | `apps.release_date` | 2,904 | Quick |
| DQ-07 | **402 released games missing release_date** | `apps` WHERE `is_released=true` | 402 | Moderate |
| DQ-08 | **15,717 review score mismatches** | `apps.pics_review_score` vs `daily_metrics.review_score` | 15,717 | Major |
| DQ-09 | **130 franchise duplicates** (case variants) | `franchises` | 130 | Moderate |

### LOW

| ID | Finding | Location | Count | Effort |
|----|---------|----------|-------|--------|
| DQ-10 | **49 entities with numeric-only names** | `publishers`, `developers` | 49 | Quick |
| DQ-11 | **2 apps with extremely long names** (250-498 chars) | `apps.name` | 2 | Quick |
| DQ-12 | **474 entities with test-like names** | Various | 474 | Quick |

---

## 3. Database Health Issues

### HIGH

| ID | Finding | Location | Size/Count | Effort |
|----|---------|----------|------------|--------|
| DB-01 | **313 MB of unused indexes** (96 indexes with <10 scans) | Various tables | 313 MB | Moderate |
| DB-02 | **daily_metrics growing unbounded** (~90K rows/day) | `daily_metrics` | 1M+ rows | Moderate |
| DB-03 | **Histogram N+1 queries** (36 DB calls per app) | `histogram-worker.ts` | 36x overhead | Moderate |

**Largest unused indexes:**
- `idx_review_histogram_appid_month`: 85 MB (duplicate of unique constraint)
- `review_histogram_pkey`: 62 MB (unused surrogate key)
- `daily_metrics_pkey`: 27 MB (unused surrogate key)
- `idx_app_steam_tags_created_at`: 22 MB (never scanned)

### MEDIUM

| ID | Finding | Location | Size/Count | Effort |
|----|---------|----------|------------|--------|
| DB-04 | **Table bloat** (14-16% dead tuples) | `app_categories`, `*_game_metrics` | ~35 MB | Quick |
| DB-05 | **Duplicate indexes on publishers/developers** | `idx_*_embedding_needed` vs `idx_*_needs_embedding` | 4 indexes | Quick |
| DB-06 | **sync_jobs has no retention policy** | `sync_jobs` | 2,400+ rows | Quick |
| DB-07 | **CCU tier peak staleness** (38% drift) | `ccu_tier_assignments.recent_peak_ccu` | All rows | Moderate |

### LOW

| ID | Finding | Location | Size/Count | Effort |
|----|---------|----------|------------|--------|
| DB-08 | **6 TEXT columns should be enums** | `apps.release_state`, `sync_jobs.job_type/status`, etc. | 6 columns | Moderate |
| DB-09 | **26 timestamp columns missing NOT NULL** | Various `created_at`, `updated_at` | 26 columns | Quick |
| DB-10 | **64,668 DLC orphan records** (expected, by design) | `app_dlc` | 64,668 | None |

---

## 4. Code & Usage Issues

### HIGH

| ID | Finding | Location | Impact | Effort |
|----|---------|----------|--------|--------|
| CU-01 | **Cube.js scheduled refresh disabled** | `packages/cube/cube.js` | Pre-aggregations may be stale | Quick |
| CU-02 | **Materialized views only refresh at 05:00 UTC** | Refresh workflow | Up to 24h stale data | Moderate |

### MEDIUM

| ID | Finding | Location | Impact | Effort |
|----|---------|----------|--------|--------|
| CU-03 | **PICS N+1 queries** (12+ queries per app) | `operations.py` | Slow relationship sync | Moderate |
| CU-04 | **Reviews worker N+1** (3 upserts per app) | `reviews-worker.ts` | 3x DB overhead | Moderate |
| CU-05 | **SteamSpy supplementary N+1** (2-3 calls per candidate) | `steamspy-worker.ts` | 200-300 queries for 100 candidates | Moderate |
| CU-06 | **velocity_calculated_at only has 3 rows** | `sync_status` | Velocity system may be broken | Moderate |
| CU-07 | **Qdrant payload data can drift** | Embedding sync | Stale metadata in search results | Moderate |

### LOW

| ID | Finding | Location | Impact | Effort |
|----|---------|----------|--------|--------|
| CU-08 | **14+ occurrences of over-fetching** | Various `.select()` calls | Minor inefficiency | Quick |
| CU-09 | **PICS tag cache never refreshes** | `operations.py` | Stale tags in long-running process | Quick |
| CU-10 | **No similarity result caching** | Qdrant queries | Repeated expensive queries | Moderate |

---

## 5. Retention & Compliance Issues

### HIGH

| ID | Finding | Location | Impact | Effort |
|----|---------|----------|--------|--------|
| RT-01 | **User deletion blocked** | `chat_query_logs` FK to `user_profiles` | GDPR/CCPA non-compliance | Moderate |
| RT-02 | **No delete_user_data() function** | Database | Cannot honor deletion requests | Moderate |
| RT-03 | **daily_metrics has no retention** | `daily_metrics` (~90K rows/day) | ~6 GB/year growth | Moderate |

### MEDIUM

| ID | Finding | Location | Impact | Effort |
|----|---------|----------|--------|--------|
| RT-04 | **cleanup_stale_reservations() not scheduled** | Database function | Credits could be locked indefinitely | Quick |
| RT-05 | **No formal retention policy documentation** | N/A | Compliance risk | Quick |

### LOW

| ID | Finding | Location | Impact | Effort |
|----|---------|----------|--------|--------|
| RT-06 | **Waitlist entries kept forever** | `waitlist` | Minor privacy concern | Quick |
| RT-07 | **Backup retention not documented** | Supabase | Unknown data exposure window | Quick |

---

## 6. Dead Data / Redundancy

### MEDIUM

| ID | Finding | Location | Size/Count | Effort |
|----|---------|----------|------------|--------|
| DD-01 | **4 daily_metrics columns always NULL** | `recent_*` columns | 1M+ rows affected | Moderate |
| DD-02 | **page_creation_date feature abandoned** | `apps` + scraper worker | 157K NULL values | Moderate |
| DD-03 | **steam_vanity_url never populated** | `publishers`, `developers` | 195K NULL values | Quick |
| DD-04 | **first_page_creation_date never populated** | `publishers`, `developers` | 195K NULL values | Quick |
| DD-05 | **211 MB redundant storage** (14% of DB) | Various | 211 MB | Major |

---

## Summary Counts

| Severity | Security | Data Quality | Database | Code/Usage | Retention | Dead Data | **Total** |
|----------|----------|--------------|----------|------------|-----------|-----------|-----------|
| Critical | 3 | 0 | 0 | 0 | 0 | 0 | **3** |
| High | 3 | 3 | 3 | 2 | 3 | 0 | **14** |
| Medium | 2 | 6 | 4 | 7 | 2 | 5 | **26** |
| Low | 2 | 3 | 3 | 3 | 2 | 0 | **13** |
| **Total** | **10** | **12** | **10** | **12** | **7** | **5** | **56** |

---

## Effort Distribution

| Effort Level | Count | Examples |
|--------------|-------|----------|
| Quick (< 1 hour) | 28 | RLS fixes, data cleanup queries, config changes |
| Moderate (1-8 hours) | 23 | N+1 fixes, deduplication logic, retention policies |
| Major (> 8 hours) | 5 | Review score reconciliation, user deletion system |

---

*This document consolidates all findings from Phases 2-5 of the data infrastructure audit.*
