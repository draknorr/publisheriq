# Login / Auth System Review (PublisherIQ)

Date: 2026-01-29

## Scope

This review covers the auth/login system used by the Next.js dashboard:

- App: `apps/admin` (Next.js 15, App Router)
- Auth: Supabase Auth (email OTP / magic link)
- Access gating: waitlist approval + `user_profiles.role` (`user`/`admin`)
- Local dev behavior: auth bypass in middleware when running on localhost

Out of scope:

- Supabase project settings (email templates, redirect allowlists, rate limits) except where they interact with repo code
- Infrastructure / proxy configuration (Vercel, custom domains), except where current code assumes it

## Current Auth Flow (as implemented)

### 1) Middleware protection

File: `apps/admin/src/middleware.ts`

- Public routes are whitelisted (e.g. `/login`, `/waitlist`, `/auth/callback`, `/auth/confirm`, `/api/auth/*`).
- All other routes require an authenticated Supabase session (`updateSession()` + `supabase.auth.getUser()`).
- Unauthenticated:
  - `/api/*` returns `401` JSON
  - non-API routes redirect to `/login` and append `?redirect=<pathname>` (note: the login flow currently doesn’t consume this)
- Admin routes (`/admin*`) do a server-side role check against `public.user_profiles.role`.

### 2) Login page (email magic link)

File: `apps/admin/src/app/(auth)/login/page.tsx`

1. Client calls `POST /api/auth/validate-email` (server) to enforce invite-only access.
2. If valid, client calls `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`.
3. User clicks the emailed link to complete sign-in.

### 3) Callback / confirmation

Files:

- `apps/admin/src/app/auth/callback/page.tsx` (client handler)
- `apps/admin/src/app/api/auth/callback/route.ts` (server “router” for `code` → `/auth/callback`)
- `apps/admin/src/app/auth/confirm/route.ts` (server OTP verification via `token_hash`)

Notes:

- The codebase appears to support multiple Supabase email link styles:
  - **Implicit flow**: tokens in URL hash (`#access_token=...`) handled by `/auth/callback`
  - **PKCE flow**: `?code=...` exchange in `/auth/callback`, with `/api/auth/callback` routing
  - **Token hash verification**: `/auth/confirm?token_hash=...&type=...` verifies OTP server-side and sets cookies
- Which one actually happens depends on Supabase email templates/config. The code is currently trying to support “all of them”.

### 4) Local development bypass

File: `apps/admin/src/middleware.ts`

- When `hostname` is `localhost` or `127.0.0.1`, middleware skips auth checks for non-public, non-static routes.
- Important: Some pages still enforce auth in server components (e.g. admin pages call `getUserWithProfile()` and `redirect('/login')`), so the bypass is not universal.

## Findings (bugs, security risks, and optimizations)

### Critical

#### AUTH-01 — “Dev bypass” can become a production auth bypass (Host header trust)

Where:

- `apps/admin/src/middleware.ts`

What:

- Middleware bypass is keyed off `request.nextUrl.hostname` being `localhost`/`127.0.0.1`.
- In practice, hostname is derived from the request `Host` header. In many deployments, that header can be influenced by clients (or by misconfigured proxies).

Impact:

- If an attacker can cause the app to see `Host: localhost`, they can bypass auth for *all* protected routes, including protected API endpoints.
- This is especially dangerous because some routes (e.g. `/api/chat`) rely on middleware-only protection.

Recommended fix:

- Gate the bypass behind `process.env.NODE_ENV === 'development'` (and include `::1`).
- Ideally add an explicit env toggle (e.g. `AUTH_BYPASS_LOCALHOST=true`) so you can turn it off to test real auth locally.

Suggested code (conceptual):

```ts
const isDev = process.env.NODE_ENV === 'development';
const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(hostname);
if (isDev && isLoopback && !isPublicPath(pathname) && !isStaticAsset(pathname)) {
  return NextResponse.next();
}
```

This preserves local `next dev` convenience while removing a class of production-bypass risks.

#### DB-01 — `user_profiles` update policy enables privilege escalation (role/credits)

Where:

- `supabase/migrations/20260108000000_add_user_system.sql` (“Users can update own profile”)

What:

- RLS policy allows any authenticated user to `UPDATE` their own `user_profiles` row:
  - `FOR UPDATE USING (auth.uid() = id)`
- RLS does not restrict *columns*. If the `authenticated` role has UPDATE privileges on the table, users can update sensitive fields such as:
  - `role` → set self to `admin`
  - `credit_balance`, `total_credits_used`, etc.

Impact:

- Full privilege escalation to admin (and therefore access to admin UI + admin-only data, depending on other checks).

Recommended fix:

- Remove direct UPDATE for end users and replace with:
  - Column-level UPDATE grants (`GRANT UPDATE(full_name, organization) ...`) + RLS, or
  - A `SECURITY DEFINER` function that updates only allowed fields and uses `auth.uid()` internally.

#### DB-02 — `SECURITY DEFINER` credit functions are callable by any authenticated user (horizontal escalation)

Where:

- `supabase/migrations/20260108000000_add_user_system.sql`:
  - `reserve_credits(p_user_id UUID, p_amount INTEGER)`
  - `finalize_credits(p_reservation_id UUID, ...)`
  - `refund_reservation(p_reservation_id UUID)`
  - `get_credit_balance(p_user_id UUID)`
  - `check_and_increment_rate_limit(p_user_id UUID)`
  - `admin_adjust_credits(p_admin_id UUID, p_user_id UUID, ...)`
- These are granted to `authenticated` via explicit `GRANT EXECUTE ... TO authenticated;`.

What:

- These functions are `SECURITY DEFINER` but do not consistently enforce that the caller owns the referenced user/reservation, and `admin_adjust_credits` trusts a `p_admin_id` parameter rather than `auth.uid()`.

Impact (examples):

- Any authenticated user can potentially:
  - Deduct credits from other users by calling `reserve_credits()` with another user’s UUID.
  - Read other users’ credit balances via `get_credit_balance()`.
  - Potentially “impersonate” an admin in `admin_adjust_credits()` if they can obtain an admin UUID.

Recommended fix:

- Do not accept “actor” IDs (`p_admin_id`) from callers; use `auth.uid()` inside functions.
- For any function that takes a user ID, enforce `p_user_id = auth.uid()` unless truly admin-only.
- Consider revoking execute from `authenticated` and exposing these actions only via server-side API using a service role key (or at least via admin-only RLS + checks).

#### DB-03 — `chat_query_logs` is publicly readable but includes user-linked data

Where:

- `supabase/migrations/20260102000001_add_chat_query_logs.sql`:
  - `CREATE POLICY "Allow public read access" ON chat_query_logs FOR SELECT USING (true);`
- `supabase/migrations/20260108000000_add_user_system.sql` adds user and reservation metadata columns to `chat_query_logs`.

Impact:

- If table grants allow it, anyone using the anon key could read:
  - prompt text (`query_text`)
  - tool usage metadata
  - potentially `user_id`, `reservation_id`, token counts, etc.
- This can also enable escalation chains (e.g., discover admin UUIDs → exploit `admin_adjust_credits` trusting `p_admin_id`).

Recommended fix:

- Remove/replace the public SELECT policy; make it admin-only (e.g., `USING (is_admin())`).
- If you need analytics, expose an aggregated view that doesn’t include prompt text or user IDs.

### High

#### AUTH-02 — `/api/auth/callback` supports open redirects via `origin=...`

Where:

- `apps/admin/src/app/api/auth/callback/route.ts`

What:

- If `origin` query param is present, it becomes the redirect destination for the `code`.

Impact:

- Open redirect/phishing vector and code leakage (even if PKCE mitigates direct token exchange).

Recommended fix:

- Validate `origin` against an allowlist (e.g. `*.publisheriq.app`, expected Vercel preview hosts) and HTTPS-only (except loopback for dev), or remove the feature entirely.
- Prefer encoding the “return origin” into Supabase `state` and validating it, rather than trusting arbitrary query params.

#### AUTH-03 — “Return to where you were going” is broken (`redirect` vs `next`)

Where:

- `apps/admin/src/middleware.ts` adds `?redirect=<pathname>` when redirecting to `/login`.
- `apps/admin/src/app/auth/callback/page.tsx` expects `?next=...`.
- `apps/admin/src/app/auth/confirm/route.ts` expects `?next=...`.

Impact:

- Users land on `/dashboard` after auth instead of the intended page.
- This breaks UX and makes troubleshooting auth flows harder.

Recommended fix:

- Standardize on one param name (`next` is common).
- Ensure it flows through:
  - middleware → login page → email redirect link → callback/confirm route → final redirect.
- Validate `next` to be an internal path only.

#### AUTH-04 — `/api/auth/validate-email` correctness + perf problems (`listUsers` pagination)

Where:

- `apps/admin/src/app/api/auth/validate-email/route.ts`

What:

- Uses `supabase.auth.admin.listUsers()` and then `.some()` to find an email match.
- `listUsers()` is paginated; without paging, this check will fail once users exceed the default page size.

Impact:

- Existing users can be incorrectly denied login once you have enough users.
- Also expensive: listing users repeatedly is slower than a targeted lookup.

Recommended fix:

- Use `auth.admin.getUserByEmail(email)` if available, or query `public.user_profiles` by email using the service role.
- Add short-term caching and basic rate limiting to protect the endpoint.

#### AUTH-05 — `/api/auth/validate-email` leaks access decisions (enumeration)

Where:

- `apps/admin/src/app/api/auth/validate-email/route.ts`
- `apps/admin/src/app/(auth)/login/page.tsx`

Impact:

- Attackers can probe whether an email is approved/in the system.
- This endpoint is public and uses the service role, increasing blast radius if abused.

Recommended fix:

- Rate limit by IP and/or add CAPTCHA after a small number of attempts.
- Consider making the response more generic (avoid telling an attacker whether an email exists/approved).

#### AUTH-06 — Some API routes rely only on middleware for auth

Where:

- `apps/admin/src/app/api/chat/route.ts` (no auth check)
- `apps/admin/src/app/api/apps/route.ts` (no auth check)
- Others do check auth explicitly (e.g. `/api/search`, `/api/chat/stream`)

Impact:

- If middleware is bypassed (see AUTH-01) or misconfigured, these endpoints become publicly callable.

Recommended fix:

- Add defense-in-depth auth checks to all sensitive API routes.
- Delete unused routes (especially anything that can trigger paid API usage).

#### AUTH-07 — Redirect URL construction depends on request `origin` (host header injection risk)

Where:

- `apps/admin/src/app/auth/confirm/route.ts` uses `origin` from `new URL(request.url)` for redirects.
- `apps/admin/src/app/api/admin/send-invite/route.ts` falls back to `request.nextUrl.origin` for `redirectTo`.

Impact:

- If `Host` is spoofed or proxy headers are misconfigured, users can be redirected to attacker-controlled domains.

Recommended fix:

- Prefer a canonical base URL env var (e.g. `NEXT_PUBLIC_SITE_URL`) for redirects.
- Validate any fallback origin against an allowlist.

### Medium

#### AUTH-08 — Auth flow complexity: multiple callback mechanisms are supported simultaneously

Where:

- `/auth/callback` supports implicit hash + PKCE exchange.
- `/auth/confirm` supports token hash verification.
- `/api/auth/callback` exists to route PKCE codes.

Impact:

- Harder to reason about security.
- Easy to break login by changing Supabase templates/settings without noticing.

Recommended fix:

- Choose one primary approach and simplify:
  - If you want reliability across email clients, token hash verification (`/auth/confirm`) is a good fit.
  - Then remove or de-emphasize PKCE routing code if not needed.
- Document the required Supabase email template settings alongside the code.

#### AUTH-09 — Cookie domain logic may not behave as intended on the apex domain

Where:

- `apps/admin/src/lib/supabase/client.ts`

What:

- Domain is set only when `window.location.hostname.endsWith('.publisheriq.app')`.
- This does **not** match `publisheriq.app` itself (apex domain), only subdomains like `app.publisheriq.app`.

Impact:

- Sessions may not be shared across subdomains as expected, depending on where the app is hosted.

Recommended fix:

- Consider:
  - `hostname === 'publisheriq.app' || hostname.endsWith('.publisheriq.app')`
- Verify against your actual deployment hosts.

#### AUTH-10 — Inconsistent Supabase client usage (anon vs session-aware)

Where:

- `apps/admin/src/lib/supabase.ts` creates an anon-key Supabase client (no cookies/session).
- Other code uses `@supabase/ssr` server/browser clients (cookie/session-aware).

Impact:

- Confusing security model (“is this request authenticated or anon?”).
- Risk of accidentally depending on anon-readable RLS policies for screens that are intended to be protected.

Recommended fix:

- Standardize:
  - For protected server components/API routes, use `createServerClient()` (cookie/session-aware) and check `auth.getUser()`.
  - Keep `getSupabase()` for truly public data only, and document that intent.

### Low / polish

#### AUTH-11 — Login UI error handling is ambiguous for server errors

Where:

- `apps/admin/src/app/(auth)/login/page.tsx`

What:

- The login page doesn’t branch on `validateResponse.ok`; it assumes JSON shape.

Impact:

- A 500 from `/api/auth/validate-email` can show misleading “no access” messaging.

Recommended fix:

- Treat non-2xx as “temporary error” and ask the user to retry.

## Local Development: Keep a safe bypass

Current behavior:

- Middleware bypass on localhost lets you develop many pages without Supabase auth.
- Some pages still enforce auth server-side (e.g. admin pages, account).

Suggested improvements (without removing the bypass):

1. Make bypass explicitly dev-only (`NODE_ENV === 'development'`).
2. Add a toggle env var:
   - `AUTH_BYPASS_LOCALHOST=true` (default in dev), `false` when you want to test the real login flow locally.
3. (Optional) Provide a “dev user” mode that stubs a user profile for UI testing, rather than skipping auth entirely.

## Recommended Remediation Order

1. **Fix DB-02 and DB-01** (privilege escalation risks).
2. **Fix AUTH-01** (remove any chance of production auth bypass).
3. **Fix DB-03** (stop leaking chat logs / user identifiers).
4. **Fix AUTH-02 / AUTH-07** (open redirects / host header issues).
5. **Fix AUTH-03 / AUTH-04** (return-to UX + validate-email correctness).
6. Simplify flow (AUTH-08) and standardize Supabase clients (AUTH-10).

