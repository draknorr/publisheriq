# Data Retention Issues - Security Audit

**Date:** January 9, 2026
**Database Size:** 1,624 MB
**Audit Focus:** Data retention policies, GDPR/CCPA compliance, PII handling

---

## Executive Summary

PublisherIQ has **partial retention policies** in place but significant gaps exist:
- Only 2 of 41 tables have automated retention cleanup
- User deletion does NOT properly cascade to all related data
- Chat query logs contain user queries (potential PII) with 7-day retention
- Audit logs (`credit_transactions`) are kept forever by design
- Large tables (`daily_metrics`, `review_histogram`) grow unbounded

**Risk Level:** MEDIUM-HIGH for GDPR/CCPA compliance

---

## 1. Tables Without Retention Policies

### Tables with Retention Policies (2 tables)
| Table | Retention | Cleanup Mechanism |
|-------|-----------|-------------------|
| `chat_query_logs` | 7 days | `cleanup_old_chat_logs()` via daily GitHub Action |
| `ccu_snapshots` | 30 days | `cleanup_old_ccu_snapshots()` via weekly GitHub Action |

### Tables Growing Unbounded (HIGH PRIORITY)

| Table | Current Rows | Growth Rate | Storage | Concern |
|-------|-------------|-------------|---------|---------|
| `daily_metrics` | 1,070,489 | ~90K rows/day | 197 MB | **CRITICAL** - Growing fast |
| `review_histogram` | 2,902,086 | Stable after initial sync | 408 MB | Historical data, low growth |
| `app_steam_tags` | 2,413,338 | Low growth | 233 MB | Tag assignments |
| `sync_jobs` | 2,400 | ~200/day | Small | Job history |
| `monthly_game_metrics` | 247,224 | Moderate | 35 MB | Monthly aggregations |
| `sync_status` | 157,695 | Stable | 124 MB | One per app |
| `review_deltas` | 8,605 | Moderate | Small | Daily velocity tracking |

### Data Growth Projections

**Daily Metrics Growth Analysis:**
- Current: 1.07M rows (12 days of data: Dec 28, 2025 - Jan 9, 2026)
- Daily additions: ~90,000 rows/day
- Yearly projection: **32.8M rows/year** (~6GB storage)
- 5-year projection: **164M rows** (~30GB storage)

**Recommendation:** Implement rolling retention or archival strategy for `daily_metrics`:
- Keep 90 days of daily granularity
- Aggregate to weekly/monthly summaries for older data
- Archive raw data to cold storage if needed

---

## 2. User Data Deletion Capability (GDPR/CCPA)

### Current CASCADE DELETE Rules

| Table | Foreign Key | ON DELETE | Issue |
|-------|-------------|-----------|-------|
| `credit_transactions` | user_id -> user_profiles | CASCADE | Audit log deleted |
| `credit_reservations` | user_id -> user_profiles | CASCADE | OK |
| `rate_limit_state` | user_id -> user_profiles | CASCADE | OK |
| `chat_query_logs` | user_id -> user_profiles | **NO ACTION** | **FAILS on user deletion** |
| `user_profiles` | id -> auth.users | CASCADE | OK |

### Critical GDPR/CCPA Gap: `chat_query_logs`

**Problem:** Deleting a user from `user_profiles` will FAIL if they have entries in `chat_query_logs` because:
1. Foreign key has `ON DELETE NO ACTION`
2. Chat logs contain the user's actual query text (potential PII)

**Impact:**
- Cannot honor "right to be forgotten" requests without manual intervention
- Must manually delete or nullify chat logs before deleting user

**Recommended Fix:**
```sql
ALTER TABLE chat_query_logs
    DROP CONSTRAINT chat_query_logs_user_id_fkey,
    ADD CONSTRAINT chat_query_logs_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
```

This allows user deletion while preserving anonymized analytics data.

### No "Delete User" Function Exists

There is no `delete_user()` or similar function to handle:
1. Anonymizing/deleting chat logs
2. Deleting user from `auth.users` (which cascades to `user_profiles`)
3. Handling waitlist entries

**Recommendation:** Create a `delete_user_data(user_id UUID)` function that:
1. Anonymizes `chat_query_logs` (set user_id = NULL, optionally redact query_text)
2. Deletes from `waitlist` if applicable
3. Deletes from `auth.users` (cascades to user_profiles, credit_transactions, etc.)

---

## 3. PII in Database Tables

### Tables Containing PII

| Table | PII Columns | Retention | Concern |
|-------|-------------|-----------|---------|
| `user_profiles` | email, full_name, organization | Forever | **User account data** |
| `waitlist` | email, full_name, organization, how_i_plan_to_use | Forever | **Application data** |
| `chat_query_logs` | query_text (user's questions) | 7 days | Queries may contain PII |
| `credit_transactions` | description (may reference user actions) | Forever | Audit log |

### PII NOT Collected (Good)

- **No IP addresses** logged in application tables
- **No user agents** stored
- **No geolocation** data

### Auth Schema (Supabase Managed)

| Table | PII | Notes |
|-------|-----|-------|
| `auth.users` | email, phone, metadata | Managed by Supabase |
| `auth.audit_log_entries` | ip_address in payload | Currently empty (0 rows) |
| `auth.sessions` | session data | Managed by Supabase |

**Note:** `auth.audit_log_entries` contains IP addresses but is currently empty. If enabled, this would be a PII concern.

---

## 4. Audit Log Retention

### `credit_transactions` - Immutable Audit Log

**Current Policy:** Retained forever (no cleanup)

**Columns:**
- user_id, amount, balance_after, transaction_type
- description, input_tokens, output_tokens, tool_credits
- admin_user_id (for admin actions), reservation_id
- created_at

**Issue:** By design, audit logs are CASCADE deleted when user is deleted. This may:
- Violate financial record retention requirements
- Make it impossible to reconcile credit usage after user deletion

**Recommendation:**
1. Change `ON DELETE CASCADE` to `ON DELETE SET NULL` for user_id
2. Implement periodic anonymization instead of deletion
3. Retain anonymized records for 7 years (financial compliance)

### `sync_jobs` - Operational Logs

**Current Policy:** Retained forever (no cleanup)

**Current:** 2,400 rows (12 days of data, ~200 jobs/day)
**Yearly projection:** ~73,000 rows

**Recommendation:** Implement 90-day retention for sync_jobs:
```sql
DELETE FROM sync_jobs WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## 5. Backup Retention

### Supabase Automated Backups

Supabase provides:
- **Daily automated backups** (Pro plan: 7 days retention)
- **Point-in-time recovery** (Pro plan: up to 7 days)

**Concern:** Deleted user data persists in backups for up to 7 days after deletion.

### Manual Backup Scripts

**Finding:** No manual backup scripts found in the repository.

### Recommendations

1. Document backup retention policy for GDPR compliance
2. Consider if 7-day backup retention meets legal requirements
3. For strict GDPR compliance, may need to implement backup encryption and key rotation

---

## 6. Missing Cleanup Jobs

### Functions Without Scheduled Jobs

| Function | Purpose | Schedule Needed |
|----------|---------|-----------------|
| `cleanup_stale_reservations()` | Refund pending reservations > 1 hour old | Hourly cron recommended |

**Impact:** Stale reservations could:
- Lock up user credits indefinitely
- Cause credit_balance inconsistencies

**Recommendation:** Add GitHub Action:
```yaml
name: Cleanup Stale Reservations
on:
  schedule:
    - cron: '0 * * * *'  # Every hour
jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/rest/v1/rpc/cleanup_stale_reservations" \
            -H "apikey: ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}"
```

---

## 7. Summary of Retention Gaps

| Category | Issue | Priority | Recommendation |
|----------|-------|----------|----------------|
| User Deletion | `chat_query_logs` blocks deletion | **HIGH** | Change FK to ON DELETE SET NULL |
| User Deletion | No delete_user function | **HIGH** | Create comprehensive deletion function |
| Data Growth | `daily_metrics` unbounded | **HIGH** | Implement 90-day retention + archival |
| Audit Logs | `credit_transactions` deleted with user | MEDIUM | Change to ON DELETE SET NULL |
| Cleanup Jobs | `cleanup_stale_reservations` not scheduled | MEDIUM | Add hourly cron job |
| Operational | `sync_jobs` unbounded | LOW | Add 90-day retention |
| Waitlist | `waitlist` entries kept forever | LOW | Add cleanup for rejected entries after 30 days |

---

## 8. Compliance Checklist

### GDPR/CCPA Requirements

| Requirement | Status | Notes |
|-------------|--------|-------|
| Right to Access | PARTIAL | No export function exists |
| Right to Deletion | **BLOCKED** | FK constraint prevents deletion |
| Data Minimization | OK | Only necessary data collected |
| Purpose Limitation | OK | Data used for stated purposes |
| Storage Limitation | **GAPS** | Several tables lack retention policies |
| Breach Notification | N/A | No breach detected |
| Data Portability | NOT IMPLEMENTED | No user data export |

### Recommended Actions (Priority Order)

1. **URGENT:** Fix `chat_query_logs` FK to allow user deletion
2. **URGENT:** Create `delete_user_data()` function for GDPR requests
3. **HIGH:** Implement `daily_metrics` retention/archival strategy
4. **HIGH:** Schedule `cleanup_stale_reservations()` job
5. **MEDIUM:** Change `credit_transactions` FK to preserve anonymized audit trail
6. **MEDIUM:** Add user data export function for data portability
7. **LOW:** Implement `sync_jobs` cleanup (90-day retention)
8. **LOW:** Clean up rejected waitlist entries

---

## 9. SQL Fixes

### Fix 1: Allow User Deletion
```sql
-- Change chat_query_logs FK to SET NULL on delete
ALTER TABLE chat_query_logs
    DROP CONSTRAINT IF EXISTS chat_query_logs_user_id_fkey,
    ADD CONSTRAINT chat_query_logs_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Change credit_transactions FK to SET NULL (preserve audit trail)
ALTER TABLE credit_transactions
    DROP CONSTRAINT IF EXISTS credit_transactions_user_id_fkey,
    ADD CONSTRAINT credit_transactions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
```

### Fix 2: Create User Deletion Function
```sql
CREATE OR REPLACE FUNCTION delete_user_data(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Anonymize chat logs (retain for analytics)
    UPDATE chat_query_logs
    SET user_id = NULL, query_text = '[DELETED]'
    WHERE user_id = p_user_id;

    -- Delete waitlist entry if exists
    DELETE FROM waitlist
    WHERE email IN (SELECT email FROM user_profiles WHERE id = p_user_id);

    -- Delete from auth.users (cascades to user_profiles, etc.)
    DELETE FROM auth.users WHERE id = p_user_id;

    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Fix 3: Daily Metrics Retention
```sql
CREATE OR REPLACE FUNCTION cleanup_old_daily_metrics()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Keep 90 days of daily granularity
    DELETE FROM daily_metrics
    WHERE metric_date < CURRENT_DATE - INTERVAL '90 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

---

## Appendix: Current Cleanup Schedule

| Workflow | Schedule | Function | Retention |
|----------|----------|----------|-----------|
| cleanup-chat-logs.yml | Daily 3:00 UTC | `cleanup_old_chat_logs()` | 7 days |
| ccu-cleanup.yml | Sunday 3:00 UTC | `cleanup_old_ccu_snapshots()` | 30 days |
| (MISSING) | Hourly | `cleanup_stale_reservations()` | 1 hour |
| (MISSING) | Weekly | TBD | `sync_jobs` 90 days |
| (MISSING) | Weekly | TBD | `daily_metrics` 90 days |
