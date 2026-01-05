# New Metrics Reference

This document describes the new analytics metrics introduced in PublisherIQ v2.0.

## Estimated Weekly Played Hours

### Overview

`estimatedWeeklyHours` provides an estimate of total player engagement hours per week for games, publishers, and developers.

> **Important:** This is an ESTIMATE. Steam does not provide actual "total played hours" data. Always label this metric as "Estimated Played Hours" in UI and reports.

### Formula

```
estimatedWeeklyHours = SUM(7-day CCU) × (avg_playtime_2weeks / 2 / 60)
```

Where:
- **7-day CCU**: Sum of peak concurrent users over the past 7 days
- **avg_playtime_2weeks**: Average playtime in the last 2 weeks (in minutes)
- **/ 2**: Accounts for playtime being a 2-week average
- **/ 60**: Converts minutes to hours

### Example Calculation

For a game with:
- 7-day CCU sum: 50,000
- avg_playtime_2weeks: 120 minutes

```
estimatedWeeklyHours = 50,000 × (120 / 2 / 60)
                     = 50,000 × 1
                     = 50,000 hours
```

### Availability

| Level | Cube/View | Field Name |
|-------|-----------|------------|
| Game | `Discovery` | `estimatedWeeklyHours` |
| Publisher | `PublisherMetrics` | `estimatedWeeklyHours` |
| Developer | `DeveloperMetrics` | `estimatedWeeklyHours` |

---

## Monthly Estimated Played Hours

### Overview

Monthly metrics provide time-series data for estimated played hours, enabling trend analysis and time-filtered queries.

### Cubes

#### MonthlyGameMetrics

```js
cube('MonthlyGameMetrics', {
  sql: `SELECT * FROM monthly_game_metrics`,

  dimensions: {
    appid: { type: 'number', primaryKey: true },
    gameName: { type: 'string' },
    month: { type: 'time', primaryKey: true },
    year: { type: 'number' },
    monthNum: { type: 'number' },
    monthlyCcuSum: { type: 'number' },
    estimatedMonthlyHours: { type: 'number' },
  },

  measures: {
    count: { type: 'count' },
    sumEstimatedHours: { sql: 'estimated_monthly_hours', type: 'sum' },
    sumMonthlyCcu: { sql: 'monthly_ccu_sum', type: 'sum' },
    gameCount: { type: 'countDistinct', sql: 'appid' },
  },
});
```

#### MonthlyPublisherMetrics

```js
cube('MonthlyPublisherMetrics', {
  sql: `SELECT * FROM monthly_publisher_metrics`,

  dimensions: {
    publisherId: { type: 'number', primaryKey: true },
    publisherName: { type: 'string' },
    month: { type: 'time', primaryKey: true },
    year: { type: 'number' },
    monthNum: { type: 'number' },
    gameCount: { type: 'number' },
    estimatedMonthlyHours: { type: 'number' },
  },
});
```

### Pre-defined Segments

Both monthly cubes include these time-based segments:

| Segment | SQL Filter |
|---------|------------|
| `currentMonth` | `month = DATE_TRUNC('month', CURRENT_DATE)` |
| `lastMonth` | `month = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')` |
| `last3Months` | `month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')` |
| `last6Months` | `month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months')` |
| `last12Months` | `month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')` |
| `year2025` | `year = 2025` |
| `year2024` | `year = 2024` |

---

## Database Views

### publisher_metrics (Materialized View)

Contains aggregated metrics for each publisher including the new `estimated_weekly_hours` column.

```sql
SELECT
  publisher_id,
  publisher_name,
  game_count,
  total_owners,
  total_ccu,
  estimated_weekly_hours,  -- NEW
  total_reviews,
  positive_reviews,
  avg_review_score,
  revenue_estimate_cents,
  is_trending,
  games_trending_up,
  unique_developers,
  computed_at
FROM publisher_metrics;
```

**Refresh command:**
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY publisher_metrics;
```

### developer_metrics (Materialized View)

Contains aggregated metrics for each developer including the new `estimated_weekly_hours` column.

```sql
SELECT
  developer_id,
  developer_name,
  game_count,
  total_owners,
  total_ccu,
  estimated_weekly_hours,  -- NEW
  total_reviews,
  positive_reviews,
  avg_review_score,
  revenue_estimate_cents,
  is_trending,
  games_trending_up,
  computed_at
FROM developer_metrics;
```

**Refresh command:**
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY developer_metrics;
```

### monthly_game_metrics (View)

Time-series metrics for games by month.

```sql
SELECT
  appid,
  game_name,
  month,
  year,
  month_num,
  monthly_ccu_sum,
  estimated_monthly_hours
FROM monthly_game_metrics;
```

### monthly_publisher_metrics (View)

Time-series metrics for publishers by month.

```sql
SELECT
  publisher_id,
  publisher_name,
  month,
  year,
  month_num,
  game_count,
  estimated_monthly_hours
FROM monthly_publisher_metrics;
```

---

## Chat/LLM Integration

### System Prompt Guidance

The LLM system prompt includes specific guidance for played hours queries:

1. **Use estimatedWeeklyHours** for "played hours" or "engagement" queries
2. **Label the column** as "Estimated Played Hours" (never just "Played Hours")
3. **Include disclaimer footnote** in responses:
   > *Estimated based on CCU × average playtime. Steam does not provide actual total played hours.*

### Example Chat Query

**User:** "Show me publishers with the most played hours last month"

**Expected Response:**

| Publisher | Estimated Played Hours* |
|-----------|------------------------|
| Valve | 15,234,567 |
| Electronic Arts | 8,456,789 |
| ... | ... |

*Estimated based on CCU × average playtime. Steam does not provide actual total played hours.*

---

## Query Examples

### Cube.js Query - Top Publishers by Estimated Hours

```js
{
  "measures": ["PublisherMetrics.count"],
  "dimensions": [
    "PublisherMetrics.publisherName",
    "PublisherMetrics.estimatedWeeklyHours"
  ],
  "order": {
    "PublisherMetrics.estimatedWeeklyHours": "desc"
  },
  "limit": 10
}
```

### SQL Query - Monthly Trends

```sql
SELECT
  publisher_name,
  month,
  estimated_monthly_hours
FROM monthly_publisher_metrics
WHERE year = 2025
ORDER BY publisher_name, month;
```

### SQL Query - Publisher Weekly Hours

```sql
SELECT
  publisher_name,
  estimated_weekly_hours,
  total_ccu,
  game_count
FROM publisher_metrics
ORDER BY estimated_weekly_hours DESC
LIMIT 20;
```

---

## Index Reference

The following indexes exist for performance optimization:

| View | Index |
|------|-------|
| `publisher_metrics` | `idx_publisher_metrics_weekly_hours` |
| `developer_metrics` | `idx_developer_metrics_weekly_hours` |

---

## Limitations & Caveats

1. **Estimation Only**: Steam does not provide actual total played hours. This metric is a mathematical estimate.

2. **CCU-Based**: The calculation relies on peak CCU, which may not represent actual concurrent players throughout the day.

3. **Playtime Average**: Uses the 2-week average playtime, which may not reflect current player behavior.

4. **New Games**: Games with less than 7 days of data will have incomplete CCU sums.

5. **Refresh Lag**: Materialized views must be refreshed to show current data:
   ```sql
   REFRESH MATERIALIZED VIEW CONCURRENTLY publisher_metrics;
   REFRESH MATERIALIZED VIEW CONCURRENTLY developer_metrics;
   ```

---

## Related Documentation

- [v2.0 Release Notes](../releases/v2.0-new-design.md) - Complete changelog
- [Database Schema](../architecture/database-schema.md) - Full schema reference
- [Chat Interface Guide](../guides/chat-interface.md) - Using the chat system
