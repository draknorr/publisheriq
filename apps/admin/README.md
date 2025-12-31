# Admin Dashboard

Next.js 15 admin dashboard for PublisherIQ.

## Overview

The admin dashboard provides a web interface for:
- Browsing games, publishers, and developers
- Monitoring sync job status
- Querying data via AI-powered chat interface

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **React:** 19.0
- **Styling:** TailwindCSS
- **Icons:** Lucide React
- **Charts:** Recharts
- **Syntax Highlighting:** Shiki

## Development

```bash
# Start development server
pnpm --filter admin dev

# Build for production
pnpm --filter admin build

# Start production server
pnpm --filter admin start
```

The development server runs on [http://localhost:3001](http://localhost:3001).

## Project Structure

```
src/
├── app/                    # App Router pages
│   ├── api/
│   │   ├── auth/           # Authentication API
│   │   └── chat/           # Chat API endpoint
│   ├── apps/               # Games listing
│   ├── chat/               # Chat interface page
│   ├── developers/         # Developers listing
│   ├── publishers/         # Publishers listing
│   ├── sync/               # Sync status monitoring
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Dashboard home
│
├── components/
│   ├── chat/               # Chat interface components
│   ├── ui/                 # Shared UI components
│   └── ...                 # Feature components
│
├── lib/
│   ├── llm/                # LLM integration
│   │   ├── providers/      # Anthropic, OpenAI clients
│   │   ├── system-prompt.ts
│   │   └── tools.ts
│   ├── query-executor.ts   # SQL validation & execution
│   └── ...                 # Utilities
│
└── middleware.ts           # Auth middleware
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard overview |
| `/apps` | Browse all games |
| `/apps/[appid]` | Game detail page |
| `/publishers` | Browse publishers |
| `/publishers/[id]` | Publisher detail |
| `/developers` | Browse developers |
| `/developers/[id]` | Developer detail |
| `/sync` | Sync job monitoring |
| `/chat` | AI chat interface |

## Chat Interface

The chat interface uses LLM to convert natural language to SQL:

1. User asks a question
2. LLM generates SQL query
3. Query is validated (read-only, blocked keywords)
4. Query executed via Supabase RPC
5. Results returned as formatted markdown

**Security:**
- Only SELECT queries allowed
- Dual validation (client + database)
- 50 row result limit
- Dangerous keywords blocked

## Environment Variables

```bash
# Required
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# LLM Provider (choose one)
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
# or
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

## Features

### Data Browsing

- Paginated tables with sorting
- Search and filtering
- Clickable links between related entities

### Sync Monitoring

- Recent job history
- Success/failure rates
- Error messages
- Job duration tracking

### Chat Interface

- Natural language queries
- SQL syntax highlighting
- Expandable query details
- Clickable game links

## Dependencies

This app depends on workspace packages:
- `@publisheriq/database` - Supabase client and types

## Related Documentation

- [Chat Interface Guide](../../docs/guides/chat-interface.md)
- [Vercel Deployment](../../docs/deployment/vercel.md)
- [Environment Setup](../../docs/getting-started/environment-setup.md)
