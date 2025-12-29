# PICS Service

Steam PICS (Product Info Cache Server) data fetching microservice for PublisherIQ.

## Overview

This service fetches game metadata directly from Steam's PICS system using SteamKit2, providing:
- **Bulk sync**: Fetch all ~70k apps in ~3 minutes
- **Real-time monitoring**: Continuous polling for changes

## Quick Start

### Local Development

```bash
# Install dependencies
poetry install

# Copy environment template
cp .env.example .env

# Edit .env with your Supabase credentials
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_KEY=eyJ...

# Run bulk sync
MODE=bulk_sync python -m src.main

# Or run change monitor
MODE=change_monitor python -m src.main
```

### Railway Deployment

1. Create a new Railway service
2. Connect this directory as the source
3. Set environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `MODE` (bulk_sync or change_monitor)
4. Deploy

## Modes

### Bulk Sync (`MODE=bulk_sync`)

One-time sync of all apps from database. Run this first to populate PICS data.

- Fetches 200 apps per request
- ~3 minutes for 70k apps
- Exits when complete

### Change Monitor (`MODE=change_monitor`)

Continuous monitoring for Steam data changes.

- Polls every 30 seconds
- Queues changed apps for re-fetch
- Runs indefinitely

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | required | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | required | Supabase service role key |
| `MODE` | `change_monitor` | `bulk_sync` or `change_monitor` |
| `PORT` | `8080` | Health check port |
| `BULK_BATCH_SIZE` | `200` | Apps per PICS request |
| `BULK_REQUEST_DELAY` | `0.5` | Seconds between requests |
| `POLL_INTERVAL` | `30` | Seconds between change polls |
| `PROCESS_BATCH_SIZE` | `100` | Apps per queue processing batch |
| `MAX_QUEUE_SIZE` | `10000` | Maximum queued apps |
| `LOG_LEVEL` | `INFO` | Logging level |
| `LOG_JSON` | `true` | JSON logging format |

## Health Check

The service exposes HTTP endpoints for Railway health checks:

- `GET /` or `/health` - Returns `200 OK`
- `GET /status` - Returns JSON with current status

## Data Extracted

From PICS, this service extracts:

- Steam Deck compatibility
- Parent/DLC relationships
- Franchise associations
- Review scores (1-9 scale)
- Store tags (IDs)
- Categories (feature flags)
- Genres
- Platforms
- Controller support
- Content descriptors
- Languages
- Last content update timestamp

## Database Schema

Requires migration: `supabase/migrations/20251230000000_add_pics_data.sql`

New tables:
- `steam_tags` - Tag ID to name mapping
- `steam_genres` - Genre reference
- `steam_categories` - Category reference
- `franchises` - Franchise names
- `app_steam_tags` - App-tag relationships
- `app_genres` - App-genre relationships
- `app_categories` - App-category relationships
- `app_franchises` - App-franchise relationships
- `app_steam_deck` - Steam Deck compatibility
- `pics_sync_state` - Change number tracking

New columns on `apps`:
- `controller_support`
- `pics_review_score`
- `pics_review_percentage`
- `metacritic_score`
- `metacritic_url`
- `platforms`
- `release_state`
- `parent_appid`
- `homepage_url`
- `app_state`
- `last_content_update`
- `current_build_id`
- `content_descriptors`
- `languages`

## Architecture

```
src/
├── main.py              # Entry point
├── config/
│   └── settings.py      # Pydantic settings
├── steam/
│   ├── client.py        # Steam client wrapper
│   └── pics.py          # PICS operations
├── extractors/
│   └── common.py        # Data extraction
├── database/
│   ├── client.py        # Supabase client
│   └── operations.py    # Bulk operations
├── workers/
│   ├── bulk_sync.py     # Initial sync
│   └── change_monitor.py # Real-time updates
└── health/
    └── server.py        # HTTP health checks
```
