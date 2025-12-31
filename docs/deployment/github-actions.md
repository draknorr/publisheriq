# GitHub Actions Configuration

PublisherIQ uses GitHub Actions for scheduled data sync jobs. This guide covers setup and configuration.

## Prerequisites

- Repository pushed to GitHub
- Supabase project credentials
- Steam API key

## Quick Start

### 1. Add Repository Secrets

Go to **Settings > Secrets and variables > Actions > New repository secret**:

| Secret | Value |
|--------|-------|
| `SUPABASE_URL` | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `eyJ...` |
| `STEAM_API_KEY` | Your Steam API key |

### 2. Enable Actions

1. Go to **Actions** tab
2. Click **I understand my workflows, go ahead and enable them**

### 3. Verify Workflows

Workflows should appear in the Actions tab. You can manually trigger any workflow to test.

## Workflow Schedule

All times are UTC:

| Workflow | File | Schedule | Purpose |
|----------|------|----------|---------|
| App List Sync | `applist-sync.yml` | 00:15 daily | Master app list |
| SteamSpy Sync | `steamspy-sync.yml` | 02:15 daily | CCU, owners, tags |
| Histogram Sync | `histogram-sync.yml` | 04:15 daily | Monthly reviews |
| Storefront Sync | `storefront-sync.yml` | 06,10,14,18,22:00 | Game metadata |
| Reviews Sync | `reviews-sync.yml` | 06:30,10:30,14:30,18:30,22:30 | Review counts |
| Page Creation Scrape | `page-creation-scrape.yml` | 03:00 daily | Page dates |
| Trends Calculation | `trends-calculation.yml` | 22:00 daily | Trend metrics |
| Priority Calculation | `priority-calculation.yml` | 22:30 daily | Priority scores |
| CI | `ci.yml` | On push/PR | Type checking |

## Workflow Structure

Each sync workflow follows this pattern:

```yaml
name: SteamSpy Sync

on:
  schedule:
    - cron: '15 2 * * *'  # 2:15 AM UTC daily
  workflow_dispatch:       # Manual trigger
    inputs:
      max_pages:
        description: 'Maximum pages to fetch (0 = all)'
        required: false
        default: '0'

env:
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 360

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
        run: pnpm --filter @publisheriq/ingestion steamspy-sync
        env:
          GITHUB_RUN_ID: ${{ github.run_id }}
```

## Manual Triggers

All workflows support manual triggering with optional inputs.

### From GitHub UI

1. Go to **Actions** tab
2. Select workflow (e.g., "SteamSpy Sync")
3. Click **Run workflow**
4. Optionally set input parameters
5. Click **Run workflow**

### From GitHub CLI

```bash
# Run with defaults
gh workflow run steamspy-sync.yml

# Run with inputs
gh workflow run steamspy-sync.yml -f max_pages=10
```

## Workflow Inputs

### SteamSpy Sync

| Input | Default | Description |
|-------|---------|-------------|
| `max_pages` | `0` | Pages to fetch (0 = all) |

### Storefront Sync

| Input | Default | Description |
|-------|---------|-------------|
| `batch_size` | `200` | Apps per batch |

### Reviews Sync

| Input | Default | Description |
|-------|---------|-------------|
| `batch_size` | `200` | Apps per batch |

## Monitoring

### View Run History

1. Go to **Actions** tab
2. Click on a workflow
3. View recent runs with status

### View Logs

1. Click on a workflow run
2. Click on the job name
3. Expand steps to see logs

### Job Status Indicators

| Status | Meaning |
|--------|---------|
| ✅ Success | Completed without errors |
| ❌ Failure | Encountered an error |
| 🟡 In progress | Currently running |
| ⏭️ Skipped | Workflow was skipped |
| ⚪ Queued | Waiting to run |

## Error Handling

### Automatic Retries

Workflows can be configured to retry on failure:

```yaml
jobs:
  sync:
    runs-on: ubuntu-latest
    # Retry up to 3 times
    strategy:
      max-parallel: 1
      fail-fast: false
```

### Common Failures

| Error | Cause | Solution |
|-------|-------|----------|
| `SUPABASE_URL not set` | Missing secret | Add repository secret |
| `Rate limited` | API quota exceeded | Wait and retry |
| `Timeout` | Sync taking too long | Increase timeout or reduce batch |

### Timeout Configuration

Workflows have a default 6-hour timeout:

```yaml
jobs:
  sync:
    timeout-minutes: 360
```

For longer syncs, increase the timeout (max 72 hours for private repos).

## Cost Considerations

GitHub Actions provides free minutes for public repos. For private repos:

| Plan | Minutes/month |
|------|---------------|
| Free | 2,000 |
| Team | 3,000 |
| Enterprise | 50,000 |

### Optimizing Usage

1. **Schedule efficiently**: Avoid overlapping sync times
2. **Use caching**: pnpm cache reduces install time
3. **Batch processing**: Larger batches = fewer runs

## Disabling Workflows

### Temporary Disable

1. Go to **Actions** tab
2. Click workflow name
3. Click **...** menu
4. Select **Disable workflow**

### Permanent Disable

Delete or rename the workflow file:

```bash
git rm .github/workflows/steamspy-sync.yml
git commit -m "Disable steamspy sync"
```

## Custom Schedules

Modify the cron expression in any workflow:

```yaml
on:
  schedule:
    # Every 6 hours
    - cron: '0 */6 * * *'

    # Every Monday at 9 AM UTC
    - cron: '0 9 * * 1'

    # First day of month
    - cron: '0 0 1 * *'
```

Use [crontab.guru](https://crontab.guru) to build expressions.

## Notifications

### Email Notifications

Configure in **Settings > Notifications**:
- Notify on workflow failures
- Notify on workflow success

### Slack Integration

Add Slack notification step:

```yaml
- name: Notify Slack
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

## Related Documentation

- [Environment Setup](../getting-started/environment-setup.md) - All variables
- [Sync Pipeline](../architecture/sync-pipeline.md) - Data flow
- [Running Workers](../guides/running-workers.md) - Manual execution
