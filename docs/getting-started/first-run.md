# First Run

This guide walks you through verifying your setup and running your first data sync.

## Prerequisites

Before continuing, ensure you've completed:
- [Installation](installation.md)
- [Environment Setup](environment-setup.md)
- Database migrations applied in Supabase

## 1. Verify Build

```bash
# Build all packages
pnpm build

# Check for type errors
pnpm check-types
```

Both commands should complete without errors.

## 2. Start the Dashboard

```bash
pnpm --filter admin dev
```

Open [http://localhost:3000](http://localhost:3000). You should see the admin dashboard with empty data tables.

## 3. Run Initial Sync

The data pipeline runs in phases. Start with the app list:

### Step 1: Sync App List

Fetches all Steam app IDs (~200k apps):

```bash
pnpm --filter ingestion run sync:applist
```

This populates the `apps` table with basic app information.

### Step 2: Sync SteamSpy Data

Fetches developer, publisher, and ownership data:

```bash
pnpm --filter ingestion run sync:steamspy
```

This populates:
- `publishers` table
- `developers` table
- `app_publishers` junction table
- `app_developers` junction table
- `daily_metrics` with owner estimates

**Note:** SteamSpy has a 1 request/second rate limit. A full sync takes several hours.

### Step 3: Sync Storefront Data

Fetches game metadata from Steam's store API:

```bash
pnpm --filter ingestion run sync:storefront
```

This adds to `apps`:
- Release dates
- Pricing
- Free/paid status
- Workshop support

### Step 4: Sync Reviews

Fetches review scores and counts:

```bash
pnpm --filter ingestion run sync:reviews
```

This updates `daily_metrics` with:
- Total reviews
- Positive/negative counts
- Review score

### Step 5: Calculate Trends

Computes trend data from review history:

```bash
pnpm --filter ingestion run calculate:trends
```

This populates `app_trends` with:
- 30/90 day trend direction
- Review velocity
- Positive ratio changes

## 4. Verify Data

### Check the Dashboard

Refresh [http://localhost:3000](http://localhost:3000). You should see:
- Apps listed with names and types
- Publishers and developers with game counts
- Metrics showing for synced games

### Check via Chat

Try the chat interface:

1. Click the chat button in the dashboard
2. Ask: "How many games are in the database?"
3. Ask: "Show me the top 10 publishers by game count"

## 5. Set Up Automated Syncs

For ongoing data collection, set up GitHub Actions:

1. Push your repository to GitHub
2. Add secrets (Settings > Secrets):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `STEAM_API_KEY`
3. Enable Actions (Actions tab > Enable)

Workflows run on schedules defined in `.github/workflows/`:

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| applist-sync | Daily | Update app list |
| steamspy-sync | Daily at 2:15 AM UTC | SteamSpy data |
| storefront-sync | Every 30 minutes | Store metadata |
| reviews-sync | Every 4 hours | Review scores |
| histogram-sync | Daily | Review histograms |
| trends-calculation | Daily | Trend analysis |

## Quick Reference

### Manual Sync Commands

```bash
# App list (all Steam apps)
pnpm --filter ingestion run sync:applist

# SteamSpy (owners, CCU, developer/publisher)
pnpm --filter ingestion run sync:steamspy

# Storefront (metadata, prices, release dates)
pnpm --filter ingestion run sync:storefront

# Reviews (scores, counts)
pnpm --filter ingestion run sync:reviews

# Review histogram (monthly trends)
pnpm --filter ingestion run sync:histogram

# Calculate trends
pnpm --filter ingestion run calculate:trends

# Calculate priority scores
pnpm --filter ingestion run calculate:priority
```

### Useful Dashboard Pages

- `/` - Overview with key metrics
- `/apps` - Browse all games
- `/publishers` - Browse publishers
- `/developers` - Browse developers
- `/sync` - Monitor sync status

## Troubleshooting

### "No data showing"

1. Check sync jobs ran successfully
2. Check `sync_jobs` table for errors
3. Verify environment variables are set

### "Chat not responding"

1. Check `LLM_PROVIDER` is set
2. Verify API key is valid
3. Check browser console for errors

### "Rate limited"

The APIs have rate limits. Wait and retry:
- SteamSpy: 1 req/sec
- Storefront: ~200/5min
- Reviews: ~20/min

### "Database connection failed"

1. Verify `SUPABASE_URL` format: `https://xxx.supabase.co`
2. Check service key is the full JWT token
3. Ensure project is not paused in Supabase dashboard

## Next Steps

- [Architecture Overview](../architecture/overview.md) - Understand the system
- [Chat Interface Guide](../guides/chat-interface.md) - Learn to query data
- [Deployment](../deployment/) - Deploy to production
