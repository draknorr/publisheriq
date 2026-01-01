# System Architecture Overview

PublisherIQ is a Steam data acquisition platform that collects, stores, and analyzes game metadata, publisher information, and review trends. This document describes the high-level architecture.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCES                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Steam APIs          SteamSpy API        PICS Service                   │
│  ├─ App List         └─ CCU, Owners      └─ Tags, Genres               │
│  ├─ Storefront          Playtime, Tags      Categories, Franchises     │
│  ├─ Reviews                                  Steam Deck Compatibility   │
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
│  ├─ trends-calc       → Compute trend metrics                           │
│  └─ embedding-sync    → Vector embeddings for similarity search         │
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
│  ├─ apps              Game/DLC/Demo records + PICS metadata             │
│  ├─ publishers        Publisher entities                                │
│  ├─ developers        Developer entities                                │
│  ├─ daily_metrics     Daily snapshots (CCU, reviews, owners)            │
│  ├─ review_histogram  Monthly review buckets                            │
│  ├─ app_trends        Computed 30/90 day trends                         │
│  ├─ sync_status       Per-app sync tracking                             │
│  ├─ steam_tags/genres PICS reference tables                             │
│  └─ app_steam_deck    Steam Deck compatibility                          │
│                                                                         │
│  Qdrant Cloud (Vector Database)                                         │
│  ├─ publisheriq_games           Game embeddings for similarity          │
│  ├─ publisheriq_publishers_*    Publisher portfolio/identity vectors    │
│  └─ publisheriq_developers_*    Developer portfolio/identity vectors    │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Next.js Admin Dashboard (Vercel)                                       │
│  ├─ /apps             Browse games with similarity search               │
│  ├─ /publishers       Browse publishers with similar entities           │
│  ├─ /developers       Browse developers with similar entities           │
│  ├─ /sync             Monitor sync jobs                                 │
│  └─ /chat             AI-powered query + similarity search              │
└─────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 15 (React 19) | Admin dashboard |
| Styling | TailwindCSS | UI components |
| Database | Supabase (PostgreSQL) | Data storage |
| Vector DB | Qdrant Cloud | Semantic similarity search |
| Embeddings | OpenAI text-embedding-3-small | Vector generation (1536 dimensions) |
| Workers | GitHub Actions | Scheduled data collection |
| PICS Service | Python + SteamKit2 | Real-time Steam data |
| AI | Claude (Anthropic) | Natural language queries + tool use |
| Deployment | Vercel, Railway | Hosting |

## Monorepo Structure

```
publisheriq/
├── apps/
│   └── admin/                 # Next.js 15 dashboard
│       ├── src/app/           # App router pages
│       ├── src/components/    # React components
│       └── src/lib/           # Utilities, LLM integration, Qdrant
│
├── packages/
│   ├── database/              # Supabase client & types
│   │   ├── src/client.ts      # createServiceClient()
│   │   └── src/types.ts       # Generated types
│   │
│   ├── ingestion/             # Data collection
│   │   ├── src/apis/          # API clients + embedding generation
│   │   ├── src/workers/       # Sync workers + embedding worker
│   │   └── src/utils/         # Rate limiter, retry
│   │
│   ├── qdrant/                # Vector database client
│   │   ├── src/client.ts      # Qdrant singleton client
│   │   ├── src/collections.ts # Collection schemas
│   │   ├── src/types.ts       # Payload type definitions
│   │   └── src/filter-builder.ts  # Query filter builders
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
- **Data browsing** - Tables for apps, publishers, developers with filtering
- **Sync monitoring** - Job status, error tracking, PICS metrics
- **Chat interface** - Natural language database queries with tool use
- **Similarity search** - Find semantically similar games, publishers, developers

### Ingestion Workers

TypeScript workers in `packages/ingestion` fetch data from various sources:
- Rate-limited API clients with retry logic
- Priority-based scheduling (active games sync more often)
- Error tracking and circuit breaker patterns
- Embedding generation for vector similarity search

### Vector Search

Semantic similarity powered by Qdrant Cloud:
- **5 collections**: Games, publishers (portfolio + identity), developers (portfolio + identity)
- **Embedding model**: OpenAI text-embedding-3-small (1536 dimensions)
- **Filters**: Popularity comparison, review quality, price, platforms, genres, tags
- **Hash-based change detection**: Only re-embeds when data changes
- **Integrated with chat**: LLM can call `find_similar` tool for recommendations

### PICS Service

Python microservice for Steam's Product Info Cache Server:
- Direct connection to Steam's internal data
- Two modes: bulk sync (initial) and change monitor (ongoing)
- Extracts tags, genres, categories, franchises, Steam Deck status
- Populates reference tables for structured querying

### Database

PostgreSQL via Supabase with:
- Strongly typed schema with enums
- Junction tables for many-to-many relationships (PICS data)
- Optimized indexes for common queries
- RPC functions for safe query execution and embedding sync

## Data Flow

1. **Discovery** - `applist-sync` fetches all Steam app IDs
2. **Enrichment** - `storefront-sync` adds metadata (developer, publisher, release date)
3. **Metrics** - `steamspy-sync` adds CCU, owner estimates, tags
4. **Reviews** - `reviews-sync` adds review counts and scores
5. **Trends** - `histogram-sync` + `trends-calc` compute trend data
6. **PICS** - Real-time updates from Steam's internal data (tags, genres, Steam Deck)
7. **Embeddings** - `embedding-sync` generates vectors for similarity search in Qdrant

## Security

- **Read-only queries** - Chat interface only executes SELECT
- **Dual validation** - Client-side + database function validation
- **Service keys** - Server-side only, never exposed to browser
- **Rate limiting** - Token bucket algorithm prevents API abuse

## Related Documentation

- [Data Sources](data-sources.md) - API specifications
- [Database Schema](database-schema.md) - Table definitions
- [Sync Pipeline](sync-pipeline.md) - Data flow details
