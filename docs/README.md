# PublisherIQ Documentation

Welcome to the PublisherIQ documentation. This guide covers everything you need to set up, deploy, and work with the Steam data acquisition platform.

## Quick Navigation

| Section | Description |
|---------|-------------|
| [Getting Started](getting-started/) | Installation, setup, and first run |
| [Architecture](architecture/) | System design, data sources, database schema |
| [Deployment](deployment/) | Vercel, Railway, GitHub Actions, Supabase |
| [Guides](guides/) | User guides and tutorials |
| [Reference](reference/) | API specs, data dictionaries, rate limits |
| [Releases](releases/) | Version release notes and changelogs |

---

## Latest Release

**[v2.1 - Velocity & Auth](releases/v2.1-velocity-auth.md)** (January 8, 2026)

Two major new features:

**Velocity-Based Review Sync Scheduling**
- Dynamic sync intervals based on review velocity (4h/12h/24h/72h)
- New `review_deltas` table tracking daily review changes
- `review_velocity_stats` materialized view for pre-computed metrics
- New Cube.js cubes: ReviewVelocity, ReviewDeltas
- Velocity tiers: high (≥5/day), medium (1-5/day), low (0.1-1/day), dormant (<0.1/day)

**User Authentication & Credits System**
- Magic link authentication (passwordless via Supabase)
- Invite-only waitlist with admin approval workflow
- Credit-based usage tracking with reservation pattern
- Per-user rate limits (20/minute, 200/hour)
- New admin pages: `/admin/users`, `/admin/waitlist`, `/admin/usage`

**Also in v2.1:**
- New LLM tool: `lookup_games` for searching games by name
- Cube.js model updates (11 cubes total)
- New landing page at `/` with dashboard moved to `/dashboard`

---

## Previous Releases

**[v2.0 - New Design](releases/v2.0-new-design.md)** (January 2026)

Major visual and functional overhaul including:
- Complete design system with dual light/dark themes
- 66% query reduction in admin dashboard
- New estimated played hours metrics
- Enhanced chat/LLM capabilities with Cube.js semantic layer
- Mobile-responsive layouts
- Vector similarity search via Qdrant Cloud

---

## Getting Started

New to PublisherIQ? Start here:

1. **[Prerequisites](getting-started/prerequisites.md)** - Tools and accounts you'll need
2. **[Installation](getting-started/installation.md)** - Clone and set up the project
3. **[Environment Setup](getting-started/environment-setup.md)** - Configure all environment variables
4. **[First Run](getting-started/first-run.md)** - Verify everything works

---

## Architecture

Understand how PublisherIQ works:

- **[System Overview](architecture/overview.md)** - High-level architecture and component diagram
- **[Design System](architecture/design-system.md)** - Theme system, color palette, typography, components
- **[Admin Dashboard](architecture/admin-dashboard.md)** - Dashboard architecture and RPC optimizations
- **[Chat Data System](architecture/chat-data-system.md)** - Complete chat/LLM architecture, Cube.js schemas, and tools
- **[Data Sources](architecture/data-sources.md)** - Steam APIs, SteamSpy, PICS service
- **[Database Schema](architecture/database-schema.md)** - Tables, relationships, SQL patterns
- **[Sync Pipeline](architecture/sync-pipeline.md)** - How data flows through the system

---

## Deployment

Deploy PublisherIQ to production:

- **[Vercel](deployment/vercel.md)** - Deploy the admin dashboard
- **[Fly.io](deployment/flyio.md)** - Deploy the Cube.js semantic layer
- **[Railway](deployment/railway.md)** - Deploy the PICS service
- **[GitHub Actions](deployment/github-actions.md)** - Configure scheduled sync jobs
- **[Supabase](deployment/supabase.md)** - Set up the database

---

## Guides

How-to guides for common tasks:

- **[Theming](guides/theming.md)** - Using and customizing light/dark themes
- **[Chat Interface](guides/chat-interface.md)** - Natural language queries via Cube.js with entity linking
- **[Admin: Chat Logs](guides/admin-chat-logs.md)** - Analytics and debugging for chat queries
- **[Running Workers](guides/running-workers.md)** - Manual worker execution
- **[Adding New Workers](guides/adding-new-worker.md)** - Developer guide for new sync jobs
- **[Troubleshooting](guides/troubleshooting.md)** - Common issues and solutions

---

## Reference

Technical reference documentation:

- **[New Metrics](reference/new-metrics.md)** - Estimated played hours and monthly metrics
- **[API Endpoints](reference/api-endpoints.md)** - Steam API specifications
- **[PICS Data Fields](reference/pics-data-fields.md)** - PICS field reference
- **[Rate Limits](reference/rate-limits.md)** - All API rate limits
- **[SQL Examples](reference/sql-examples.md)** - Query patterns for the chat interface

---

## Project Structure

```
publisheriq/
├── apps/admin/           # Next.js 15 admin dashboard (Vercel)
├── packages/
│   ├── cube/             # Cube.js semantic layer models (Fly.io)
│   ├── database/         # Supabase client + types
│   ├── ingestion/        # Data collection workers + embedding sync
│   ├── qdrant/           # Vector database client (Qdrant Cloud)
│   └── shared/           # Utilities and constants
├── services/pics-service/# Python PICS microservice (Railway)
├── supabase/migrations/  # Database schema (Supabase)
├── docs/                 # This documentation
└── .github/workflows/    # Scheduled sync jobs (GitHub Actions)
```

**Deployment Architecture:**
- **Dashboard**: Vercel (Next.js 15)
- **Semantic Layer**: Fly.io (Cube.js)
- **Database**: Supabase (PostgreSQL)
- **Vector Search**: Qdrant Cloud
- **PICS Service**: Railway (Python)
- **Scheduled Syncs**: GitHub Actions

See individual package READMEs for more details:
- [apps/admin/README.md](../apps/admin/README.md)
- [packages/database/README.md](../packages/database/README.md)
- [packages/ingestion/README.md](../packages/ingestion/README.md)
- [packages/qdrant/README.md](../packages/qdrant/README.md)
- [packages/shared/README.md](../packages/shared/README.md)
- [services/pics-service/README.md](../services/pics-service/README.md)

---

## Archive

Historical implementation plans are preserved in [archive/](archive/) for reference.
