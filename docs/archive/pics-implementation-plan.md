# PICS Data Integration Implementation Plan

## Overview

Implement a Python microservice deployed on Railway to fetch Steam PICS data via SteamKit2. This dramatically speeds up data collection (~3 minutes for 70k apps vs 20+ hours) and adds valuable fields not currently collected.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Railway                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              PICS Service (Python)                       │   │
│  │  ┌──────────────┐    ┌──────────────┐                   │   │
│  │  │  Bulk Sync   │    │   Change     │                   │   │
│  │  │   Worker     │    │   Monitor    │                   │   │
│  │  └──────────────┘    └──────────────┘                   │   │
│  │          │                  │                            │   │
│  │          └────────┬─────────┘                            │   │
│  │                   ▼                                      │   │
│  │         ┌─────────────────┐                             │   │
│  │         │  Steam Client   │◄──── Anonymous Login         │   │
│  │         │  (SteamKit2)    │                             │   │
│  │         └─────────────────┘                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
└──────────────────────────│──────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Supabase PostgreSQL  │◄──── Existing DB
              └────────────────────────┘
```

---

## New Data Fields from PICS

| Category | Fields | Current Source |
|----------|--------|----------------|
| Steam Deck | Verified/Playable/Unsupported status | **NEW** |
| Relationships | parent_appid, DLC lists | **NEW** |
| Franchises | Game series associations | **NEW** |
| Reviews | review_score (1-9), review_percentage | Faster than APIs |
| Tags | Store tags as IDs | Faster than SteamSpy |
| Categories | Feature flags (achievements, workshop, etc.) | Faster than Storefront |
| Platforms | windows/macos/linux | Faster than Storefront |
| Controller | full/partial support | **NEW** |
| Content | Mature content descriptors | **NEW** |
| Languages | Supported languages | **NEW** |
| Updates | Last content update timestamp | **NEW** |

---

## Implementation Phases

### Phase 1: Database Schema (Migration)

**File:** `supabase/migrations/20251230000000_add_pics_data.sql`

#### New Reference Tables

| Table | Purpose |
|-------|---------|
| `steam_tags` | Tag ID to name mapping |
| `steam_genres` | Genre ID to name mapping (seeded) |
| `steam_categories` | Category ID to name mapping (seeded) |
| `franchises` | Game franchise names |

#### New Junction Tables

| Table | Purpose |
|-------|---------|
| `app_steam_tags` | App to tag relationships |
| `app_genres` | App to genre relationships |
| `app_categories` | App to feature categories |
| `app_franchises` | App to franchise relationships |
| `app_steam_deck` | Steam Deck compatibility data |

#### New Columns on `apps` Table

```sql
controller_support TEXT           -- "full", "partial", or NULL
pics_review_score SMALLINT        -- 1-9 scale from PICS
pics_review_percentage SMALLINT   -- 0-100 from PICS
metacritic_score SMALLINT         -- 0-100
metacritic_url TEXT               -- URL string
platforms TEXT                    -- "windows,macos,linux"
release_state TEXT                -- "released", "prerelease", etc.
parent_appid INTEGER              -- FK to parent app for DLC/demos
homepage_url TEXT                 -- Publisher/developer website
app_state TEXT                    -- "eStateAvailable", etc.
last_content_update TIMESTAMPTZ   -- From depots
current_build_id TEXT             -- From depots
content_descriptors JSONB         -- Mature content flags
languages JSONB                   -- Supported languages
```

#### Sync Status Updates

- Add `last_pics_sync` column
- Add `pics_change_number` column
- Update `get_apps_for_sync()` function for PICS source

---

### Phase 2: Python Service Structure

**Location:** `services/pics-service/`

```
services/pics-service/
├── pyproject.toml              # Poetry dependency management
├── Dockerfile                  # Railway deployment
├── railway.toml                # Railway configuration
├── .env.example                # Environment variable template
└── src/
    ├── __init__.py
    ├── main.py                 # Entry point - mode selection
    ├── config/
    │   └── settings.py         # Pydantic settings from env vars
    ├── steam/
    │   ├── client.py           # SteamClient wrapper with reconnection
    │   └── pics.py             # PICS-specific operations
    ├── extractors/
    │   └── common.py           # Data extraction from PICS response
    ├── database/
    │   ├── client.py           # Supabase client wrapper
    │   └── operations.py       # Bulk upsert operations
    ├── workers/
    │   ├── bulk_sync.py        # Initial bulk load worker
    │   └── change_monitor.py   # Real-time change monitor
    └── health/
        └── server.py           # HTTP health check for Railway
```

---

### Phase 3: Core Components

#### 1. Steam Client (`src/steam/client.py`)

```python
class PICSSteamClient:
    """Wrapper around SteamClient with automatic reconnection."""

    async def connect(self) -> bool:
        """Establish anonymous connection to Steam."""

    async def reconnect(self) -> bool:
        """Reconnect with exponential backoff."""

    @property
    def is_connected(self) -> bool:
        """Check connection state."""
```

#### 2. PICS Fetcher (`src/steam/pics.py`)

```python
class PICSFetcher:
    BATCH_SIZE = 200  # Apps per request
    REQUEST_DELAY = 0.5  # Seconds between batches

    async def fetch_apps_batch(self, appids: List[int]) -> Dict:
        """Fetch PICS data for a batch of apps."""

    async def fetch_all_apps(self, appids: List[int]) -> AsyncGenerator:
        """Fetch all apps, yielding batches."""

    async def get_changes_since(self, change_number: int) -> PICSChange:
        """Get changes since specified change number."""
```

#### 3. Data Extractor (`src/extractors/common.py`)

```python
@dataclass
class ExtractedPICSData:
    appid: int
    name: Optional[str]
    type: Optional[str]
    developer: Optional[str]
    publisher: Optional[str]
    associations: List[Association]
    parent_appid: Optional[int]
    dlc_appids: List[int]
    steam_release_date: Optional[datetime]
    review_score: Optional[int]
    review_percentage: Optional[int]
    store_tags: List[int]
    genres: List[int]
    categories: Dict[str, bool]
    platforms: List[str]
    controller_support: Optional[str]
    steam_deck: Optional[SteamDeckCompatibility]
    # ... more fields

class PICSExtractor:
    def extract(self, appid: int, raw_data: Dict) -> ExtractedPICSData:
        """Extract all relevant fields from PICS app data."""
```

#### 4. Database Operations (`src/database/operations.py`)

```python
class PICSDatabase:
    UPSERT_BATCH_SIZE = 500

    async def upsert_apps_batch(self, apps: List[ExtractedPICSData]) -> Dict:
        """Upsert apps with relationships. Returns stats."""

    async def get_last_change_number(self) -> int:
        """Get last processed PICS change number."""

    async def set_last_change_number(self, change_number: int):
        """Update last processed change number."""
```

---

### Phase 4: Workers

#### Bulk Sync Worker (`src/workers/bulk_sync.py`)

- One-time initial load of all apps
- ~200 apps/request, 0.5s delay = ~3 minutes for 70k apps
- Progress tracking and health updates
- Run with: `MODE=bulk_sync`

```python
class BulkSyncWorker:
    async def run(self, app_ids: List[int] = None):
        """Run bulk sync for all apps or specified list."""
```

#### Change Monitor Worker (`src/workers/change_monitor.py`)

- Continuous polling for PICS changes (every 30s)
- Queue changed apps for re-fetch
- Process queue in batches of 100
- Automatic reconnection on disconnect
- Run with: `MODE=change_monitor`

```python
class ChangeMonitorWorker:
    POLL_INTERVAL = 30
    PROCESS_BATCH_SIZE = 100
    MAX_QUEUE_SIZE = 10000

    async def run(self):
        """Run change monitor continuously."""
```

---

### Phase 5: Railway Deployment

#### Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --no-cache-dir poetry && \
    poetry config virtualenvs.create false && \
    poetry install --no-dev

COPY src/ ./src/

ENV PYTHONUNBUFFERED=1
EXPOSE 8080

CMD ["python", "-m", "src.main"]
```

#### railway.toml

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 5
```

#### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Database URL |
| `SUPABASE_SERVICE_KEY` | Yes | Service role key |
| `MODE` | Yes | "bulk_sync" or "change_monitor" |
| `PORT` | Auto | Health check port (Railway injects) |
| `LOG_LEVEL` | No | Logging level (default: INFO) |

---

## Execution Order

1. **Create database migration** - Add all new tables and columns
2. **Set up Python project** - Poetry, dependencies, structure
3. **Implement Steam client** - Connection, reconnection, PICS fetching
4. **Implement extractors** - Parse all PICS fields
5. **Implement database operations** - Bulk upserts, relationship sync
6. **Implement bulk sync worker** - Initial data load
7. **Implement change monitor** - Real-time updates
8. **Add health check server** - Railway requirement
9. **Create Dockerfile** - Container configuration
10. **Deploy to Railway** - Initial bulk sync, then switch to monitor mode

---

## Files to Create

### Database Migration
- `supabase/migrations/20251230000000_add_pics_data.sql`

### Python Service
```
services/pics-service/
├── pyproject.toml
├── Dockerfile
├── railway.toml
├── .env.example
└── src/
    ├── __init__.py
    ├── main.py
    ├── config/
    │   ├── __init__.py
    │   └── settings.py
    ├── steam/
    │   ├── __init__.py
    │   ├── client.py
    │   └── pics.py
    ├── extractors/
    │   ├── __init__.py
    │   └── common.py
    ├── database/
    │   ├── __init__.py
    │   ├── client.py
    │   └── operations.py
    ├── workers/
    │   ├── __init__.py
    │   ├── bulk_sync.py
    │   └── change_monitor.py
    └── health/
        ├── __init__.py
        └── server.py
```

---

## Dependencies

```toml
[tool.poetry.dependencies]
python = "^3.11"
steam = {version = "^1.4.4", extras = ["client"]}
supabase = "^2.0.0"
pydantic-settings = "^2.0.0"
aiohttp = "^3.9.0"
```

---

## Key Technical Notes

### PICS Connection
- Uses anonymous Steam login (no credentials needed)
- Connection can drop; automatic reconnection with exponential backoff
- Use singleton pattern to avoid multiple connections

### Rate Limiting
- PICS supports ~200 apps/request, 2 req/sec is safe
- Conservative approach: 200 apps/request, 0.5s delay
- 70,000 apps can be fetched in ~3 minutes

### Data Locations in PICS Response
- Steam Deck: `common.steam_deck_compatibility`
- Franchise: `common.associations` with type="franchise"
- Parent/DLC: `common.parent` and `extended.listofdlc`
- Last update: `depots.branches.public.timeupdated`
- Tags: `common.store_tags` (IDs, need mapping)

### Change Monitoring
- Change numbers are global across all Steam apps
- Track last processed number to avoid re-fetching
- Poll every 30 seconds for real-time updates

---

## Speed Comparison

| Method | Rate | 70,000 Apps |
|--------|------|-------------|
| **PICS via SteamKit2** | ~200 apps/req, 2 req/sec | **~3 minutes** |
| Steam Store API | ~40 req/min | ~29 hours |
| SteamSpy | 1 req/sec | ~20 hours |
| Web scraping | ~1 req/sec | ~20 hours |

---

## References

- [PICS_DATA_REFERENCE.md](./PICS_DATA_REFERENCE.md) - Complete PICS field reference
- [steam PyPI package](https://pypi.org/project/steam/) - Python library
- [ValvePython/steam](https://github.com/ValvePython/steam) - Source repository
- [Railway Docs](https://docs.railway.com/) - Deployment platform
