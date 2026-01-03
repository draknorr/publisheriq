# PublisherIQ Database Schema

> This document is optimized for LLM text-to-SQL generation. Use exact column names, types, and SQL patterns shown below.

**Database**: PostgreSQL (Supabase)

**Semantic Layer**: Cube.js provides type-safe queries over these tables. See [Chat Data System](chat-data-system.md) for Cube schema documentation.

---

## Enum Types

```sql
-- App content type
CREATE TYPE app_type AS ENUM ('game', 'dlc', 'demo', 'mod', 'video', 'hardware', 'music');

-- Data sync source
CREATE TYPE sync_source AS ENUM ('steamspy', 'storefront', 'reviews', 'histogram', 'scraper', 'pics');

-- Review sentiment trend
CREATE TYPE trend_direction AS ENUM ('up', 'down', 'stable');

-- Sync frequency tier
CREATE TYPE refresh_tier AS ENUM ('active', 'moderate', 'dormant', 'dead');

-- Steam Deck compatibility category
CREATE TYPE steam_deck_category AS ENUM ('unknown', 'unsupported', 'playable', 'verified');
```

---

## Tables

### publishers

Steam game publishers.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | auto | Primary key |
| name | TEXT | NO | - | Publisher name (unique) |
| normalized_name | TEXT | NO | - | Lowercase, trimmed name for lookups |
| steam_vanity_url | TEXT | YES | NULL | Steam store vanity URL slug |
| first_game_release_date | DATE | YES | NULL | Earliest game release date |
| first_page_creation_date | DATE | YES | NULL | Earliest Steam page creation date |
| game_count | INTEGER | NO | 0 | Number of games published |
| last_embedding_sync | TIMESTAMPTZ | YES | NULL | Last embedding sync to Qdrant |
| embedding_hash | TEXT | YES | NULL | Hash of embedding text for change detection |
| created_at | TIMESTAMPTZ | NO | NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | NO | NOW() | Last update time |

**Indexes**:
- `idx_publishers_normalized` on `normalized_name`
- `idx_publishers_embedding_needed` on `(game_count DESC, last_embedding_sync)` WHERE `game_count > 0`

---

### developers

Steam game developers.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | auto | Primary key |
| name | TEXT | NO | - | Developer name (unique) |
| normalized_name | TEXT | NO | - | Lowercase, trimmed name for lookups |
| steam_vanity_url | TEXT | YES | NULL | Steam store vanity URL slug |
| first_game_release_date | DATE | YES | NULL | Earliest game release date |
| first_page_creation_date | DATE | YES | NULL | Earliest Steam page creation date |
| game_count | INTEGER | NO | 0 | Number of games developed |
| last_embedding_sync | TIMESTAMPTZ | YES | NULL | Last embedding sync to Qdrant |
| embedding_hash | TEXT | YES | NULL | Hash of embedding text for change detection |
| created_at | TIMESTAMPTZ | NO | NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | NO | NOW() | Last update time |

**Indexes**:
- `idx_developers_normalized` on `normalized_name`
- `idx_developers_embedding_needed` on `(game_count DESC, last_embedding_sync)` WHERE `game_count > 0`

---

### apps

Steam apps (games, DLC, demos, etc).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| appid | INTEGER | NO | - | Primary key (Steam app ID) |
| name | TEXT | NO | - | App display name |
| type | app_type | NO | 'game' | Content type |
| is_free | BOOLEAN | NO | FALSE | Whether app is free |
| release_date | DATE | YES | NULL | Parsed release date |
| release_date_raw | TEXT | YES | NULL | Raw release date string from Steam |
| page_creation_date | DATE | YES | NULL | Steam store page creation date |
| page_creation_date_raw | TEXT | YES | NULL | Raw page creation date string |
| has_workshop | BOOLEAN | NO | FALSE | Has Steam Workshop support |
| current_price_cents | INTEGER | YES | NULL | Current price in cents (USD) |
| current_discount_percent | INTEGER | NO | 0 | Active discount percentage |
| is_released | BOOLEAN | NO | TRUE | Whether app is released |
| is_delisted | BOOLEAN | NO | FALSE | Whether app is removed from store |
| has_developer_info | BOOLEAN | NO | FALSE | Developer/publisher data fetched |
| controller_support | TEXT | YES | NULL | Controller support: "full", "partial", or NULL |
| pics_review_score | SMALLINT | YES | NULL | Steam review score (1-9) from PICS |
| pics_review_percentage | SMALLINT | YES | NULL | Positive review percentage (0-100) from PICS |
| metacritic_score | SMALLINT | YES | NULL | Metacritic score |
| platforms | TEXT | YES | NULL | Supported platforms: "windows,macos,linux" |
| release_state | TEXT | YES | NULL | PICS release state: released, prerelease, etc. |
| parent_appid | INTEGER | YES | NULL | Parent app ID for DLC, demos, mods |
| homepage_url | TEXT | YES | NULL | Publisher/developer homepage |
| languages | JSONB | YES | NULL | Supported languages |
| content_descriptors | JSONB | YES | NULL | Mature content descriptors |
| created_at | TIMESTAMPTZ | NO | NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | NO | NOW() | Last update time |

**Indexes**:
- `idx_apps_name` on `name`
- `idx_apps_type` on `type` WHERE `type = 'game'`
- `idx_apps_released` on `(is_released, is_delisted)`
- `idx_apps_parent_appid` on `parent_appid` WHERE `parent_appid IS NOT NULL`
- `idx_apps_platforms` on `platforms` WHERE `platforms IS NOT NULL`

---

### app_developers

Junction table linking apps to developers (many-to-many).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| appid | INTEGER | NO | FK to apps.appid |
| developer_id | INTEGER | NO | FK to developers.id |

**Primary Key**: `(appid, developer_id)`

---

### app_publishers

Junction table linking apps to publishers (many-to-many).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| appid | INTEGER | NO | FK to apps.appid |
| publisher_id | INTEGER | NO | FK to publishers.id |

**Primary Key**: `(appid, publisher_id)`

---

### app_tags

User-voted tags from SteamSpy.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| appid | INTEGER | NO | - | FK to apps.appid |
| tag | TEXT | NO | - | Tag name (e.g., "RPG", "Multiplayer") |
| vote_count | INTEGER | NO | 0 | Number of user votes for this tag |

**Primary Key**: `(appid, tag)`
**Indexes**: `idx_app_tags_tag` on `tag`

---

### steam_tags

Official Steam tag definitions from PICS (different from user-voted SteamSpy tags).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| tag_id | INTEGER | NO | - | Primary key (Steam tag ID) |
| name | TEXT | NO | - | Tag name |
| created_at | TIMESTAMPTZ | NO | NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | NO | NOW() | Last update time |

**Indexes**: `idx_steam_tags_name` on `name`

---

### steam_genres

Official Steam genre definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| genre_id | INTEGER | NO | - | Primary key (Steam genre ID) |
| name | TEXT | NO | - | Genre name (e.g., "Action", "RPG") |
| created_at | TIMESTAMPTZ | NO | NOW() | Record creation time |

---

### steam_categories

Steam feature categories (achievements, multiplayer, etc.).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| category_id | INTEGER | NO | - | Primary key (Steam category ID) |
| name | TEXT | NO | - | Category name (e.g., "Steam Achievements") |
| description | TEXT | YES | NULL | Category description |
| created_at | TIMESTAMPTZ | NO | NOW() | Record creation time |

---

### franchises

Game franchises/series from PICS.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | SERIAL | NO | auto | Primary key |
| name | TEXT | NO | - | Franchise name (unique) |
| normalized_name | TEXT | NO | - | Lowercase, trimmed name for lookups |
| created_at | TIMESTAMPTZ | NO | NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | NO | NOW() | Last update time |

**Indexes**: `idx_franchises_normalized` on `normalized_name`

---

### app_steam_tags

Junction table linking apps to Steam tags (from PICS).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| appid | INTEGER | NO | FK to apps.appid |
| tag_id | INTEGER | NO | FK to steam_tags.tag_id |
| rank | INTEGER | YES | Tag rank/priority (lower = more relevant) |
| created_at | TIMESTAMPTZ | NO | When relationship was created |

**Primary Key**: `(appid, tag_id)`
**Indexes**:
- `idx_app_steam_tags_tag_id` on `tag_id`
- `idx_app_steam_tags_created_at` on `created_at`

---

### app_genres

Junction table linking apps to genres.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| appid | INTEGER | NO | FK to apps.appid |
| genre_id | INTEGER | NO | FK to steam_genres.genre_id |
| is_primary | BOOLEAN | NO | Whether this is the primary genre |
| created_at | TIMESTAMPTZ | NO | When relationship was created |

**Primary Key**: `(appid, genre_id)`
**Indexes**:
- `idx_app_genres_genre_id` on `genre_id`
- `idx_app_genres_primary` on `appid` WHERE `is_primary = TRUE`
- `idx_app_genres_created_at` on `created_at`

---

### app_categories

Junction table linking apps to feature categories.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| appid | INTEGER | NO | FK to apps.appid |
| category_id | INTEGER | NO | FK to steam_categories.category_id |
| created_at | TIMESTAMPTZ | NO | When relationship was created |

**Primary Key**: `(appid, category_id)`
**Indexes**:
- `idx_app_categories_category_id` on `category_id`
- `idx_app_categories_created_at` on `created_at`

---

### app_franchises

Junction table linking apps to franchises.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| appid | INTEGER | NO | FK to apps.appid |
| franchise_id | INTEGER | NO | FK to franchises.id |
| created_at | TIMESTAMPTZ | NO | When relationship was created |

**Primary Key**: `(appid, franchise_id)`
**Indexes**:
- `idx_app_franchises_franchise` on `franchise_id`
- `idx_app_franchises_created_at` on `created_at`

---

### app_steam_deck

Steam Deck compatibility data.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| appid | INTEGER | NO | - | Primary key, FK to apps.appid |
| category | steam_deck_category | NO | 'unknown' | Compatibility category |
| test_timestamp | TIMESTAMPTZ | YES | NULL | When compatibility was tested |
| tested_build_id | TEXT | YES | NULL | Build ID that was tested |
| tests | JSONB | YES | NULL | Detailed test results |
| updated_at | TIMESTAMPTZ | NO | NOW() | Last update time |

**Indexes**: `idx_app_steam_deck_category` on `category`

---

### daily_metrics

Daily snapshots of app metrics.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | BIGSERIAL | NO | auto | Primary key |
| appid | INTEGER | NO | - | FK to apps.appid |
| metric_date | DATE | NO | - | Date of snapshot |
| owners_min | INTEGER | YES | NULL | Estimated owner count (lower bound) |
| owners_max | INTEGER | YES | NULL | Estimated owner count (upper bound) |
| ccu_peak | INTEGER | YES | NULL | Peak concurrent users |
| average_playtime_forever | INTEGER | YES | NULL | Avg playtime in minutes (all-time) |
| average_playtime_2weeks | INTEGER | YES | NULL | Avg playtime in minutes (last 2 weeks) |
| total_reviews | INTEGER | YES | NULL | Total review count |
| positive_reviews | INTEGER | YES | NULL | Positive review count |
| negative_reviews | INTEGER | YES | NULL | Negative review count |
| review_score | SMALLINT | YES | NULL | Steam review score (1-9) |
| review_score_desc | TEXT | YES | NULL | Review score description |
| recent_total_reviews | INTEGER | YES | NULL | Recent review count |
| recent_positive | INTEGER | YES | NULL | Recent positive reviews |
| recent_negative | INTEGER | YES | NULL | Recent negative reviews |
| recent_score_desc | TEXT | YES | NULL | Recent review score description |
| price_cents | INTEGER | YES | NULL | Price in cents at snapshot time |
| discount_percent | SMALLINT | NO | 0 | Discount at snapshot time |

**Unique**: `(appid, metric_date)`
**Indexes**:
- `idx_daily_metrics_appid_date` on `(appid, metric_date DESC)`
- `idx_daily_metrics_date` on `metric_date`

---

### review_histogram

Monthly review aggregates from Steam.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | BIGSERIAL | NO | auto | Primary key |
| appid | INTEGER | NO | - | FK to apps.appid |
| month_start | DATE | NO | - | First day of the month |
| recommendations_up | INTEGER | NO | - | Positive reviews in month |
| recommendations_down | INTEGER | NO | - | Negative reviews in month |
| fetched_at | TIMESTAMPTZ | NO | NOW() | When data was fetched |

**Unique**: `(appid, month_start)`
**Indexes**: `idx_review_histogram_appid_month` on `(appid, month_start DESC)`

---

### app_trends

Computed trend data from review histograms.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| appid | INTEGER | NO | - | Primary key, FK to apps.appid |
| trend_30d_direction | trend_direction | YES | NULL | 30-day trend: 'up', 'down', or 'stable' |
| trend_30d_change_pct | DECIMAL(6,2) | YES | NULL | 30-day positive ratio change % |
| trend_90d_direction | trend_direction | YES | NULL | 90-day trend: 'up', 'down', or 'stable' |
| trend_90d_change_pct | DECIMAL(6,2) | YES | NULL | 90-day positive ratio change % |
| current_positive_ratio | DECIMAL(5,4) | YES | NULL | Current positive/total ratio (0-1) |
| previous_positive_ratio | DECIMAL(5,4) | YES | NULL | Previous period positive ratio |
| review_velocity_7d | DECIMAL(10,2) | YES | NULL | Reviews per day (7-day avg) |
| review_velocity_30d | DECIMAL(10,2) | YES | NULL | Reviews per day (30-day avg) |
| ccu_trend_7d_pct | DECIMAL(6,2) | YES | NULL | CCU change % over 7 days |
| updated_at | TIMESTAMPTZ | NO | NOW() | Last calculation time |

**Indexes**: `idx_app_trends_30d` on `(trend_30d_direction, trend_30d_change_pct DESC)` WHERE `trend_30d_direction = 'up'`

---

### sync_status

Per-app sync tracking and scheduling.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| appid | INTEGER | NO | - | Primary key, FK to apps.appid |
| last_steamspy_sync | TIMESTAMPTZ | YES | NULL | Last SteamSpy sync time |
| last_storefront_sync | TIMESTAMPTZ | YES | NULL | Last Storefront sync time |
| last_reviews_sync | TIMESTAMPTZ | YES | NULL | Last Reviews sync time |
| last_histogram_sync | TIMESTAMPTZ | YES | NULL | Last Histogram sync time |
| last_page_creation_scrape | TIMESTAMPTZ | YES | NULL | Last page scrape time |
| last_pics_sync | TIMESTAMPTZ | YES | NULL | Last PICS data sync time |
| pics_change_number | BIGINT | YES | NULL | Last processed PICS change number |
| last_embedding_sync | TIMESTAMPTZ | YES | NULL | Last embedding sync to Qdrant |
| embedding_hash | TEXT | YES | NULL | Hash of embedding text for change detection |
| priority_score | INTEGER | NO | 0 | Sync priority (higher = more frequent) |
| priority_calculated_at | TIMESTAMPTZ | YES | NULL | When priority was calculated |
| next_sync_after | TIMESTAMPTZ | NO | NOW() | When app is due for sync |
| sync_interval_hours | INTEGER | NO | 24 | Hours between syncs |
| consecutive_errors | INTEGER | NO | 0 | Error count for circuit breaker |
| last_error_source | sync_source | YES | NULL | Which source had last error |
| last_error_message | TEXT | YES | NULL | Last error details |
| last_error_at | TIMESTAMPTZ | YES | NULL | When last error occurred |
| needs_page_creation_scrape | BOOLEAN | NO | TRUE | Needs page creation scraping |
| is_syncable | BOOLEAN | NO | TRUE | Whether to sync this app |
| refresh_tier | refresh_tier | YES | 'moderate' | Sync frequency tier |
| last_activity_at | TIMESTAMPTZ | YES | NULL | Last detected activity |

**Indexes**:
- `idx_sync_status_embedding_needed` on `(priority_score DESC, last_embedding_sync)` WHERE `is_syncable = TRUE`
- `idx_sync_status_pics` on `last_pics_sync` WHERE `is_syncable = TRUE`

---

### sync_jobs

Job execution history.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| job_type | TEXT | NO | - | Job name (e.g., 'steamspy', 'reviews') |
| started_at | TIMESTAMPTZ | NO | NOW() | Job start time |
| completed_at | TIMESTAMPTZ | YES | NULL | Job completion time |
| status | TEXT | NO | 'running' | 'running', 'completed', 'failed' |
| items_processed | INTEGER | NO | 0 | Total items attempted |
| items_succeeded | INTEGER | NO | 0 | Successfully processed |
| items_failed | INTEGER | NO | 0 | Failed items |
| items_created | INTEGER | NO | 0 | New records created |
| items_updated | INTEGER | NO | 0 | Existing records updated |
| batch_size | INTEGER | YES | NULL | Batch size used |
| error_message | TEXT | YES | NULL | Error details if failed |
| github_run_id | TEXT | YES | NULL | GitHub Actions run ID |
| created_at | TIMESTAMPTZ | NO | NOW() | Record creation time |

---

### chat_query_logs

Chat query analytics and debugging logs. **7-day retention** with automatic cleanup.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Primary key |
| query_text | TEXT | NO | - | User's chat query |
| tool_names | TEXT[] | NO | '{}' | Array of tools used |
| tool_count | INTEGER | NO | 0 | Number of tools called |
| iteration_count | INTEGER | NO | 1 | LLM iteration count |
| response_length | INTEGER | NO | 0 | Response character count |
| timing_llm_ms | INTEGER | YES | NULL | LLM processing time (ms) |
| timing_tools_ms | INTEGER | YES | NULL | Tool execution time (ms) |
| timing_total_ms | INTEGER | YES | NULL | Total request time (ms) |
| created_at | TIMESTAMPTZ | NO | NOW() | Query timestamp |

**Indexes**:
- `idx_chat_query_logs_created_at` on `created_at DESC`
- `idx_chat_query_logs_tool_names` GIN index on `tool_names`

**Cleanup Function**:
```sql
cleanup_old_chat_logs() -- Deletes logs older than 7 days
```

**Used by**: Admin chat logs dashboard at `/admin/chat-logs`

---

## Relationships

```
publishers 1──M app_publishers M──1 apps 1──M app_developers M──1 developers
                                    │
                                    ├──M daily_metrics
                                    ├──M review_histogram
                                    ├──1 app_trends
                                    ├──1 sync_status
                                    ├──M app_tags (SteamSpy)
                                    ├──M app_steam_tags ──M steam_tags (PICS)
                                    ├──M app_genres ──M steam_genres
                                    ├──M app_categories ──M steam_categories
                                    ├──M app_franchises ──M franchises
                                    └──1 app_steam_deck
```

**Key joins**:
- `apps` to `developers`: `apps JOIN app_developers ON apps.appid = app_developers.appid JOIN developers ON app_developers.developer_id = developers.id`
- `apps` to `publishers`: `apps JOIN app_publishers ON apps.appid = app_publishers.appid JOIN publishers ON app_publishers.publisher_id = publishers.id`
- `apps` to metrics: `apps JOIN daily_metrics ON apps.appid = daily_metrics.appid`
- `apps` to genres: `apps JOIN app_genres ON apps.appid = app_genres.appid JOIN steam_genres ON app_genres.genre_id = steam_genres.genre_id`
- `apps` to Steam tags: `apps JOIN app_steam_tags ON apps.appid = app_steam_tags.appid JOIN steam_tags ON app_steam_tags.tag_id = steam_tags.tag_id`
- `apps` to Steam Deck: `apps LEFT JOIN app_steam_deck ON apps.appid = app_steam_deck.appid`

---

## Domain Definitions

Use these SQL translations for natural language concepts:

| Natural Language | SQL Condition |
|-----------------|---------------|
| "well reviewed" | `(dm.positive_reviews::float / NULLIF(dm.total_reviews, 0)) >= 0.90` OR `dm.review_score >= 8` |
| "independent developer" / "indie" | Developer where `developer_id = publisher_id AND d.game_count < 5` (see example query below) |
| "major publisher" | `p.game_count >= 10` |
| "prolific developer" | `d.game_count >= 5` |
| "trending up" | `at.trend_30d_direction = 'up'` |
| "trending down" | `at.trend_30d_direction = 'down'` |
| "stable reviews" | `at.trend_30d_direction = 'stable'` |
| "recently released" | `a.release_date >= CURRENT_DATE - INTERVAL '1 year'` |
| "recently active" (publisher/developer) | `first_game_release_date >= CURRENT_DATE - INTERVAL '1 year'` |
| "dead game" | `at.review_velocity_7d < 0.1` |
| "popular" | `dm.ccu_peak >= 10000` OR `dm.owners_max >= 1000000` |
| "free game" | `a.is_free = TRUE` |
| "has discount" / "on sale" | `a.current_discount_percent > 0` |
| "has workshop" | `a.has_workshop = TRUE` |
| "delisted" | `a.is_delisted = TRUE` |
| "unreleased" / "upcoming" | `a.is_released = FALSE` |
| "Steam Deck verified" | `asd.category = 'verified'` |
| "Steam Deck playable" | `asd.category IN ('verified', 'playable')` |
| "Steam Deck compatible" | `asd.category IN ('verified', 'playable')` |
| "Steam Deck unsupported" | `asd.category = 'unsupported'` |
| "has controller support" | `a.controller_support IS NOT NULL` |
| "full controller support" | `a.controller_support = 'full'` |
| "partial controller support" | `a.controller_support = 'partial'` |
| "supports Windows" | `a.platforms LIKE '%windows%'` |
| "supports Mac" / "macOS" | `a.platforms LIKE '%macos%'` |
| "supports Linux" | `a.platforms LIKE '%linux%'` |
| "in genre X" | `EXISTS (SELECT 1 FROM app_genres ag JOIN steam_genres sg ON ag.genre_id = sg.genre_id WHERE ag.appid = a.appid AND sg.name = 'X')` |
| "has tag X" | `EXISTS (SELECT 1 FROM app_steam_tags ast JOIN steam_tags st ON ast.tag_id = st.tag_id WHERE ast.appid = a.appid AND st.name = 'X')` |
| "has feature X" | `EXISTS (SELECT 1 FROM app_categories ac JOIN steam_categories sc ON ac.category_id = sc.category_id WHERE ac.appid = a.appid AND sc.name = 'X')` |

---

## Review Score Reference

| Score | Description | Positive % Range |
|-------|-------------|------------------|
| 9 | Overwhelmingly Positive | 95%+ |
| 8 | Very Positive | 80-94% |
| 7 | Positive | 70-79% |
| 6 | Mostly Positive | 40-69% (more positive) |
| 5 | Mixed | 40-69% |
| 4 | Mostly Negative | 20-39% |
| 3 | Negative | 10-19% |
| 2 | Very Negative | 0-9% |
| 1 | Overwhelmingly Negative | 0-9% (many reviews) |

---

## Example Queries

### 1. Simple lookup
**Q**: "Find the game Stardew Valley"
```sql
SELECT appid, name, type, release_date, is_free
FROM apps
WHERE name ILIKE '%Stardew Valley%'
  AND type = 'game';
```

### 2. Count aggregation
**Q**: "How many games are on Steam?"
```sql
SELECT COUNT(*) as game_count
FROM apps
WHERE type = 'game'
  AND is_released = TRUE
  AND is_delisted = FALSE;
```

### 3. Join with filter
**Q**: "Show me all games by Valve"
```sql
SELECT a.appid, a.name, a.release_date
FROM apps a
JOIN app_publishers ap ON a.appid = ap.appid
JOIN publishers p ON ap.publisher_id = p.id
WHERE p.name = 'Valve'
  AND a.type = 'game'
ORDER BY a.release_date DESC;
```

### 4. Date filtering
**Q**: "Games released in 2024"
```sql
SELECT appid, name, release_date
FROM apps
WHERE type = 'game'
  AND release_date >= '2024-01-01'
  AND release_date < '2025-01-01'
ORDER BY release_date DESC;
```

### 5. Domain concept - well-reviewed indie games
**Q**: "Find well-reviewed indie games"
```sql
SELECT DISTINCT a.appid, a.name,
       ROUND(dm.positive_reviews::numeric / NULLIF(dm.total_reviews, 0) * 100, 1) as positive_pct
FROM apps a
JOIN app_developers ad ON a.appid = ad.appid
JOIN developers d ON ad.developer_id = d.id
JOIN app_publishers ap ON a.appid = ap.appid
JOIN publishers p ON ap.publisher_id = p.id
JOIN daily_metrics dm ON a.appid = dm.appid
WHERE a.type = 'game'
  AND d.game_count < 5
  AND d.name = p.name  -- Self-published (developer is publisher)
  AND dm.metric_date = (SELECT MAX(metric_date) FROM daily_metrics WHERE appid = a.appid)
  AND dm.total_reviews > 100
  AND (dm.positive_reviews::float / NULLIF(dm.total_reviews, 0)) >= 0.90
ORDER BY dm.total_reviews DESC
LIMIT 20;
```

### 6. Trend query
**Q**: "Which games are trending up?"
```sql
SELECT a.appid, a.name,
       at.trend_30d_change_pct,
       at.review_velocity_30d
FROM apps a
JOIN app_trends at ON a.appid = at.appid
WHERE a.type = 'game'
  AND at.trend_30d_direction = 'up'
ORDER BY at.trend_30d_change_pct DESC
LIMIT 20;
```

### 7. Complex aggregation
**Q**: "Publishers with the most well-reviewed games"
```sql
SELECT p.id, p.name, p.game_count,
       COUNT(DISTINCT a.appid) as positive_game_count
FROM publishers p
JOIN app_publishers ap ON p.id = ap.publisher_id
JOIN apps a ON ap.appid = a.appid
JOIN daily_metrics dm ON a.appid = dm.appid
WHERE a.type = 'game'
  AND dm.metric_date = (SELECT MAX(metric_date) FROM daily_metrics WHERE appid = a.appid)
  AND dm.total_reviews >= 100
  AND (dm.positive_reviews::float / NULLIF(dm.total_reviews, 0)) >= 0.90
GROUP BY p.id, p.name, p.game_count
HAVING COUNT(DISTINCT a.appid) >= 3
ORDER BY positive_game_count DESC
LIMIT 20;
```

### 8. Metrics query
**Q**: "Top 10 games by peak concurrent users"
```sql
SELECT a.appid, a.name, dm.ccu_peak, dm.metric_date
FROM apps a
JOIN daily_metrics dm ON a.appid = dm.appid
WHERE a.type = 'game'
  AND dm.ccu_peak IS NOT NULL
  AND dm.metric_date = (SELECT MAX(metric_date) FROM daily_metrics WHERE appid = a.appid)
ORDER BY dm.ccu_peak DESC
LIMIT 10;
```

### 9. Time-series analysis
**Q**: "Games with improving reviews over time"
```sql
SELECT a.appid, a.name,
       at.previous_positive_ratio,
       at.current_positive_ratio,
       at.trend_90d_change_pct
FROM apps a
JOIN app_trends at ON a.appid = at.appid
WHERE a.type = 'game'
  AND at.trend_90d_direction = 'up'
  AND at.current_positive_ratio > at.previous_positive_ratio
  AND at.trend_90d_change_pct > 5
ORDER BY at.trend_90d_change_pct DESC
LIMIT 20;
```

### 10. Multi-condition query
**Q**: "Free games with high player counts"
```sql
SELECT a.appid, a.name,
       dm.ccu_peak,
       dm.owners_min, dm.owners_max,
       dm.total_reviews
FROM apps a
JOIN daily_metrics dm ON a.appid = dm.appid
WHERE a.type = 'game'
  AND a.is_free = TRUE
  AND a.is_released = TRUE
  AND a.is_delisted = FALSE
  AND dm.metric_date = (SELECT MAX(metric_date) FROM daily_metrics WHERE appid = a.appid)
  AND dm.ccu_peak >= 1000
ORDER BY dm.ccu_peak DESC
LIMIT 20;
```

### 11. Steam Deck verified games
**Q**: "Show me Steam Deck verified games with good reviews"
```sql
SELECT a.appid, a.name, a.pics_review_percentage,
       asd.category as steam_deck_status
FROM apps a
JOIN app_steam_deck asd ON a.appid = asd.appid
WHERE a.type = 'game'
  AND a.is_released = TRUE
  AND asd.category = 'verified'
  AND a.pics_review_percentage >= 80
ORDER BY a.pics_review_percentage DESC
LIMIT 20;
```

### 12. Games by genre
**Q**: "Find Action RPG games"
```sql
SELECT a.appid, a.name, a.release_date
FROM apps a
WHERE a.type = 'game'
  AND a.is_released = TRUE
  AND EXISTS (
    SELECT 1 FROM app_genres ag
    JOIN steam_genres sg ON ag.genre_id = sg.genre_id
    WHERE ag.appid = a.appid AND sg.name = 'Action'
  )
  AND EXISTS (
    SELECT 1 FROM app_genres ag
    JOIN steam_genres sg ON ag.genre_id = sg.genre_id
    WHERE ag.appid = a.appid AND sg.name = 'RPG'
  )
ORDER BY a.release_date DESC
LIMIT 20;
```

### 13. Games with specific tag
**Q**: "Find roguelike games"
```sql
SELECT a.appid, a.name, ast.rank as tag_rank
FROM apps a
JOIN app_steam_tags ast ON a.appid = ast.appid
JOIN steam_tags st ON ast.tag_id = st.tag_id
WHERE a.type = 'game'
  AND a.is_released = TRUE
  AND st.name ILIKE '%roguelike%'
ORDER BY ast.rank ASC
LIMIT 20;
```

### 14. Games with controller support
**Q**: "Games with full controller support on Steam Deck"
```sql
SELECT a.appid, a.name, a.controller_support,
       asd.category as steam_deck_status
FROM apps a
JOIN app_steam_deck asd ON a.appid = asd.appid
WHERE a.type = 'game'
  AND a.controller_support = 'full'
  AND asd.category IN ('verified', 'playable')
ORDER BY a.name
LIMIT 20;
```

### 15. Games by platform
**Q**: "Linux-native games"
```sql
SELECT a.appid, a.name, a.platforms
FROM apps a
WHERE a.type = 'game'
  AND a.is_released = TRUE
  AND a.platforms LIKE '%linux%'
ORDER BY a.release_date DESC
LIMIT 20;
```

---

## Materialized Views

These pre-computed views power the Cube.js semantic layer for fast analytics.

### latest_daily_metrics

Most recent metrics snapshot for each game.

```sql
-- Pre-computed latest metrics per app
SELECT DISTINCT ON (appid)
  appid, metric_date, owners_min, owners_max,
  ccu_peak, total_reviews, positive_reviews, review_score, price_cents
FROM daily_metrics
ORDER BY appid, metric_date DESC;
```

**Refreshed**: Every 6 hours via `REFRESH MATERIALIZED VIEW CONCURRENTLY`

**Used by**: Discovery cube, LatestMetrics cube

---

### publisher_metrics

ALL-TIME aggregated publisher statistics.

| Column | Description |
|--------|-------------|
| `publisher_id` | Publisher ID (primary key) |
| `publisher_name` | Publisher name |
| `game_count` | Number of games published |
| `total_owners` | Sum of estimated owners |
| `total_ccu` | Sum of peak CCU |
| `avg_review_score` | Average review score |
| `total_reviews` | Total reviews across all games |
| `positive_reviews` | Total positive reviews |
| `revenue_estimate_cents` | Estimated revenue (owners × price) |
| `is_trending` | Has at least one trending game |
| `unique_developers` | Number of unique developers |

**Used by**: PublisherMetrics cube

---

### developer_metrics

ALL-TIME aggregated developer statistics. Same structure as publisher_metrics with `developer_id` instead of `publisher_id`.

**Used by**: DeveloperMetrics cube

---

### publisher_year_metrics / developer_year_metrics

Per-year aggregations for year-filtered queries.

Additional columns:
- `release_year` - Year games were released

**Used by**: PublisherYearMetrics, DeveloperYearMetrics cubes

---

### publisher_game_metrics / developer_game_metrics

Per-game data joined with publisher/developer info for rolling period queries.

| Column | Description |
|--------|-------------|
| `publisher_id` / `developer_id` | Entity ID |
| `publisher_name` / `developer_name` | Entity name |
| `appid` | Game ID |
| `game_name` | Game name |
| `release_date` | Release date (for period filtering) |
| `release_year` | Release year |
| `owners` | Owner estimate midpoint |
| `ccu` | Peak CCU |
| `total_reviews` | Review count |
| `review_score` | Review score |
| `revenue_estimate_cents` | Revenue estimate |

**Used by**: PublisherGameMetrics, DeveloperGameMetrics cubes (for "games in past 12 months" queries)

**Indexes**:
- Unique index on `(publisher_id, appid)` for concurrent refresh
- Index on `release_date` for date-range filtering

---

## Query Tips

1. **Latest metrics**: Always filter `daily_metrics` to most recent date per app:
   ```sql
   WHERE dm.metric_date = (SELECT MAX(metric_date) FROM daily_metrics WHERE appid = a.appid)
   ```

2. **Games only**: Filter `type = 'game'` to exclude DLC, demos, etc.

3. **Active games**: Add `is_released = TRUE AND is_delisted = FALSE`

4. **Avoid division by zero**: Use `NULLIF(total_reviews, 0)` when calculating ratios

5. **Case-insensitive search**: Use `ILIKE` for name searches

6. **SteamSpy tag filtering**: Join through `app_tags` (user-voted):
   ```sql
   JOIN app_tags t ON a.appid = t.appid WHERE t.tag = 'RPG'
   ```

7. **PICS tag filtering**: Join through `app_steam_tags` (official Steam tags):
   ```sql
   JOIN app_steam_tags ast ON a.appid = ast.appid
   JOIN steam_tags st ON ast.tag_id = st.tag_id
   WHERE st.name = 'Roguelike'
   ```

8. **Genre filtering**: Join through `app_genres`:
   ```sql
   JOIN app_genres ag ON a.appid = ag.appid
   JOIN steam_genres sg ON ag.genre_id = sg.genre_id
   WHERE sg.name = 'Action'
   ```

9. **Steam Deck compatibility**: Join through `app_steam_deck`:
   ```sql
   LEFT JOIN app_steam_deck asd ON a.appid = asd.appid
   WHERE asd.category IN ('verified', 'playable')
   ```

10. **Platform filtering**: Use LIKE on the platforms column:
    ```sql
    WHERE a.platforms LIKE '%linux%'
    ```
