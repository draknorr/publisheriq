# Account Guide

This guide covers sign-in, account access, and credit visibility in PublisherIQ.

## Signing In

PublisherIQ uses email OTPs as the primary sign-in flow.

### Login Flow

1. Go to `/login`
2. Enter your approved email address
3. Check your inbox for an **8-digit code**
4. Enter the code on the login page
5. If you were redirected from a protected route, you return there through `?next=...`

### OTP Details

| Setting | Value |
|---------|-------|
| Code length | 8 digits |
| Code expiry | 10 minutes |
| Resend cooldown | 60 seconds |
| Rate limit | 3 failed attempts per 15 minutes |

### Important Notes

- Access is invite-only. Unapproved emails are sent to the waitlist flow.
- PublisherIQ waits for a fully established browser session before redirecting after verification.
- `/auth/callback` and `/auth/confirm` still exist for callback compatibility, but the main UX is OTP entry on `/login`.

### Troubleshooting Login

**Code not arriving**
- check spam or junk
- confirm the email was approved
- wait for the resend cooldown before requesting another code

**Code expired**
- return to `/login`
- request a new code

**Redirected back to login**
- verify `NEXT_PUBLIC_SITE_URL` is configured correctly in the deployment
- clear stale cookies/local storage if you were testing older auth builds

## Accessing Your Account

Navigate to `/account` from the signed-in navigation.

## Account Overview

Your account page shows:

| Field | Description |
|-------|-------------|
| **Email** | Login email address |
| **Name** | Display name, if present |
| **Role** | `user` or `admin` |
| **Member Since** | Account creation timestamp |
| **Credit Balance** | Credits currently available for chat |

## Transaction History

Recent credit transactions include:

| Column | Description |
|--------|-------------|
| **Date** | When the transaction happened |
| **Type** | Usage, signup bonus, refund, or admin adjustment |
| **Amount** | Credits added or consumed |
| **Description** | Human-readable detail |

## Sign Out

Use the **Sign Out** action on `/account` to clear the session and return to `/login`.

## Related Documentation

- [Credit System](./credit-system.md)
- [Chat Interface](./chat-interface.md)
- [Troubleshooting](../admin-guide/troubleshooting.md)
