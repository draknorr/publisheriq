# Login/Auth Patch Recommendations
Date: 2026-02-24
Scope: `apps/admin` login reliability + auth session continuity

## Goal
Stabilize login so users can:
1. Consistently stay authenticated after OTP verify.
2. Navigate protected routes without being bounced to `/login?next=...`.
3. Request OTP codes without ambiguous failure states.

---

## Observed Incidents

### Incident A: Redirect loop after login
- Symptom: Clicking sidebar links redirects to `/login?next=%2Fadmin`.
- Meaning: Middleware treated the request as unauthenticated.

### Incident B: OTP send failures
- Symptom: Repeated `"Unable to send verification code. Please try again."`
- Meaning: `signInWithOtp()` is failing, but error details are hidden.

---

## Root Cause Summary

1. Login page auto-signs out whenever `getSession()` is empty on mount.
- File: `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/app/(auth)/login/page.tsx`
- Risk: transient client auth initialization can clear valid state.

2. OTP success path redirects immediately without validating session establishment.
- File: `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/app/(auth)/login/page.tsx`

3. OTP error handling masks actionable error info.
- File: `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/app/(auth)/login/page.tsx`

4. `validate-email` uses expensive/fragile paginated `listUsers` scan.
- File: `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/app/api/auth/validate-email/route.ts`

5. `next` param is not honored in OTP verify success path.
- File: `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/app/(auth)/login/page.tsx`

6. OTP expiry messaging is inconsistent (UI says 1 hour; docs say 10 minutes).
- Files:
  - `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/app/(auth)/login/page.tsx`
  - `/Users/ryanbohmann/Desktop/publisheriq/docs/user-guide/account.md`

---

## Patch Set (Priority Order)

## P0: Session Stability + Redirect Correctness

### P0.1 Remove destructive auto-signout on login mount
- In login `useEffect`, do not call `supabase.auth.signOut()` when `getSession()` returns null.
- Replace with passive check only:
  - if session exists -> redirect
  - else -> no-op

### P0.2 Honor `next` after successful OTP verify
- Read `const next = searchParams.get('next') || '/dashboard'`.
- Redirect to `next` after successful `verifyOtp`.

### P0.3 Add post-verify session guard
- After `verifyOtp` success, call `getSession()` once.
- If no session, show explicit `"Sign-in completed but session was not established. Retry in a new tab."` and do not navigate.

---

## P1: OTP Send Reliability + Debuggability

### P1.1 Expose structured auth errors (safe subset)
- Map common Supabase auth errors to user-facing messages:
  - Rate limited -> `"Too many attempts. Wait X minutes."`
  - Invalid email / forbidden -> clear message
  - Generic fallback -> current message
- Log structured details server-side (code/status/message, no secrets).

### P1.2 Add client cooldown for resend
- Disable resend for 60 seconds with countdown.
- Prevent rapid repeated `signInWithOtp` calls.

---

## P2: Validate Email Endpoint Hardening

### P2.1 Replace `listUsers` scan
- Replace paginated `auth.admin.listUsers()` loop with direct lookup strategy:
  - Preferred: `auth.admin.getUserByEmail(email)` if available in current SDK.
  - Fallback: query `public.user_profiles` by normalized email using service role.
- Keep waitlist approved check.

### P2.2 Add endpoint rate limit
- Add per-IP throttle on `/api/auth/validate-email` (short window).
- Keep response generic enough to reduce abuse risk.

---

## P3: Auth Flow Simplification + Consistency

### P3.1 Pick one primary login flow for production
- Default to OTP code entry flow.
- Keep `/auth/callback` path for backward compatibility, but document as secondary.

### P3.2 Fix UX/docs mismatch
- Update login page copy to match actual OTP expiry policy (expected 10 minutes).

---

## Implementation Checklist

1. Update login flow logic in:
- `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/app/(auth)/login/page.tsx`

2. Update validate-email route in:
- `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/app/api/auth/validate-email/route.ts`

3. Update docs:
- `/Users/ryanbohmann/Desktop/publisheriq/docs/user-guide/account.md`
- `/Users/ryanbohmann/Desktop/publisheriq/docs/admin-guide/troubleshooting.md`
- Add release note entry for auth reliability patch.

4. Validate:
- `pnpm --filter @publisheriq/admin lint`
- `pnpm check-types`
- `pnpm --filter @publisheriq/admin dev`

---

## Manual Test Matrix (Required)

1. Successful OTP login to protected route
- Start at `/admin` unauthenticated -> redirect to `/login?next=%2Fadmin`
- Complete login
- Expect landing on `/admin` (not `/dashboard`, not `/login`)

2. Sidebar navigation after login
- Click `/dashboard`, `/apps`, `/admin`
- Expect no auth bounce.

3. OTP resend cooldown
- Click resend multiple times rapidly
- Expect cooldown enforcement and no duplicate submission spam.

4. OTP rate-limit behavior
- Trigger throttling intentionally
- Expect explicit rate-limit message (not generic failure).

5. Session continuity hard refresh
- After login, refresh on `/admin` and `/apps`
- Expect session persists.

6. Waitlist/approval path
- Approved email -> `valid: true`
- Not approved email -> waitlist prompt behavior unchanged.

---

## Rollout Plan

1. Ship P0 + P1 together (highest user impact).
2. Ship P2 in same release if low-risk; otherwise next patch.
3. Monitor auth failures for 24h:
- OTP send failures
- `401` on protected routes right after login
- frequency of `/login?next=` redirects after successful verify.

---

## Acceptance Criteria

- No reproducible post-login bounce to `/login?next=...` during normal navigation.
- OTP send errors are actionable and not opaque.
- `next` redirect works for OTP flow.
- Lint/type-check pass, and manual auth test matrix passes.
