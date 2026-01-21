# Adding a New Worker

This guide covers how to create a new data sync worker for PublisherIQ.

## Overview

Workers are TypeScript modules that:
1. Fetch data from external sources
2. Transform and validate the data
3. Store results in Supabase
4. Track job progress

## File Structure

```
packages/ingestion/
├── src/
│   ├── apis/
│   │   └── new-source.ts      # API client
│   ├── workers/
│   │   └── new-worker.ts      # Worker logic
│   └── index.ts               # Export entry
├── package.json               # Add scripts
└── ...

.github/workflows/
└── new-sync.yml               # GitHub Action
```

## Step 1: Create API Client

Create `packages/ingestion/src/apis/new-source.ts`:

```typescript
import { RateLimiter } from '../utils/rate-limiter.js';
import { withRetry } from '../utils/retry.js';
import { logger } from '@publisheriq/shared';

const log = logger.child({ module: 'new-source' });

// Rate limiter: 10 requests per 30 seconds
const rateLimiter = new RateLimiter({
  tokensPerInterval: 10,
  interval: 30_000,
  maxTokens: 10
});

export interface NewSourceData {
  appid: number;
  // ... fields
}

export async function fetchNewSourceData(appid: number): Promise<NewSourceData | null> {
  await rateLimiter.acquire();

  return withRetry(async () => {
    const url = `https://api.example.com/app/${appid}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        return null; // App not found
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      appid: data.id,
      // ... transform fields
    };
  }, {
    maxRetries: 3,
    onRetry: (error, attempt) => {
      log.warn({ error, attempt }, 'Retrying request');
    }
  });
}
```

## Step 2: Create Worker

Create `packages/ingestion/src/workers/new-worker.ts`:

```typescript
import { createServiceClient } from '@publisheriq/database';
import { logger } from '@publisheriq/shared';
import { fetchNewSourceData } from '../apis/new-source.js';

const log = logger.child({ module: 'new-worker' });

interface JobStats {
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  itemsSkipped: number;
}

async function createSyncJob(supabase: any, jobType: string) {
  const { data, error } = await supabase
    .from('sync_jobs')
    .insert({
      job_type: jobType,
      status: 'running',
      github_run_id: process.env.GITHUB_RUN_ID
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function completeSyncJob(supabase: any, jobId: string, stats: JobStats, error?: string) {
  await supabase
    .from('sync_jobs')
    .update({
      status: error ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
      items_processed: stats.itemsProcessed,
      items_succeeded: stats.itemsSucceeded,
      items_failed: stats.itemsFailed,
      error_message: error
    })
    .eq('id', jobId);
}

async function getAppsForSync(supabase: any, limit: number) {
  const { data, error } = await supabase.rpc('get_apps_for_sync', {
    p_source: 'new_source',
    p_limit: limit
  });

  if (error) throw error;
  return data || [];
}

export async function runNewWorker() {
  const supabase = createServiceClient();
  const batchSize = parseInt(process.env.BATCH_SIZE || '200');

  log.info({ batchSize }, 'Starting new worker');

  const job = await createSyncJob(supabase, 'new_source');
  const stats: JobStats = {
    itemsProcessed: 0,
    itemsSucceeded: 0,
    itemsFailed: 0,
    itemsSkipped: 0
  };

  try {
    const apps = await getAppsForSync(supabase, batchSize);
    log.info({ count: apps.length }, 'Apps to process');

    for (const app of apps) {
      stats.itemsProcessed++;

      try {
        const data = await fetchNewSourceData(app.appid);

        if (!data) {
          stats.itemsSkipped++;
          continue;
        }

        // Upsert to database
        const { error } = await supabase
          .from('your_table')
          .upsert({
            appid: data.appid,
            // ... fields
            updated_at: new Date().toISOString()
          });

        if (error) throw error;

        // Update sync status
        await supabase
          .from('sync_status')
          .update({ last_new_source_sync: new Date().toISOString() })
          .eq('appid', app.appid);

        stats.itemsSucceeded++;
      } catch (error) {
        stats.itemsFailed++;
        log.error({ error, appid: app.appid }, 'Failed to process app');

        // Track error
        await supabase
          .from('sync_status')
          .update({
            consecutive_errors: app.consecutive_errors + 1,
            last_error_message: String(error),
            last_error_at: new Date().toISOString()
          })
          .eq('appid', app.appid);
      }

      // Progress logging
      if (stats.itemsProcessed % 100 === 0) {
        log.info(stats, 'Progress');
      }
    }

    await completeSyncJob(supabase, job.id, stats);
    log.info(stats, 'Worker complete');
  } catch (error) {
    await completeSyncJob(supabase, job.id, stats, String(error));
    throw error;
  }
}

// Entry point
runNewWorker().catch((error) => {
  log.error({ error }, 'Worker failed');
  process.exit(1);
});
```

## Step 3: Add Package Script

Update `packages/ingestion/package.json`:

```json
{
  "scripts": {
    "new-sync": "tsx src/workers/new-worker.ts"
  }
}
```

## Step 4: Export from Index

Update `packages/ingestion/src/index.ts`:

```typescript
export * from './apis/new-source.js';
```

## Step 5: Create GitHub Action

Create `.github/workflows/new-sync.yml`:

```yaml
name: New Source Sync

on:
  schedule:
    - cron: '0 3 * * *'  # 3 AM UTC daily
  workflow_dispatch:
    inputs:
      batch_size:
        description: 'Batch size'
        required: false
        default: '200'

env:
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 120

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm build

      - name: Run sync
        run: pnpm --filter @publisheriq/ingestion new-sync
        env:
          GITHUB_RUN_ID: ${{ github.run_id }}
          BATCH_SIZE: ${{ github.event.inputs.batch_size || '200' }}
```

## Step 6: Update Database (if needed)

If your worker needs new columns or tables:

1. Create migration:
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_new_source.sql
ALTER TABLE sync_status ADD COLUMN last_new_source_sync TIMESTAMPTZ;
```

2. Update `get_apps_for_sync` function if using priority scheduling

## Best Practices

### Rate Limiting

Always use the rate limiter:
```typescript
const rateLimiter = new RateLimiter({
  tokensPerInterval: 10,
  interval: 30_000
});
await rateLimiter.acquire();
```

### Error Handling

1. Track consecutive errors per app
2. Skip apps with too many failures
3. Log all errors with context

### Progress Logging

Log progress every N items:
```typescript
if (stats.itemsProcessed % 100 === 0) {
  log.info(stats, 'Progress');
}
```

### Job Tracking

Always use sync_jobs for tracking:
- Create job at start
- Update stats during run
- Complete job at end (success or failure)

### Graceful Shutdown

Handle SIGTERM for GitHub Actions:
```typescript
process.on('SIGTERM', () => {
  log.info('Received SIGTERM, finishing current item');
  // Complete current item, then exit
});
```

## Testing

### Local Testing

```bash
# Build packages
pnpm build

# Test with small batch
BATCH_SIZE=10 pnpm --filter @publisheriq/ingestion new-sync
```

### Dry Run Mode

Add a dry run flag for testing:
```typescript
const dryRun = process.env.DRY_RUN === 'true';
if (!dryRun) {
  await supabase.from('table').upsert(data);
}
```

## Related Documentation

- [Sync Pipeline](../architecture/sync-pipeline.md) - Architecture overview
- [Running Workers](running-workers.md) - Manual execution
- [GitHub Actions](../deployment/github-actions.md) - Scheduling
