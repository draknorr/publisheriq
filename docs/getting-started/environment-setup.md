# Environment Setup

PublisherIQ uses environment variables to configure database connections, API keys, and service settings. This guide covers all variables across the project.

## Quick Setup

Create a `.env` file in the project root:

```bash
# Required for all operations
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
STEAM_API_KEY=your_steam_api_key

# Required for chat interface (choose one)
ANTHROPIC_API_KEY=sk-ant-...
# or
OPENAI_API_KEY=sk-...
LLM_PROVIDER=anthropic
```

---

## Variable Reference

### Core Database

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Service role key (has admin access) |

**Where to find:**
1. Go to your Supabase project
2. Settings > API
3. Copy "Project URL" and "service_role" key

**Security note:** The service key has full database access. Never expose it in client-side code.

### Steam API

| Variable | Required | Description |
|----------|----------|-------------|
| `STEAM_API_KEY` | Yes | Steam Web API key |

**Where to get:**
[steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)

### LLM Provider (Chat Interface)

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_PROVIDER` | No | `anthropic` (default) or `openai` |
| `ANTHROPIC_API_KEY` | If using Anthropic | Anthropic API key |
| `OPENAI_API_KEY` | If using OpenAI | OpenAI API key |

**Models used:**
- Anthropic: Claude 3.5 Haiku (`claude-3-5-haiku-latest`)
- OpenAI: GPT-4o Mini (`gpt-4o-mini`)

### Cube.js Semantic Layer

| Variable | Required | Description |
|----------|----------|-------------|
| `CUBE_API_URL` | Yes | Cube.js API endpoint (e.g., `https://your-app.fly.dev/cubejs-api/v1`) |
| `CUBE_API_SECRET` | Yes | Secret for JWT token signing |

### Qdrant Cloud (Vector Search)

| Variable | Required | Description |
|----------|----------|-------------|
| `QDRANT_URL` | Yes | Qdrant cluster URL (e.g., `https://xxx.aws.cloud.qdrant.io:6333`) |
| `QDRANT_API_KEY` | Yes | Qdrant API key |

### OpenAI Embeddings

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for embeddings |

**Embedding Model:** text-embedding-3-small (1536 dimensions)

---

## PICS Service Variables

The Python PICS service has its own configuration. Create `services/pics-service/.env`:

### Required

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Same as root project |
| `SUPABASE_SERVICE_KEY` | Yes | Same as root project |

### Service Mode

| Variable | Default | Description |
|----------|---------|-------------|
| `MODE` | `change_monitor` | `bulk_sync` or `change_monitor` |
| `PORT` | `8080` | Health check server port |

**Modes:**
- `bulk_sync` - Fetches all ~70k apps (one-time initial sync)
- `change_monitor` - Watches for PICS changes in real-time

### Bulk Sync Options

Used when `MODE=bulk_sync`:

| Variable | Default | Description |
|----------|---------|-------------|
| `BULK_BATCH_SIZE` | `200` | Apps per batch |
| `BULK_REQUEST_DELAY` | `0.5` | Seconds between batches |

### Change Monitor Options

Used when `MODE=change_monitor`:

| Variable | Default | Description |
|----------|---------|-------------|
| `POLL_INTERVAL` | `30` | Seconds between change polls |
| `PROCESS_BATCH_SIZE` | `100` | Changes to process per batch |
| `MAX_QUEUE_SIZE` | `10000` | Maximum queued changes |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `LOG_JSON` | `true` | JSON format for production logging |

---

## GitHub Actions Secrets

For scheduled sync jobs, add these secrets to your GitHub repository:

**Settings > Secrets and variables > Actions > New repository secret**

| Secret Name | Value |
|-------------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Your service role key |
| `STEAM_API_KEY` | Your Steam API key |

---

## Vercel Environment Variables

For dashboard deployment, add these in Vercel project settings:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Your service role key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `LLM_PROVIDER` | `anthropic` |
| `CUBE_API_URL` | Cube.js API endpoint |
| `CUBE_API_SECRET` | Cube.js JWT secret |
| `QDRANT_URL` | Qdrant cluster URL |
| `QDRANT_API_KEY` | Qdrant API key |

---

## Railway Environment Variables

For PICS service deployment:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Your service role key |
| `MODE` | `change_monitor` |
| `PORT` | `${{RAILWAY_PORT}}` (auto-injected) |
| `LOG_JSON` | `true` |

---

## Example .env Files

### Root `.env`

```bash
# Database
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Steam
STEAM_API_KEY=ABCD1234EFGH5678

# LLM (for chat)
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-api03-...

# Cube.js (semantic layer)
CUBE_API_URL=https://publisheriq-cube.fly.dev/cubejs-api/v1
CUBE_API_SECRET=your-cube-api-secret

# Qdrant (vector search)
QDRANT_URL=https://your-cluster.aws.cloud.qdrant.io:6333
QDRANT_API_KEY=your-qdrant-api-key

# OpenAI (embeddings)
OPENAI_API_KEY=sk-...
```

### `apps/admin/.env.local`

```bash
# Database
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# LLM (for chat)
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-api03-...

# Cube.js (semantic layer)
CUBE_API_URL=https://publisheriq-cube.fly.dev/cubejs-api/v1
CUBE_API_SECRET=your-cube-api-secret

# Qdrant (vector search)
QDRANT_URL=https://your-cluster.aws.cloud.qdrant.io:6333
QDRANT_API_KEY=your-qdrant-api-key
```

### `services/pics-service/.env`

```bash
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

MODE=change_monitor
PORT=8080

POLL_INTERVAL=30
LOG_LEVEL=INFO
LOG_JSON=false
```

---

## Validating Configuration

### Check database connection

```bash
# Should output table names
pnpm --filter database test-connection
```

### Check Steam API

```bash
# Run a quick sync test
pnpm --filter ingestion run sync:applist --limit 10
```

### Check LLM connection

Start the dashboard and try a chat query:

```bash
pnpm --filter admin dev
# Visit http://localhost:3000 and use the chat interface
```

## Next Steps

1. [First Run](first-run.md) - Run your first data sync
