# Prioritized Action Plan
## PublisherIQ Data Infrastructure Remediation

**Created:** January 9, 2026
**Total Findings:** 56
**Estimated Total Effort:** 15-20 developer days

---

## Phase 1: Immediate (This Week)

**Focus:** Critical security issues, data loss risks, breaking bugs
**Effort:** 4-6 hours

### Day 1: Security Fixes (2 hours)

#### 1.1 Fix RLS Policy Misconfigurations
**Priority:** CRITICAL | **Effort:** 30 min | **Risk if delayed:** Data breach

```sql
-- Fix waitlist exposure (SEC-01)
DROP POLICY IF EXISTS "Public can select own waitlist entry" ON waitlist;
CREATE POLICY "Users can select own waitlist entry" ON waitlist
  FOR SELECT TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Fix chat_query_logs exposure (SEC-02)
DROP POLICY IF EXISTS "Allow public read access" ON chat_query_logs;
CREATE POLICY "Users can read own logs" ON chat_query_logs
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can read all logs" ON chat_query_logs
  FOR SELECT USING (is_admin());

-- Revoke dangerous grants (SEC-03)
REVOKE DELETE, TRUNCATE ON
  user_profiles, credit_transactions, credit_reservations,
  waitlist, rate_limit_state, chat_query_logs
FROM anon, authenticated;
```

**Verification:**
```sql
-- Test that anon cannot read waitlist
SET ROLE anon;
SELECT * FROM waitlist; -- Should return 0 rows
RESET ROLE;
```

#### 1.2 Add rate_limit_state Policies
**Priority:** HIGH | **Effort:** 15 min

```sql
-- SEC-06: Add explicit policies
CREATE POLICY "Users can read own rate limit" ON rate_limit_state
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can manage rate limits" ON rate_limit_state
  FOR ALL USING (auth.uid() IS NOT NULL);
```

### Day 1: Data Fixes (2 hours)

#### 1.3 Clean Up Stuck Sync Jobs
**Priority:** HIGH | **Effort:** 15 min | **Finding:** DQ-02

```sql
-- Mark stuck jobs as failed
UPDATE sync_jobs
SET
  status = 'failed',
  error_message = 'Auto-failed: Job exceeded 24h runtime limit',
  completed_at = NOW()
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '24 hours';

-- Verify
SELECT status, COUNT(*) FROM sync_jobs GROUP BY status;
```

#### 1.4 Fix Corrupt Game Prices
**Priority:** HIGH | **Effort:** 30 min | **Finding:** DQ-01

```sql
-- Identify and fix corrupt prices (likely KRW stored as cents)
UPDATE apps SET current_price_cents = NULL
WHERE current_price_cents > 50000  -- > $500
  AND appid IN (1245620, 1086940, 1142710, 2358720); -- Known corrupt

-- Add validation constraint for future
ALTER TABLE apps ADD CONSTRAINT check_reasonable_price
  CHECK (current_price_cents IS NULL OR current_price_cents <= 50000);
```

#### 1.5 Quick Data Cleanup
**Priority:** MEDIUM | **Effort:** 15 min | **Findings:** DQ-04, DQ-05, DQ-06

```sql
-- Trim whitespace from app names
UPDATE apps SET name = TRIM(name) WHERE name != TRIM(name);

-- Normalize placeholder future dates
UPDATE apps SET release_date = NULL
WHERE release_date > '2030-01-01';

-- Verify empty names (investigate before fixing)
SELECT appid, type, is_delisted FROM apps WHERE name = '';
```

### Day 2: Quick Wins (2-4 hours)

#### 1.6 Enable Cube.js Scheduled Refresh
**Priority:** HIGH | **Effort:** 15 min | **Finding:** CU-01

Edit `packages/cube/cube.js`:
```javascript
module.exports = {
  // Change from false to 60 (seconds)
  scheduledRefreshTimer: 60,
  // ... rest of config
};
```

#### 1.7 Schedule Stale Reservation Cleanup
**Priority:** MEDIUM | **Effort:** 30 min | **Finding:** RT-04

Create GitHub Action `.github/workflows/cleanup-reservations.yml`:
```yaml
name: Cleanup Stale Reservations
on:
  schedule:
    - cron: '0 * * * *'  # Every hour
jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          psql "$DATABASE_URL" -c "SELECT cleanup_stale_reservations();"
```

#### 1.8 Remove Unused Indexes (Largest First)
**Priority:** MEDIUM | **Effort:** 1 hour | **Finding:** DB-01

```sql
-- Start with largest unused indexes (monitor for 1 week before dropping more)
DROP INDEX IF EXISTS idx_review_histogram_appid_month;  -- 85 MB duplicate
DROP INDEX IF EXISTS idx_app_steam_tags_created_at;     -- 22 MB never used
DROP INDEX IF EXISTS idx_sync_status_needs_scrape;      -- 7 MB never used
DROP INDEX IF EXISTS idx_apps_embedding_filter;         -- 2.2 MB never used

-- Reclaim space
VACUUM ANALYZE review_histogram, app_steam_tags, sync_status, apps;
```

---

## Phase 2: Short-Term (30 Days)

**Focus:** High-impact performance fixes, major data quality issues
**Effort:** 5-7 developer days

### Week 1: Entity Deduplication

#### 2.1 Merge Publisher/Developer Duplicates
**Priority:** HIGH | **Effort:** 4 hours | **Finding:** DQ-03

```sql
-- Create deduplication function
CREATE OR REPLACE FUNCTION merge_duplicate_entities() RETURNS void AS $$
DECLARE
  dup RECORD;
BEGIN
  -- For each duplicate group, keep the one with more games
  FOR dup IN
    SELECT LOWER(name) as lower_name,
           array_agg(id ORDER BY game_count DESC) as ids
    FROM publishers
    GROUP BY LOWER(name)
    HAVING COUNT(*) > 1
  LOOP
    -- Update references to point to the keeper (first in array)
    UPDATE app_publishers
    SET publisher_id = dup.ids[1]
    WHERE publisher_id = ANY(dup.ids[2:]);

    -- Delete duplicates
    DELETE FROM publishers WHERE id = ANY(dup.ids[2:]);
  END LOOP;
  -- Repeat for developers...
END;
$$ LANGUAGE plpgsql;

-- Add case-insensitive unique constraint to prevent future duplicates
CREATE UNIQUE INDEX idx_publishers_name_ci ON publishers (LOWER(name));
CREATE UNIQUE INDEX idx_developers_name_ci ON developers (LOWER(name));
```

#### 2.2 Add Name Normalization Trigger
**Priority:** MEDIUM | **Effort:** 2 hours

```sql
CREATE OR REPLACE FUNCTION normalize_entity_name() RETURNS TRIGGER AS $$
BEGIN
  NEW.name := TRIM(NEW.name);
  NEW.normalized_name := LOWER(TRIM(NEW.name));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER normalize_publisher_name BEFORE INSERT OR UPDATE ON publishers
  FOR EACH ROW EXECUTE FUNCTION normalize_entity_name();
```

### Week 2: Performance Optimization

#### 2.3 Batch Histogram Upserts
**Priority:** HIGH | **Effort:** 2 hours | **Finding:** DB-03

Update `packages/ingestion/src/workers/histogram-worker.ts`:
```typescript
// Replace loop with batch upsert
const records = histogram.map(entry => ({
  appid,
  month_start: entry.monthStart.toISOString().split('T')[0],
  recommendations_up: entry.recommendationsUp,
  recommendations_down: entry.recommendationsDown,
}));

const { error } = await supabase
  .from('review_histogram')
  .upsert(records, { onConflict: 'appid,month_start' });
```

#### 2.4 Batch PICS Relationship Updates
**Priority:** MEDIUM | **Effort:** 4 hours | **Finding:** CU-03

Refactor `services/pics-service/src/database/operations.py` to collect all relationship changes and execute in batches.

### Week 3: Retention Policies

#### 2.5 Implement daily_metrics Retention
**Priority:** HIGH | **Effort:** 4 hours | **Finding:** RT-03

```sql
-- Create retention function
CREATE OR REPLACE FUNCTION cleanup_old_daily_metrics() RETURNS void AS $$
BEGIN
  DELETE FROM daily_metrics
  WHERE metric_date < CURRENT_DATE - INTERVAL '90 days'
    AND appid NOT IN (
      SELECT appid FROM apps
      WHERE type = 'game' AND is_released = true
    );
END;
$$ LANGUAGE plpgsql;

-- Schedule weekly cleanup
-- Add to .github/workflows/cleanup-metrics.yml
```

#### 2.6 Add sync_jobs Retention
**Priority:** LOW | **Effort:** 1 hour | **Finding:** DB-06

```sql
-- Keep only 30 days of job history
DELETE FROM sync_jobs
WHERE created_at < NOW() - INTERVAL '30 days'
  AND status != 'running';
```

### Week 4: Monitoring & Documentation

#### 2.7 Create .env.example Files
**Priority:** LOW | **Effort:** 1 hour | **Finding:** SEC-10

Create template files for:
- `/.env.example`
- `/apps/admin/.env.example`

#### 2.8 Document Data Sources Authority
**Priority:** MEDIUM | **Effort:** 2 hours | **Finding:** DQ-08

Update CLAUDE.md to clarify:
- Review scores: `daily_metrics.review_score` is authoritative (with PICS fallback)
- Prices: `apps.current_price_cents` is authoritative
- Dev/Pub names: Storefront is authoritative

---

## Phase 3: Medium-Term (90 Days)

**Focus:** Schema refactoring, redundancy elimination
**Effort:** 5-8 developer days

### Schema Cleanup

#### 3.1 Remove Dead Columns
**Priority:** MEDIUM | **Effort:** 2 hours | **Findings:** DD-01 through DD-04

```sql
-- Remove never-used columns
ALTER TABLE daily_metrics
  DROP COLUMN recent_total_reviews,
  DROP COLUMN recent_positive,
  DROP COLUMN recent_negative,
  DROP COLUMN recent_score_desc;

ALTER TABLE apps
  DROP COLUMN page_creation_date_raw;

ALTER TABLE publishers
  DROP COLUMN steam_vanity_url,
  DROP COLUMN first_page_creation_date;

ALTER TABLE developers
  DROP COLUMN steam_vanity_url,
  DROP COLUMN first_page_creation_date;

-- Regenerate TypeScript types
-- pnpm --filter database generate
```

#### 3.2 Convert TEXT Columns to Enums
**Priority:** LOW | **Effort:** 4 hours | **Finding:** DB-08

```sql
-- Create enums
CREATE TYPE release_state_enum AS ENUM ('prerelease', 'released', 'disabled');
CREATE TYPE job_status_enum AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE velocity_tier_enum AS ENUM ('high', 'medium', 'low', 'dormant', 'unknown');

-- Migrate columns (requires careful testing)
ALTER TABLE apps ALTER COLUMN release_state TYPE release_state_enum
  USING release_state::release_state_enum;
```

### GDPR Compliance

#### 3.3 Fix User Deletion Capability
**Priority:** HIGH | **Effort:** 4 hours | **Finding:** RT-01

```sql
-- Change FK constraint
ALTER TABLE chat_query_logs
  DROP CONSTRAINT chat_query_logs_user_id_fkey,
  ADD CONSTRAINT chat_query_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES user_profiles(id)
    ON DELETE SET NULL;

-- Create user deletion function
CREATE OR REPLACE FUNCTION delete_user_data(target_user_id UUID) RETURNS void AS $$
BEGIN
  -- Anonymize chat logs
  UPDATE chat_query_logs SET user_id = NULL WHERE user_id = target_user_id;

  -- Delete credit records
  DELETE FROM credit_reservations WHERE user_id = target_user_id;
  DELETE FROM credit_transactions WHERE user_id = target_user_id;
  DELETE FROM rate_limit_state WHERE user_id = target_user_id;

  -- Delete profile (triggers auth.users deletion via cascade)
  DELETE FROM user_profiles WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Redundancy Elimination

#### 3.4 Document Authoritative Data Sources
**Priority:** MEDIUM | **Effort:** 2 hours | **Finding:** DD-05

Create reconciliation queries to identify and fix drifted data between:
- `apps.current_price_cents` vs `daily_metrics.price_cents`
- `apps.pics_review_score` vs `daily_metrics.review_score`
- `ccu_tier_assignments.recent_peak_ccu` vs actual ccu_snapshots

---

## Phase 4: Long-Term (When Resources Allow)

**Focus:** Nice-to-haves, major migrations
**Effort:** 10+ developer days

### Major Improvements

| Item | Description | Effort |
|------|-------------|--------|
| **4.1** | Partition daily_metrics by month | 2 days |
| **4.2** | Implement full review score reconciliation | 3 days |
| **4.3** | Add secrets manager (Doppler/Vault) | 2 days |
| **4.4** | Add Zod environment validation | 1 day |
| **4.5** | Implement staging environment | 3 days |
| **4.6** | Add comprehensive audit logging | 2 days |
| **4.7** | Implement similarity result caching | 1 day |

### Aspirational

| Item | Description | Benefit |
|------|-------------|---------|
| Redis caching layer | Replace in-memory caches | Horizontal scaling |
| Read replicas | Separate read/write traffic | Query performance |
| Materialized view auto-refresh | Event-driven refresh | Fresher data |
| Data warehouse export | BigQuery/Snowflake sync | Advanced analytics |

---

## Progress Tracking

### Checklist: Immediate (This Week)

- [ ] SEC-01: Fix waitlist RLS policy
- [ ] SEC-02: Fix chat_query_logs RLS policy
- [ ] SEC-03: Revoke DELETE/TRUNCATE grants
- [ ] SEC-06: Add rate_limit_state policies
- [ ] DQ-02: Clean up stuck sync jobs
- [ ] DQ-01: Fix corrupt prices
- [ ] DQ-04/05/06: Quick data cleanup
- [ ] CU-01: Enable Cube.js scheduled refresh
- [ ] RT-04: Schedule reservation cleanup
- [ ] DB-01: Remove top unused indexes

### Metrics to Track

| Metric | Before | Target | Actual |
|--------|--------|--------|--------|
| Security issues (Critical) | 3 | 0 | |
| Security issues (High) | 3 | 0 | |
| Unused index size | 313 MB | < 50 MB | |
| Entity duplicates | 1,790 | 0 | |
| Stuck sync jobs | 184 | 0 | |

---

*This action plan should be reviewed and updated after each phase completion.*
