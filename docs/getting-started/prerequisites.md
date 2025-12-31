# Prerequisites

Before setting up PublisherIQ, ensure you have the following tools, accounts, and API keys.

## Required Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | JavaScript runtime |
| pnpm | 9+ | Package manager |
| Git | Latest | Version control |
| Python | 3.11+ | PICS service (optional) |
| Poetry | Latest | Python dependency management (optional) |

### Installing pnpm

```bash
# Using npm
npm install -g pnpm

# Or using Corepack (Node.js 16.13+)
corepack enable
corepack prepare pnpm@latest --activate
```

## Required Accounts

### 1. Supabase Account

Supabase provides the PostgreSQL database for all data storage.

1. Create account at [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and service key (Settings > API)

### 2. Steam API Key

Required for accessing Steam's official APIs.

1. Log in to Steam
2. Visit [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)
3. Register a domain name (can be `localhost` for development)
4. Copy your API key

### 3. LLM API Key (for Chat Interface)

The chat interface requires an LLM provider. Choose one:

**Option A: Anthropic (Recommended)**
1. Create account at [console.anthropic.com](https://console.anthropic.com)
2. Generate an API key
3. Uses Claude 3.5 Haiku by default

**Option B: OpenAI**
1. Create account at [platform.openai.com](https://platform.openai.com)
2. Generate an API key
3. Uses GPT-4o-mini by default

## Optional Services

### GitHub Account

Required for:
- Running scheduled sync workflows via GitHub Actions
- Hosting the repository

### Vercel Account

For deploying the admin dashboard:
1. Create account at [vercel.com](https://vercel.com)
2. Connect to your GitHub repository

### Railway Account

For deploying the PICS service:
1. Create account at [railway.app](https://railway.app)
2. Connect to your GitHub repository

## System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 4 GB | 8 GB |
| Disk | 1 GB | 5 GB |
| Network | Stable | Stable |

## Next Steps

Once you have all prerequisites:
1. [Installation](installation.md) - Clone and set up the project
2. [Environment Setup](environment-setup.md) - Configure environment variables
