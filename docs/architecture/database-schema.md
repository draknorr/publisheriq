# PublisherIQ Database Schema

> This document is optimized for LLM text-to-SQL generation. Use exact column names, types, and SQL patterns shown below.

**Database**: PostgreSQL (Supabase)

---

## Enum Types

```sql
-- App content type
CREATE TYPE app_type AS ENUM ('game', 'dlc', 'demo', 'mod', 'video', 'hardware', 'music');

-- Data sync source
CREATE TYPE sync_source AS ENUM ('steamspy', 'storefront', 'reviews', 'histogram', 'scraper');

-- Review sentiment trend
CREATE TYPE trend_direction AS ENUM ('up', 'down', 'stable');

-- Sync frequency tier
CREATE TYPE refresh_tier AS ENUM ('active', 'moderate', 'dormant', 'dead');
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
| created_at | TIMESTAMPTZ | NO | NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | NO | NOW() | Last update time |

**Indexes**: `idx_publishers_normalized` on `normalized_name`

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
| created_at | TIMESTAMPTZ | NO | NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | NO | NOW() | Last update time |

**Indexes**: `idx_developers_normalized` on `normalized_name`

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
| created_at | TIMESTAMPTZ | NO | NOW() | Record creation time |
| updated_at | TIMESTAMPTZ | NO | NOW() | Last update time |

**Indexes**:
- `idx_apps_name` on `name`
- `idx_apps_type` on `type` WHERE `type = 'game'`
- `idx_apps_released` on `(is_released, is_delisted)`

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
| batch_size | INTEGER | YES | NULL | Batch size used |
| error_message | TEXT | YES | NULL | Error details if failed |
| github_run_id | TEXT | YES | NULL | GitHub Actions run ID |
| created_at | TIMESTAMPTZ | NO | NOW() | Record creation time |

---

## Relationships

```
publishers 1──M app_publishers M──1 apps 1──M app_developers M──1 developers
                                    │
                                    ├──1 daily_metrics (M)
                                    ├──1 review_histogram (M)
                                    ├──1 app_trends (1)
                                    ├──1 sync_status (1)
                                    └──1 app_tags (M)
```

**Key joins**:
- `apps` to `developers`: `apps JOIN app_developers ON apps.appid = app_developers.appid JOIN developers ON app_developers.developer_id = developers.id`
- `apps` to `publishers`: `apps JOIN app_publishers ON apps.appid = app_publishers.appid JOIN publishers ON app_publishers.publisher_id = publishers.id`
- `apps` to metrics: `apps JOIN daily_metrics ON apps.appid = daily_metrics.appid`

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

6. **Tag filtering**: Join through `app_tags`:
   ```sql
   JOIN app_tags t ON a.appid = t.appid WHERE t.tag = 'RPG'
   ```
