# Steam Change Intelligence

Steam change intelligence is split across three runtimes:

- `app-change-hints`: hourly GitHub Action that pages `IStoreService/GetAppList`, updates `sync_status.steam_last_modified` and `sync_status.steam_price_change_number`, and enqueues `storefront` capture work when the hint cursor changed.
- `change-intel-worker`: long-running queue drainer for `storefront`, `news`, and `hero_asset` capture sources. Railway should run this continuously with `pnpm --filter @publisheriq/ingestion change-intel-worker`.
- `services/pics-service`: writes normalized PICS snapshots and diff events inline before the existing latest-state upserts.

## Recent Behavior Notes

- Diff canonicalization now normalizes JSON payload ordering before comparison, which reduces false positives caused by key-order churn in stored JSON values.
- Storefront latest-state writes keep parsed `release_date` strict; non-parseable release text remains raw text instead of overwriting typed dates.
- PICS history capture retries transient and schema-cache failures, updates `last_seen_at` for unchanged normalized snapshots, and cools down temporarily if historical writes keep failing.
- Latest-state PICS upserts continue even when the historical-write cooldown is active.

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
- `CLAIM_STALE_AFTER_MS`: requeue `claimed` queue rows older than this threshold so abandoned work is not stranded during worker churn or replica scale-down. Default `1800000` (`30` minutes). Set `0` to disable.
- `STALE_CLAIM_SWEEP_INTERVAL_MS`: how often the worker checks for stale claimed rows. Default `60000`.

When stale claims are requeued, the completion path records the `stale_claim_requeued` reason so abandoned rows do not stay stranded.

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

## Read Surfaces

The user-facing `/changes` page reads from:

- `get_change_feed_bursts`
- `get_change_feed_burst_detail`
- `get_change_feed_news`
- `/api/change-feed/status`

## Verification

- Node tests: `cd packages/ingestion && pnpm run test:change-intel`
- Node typecheck: `cd packages/ingestion && pnpm check-types`
- Python tests: `cd services/pics-service && pytest tests/test_change_intelligence.py tests/test_operations_change_history.py`
- Python syntax smoke: run `python3 -m py_compile` on the changed PICS modules and tests.

The migration for this feature is drafted in [20260313130000_add_steam_change_intelligence.sql](/Users/ryanbohmann/Desktop/publisheriq/supabase/migrations/20260313130000_add_steam_change_intelligence.sql). It has not been applied automatically.
