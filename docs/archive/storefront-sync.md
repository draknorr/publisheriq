# Storefront Sync: Private & Age-Gated Apps

## Overview

Steam's Storefront API returns `success: false` for private, removed, and age-gated apps. This document explains what data is lost and how the sync handles these cases.

---

## Age-Gated Content Data Loss

### Data Lost When Storefront Returns `success=false`

| Field | Impact | Alternative |
|-------|--------|-------------|
| **developers[]** | CRITICAL - No alternative source | None |
| **publishers[]** | CRITICAL - No alternative source | None |
| **release_date** | HIGH | PICS `release_time_unix` |
| **name** | MEDIUM | PICS ProductInfo |
| **about_the_game** | LOW | PICS `short_description` |
| **content_descriptors** | LOW | PICS has this |
| **categories/genres** | LOW | PICS + SteamSpy tags |

**Estimated Impact:** ~40-50 adult-rated games permanently missing dev/pub info.

### Why Apps Return `success=false`

1. **Age-gated** (18+) - Requires cookies/auth to bypass
2. **Private/removed** - Game delisted or never released
3. **Region-locked** - Not available in US region
4. **Test apps** - Internal Steam apps

### Potential Future Solutions

1. **PICS Fallback Worker** (Recommended)
   - `services/pics-service/` already implemented
   - Database schema ready (`20251230000000_add_pics_data.sql`)
   - No age-gating restrictions
   - Gets 80% of missing data (not dev/pub)

2. **Cookie Bypass** (Risky)
   - Add `wants_mature_content=1; birthtime=<epoch>` cookies
   - May violate Steam ToS
   - Could trigger rate limiting or bans

3. **HTML Scraping** (Most Risky)
   - Scrape store.steampowered.com with age-bypass cookies
   - Brittle, violates ToS, slow

### Decision
For now, accept that age-gated apps will be missing dev/pub data. Consider PICS fallback worker if this becomes a significant business issue.

---

## Implementation

### Problem
The storefront sync was showing 30-50% "appsFailed" but these were mostly apps where Steam returns `success: false`. These aren't failures - they're apps with no public data available.

**Root Cause:** The API function returned `null` for both "no data" AND actual errors - the worker couldn't tell the difference.

### Solution
1. Update API to distinguish between "no data" vs "error"
2. Mark apps with no public data as not needing storefront sync
3. Keep retrying actual errors

### API Return Type
**File:** `packages/ingestion/src/apis/storefront.ts`

```typescript
export type StorefrontResult =
  | { status: 'success'; data: ParsedStorefrontApp }
  | { status: 'no_data' }     // Steam returned success=false (private/removed)
  | { status: 'error'; error: string };
```

### Database Column
**Migration:** `supabase/migrations/20251230000004_add_storefront_accessible.sql`

```sql
ALTER TABLE sync_status ADD COLUMN storefront_accessible BOOLEAN DEFAULT TRUE;
```

### Worker Handling
**File:** `packages/ingestion/src/workers/storefront-worker.ts`

- `status: 'no_data'` → Mark `storefront_accessible = false`, count as `appsSkipped`
- `status: 'error'` → Keep as retryable, count as `appsFailed`
- `status: 'success'` → Mark `storefront_accessible = true`, update data

### Sync Function Update
Apps with `storefront_accessible = false` are excluded from future storefront syncs:

```sql
WHEN 'storefront' THEN
  (s.last_storefront_sync IS NULL OR s.last_storefront_sync < NOW() - INTERVAL '1 day')
  AND (s.storefront_accessible IS NULL OR s.storefront_accessible = TRUE)
```

---

## Expected Behavior

- **First sync:** ~30-50% apps marked as `storefront_accessible = false` (skipped)
- **Subsequent syncs:** Only accessible apps queried, near 0% skip rate
- **Real API errors:** Still tracked and retried daily

## Files Modified

1. `packages/ingestion/src/apis/storefront.ts` - StorefrontResult type
2. `packages/ingestion/src/workers/storefront-worker.ts` - Handle result types, appsSkipped stat
3. `supabase/migrations/20251230000004_add_storefront_accessible.sql` - Column and function update
