# `/apps` first-load timeout + “0 games / 0 trending” context bar — investigation (2026-01-29)

## What you reported
- First visit to `/apps` each day: **“failed to load due to timeout”** until you refresh.
- After refresh: the page loads, but the context bar shows **0 games / 0 trending** (and other zero-ish stats).
- You’re the only user, so this feels like **cold start / caching / spin-up** behavior.

## What I reviewed (direct DB + app wiring)
### App-side call paths (relevant to DB behavior)
- **Server Component (`/apps`)** fetches:
  - `getApps(filterParams)` (RPC: `get_apps_with_filters`)
  - `getAggregateStats(filterParams)` (reads `mv_apps_aggregate_stats`, falls back to RPC `get_apps_aggregate_stats`)
- **Client (React Query)** fetches `/api/apps` with a **15s browser abort timeout** (`AbortController`).
- **API route (`/api/apps`)**:
  - Requires auth (`createServerClient()` + `supabase.auth.getUser()`)
  - Calls `get_apps_with_filters` and then `get_apps_aggregate_stats` sequentially
  - Caches default view results in-memory for 5 minutes

### Database settings I verified
#### Role-level statement timeouts
On the DB, role configs include **very low statement timeouts**:
```sql
SELECT rolname, rolconfig
FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role', 'postgres');
```
Observed values:
- `anon`: `statement_timeout=3s`
- `authenticated`: `statement_timeout=8s`

This means any query (including RPC calls) executed as:
- **anon** is canceled after ~3 seconds
- **authenticated** is canceled after ~8 seconds

#### `mv_apps_aggregate_stats` appears stale / not refreshed automatically
I queried the materialized view directly:
```sql
SELECT app_type, total_games, avg_ccu, trending_up_count
FROM mv_apps_aggregate_stats
ORDER BY app_type;
```
The numbers did **not match** a live count from `apps` for the same filters (released + not delisted), implying the MV is **stale** (or out-of-sync with upstream refreshes).

I also checked pg_cron jobs:
```sql
SELECT jobid, schedule, command, active
FROM cron.job
ORDER BY jobid;
```
Only one job exists:
- `*/30 * * * *` → `SELECT refresh_dashboard_stats()`

There is **no scheduled job** refreshing `mv_apps_aggregate_stats` (or the broader `refresh_filter_count_views()` bundle).

## Findings (what most likely explains your symptoms)
### 1) “Failed to load due to timeout” on first visit is consistent with cold + low DB statement_timeout
If the first request of the day hits:
- cold server/runtime (app) and/or
- cold DB caches,

then the “default” `/apps` RPC can occasionally exceed **3s** (anon) or **8s** (authenticated) and be canceled by Postgres. A refresh right after can succeed because caches are now warm.

The key “DB truth” here is the role settings: **3 seconds (anon) and 8 seconds (authenticated)** are aggressive for large-table queries on a cold cache.

### 2) “0 games / 0 trending” is a fallback path, not real data
Your UI can show zeros when **stats fail**:
- `/apps` Server Component initializes `aggregateStats` to a zeroed default.
- `getAggregateStats()` returns zeros if it can’t read the MV and the RPC fails.
- The UI does not distinguish “stats unavailable” from “actual zeros”, so it renders `0`.

In other words: the bar showing `0` is best interpreted as **“stats query failed”**, not “there are zero games”.

### 3) Even when stats don’t fail, the MV can be wrong if it’s stale
Because `mv_apps_aggregate_stats` is a materialized view without an observed refresh schedule, the “fast path” for stats can return **outdated** totals and averages.

## Recommendations (ordered by leverage)
### DB-first (matches your request to review the DB directly)
1) **Re-evaluate role-level `statement_timeout`**
   - If `/apps` is a core page, `3s` for `anon` and `8s` for `authenticated` will produce intermittent failures under cold cache or heavier workloads.
   - Options:
     - Raise the role timeouts, or
     - Set a higher timeout only for specific RPC functions (Postgres supports function-level `SET` options), so you don’t globally increase risk.
   - This requires a deliberate ops/migration decision (I did not apply any DB changes).

2) **Add a scheduled refresh for `mv_apps_aggregate_stats` (and related filter-count MVs)**
   - You already have `refresh_filter_count_views()` in migrations.
   - Add a `pg_cron` job to run it after ingestion updates, or on a cadence that matches your data update cycle.
   - Without this, “fast path” stats will drift and can mislead even when the request succeeds.

3) **Validate correctness after refresh**
   - After adding a refresh schedule, re-check:
     - `apps` base counts by type
     - `mv_apps_aggregate_stats.total_games` by type
   - If mismatches persist after a refresh, then the MV definition (joins/filters) is incorrect and needs adjustment.

### App-side (optional, but directly improves UX when DB hiccups)
1) **Don’t render zeros when stats are missing**
   - Render `—` or a “Stats unavailable” state if aggregate stats cannot be fetched.

2) **Ensure Server Components query as the authenticated user**
   - Today `/api/apps` is cookie-authenticated, but `/apps` Server Component calls DB via a plain client.
   - Making the Server Component use the cookie-aware Supabase server client reduces the chance it runs with the tighter `anon` behavior.

3) **Align browser timeout with expected DB+runtime cold-start**
   - The client aborts at 15s; if cold starts are real, you may want better messaging or staged loading rather than a hard failure.

## Quick SQL snippets (copy/paste)
```sql
-- Role timeouts
SELECT rolname, rolconfig
FROM pg_roles
WHERE rolname IN ('anon', 'authenticated');

-- MV aggregate stats
SELECT app_type, total_games, avg_ccu, trending_up_count
FROM mv_apps_aggregate_stats
ORDER BY app_type;

-- Base counts for comparison
SELECT type::text AS app_type, COUNT(*)::bigint AS apps_count
FROM apps
WHERE is_released = TRUE AND is_delisted = FALSE
GROUP BY type
ORDER BY apps_count DESC;

-- Scheduled jobs
SELECT jobid, schedule, command, active
FROM cron.job
ORDER BY jobid;
```

