# PICS Service

Python microservice for Steam PICS ingestion and PICS-side change intelligence.

## Overview

The PICS service connects directly to Steam's Product Info Cache Server and now serves two jobs:

- bulk and ongoing PICS metadata ingestion
- normalized PICS history capture for change intelligence

During change monitoring, the service writes normalized snapshots and PICS diff events before the latest-state upserts that keep the `apps` table and relationship tables current.

## Modes

### `MODE=bulk_sync`

- one-time backfill of PICS metadata for apps already in the warehouse
- exits when complete
- useful for initial population or large repair runs

### `MODE=change_monitor`

- long-running polling of Steam PICS change numbers
- fetches changed app payloads
- writes normalized history snapshots and diff events
- then performs latest-state upserts for apps and relationships

## Runtime Behavior

- history capture retries bounded transient and schema-cache failures before giving up
- unchanged normalized snapshots update `last_seen_at` instead of producing duplicate history rows
- structured PICS diff events are only written when the normalized snapshot hash changes
- repeated history failures trigger a short cooldown for history capture rather than blocking the whole batch
- latest-state upserts continue even when historical writes are temporarily cooled down

## Source-of-Truth Rules

- Storefront remains authoritative for parsed `release_date` and `is_free`
- PICS fields are enrichment and fallback data
- use raw text fields when the Storefront date is not parseable instead of forcing invalid typed dates

## Local Development

```bash
poetry install
cp .env.example .env
MODE=bulk_sync python -m src.main
MODE=change_monitor python -m src.main
```

## Key Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | required | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | required | Supabase service role key |
| `MODE` | `change_monitor` | `bulk_sync` or `change_monitor` |
| `PORT` | `8080` | Health-check port |
| `BULK_BATCH_SIZE` | `200` | Apps per PICS request |
| `BULK_REQUEST_DELAY` | `0.5` | Seconds between bulk requests |
| `POLL_INTERVAL` | `30` | Seconds between PICS change polls |
| `PROCESS_BATCH_SIZE` | `100` | Apps per queue processing batch |
| `MAX_QUEUE_SIZE` | `10000` | Maximum queued apps |
| `LOG_LEVEL` | `INFO` | Logging level |
| `LOG_JSON` | `true` | JSON log formatting |

## Health Endpoints

- `GET /`
- `GET /health`
- `GET /status`

## Tests

```bash
cd services/pics-service
pytest
```

Focused suites:

```bash
pytest tests/test_change_intelligence.py tests/test_operations_change_history.py tests/test_operations_relationship_sync.py
```

## Package Layout

```text
src/
├── config/                 # Settings
├── database/               # Supabase operations and change-intel helpers
├── extractors/             # PICS field extraction
├── health/                 # HTTP health server
├── steam/                  # Steam client + PICS operations
└── workers/                # bulk_sync and change_monitor
```

## Related Documentation

- [PICS Data Fields Reference](../../docs/reference/pics-data-fields.md)
- [Data Sources](../../docs/developer-guide/architecture/data-sources.md)
- [Steam Change Intelligence](../../docs/developer-guide/workers/steam-change-intelligence.md)
