# Account Page Guide

This guide explains how to use your account page in PublisherIQ to view your profile, credit balance, and transaction history.

---

## Signing In

PublisherIQ uses email-based authentication with one-time codes.

### Login Flow

1. Go to `/login` and enter your email address
2. Check your inbox for an email with an **8-digit code**
3. Enter the code on the login page
4. You'll be redirected to the dashboard

### OTP Code Details

| Setting | Value |
|---------|-------|
| Code length | 8 digits |
| Code expiry | 10 minutes |
| Rate limit | 3 attempts per 15 minutes |

### Troubleshooting Login

**Code not arriving:**
- Check spam/junk folder
- Verify your email is on the approved waitlist
- Wait 60 seconds before requesting a new code

**Code expired:**
- Codes expire after 10 minutes
- Return to `/login` and request a new code

**"Email not approved" error:**
- Your email must be approved by an administrator
- Contact your admin to be added to the waitlist

---

## Accessing Your Account

Navigate to your account page by:
1. Clicking your avatar/email in the navigation header
2. Selecting **Account** from the dropdown

---

## Account Overview

### Profile Information

Your account page displays:

| Field | Description |
|-------|-------------|
| **Email** | Your login email address |
| **Name** | Your display name (if set) |
| **Role** | Your access level (`user` or `admin`) |
| **Member Since** | Account creation date |

### Credit Balance

Your current credit balance is prominently displayed:

- **Current Balance**: Number of credits available
- **Status Indicator**: Warning if balance is low

**Low Balance Warning:**
A warning appears when your balance is below the minimum required for chat (4 credits).

---

## Transaction History

View your recent credit transactions:

| Column | Description |
|--------|-------------|
| **Date** | When the transaction occurred |
| **Type** | Transaction category |
| **Amount** | Credits added (+) or consumed (-) |
| **Description** | Details about the transaction |

### Transaction Types

| Type | Meaning |
|------|---------|
| **Signup Bonus** | Initial credits received on registration |
| **Usage** | Credits consumed by chat |
| **Refund** | Credits returned due to errors |
| **Admin Adjustment** | Manual credit grant by administrator |

### Filtering Transactions

Use the filter options to:
- View by transaction type
- Select date range
- Search by description

---

## Account Actions

### Sign Out

To sign out:
1. Click **Sign Out** at the bottom of the account page
2. You'll be redirected to the login page

### Need More Credits?

If your balance is low:
1. Contact your administrator
2. Admins can grant credits through the admin panel

---

## Credit Usage Details

After each chat message, you can see:
- Credits charged for that message
- Tool breakdown (which tools were used)
- Token usage (input/output)

This information is included in the message completion event.

---

## Related Documentation

- [Credit System Guide](./credit-system.md) - How credits work
- [Chat Interface Guide](./chat-interface.md) - Using the chat system
