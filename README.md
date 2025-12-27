# PublisherIQ

Steam Publisher & Developer data acquisition platform for tracking games, reviews, trends, and historical metrics.

## Architecture

- **Database:** Supabase (PostgreSQL)
- **Workers:** GitHub Actions (scheduled data ingestion)
- **Dashboard:** Next.js on Vercel (minimal admin UI)
- **Language:** TypeScript throughout

## Project Structure

```
publisheriq/
├── .github/workflows/     # GitHub Actions for data ingestion
├── apps/
│   └── admin/             # Next.js admin dashboard
├── packages/
│   ├── database/          # Supabase client + generated types
│   ├── ingestion/         # API clients, scrapers, workers
│   └── shared/            # Constants, utilities, logger
├── supabase/
│   └── migrations/        # Database schema
└── docs/                  # Documentation
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase account
- Steam API key

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Create a Supabase project at https://supabase.com

4. Get a Steam API key at https://steamcommunity.com/dev/apikey

5. Create `.env` file with:
   ```
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJ...
   STEAM_API_KEY=xxx
   ```

6. Apply database migrations in Supabase SQL Editor

7. Build packages:
   ```bash
   pnpm build
   ```

## Development

```bash
# Build all packages
pnpm build

# Run type checking
pnpm check-types

# Format code
pnpm format
```

## Data Sources

| API | Rate Limit | Data |
|-----|------------|------|
| Steam App List | 100K/day | All appids |
| SteamSpy | 1/sec | Developer, publisher, owners, CCU |
| Storefront | ~200/5min | Game metadata, release dates |
| Reviews | ~20/min | Review summary and scores |
| Histogram | ~60/min | Monthly review trends |

## License

Private
