# Steam Change Intelligence Implementation Plan

Last updated: 2026-03-14

## Goal

Build SteamDB-style change intelligence for PublisherIQ by continuously capturing Storefront, PICS, Steam News, and media-change signals, versioning meaningful changes over time, and joining those changes to existing price, review, and CCU history.

## Core Outcome

PublisherIQ should be able to answer questions like:

- What changed on a game's Steam page in the last 30/90 days?
- Which games changed release-date messaging, tags, genres, copy, prices, or hero assets?
- Which games look like they started a new marketing push?
- Which major updates had strong or weak downstream CCU/review response?

## Current Status

As of 2026-03-14:

- Checkpoints 1 through 7 are implemented and live.
- Checkpoint 8 is implemented in SQL and available for read/query use.
- Checkpoint 9 read RPCs are implemented, but bounded-query and output-shape validation is still lighter than the original plan intended.
- Checkpoint 10 is in progress. The production backlog is actively draining, but bootstrap/backfill is not finished.
- Checkpoint 11 is partial. A worker/runbook document exists, but backlog/throttle playbooks and some cohort-policy docs still need tightening.

Intentional implementation deviation:

- Background hero images are still tracked in Storefront snapshots, media versions, and `background_url_changed` events.
- Background binaries are no longer archived to object storage.

## Locked Decisions

- Track all apps already in `apps` from day one.
- Start forward collection immediately and backfill recent reachable history in parallel.
- Use hybrid storage.
- Store normalized snapshots and diff events in Postgres.
- Store only bounded raw artifacts in object storage.
- High-frequency queue consumers run on Railway by default.
- GitHub Actions remain for coarse sweeps, bootstrap jobs, and existing scheduled jobs.
- Treat `IStoreService/GetAppList.last_modified` and `price_change_number` as capture triggers only, not as business events.
- Treat PICS change numbers as capture triggers only, not as business events.
- Full-catalog media detection is required.
- Full-catalog media archival is not required.
- Visual archival is limited to changed hero assets for a priority cohort.
- Screenshots are URL/order tracked only.
- Video binaries are never stored in v1/v2.

## Scope

In scope:

- Storefront snapshot history
- PICS snapshot history
- Steam News history and edit history
- Structured change events
- Hero asset visual history for a priority cohort
- Outcome-window joins to price, CCU, and review history
- Read/query interfaces needed for future chat tooling

Out of scope for v1/v2:

- Full screenshot archival
- Trailer/video binary archival
- Full rendered page screenshots for all apps
- Steamworks owner-only data such as wishlists, traffic, update visibility, depot manifests
- Composite scoring and chat interpretation logic beyond the storage/query foundation

## Data Model

Add these database resources:

- `app_source_snapshots`
- `app_change_events`
- `app_capture_queue`
- `steam_news_items`
- `steam_news_versions`
- `app_media_versions`

Extend `sync_status` with:

- `steam_last_modified`
- `steam_price_change_number`
- `last_news_sync`
- `last_media_sync`

## Snapshot Rules

- Store one source-specific normalized snapshot whenever the normalized content hash changes.
- If the fetched content matches the previous normalized hash, do not insert a new version row.
- Instead, extend `last_seen_at` on the existing version.
- Keep `observed_at`, `first_seen_at`, `last_seen_at`, `content_hash`, `previous_snapshot_id`, `trigger_reason`, and `trigger_cursor`.
- Keep raw JSON out of Postgres unless explicitly needed for later reprocessing.
- If raw JSON is stored, keep it in object storage, not in hot relational tables.

## Diff Rules

Emit structured change events for:

- description or short-description rewrite
- release-date text change
- price change
- discount start
- discount end
- tags added
- tags removed
- genres changed
- categories changed
- languages changed
- platforms changed
- controller support changed
- Steam Deck status changed
- publisher/developer association changed
- DLC/package references changed
- build ID changed
- last content update changed
- news published
- news edited
- capsule URL changed
- header URL changed
- background URL changed
- screenshot added
- screenshot removed
- screenshot reordered
- trailer added
- trailer removed
- trailer reordered
- trailer thumbnail changed

## Media Policy

All apps get media change detection.

For all apps, capture and version:

- hero image URLs
- screenshot URLs and order
- trailer/movie metadata
- trailer/movie URLs
- trailer thumbnail URLs

Visual archive cohort:

- apps with `refresh_tier IN ('active', 'moderate')`
- or `release_date >= CURRENT_DATE - INTERVAL '365 days'`
- or `is_released = FALSE`

For the visual archive cohort only:

- fetch changed `header` and `capsule` image binaries
- compute `sha256`
- store binary in `steam-hero-assets` bucket only if hash is new
- persist object key, hash, mime type, content length, width, height, first seen, last seen

Background images:

- keep URL-level history and `background_url_changed` events
- do not archive background binaries in the current implementation

Non-cohort apps:

- do not store hero image binaries
- keep hero asset history as URL-based versions only

Screenshots:

- no binary storage in v1/v2
- detect only URL add/remove/reorder changes

Videos:

- no `mp4` or `webm` storage in v1/v2
- track movie metadata, URLs, and thumbnail URLs only

## Cost Guardrails

Storage is the main cost risk.

Rules:

- keep normalized snapshots and diff rows in Postgres
- never store media binaries in Postgres
- separate hero image archive bucket from any raw JSON archive bucket
- reserve at most `50 GB` for `steam-hero-assets`
- warn at `20 GB`
- tighten archive cohort at `35 GB`
- pause new hero binary archival at `50 GB` pending manual review
- do not store screenshot binaries in v1/v2
- do not store video binaries in v1/v2

Estimated storage behavior:

- hero assets for all `~200k` apps would likely be too expensive and risky
- hero assets for a `~10k-25k` priority cohort is acceptable
- screenshots at full scale are the main runaway storage risk
- trailer binaries are not acceptable for default retention

## Rate Limits and Throttling

Use per-source budgets.

`IStoreService/GetAppList`:

- run hourly
- budget is negligible
- expected full sweep is only a few paginated requests

Storefront `appdetails`:

- start at the actual repo limiter in code
- `0.33 req/sec`
- burst `3`
- current rollout target is two active Storefront queue consumers
- only increase after stable observation

Steam News:

- add explicit limiter
- `1 req/sec`
- burst `5`

Hero asset fetching:

- only for changed hero assets in the archive cohort
- max `2` concurrent downloads
- max `2 MB` per fetched hero asset
- daily download budget `10 GB` during bootstrap/archive phases

PICS:

- keep current `30s` poll interval
- keep current `100` app processing batches
- keep current `10k` queue ceiling

Backpressure rules:

- if queue lag grows, preserve PICS and Storefront snapshot capture first
- shed hero-asset archival before shedding snapshots
- shed news catch-up before shedding snapshots
- keep retries exponential and bounded
- dedupe queue items by `appid + source + trigger_cursor`

## Runtime Model

GitHub Actions:

- hourly `app-change-hints` sweep
- existing `storefront-sync` safety-net sweep
- bootstrap/backfill workflows
- coarse scheduled maintenance

Railway:

- long-running `change-intel-worker`
- queue draining for Storefront recaptures
- queue draining for News recaptures
- bounded hero-asset archival

## Query Interfaces

Add read interfaces for future app/chat use:

- `get_app_change_feed(p_appid, p_from, p_to, p_limit)`
- `get_recent_app_changes(p_days, p_types, p_limit)`

These should support:

- time-bounded diff retrieval
- before/after snapshot comparisons
- event feed inspection
- later composition into chat tools and pattern detectors

## Checkpoints

### Checkpoint 1: Schema Foundation

- [x] Draft migration for `app_source_snapshots`
- [x] Draft migration for `app_change_events`
- [x] Draft migration for `app_capture_queue`
- [x] Draft migration for `steam_news_items`
- [x] Draft migration for `steam_news_versions`
- [x] Draft migration for `app_media_versions`
- [x] Draft `sync_status` extensions
- [x] Add indexes needed for queue draining and time-bounded reads
- [x] Add types regeneration plan but do not apply migration without approval

### Checkpoint 2: Change Hint Intake

- [x] Add hourly `app-change-hints` worker using `IStoreService/GetAppList`
- [x] Persist `last_modified` and `price_change_number` into `sync_status`
- [x] Enqueue Storefront recapture jobs only when hints changed
- [x] Ensure queue dedupe by source and trigger cursor
- [x] Add job tracking and metrics

### Checkpoint 3: Storefront Snapshot Versioning

- [x] Extend Storefront normalization to include full diff surface
- [x] Write normalized snapshot rows only on content-hash change
- [x] Extend `last_seen_at` on unchanged content
- [x] Emit structured Storefront diff events
- [x] Keep existing latest-state upsert behavior intact

### Checkpoint 4: PICS Snapshot Versioning

- [x] Persist PICS normalized snapshots before latest-state upsert
- [x] Tag snapshots with PICS change number
- [x] Emit structured PICS diff events
- [x] Ensure unchanged PICS payloads only update `last_seen_at`
- [x] Preserve existing PICS service reliability and queue behavior

### Checkpoint 5: Steam News Versioning

- [x] Add `news-sync` worker
- [x] Persist base item records keyed by `gid`
- [x] Persist version rows on content-hash change
- [x] Emit `news_published` and `news_edited` events
- [x] Add touched-app queue path plus low-priority catch-up path

### Checkpoint 6: Media Detection

- [x] Persist hero image URLs, screenshot URLs/order, and trailer metadata from Storefront snapshots
- [x] Emit URL/order-based media events for all apps
- [x] Add media version records needed for change inspection
- [x] Do not store screenshot or trailer binaries

### Checkpoint 7: Hero Asset Visual Archive

- [x] Implement archive cohort selection rules
- [x] Add bounded hero image downloader
- [x] Hash hero asset binaries
- [x] Deduplicate objects by content hash
- [x] Store changed hero assets in `steam-hero-assets`
- [x] Enforce content-size cap and daily download budget
- [x] Add storage-usage monitoring and guardrails

### Checkpoint 8: Outcome Windows

- [x] Join change events to existing `daily_metrics`, `review_deltas`, and `ccu_snapshots`
- [x] Add baseline windows for `T-7d` and `T-30d`
- [x] Add response windows for `T+1d`, `T+7d`, and `T+30d`
- [x] Store enough event context for later analysis and chat summaries

### Checkpoint 9: Read Layer

- [x] Implement `get_app_change_feed`
- [x] Implement `get_recent_app_changes`
- [ ] Verify time-bounded queries stay indexed and bounded
- [ ] Validate output shape against the prompt examples in the research doc

Status note:

- The RPCs exist and are deployed.
- Formal bounded-query verification and example-shape validation are still pending.

### Checkpoint 10: Bootstrap and Backfill

- [ ] Bootstrap one current Storefront snapshot for all apps
- [ ] Bootstrap one current PICS snapshot for all apps
- [ ] Backfill reachable Steam News history
- [x] Do not attempt impossible historical Storefront/PICS reconstruction
- [x] Run bootstrap under strict source budgets and storage budgets

Status note:

- Production bootstrap is running now through the queue-backed storefront/news drain.
- The backlog is still in progress, so this checkpoint is not complete yet.

### Checkpoint 11: Documentation and Ops

- [x] Document queue workers, rate limits, and storage policy
- [ ] Document archive cohort rules
- [x] Document cost guardrails and pause conditions
- [x] Document what is and is not visually reviewable later
- [ ] Update runbooks for backlog handling and throttle incidents

Status note:

- The current runbook lives in `docs/developer-guide/workers/steam-change-intelligence.md`.
- Cohort-rule detail and backlog/throttle playbooks still need more explicit operator guidance.

## Acceptance Criteria

- We can answer "what changed" for Storefront, PICS, and News over a time window.
- We can detect hero asset changes for all apps.
- We can visually inspect old hero assets for archive-cohort apps.
- We can detect screenshot and trailer changes without storing those binaries.
- Snapshot growth is hash-gated.
- Media storage growth is bounded by explicit cohort and bucket limits.
- Source throttling is enforced in code and operable in production.
- The system forms the data foundation needed for the prompt examples in `docs/reference/steam-game-change-intelligence-research.md`.

## Prompt Coverage

This plan directly supports the data foundation for:

- biggest store-page changes
- before/after page changes around updates
- release-date messaging changes
- tag/genre/category drift
- announcement + discount + asset-refresh detection
- relaunch pattern detection
- weak vs strong downstream demand response

This plan does not yet implement:

- composite scoring
- agency lead ranking
- rescue-candidate scoring
- hidden-upside scoring
- final chat interpretation layer

Those should be a follow-on implementation after this capture layer is complete.

## Implementation Handoff Notes

When resuming after context clear, use one of these prompts:

- `Implement Checkpoint 1 only. Draft migrations and any code/type changes, but do not apply migrations.`
- `Implement Checkpoints 2 and 3 only. Queue-based app-change-hints plus Storefront snapshot versioning.`
- `Implement Checkpoint 5 only. Add Steam News history/versioning.`
- `Implement Checkpoint 7 only. Add bounded hero asset archival for the archive cohort.`

Always preserve these constraints:

- never apply migrations without explicit approval
- keep screenshot binaries out of storage
- keep trailer binaries out of storage
- enforce the declared rate limits and storage guardrails
