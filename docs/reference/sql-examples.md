# SQL Query Examples

Common query patterns for the PublisherIQ database. These examples are optimized for the chat interface.

## Basic Queries

### Find a Game by Name

```sql
SELECT appid, name, type, release_date, is_free
FROM apps
WHERE name ILIKE '%Stardew Valley%'
  AND type = 'game';
```

### Count Games on Steam

```sql
SELECT COUNT(*) as game_count
FROM apps
WHERE type = 'game'
  AND is_released = TRUE
  AND is_delisted = FALSE;
```

### Games Released in a Year

```sql
SELECT appid, name, release_date
FROM apps
WHERE type = 'game'
  AND release_date >= '2024-01-01'
  AND release_date < '2025-01-01'
ORDER BY release_date DESC
LIMIT 50;
```

---

## Publisher & Developer Queries

### Games by Publisher

```sql
SELECT a.appid, a.name, a.release_date
FROM apps a
JOIN app_publishers ap ON a.appid = ap.appid
JOIN publishers p ON ap.publisher_id = p.id
WHERE p.name = 'Valve'
  AND a.type = 'game'
ORDER BY a.release_date DESC;
```

### Top Publishers by Game Count

```sql
SELECT p.name, p.game_count
FROM publishers p
ORDER BY p.game_count DESC
LIMIT 20;
```

### Find Publisher by Partial Name

```sql
SELECT id, name, game_count
FROM publishers
WHERE normalized_name ILIKE '%electronic%'
ORDER BY game_count DESC;
```

---

## Metrics Queries

### Top Games by Peak CCU

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

### Games with High Owner Counts

```sql
SELECT a.appid, a.name, dm.owners_min, dm.owners_max
FROM apps a
JOIN daily_metrics dm ON a.appid = dm.appid
WHERE a.type = 'game'
  AND dm.metric_date = (SELECT MAX(metric_date) FROM daily_metrics WHERE appid = a.appid)
  AND dm.owners_max >= 10000000
ORDER BY dm.owners_max DESC
LIMIT 20;
```

### Free Games with High Player Counts

```sql
SELECT a.appid, a.name, dm.ccu_peak, dm.total_reviews
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

## Review Queries

### Well-Reviewed Games

```sql
SELECT a.appid, a.name,
       dm.total_reviews,
       ROUND(dm.positive_reviews::numeric / NULLIF(dm.total_reviews, 0) * 100, 1) as positive_pct
FROM apps a
JOIN daily_metrics dm ON a.appid = dm.appid
WHERE a.type = 'game'
  AND dm.metric_date = (SELECT MAX(metric_date) FROM daily_metrics WHERE appid = a.appid)
  AND dm.total_reviews >= 1000
  AND (dm.positive_reviews::float / NULLIF(dm.total_reviews, 0)) >= 0.95
ORDER BY dm.total_reviews DESC
LIMIT 20;
```

### Games with Review Score 9 (Overwhelmingly Positive)

```sql
SELECT a.appid, a.name, dm.review_score_desc, dm.total_reviews
FROM apps a
JOIN daily_metrics dm ON a.appid = dm.appid
WHERE a.type = 'game'
  AND dm.review_score = 9
  AND dm.metric_date = (SELECT MAX(metric_date) FROM daily_metrics WHERE appid = a.appid)
ORDER BY dm.total_reviews DESC
LIMIT 20;
```

---

## Trend Queries

### Trending Up Games

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

### Games with Improving Reviews Over Time

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

### High Review Velocity Games

```sql
SELECT a.appid, a.name,
       at.review_velocity_7d,
       at.review_velocity_30d
FROM apps a
JOIN app_trends at ON a.appid = at.appid
WHERE a.type = 'game'
  AND at.review_velocity_7d > 100
ORDER BY at.review_velocity_7d DESC
LIMIT 20;
```

---

## Complex Queries

### Indie Games (Self-Published)

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
  AND d.name = p.name  -- Self-published
  AND dm.metric_date = (SELECT MAX(metric_date) FROM daily_metrics WHERE appid = a.appid)
  AND dm.total_reviews > 100
  AND (dm.positive_reviews::float / NULLIF(dm.total_reviews, 0)) >= 0.90
ORDER BY dm.total_reviews DESC
LIMIT 20;
```

### Publishers with Most Well-Reviewed Games

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

### Games with Workshop and Achievements

```sql
SELECT a.appid, a.name, a.has_workshop
FROM apps a
JOIN app_categories ac1 ON a.appid = ac1.appid AND ac1.category_id = 30  -- Workshop
JOIN app_categories ac2 ON a.appid = ac2.appid AND ac2.category_id = 22  -- Achievements
WHERE a.type = 'game'
  AND a.is_released = TRUE
ORDER BY a.name
LIMIT 50;
```

---

## Query Tips

### Always Filter to Latest Metrics

```sql
WHERE dm.metric_date = (
  SELECT MAX(metric_date)
  FROM daily_metrics
  WHERE appid = a.appid
)
```

### Filter to Games Only

```sql
WHERE a.type = 'game'
```

### Exclude Delisted/Unreleased

```sql
WHERE a.is_released = TRUE
  AND a.is_delisted = FALSE
```

### Avoid Division by Zero

```sql
NULLIF(dm.total_reviews, 0)
```

### Case-Insensitive Search

```sql
WHERE name ILIKE '%search term%'
```

### Tag Filtering

```sql
JOIN app_tags t ON a.appid = t.appid
WHERE t.tag = 'RPG'
```

---

## Domain Translations

| Natural Language | SQL Condition |
|------------------|---------------|
| "well reviewed" | `review_score >= 8` OR `positive_ratio >= 0.90` |
| "indie" | `d.name = p.name AND d.game_count < 5` |
| "major publisher" | `p.game_count >= 10` |
| "trending up" | `at.trend_30d_direction = 'up'` |
| "recently released" | `release_date >= CURRENT_DATE - INTERVAL '1 year'` |
| "popular" | `ccu_peak >= 10000` OR `owners_max >= 1000000` |
| "dead game" | `at.review_velocity_7d < 0.1` |
| "free" | `a.is_free = TRUE` |
| "on sale" | `a.current_discount_percent > 0` |
| "has workshop" | `a.has_workshop = TRUE` |

---

## Velocity Queries (v2.1+)

### Games by Velocity Tier

```sql
SELECT a.appid, a.name, rvs.velocity_7d, rvs.velocity_tier
FROM apps a
JOIN review_velocity_stats rvs ON a.appid = rvs.appid
WHERE rvs.velocity_tier = 'high'
ORDER BY rvs.velocity_7d DESC
LIMIT 20;
```

### Accelerating Games (7d > 30d velocity)

```sql
SELECT a.appid, a.name,
       rvs.velocity_7d,
       rvs.velocity_30d,
       (rvs.velocity_7d / NULLIF(rvs.velocity_30d, 0)) as velocity_ratio
FROM apps a
JOIN review_velocity_stats rvs ON a.appid = rvs.appid
WHERE rvs.velocity_7d > rvs.velocity_30d * 1.2
  AND rvs.velocity_30d > 0
ORDER BY velocity_ratio DESC
LIMIT 20;
```

### Review Deltas for a Game (Last 30 Days)

```sql
SELECT delta_date, total_reviews, reviews_added, daily_velocity, is_interpolated
FROM review_deltas
WHERE appid = 1245620  -- Elden Ring
  AND delta_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY delta_date DESC;
```

### Velocity Tier Distribution

```sql
SELECT velocity_tier,
       COUNT(*) as game_count,
       AVG(velocity_7d) as avg_velocity
FROM review_velocity_stats
GROUP BY velocity_tier
ORDER BY avg_velocity DESC;
```

---

## Credit Queries (v2.1+, Admin Only)

### User Credit Balances

```sql
SELECT email, role, credit_balance, total_credits_used, total_messages_sent
FROM user_profiles
ORDER BY credit_balance DESC;
```

### Recent Credit Transactions

```sql
SELECT u.email, ct.amount, ct.balance_after, ct.transaction_type, ct.created_at
FROM credit_transactions ct
JOIN user_profiles u ON ct.user_id = u.id
ORDER BY ct.created_at DESC
LIMIT 50;
```

### Pending Waitlist Applications

```sql
SELECT email, full_name, organization, status, created_at
FROM waitlist
WHERE status = 'pending'
ORDER BY created_at ASC;
```

## CCU Tier Queries (v2.2+)

### Games by CCU Tier

```sql
SELECT appid, ccu_tier, tier_reason, recent_peak_ccu
FROM ccu_tier_assignments
WHERE ccu_tier = 1
ORDER BY recent_peak_ccu DESC
LIMIT 20;
```

### Recent CCU Snapshots for a Game

```sql
SELECT snapshot_time, player_count, ccu_tier
FROM ccu_snapshots
WHERE appid = 730  -- Counter-Strike 2
ORDER BY snapshot_time DESC
LIMIT 24;  -- Last 24 snapshots
```

### Tier Distribution

```sql
SELECT ccu_tier,
       COUNT(*) as game_count,
       tier_reason
FROM ccu_tier_assignments
GROUP BY ccu_tier, tier_reason
ORDER BY ccu_tier, tier_reason;
```

### CCU Source Breakdown

```sql
SELECT ccu_source,
       COUNT(*) as records,
       AVG(ccu) as avg_ccu
FROM daily_metrics
WHERE metric_date = CURRENT_DATE
  AND ccu IS NOT NULL
GROUP BY ccu_source;
```

### Games with Highest CCU Today

```sql
SELECT a.appid, a.name, dm.ccu, dm.ccu_source
FROM apps a
JOIN daily_metrics dm ON a.appid = dm.appid
WHERE dm.metric_date = CURRENT_DATE
  AND dm.ccu IS NOT NULL
ORDER BY dm.ccu DESC
LIMIT 20;
```

### CCU Peak vs Current Comparison

```sql
SELECT cs.appid, a.name,
       cs.player_count as current_ccu,
       cta.recent_peak_ccu as peak_ccu,
       ROUND((cs.player_count::numeric / NULLIF(cta.recent_peak_ccu, 0)) * 100, 1) as pct_of_peak
FROM ccu_snapshots cs
JOIN apps a ON cs.appid = a.appid
JOIN ccu_tier_assignments cta ON cs.appid = cta.appid
WHERE cs.snapshot_time = (SELECT MAX(snapshot_time) FROM ccu_snapshots WHERE appid = cs.appid)
  AND cta.ccu_tier = 1
ORDER BY current_ccu DESC
LIMIT 20;
```

### Tier 2 Games (New Releases)

```sql
SELECT cta.appid, a.name, a.release_date, cta.release_rank
FROM ccu_tier_assignments cta
JOIN apps a ON cta.appid = a.appid
WHERE cta.ccu_tier = 2
  AND cta.tier_reason = 'new_release'
ORDER BY cta.release_rank
LIMIT 20;
```

### CCU History for a Game (Last 7 Days)

```sql
SELECT DATE(snapshot_time) as date,
       MIN(player_count) as min_ccu,
       MAX(player_count) as max_ccu,
       AVG(player_count)::integer as avg_ccu
FROM ccu_snapshots
WHERE appid = 730  -- Counter-Strike 2
  AND snapshot_time >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(snapshot_time)
ORDER BY date DESC;
```

---

## Related Documentation

- [Database Schema](../architecture/database-schema.md) - Full schema reference
- [Chat Interface](../guides/chat-interface.md) - Using natural language queries
