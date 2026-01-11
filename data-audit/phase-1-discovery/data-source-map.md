# PublisherIQ Data Source Map

> Phase 1: Discovery & Mapping
> Generated: January 9, 2026

---

## High-Level Architecture

```
                                    EXTERNAL DATA SOURCES
    ╔════════════════════════════════════════════════════════════════════════╗
    ║                                                                        ║
    ║  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ║
    ║  │ Steam Web   │  │  Steam      │  │  SteamSpy   │  │    Steam     │  ║
    ║  │    API      │  │ Storefront  │  │    API      │  │    PICS      │  ║
    ║  │             │  │    API      │  │             │  │  (SteamKit)  │  ║
    ║  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘  ║
    ║         │                │                │                 │         ║
    ╚═════════╪════════════════╪════════════════╪═════════════════╪═════════╝
              │                │                │                 │
              ▼                ▼                ▼                 ▼
    ╔═════════════════════════════════════════════════════════════════════════╗
    ║                        DATA INGESTION LAYER                             ║
    ║  ┌─────────────────────────────────────────────────────────────────────┐ ║
    ║  │                    GitHub Actions Workflows                         │ ║
    ║  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │ ║
    ║  │  │ applist  │ │storefront│ │ reviews  │ │steamspy  │ │embedding │  │ ║
    ║  │  │  -sync   │ │  -sync   │ │  -sync   │ │  -sync   │ │  -sync   │  │ ║
    ║  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │ ║
    ║  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │ ║
    ║  │  │histogram │ │ccu-sync  │ │velocity  │ │ trends   │ │ priority │  │ ║
    ║  │  │  -sync   │ │(hourly)  │ │  -calc   │ │  -calc   │ │  -calc   │  │ ║
    ║  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │ ║
    ║  └─────────────────────────────────────────────────────────────────────┘ ║
    ║                                                                         ║
    ║  ┌─────────────────────────────────────────────────────────────────────┐ ║
    ║  │              PICS Service (Railway - Python)                         │ ║
    ║  │              - Change monitor (30s polling)                          │ ║
    ║  │              - Bulk sync (on-demand)                                 │ ║
    ║  └─────────────────────────────────────────────────────────────────────┘ ║
    ╚═════════╪═══════════════════════════════════════════════════════════════╝
              │
              ▼
    ╔═════════════════════════════════════════════════════════════════════════╗
    ║                        PRIMARY DATA STORES                              ║
    ║                                                                         ║
    ║  ┌────────────────────────────────┐    ┌────────────────────────────┐  ║
    ║  │      SUPABASE POSTGRESQL       │    │      QDRANT CLOUD          │  ║
    ║  │  ┌──────────────────────────┐  │    │  ┌──────────────────────┐  │  ║
    ║  │  │ Core Tables (157K apps)  │  │    │  │ publisheriq_games    │  │  ║
    ║  │  │ apps, publishers, devs   │  │    │  │ (game embeddings)    │  │  ║
    ║  │  ├──────────────────────────┤  │    │  ├──────────────────────┤  │  ║
    ║  │  │ Metrics (1M+ daily rows) │  │    │  │ publishers_portfolio │  │  ║
    ║  │  │ daily_metrics, histogram │  │    │  │ publishers_identity  │  │  ║
    ║  │  ├──────────────────────────┤  │    │  ├──────────────────────┤  │  ║
    ║  │  │ PICS Data (2.4M+ tags)   │  │    │  │ developers_portfolio │  │  ║
    ║  │  │ tags, genres, categories │  │    │  │ developers_identity  │  │  ║
    ║  │  ├──────────────────────────┤  │    │  └──────────────────────┘  │  ║
    ║  │  │ Materialized Views (9)   │  │    │                            │  ║
    ║  │  │ publisher/dev_metrics    │  │    │  Dimensions: 1536          │  ║
    ║  │  └──────────────────────────┘  │    │  Model: text-embedding-3   │  ║
    ║  │                                │    │                            │  ║
    ║  │  Size: 1,622 MB                │    │  Quantization: int8        │  ║
    ║  └────────────────────────────────┘    └────────────────────────────┘  ║
    ╚════════════════════╪══════════════════════════════╪═════════════════════╝
                         │                              │
                         ▼                              │
    ╔═════════════════════════════════════════════════════════════════════════╗
    ║                        SEMANTIC / QUERY LAYER                           ║
    ║                                                                         ║
    ║  ┌─────────────────────────────────────────────────────────────────────┐ ║
    ║  │                    CUBE.JS (Fly.io)                                  │ ║
    ║  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                 │ ║
    ║  │  │  Discovery   │ │  Publisher   │ │  Developer   │                 │ ║
    ║  │  │    Cube      │ │   Metrics    │ │   Metrics    │                 │ ║
    ║  │  └──────────────┘ └──────────────┘ └──────────────┘                 │ ║
    ║  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                 │ ║
    ║  │  │ DailyMetrics │ │ReviewVelocity│ │ ReviewDeltas │                 │ ║
    ║  │  └──────────────┘ └──────────────┘ └──────────────┘                 │ ║
    ║  └─────────────────────────────────────────────────────────────────────┘ ║
    ╚═════════════════════════════════╪═══════════════════════════════════════╝
                                      │
                                      ▼
    ╔═════════════════════════════════════════════════════════════════════════╗
    ║                        APPLICATION LAYER                                ║
    ║                                                                         ║
    ║  ┌─────────────────────────────────────────────────────────────────────┐ ║
    ║  │              NEXT.JS ADMIN DASHBOARD (Vercel)                        │ ║
    ║  │  ┌──────────────────────────────────────────────────────────────┐   │ ║
    ║  │  │                    AI Chat Interface                          │   │ ║
    ║  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐             │   │ ║
    ║  │  │  │ query_  │ │ find_   │ │ search_ │ │ lookup_ │             │   │ ║
    ║  │  │  │analytics│ │ similar │ │ games   │ │ tools   │             │   │ ║
    ║  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘             │   │ ║
    ║  │  └──────────────────────────────────────────────────────────────┘   │ ║
    ║  │  ┌─────────────────┐ ┌─────────────────┐ ┌────────────────────┐    │ ║
    ║  │  │ Insights Page   │ │ Admin Dashboard │ │ Entity Pages       │    │ ║
    ║  │  │ (CCU analytics) │ │ (Sync status)   │ │ (Apps/Pubs/Devs)   │    │ ║
    ║  │  └─────────────────┘ └─────────────────┘ └────────────────────┘    │ ║
    ║  └─────────────────────────────────────────────────────────────────────┘ ║
    ║                                      │                                   ║
    ║                                      ▼                                   ║
    ║  ┌─────────────────────────────────────────────────────────────────────┐ ║
    ║  │                      EXTERNAL LLM SERVICES                           │ ║
    ║  │  ┌─────────────────────────┐  ┌─────────────────────────────────┐   │ ║
    ║  │  │ OpenAI (Primary)        │  │ OpenAI Embeddings                │   │ ║
    ║  │  │ - GPT-4o-mini (chat)    │  │ - text-embedding-3-small        │   │ ║
    ║  │  │ - Function calling      │  │ - 1536 dimensions               │   │ ║
    ║  │  └─────────────────────────┘  └─────────────────────────────────┘   │ ║
    ║  │  ┌─────────────────────────┐                                        │ ║
    ║  │  │ Anthropic (Optional)    │                                        │ ║
    ║  │  │ - Claude 3.5 Haiku      │                                        │ ║
    ║  │  └─────────────────────────┘                                        │ ║
    ║  └─────────────────────────────────────────────────────────────────────┘ ║
    ╚═════════════════════════════════════════════════════════════════════════╝
```

---

## Data Source Details

### 1. External Steam APIs

| Source | Type | Rate Limit | What It Provides | Authoritative For |
|--------|------|------------|------------------|-------------------|
| **Steam Web API** | REST | 100K/day | App list, exact CCU | Master app list |
| **Steam Storefront** | REST | ~200/5min | Metadata, prices, dev/pub names | Developer/Publisher relationships |
| **Steam Reviews** | REST | ~60/min | Review counts, sentiment | Review data |
| **Steam Histogram** | REST | ~60/min | Monthly review trends | Historical review distribution |
| **SteamSpy** | REST | 1/sec | CCU estimates, owner ranges, tags | Owner estimates (NOT dev/pub) |
| **Steam PICS** | Binary/SteamKit | Continuous | Tags, genres, categories, Steam Deck | Real-time metadata, compatibility |

### 2. Data Ingestion Flows

#### Flow A: App Discovery & Master List
```
Steam Web API (GetAppList)
    │
    ▼
applist-sync (daily 00:15 UTC)
    │
    ├── INSERT new apps → apps table
    └── UPDATE existing → apps table
```

#### Flow B: Game Metadata (Storefront)
```
Steam Storefront API
    │
    ▼
storefront-sync (5x daily)
    │
    ├── UPSERT → apps (metadata, prices, platforms)
    ├── UPSERT → publishers (via upsert_publisher())
    ├── UPSERT → developers (via upsert_developer())
    └── INSERT → app_publishers, app_developers (relationships)
```

#### Flow C: Review Data
```
Steam Reviews API ──► reviews-sync ──► daily_metrics (review counts)
                          │
Steam Histogram API ──► histogram-sync ──► review_histogram (monthly buckets)
                          │
                          ▼
                velocity-calculation
                          │
                          ▼
                review_deltas, sync_status.velocity_*
```

#### Flow D: SteamSpy Data
```
SteamSpy API (paginated)
    │
    ▼
steamspy-sync (daily 02:15 UTC)
    │
    ├── UPSERT → daily_metrics (CCU, owners, playtime)
    ├── UPSERT → app_tags (user-voted tags) [DEPRECATED]
    └── UPDATE → sync_status.last_steamspy_sync
```

#### Flow E: PICS Real-time Data
```
Steam PICS (SteamKit2)
    │
    ▼
PICS Service (Railway - continuous polling)
    │
    ├── UPSERT → steam_tags, steam_genres, steam_categories
    ├── UPSERT → app_steam_tags (ranked tags)
    ├── UPSERT → app_genres (with is_primary)
    ├── UPSERT → app_categories
    ├── UPSERT → app_franchises
    ├── UPSERT → app_steam_deck (compatibility data)
    └── UPDATE → apps (platforms, controller, scores)
```

#### Flow F: CCU Tiered Polling
```
Steam Web API (GetNumberOfCurrentPlayers)
    │
    ▼
ccu-sync / ccu-daily-sync
    │
    ├── Tier 1: Top 500 by CCU → hourly
    ├── Tier 2: Top 1000 new releases → every 2h
    └── Tier 3: All others → daily
    │
    ▼
ccu_snapshots → aggregate → daily_metrics.ccu_peak
```

#### Flow G: Vector Embeddings
```
OpenAI Embeddings API
    │
    ▼
embedding-sync (daily 03:00 UTC)
    │
    ├── Games: description + tags + genres
    │     └── UPSERT → Qdrant: publisheriq_games
    │
    ├── Publishers: top game descriptions
    │     ├── UPSERT → Qdrant: publisheriq_publishers_portfolio
    │     └── UPSERT → Qdrant: publisheriq_publishers_identity
    │
    └── Developers: top game descriptions
          ├── UPSERT → Qdrant: publisheriq_developers_portfolio
          └── UPSERT → Qdrant: publisheriq_developers_identity
```

---

## Database Table Relationships

```
                              ┌──────────────────┐
                              │      apps        │
                              │   (157,695)      │
                              └────────┬─────────┘
                                       │
         ┌───────────┬────────────────┬┴───────────────┬────────────┬────────────┐
         │           │                │                │            │            │
         ▼           ▼                ▼                ▼            ▼            ▼
  ┌────────────┐ ┌──────────┐ ┌─────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐
  │app_publish.│ │app_devs  │ │app_steam_tag│ │ app_genres │ │app_cats  │ │app_franch│
  │  (162K)    │ │ (170K)   │ │   (2.4M)    │ │  (456K)    │ │ (778K)   │ │  (36K)   │
  └─────┬──────┘ └────┬─────┘ └──────┬──────┘ └─────┬──────┘ └────┬─────┘ └────┬─────┘
        │             │              │              │             │            │
        ▼             ▼              ▼              ▼             ▼            ▼
  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐
  │publishers│ │developers│ │ steam_tags │ │steam_genres│ │steam_cats│ │franchises│
  │  (89K)   │ │  (105K)  │ │   (446)    │ │    (42)    │ │   (74)   │ │  (13K)   │
  └──────────┘ └──────────┘ └────────────┘ └────────────┘ └──────────┘ └──────────┘


                              ┌──────────────────┐
                              │      apps        │
                              └────────┬─────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         │                             │                             │
         ▼                             ▼                             ▼
  ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
  │  daily_metrics  │        │ review_histogram│        │   sync_status   │
  │    (1.07M)      │        │    (2.9M)       │        │    (157K)       │
  └─────────────────┘        └─────────────────┘        └─────────────────┘
         │
         ▼
  ┌─────────────────┐
  │latest_daily_metr│ (Materialized View)
  │    (151K)       │
  └─────────────────┘
```

---

## Application Component → Data Source Mapping

### Admin Dashboard Pages

| Page/Component | Primary Data Source | Cube.js Cube | Vector DB |
|----------------|---------------------|--------------|-----------|
| **Chat Interface** | Cube.js → PostgreSQL | All cubes | Qdrant (similarity) |
| **Insights - Top Games** | ccu_snapshots, apps | - | - |
| **Insights - Newest** | apps, ccu_snapshots | - | - |
| **Insights - Trending** | ccu_snapshots (period comparison) | - | - |
| **Admin Dashboard** | sync_jobs, sync_status, dashboard_stats_cache | - | - |
| **App Detail Pages** | apps + all junction tables | Discovery | - |
| **Publisher Pages** | publishers, publisher_metrics (MV) | PublisherMetrics | - |
| **Developer Pages** | developers, developer_metrics (MV) | DeveloperMetrics | - |

### Chat Interface Tools

| Tool | Data Sources Used | Query Method |
|------|-------------------|--------------|
| `query_analytics` | All Cube.js cubes | Cube.js REST API |
| `find_similar` | Qdrant collections | Vector similarity |
| `search_games` | apps + tags/genres/categories | Direct SQL |
| `lookup_publishers` | publishers | ILIKE search |
| `lookup_developers` | developers | ILIKE search |
| `lookup_tags` | steam_tags, steam_genres, steam_categories | Direct query |
| `lookup_games` | apps | ILIKE search |

### Sync Workers

| Worker | Input Source | Output Tables |
|--------|--------------|---------------|
| `applist-sync` | Steam Web API | apps |
| `storefront-sync` | Steam Storefront | apps, publishers, developers, app_publishers, app_developers |
| `reviews-sync` | Steam Reviews | daily_metrics |
| `histogram-sync` | Steam Histogram | review_histogram |
| `steamspy-sync` | SteamSpy API | daily_metrics, app_tags (deprecated) |
| `embedding-sync` | OpenAI + PostgreSQL | Qdrant collections |
| `ccu-tiered-sync` | Steam CCU API | ccu_snapshots, ccu_tier_assignments |
| `velocity-calculate` | review_deltas | sync_status, review_velocity_stats (MV) |
| `trends-calculate` | daily_metrics, review_histogram | app_trends |
| `priority-calculate` | Multiple tables | sync_status.priority_score |
| `refresh-views` | PostgreSQL | All materialized views |

---

## Data Freshness by Source

| Data Type | Update Frequency | Source | Latency |
|-----------|------------------|--------|---------|
| App list | Daily | Steam Web API | ~24h |
| Metadata (name, price) | 5x daily | Storefront | 4-5h |
| Dev/Pub relationships | 5x daily | Storefront | 4-5h |
| Review counts | 5x daily | Reviews API | 4-5h |
| CCU (Tier 1 games) | Hourly | Steam CCU API | ~1h |
| CCU (Tier 2 games) | Every 2h | Steam CCU API | ~2h |
| CCU (Tier 3 games) | Daily | Steam CCU API | ~24h |
| Tags/Genres/Categories | Real-time | PICS | ~30s |
| Steam Deck compatibility | Real-time | PICS | ~30s |
| SteamSpy estimates | Daily | SteamSpy | ~24h |
| Embeddings | Daily | OpenAI | ~24h |
| Materialized views | Daily | PostgreSQL | ~24h |

---

## Cross-System Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEPENDENCY CHAIN                                   │
└─────────────────────────────────────────────────────────────────────────────┘

1. APP DISCOVERY CHAIN
   Steam Web API → apps table → (all other sync jobs require apps to exist)

2. METRICS CHAIN
   apps → daily_metrics → latest_daily_metrics (MV) → Cube.js → Chat

3. PUBLISHER/DEVELOPER CHAIN
   Storefront → publishers/developers → app_publishers/app_developers
             → publisher_metrics (MV) → Cube.js → Chat
             → embedding-sync → Qdrant

4. TAG/GENRE CHAIN
   PICS → steam_tags/genres/categories → app_steam_tags/genres/categories
       → Discovery cube → Chat

5. VELOCITY CHAIN
   reviews-sync → review_deltas → velocity-calculate
               → sync_status.velocity_tier → reviews-sync (priority)

6. CCU CHAIN
   ccu-sync → ccu_snapshots → aggregate_daily_ccu_peaks()
           → daily_metrics.ccu_peak → latest_daily_metrics (MV)
           → recalculate_ccu_tiers() → ccu_tier_assignments

7. EMBEDDING CHAIN
   apps + tags + genres → embedding-sync → OpenAI → Qdrant
   publishers + games → embedding-sync → OpenAI → Qdrant
   developers + games → embedding-sync → OpenAI → Qdrant
```

---

## Critical Data Paths

### Path 1: User asks "What are the top indie games?"
```
User Query
    │
    ▼
Chat API (/api/chat/stream)
    │
    ├── query_analytics tool
    │     │
    │     ▼
    │   Cube.js (Discovery cube)
    │     │
    │     ▼
    │   PostgreSQL
    │   - apps
    │   - app_genres (WHERE genre = 'Indie')
    │   - latest_daily_metrics
    │
    └── Response formatted with entity links
```

### Path 2: User asks "Find games similar to Hollow Knight"
```
User Query
    │
    ▼
Chat API
    │
    ├── lookup_games tool (find appid)
    │     └── PostgreSQL: apps (ILIKE 'Hollow Knight')
    │
    └── find_similar tool
          │
          ▼
        Qdrant: publisheriq_games
          │
          └── Similarity search on game embedding
```

### Path 3: Sync worker refreshes review data
```
GitHub Actions (scheduled)
    │
    ▼
reviews-sync worker
    │
    ├── get_apps_for_reviews_sync() → sync_status
    │
    ├── For each app:
    │   ├── Fetch from Steam Reviews API
    │   ├── UPSERT → daily_metrics
    │   └── INSERT → review_deltas
    │
    └── velocity-calculate (next scheduled job)
          │
          ├── UPDATE → sync_status.velocity_tier
          └── REFRESH → review_velocity_stats (MV)
```

---

## Summary Statistics

| Category | Count |
|----------|-------|
| **External APIs** | 6 (Steam x4, SteamSpy, OpenAI) |
| **Databases** | 2 (PostgreSQL, Qdrant) |
| **Database Tables** | 32 |
| **Materialized Views** | 9 |
| **Qdrant Collections** | 5 |
| **Cube.js Cubes** | 10 |
| **Sync Workflows** | 18 |
| **LLM Chat Tools** | 7 |

---

*Document generated as part of Phase 1: Discovery & Mapping*
