# Troubleshooting Guide

Common issues and solutions for PublisherIQ.

**Last Updated:** January 7, 2026

## Database Connection Issues

### "SUPABASE_URL is not defined"

**Cause:** Environment variable not set.

**Solution:**
```bash
# Check if set
echo $SUPABASE_URL

# Set in .env file
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

### "Invalid API key"

**Cause:** Using wrong key type or malformed key.

**Solution:**
1. Use the **service_role** key, not anon key
2. Copy the complete key (starts with `eyJ`)
3. No extra whitespace or quotes

### "Connection refused"

**Cause:** Supabase project paused or URL incorrect.

**Solution:**
1. Check project is not paused in Supabase dashboard
2. Verify URL format: `https://xxx.supabase.co` (no trailing slash)
3. Check network connectivity

---

## Sync Worker Issues

### High Failure Rate

**Symptoms:** 30-50% of apps failing in storefront sync.

**Cause:** Many apps return `success: false` from Steam API.

**Explanation:** This is normal behavior. Apps return no data when:
- Age-gated (18+)
- Private or removed
- Region-locked
- Test apps

**Solution:** After first sync, the `storefront_accessible` flag prevents re-querying these apps. Future syncs should show near 0% skip rate.

### "Rate limited"

**Cause:** Too many API requests.

**Solution:**
1. Workers have built-in rate limiting - wait and retry
2. Reduce batch size if needed:
   ```bash
   BATCH_SIZE=100 pnpm --filter ingestion storefront-sync
   ```
3. Check if multiple syncs running simultaneously

### Worker Timeouts

**Cause:** Operation taking longer than timeout.

**Solution:**
1. For GitHub Actions, increase timeout:
   ```yaml
   jobs:
     sync:
       timeout-minutes: 360  # 6 hours
   ```
2. Reduce batch size
3. Check for network issues

### "Consecutive errors" High

**Query to find problematic apps:**
```sql
SELECT appid, name, consecutive_errors, last_error_message
FROM sync_status s
JOIN apps a ON s.appid = a.appid
WHERE consecutive_errors > 3
ORDER BY consecutive_errors DESC
LIMIT 20;
```

**Solution:**
1. Review error messages
2. Reset error count for specific apps:
   ```sql
   UPDATE sync_status
   SET consecutive_errors = 0
   WHERE appid = 12345;
   ```

---

## Cube.js / Analytics Issues

### 502 Gateway Errors

**Cause:** Cube.js machine cold start or query timeout.

**Solution:**
1. The dashboard has built-in retry logic (3 retries with exponential backoff)
2. Ensure `min_machines_running = 1` in Fly.io config
3. Increase machine memory if queries are complex
4. Check Fly.io logs: `fly logs --app publisheriq-cube`

### "Query failed" in Chat

**Cause:** Cube.js schema mismatch or invalid filter.

**Solution:**
1. Expand Query Details panel to see the actual query
2. Check filter operators are valid (use `gte` not `>=`)
3. Verify cube names match schema (e.g., `Discovery`, not `discovery`)
4. Check Cube.js logs for detailed error

### Stale Data in Queries

**Cause:** Materialized views not refreshed.

**Solution:**
```sql
-- Refresh materialized views
REFRESH MATERIALIZED VIEW CONCURRENTLY publisher_metrics;
REFRESH MATERIALIZED VIEW CONCURRENTLY developer_metrics;
REFRESH MATERIALIZED VIEW CONCURRENTLY latest_daily_metrics;
```

---

## Chat Interface Issues

### "Chat not responding"

**Cause:** LLM API issues.

**Solution:**
1. Verify `LLM_PROVIDER` is set (`anthropic` or `openai`)
2. Check API key is valid
3. Check browser console for errors
4. Verify API has credit/quota

### "Query failed"

**Cause:** SQL validation blocked the query.

**Explanation:** The chat interface blocks certain operations for security:
- Only SELECT queries allowed
- Maximum 50 rows returned
- Maximum 5000 character query
- Blocked: INSERT, UPDATE, DELETE, DROP, etc.

**Solution:** Rephrase your question to use read-only operations.

### "No results found"

**Cause:** Query returned empty results.

**Solution:**
1. Check if data exists for the query
2. Try broader search terms (ILIKE instead of exact match)
3. Verify table has data:
   ```sql
   SELECT COUNT(*) FROM apps;
   ```

---

## Build Issues

### "Module not found"

**Cause:** Packages not built or dependencies missing.

**Solution:**
```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Or build specific package
pnpm --filter database build
```

### Type Errors

**Cause:** Database types out of sync.

**Solution:**
```bash
# Regenerate types from Supabase
pnpm --filter database generate

# Rebuild
pnpm build
```

### "Cannot find module @publisheriq/..."

**Cause:** Workspace packages not linked.

**Solution:**
```bash
# Clean install
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
pnpm build
```

---

## Qdrant / Similarity Search Issues

### "No similar games found"

**Cause:** Embeddings not synced or Qdrant connection issue.

**Solution:**
1. Check if embeddings have been generated:
   ```sql
   SELECT COUNT(*) FROM sync_status WHERE last_embedding_sync IS NOT NULL;
   ```
2. Verify Qdrant credentials in environment
3. Run embedding sync manually:
   ```bash
   pnpm --filter ingestion run sync:embeddings
   ```

### Similarity Search Slow

**Cause:** Large Qdrant collection or complex filters.

**Solution:**
1. Ensure Qdrant collection has proper indexes
2. Reduce the `limit` parameter in queries
3. Use more specific filters to narrow search space

### "Embedding sync failed"

**Cause:** OpenAI API rate limit or Qdrant write error.

**Solution:**
1. Check OpenAI API quota
2. Verify Qdrant cluster is online
3. Check batch size in embedding worker
4. Review logs for specific error

---

## PICS Service Issues

### Service Keeps Restarting

**Cause:** Connection or configuration errors.

**Solution:**
1. Check Railway logs for error messages
2. Verify Supabase credentials
3. Ensure PICS tables exist in database

### "Steam connection failed"

**Cause:** Steam PICS rate limiting or network issues.

**Solution:**
- The service auto-reconnects
- Wait a few minutes
- Check Steam status at steamstat.us

### Missing PICS Data

**Cause:** Bulk sync not completed.

**Solution:**
1. Run bulk sync first:
   ```
   MODE=bulk_sync python -m src.main
   ```
2. Wait for completion (~3 minutes)
3. Switch to change monitor:
   ```
   MODE=change_monitor python -m src.main
   ```

---

## GitHub Actions Issues

### Workflow Not Running

**Cause:** Actions disabled or secrets missing.

**Solution:**
1. Go to Actions tab, enable workflows
2. Check secrets are set (Settings > Secrets)
3. Verify cron syntax is correct

### "Secret not found"

**Cause:** Missing repository secret.

**Solution:**
1. Go to Settings > Secrets and variables > Actions
2. Add required secrets:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `STEAM_API_KEY`

### Job Cancelled

**Cause:** Exceeded timeout or resource limits.

**Solution:**
1. Increase timeout in workflow file
2. Reduce batch size
3. Check for infinite loops in code

---

## Age-Gated Content

### Missing Developer/Publisher Data

**Cause:** Steam's Storefront API returns no data for age-gated (18+) content.

**Impact:** ~40-50 adult-rated games permanently missing developer/publisher info.

**Why It Happens:**
- Steam requires cookies/authentication to view mature content
- The API returns `success: false` without auth
- There is no public API to fetch this data

**Current Behavior:**
- Apps marked as `storefront_accessible = false`
- Excluded from future storefront sync
- Developer/publisher fields remain null

**Alternative Data Sources:**
- PICS service can provide: release date, name, categories, genres
- PICS cannot provide: developer names, publisher names
- SteamSpy has incomplete developer/publisher data

**Future Solutions (if needed):**
1. PICS fallback (provides 80% of missing data)
2. Cookie bypass (risky, may violate ToS)
3. HTML scraping (very risky)

---

## Performance Issues

### Slow Queries

**Solution:**
1. Check for missing indexes
2. Use EXPLAIN ANALYZE:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM apps WHERE name ILIKE '%test%';
   ```
3. Add index if needed

### High Memory Usage

**Solution:**
1. Reduce batch sizes
2. Process in smaller chunks
3. Check for memory leaks in workers

### Dashboard Slow

**Solution:**
1. Check browser network tab for slow requests
2. Enable Supabase connection pooling
3. Add pagination to large queries

---

## Getting Help

If these solutions don't resolve your issue:

1. Check GitHub Issues for similar problems
2. Review logs for specific error messages
3. Open a new issue with:
   - Error message
   - Steps to reproduce
   - Environment details (OS, Node version)
   - Relevant log output

## Related Documentation

- [Running Workers](running-workers.md) - Manual sync execution
- [GitHub Actions](../deployment/github-actions.md) - Workflow configuration
- [Database Schema](../architecture/database-schema.md) - Table structure
