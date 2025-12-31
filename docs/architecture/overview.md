# System Architecture Overview

PublisherIQ is a Steam data acquisition platform that collects, stores, and analyzes game metadata, publisher information, and review trends. This document describes the high-level architecture.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCES                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Steam APIs          SteamSpy API        PICS Service                   │
│  ├─ App List         └─ CCU, Owners      └─ Tags, Genres               │
│  ├─ Storefront          Playtime, Tags      Relationships              │
│  ├─ Reviews                                  Steam Deck                 │
│  └─ Histogram                                                           │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          INGESTION LAYER                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  GitHub Actions (Scheduled)                                             │
│  ├─ applist-sync      → Steam App List API                              │
│  ├─ steamspy-sync     → SteamSpy bulk data                              │
│  ├─ storefront-sync   → Game metadata                                   │
│  ├─ reviews-sync      → Review counts                                   │
│  ├─ histogram-sync    → Monthly review trends                           │
│  └─ trends-calc       → Compute trend metrics                           │
│                                                                         │
│  Railway Service (Always On)                                            │
│  └─ pics-service      → Real-time PICS changes                          │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  Supabase (PostgreSQL)                                                  │
│  ├─ apps              Game/DLC/Demo records                             │
│  ├─ publishers        Publisher entities                                │
│  ├─ developers        Developer entities                                │
│  ├─ daily_metrics     Daily snapshots (CCU, reviews, owners)            │
│  ├─ review_histogram  Monthly review buckets                            │
│  ├─ app_trends        Computed 30/90 day trends                         │
│  └─ sync_status       Per-app sync tracking                             │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Next.js Admin Dashboard (Vercel)                                       │
│  ├─ /apps             Browse games                                      │
│  ├─ /publishers       Browse publishers                                 │
│  ├─ /developers       Browse developers                                 │
│  ├─ /sync             Monitor sync jobs                                 │
│  └─ /chat             AI-powered query interface                        │
└─────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 15 (React 19) | Admin dashboard |
| Styling | TailwindCSS | UI components |
| Database | Supabase (PostgreSQL) | Data storage |
| Workers | GitHub Actions | Scheduled data collection |
| PICS Service | Python + SteamKit2 | Real-time Steam data |
| AI | Claude 3.5 / GPT-4o | Natural language queries |
| Deployment | Vercel, Railway | Hosting |

## Monorepo Structure

```
publisheriq/
├── apps/
│   └── admin/                 # Next.js 15 dashboard
│       ├── src/app/           # App router pages
│       ├── src/components/    # React components
│       └── src/lib/           # Utilities, LLM integration
│
├── packages/
│   ├── database/              # Supabase client & types
│   │   ├── src/client.ts      # createServiceClient()
│   │   └── src/types.ts       # Generated types
│   │
│   ├── ingestion/             # Data collection
│   │   ├── src/apis/          # API clients
│   │   ├── src/workers/       # Sync workers
│   │   └── src/utils/         # Rate limiter, retry
│   │
│   └── shared/                # Shared utilities
│       ├── src/constants.ts   # Configuration
│       ├── src/logger.ts      # Logging
│       └── src/errors.ts      # Error types
│
├── services/
│   └── pics-service/          # Python microservice
│       ├── src/steam/         # SteamKit2 client
│       ├── src/workers/       # Bulk sync, change monitor
│       └── src/database/      # Supabase operations
│
├── supabase/
│   └── migrations/            # Database schema
│
└── .github/
    └── workflows/             # Scheduled sync jobs
```

## Key Components

### Admin Dashboard

The Next.js application provides:
- **Data browsing** - Tables for apps, publishers, developers
- **Sync monitoring** - Job status, error tracking
- **Chat interface** - Natural language database queries

### Ingestion Workers

TypeScript workers in `packages/ingestion` fetch data from various sources:
- Rate-limited API clients with retry logic
- Priority-based scheduling (active games sync more often)
- Error tracking and circuit breaker patterns

### PICS Service

Python microservice for Steam's Product Info Cache Server:
- Direct connection to Steam's internal data
- Two modes: bulk sync (initial) and change monitor (ongoing)
- Extracts tags, genres, relationships, Steam Deck status

### Database

PostgreSQL via Supabase with:
- Strongly typed schema with enums
- Junction tables for many-to-many relationships
- Optimized indexes for common queries
- RPC functions for safe query execution

## Data Flow

1. **Discovery** - `applist-sync` fetches all Steam app IDs
2. **Enrichment** - `storefront-sync` adds metadata (developer, publisher, release date)
3. **Metrics** - `steamspy-sync` adds CCU, owner estimates, tags
4. **Reviews** - `reviews-sync` adds review counts and scores
5. **Trends** - `histogram-sync` + `trends-calc` compute trend data
6. **PICS** - Real-time updates from Steam's internal data

## Security

- **Read-only queries** - Chat interface only executes SELECT
- **Dual validation** - Client-side + database function validation
- **Service keys** - Server-side only, never exposed to browser
- **Rate limiting** - Token bucket algorithm prevents API abuse

## Related Documentation

- [Data Sources](data-sources.md) - API specifications
- [Database Schema](database-schema.md) - Table definitions
- [Sync Pipeline](sync-pipeline.md) - Data flow details
