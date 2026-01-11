# Database Quick Reference
## PublisherIQ Schema Cheatsheet

---

## Core Entities

| Table | Rows | Purpose | Key Columns |
|-------|------|---------|-------------|
| `apps` | 157K | Steam applications | `appid` (PK), `name`, `type`, `release_date`, `current_price_cents` |
| `publishers` | 90K | Publisher entities | `id` (PK), `name`, `normalized_name`, `game_count` |
| `developers` | 105K | Developer entities | `id` (PK), `name`, `normalized_name`, `game_count` |
| `franchises` | 13K | Game series | `id` (PK), `name` |

---

## Junction Tables (Many-to-Many)

| Table | Rows | Connects | Key |
|-------|------|----------|-----|
| `app_publishers` | 163K | apps ↔ publishers | `(appid, publisher_id)` |
| `app_developers` | 171K | apps ↔ developers | `(appid, developer_id)` |
| `app_steam_tags` | 2.4M | apps ↔ steam_tags | `(appid, tag_id)` |
| `app_genres` | 456K | apps ↔ steam_genres | `(appid, genre_id)` |
| `app_categories` | 779K | apps ↔ steam_categories | `(appid, category_id)` |
| `app_franchises` | 37K | apps ↔ franchises | `(appid, franchise_id)` |

---

## Reference Tables (PICS Data)

| Table | Rows | Purpose |
|-------|------|---------|
| `steam_tags` | 446 | Tag ID → name mapping |
| `steam_genres` | 42 | Genre ID → name |
| `steam_categories` | 74 | Category ID → name |

---

## Metrics Tables

| Table | Rows | Purpose | Retention |
|-------|------|---------|-----------|
| `daily_metrics` | 1M+ | Daily CCU, reviews, owners | None (growing ~90K/day) |
| `review_histogram` | 2.9M | Monthly review buckets | None |
| `ccu_snapshots` | 2K | Hourly CCU samples | 30 days |
| `review_deltas` | 8.6K | Daily review changes | None |
| `app_trends` | 9 | Computed trends | None |

---

## Materialized Views

| View | Rows | Refreshed | Purpose |
|------|------|-----------|---------|
| `latest_daily_metrics` | 151K | Auto | Latest metrics per app |
| `publisher_metrics` | 90K | Daily 05:00 | All-time publisher aggregations |
| `developer_metrics` | 140K | Daily 05:00 | All-time developer aggregations |
| `publisher_game_metrics` | 127K | Daily 05:00 | Per-game publisher data |
| `developer_game_metrics` | 134K | Daily 05:00 | Per-game developer data |
| `publisher_year_metrics` | 93K | Daily 05:00 | By-year publisher stats |
| `developer_year_metrics` | 109K | Daily 05:00 | By-year developer stats |
| `review_velocity_stats` | 5.6K | Daily | Velocity metrics |
| `monthly_game_metrics` | 247K | Daily | Monthly aggregations |

---

## Operational Tables

| Table | Rows | Purpose |
|-------|------|---------|
| `sync_status` | 157K | Per-app sync tracking (1:1 with apps) |
| `sync_jobs` | 2.4K | Job execution history |
| `ccu_tier_assignments` | 118K | CCU polling tier assignments |
| `pics_sync_state` | 1 | Global PICS change number |
| `dashboard_stats_cache` | 1 | Cached dashboard counts |

---

## User System Tables

| Table | Rows | Purpose | Sensitive |
|-------|------|---------|-----------|
| `user_profiles` | 5 | User data + credits | email, full_name |
| `waitlist` | 5 | Access requests | email, full_name |
| `credit_transactions` | 0 | Credit audit log | user_id |
| `credit_reservations` | 0 | Active credit holds | user_id |
| `rate_limit_state` | 0 | Per-user rate limits | user_id |
| `chat_query_logs` | 100 | Chat analytics (7-day) | query_text, user_id |

---

## Key Enums

| Enum | Values |
|------|--------|
| `app_type` | game, dlc, demo, mod, video, hardware, music, episode, tool, application, series, advertising |
| `refresh_tier` | active, moderate, dormant, dead |
| `steam_deck_category` | unknown, unsupported, playable, verified |
| `trend_direction` | up, down, stable |
| `user_role` | user, admin |
| `waitlist_status` | pending, approved, rejected |

---

## Data Authority

| Data Type | Authoritative Source | Fallback |
|-----------|---------------------|----------|
| Developer/Publisher names | Storefront API | - |
| Tags/Genres/Categories | PICS | - |
| Review scores | daily_metrics | apps.pics_review_score |
| CCU | Steam API (ccu_snapshots) | SteamSpy (daily_metrics) |
| Prices | apps.current_price_cents | daily_metrics.price_cents |

---

## Quick Queries

```sql
-- Get app with all relationships
SELECT a.*, p.name as publisher, d.name as developer
FROM apps a
LEFT JOIN app_publishers ap ON a.appid = ap.appid
LEFT JOIN publishers p ON ap.publisher_id = p.id
LEFT JOIN app_developers ad ON a.appid = ad.appid
LEFT JOIN developers d ON ad.developer_id = d.id
WHERE a.appid = 123456;

-- Get latest metrics for a game
SELECT * FROM latest_daily_metrics WHERE appid = 123456;

-- Get publisher's games with metrics
SELECT * FROM publisher_game_metrics WHERE publisher_id = 123;

-- Get games by tag
SELECT a.appid, a.name
FROM apps a
JOIN app_steam_tags ast ON a.appid = ast.appid
JOIN steam_tags st ON ast.tag_id = st.tag_id
WHERE st.name = 'Indie'
LIMIT 100;
```

---

## Database Size

| Component | Size |
|-----------|------|
| Total Database | 1.6 GB |
| Table Data | 803 MB |
| Indexes | 807 MB |
| Materialized Views | 309 MB |
| Unused Indexes | 313 MB |
