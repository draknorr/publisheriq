# PublisherIQ Documentation

Welcome to the PublisherIQ documentation. This guide covers everything you need to use, administer, and develop the Steam data acquisition platform.

**New here?** Start with [START-HERE.md](START-HERE.md) to find the right documentation for your role.

---

## Documentation Structure

| Section | Audience | Description |
|---------|----------|-------------|
| [User Guide](user-guide/) | End Users | How to use PublisherIQ features |
| [Admin Guide](admin-guide/) | Administrators | System monitoring, user management, troubleshooting |
| [Developer Guide](developer-guide/) | Developers | Architecture, setup, deployment, contributing |
| [API](api/) | Developers | Internal and external API documentation |
| [Reference](reference/) | All | Data dictionaries, SQL patterns, metrics |
| [Releases](releases/) | All | Version release notes and changelogs |

---

## Latest Release

**[v2.6 - Games Page](releases/v2.6-games-page.md)** (January 16, 2026)

**Comprehensive Game Discovery**
- Browse all Steam apps (games, DLC, demos) with type toggle
- 12 discovery presets: Top Games, Rising Stars, Hidden Gems, Momentum, etc.
- 12 stackable quick filters: Popular, Trending, Well Reviewed, Free, Indie, Steam Deck, etc.
- 9 advanced filter categories with 30+ parameters
- 33 customizable columns across 9 metric categories
- 6 novel computed metrics: Momentum, Sentiment Delta, Active %, Review Rate, Value Score, vs Publisher Avg
- Compare mode: side-by-side comparison of 2-5 games
- CSV/JSON export with configurable columns
- Saved views for filter configurations (max 10)
- Inline CCU sparkline visualizations

---

## User Guide

Learn how to use PublisherIQ:

- **[Getting Started](user-guide/getting-started.md)** - First run and overview
- **[Global Search](user-guide/search.md)** - Quick search with ⌘K
- **[Keyboard Shortcuts](user-guide/keyboard-shortcuts.md)** - All keyboard shortcuts
- **[Insights Page](user-guide/insights-page.md)** - Top games, newest releases, trending
- **[Games Page](user-guide/games-page.md)** - Game discovery and analytics
- **[Companies Page](user-guide/companies-page.md)** - Publishers and developers
- **[Chat Interface](user-guide/chat-interface.md)** - Natural language queries
- **[Chat Query Examples](user-guide/chat-query-examples.md)** - 60+ example queries
- **[Search & Discovery](user-guide/search-discovery.md)** - Concept search and similarity
- **[Personalization](user-guide/personalization.md)** - Pinning, alerts, and notifications
- **[Account](user-guide/account.md)** - Profile and transactions
- **[Credit System](user-guide/credit-system.md)** - How credits work
- **[Theming](user-guide/theming.md)** - Light and dark themes

---

## Admin Guide

Manage and monitor PublisherIQ:

- **[Overview](admin-guide/overview.md)** - Admin quick start
- **[Dashboard](admin-guide/dashboard.md)** - System health, users, analytics
- **[Chat Logs](admin-guide/chat-logs.md)** - Query debugging
- **[Troubleshooting](admin-guide/troubleshooting.md)** - Common issues

---

## Developer Guide

Contribute to or deploy PublisherIQ:

### Setup
- **[Prerequisites](developer-guide/prerequisites.md)** - Required tools
- **[Installation](developer-guide/installation.md)** - Clone and install
- **[Environment Setup](developer-guide/setup.md)** - Configure variables

### Architecture
- **[System Overview](developer-guide/architecture/overview.md)** - High-level design
- **[Database Schema](developer-guide/architecture/database-schema.md)** - Tables and SQL
- **[Sync Pipeline](developer-guide/architecture/sync-pipeline.md)** - Data flow
- **[Chat Data System](developer-guide/architecture/chat-data-system.md)** - LLM and Cube.js
- **[Design System](developer-guide/architecture/design-system.md)** - UI and themes
- **[Data Sources](developer-guide/architecture/data-sources.md)** - External APIs

### Features
- **[Games Page](developer-guide/features/games-page.md)** - Technical details
- **[Companies Page](developer-guide/features/companies-page.md)** - Implementation
- **[Admin Dashboard](developer-guide/features/admin-dashboard.md)** - Architecture
- **[Personalization](developer-guide/features/personalization.md)** - Pins and alerts
- **[Smart Query Suggestions](developer-guide/features/smart-query-suggestions.md)** - Autocomplete

### Workers
- **[Overview](developer-guide/workers/overview.md)** - Worker system
- **[Running Workers](developer-guide/workers/running-workers.md)** - Manual execution
- **[Adding Workers](developer-guide/workers/adding-workers.md)** - Create new workers

### Deployment
- **[Vercel](developer-guide/deployment/vercel.md)** - Dashboard deployment
- **[Fly.io](developer-guide/deployment/fly-io.md)** - Cube.js deployment
- **[Railway](developer-guide/deployment/railway.md)** - PICS service
- **[Supabase](developer-guide/deployment/supabase.md)** - Database setup
- **[GitHub Actions](developer-guide/deployment/github-actions.md)** - Scheduled syncs

---

## API Documentation

- **[Overview](api/overview.md)** - API navigation
- **[Streaming API](api/streaming-api.md)** - Chat SSE protocol
- **[Internal API](api/internal-api.md)** - Dashboard endpoints
- **[Steam API](api/steam-api.md)** - External API specs
- **[Rate Limits](api/rate-limits.md)** - All rate limits

---

## Reference

Technical lookup documentation:

- **[New Metrics](reference/new-metrics.md)** - Estimated played hours
- **[PICS Data Fields](reference/pics-data-fields.md)** - PICS field reference
- **[SQL Examples](reference/sql-examples.md)** - Query patterns
- **[Data Gaps Analysis](reference/data-gaps-analysis.md)** - Coverage analysis
- **[Data Sources Comprehensive](reference/data-sources-comprehensive.md)** - Full API reference

---

## Previous Releases

- **[v2.5 - Companies Page](releases/v2.5-companies-page.md)** - Unified publishers/developers
- **[v2.4 - Personalization](releases/v2.4-personalization.md)** - Pins and alerts
- **[v2.3 - Embedding Optimization](releases/v2.3-embedding-optimization.md)** - 10x faster sync
- **[v2.2 - CCU & SteamSpy](releases/v2.2-ccu-steamspy.md)** - Tiered CCU tracking
- **[v2.1 - Velocity & Auth](releases/v2.1-velocity-auth.md)** - Auth and velocity sync
- **[v2.0 - New Design](releases/v2.0-new-design.md)** - Design system overhaul

---

## Project Structure

```
publisheriq/
├── apps/admin/                # Next.js 15 admin dashboard (Vercel)
├── packages/
│   ├── cube/                  # Cube.js semantic layer (Fly.io)
│   ├── database/              # Supabase client + types
│   ├── ingestion/             # Data collection workers
│   ├── qdrant/                # Vector database client
│   └── shared/                # Utilities and constants
├── services/pics-service/     # Python PICS microservice (Railway)
├── supabase/migrations/       # Database schema (Supabase)
├── docs/                      # This documentation
│   ├── user-guide/            # End user documentation
│   ├── admin-guide/           # Administrator documentation
│   ├── developer-guide/       # Developer documentation
│   ├── api/                   # API documentation
│   ├── reference/             # Technical references
│   ├── releases/              # Release notes
│   └── archive/               # Historical documents
└── .github/workflows/         # Scheduled sync jobs
```

---

## Archive

Historical implementation plans are preserved in [archive/](archive/) for reference.
