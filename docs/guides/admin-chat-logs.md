# Admin: Chat Query Logs

This guide covers the chat query logs dashboard, which provides analytics and debugging for the PublisherIQ chat interface.

---

## Accessing the Dashboard

Navigate to `/admin/chat-logs` in the admin interface.

**Requirements**: Admin access to the PublisherIQ dashboard.

---

## Overview

The chat logs dashboard displays all chat queries from the past 7 days, including:
- Query text
- Tools used
- Performance timing
- Iteration counts

Data older than 7 days is automatically cleaned up.

---

## Dashboard Features

### Search

Use the search box to filter queries by text content. This helps find specific user queries or patterns.

**Examples**:
- Search "Valve" to find queries about Valve games
- Search "trending" to see how users ask about trends
- Search "error" to find failed queries

### Log Entries

Each log entry shows:

| Field | Description |
|-------|-------------|
| **Query** | The user's original question |
| **Tools** | Which tools were called (e.g., `query_analytics`, `find_similar`) |
| **Tool Count** | Total number of tool calls made |
| **Iterations** | How many LLM loops occurred |
| **Timing** | Performance breakdown |
| **Timestamp** | When the query was made |

---

## Understanding Timing Metrics

### Metric Breakdown

| Metric | What it Measures |
|--------|------------------|
| **LLM Time** | Time spent waiting for Claude/LLM responses |
| **Tools Time** | Time spent executing tools (Cube.js queries, similarity search, etc.) |
| **Total Time** | End-to-end request time |

### Normal Ranges

| Metric | Typical | Slow | Very Slow |
|--------|---------|------|-----------|
| LLM Time | 500-2000ms | 2000-5000ms | > 5000ms |
| Tools Time | 100-500ms | 500-1500ms | > 2000ms |
| Total Time | 1000-3000ms | 3000-6000ms | > 8000ms |

### Common Causes of Slow Queries

**Slow LLM Time**:
- Complex queries requiring more reasoning
- LLM service under load
- Long tool results being processed

**Slow Tools Time**:
- Cube.js cold starts
- Complex database aggregations
- Large similarity search result sets
- Multiple tool calls in sequence

---

## Interpreting Tool Usage

### Common Tool Patterns

| Pattern | Meaning |
|---------|---------|
| `lookup_publishers` → `query_analytics` | User asked about a specific publisher |
| `query_analytics` only | Direct analytics query |
| `find_similar` | Similarity search request |
| `search_games` | Tag/genre-based game search |
| Multiple `query_analytics` | Complex query requiring multiple data points |

### Tool Call Limits

The system limits to **5 tool iterations** per request. If a query uses 4-5 iterations, it may indicate:
- An overly complex query
- LLM struggling to find the right data
- Potential for query optimization

---

## Iteration Counts

### What Iterations Mean

Each iteration is one LLM → Tool → LLM cycle:

1. **1 iteration**: LLM called one tool and answered (ideal)
2. **2 iterations**: LLM needed follow-up data (common)
3. **3+ iterations**: LLM working through complex query
4. **5 iterations**: Hit max limit, may have truncated response

### Healthy Distribution

A healthy system should show:
- 60%+ queries with 1-2 iterations
- 20-30% queries with 3 iterations
- < 10% queries with 4-5 iterations

If you see many 4-5 iteration queries, consider:
- Improving system prompt clarity
- Adding more specific tool capabilities
- Identifying common query patterns that struggle

---

## Data Retention

### 7-Day Policy

Logs are automatically deleted after 7 days to:
- Minimize storage costs
- Comply with data minimization practices
- Keep the dashboard performant

### Cleanup Process

**GitHub Actions cron**: Runs daily at 3 AM UTC

**PostgreSQL function**:
```sql
SELECT cleanup_old_chat_logs();
-- Returns number of deleted rows
```

### Manual Cleanup

If needed, run cleanup manually via Supabase SQL Editor:
```sql
SELECT cleanup_old_chat_logs();
```

---

## Troubleshooting with Logs

### Finding Problem Queries

1. **Search for "error"** - Find queries that returned errors
2. **Sort by iteration count** - High iterations suggest struggling queries
3. **Check tools time** - Identify slow tool executions
4. **Look for missing tools** - If expected tool wasn't called, prompt may need adjustment

### Common Issues

| Symptom | Possible Cause | Solution |
|---------|---------------|----------|
| No tools called | Query not matched by LLM | Review system prompt patterns |
| High LLM time | Complex reasoning or LLM overload | Simplify query patterns |
| High tool time | Database performance | Check Cube.js pre-aggregations |
| 5 iterations | Query too complex | Consider query decomposition |

---

## Related Documentation

- [Chat Data System Architecture](../architecture/chat-data-system.md) - Complete system reference
- [Chat Interface Guide](chat-interface.md) - User-facing chat documentation
- [Database Schema](../architecture/database-schema.md) - `chat_query_logs` table definition
