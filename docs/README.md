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
- **[Chat Data System](architecture/chat-data-system.md)** - Complete chat/LLM architecture, Cube.js schemas, and tools
- **[Data Sources](architecture/data-sources.md)** - Steam APIs, SteamSpy, PICS service
- **[Database Schema](architecture/database-schema.md)** - Tables, relationships, SQL patterns
- **[Sync Pipeline](architecture/sync-pipeline.md)** - How data flows through the system

---

## Deployment

Deploy PublisherIQ to production:

- **[Vercel](deployment/vercel.md)** - Deploy the admin dashboard
- **[Railway](deployment/railway.md)** - Deploy the PICS service
- **[GitHub Actions](deployment/github-actions.md)** - Configure scheduled sync jobs
- **[Supabase](deployment/supabase.md)** - Set up the database

---

## Guides

How-to guides for common tasks:

- **[Chat Interface](guides/chat-interface.md)** - Natural language queries via Cube.js with entity linking
- **[Admin: Chat Logs](guides/admin-chat-logs.md)** - Analytics and debugging for chat queries
- **[Running Workers](guides/running-workers.md)** - Manual worker execution
- **[Adding New Workers](guides/adding-new-worker.md)** - Developer guide for new sync jobs
- **[Troubleshooting](guides/troubleshooting.md)** - Common issues and solutions

---

## Reference

Technical reference documentation:

- **[API Endpoints](reference/api-endpoints.md)** - Steam API specifications
- **[PICS Data Fields](reference/pics-data-fields.md)** - PICS field reference
- **[Rate Limits](reference/rate-limits.md)** - All API rate limits
- **[SQL Examples](reference/sql-examples.md)** - Query patterns for the chat interface

---

## Project Structure

```
publisheriq/
├── apps/admin/           # Next.js admin dashboard
├── packages/
│   ├── cube/             # Cube.js semantic layer models
│   ├── database/         # Supabase client + types
│   ├── ingestion/        # Data collection workers + embedding sync
│   ├── qdrant/           # Vector database client for similarity search
│   └── shared/           # Utilities and constants
├── services/pics-service/# Python PICS microservice
├── supabase/migrations/  # Database schema
└── .github/workflows/    # Scheduled sync jobs
```

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
