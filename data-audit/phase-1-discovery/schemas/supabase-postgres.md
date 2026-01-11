# PublisherIQ Database Schema Documentation

> Complete schema documentation for the Supabase PostgreSQL database.
> Generated: January 9, 2026

---

## Overview

| Metric | Value |
|--------|-------|
| **Database** | PostgreSQL 17.6 |
| **Size** | 1,622 MB |
| **Tables** | 32 |
| **Materialized Views** | 9 |
| **Functions** | 56 |
| **Enums** | 11 (application-specific) |

---

## Table Inventory by Row Count

| Table | Row Count | Size | Description |
|-------|-----------|------|-------------|
| review_histogram | 2,902,078 | 171 MB | Monthly review distribution buckets per game |
| app_steam_tags | 2,413,317 | 128 MB | Game-to-tag relationships from PICS |
| daily_metrics | 1,070,489 | 98 MB | Daily snapshots of game metrics (CCU, reviews, owners) |
| app_categories | 778,885 | 34 MB | Game-to-feature category relationships |
| app_genres | 456,072 | 24 MB | Game-to-genre relationships |
| app_developers | 170,872 | 6.2 MB | Many-to-many: games to developers |
| app_publishers | 162,683 | 5.8 MB | Many-to-many: games to publishers |
| apps | 157,695 | 42 MB | Core Steam app catalog |
| sync_status | 157,695 | 48 MB | Per-app sync tracking and scheduling |
| ccu_tier_assignments | 117,766 | 15 MB | CCU polling tier assignments |
| developers | 105,090 | 14 MB | Developer entities |
| publishers | 89,767 | 13 MB | Publisher entities |
| app_dlc | 65,151 | 4.5 MB | DLC parent-child relationships |
| app_franchises | 36,952 | 1.6 MB | Game-to-franchise relationships |
| app_steam_deck | 30,547 | 16 MB | Steam Deck compatibility data |
| franchises | 13,307 | 1.2 MB | Game series/franchise entities |
| review_deltas | 8,605 | 944 KB | Daily review change tracking |
| sync_jobs | 2,385 | 400 KB | Job execution history |
| ccu_snapshots | 1,999 | 152 KB | Hourly CCU samples |
| steam_tags | 446 | 128 KB | Tag ID to name mapping |
| chat_query_logs | 100 | 56 KB | Chat analytics (7-day retention) |
| steam_categories | 74 | 64 KB | Feature category reference |
| steam_genres | 42 | 56 KB | Genre reference table |
| app_trends | 9 | 40 KB | Computed 30/90-day trends |
| dashboard_stats_cache | 1 | 48 KB | Cached dashboard statistics |
| pics_sync_state | 1 | 40 KB | PICS change number tracking |
| user_profiles | 5 | 16 KB | User data with credits |
| waitlist | 5 | 16 KB | Email signup queue |
| credit_transactions | 0 | 8 KB | Credit audit log |
| credit_reservations | 0 | 0 bytes | Active credit holds |
| rate_limit_state | 0 | 0 bytes | Per-user rate limiting |
| app_tags | 0 | 8 KB | SteamSpy user-voted tags (deprecated) |

---

## Enums

### Application-Specific Enums

| Enum | Values | Description |
|------|--------|-------------|
| `app_type` | game, dlc, demo, mod, video, hardware, music, episode, tool, application, series, advertising | Type of Steam application |
| `sync_source` | steamspy, storefront, reviews, histogram, scraper, pics | Data source for sync operations |
| `trend_direction` | up, down, stable | Direction of metric trend |
| `refresh_tier` | active, moderate, dormant, dead | Sync frequency tier |
| `steam_deck_category` | unknown, unsupported, playable, verified | Steam Deck compatibility level |
| `user_role` | user, admin | User authorization level |
| `waitlist_status` | pending, approved, rejected | Waitlist entry status |
| `credit_transaction_type` | signup_bonus, admin_grant, admin_deduct, chat_usage, refund | Credit transaction types |
| `credit_reservation_status` | pending, finalized, refunded | Credit reservation states |

---

## Core Tables

### apps

**Purpose:** Central catalog of Steam applications (games, DLC, demos, etc.)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| appid | integer | NOT NULL | - | Primary key, Steam app ID |
| name | text | NOT NULL | - | App display name |
| type | app_type | YES | 'game' | Application type |
| is_free | boolean | YES | false | Free-to-play flag |
| release_date | date | YES | - | Official release date |
| release_date_raw | text | YES | - | Raw date string from Steam |
| page_creation_date | date | YES | - | When Steam page was created |
| page_creation_date_raw | text | YES | - | Raw creation date string |
| has_workshop | boolean | YES | false | Steam Workshop enabled |
| current_price_cents | integer | YES | - | Current price in cents |
| current_discount_percent | integer | YES | 0 | Active discount percentage |
| is_released | boolean | YES | true | Release status |
| is_delisted | boolean | YES | false | Removed from store |
| has_developer_info | boolean | YES | false | Developer/publisher fetched |
| controller_support | text | YES | - | 'full', 'partial', or NULL |
| pics_review_score | smallint | YES | - | Review score (1-9) from PICS |
| pics_review_percentage | smallint | YES | - | Positive % (0-100) from PICS |
| metacritic_score | smallint | YES | - | Metacritic score |
| metacritic_url | text | YES | - | Metacritic page URL |
| platforms | text | YES | - | Comma-separated: windows,macos,linux |
| release_state | text | YES | - | PICS state: released, prerelease, etc. |
| parent_appid | integer | YES | - | Parent app for DLC/demos/mods |
| homepage_url | text | YES | - | Game homepage URL |
| app_state | text | YES | - | Application state |
| last_content_update | timestamptz | YES | - | Last PICS depot update |
| current_build_id | text | YES | - | Current build from PICS |
| content_descriptors | jsonb | YES | - | Mature content flags |
| languages | jsonb | YES | - | Supported languages |
| created_at | timestamptz | YES | now() | Row creation time |
| updated_at | timestamptz | YES | now() | Last update time |

**Indexes:**
- `apps_pkey` PRIMARY KEY (appid)
- `idx_apps_name` btree (name)
- `idx_apps_type` btree (type) WHERE type = 'game'
- `idx_apps_released` btree (is_released, is_delisted)
- `idx_apps_parent_appid` btree (parent_appid) WHERE parent_appid IS NOT NULL
- `idx_apps_platforms` btree (platforms) WHERE platforms IS NOT NULL
- `idx_apps_needs_dev_info` btree (appid) WHERE has_developer_info = false
- `idx_apps_embedding_filter` btree (type, is_delisted) - Partial index for embedding candidates

**Foreign Key References (from other tables):**
- app_categories, app_developers, app_publishers, app_franchises, app_genres, app_steam_deck, app_steam_tags, app_tags, app_trends, ccu_snapshots, ccu_tier_assignments, daily_metrics, review_deltas, review_histogram, sync_status

---

### publishers

**Purpose:** Publisher entities with aggregate metrics and embedding tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NOT NULL | auto | Primary key |
| name | text | NOT NULL | - | Publisher name (unique) |
| normalized_name | text | NOT NULL | - | Lowercase normalized name |
| steam_vanity_url | text | YES | - | Steam vanity URL |
| first_game_release_date | date | YES | - | Earliest game release |
| first_page_creation_date | date | YES | - | Earliest page creation |
| game_count | integer | YES | 0 | Number of games published |
| last_embedding_sync | timestamptz | YES | - | Last Qdrant sync timestamp |
| embedding_hash | text | YES | - | Hash for change detection |
| created_at | timestamptz | YES | now() | Row creation time |
| updated_at | timestamptz | YES | now() | Last update time |

**Indexes:**
- `publishers_pkey` PRIMARY KEY (id)
- `publishers_name_key` UNIQUE (name)
- `idx_publishers_normalized` btree (normalized_name)
- `idx_publishers_embedding_needed` btree (game_count DESC, last_embedding_sync NULLS FIRST) WHERE game_count > 0

---

### developers

**Purpose:** Developer entities with aggregate metrics and embedding tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NOT NULL | auto | Primary key |
| name | text | NOT NULL | - | Developer name (unique) |
| normalized_name | text | NOT NULL | - | Lowercase normalized name |
| steam_vanity_url | text | YES | - | Steam vanity URL |
| first_game_release_date | date | YES | - | Earliest game release |
| first_page_creation_date | date | YES | - | Earliest page creation |
| game_count | integer | YES | 0 | Number of games developed |
| last_embedding_sync | timestamptz | YES | - | Last Qdrant sync timestamp |
| embedding_hash | text | YES | - | Hash for change detection |
| created_at | timestamptz | YES | now() | Row creation time |
| updated_at | timestamptz | YES | now() | Last update time |

**Indexes:**
- `developers_pkey` PRIMARY KEY (id)
- `developers_name_key` UNIQUE (name)
- `idx_developers_normalized` btree (normalized_name)
- `idx_developers_embedding_needed` btree (game_count DESC, last_embedding_sync NULLS FIRST) WHERE game_count > 0

---

## Junction Tables

### app_publishers

**Purpose:** Many-to-many relationship between apps and publishers.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| appid | integer | NOT NULL | - | FK to apps.appid |
| publisher_id | integer | NOT NULL | - | FK to publishers.id |

**Primary Key:** (appid, publisher_id)

**Triggers:** `trigger_app_publishers_count` - Updates publishers.game_count on INSERT/DELETE

---

### app_developers

**Purpose:** Many-to-many relationship between apps and developers.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| appid | integer | NOT NULL | - | FK to apps.appid |
| developer_id | integer | NOT NULL | - | FK to developers.id |

**Primary Key:** (appid, developer_id)

**Triggers:** `trigger_app_developers_count` - Updates developers.game_count on INSERT/DELETE

---

### app_dlc

**Purpose:** DLC parent-child relationships. No FK constraints due to sync order issues.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| parent_appid | integer | NOT NULL | - | Base game app ID |
| dlc_appid | integer | NOT NULL | - | DLC app ID |
| source | text | NOT NULL | 'pics' | Data source |
| created_at | timestamptz | YES | now() | Row creation time |

**Primary Key:** (parent_appid, dlc_appid)

---

## PICS Data Tables

### steam_tags

**Purpose:** Reference table mapping Steam tag IDs to names.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| tag_id | integer | NOT NULL | - | Steam tag ID |
| name | text | NOT NULL | - | Tag display name |
| created_at | timestamptz | YES | now() | Row creation time |
| updated_at | timestamptz | YES | now() | Last update time |

**Primary Key:** (tag_id)
**Row Count:** 446 tags

---

### steam_genres

**Purpose:** Reference table for Steam genre IDs.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| genre_id | integer | NOT NULL | - | Steam genre ID |
| name | text | NOT NULL | - | Genre display name |
| created_at | timestamptz | YES | now() | Row creation time |

**Primary Key:** (genre_id)
**Row Count:** 42 genres

**Common Genres:**
- 1: Action, 2: Strategy, 3: RPG, 4: Casual, 23: Indie, 25: Adventure, 28: Simulation, 37: Free to Play, 70: Early Access

---

### steam_categories

**Purpose:** Reference table for Steam feature categories.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| category_id | integer | NOT NULL | - | Steam category ID |
| name | text | NOT NULL | - | Category display name |
| description | text | YES | - | Category description |
| created_at | timestamptz | YES | now() | Row creation time |

**Primary Key:** (category_id)
**Row Count:** 74 categories

**Common Categories:**
- 1: Multi-player, 2: Single-player, 9: Co-op, 20: MMO, 22: Steam Achievements, 23: Steam Cloud, 28: Full controller support, 29: Steam Trading Cards, 30: Steam Workshop, 35: In-App Purchases, 36: Online PvP

---

### franchises

**Purpose:** Game series/franchise entities from PICS.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NOT NULL | auto | Primary key |
| name | text | NOT NULL | - | Franchise name (unique) |
| normalized_name | text | NOT NULL | - | Lowercase normalized name |
| created_at | timestamptz | YES | now() | Row creation time |
| updated_at | timestamptz | YES | now() | Last update time |

**Primary Key:** (id)
**Row Count:** 13,307 franchises

---

### app_steam_tags

**Purpose:** Game-to-tag relationships with ranking from PICS.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| appid | integer | NOT NULL | - | FK to apps.appid |
| tag_id | integer | NOT NULL | - | FK to steam_tags.tag_id |
| rank | integer | YES | - | Tag relevance rank |
| created_at | timestamptz | YES | now() | Row creation time |

**Primary Key:** (appid, tag_id)
**Row Count:** 2,413,317 relationships

---

### app_genres

**Purpose:** Game-to-genre relationships from PICS.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| appid | integer | NOT NULL | - | FK to apps.appid |
| genre_id | integer | NOT NULL | - | FK to steam_genres.genre_id |
| is_primary | boolean | YES | false | Primary genre flag |
| created_at | timestamptz | YES | now() | Row creation time |

**Primary Key:** (appid, genre_id)
**Row Count:** 456,072 relationships

---

### app_categories

**Purpose:** Game-to-feature category relationships from PICS.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| appid | integer | NOT NULL | - | FK to apps.appid |
| category_id | integer | NOT NULL | - | FK to steam_categories.category_id |
| created_at | timestamptz | YES | now() | Row creation time |

**Primary Key:** (appid, category_id)
**Row Count:** 778,885 relationships

---

### app_franchises

**Purpose:** Game-to-franchise relationships from PICS.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| appid | integer | NOT NULL | - | FK to apps.appid |
| franchise_id | integer | NOT NULL | - | FK to franchises.id |
| created_at | timestamptz | YES | now() | Row creation time |

**Primary Key:** (appid, franchise_id)
**Row Count:** 36,952 relationships

---

### app_steam_deck

**Purpose:** Steam Deck compatibility data from PICS.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| appid | integer | NOT NULL | - | FK to apps.appid |
| category | steam_deck_category | NOT NULL | 'unknown' | Compatibility level |
| test_timestamp | timestamptz | YES | - | When compatibility was tested |
| tested_build_id | text | YES | - | Build ID that was tested |
| tests | jsonb | YES | - | Individual test results |
| updated_at | timestamptz | YES | now() | Last update time |

**Primary Key:** (appid)
**Row Count:** 30,547 apps with compatibility data

---

## Metrics Tables

### daily_metrics

**Purpose:** Daily snapshots of game metrics including CCU, reviews, and ownership.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NOT NULL | auto | Primary key |
| appid | integer | NOT NULL | - | FK to apps.appid |
| metric_date | date | NOT NULL | - | Date of snapshot |
| owners_min | integer | YES | - | Estimated minimum owners |
| owners_max | integer | YES | - | Estimated maximum owners |
| ccu_peak | integer | YES | - | Peak concurrent users |
| average_playtime_forever | integer | YES | - | Lifetime average playtime (minutes) |
| average_playtime_2weeks | integer | YES | - | 2-week average playtime (minutes) |
| total_reviews | integer | YES | - | Total review count |
| positive_reviews | integer | YES | - | Positive review count |
| negative_reviews | integer | YES | - | Negative review count |
| review_score | smallint | YES | - | Review score (1-9) |
| review_score_desc | text | YES | - | Review score description |
| recent_total_reviews | integer | YES | - | Recent review count |
| recent_positive | integer | YES | - | Recent positive reviews |
| recent_negative | integer | YES | - | Recent negative reviews |
| recent_score_desc | text | YES | - | Recent review description |
| price_cents | integer | YES | - | Price snapshot in cents |
| discount_percent | smallint | YES | 0 | Active discount |

**Primary Key:** (id)
**Unique Constraint:** (appid, metric_date)
**Row Count:** 1,070,489 daily snapshots

---

### review_histogram

**Purpose:** Monthly review distribution buckets for trend analysis.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NOT NULL | auto | Primary key |
| appid | integer | NOT NULL | - | FK to apps.appid |
| month_start | date | NOT NULL | - | First day of month |
| recommendations_up | integer | NOT NULL | - | Positive reviews that month |
| recommendations_down | integer | NOT NULL | - | Negative reviews that month |
| fetched_at | timestamptz | YES | now() | When data was fetched |

**Primary Key:** (id)
**Unique Constraint:** (appid, month_start)
**Row Count:** 2,902,078 monthly buckets

---

### review_deltas

**Purpose:** Daily review change tracking for velocity-based sync scheduling.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NOT NULL | auto | Primary key |
| appid | integer | NOT NULL | - | FK to apps.appid |
| delta_date | date | NOT NULL | - | Date of delta |
| total_reviews | integer | NOT NULL | - | Total reviews at snapshot |
| positive_reviews | integer | NOT NULL | - | Positive reviews at snapshot |
| review_score | smallint | YES | - | Review score |
| review_score_desc | text | YES | - | Review score description |
| reviews_added | integer | NOT NULL | 0 | New reviews since last sync |
| positive_added | integer | NOT NULL | 0 | New positive reviews |
| negative_added | integer | NOT NULL | 0 | New negative reviews |
| hours_since_last_sync | numeric(6,2) | YES | - | Time since previous sync |
| daily_velocity | numeric(8,4) | GENERATED | - | Reviews/day (computed) |
| is_interpolated | boolean | NOT NULL | false | Estimated vs actual data |
| created_at | timestamptz | YES | now() | Row creation time |

**Primary Key:** (id)
**Unique Constraint:** (appid, delta_date)
**Row Count:** 8,605 deltas

---

### app_trends

**Purpose:** Computed 30-day and 90-day trend metrics.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| appid | integer | NOT NULL | - | FK to apps.appid |
| trend_30d_direction | trend_direction | YES | - | 30-day trend direction |
| trend_30d_change_pct | numeric(6,2) | YES | - | 30-day percent change |
| trend_90d_direction | trend_direction | YES | - | 90-day trend direction |
| trend_90d_change_pct | numeric(6,2) | YES | - | 90-day percent change |
| current_positive_ratio | numeric(5,4) | YES | - | Current positive ratio |
| previous_positive_ratio | numeric(5,4) | YES | - | Previous positive ratio |
| review_velocity_7d | numeric(10,2) | YES | - | 7-day review velocity |
| review_velocity_30d | numeric(10,2) | YES | - | 30-day review velocity |
| ccu_trend_7d_pct | numeric(6,2) | YES | - | 7-day CCU trend % |
| updated_at | timestamptz | YES | now() | Last update time |

**Primary Key:** (appid)
**Row Count:** 9 apps (trends not fully populated)

---

## CCU Tracking Tables

### ccu_snapshots

**Purpose:** Hourly CCU samples with 30-day retention.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | bigint | NOT NULL | auto | Primary key |
| appid | integer | NOT NULL | - | FK to apps.appid |
| snapshot_time | timestamptz | NOT NULL | now() | When snapshot was taken |
| player_count | integer | NOT NULL | - | Exact player count |
| ccu_tier | smallint | NOT NULL | - | Tier at snapshot time (1, 2, or 3) |

**Primary Key:** (id)
**Unique Constraint:** (appid, snapshot_time)
**Row Count:** 1,999 snapshots

---

### ccu_tier_assignments

**Purpose:** Current tier assignment for CCU polling frequency.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| appid | integer | NOT NULL | - | FK to apps.appid |
| ccu_tier | smallint | NOT NULL | 3 | Tier level (1, 2, or 3) |
| tier_reason | text | YES | - | Why assigned to this tier |
| last_tier_change | timestamptz | YES | now() | When tier last changed |
| recent_peak_ccu | integer | YES | - | 7-day peak CCU (for Tier 1) |
| release_rank | integer | YES | - | Release date rank (for Tier 2) |
| updated_at | timestamptz | YES | now() | Last update time |

**Primary Key:** (appid)
**Row Count:** 117,766 assignments

**Tier Definitions:**
- Tier 1: Top 500 by 7-day peak CCU (polled hourly)
- Tier 2: Top 1000 newest releases (polled every 2 hours)
- Tier 3: All others (polled daily)

---

## Operational Tables

### sync_status

**Purpose:** Per-app sync tracking, scheduling, and error handling.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| appid | integer | NOT NULL | - | FK to apps.appid |
| last_steamspy_sync | timestamptz | YES | - | Last SteamSpy sync |
| last_storefront_sync | timestamptz | YES | - | Last Storefront sync |
| last_reviews_sync | timestamptz | YES | - | Last reviews sync |
| last_histogram_sync | timestamptz | YES | - | Last histogram sync |
| last_page_creation_scrape | timestamptz | YES | - | Last page scrape |
| last_pics_sync | timestamptz | YES | - | Last PICS sync |
| last_price_sync | timestamptz | YES | - | Last price sync |
| last_embedding_sync | timestamptz | YES | - | Last Qdrant sync |
| priority_score | integer | YES | 0 | Computed priority |
| priority_calculated_at | timestamptz | YES | - | When priority computed |
| next_sync_after | timestamptz | YES | now() | Next scheduled sync |
| sync_interval_hours | integer | YES | 24 | Sync interval |
| consecutive_errors | integer | YES | 0 | Error count |
| last_error_source | sync_source | YES | - | Source of last error |
| last_error_message | text | YES | - | Last error details |
| last_error_at | timestamptz | YES | - | When error occurred |
| needs_page_creation_scrape | boolean | YES | true | Needs scrape flag |
| is_syncable | boolean | YES | true | Can be synced |
| refresh_tier | refresh_tier | YES | 'moderate' | Sync frequency tier |
| last_activity_at | timestamptz | YES | - | Last activity detected |
| pics_change_number | bigint | YES | - | PICS change number |
| storefront_accessible | boolean | YES | true | Storefront available |
| steamspy_available | boolean | YES | - | SteamSpy has data |
| embedding_hash | text | YES | - | Embedding hash |
| next_reviews_sync | timestamptz | YES | now() | Next reviews sync |
| reviews_interval_hours | integer | YES | 24 | Reviews interval |
| review_velocity_tier | text | YES | 'unknown' | Velocity tier |
| last_known_total_reviews | integer | YES | - | Cached review count |
| velocity_7d | numeric(8,4) | YES | 0 | 7-day velocity |
| velocity_calculated_at | timestamptz | YES | - | Velocity calc time |
| last_steamspy_individual_fetch | timestamptz | YES | - | Individual fetch time |

**Primary Key:** (appid)
**Row Count:** 157,695 apps tracked

---

### sync_jobs

**Purpose:** Job execution history with GitHub Actions integration.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NOT NULL | gen_random_uuid() | Primary key |
| job_type | text | NOT NULL | - | Job identifier |
| started_at | timestamptz | YES | now() | Job start time |
| completed_at | timestamptz | YES | - | Job end time |
| status | text | YES | 'running' | Job status |
| items_processed | integer | YES | 0 | Total items processed |
| items_succeeded | integer | YES | 0 | Successful items |
| items_failed | integer | YES | 0 | Failed items |
| items_created | integer | YES | 0 | New records created |
| items_updated | integer | YES | 0 | Records updated |
| items_skipped | integer | YES | 0 | Items skipped |
| batch_size | integer | YES | - | Batch size used |
| error_message | text | YES | - | Error details |
| github_run_id | text | YES | - | GitHub Actions run ID |
| created_at | timestamptz | YES | now() | Row creation time |

**Primary Key:** (id)
**Row Count:** 2,385 job records

---

### pics_sync_state

**Purpose:** Global PICS sync state tracking for change numbers.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | integer | NOT NULL | 1 | Always 1 (single row) |
| last_change_number | bigint | NOT NULL | 0 | Last processed change number |
| updated_at | timestamptz | YES | now() | Last update time |

**Primary Key:** (id)
**Check Constraint:** id = 1 (single row table)

---

### dashboard_stats_cache

**Purpose:** Cached dashboard statistics for fast display.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | text | NOT NULL | 'main' | Cache key |
| apps_count | bigint | YES | 0 | Total apps |
| publishers_count | bigint | YES | 0 | Total publishers |
| developers_count | bigint | YES | 0 | Total developers |
| pics_synced | bigint | YES | 0 | PICS synced count |
| categories_count | bigint | YES | 0 | Categories count |
| genres_count | bigint | YES | 0 | Genres count |
| tags_count | bigint | YES | 0 | Tags count |
| franchises_count | bigint | YES | 0 | Franchises count |
| parent_app_count | bigint | YES | 0 | Parent apps count |
| updated_at | timestamptz | YES | now() | Last refresh time |

**Primary Key:** (id)

---

## User System Tables

### user_profiles

**Purpose:** User data with role and credit balance.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NOT NULL | - | FK to auth.users.id |
| email | text | NOT NULL | - | User email |
| full_name | text | YES | - | Display name |
| organization | text | YES | - | Company/org name |
| role | user_role | NOT NULL | 'user' | Authorization role |
| credit_balance | integer | NOT NULL | 0 | Current credits |
| total_credits_used | integer | NOT NULL | 0 | Lifetime credits used |
| total_messages_sent | integer | NOT NULL | 0 | Lifetime messages |
| created_at | timestamptz | NOT NULL | now() | Account creation |
| updated_at | timestamptz | NOT NULL | now() | Last update |

**Primary Key:** (id)
**Check Constraint:** credit_balance >= 0
**Row Count:** 5 users

---

### waitlist

**Purpose:** Email signup queue for access requests.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NOT NULL | gen_random_uuid() | Primary key |
| email | text | NOT NULL | - | Applicant email (unique) |
| full_name | text | NOT NULL | - | Applicant name |
| organization | text | YES | - | Company/org |
| how_i_plan_to_use | text | YES | - | Use case description |
| status | waitlist_status | NOT NULL | 'pending' | Application status |
| reviewed_by | uuid | YES | - | Admin who reviewed |
| reviewed_at | timestamptz | YES | - | Review timestamp |
| invite_sent_at | timestamptz | YES | - | Invite email sent |
| created_at | timestamptz | NOT NULL | now() | Submission time |

**Primary Key:** (id)
**Unique Constraint:** (email)
**Row Count:** 5 entries

---

### credit_transactions

**Purpose:** Immutable credit audit log.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NOT NULL | gen_random_uuid() | Primary key |
| user_id | uuid | NOT NULL | - | FK to user_profiles.id |
| amount | integer | NOT NULL | - | Credit amount (+/-) |
| balance_after | integer | NOT NULL | - | Balance after transaction |
| transaction_type | credit_transaction_type | NOT NULL | - | Transaction type |
| description | text | YES | - | Human-readable description |
| input_tokens | integer | YES | - | LLM input tokens |
| output_tokens | integer | YES | - | LLM output tokens |
| tool_credits | integer | YES | - | Tool usage credits |
| admin_user_id | uuid | YES | - | Admin who made adjustment |
| reservation_id | uuid | YES | - | Related reservation |
| created_at | timestamptz | NOT NULL | now() | Transaction time |

**Primary Key:** (id)
**Row Count:** 0 transactions

---

### credit_reservations

**Purpose:** Active credit holds for in-progress requests.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NOT NULL | gen_random_uuid() | Primary key |
| user_id | uuid | NOT NULL | - | FK to user_profiles.id |
| reserved_amount | integer | NOT NULL | - | Amount held |
| actual_amount | integer | YES | - | Final amount used |
| status | credit_reservation_status | NOT NULL | 'pending' | Reservation status |
| created_at | timestamptz | NOT NULL | now() | Reservation time |
| finalized_at | timestamptz | YES | - | Completion time |

**Primary Key:** (id)
**Row Count:** 0 reservations

---

### rate_limit_state

**Purpose:** Per-user rate limiting state.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| user_id | uuid | NOT NULL | - | FK to user_profiles.id |
| requests_this_minute | integer | NOT NULL | 0 | Minute counter |
| requests_this_hour | integer | NOT NULL | 0 | Hour counter |
| minute_window_start | timestamptz | NOT NULL | now() | Minute window start |
| hour_window_start | timestamptz | NOT NULL | now() | Hour window start |
| updated_at | timestamptz | NOT NULL | now() | Last update |

**Primary Key:** (user_id)
**Row Count:** 0 entries

---

### chat_query_logs

**Purpose:** Chat analytics with 7-day retention.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NOT NULL | gen_random_uuid() | Primary key |
| query_text | text | NOT NULL | - | User query |
| tool_names | text[] | YES | '{}' | Tools used |
| tool_count | integer | YES | 0 | Number of tool calls |
| iteration_count | integer | YES | 1 | LLM iterations |
| response_length | integer | YES | 0 | Response character count |
| timing_llm_ms | integer | YES | - | LLM processing time |
| timing_tools_ms | integer | YES | - | Tool execution time |
| timing_total_ms | integer | YES | - | Total request time |
| user_id | uuid | YES | - | FK to user_profiles.id |
| input_tokens | integer | YES | - | LLM input tokens |
| output_tokens | integer | YES | - | LLM output tokens |
| tool_credits_used | integer | YES | - | Tool credits |
| total_credits_charged | integer | YES | - | Total credits |
| reservation_id | uuid | YES | - | Credit reservation |
| created_at | timestamptz | YES | now() | Query time |

**Primary Key:** (id)
**Row Count:** 100 logs

---

## Materialized Views

### latest_daily_metrics

**Purpose:** Most recent metrics per app with computed fields.

| Column | Type | Description |
|--------|------|-------------|
| appid | integer | App ID |
| metric_date | date | Date of latest metrics |
| owners_min | integer | Min owners estimate |
| owners_max | integer | Max owners estimate |
| owners_midpoint | integer | Midpoint of owner range |
| ccu_peak | integer | Peak CCU |
| total_reviews | integer | Total review count |
| positive_reviews | integer | Positive review count |
| review_score | smallint | Review score |
| positive_percentage | numeric | Positive review % |
| price_cents | integer | Current price |
| estimated_weekly_hours | bigint | Estimated weekly playtime hours |

**Unique Index:** (appid)
**Row Count:** 151,133 apps
**Size:** 19 MB

---

### publisher_metrics

**Purpose:** ALL-TIME aggregate metrics for publishers.

| Column | Type | Description |
|--------|------|-------------|
| publisher_id | integer | Publisher ID |
| publisher_name | text | Publisher name |
| game_count | integer | Number of games |
| total_owners | bigint | Total estimated owners |
| total_ccu | bigint | Total peak CCU |
| estimated_weekly_hours | bigint | Total estimated weekly hours |
| total_reviews | bigint | Total reviews |
| positive_reviews | bigint | Total positive reviews |
| avg_review_score | smallint | Weighted average score |
| revenue_estimate_cents | bigint | Estimated total revenue |
| is_trending | boolean | Has trending games |
| games_trending_up | integer | Games trending up |
| games_trending_down | integer | Games trending down |
| games_trending_stable | integer | Games stable |
| games_released_last_year | integer | Recent releases |
| unique_developers | integer | Unique developer count |
| computed_at | timestamptz | Computation timestamp |

**Unique Index:** (publisher_id)
**Row Count:** 89,704 publishers
**Size:** 36 MB

---

### developer_metrics

**Purpose:** ALL-TIME aggregate metrics for developers.

| Column | Type | Description |
|--------|------|-------------|
| developer_id | integer | Developer ID |
| developer_name | text | Developer name |
| game_count | integer | Number of games |
| total_owners | bigint | Total estimated owners |
| total_ccu | bigint | Total peak CCU |
| estimated_weekly_hours | bigint | Total estimated weekly hours |
| total_reviews | bigint | Total reviews |
| positive_reviews | bigint | Total positive reviews |
| avg_review_score | smallint | Weighted average score |
| revenue_estimate_cents | bigint | Estimated total revenue |
| is_trending | boolean | Has trending games |
| games_trending_up | integer | Games trending up |
| games_trending_down | integer | Games trending down |
| games_trending_stable | integer | Games stable |
| games_released_last_year | integer | Recent releases |
| computed_at | timestamptz | Computation timestamp |

**Unique Index:** (developer_id)
**Row Count:** 139,927 developers
**Size:** 43 MB

---

### publisher_year_metrics

**Purpose:** Publisher metrics grouped by release year.

| Column | Type | Description |
|--------|------|-------------|
| publisher_id | integer | Publisher ID |
| publisher_name | text | Publisher name |
| release_year | integer | Year of release |
| earliest_release | date | First release in year |
| latest_release | date | Last release in year |
| game_count | integer | Games released that year |
| total_owners | bigint | Total owners for year |
| total_ccu | bigint | Total CCU for year |
| total_reviews | bigint | Total reviews for year |
| avg_review_score | smallint | Average score for year |
| revenue_estimate_cents | bigint | Revenue for year |

**Unique Index:** (publisher_id, release_year)
**Row Count:** 93,308 publisher-years
**Size:** 11 MB

---

### developer_year_metrics

**Purpose:** Developer metrics grouped by release year.

| Column | Type | Description |
|--------|------|-------------|
| developer_id | integer | Developer ID |
| developer_name | text | Developer name |
| release_year | integer | Year of release |
| earliest_release | date | First release in year |
| latest_release | date | Last release in year |
| game_count | integer | Games released that year |
| total_owners | bigint | Total owners for year |
| total_ccu | bigint | Total CCU for year |
| total_reviews | bigint | Total reviews for year |
| avg_review_score | smallint | Average score for year |
| revenue_estimate_cents | bigint | Revenue for year |

**Unique Index:** (developer_id, release_year)
**Row Count:** 109,333 developer-years
**Size:** 13 MB

---

### publisher_game_metrics

**Purpose:** Per-game metrics for each publisher.

| Column | Type | Description |
|--------|------|-------------|
| publisher_id | integer | Publisher ID |
| publisher_name | text | Publisher name |
| appid | integer | Game app ID |
| game_name | text | Game name |
| release_date | date | Release date |
| release_year | integer | Release year |
| current_price_cents | integer | Current price |
| owners | bigint | Estimated owners |
| ccu | integer | Peak CCU |
| total_reviews | integer | Total reviews |
| positive_reviews | integer | Positive reviews |
| review_score | smallint | Review score |
| revenue_estimate_cents | bigint | Estimated revenue |

**Unique Index:** (publisher_id, appid)
**Row Count:** 127,445 publisher-games
**Size:** 18 MB

---

### developer_game_metrics

**Purpose:** Per-game metrics for each developer.

| Column | Type | Description |
|--------|------|-------------|
| developer_id | integer | Developer ID |
| developer_name | text | Developer name |
| appid | integer | Game app ID |
| game_name | text | Game name |
| release_date | date | Release date |
| release_year | integer | Release year |
| current_price_cents | integer | Current price |
| owners | bigint | Estimated owners |
| ccu | integer | Peak CCU |
| total_reviews | integer | Total reviews |
| positive_reviews | integer | Positive reviews |
| review_score | smallint | Review score |
| revenue_estimate_cents | bigint | Estimated revenue |

**Unique Index:** (developer_id, appid)
**Row Count:** 134,115 developer-games
**Size:** 19 MB

---

### review_velocity_stats

**Purpose:** Pre-computed review velocity metrics per app.

| Column | Type | Description |
|--------|------|-------------|
| appid | integer | App ID |
| velocity_7d | numeric(8,4) | 7-day average reviews/day |
| velocity_30d | numeric(8,4) | 30-day average reviews/day |
| reviews_added_7d | integer | Reviews added in 7 days |
| reviews_added_30d | integer | Reviews added in 30 days |
| last_delta_date | date | Most recent delta date |
| actual_sync_count | bigint | Non-interpolated sync count |
| velocity_tier | text | Tier: high, medium, low, dormant |

**Unique Index:** (appid)
**Row Count:** 5,605 apps
**Size:** 416 KB

---

### monthly_game_metrics

**Purpose:** Monthly aggregated metrics per game.

| Column | Type | Description |
|--------|------|-------------|
| appid | integer | App ID |
| month | date | First day of month |
| year | integer | Year |
| month_num | integer | Month number (1-12) |
| monthly_ccu_sum | bigint | Sum of daily CCU for month |
| estimated_monthly_hours | bigint | Estimated playtime hours |
| game_name | text | Game name |

**Unique Index:** (appid, month)
**Row Count:** 247,224 game-months
**Size:** 21 MB

---

## Key Relationships (Entity Relationship)

```
                          +---------------+
                          |     apps      |
                          |---------------|
                          | appid (PK)    |
                          +-------+-------+
                                  |
        +-------------------------+-------------------------+
        |             |           |           |             |
        v             v           v           v             v
+---------------+ +----------+ +----------+ +----------+ +----------+
| app_publishers| |app_devs  | |app_tags  | |app_genres| |app_cats  |
+---------------+ +----------+ +----------+ +----------+ +----------+
        |             |           |           |             |
        v             v           v           v             v
+---------------+ +----------+ +----------+ +----------+ +----------+
|  publishers   | |developers| |steam_tags| |steam_gens| |steam_cats|
+---------------+ +----------+ +----------+ +----------+ +----------+
        |             |
        v             v
+---------------+ +----------+
|publisher_metr | |dev_metr  |  <- Materialized views
+---------------+ +----------+

+---------------+     +---------------+     +---------------+
|  daily_metr   | --> | latest_daily  | --> | monthly_game  |
|               |     | _metrics (MV) |     | _metrics (MV) |
+---------------+     +---------------+     +---------------+

+---------------+     +---------------+
|  sync_status  | <-- |  sync_jobs    |
+---------------+     +---------------+

+---------------+     +---------------+     +---------------+
| user_profiles | <-- |credit_trans   | <-- |credit_reserv  |
+---------------+     +---------------+     +---------------+
        ^
        |
+---------------+
| chat_query_log|
+---------------+
```

---

## Database Functions

### Sync Functions
| Function | Purpose |
|----------|---------|
| `get_apps_for_sync(batch_size, source)` | Get apps needing sync by source |
| `get_apps_for_sync_partitioned(partition, total, batch)` | Partitioned sync for parallelism |
| `get_apps_for_embedding(batch, offset)` | Get apps needing embedding |
| `get_apps_for_reviews_sync(batch)` | Get apps for velocity-based review sync |
| `get_unsynced_app_ids()` | Get never-synced app IDs |
| `get_steamspy_individual_fetch_candidates(limit)` | Get apps for individual SteamSpy fetch |

### Upsert Functions
| Function | Purpose |
|----------|---------|
| `upsert_storefront_app(...)` | Insert/update app from Storefront API |
| `upsert_publisher(name)` | Get or create publisher |
| `upsert_developer(name)` | Get or create developer |
| `upsert_franchise(name)` | Get or create franchise |
| `upsert_steam_tag(id, name)` | Get or create Steam tag |
| `batch_update_prices(...)` | Bulk update app prices |

### Metrics Functions
| Function | Purpose |
|----------|---------|
| `refresh_all_metrics_views()` | Refresh all materialized views |
| `refresh_entity_metrics()` | Refresh publisher/developer metrics |
| `refresh_latest_daily_metrics()` | Refresh latest metrics view |
| `refresh_monthly_game_metrics()` | Refresh monthly metrics view |
| `refresh_review_velocity_stats()` | Refresh velocity stats |
| `refresh_materialized_view(name)` | Refresh specific view concurrently |
| `refresh_dashboard_stats()` | Refresh dashboard cache |

### Velocity Functions
| Function | Purpose |
|----------|---------|
| `update_review_velocity_tiers()` | Recalculate velocity tiers |
| `interpolate_review_deltas(appid)` | Fill gaps in review deltas |
| `interpolate_all_review_deltas()` | Interpolate all apps |

### CCU Functions
| Function | Purpose |
|----------|---------|
| `recalculate_ccu_tiers()` | Reassign CCU polling tiers |
| `aggregate_daily_ccu_peaks(date)` | Aggregate daily peaks |
| `cleanup_old_ccu_snapshots()` | Remove old snapshots |

### Credit Functions
| Function | Purpose |
|----------|---------|
| `reserve_credits(user_id, amount)` | Hold credits for request |
| `finalize_credits(reservation_id, actual)` | Complete credit transaction |
| `refund_reservation(reservation_id)` | Cancel reservation |
| `get_credit_balance(user_id)` | Get current balance |
| `admin_adjust_credits(user_id, amount, desc)` | Admin credit adjustment |

### Admin Functions
| Function | Purpose |
|----------|---------|
| `is_admin()` | Check if current user is admin |
| `get_publisher_stats()` | Get publisher statistics |
| `get_developer_stats()` | Get developer statistics |
| `get_pics_data_stats()` | Get PICS data statistics |
| `get_priority_distribution()` | Get priority score distribution |
| `get_queue_status()` | Get sync queue status |
| `get_source_completion_stats()` | Get sync completion by source |
| `cleanup_old_chat_logs()` | Remove logs older than 7 days |

---

## Row-Level Security (RLS)

### Public Read Access
The following tables have RLS enabled with public read access:
- apps, publishers, developers, franchises
- steam_tags, steam_genres, steam_categories
- app_publishers, app_developers, app_genres, app_categories, app_steam_tags, app_franchises
- app_steam_deck, app_tags, app_trends
- daily_metrics, review_histogram
- sync_jobs, pics_sync_state
- chat_query_logs

### User-Based Access
| Table | Policy |
|-------|--------|
| user_profiles | Users can read/update own profile; Admins can read all |
| credit_transactions | Users can read own; Admins can read all |
| credit_reservations | Users can read own; Admins can read all |
| waitlist | Public can insert; Own entries readable; Admins can manage |

---

## Migration History

The database has 65 migrations applied, starting from `20241227000000_initial_schema.sql` through `20260110000003_add_ccu_tiered_tracking.sql`.

Key migration milestones:
- **20241227000000**: Initial schema with core tables
- **20251228100000-2**: Publisher/Developer metrics views
- **20251230000000**: PICS data tables (tags, genres, categories)
- **20260101000000-2**: Embedding tracking, metrics views
- **20260102000001**: Chat query logs
- **20260108000000**: User system (profiles, credits, waitlist)
- **20260109100000-4**: Review velocity tracking
- **20260110000003**: CCU tiered tracking

---

## Notes

1. **Estimates vs Actual Data**: Fields like `estimated_weekly_hours` and `revenue_estimate_cents` are ESTIMATES based on CCU and price data. Steam does not provide actual values.

2. **Data Sources**:
   - Storefront API is AUTHORITATIVE for developer/publisher names
   - SteamSpy provides CCU, owners, and user-voted tags
   - PICS provides tags, genres, categories, Steam Deck compatibility

3. **Materialized View Refresh**: Use `REFRESH MATERIALIZED VIEW CONCURRENTLY` for zero-downtime refreshes. All views have unique indexes to support concurrent refresh.

4. **Foreign Key Considerations**: The `app_dlc` table intentionally lacks FK constraints to handle sync order issues where DLC may be processed before parent games.

5. **Deprecated Tables**: `app_tags` (SteamSpy user-voted tags) is deprecated in favor of `app_steam_tags` (PICS-sourced tags).
