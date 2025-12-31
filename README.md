# PublisherIQ

Steam Publisher & Developer data acquisition platform for tracking games, reviews, trends, and historical metrics. Features an AI-powered natural language interface for querying the database.

## Features

- **Data Ingestion** - Automated collection from Steam APIs, SteamSpy, and PICS
- **Historical Tracking** - Daily snapshots of reviews, CCU, and pricing
- **Trend Analysis** - 30/90-day trend calculations with review velocity
- **Chat Interface** - Natural language queries powered by Claude AI
- **Admin Dashboard** - Browse publishers, developers, games, and sync status

## Quick Start

```bash
# Clone and install
git clone https://github.com/yourusername/publisheriq.git
cd publisheriq
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase and Steam API credentials

# Build and run
pnpm build
pnpm --filter admin dev
```

Visit [http://localhost:3001](http://localhost:3001) to see the dashboard.

## Documentation

Full documentation is available in the [docs/](docs/) directory:

| Section | Description |
|---------|-------------|
| [Getting Started](docs/getting-started/) | Installation, setup, first run |
| [Architecture](docs/architecture/) | System design, data sources, database |
| [Deployment](docs/deployment/) | Vercel, Railway, GitHub Actions, Supabase |
| [Guides](docs/guides/) | Chat interface, workers, troubleshooting |
| [Reference](docs/reference/) | API specs, rate limits, SQL examples |

## Project Structure

```
publisheriq/
├── apps/admin/              # Next.js 15 dashboard
├── packages/
│   ├── database/            # Supabase client + types
│   ├── ingestion/           # API clients, workers
│   └── shared/              # Utilities, logger
├── services/pics-service/   # Python PICS microservice
├── supabase/migrations/     # Database schema
├── .github/workflows/       # Scheduled sync jobs
└── docs/                    # Documentation
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Dashboard | Next.js 15, React 19, TailwindCSS |
| Database | Supabase (PostgreSQL) |
| Workers | GitHub Actions, TypeScript |
| PICS Service | Python, SteamKit2, Railway |
| AI | Claude 3.5 Haiku / GPT-4o-mini |

## Development

```bash
pnpm build        # Build all packages
pnpm check-types  # Type checking
pnpm format       # Format code
```

## License

Private
