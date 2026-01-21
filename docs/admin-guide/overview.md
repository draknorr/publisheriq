# Admin Guide Overview

This guide covers administration tasks for PublisherIQ. You must have the **admin** role to access these features.

> **Access:** Sign in and navigate to `/admin` to access the admin panel.

---

## Quick Start

| Task | Where | Guide |
|------|-------|-------|
| Monitor system health | `/admin` | [Dashboard](./dashboard.md) |
| View sync errors | `/admin` | [Dashboard](./dashboard.md#sync-errors-section) |
| Manage users | `/admin/users` | [Dashboard](./dashboard.md#user-management-adminusers) |
| Approve waitlist requests | `/admin/waitlist` | [Dashboard](./dashboard.md#waitlist-management-adminwaitlist) |
| View credit usage | `/admin/usage` | [Dashboard](./dashboard.md#usage-analytics-adminusage) |
| Debug chat issues | `/admin` | [Chat Logs](./chat-logs.md) |
| Troubleshoot sync failures | `/admin` | [Troubleshooting](./troubleshooting.md) |

---

## Admin Pages

### Dashboard (`/admin`)

The main admin dashboard provides real-time monitoring:

- **Status Bar**: System health indicators
- **Data Completion**: Sync progress for each source
- **Sync Queue**: Priority distribution and queue status
- **PICS Service**: Real-time data service status
- **Sync Errors**: Apps with consecutive failures
- **Recent Jobs**: Latest sync job history
- **Chat Logs**: Recent chat queries for debugging

See [Dashboard](./dashboard.md) for full details.

### User Management (`/admin/users`)

- View all registered users
- Change user roles (user/admin)
- Adjust credit balances
- Search users by email or name

### Waitlist (`/admin/waitlist`)

- Review signup requests
- Approve or reject applications
- Filter by status (pending/approved/rejected)

### Usage Analytics (`/admin/usage`)

- Monitor credit consumption
- View top users by usage
- Analyze tool usage patterns
- Filter by time range (24h/7d/30d/all time)

---

## Common Tasks

| Task | Steps |
|------|-------|
| **Check sync health** | View status bar at `/admin`, check for overdue or errored apps |
| **Debug slow chat** | Check Chat Logs section for high iteration counts or long tool times |
| **Grant user credits** | `/admin/users` → Find user → Adjust Credits |
| **Approve new user** | `/admin/waitlist` → Pending tab → Review → Approve |

---

## Related Documentation

- [Dashboard Guide](./dashboard.md) - Complete admin panel reference
- [Chat Logs](./chat-logs.md) - Chat debugging and analytics
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions

### For Developers

- [Admin Dashboard Architecture](../developer-guide/features/admin-dashboard.md) - Technical implementation
- [Sync Pipeline](../developer-guide/architecture/sync-pipeline.md) - Data flow details
