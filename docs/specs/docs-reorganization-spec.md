# Documentation Reorganization Specification

> **Created:** January 19, 2026
> **Status:** Proposed
> **Purpose:** Guide for restructuring the docs folder to improve discoverability and audience clarity

---

## Problem Statement

The current documentation structure mixes audiences within folders, making it difficult for users to find relevant content. Key issues:

1. **Mixed audiences in `guides/`** - End-user, admin, and developer docs are intermixed
2. **Duplicate coverage** - Feature pages have both architecture and guide docs with unclear relationship
3. **Thin onboarding** - `getting-started/` has only 2 files with no role-based paths
4. **Scattered admin docs** - Admin content split between `guides/` and `architecture/`
5. **Fragmented API docs** - API documentation spread across `reference/` and `architecture/`

---

## Current Structure

```
docs/
├── README.md
├── architecture/           # 10 files - Technical implementation
│   ├── admin-dashboard.md
│   ├── chat-data-system.md
│   ├── companies-page.md
│   ├── data-sources.md
│   ├── database-schema.md
│   ├── design-system.md
│   ├── games-page.md
│   ├── overview.md
│   ├── personalized-dashboard.md
│   └── sync-pipeline.md
├── deployment/             # 4 files - Deployment guides
│   ├── fly-io.md
│   ├── railway.md
│   ├── supabase.md
│   └── vercel.md
├── getting-started/        # 2 files - Onboarding
│   ├── environment-setup.md
│   └── first-run.md
├── guides/                 # 15 files - Mixed audience how-tos
│   ├── account.md
│   ├── adding-new-worker.md
│   ├── admin-chat-logs.md
│   ├── admin-panel.md
│   ├── chat-interface.md
│   ├── chat-query-examples.md
│   ├── companies-page.md
│   ├── credit-system.md
│   ├── games-page.md
│   ├── personalization.md
│   ├── running-workers.md
│   ├── search-discovery.md
│   ├── theming.md
│   ├── troubleshooting.md
│   └── updates-page.md
├── reference/              # 6 files - Technical reference
│   ├── api-endpoints.md
│   ├── internal-api.md
│   ├── new-metrics.md
│   ├── pics-data-fields.md
│   ├── rate-limits.md
│   └── sql-examples.md
├── releases/               # 7 files - Version history
│   ├── v2.0-new-design.md
│   ├── v2.1-velocity-auth.md
│   ├── v2.2-ccu-steamspy.md
│   ├── v2.3-embedding-optimization.md
│   ├── v2.4-personalization.md
│   ├── v2.5-companies-page.md
│   └── v2.6-games-page.md
├── specs/                  # Design specifications
│   └── archived/
└── archive/                # Deprecated docs
```

---

## Proposed Structure

```
docs/
├── README.md                    # Updated with audience navigation
├── START-HERE.md                # NEW: Role-based quick start guide
│
├── user-guide/                  # RENAMED from guides/, end-user focused
│   ├── getting-started.md       # MOVED from getting-started/first-run.md
│   ├── games-page.md
│   ├── companies-page.md
│   ├── chat-interface.md
│   ├── chat-query-examples.md
│   ├── search-discovery.md
│   ├── personalization.md
│   ├── account.md
│   ├── credit-system.md
│   └── theming.md
│
├── admin-guide/                 # NEW: Administrator focused
│   ├── overview.md              # NEW: Admin quick start
│   ├── dashboard.md             # MOVED from guides/admin-panel.md
│   ├── user-management.md       # EXTRACTED from admin-panel.md
│   ├── waitlist.md              # EXTRACTED from admin-panel.md
│   ├── usage-analytics.md       # EXTRACTED from admin-panel.md
│   ├── chat-logs.md             # MOVED from guides/admin-chat-logs.md
│   ├── credits.md               # Admin credit management (new)
│   └── troubleshooting.md       # MOVED from guides/troubleshooting.md
│
├── developer-guide/             # NEW: Developer/contributor focused
│   ├── setup.md                 # MOVED from getting-started/environment-setup.md
│   ├── architecture/            # MOVED from architecture/
│   │   ├── overview.md
│   │   ├── database-schema.md
│   │   ├── sync-pipeline.md
│   │   ├── chat-data-system.md
│   │   ├── design-system.md
│   │   └── data-sources.md
│   ├── features/                # NEW: Per-feature technical docs
│   │   ├── games-page.md        # MOVED from architecture/games-page.md
│   │   ├── companies-page.md    # MOVED from architecture/companies-page.md
│   │   ├── admin-dashboard.md   # MOVED from architecture/admin-dashboard.md
│   │   └── personalization.md   # MOVED from architecture/personalized-dashboard.md
│   ├── workers/                 # NEW: Worker documentation
│   │   ├── overview.md          # NEW: Worker system overview
│   │   ├── adding-workers.md    # MOVED from guides/adding-new-worker.md
│   │   └── running-workers.md   # MOVED from guides/running-workers.md
│   └── deployment/              # MOVED from deployment/
│       ├── vercel.md
│       ├── supabase.md
│       ├── railway.md
│       └── fly-io.md
│
├── api/                         # NEW: Consolidated API documentation
│   ├── overview.md              # NEW: API overview
│   ├── internal-api.md          # MOVED from reference/internal-api.md
│   ├── steam-api.md             # RENAMED from reference/api-endpoints.md
│   ├── streaming-api.md         # EXTRACTED from chat-data-system.md
│   └── rate-limits.md           # MOVED from reference/rate-limits.md
│
├── reference/                   # Lookup tables and data references
│   ├── database-enums.md        # NEW: Extracted from database-schema.md
│   ├── pics-data-fields.md
│   ├── new-metrics.md
│   └── sql-examples.md
│
├── releases/                    # UNCHANGED
│   └── ...
│
├── specs/                       # UNCHANGED
│   └── ...
│
└── archive/                     # UNCHANGED
    └── ...
```

---

## Migration Plan

### Phase 1: Create New Folders and START-HERE.md

1. Create folders:
   - `docs/user-guide/`
   - `docs/admin-guide/`
   - `docs/developer-guide/`
   - `docs/developer-guide/architecture/`
   - `docs/developer-guide/features/`
   - `docs/developer-guide/workers/`
   - `docs/developer-guide/deployment/`
   - `docs/api/`

2. Create `docs/START-HERE.md` with content:
   ```markdown
   # PublisherIQ Documentation

   Welcome! Choose your path based on your role:

   ## I'm a User
   Learn how to use PublisherIQ to discover and analyze Steam games.
   **Start here:** [User Guide](./user-guide/getting-started.md)

   ## I'm an Administrator
   Manage users, monitor system health, and configure settings.
   **Start here:** [Admin Guide](./admin-guide/overview.md)

   ## I'm a Developer
   Contribute to PublisherIQ or deploy your own instance.
   **Start here:** [Developer Guide](./developer-guide/setup.md)

   ## Quick Links
   - [API Documentation](./api/overview.md)
   - [Release Notes](./releases/)
   - [Reference Tables](./reference/)
   ```

### Phase 2: Move User Guide Files

| From | To |
|------|-----|
| `guides/games-page.md` | `user-guide/games-page.md` |
| `guides/companies-page.md` | `user-guide/companies-page.md` |
| `guides/chat-interface.md` | `user-guide/chat-interface.md` |
| `guides/chat-query-examples.md` | `user-guide/chat-query-examples.md` |
| `guides/search-discovery.md` | `user-guide/search-discovery.md` |
| `guides/personalization.md` | `user-guide/personalization.md` |
| `guides/account.md` | `user-guide/account.md` |
| `guides/credit-system.md` | `user-guide/credit-system.md` |
| `guides/theming.md` | `user-guide/theming.md` |
| `getting-started/first-run.md` | `user-guide/getting-started.md` |

### Phase 3: Move Admin Guide Files

| From | To |
|------|-----|
| `guides/admin-panel.md` | `admin-guide/dashboard.md` |
| `guides/admin-chat-logs.md` | `admin-guide/chat-logs.md` |
| `guides/troubleshooting.md` | `admin-guide/troubleshooting.md` |

Create new file: `admin-guide/overview.md` with admin quick start content.

### Phase 4: Move Developer Guide Files

| From | To |
|------|-----|
| `getting-started/environment-setup.md` | `developer-guide/setup.md` |
| `architecture/overview.md` | `developer-guide/architecture/overview.md` |
| `architecture/database-schema.md` | `developer-guide/architecture/database-schema.md` |
| `architecture/sync-pipeline.md` | `developer-guide/architecture/sync-pipeline.md` |
| `architecture/chat-data-system.md` | `developer-guide/architecture/chat-data-system.md` |
| `architecture/design-system.md` | `developer-guide/architecture/design-system.md` |
| `architecture/data-sources.md` | `developer-guide/architecture/data-sources.md` |
| `architecture/games-page.md` | `developer-guide/features/games-page.md` |
| `architecture/companies-page.md` | `developer-guide/features/companies-page.md` |
| `architecture/admin-dashboard.md` | `developer-guide/features/admin-dashboard.md` |
| `architecture/personalized-dashboard.md` | `developer-guide/features/personalization.md` |
| `guides/adding-new-worker.md` | `developer-guide/workers/adding-workers.md` |
| `guides/running-workers.md` | `developer-guide/workers/running-workers.md` |
| `deployment/*` | `developer-guide/deployment/*` |

### Phase 5: Create API Section

| From | To |
|------|-----|
| `reference/internal-api.md` | `api/internal-api.md` |
| `reference/api-endpoints.md` | `api/steam-api.md` |
| `reference/rate-limits.md` | `api/rate-limits.md` |

Extract streaming API section from `chat-data-system.md` into `api/streaming-api.md`.

Create `api/overview.md` with API navigation.

### Phase 6: Update All Internal Links

After moving files, update all internal links in:
- Every moved file (relative paths will change)
- `docs/README.md`
- `CLAUDE.md` (if it references doc paths)

### Phase 7: Clean Up

1. Delete empty folders:
   - `docs/guides/`
   - `docs/getting-started/`
   - `docs/architecture/`
   - `docs/deployment/`

2. Update `docs/README.md` to reflect new structure

3. Add cross-reference headers to related docs:
   ```markdown
   > **Related:** [Games Page User Guide](../user-guide/games-page.md)
   ```

---

## File Cross-Reference Map

For features with both user and developer docs, add cross-references:

| Feature | User Doc | Developer Doc |
|---------|----------|---------------|
| Games Page | `user-guide/games-page.md` | `developer-guide/features/games-page.md` |
| Companies Page | `user-guide/companies-page.md` | `developer-guide/features/companies-page.md` |
| Chat | `user-guide/chat-interface.md` | `developer-guide/architecture/chat-data-system.md` |
| Personalization | `user-guide/personalization.md` | `developer-guide/features/personalization.md` |
| Admin Panel | `admin-guide/dashboard.md` | `developer-guide/features/admin-dashboard.md` |

---

## New Files to Create

| File | Content Description |
|------|---------------------|
| `START-HERE.md` | Role-based navigation hub |
| `admin-guide/overview.md` | Admin quick start, links to sub-pages |
| `developer-guide/workers/overview.md` | Worker system introduction |
| `api/overview.md` | API documentation navigation |
| `api/streaming-api.md` | Extracted from chat-data-system.md |

---

## Validation Checklist

After migration, verify:

- [ ] All files moved to correct locations
- [ ] All internal links updated and working
- [ ] No broken links in any document
- [ ] README.md reflects new structure
- [ ] CLAUDE.md updated if needed
- [ ] Each guide has appropriate cross-references
- [ ] START-HERE.md tested for clarity
- [ ] Old empty folders deleted

---

## Notes

- **Do not delete any content** - only move and reorganize
- **Preserve git history** - use `git mv` for moves
- **Update one section at a time** - commit after each phase
- **Test links** - run a link checker after completion
