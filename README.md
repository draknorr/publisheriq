# PublisherIQ

Steam Publisher & Developer data acquisition platform for tracking games, reviews, trends, and historical metrics. Features an AI-powered natural language interface for querying the database.

## Features

- **Data Ingestion** - Automated collection from Steam APIs and SteamSpy
- **Historical Tracking** - Daily snapshots of reviews, CCU, and pricing
- **Trend Analysis** - 30/90-day trend calculations with review velocity
- **Chat Interface** - Natural language queries powered by Claude AI ([Guide](docs/CHAT_INTERFACE.md))
- **Admin Dashboard** - Browse publishers, developers, games, and sync status

## Architecture

- **Database:** Supabase (PostgreSQL)
- **Workers:** GitHub Actions (scheduled data ingestion)
- **Dashboard:** Next.js 15 on Vercel
- **AI:** Anthropic Claude 3.5 Haiku / OpenAI GPT-4o-mini
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

   # For chat interface (choose one)
   ANTHROPIC_API_KEY=sk-ant-...
   # or
   OPENAI_API_KEY=sk-...
   LLM_PROVIDER=anthropic  # or 'openai'
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
