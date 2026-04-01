# Tiger Rollout Status

Date: 2026-04-01
Branch: `timescale-tiger-refactor`

## Overall Status

Tiger is no longer just a prototype. The new Tiger-backed data plane, `query-api`, and chat routing are real and working.

Current state:
- Tiger is the working backend for the ready typed contracts.
- `query-api` is deployed on Railway and can talk to Tiger successfully.
- local `/chat` can answer supported prompts directly from Tiger.
- legacy chat/database paths still exist as fallback and still own unsupported prompt families.

This means the rollout is in the middle stage:
- foundation and serving path are in place
- part of chat is already Tiger-primary
- full cutover is not finished yet

## What Is Already Done

### Tiger data plane
- Separate Tiger database is live and serving.
- Core identity and compatibility slices are loaded.
- `metrics.daily_metrics` hypertable is live.
- change/news slice is live:
  - `events.app_change_events`
  - `docs.steam_news_items`
  - `docs.steam_news_search_projection`

### Ready contracts
These are implemented and working:
- `resolveEntities`
- `searchCatalog`
- `rankEntities`
- `traceMetricHistory`
- `explainChanges`
- `searchDocuments`

### Chat routing
Tiger-primary visible answers are working for:
- catalog search
- entity ranking
- metric history
- news search
- change explanation

Legacy fallback still handles unsupported or unmatched prompts.

### Deployment
- `query-api` is deployed on Railway.
- Railway URL:
  - `https://publisheriq-production.up.railway.app`
- Railway health and contract checks were verified successfully.

### Local manual chat
Local browser testing is working on:
- admin app: `http://localhost:3001/chat`
- local `query-api`: `http://127.0.0.1:4318`

The local dev flow is now good enough to open `/chat` and manually test supported Tiger-backed prompts.

## What Has Been Verified

### Direct `query-api` checks
Verified successfully on Railway and/or local query-api:
- `/healthz`
- `/readyz`
- `/v1/contracts`
- `searchCatalog`
- `rankEntities`
- `traceMetricHistory`
- `explainChanges`
- `searchDocuments`

### Real prompt checks
These were confirmed as Tiger-primary successes:
- `Show me all games by FromSoftware`
- `What are the top games by reviews?`
- `How have Hades II reviews changed over the last 30 days?`
- `Show Counter-Strike 2 CCU and owners over the last 30 days`
- `Any recent announcements about Primeval?`
- `What changed for Primeval this week?`

### Eval harness
The bounded Tiger-primary/shadow prompt packs were implemented and have passed locally.

## What Is Not Finished Yet

Tiger is not fully replacing the legacy stack yet. The major remaining work is capability and cutover work.

### Missing chat capabilities
Still planned / not yet implemented:
- `semanticSearch`
- `compareEntities`
- `continueResultSet`
- `getUserContext` if portfolio/pins/alerts need Tiger-backed answers

### Remaining fallback ownership
These prompt families are still not truly Tiger-complete:
- similarity prompts like `games like X`
- compare prompts
- continuation / follow-up narrowing
- breakout / momentum style prompts

### Full product cutover
Still remaining:
- remove remaining legacy chat ownership
- migrate page/server read paths fully onto `query-api` + Tiger
- decide final source-of-truth / serving transition away from Supabase/Cube for main product reads

## Current Local Setup

### Local endpoints
- admin: `http://localhost:3001`
- local query-api: `http://127.0.0.1:4318`
- Railway query-api: `https://publisheriq-production.up.railway.app`

### Current local behavior
- localhost chat is wired to Tiger-backed `query-api`
- supported prompts should show Tiger as the answer source
- unsupported prompts should fall back to legacy behavior

## Important Repo State

### Pushed branch state
Latest pushed branch:
- `timescale-tiger-refactor`

Recent pushed milestone commits included:
- Tiger rollout base
- Railway deployment prep
- Railway Docker/healthcheck fixes

### Current uncommitted work
There are still local uncommitted changes in the repo, including:
- latest Tiger chat/rendering updates
- local browser chat bypass support
- prompt eval/runbook updates
- unrelated ingestion/docs/migration work outside the Tiger slice

If this work needs to be resumed later, check `git status` first before assuming the branch is clean.

## Recommended Next Steps

Priority order:
1. Test the current Tiger-backed `/chat` flow locally and in the branch preview.
2. Finish the missing Tiger chat capabilities:
   - `semanticSearch`
   - `compareEntities`
   - `continueResultSet`
3. Move remaining supported prompt families from fallback/legacy ownership to Tiger ownership.
4. Remove legacy read-path dependence and complete the broader product cutover.

## Short Summary

If this chat is wiped, the important headline is:

Tiger is already serving real chat answers for rankings, catalog search, metric history, news search, and change explanations. `query-api` is deployed on Railway, localhost `/chat` is usable, and the project is now in the capability-gap-and-cutover phase, not the proof-of-concept phase.
