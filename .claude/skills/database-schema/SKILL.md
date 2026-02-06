# Database Schema Reference

Use this skill when working on database queries, materialized views, RPC functions, or schema changes.

## Key Column Schemas

**apps** (use `appid` not `id`):
```
appid, name, type, is_released, is_delisted, release_date, release_date_raw,
platforms, controller_support, is_free, current_price_cents, current_discount_percent,
metacritic_score, metacritic_url, pics_review_score, pics_review_percentage,
parent_appid, created_at, updated_at, last_content_update
```
**NO `description` or `short_description` column exists.**

**daily_metrics** (use `metric_date` NOT `date`):
```
id, appid, metric_date, ccu_peak, ccu_source, total_reviews, positive_reviews,
negative_reviews, review_score, review_score_desc, owners_min, owners_max,
price_cents, discount_percent, average_playtime_forever, average_playtime_2weeks
```

**sync_status:**
```
appid, refresh_tier, priority_score, last_storefront_sync, last_reviews_sync,
last_steamspy_sync, last_histogram_sync, last_ccu_synced, ccu_tier,
consecutive_errors, storefront_accessible, created_at, updated_at
```

## Core Tables

| Table | Purpose |
|-------|---------|
| `apps` | Steam apps with metadata, prices, platforms |
| `publishers` / `developers` | Entity tables with game_count, embedding_hash |
| `app_publishers` / `app_developers` | Many-to-many relationships |
| `daily_metrics` | Daily snapshots (CCU, reviews, owners, price) |
| `ccu_snapshots` | Hourly CCU samples (30-day retention) |
| `review_histogram` | Monthly review buckets for trends |
| `review_deltas` | Daily review changes with interpolation flag |
| `app_trends` | Computed 30/90-day trends |
| `sync_status` | Per-app sync tracking with priority scores |
| `sync_jobs` | Job execution history |
| `chat_query_logs` | Chat analytics (7-day retention) |
| `pics_sync_state` | PICS change number tracking |
| `ccu_tier_assignments` | CCU tier assignment with reason |

### PICS Data Tables
`steam_tags`, `steam_genres`, `steam_categories`, `franchises`,
`app_steam_tags`, `app_genres`, `app_categories`, `app_franchises`, `app_steam_deck`

### User System Tables
`user_profiles`, `waitlist`, `credit_transactions`, `credit_reservations`, `rate_limit_state`

### Personalization Tables
`user_pins`, `user_alerts`, `user_alert_preferences`, `user_pin_alert_settings`, `alert_detection_state`

## Materialized Views (20 total)

| View | Purpose | Refresh |
|------|---------|---------|
| `latest_daily_metrics` | Most recent metrics per app | Auto |
| `publisher_metrics` | All-time publisher aggregations | `REFRESH MATERIALIZED VIEW CONCURRENTLY publisher_metrics;` |
| `developer_metrics` | All-time developer aggregations | `REFRESH MATERIALIZED VIEW CONCURRENTLY developer_metrics;` |
| `publisher_year_metrics` | Per-year publisher stats | View (auto) |
| `developer_year_metrics` | Per-year developer stats | View (auto) |
| `publisher_game_metrics` | Per-game publisher data | View (auto) |
| `developer_game_metrics` | Per-game developer data | View (auto) |
| `review_velocity_stats` | Velocity metrics per app | Daily via `refresh_mat_views()` |
| `monthly_game_metrics` | Monthly aggregated game stats | Daily via `refresh_mat_views()` |
| `monthly_publisher_metrics` | Monthly publisher stats | Daily via `refresh_mat_views()` |
| `app_filter_data` | Pre-computed content arrays | Every 6 hours |
| `mv_tag_counts` | Tag counts by app type | Daily via `refresh_filter_count_views()` |
| `mv_genre_counts` | Genre counts by app type | Daily |
| `mv_category_counts` | Category counts by app type | Daily |
| `mv_steam_deck_counts` | Steam Deck counts by app type | Daily |
| `mv_ccu_tier_counts` | CCU tier distribution | Daily |
| `mv_velocity_tier_counts` | Velocity tier distribution | Daily |
| `mv_apps_aggregate_stats` | Summary stats by app type | Daily |

## Key RPC Functions

| Function | Used By |
|----------|---------|
| `get_apps_with_filters()` | Games page |
| `get_apps_aggregate_stats()` | Games page stats bar |
| `get_app_sparkline_data()` | Games page sparklines |
| `get_apps_filter_option_counts()` | Games page filter dropdowns |
| `get_companies_with_filters()` | Companies page |
| `get_companies_aggregate_stats()` | Companies page stats |
| `get_company_sparkline_data()` | Companies page sparklines |
| `get_filter_option_counts()` | Companies page filter dropdowns |
| `get_companies_by_ids()` | Companies compare mode |
| `recalculate_ccu_tiers()` | CCU tier reassignment |
| `refresh_mat_views()` | Materialized view refresh |
| `refresh_filter_count_views()` | Filter count view refresh |

## Enums

```sql
app_type: 'game', 'dlc', 'demo', 'mod', 'video', 'hardware', 'music'
sync_source: 'steamspy', 'storefront', 'reviews', 'histogram', 'scraper', 'pics'
trend_direction: 'up', 'down', 'stable'
refresh_tier: 'active', 'moderate', 'dormant', 'dead'
steam_deck_category: 'unknown', 'unsupported', 'playable', 'verified'
ccu_tier: 'tier1', 'tier2', 'tier3'
user_role: 'user', 'admin'
alert_type: 'ccu_spike', 'ccu_drop', 'trend_reversal', 'review_surge', 'sentiment_shift', 'price_change', 'new_release', 'milestone'
alert_severity: 'low', 'medium', 'high'
```
