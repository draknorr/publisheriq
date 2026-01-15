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

**[v2.5 - Companies Page](releases/v2.5-companies-page.md)** (January 15, 2026)

**Unified Companies Dashboard**
- Browse publishers and developers in one unified view with type toggle
- 9 filter categories with 25+ parameters (metrics, growth, content, platforms, Steam Deck)
- 17 customizable columns across 7 metric categories
- Compare mode: side-by-side comparison of 2-5 companies
- CSV/JSON export with configurable columns
- Saved views for filter configurations
- Computed ratio columns: Revenue/Game, Owners/Game, Reviews/1K Owners
- Inline CCU sparkline visualizations

---

## Previous Releases

**[v2.4 - Personalization & Chat Enhancements](releases/v2.4-personalization.md)** (January 12, 2026)

- Pin games, publishers, developers to your personalized dashboard
- 8 alert types with configurable preferences and sensitivity
- New `search_by_concept` and `discover_trending` LLM tools
- Embedding optimization: 1536 → 512 dimensions (~90% storage savings)

**[v2.3 - Embedding Optimization](releases/v2.3-embedding-optimization.md)** (January 11, 2026)

- 10x faster embedding sync throughput through batch optimization
- Async Qdrant writes with end-of-sync verification
- OpenAI retry logic: 3 retries with exponential backoff
- Workflow timeout reduced from 120 to 60 minutes

**[v2.2 - CCU & SteamSpy Improvements](releases/v2.2-ccu-steamspy.md)** (January 9, 2026)

- Tiered CCU tracking: Tier 1 (hourly), Tier 2 (2-hourly), Tier 3 (3x daily rotation)
- Exact CCU from Steam's GetNumberOfCurrentPlayers API
- SteamSpy supplementary fetch for missing games
- Reviews API 3x faster, batch size 2x larger
- Priority calculation fix for never-synced apps

**[v2.1 - Velocity & Auth](releases/v2.1-velocity-auth.md)** (January 8, 2026)

- Velocity-based review sync scheduling (4h/12h/24h/72h tiers)
- User authentication with magic links
- Credit-based usage tracking
- New LLM tool: `lookup_games`

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
- **[Companies Page](architecture/companies-page.md)** - Unified publishers/developers page architecture
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

- **[Companies Page](guides/companies-page.md)** - Using the unified publishers/developers page
- **[Theming](guides/theming.md)** - Using and customizing light/dark themes
- **[Chat Interface](guides/chat-interface.md)** - Natural language queries via Cube.js with entity linking
- **[Chat Query Examples](guides/chat-query-examples.md)** - 60+ example queries organized by use case
- **[Personalization](guides/personalization.md)** - Pinning items and managing alerts
- **[Admin: Chat Logs](guides/admin-chat-logs.md)** - Analytics and debugging for chat queries
- **[Running Workers](guides/running-workers.md)** - Manual worker execution
- **[Adding New Workers](guides/adding-new-worker.md)** - Developer guide for new sync jobs
- **[Troubleshooting](guides/troubleshooting.md)** - Common issues and solutions

---

## Features

Feature documentation for specific capabilities:

- **[Smart Query Suggestions](features/smart-query-suggestions.md)** - Type-ahead autocomplete and post-response chips

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
