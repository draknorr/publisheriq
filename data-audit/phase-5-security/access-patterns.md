# Access Patterns Security Audit

**Date:** January 9, 2026
**Scope:** Database RLS policies, API route protection, audit logging, service key usage

---

## Executive Summary

PublisherIQ has a solid foundation for access control with Row Level Security (RLS) enabled on sensitive tables and middleware-based authentication. However, several areas require attention:

| Area | Status | Severity |
|------|--------|----------|
| RLS on sensitive tables | Enabled | - |
| API route authentication | Mostly protected | Medium |
| Audit logging | Partial | Medium |
| Service key isolation | Good | - |
| Overly permissive grants | **Issues found** | High |

---

## 1. Row Level Security (RLS) Policy Inventory

### 1.1 Tables with RLS Enabled

| Table | RLS Enabled | Force RLS |
|-------|-------------|-----------|
| `user_profiles` | Yes | No |
| `waitlist` | Yes | No |
| `credit_transactions` | Yes | No |
| `credit_reservations` | Yes | No |
| `chat_query_logs` | Yes | No |
| `rate_limit_state` | Yes | No |

### 1.2 RLS Policies by Table

#### user_profiles
| Policy | Command | Access |
|--------|---------|--------|
| Users can read own profile | SELECT | `auth.uid() = id` |
| Admins can read all profiles | SELECT | `is_admin()` |
| Users can update own profile | UPDATE | `auth.uid() = id` |

**Assessment:** Good isolation - users only see their own data, admins have full read access.

#### waitlist
| Policy | Command | Access |
|--------|---------|--------|
| Public can insert waitlist | INSERT | `true` (anon, authenticated) |
| Admins can read waitlist | SELECT | `is_admin()` |
| Admins can update waitlist | UPDATE | `is_admin()` |
| Public can select own waitlist entry | SELECT | `true` |
| Public can update own pending waitlist entry | UPDATE | `status = 'pending'` |

**Issue:** "Public can select own waitlist entry" with `qual = true` allows anyone to read ALL waitlist entries, not just their own.

#### credit_transactions
| Policy | Command | Access |
|--------|---------|--------|
| Users can read own transactions | SELECT | `user_id = auth.uid()` |
| Admins can read all transactions | SELECT | `is_admin()` or subquery |

**Assessment:** Good - users see only their own transactions.

#### credit_reservations
| Policy | Command | Access |
|--------|---------|--------|
| Users can read own reservations | SELECT | `user_id = auth.uid()` |
| Admins can read all reservations | SELECT | Subquery to user_profiles |

**Assessment:** Good isolation.

#### chat_query_logs
| Policy | Command | Access |
|--------|---------|--------|
| Allow public read access | SELECT | `true` |

**Issue:** Chat query logs are readable by anyone with public access. Contains sensitive data including user_id, query text, token counts.

#### rate_limit_state
| Policy | Command | Access |
|--------|---------|--------|
| (None) | - | - |

**Issue:** RLS is enabled but NO policies exist. This means all direct access is blocked, but should be verified that functions with SECURITY DEFINER provide the only access path.

### 1.3 Public Game Data Tables (No RLS issues - intentionally public)

The following tables have `Allow public read access` policies which is appropriate:
- `apps`, `publishers`, `developers`
- `app_categories`, `app_developers`, `app_franchises`, `app_genres`, `app_publishers`
- `app_steam_deck`, `app_steam_tags`, `app_tags`, `app_trends`
- `daily_metrics`, `review_histogram`
- `steam_categories`, `steam_genres`, `steam_tags`, `franchises`
- `sync_jobs`, `sync_status`, `pics_sync_state`

---

## 2. Database Role Permissions

### 2.1 Overly Permissive Grants

**Critical Finding:** Both `anon` and `authenticated` roles have been granted excessive permissions on sensitive tables:

```
Table: user_profiles, credit_transactions, credit_reservations,
       chat_query_logs, rate_limit_state, waitlist

Grants to anon/authenticated:
- SELECT, INSERT, UPDATE, DELETE
- TRUNCATE, REFERENCES, TRIGGER
```

While RLS provides a layer of protection, these grants are overly broad. The `DELETE` and `TRUNCATE` permissions are particularly concerning - even with RLS, edge cases or policy misconfigurations could allow unintended data deletion.

**Recommendation:** Restrict grants to only what's needed:
- `user_profiles`: SELECT, UPDATE (own record only via RLS)
- `waitlist`: INSERT for anon, SELECT/UPDATE for authenticated
- `credit_*`: SELECT only (writes via SECURITY DEFINER functions)
- `chat_query_logs`: INSERT only (reads via admin interface)
- `rate_limit_state`: No direct grants (function-only access)

---

## 3. API Route Protection Analysis

### 3.1 Protected Routes (Authentication Required)

| Route | Auth Check | Additional Checks |
|-------|------------|-------------------|
| `/api/chat/stream` | `createServerClient().auth.getUser()` | Credits check, rate limiting |
| `/api/similarity` | `createServerClient().auth.getUser()` | None |
| `/api/admin/send-invite` | Session + profile role check | Admin only |

### 3.2 Public Routes (No Authentication)

| Route | Purpose | Risk Level |
|-------|---------|------------|
| `/api/auth/callback` | OAuth PKCE code exchange | Low (design intent) |
| `/api/auth/validate-email` | Email validation for waitlist | Medium |

**Assessment of `/api/auth/validate-email`:**
- Uses `createServiceClient()` (bypasses RLS)
- Lists all auth.users via `supabase.auth.admin.listUsers()`
- No rate limiting
- Potential for email enumeration

### 3.3 Middleware Protection

The middleware at `/apps/admin/src/middleware.ts` provides defense-in-depth:

```typescript
// Public paths - no auth required
const PUBLIC_PATHS = ['/login', '/waitlist', '/auth/callback',
                      '/api/auth/callback', '/api/auth/validate-email'];

// Admin-only paths (requires admin role)
const ADMIN_PATHS = ['/admin'];
```

**Good practices observed:**
- Unauthenticated API requests get 401 JSON response (not redirect)
- Admin paths require role verification via database query
- Session refresh on all requests

**Gap:** No API routes appear to require admin role check EXCEPT `/api/admin/send-invite`. Other admin data appears to be fetched directly in page components.

---

## 4. Audit Logging Assessment

### 4.1 What IS Logged

| Activity | Logged | Location | Retention |
|----------|--------|----------|-----------|
| Chat queries | Yes | `chat_query_logs` | 7 days (auto-cleanup) |
| Credit transactions | Yes | `credit_transactions` | Permanent |
| Credit reservations | Yes | `credit_reservations` | Permanent |
| User profile changes | No | - | - |
| Admin actions on waitlist | Partial | `reviewed_by`, `reviewed_at` | Permanent |
| Failed auth attempts | No | - | - |
| API access | No | - | - |

### 4.2 What Should Be Logged

**Missing audit trails:**
1. **User profile changes** - No history of role changes, balance adjustments
2. **Failed authentication** - No logging of failed login attempts
3. **API access logging** - No request/response logging for sensitive endpoints
4. **Admin actions** - No comprehensive audit of admin activities beyond credit adjustments

### 4.3 Credit Transaction Audit Trail

The `credit_transactions` table provides a good immutable audit log:
- Tracks all credit changes with `transaction_type`
- Records `admin_user_id` for admin actions
- Links to `reservation_id` for chat usage
- Includes metadata: `input_tokens`, `output_tokens`, `tool_credits`

---

## 5. API Data Exposure Analysis

### 5.1 Data Returned by APIs

| Endpoint | Data Returned | Filtering |
|----------|---------------|-----------|
| `/api/chat/stream` | LLM responses, timing | User-scoped |
| `/api/similarity` | Game matches | Public data |
| `/api/admin/send-invite` | Success/error only | Admin-only |
| `/api/auth/validate-email` | valid: true/false | Returns waitlist status |

### 5.2 Potential Over-Exposure

1. **`/api/auth/validate-email`** - Could reveal if an email exists in the system
2. **Chat query logs** - Public read policy exposes query patterns, potentially sensitive questions

### 5.3 Field-Level Access Control

No evidence of field-level filtering in API responses. The application relies on:
- RLS policies at database level
- Component-level rendering decisions

**Risk:** If RLS policies have gaps, sensitive fields could be exposed.

---

## 6. Service Key Usage Assessment

### 6.1 Service Key Locations

| File | Usage | Risk Assessment |
|------|-------|-----------------|
| `packages/database/src/client.ts` | `createServiceClient()` | Server-only package |
| `apps/admin/src/lib/chat-query-logger.ts` | Logging via `getServiceClient()` | Server-side only |
| `apps/admin/src/app/api/admin/send-invite/route.ts` | Admin invite email | Server-side, admin-protected |
| `apps/admin/src/app/api/auth/validate-email/route.ts` | Email validation | Server-side API route |
| All GitHub Action workflows | Sync workers | CI/CD environment |
| `services/pics-service/` | Python microservice | Railway deployment |

### 6.2 Client-Side Exposure Check

**Verified safe:** No instances of `SUPABASE_SERVICE_KEY` in client-side code. All admin dashboard API routes use:
- `NEXT_PUBLIC_SUPABASE_URL` - Safe to expose
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Designed for client use

The service key is only accessed via:
1. Server-side API routes (`/api/*`)
2. Server components with `'use server'`
3. Backend workers and services

---

## 7. Recommendations

### 7.1 Critical (Address Immediately)

1. **Fix waitlist SELECT policy** - Change from `true` to proper user filtering:
   ```sql
   DROP POLICY "Public can select own waitlist entry" ON waitlist;
   CREATE POLICY "Users can select own waitlist entry" ON waitlist
       FOR SELECT USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));
   ```

2. **Restrict chat_query_logs access** - Change from public read to user/admin only:
   ```sql
   DROP POLICY "Allow public read access" ON chat_query_logs;
   CREATE POLICY "Users can read own logs" ON chat_query_logs
       FOR SELECT USING (user_id = auth.uid());
   CREATE POLICY "Admins can read all logs" ON chat_query_logs
       FOR SELECT USING (is_admin());
   ```

3. **Revoke excessive grants** on sensitive tables:
   ```sql
   REVOKE DELETE, TRUNCATE ON user_profiles FROM anon, authenticated;
   REVOKE DELETE, TRUNCATE ON credit_transactions FROM anon, authenticated;
   REVOKE DELETE, TRUNCATE ON credit_reservations FROM anon, authenticated;
   REVOKE DELETE, TRUNCATE ON waitlist FROM anon, authenticated;
   ```

### 7.2 High Priority

4. **Add rate limiting to `/api/auth/validate-email`** - Prevent email enumeration attacks

5. **Add RLS policies to rate_limit_state** - Even though function-only access is intended, add explicit deny policies:
   ```sql
   CREATE POLICY "No direct access" ON rate_limit_state
       FOR ALL USING (false);
   ```

6. **Enable `relforcerowsecurity`** on sensitive tables to ensure RLS applies to table owners too

### 7.3 Medium Priority

7. **Add audit logging for user profile changes** - Create triggers to log role changes

8. **Add failed authentication logging** - Log failed attempts for security monitoring

9. **Review legacy `/api/chat/route.ts`** - Has no authentication check (cube-route.ts variant also unprotected)

### 7.4 Low Priority

10. **Add API request logging** - Consider structured logging for security analysis

11. **Document data classification** - Clearly mark which tables contain PII/sensitive data

---

## 8. Summary of Findings

| Finding | Severity | Status |
|---------|----------|--------|
| Waitlist SELECT policy too permissive | High | Open |
| chat_query_logs publicly readable | High | Open |
| Excessive DELETE/TRUNCATE grants | High | Open |
| rate_limit_state has no RLS policies | Medium | Open |
| /api/auth/validate-email no rate limit | Medium | Open |
| Legacy chat routes unprotected | Medium | Open |
| Missing user profile change audit | Medium | Open |
| No failed auth logging | Low | Open |
| Force RLS not enabled | Low | Open |

---

## Appendix A: Complete RLS Policy Listing

```
 schemaname |      tablename      |                  policyname                  | permissive |        roles         |  cmd
------------+---------------------+----------------------------------------------+------------+----------------------+--------
 public     | app_categories      | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | app_developers      | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | app_franchises      | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | app_genres          | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | app_publishers      | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | app_steam_deck      | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | app_steam_tags      | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | app_tags            | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | app_trends          | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | apps                | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | chat_query_logs     | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | credit_reservations | Admins can read all reservations             | PERMISSIVE | {public}             | SELECT
 public     | credit_reservations | Users can read own reservations              | PERMISSIVE | {public}             | SELECT
 public     | credit_transactions | Admins can read all transactions             | PERMISSIVE | {public}             | SELECT
 public     | credit_transactions | Admins can read credit_transactions          | PERMISSIVE | {public}             | SELECT
 public     | credit_transactions | Users can read own transactions              | PERMISSIVE | {public}             | SELECT
 public     | daily_metrics       | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | developers          | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | franchises          | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | pics_sync_state     | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | publishers          | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | review_histogram    | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | steam_categories    | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | steam_genres        | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | steam_tags          | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | sync_jobs           | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | sync_status         | Allow public read access                     | PERMISSIVE | {public}             | SELECT
 public     | user_profiles       | Admins can read all profiles                 | PERMISSIVE | {public}             | SELECT
 public     | user_profiles       | Users can read own profile                   | PERMISSIVE | {public}             | SELECT
 public     | user_profiles       | Users can update own profile                 | PERMISSIVE | {public}             | UPDATE
 public     | waitlist            | Admins can read waitlist                     | PERMISSIVE | {public}             | SELECT
 public     | waitlist            | Admins can update waitlist                   | PERMISSIVE | {public}             | UPDATE
 public     | waitlist            | Public can insert waitlist                   | PERMISSIVE | {anon,authenticated} | INSERT
 public     | waitlist            | Public can select own waitlist entry         | PERMISSIVE | {anon,authenticated} | SELECT
 public     | waitlist            | Public can update own pending waitlist entry | PERMISSIVE | {anon,authenticated} | UPDATE
```

## Appendix B: Relevant File Paths

- Middleware: `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/middleware.ts`
- Supabase Server Client: `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/lib/supabase/server.ts`
- Supabase Middleware Client: `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/lib/supabase/middleware.ts`
- Database Service Client: `/Users/ryanbohmann/Desktop/publisheriq/packages/database/src/client.ts`
- Chat Stream Route: `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/app/api/chat/stream/route.ts`
- Chat Route (Legacy): `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/app/api/chat/route.ts`
- Similarity Route: `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/app/api/similarity/route.ts`
- Admin Send Invite: `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/app/api/admin/send-invite/route.ts`
- Auth Validate Email: `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/app/api/auth/validate-email/route.ts`
- Auth Callback: `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/app/api/auth/callback/route.ts`
- User System Migration: `/Users/ryanbohmann/Desktop/publisheriq/supabase/migrations/20260108000000_add_user_system.sql`
- RLS Fix Migration: `/Users/ryanbohmann/Desktop/publisheriq/supabase/migrations/20260109000001_fix_rls_recursion.sql`
