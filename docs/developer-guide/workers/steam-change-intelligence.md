# Steam Change Intelligence

Steam change intelligence is split across three runtimes:

- `app-change-hints`: hourly GitHub Action that pages `IStoreService/GetAppList`, updates `sync_status.steam_last_modified` and `sync_status.steam_price_change_number`, and enqueues `storefront` capture work when the hint cursor changed.
- `change-intel-worker`: long-running queue drainer for `storefront`, `news`, and `hero_asset` capture sources. Railway should run this continuously with `pnpm --filter @publisheriq/ingestion change-intel-worker`.
- `services/pics-service`: writes normalized PICS snapshots and diff events inline before the existing latest-state upserts.

## Queue Ownership

- PICS does not use `app_capture_queue`.
- Queue sources are:
  - `storefront`: recapture Storefront details, write `app_source_snapshots`, `app_media_versions`, `app_change_events`, and latest-state RPC updates.
  - `news`: fetch reachable Steam News history, write `steam_news_items`, `steam_news_versions`, and `app_change_events`.
  - `hero_asset`: archive changed `header` and `capsule` binaries for the eligible cohort only. Backgrounds still remain in URL-level media history and change events, but their binaries are not archived.

## Worker Environment

- `CLAIM_LIMIT`: number of queue rows to claim per source sweep. Default `25`.
- `POLL_INTERVAL_MS`: sleep duration when no work is found. Default `5000`.
- `QUEUE_SOURCES`: comma-separated subset of `storefront,news,hero_asset`. Default is all three.
- `NEWS_CATCHUP_SEED_LIMIT`: how many stale-app news jobs to seed when the worker goes idle. Default `10`.
- `MAX_IDLE_POLLS`: optional bounded-exit control for manual workflows. `0` means run forever.

## Storage Guardrails

- Bucket: `steam-hero-assets`
- Archive only `header` and `capsule` binaries.
- Reject assets larger than `2 MB`.
- Warn when bucket usage reaches `20 GB`.
- Tighten archival behavior at `35 GB`.
- Pause new archival at `50 GB`.
- Hero archival failures must not block Storefront snapshot capture, media versioning, or News capture.

## Operational Workflows

- `.github/workflows/app-change-hints.yml`: scheduled hourly hint sweep plus manual dispatch.
- `.github/workflows/news-catchup.yml`: manual bounded news catch-up using `QUEUE_SOURCES=news` and `MAX_IDLE_POLLS`.
- `.github/workflows/storefront-initial-sync.yml`: existing manual storefront bootstrap workflow.

## Verification

- Node tests: `cd packages/ingestion && pnpm run test:change-intel`
- Node typecheck: `cd packages/ingestion && pnpm check-types`
- Python tests: `cd services/pics-service && pytest tests/test_change_intelligence.py tests/test_operations_change_history.py`
- Python syntax smoke: run `python3 -m py_compile` on the changed PICS modules and tests.

The migration for this feature is drafted in [20260313130000_add_steam_change_intelligence.sql](/Users/ryanbohmann/Desktop/publisheriq/supabase/migrations/20260313130000_add_steam_change_intelligence.sql). It has not been applied automatically.
