# Chat System Reference

Use this skill when working on the AI chat interface, LLM tools, Cube.js integration, or credit system.

The chat uses Cube.js semantic layer (NOT raw SQL) with 9 LLM tools.

**Default model:** `gpt-4o-mini` (configurable via `LLM_PROVIDER` env var)

## LLM Tools

| Tool | Purpose | Credit Cost |
|------|---------|-------------|
| `query_analytics` | Structured queries via Cube.js cubes | 8 |
| `find_similar` | Vector similarity search via Qdrant | 12 |
| `search_by_concept` | Semantic search by description | 0 |
| `search_games` | Tag/genre/category discovery with fuzzy matching | 8 |
| `discover_trending` | Trend-based: momentum, accelerating, breaking_out | 0 |
| `lookup_publishers` | Find exact publisher names (ILIKE) | 4 |
| `lookup_developers` | Find exact developer names (ILIKE) | 4 |
| `lookup_tags` | Discover available tags/genres/categories | 4 |
| `lookup_games` | Find exact game names (ILIKE) | 0 |

## Credit System

Feature-flagged via `CREDITS_ENABLED` env var. Token costs: input 2/1k, output 8/1k. Min charge: 4 credits. Default reservation: 25 credits.

## Chat-Exposed Cubes (11 cubes referenced in system prompt)

| Cube | Source | Purpose |
|------|--------|---------|
| `Discovery` | apps + latest_daily_metrics + app_trends + app_steam_deck | Game discovery |
| `PublisherMetrics` | publisher_metrics (materialized) | All-time publisher stats |
| `PublisherYearMetrics` | publisher_year_metrics | Publisher stats by year |
| `PublisherGameMetrics` | publisher_game_metrics | Per-game publisher data |
| `DeveloperMetrics` | developer_metrics (materialized) | All-time developer stats |
| `DeveloperYearMetrics` | developer_year_metrics | Developer stats by year |
| `DeveloperGameMetrics` | developer_game_metrics | Per-game developer data |
| `DailyMetrics` | daily_metrics | Historical time-series |
| `LatestMetrics` | latest_daily_metrics | Current snapshot |
| `ReviewVelocity` | review_velocity_stats | Velocity discovery |
| `ReviewDeltas` | review_deltas | Daily review delta analysis |

**16 additional cubes** (Apps, AppPublishers, AppDevelopers, AppTrends, AppSteamDeck, Genres, AppGenres, Tags, AppTags, Publishers, Developers, MonthlyGameMetrics, MonthlyPublisherMetrics, SyncJobs, SyncStatus, PicsSyncState) exist in model files but are not directly exposed to the chat LLM.

## Entity Linking

Pre-formatted before LLM sees results:
- Games: `[Name](game:APPID)` renders as link to `/apps/{appid}`
- Publishers: `[Name](/publishers/ID)` renders as link
- Developers: `[Name](/developers/ID)` renders as link

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/llm/cube-system-prompt.ts` | System prompt with Cube schemas |
| `src/lib/llm/cube-tools.ts` | 9 tool definitions |
| `src/lib/cube-executor.ts` | Query executor (3 retries, 30s timeout) |
| `src/lib/llm/format-entity-links.ts` | Entity link pre-formatting |
| `src/app/api/chat/stream/route.ts` | SSE streaming API |

All paths relative to `apps/admin/`.

## Cube Model File Mappings

When modifying cubes, always update `cube-system-prompt.ts` too.

| File | Cubes |
|------|-------|
| `Apps.js` | Apps, AppPublishers, AppDevelopers, AppTrends, AppSteamDeck |
| `Discovery.js` | Discovery, Genres, AppGenres, Tags, AppTags |
| `Publishers.js` | Publishers, PublisherMetrics, PublisherYearMetrics, PublisherGameMetrics |
| `Developers.js` | Developers, DeveloperMetrics, DeveloperYearMetrics, DeveloperGameMetrics |
| `DailyMetrics.js` | DailyMetrics, **LatestMetrics** (both in same file!) |
| `MonthlyMetrics.js` | MonthlyGameMetrics, MonthlyPublisherMetrics |
| `ReviewVelocity.js` | ReviewVelocity |
| `ReviewDeltas.js` | ReviewDeltas |
| `SyncHealth.js` | SyncJobs, SyncStatus, PicsSyncState |
