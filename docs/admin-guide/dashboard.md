# Admin Panel Guide

This guide explains how to use the PublisherIQ admin panel to monitor system health, manage users, and review usage analytics.

> **Access Requirements:**
> You must be signed in with an admin role to access these pages.

---

## Overview

The admin panel consists of four main sections:

| Page | Path | Purpose |
|------|------|---------|
| **Dashboard** | `/admin` | System health, sync status, and data completion |
| **User Management** | `/admin/users` | View and manage user accounts |
| **Waitlist** | `/admin/waitlist` | Approve or reject signup requests |
| **Usage Analytics** | `/admin/usage` | Credit consumption and transaction history |

---

## Admin Dashboard (`/admin`)

The main dashboard provides a real-time view of system health and sync operations.

### Status Bar

The top status bar shows key health indicators:

| Metric | Description | Status Colors |
|--------|-------------|---------------|
| **Running** | Number of sync jobs currently running | Blue (active), Gray (none) |
| **Jobs (24h)** | Total jobs run in the past 24 hours | Gray (info only) |
| **Success** | 7-day success rate | Green (95%+), Yellow (80-94%), Red (<80%) |
| **Overdue** | Apps past their sync schedule | Green (0-100), Yellow (100-500), Red (500+) |
| **Errors** | Apps with consecutive sync failures | Green (0), Yellow (1-10), Red (10+) |
| **PICS** | Latest PICS change number processed | Blue (info only) |

### Data Completion Section

Shows sync completion percentage for each data source:

| Source | Data Type | Description |
|--------|-----------|-------------|
| **SteamSpy** | Player metrics | CCU, owners, playtime estimates |
| **Storefront** | Metadata | Game details, developer/publisher info |
| **Reviews** | Review data | Review counts and scores |
| **Histogram** | Review timeline | Monthly review distribution |
| **PICS** | Real-time data | Tags, genres, categories, Steam Deck |

**Interpretation:**
- Progress bar shows % of total apps synced for each source
- "Last sync" indicates time since last successful sync
- Stale apps are those that haven't been synced recently

### Sync Queue Section

#### Priority Distribution

Shows how apps are distributed across sync tiers:

| Tier | Score Range | Sync Interval | Description |
|------|-------------|---------------|-------------|
| **High** | 150+ | 6 hours | Active games with high CCU |
| **Medium** | 100-149 | 12 hours | Popular games |
| **Normal** | 50-99 | 24 hours | Average activity |
| **Low** | 25-49 | 48 hours | Low activity |
| **Minimal** | <25 | 7 days | Dormant or dead games |

#### Queue Status

| Status | Meaning |
|--------|---------|
| **Overdue** | Apps past their scheduled sync time |
| **Due in 1h** | Apps scheduled for sync in the next hour |
| **Due in 6h** | Apps scheduled for sync in the next 6 hours |
| **Due in 24h** | Apps scheduled for sync in the next 24 hours |

### PICS Service Section

Displays PICS (Product Info Cache Service) status:

| Metric | Description |
|--------|-------------|
| **Change Number** | Latest Steam change number processed |
| **Last Update** | Time since last PICS sync |
| **Apps with PICS** | Number of apps with PICS data |
| **Coverage** | Breakdown by data type (tags, genres, categories, etc.) |

### Sync Errors Section

Lists apps with consecutive sync failures. Each row shows:

- **App Name/ID**: Click to view app details
- **Error Count**: Number of consecutive failures
- **Source**: Which sync source is failing
- **Error Message**: Truncated error details
- **Time**: When the error occurred

**Actions:**
- Click an app row to view its full error history
- Clear errors by running a manual sync (if the issue is resolved)

### Recent Jobs Section

Shows the 15 most recent sync jobs:

| Field | Description |
|-------|-------------|
| **Status** | Running (blue), Completed (green), Failed (red) |
| **Type** | Sync job type (steamspy-sync, storefront-sync, etc.) |
| **Batch** | Number of apps in the batch |
| **Success** | Items successfully processed |
| **Duration** | Time to complete the job |

**Expandable Details:**
Click a row to see:
- Start and end timestamps
- GitHub Actions run ID (if applicable)
- Full error message (for failed jobs)
- Items created vs. updated

### Chat Logs Section

Shows recent chat queries for debugging:

| Field | Description |
|-------|-------------|
| **Query** | User's original question |
| **Tools** | Tools called to answer the query |
| **Timing** | LLM time, tool time, and total time |
| **Iterations** | Number of LLM call rounds (1-5) |

**Metrics Displayed:**
- Total queries (7 days)
- Average response time
- Average tools per query

**Warning Signs:**
- High iteration count (4-5): LLM struggling to answer
- Long tool execution: Slow database queries
- Missing tools: Query type not supported

---

## User Management (`/admin/users`)

Manage registered user accounts.

### User Table

| Column | Description |
|--------|-------------|
| **Email** | User's email address |
| **Name** | Display name (if set) |
| **Role** | `user` or `admin` |
| **Credits** | Current credit balance |
| **Created** | Account creation date |
| **Last Sign-In** | Most recent login |

### Actions

#### Change Role

1. Click the role badge for a user
2. Select new role from dropdown
3. Confirm the change

**Note:** Changing to `admin` grants full admin panel access.

#### Adjust Credits

1. Click the **Adjust Credits** button for a user
2. Enter amount to add (positive) or remove (negative)
3. Add a description (e.g., "Bonus for beta testing")
4. Click **Confirm**

**Important:**
- Credit adjustments are logged in the transaction history
- Users receive credits immediately
- Negative adjustments cannot reduce balance below zero

### Searching Users

Use the search bar to filter by:
- Email address
- Display name

---

## Waitlist Management (`/admin/waitlist`)

Review and process signup requests.

### Waitlist Table

| Column | Description |
|--------|-------------|
| **Email** | Applicant's email |
| **Name** | Provided name |
| **Organization** | Company or affiliation |
| **Intended Use** | How they plan to use PublisherIQ |
| **Submitted** | Request date |
| **Status** | Pending, Approved, or Rejected |

### Processing Requests

#### Approve

1. Review the applicant's information
2. Click the **Approve** button
3. An invite email is sent automatically
4. User receives signup bonus credits

#### Reject

1. Click the **Reject** button
2. Optionally provide a reason
3. No email is sent (silent rejection)

### Status Filtering

Use the tabs to filter by status:
- **Pending**: Requests awaiting review
- **Approved**: Previously approved requests
- **Rejected**: Declined requests
- **All**: All requests

---

## Usage Analytics (`/admin/usage`)

Monitor credit consumption and user activity.

### Summary Cards

| Metric | Description |
|--------|-------------|
| **Total Credits Used** | Sum of all credits consumed |
| **Active Users** | Users who used chat in the period |
| **Avg Credits/Chat** | Average credits per chat message |
| **Top Tool** | Most frequently used tool |

### Time Range

Select the analysis period:
- **24 hours**
- **7 days** (default)
- **30 days**
- **All time**

### Transaction History

Shows recent credit transactions:

| Column | Description |
|--------|-------------|
| **User** | User who incurred the charge |
| **Type** | Transaction type (usage, signup_bonus, admin_adjustment) |
| **Amount** | Credits consumed (negative) or granted (positive) |
| **Description** | Details about the transaction |
| **Time** | When it occurred |

### Top Users

Lists users by credit consumption:

| Column | Description |
|--------|-------------|
| **User** | Email or name |
| **Chats** | Number of chat messages |
| **Credits** | Total credits consumed |
| **Avg/Chat** | Credits per chat average |

### Tool Usage Breakdown

Shows which tools are used most frequently:

| Tool | Credits/Call | Typical Use |
|------|--------------|-------------|
| `query_analytics` | 8 | Structured data queries |
| `search_games` | 8 | Tag/genre discovery |
| `find_similar` | 12 | Similarity search |
| `lookup_*` | 4 | Name lookups |

---

## Common Tasks

### Check Why a Sync Failed

1. Go to `/admin`
2. Look at the **Sync Errors** section
3. Click the app with errors
4. Review the error message
5. Check GitHub Actions logs if the run ID is available

### Investigate Slow Chat Responses

1. Go to `/admin`
2. Expand the **Chat Logs** section
3. Look for queries with high tool execution time
4. Check the iteration count (high = potential issue)
5. Review the tools used for optimization opportunities

### Grant Credits to a User

1. Go to `/admin/users`
2. Find the user by email
3. Click **Adjust Credits**
4. Enter the amount and reason
5. Confirm the adjustment

### Approve a New User

1. Go to `/admin/waitlist`
2. Review pending requests
3. Check the intended use case
4. Click **Approve** to send an invite

---

## Related Documentation

- [Admin Dashboard Architecture](../developer-guide/features/admin-dashboard.md) - Technical details
- [Credit System Guide](../user-guide/credit-system.md) - How credits work
- [Sync Pipeline](../developer-guide/architecture/sync-pipeline.md) - Data flow details
