# PublisherIQ Tech Stack Inventory

> Data Infrastructure Audit - Phase 1: Discovery
> Generated: January 9, 2026

---

## 1. Databases

### 1.1 PostgreSQL (via Supabase)

| Attribute | Value |
|-----------|-------|
| **Type** | Relational Database (PostgreSQL) |
| **Provider** | Supabase (managed PostgreSQL) |
| **Host** | `gncakhbxecqkpiplvvbc.supabase.co` |
| **Connection** | Direct connection + Supabase pooler |
| **Used By** | All packages and services |

**Purpose:**
- Primary data store for all Steam game metadata
- Publisher and developer entity storage
- Daily metrics, review histograms, and trend data
- Sync status tracking and job execution history
- User profiles, authentication, and credit management
- Materialized views for aggregated analytics
- CCU snapshots and tier assignments

**Key Tables:**
- `apps` - Steam apps with metadata, prices, platforms
- `publishers`, `developers` - Entity data with embeddings
- `daily_metrics` - Time-series player and review metrics
- `sync_status`, `sync_jobs` - Operational tracking
- `user_profiles`, `waitlist` - User management

**Materialized Views:**
- `latest_daily_metrics` - Most recent metrics per app
- `publisher_metrics`, `developer_metrics` - All-time aggregations
- `review_velocity_stats` - Velocity-based discovery metrics

---

### 1.2 Qdrant Cloud

| Attribute | Value |
|-----------|-------|
| **Type** | Vector Database |
| **Provider** | Qdrant Cloud |
| **Version** | Client: `@qdrant/js-client-rest` ^1.12.0 |
| **Host** | `699bbae8-6e18-41ac-b373-62f765e7bb2d.us-west-2-0.aws.cloud.qdrant.io` |
| **Used By** | `packages/qdrant`, `packages/ingestion`, `apps/admin` |

**Purpose:**
- Vector similarity search for game, publisher, and developer discovery
- Stores OpenAI-generated embeddings (1536 dimensions)
- Uses scalar quantization (int8) to fit within free tier (1GB)

**Collections:**
| Collection | Entity Type | Purpose |
|------------|-------------|---------|
| `publisheriq_games` | Games | Find similar games |
| `publisheriq_publishers_portfolio` | Publishers | Match by entire catalog |
| `publisheriq_publishers_identity` | Publishers | Match by top games |
| `publisheriq_developers_portfolio` | Developers | Match by entire catalog |
| `publisheriq_developers_identity` | Developers | Match by top games |

**Source Files:**
- `/Users/ryanbohmann/Desktop/publisheriq/packages/qdrant/src/client.ts`
- `/Users/ryanbohmann/Desktop/publisheriq/packages/qdrant/src/collections.ts`

---

## 2. ORMs and Database Libraries

### 2.1 Supabase JavaScript Client

| Attribute | Value |
|-----------|-------|
| **Package** | `@supabase/supabase-js` |
| **Version** | ^2.47.10 |
| **Used By** | `packages/database`, `apps/admin`, `packages/ingestion` |

**Purpose:**
- Primary database access layer for all TypeScript/JavaScript code
- Provides typed queries using generated TypeScript types
- Handles authentication tokens and row-level security
- Server-side uses service role key for full access
- Client-side uses anon key with RLS

**Source Files:**
- `/Users/ryanbohmann/Desktop/publisheriq/packages/database/src/client.ts`
- `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/lib/supabase/server.ts`
- `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/lib/supabase/client.ts`

---

### 2.2 Supabase SSR

| Attribute | Value |
|-----------|-------|
| **Package** | `@supabase/ssr` |
| **Version** | ^0.5.2 |
| **Used By** | `apps/admin` |

**Purpose:**
- Server-side rendering support for Next.js
- Cookie-based session management
- Middleware integration for auth

**Source Files:**
- `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/lib/supabase/middleware.ts`

---

### 2.3 Supabase Python Client

| Attribute | Value |
|-----------|-------|
| **Package** | `supabase` (Python) |
| **Version** | ^2.0.0 |
| **Used By** | `services/pics-service` |

**Purpose:**
- Database access for Python PICS service
- Upserts for game metadata, tags, genres, categories
- Change tracking state management

**Source Files:**
- `/Users/ryanbohmann/Desktop/publisheriq/services/pics-service/src/database/client.py`
- `/Users/ryanbohmann/Desktop/publisheriq/services/pics-service/src/database/operations.py`

---

### 2.4 Qdrant JavaScript Client

| Attribute | Value |
|-----------|-------|
| **Package** | `@qdrant/js-client-rest` |
| **Version** | ^1.12.0 |
| **Used By** | `packages/qdrant`, `packages/ingestion`, `apps/admin` |

**Purpose:**
- Vector database operations (upsert, search, delete)
- Collection management and indexing
- Filter-based similarity search

**Source Files:**
- `/Users/ryanbohmann/Desktop/publisheriq/packages/qdrant/src/client.ts`
- `/Users/ryanbohmann/Desktop/publisheriq/packages/qdrant/src/filter-builder.ts`

---

## 3. External APIs and Services

### 3.1 Steam Web API

| Attribute | Value |
|-----------|-------|
| **Base URL** | `https://api.steampowered.com` |
| **Rate Limit** | 100k requests/day |
| **Auth** | API Key (`STEAM_API_KEY`) |
| **Used By** | `packages/ingestion` |

**Endpoints Used:**
| Endpoint | Purpose | Rate Limit |
|----------|---------|------------|
| `IStoreService/GetAppList/v1` | Master app list | - |
| `ISteamNews/GetNewsForApp/v2` | Game news | - |
| `ISteamUserStats/GetNumberOfCurrentPlayers/v1` | Exact CCU | 1/sec |

**Source Files:**
- `/Users/ryanbohmann/Desktop/publisheriq/packages/ingestion/src/apis/steam-web.ts`
- `/Users/ryanbohmann/Desktop/publisheriq/packages/ingestion/src/apis/steam-ccu.ts`

---

### 3.2 Steam Storefront API

| Attribute | Value |
|-----------|-------|
| **Base URL** | `https://store.steampowered.com` |
| **Rate Limit** | ~200 requests/5min |
| **Auth** | None (cookies for age-gate bypass) |
| **Used By** | `packages/ingestion` |

**Endpoints Used:**
| Endpoint | Purpose |
|----------|---------|
| `/api/appdetails/` | Game metadata, developers, publishers, pricing |
| `/appreviews/{appid}` | Review summary (counts, scores) |
| `/appreviewhistogram/{appid}` | Monthly review trends |

**Purpose:**
- **Authoritative source** for developer/publisher relationships
- Game metadata, release dates, platforms, categories
- Price information and discount tracking
- Review counts and sentiment scores

**Source Files:**
- `/Users/ryanbohmann/Desktop/publisheriq/packages/ingestion/src/apis/storefront.ts`
- `/Users/ryanbohmann/Desktop/publisheriq/packages/ingestion/src/apis/reviews.ts`

---

### 3.3 SteamSpy API

| Attribute | Value |
|-----------|-------|
| **Base URL** | `https://steamspy.com/api.php` |
| **Rate Limit** | 1 req/sec (general), 1 req/60sec (all endpoint) |
| **Auth** | None |
| **Used By** | `packages/ingestion` |

**Endpoints Used:**
| Endpoint | Purpose |
|----------|---------|
| `?request=all&page=N` | Bulk game data (paginated) |
| `?request=appdetails&appid=N` | Individual game details |
| `?request=genre&genre=X` | Games by genre |
| `?request=tag&tag=X` | Games by tag |
| `?request=top100in2weeks` | Popular games |

**Purpose:**
- CCU estimates and owner counts
- User-voted tags
- Playtime statistics
- NOT authoritative for developer/publisher data

**Source Files:**
- `/Users/ryanbohmann/Desktop/publisheriq/packages/ingestion/src/apis/steamspy.ts`

---

### 3.4 Steam PICS (Product Info Cache System)

| Attribute | Value |
|-----------|-------|
| **Protocol** | Steam Client Protocol (SteamKit2) |
| **Used By** | `services/pics-service` |
| **Deployment** | Railway |
| **Library** | `steam` Python package ^1.4.4 |

**Purpose:**
- Real-time game metadata updates via change monitoring
- Authoritative source for tags, genres, categories
- Steam Deck compatibility data
- Controller support and platform information
- Franchise relationships

**Modes:**
- `bulk_sync` - Initial load (~3 min for 70k apps)
- `change_monitor` - Continuous polling (every 30s)

**Source Files:**
- `/Users/ryanbohmann/Desktop/publisheriq/services/pics-service/src/steam/client.py`
- `/Users/ryanbohmann/Desktop/publisheriq/services/pics-service/src/steam/pics.py`
- `/Users/ryanbohmann/Desktop/publisheriq/services/pics-service/src/workers/change_monitor.py`

---

### 3.5 OpenAI API

| Attribute | Value |
|-----------|-------|
| **Base URL** | `https://api.openai.com/v1` |
| **Used By** | `packages/ingestion`, `apps/admin` |

**Models Used:**
| Model | Purpose | Location |
|-------|---------|----------|
| `text-embedding-3-small` | Vector embeddings (1536 dims) | Ingestion workers |
| `gpt-4o-mini` | Chat interface | Admin dashboard |
| `gpt-4o` | Available as upgrade | Admin dashboard |

**Endpoints:**
| Endpoint | Purpose |
|----------|---------|
| `/v1/embeddings` | Generate vector embeddings for games/publishers/developers |
| `/v1/chat/completions` | LLM chat with function calling (streaming) |

**Source Files:**
- `/Users/ryanbohmann/Desktop/publisheriq/packages/ingestion/src/apis/embedding.ts`
- `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/lib/llm/providers/openai.ts`

---

### 3.6 Anthropic API (Optional)

| Attribute | Value |
|-----------|-------|
| **Base URL** | `https://api.anthropic.com/v1` |
| **Used By** | `apps/admin` |
| **Status** | Available but not primary |

**Models Used:**
| Model | Purpose |
|-------|---------|
| `claude-3-5-haiku-20241022` | Alternative chat provider |

**Purpose:**
- Alternative LLM provider for chat interface
- Configured via `LLM_PROVIDER` environment variable
- Currently set to `openai` in production

**Source Files:**
- `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/lib/llm/providers/anthropic.ts`

---

### 3.7 Cube.js Semantic Layer

| Attribute | Value |
|-----------|-------|
| **Deployment** | Fly.io (`publisheriq-cube.fly.dev`) |
| **Version** | `@cubejs-backend/server` ^1.1.8 |
| **Database** | PostgreSQL (Supabase) |
| **Used By** | `apps/admin` |

**Purpose:**
- Semantic layer for analytics queries
- Pre-defined cubes for Discovery, Publishers, Developers
- Type-safe query interface for LLM tools
- JWT-authenticated API access

**Cubes Defined:**
| Cube | Data Source |
|------|-------------|
| `Discovery` | apps + latest_daily_metrics + app_trends |
| `PublisherMetrics` | publisher_metrics (materialized view) |
| `DeveloperMetrics` | developer_metrics (materialized view) |
| `DailyMetrics` | daily_metrics |
| `ReviewVelocity` | review_velocity_stats |
| `ReviewDeltas` | review_deltas |

**Source Files:**
- `/Users/ryanbohmann/Desktop/publisheriq/packages/cube/cube.js`
- `/Users/ryanbohmann/Desktop/publisheriq/packages/cube/model/*.js`
- `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/lib/cube-executor.ts`

---

## 4. File Storage Systems

### 4.1 No External File Storage

The system does **not** use external file storage services such as:
- AWS S3
- Google Cloud Storage
- Azure Blob Storage
- Cloudflare R2
- MinIO

**All data is stored in:**
- PostgreSQL (via Supabase) for structured data
- Qdrant for vector embeddings

---

## 5. Caching Layers

### 5.1 In-Memory Dashboard Cache

| Attribute | Value |
|-----------|-------|
| **Type** | In-memory (module-level) |
| **TTL** | 30 seconds |
| **Scope** | Admin dashboard data |
| **Used By** | `apps/admin` |

**Purpose:**
- Reduces database load for frequently accessed dashboard data
- Simple module-level variable with timestamp-based expiration

**Source File:**
- `/Users/ryanbohmann/Desktop/publisheriq/apps/admin/src/lib/admin-dashboard-cache.ts`

---

### 5.2 Cube.js In-Memory Cache

| Attribute | Value |
|-----------|-------|
| **Type** | In-memory |
| **Configuration** | `cacheAndQueueDriver: 'memory'` |
| **Used By** | `packages/cube` (Fly.io deployment) |

**Purpose:**
- Query result caching for Cube.js semantic layer
- No Redis required due to low query volume

**Source File:**
- `/Users/ryanbohmann/Desktop/publisheriq/packages/cube/cube.js`

---

### 5.3 Token Bucket Rate Limiters

| Attribute | Value |
|-----------|-------|
| **Type** | In-memory (class instances) |
| **Used By** | `packages/ingestion` |

**Purpose:**
- Rate limiting for Steam API requests
- Token bucket algorithm with async queue

**Configured Limiters:**
| Limiter | Rate | Burst |
|---------|------|-------|
| `steamspyGeneral` | 1/sec | 1 |
| `steamspyAll` | 1/60sec | 1 |
| `storefront` | 0.33/sec | 3 |
| `reviews` | 1/sec | 10 |
| `histogram` | 1/sec | 5 |
| `steamCCU` | 1/sec | 5 |

**Source File:**
- `/Users/ryanbohmann/Desktop/publisheriq/packages/ingestion/src/utils/rate-limiter.ts`

---

## 6. Deployment Infrastructure

### 6.1 Vercel

| Component | Purpose |
|-----------|---------|
| `apps/admin` | Next.js dashboard hosting |
| Environment | Production deployment |

---

### 6.2 Railway

| Component | Purpose |
|-----------|---------|
| `services/pics-service` | Python PICS microservice |
| Mode | `change_monitor` (continuous) |
| Health | `/health`, `/status` endpoints |

---

### 6.3 Fly.io

| Component | Purpose |
|-----------|---------|
| `packages/cube` | Cube.js semantic layer |
| URL | `publisheriq-cube.fly.dev` |

---

### 6.4 GitHub Actions

**Purpose:** Scheduled data sync workers

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| `applist-sync` | Daily 00:15 UTC | Master app list |
| `steamspy-sync` | Daily 02:15 UTC | CCU, owners, tags |
| `embedding-sync` | Daily 03:00 UTC | Vector embeddings |
| `histogram-sync` | Daily 04:15 UTC | Review trends |
| `ccu-sync` | Hourly :00 | Tier 1+2 CCU polling |
| `storefront-sync` | 5x daily | Game metadata |
| `reviews-sync` | 5x daily | Review counts |
| `velocity-calculation` | 3x daily | Velocity tiers |
| `trends-calculation` | Daily 22:00 UTC | Trend metrics |
| `priority-calculation` | Daily 22:30 UTC | Priority scores |

**Source Directory:**
- `/Users/ryanbohmann/Desktop/publisheriq/.github/workflows/`

---

## 7. Summary Table

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **Primary DB** | PostgreSQL (Supabase) | - | All structured data |
| **Vector DB** | Qdrant Cloud | ^1.12.0 | Similarity search |
| **DB Client (JS)** | @supabase/supabase-js | ^2.47.10 | Database access |
| **DB Client (Python)** | supabase | ^2.0.0 | PICS service |
| **Vector Client** | @qdrant/js-client-rest | ^1.12.0 | Vector operations |
| **Semantic Layer** | Cube.js | ^1.1.8 | Analytics queries |
| **LLM (Primary)** | OpenAI GPT-4o-mini | - | Chat interface |
| **LLM (Alt)** | Anthropic Claude | - | Optional provider |
| **Embeddings** | OpenAI text-embedding-3-small | 1536 dims | Vector generation |
| **Steam Data** | Steam Web API | - | App list, CCU |
| **Steam Metadata** | Steam Storefront | - | Game details |
| **Steam PICS** | SteamKit2 (Python) | ^1.4.4 | Real-time updates |
| **Third-party** | SteamSpy | - | CCU estimates, tags |
| **Caching** | In-memory | - | Dashboard, Cube.js |
| **Rate Limiting** | Token bucket | - | API protection |
| **Web Framework** | Next.js | ^15.1.3 | Admin dashboard |
| **UI** | React + TailwindCSS | ^19.0.0 | Frontend |

---

## 8. Data Flow Diagram

```
                    Steam APIs
                        |
         +--------------+--------------+
         |              |              |
    Web API       Storefront        PICS
    (App List,    (Metadata,      (Tags,
     CCU)          Reviews)       Genres)
         |              |              |
         +--------------+--------------+
                        |
                        v
              +------------------+
              | GitHub Actions   |
              | (Scheduled Sync) |
              +------------------+
                        |
                        v
    +-------------------------------------------+
    |            Supabase PostgreSQL            |
    |  (apps, publishers, developers, metrics)  |
    +-------------------------------------------+
          |                           |
          v                           v
    +-----------+              +------------+
    | Qdrant    |              | Cube.js    |
    | (Vectors) |              | (Analytics)|
    +-----------+              +------------+
          |                           |
          +-----------+---------------+
                      |
                      v
              +----------------+
              | Next.js Admin  |
              | Dashboard      |
              | (Vercel)       |
              +----------------+
                      |
                      v
              +----------------+
              | OpenAI Chat    |
              | Interface      |
              +----------------+
```

---

## 9. Key Observations

### Strengths
1. **Single source of truth** - PostgreSQL handles all structured data
2. **Type safety** - Generated TypeScript types from Supabase schema
3. **Semantic layer** - Cube.js provides clean analytics interface
4. **Vector search** - Qdrant enables similarity-based discovery
5. **Rate limiting** - Comprehensive protection for external APIs

### Areas to Monitor
1. **No Redis** - In-memory caching may not scale horizontally
2. **Single DB** - All workloads on one Supabase instance
3. **No file storage** - Limited to structured/vector data only
4. **Python service** - Separate from main TypeScript ecosystem
5. **Materialized views** - Require manual refresh scheduling

### Security Considerations
1. Service keys in environment variables
2. JWT-based auth for Cube.js
3. Password-based admin dashboard access
4. Supabase RLS for user-facing features
