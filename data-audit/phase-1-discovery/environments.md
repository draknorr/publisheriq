# Environment Configuration Audit

**Audit Date:** January 9, 2026
**Project:** PublisherIQ
**Auditor:** Data Infrastructure Audit

---

## Executive Summary

PublisherIQ uses environment variables across 4 deployment environments:
1. **Local Development** - Root `.env` and `apps/admin/.env.local`
2. **GitHub Actions** - Repository secrets for scheduled sync jobs
3. **Vercel** - Admin dashboard deployment
4. **Railway** - PICS Python service
5. **Fly.io** - Cube.js semantic layer

This audit found **4 environment files** and identified **35+ unique environment variables** across the project. Key findings include potential variable inconsistencies and security considerations.

---

## 1. Environment Files Inventory

| Location | Type | Purpose |
|----------|------|---------|
| `/.env` | Active (production values) | Root config for ingestion workers and local dev |
| `/apps/admin/.env.local` | Active (production values) | Next.js admin dashboard |
| `/packages/cube/.env.example` | Template | Cube.js configuration template |
| `/services/pics-service/.env.example` | Template | PICS service configuration template |

### Deployment Configuration Files

| Location | Platform | Purpose |
|----------|----------|---------|
| `/packages/cube/fly.toml` | Fly.io | Cube.js deployment configuration |
| `/services/pics-service/railway.toml` | Railway | PICS service deployment configuration |

---

## 2. Variable Catalog (Grouped by Service)

### 2.1 Root Environment (`/.env`)

Variables used by ingestion workers running via pnpm or GitHub Actions.

| Variable | Present | Purpose | Used By |
|----------|---------|---------|---------|
| `SUPABASE_URL` | Yes | Supabase project URL | All workers |
| `SUPABASE_SERVICE_KEY` | Yes | Service role key (admin access) | All workers |
| `DATABASE_URL` | Yes | PostgreSQL connection string | psql commands, refresh-views workflow |
| `STEAM_API_KEY` | Yes | Steam Web API key | applist-sync, steam-web.ts |

### 2.2 Admin Dashboard (`/apps/admin/.env.local`)

Variables for Next.js admin dashboard.

| Variable | Present | Purpose | Used By |
|----------|---------|---------|---------|
| `AUTH_PASSWORD` | Yes | Dashboard login password | Legacy auth |
| `CUBE_API_SECRET` | Yes | JWT signing for Cube.js | cube-executor.ts |
| `CUBE_API_URL` | Yes | Cube.js API endpoint | cube-executor.ts |
| `LLM_PROVIDER` | Yes (`openai`) | LLM provider selection | llm/providers/index.ts |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key (client-side) | Supabase client |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public Supabase URL | Supabase client |
| `OPENAI_API_KEY` | Yes | OpenAI API key | LLM + embeddings |
| `QDRANT_API_KEY` | Yes | Qdrant vector DB key | Vector search |
| `QDRANT_URL` | Yes | Qdrant cluster URL | Vector search |
| `SUPABASE_SERVICE_KEY` | Yes | Service role key | Server-side queries |
| `SUPABASE_URL` | Yes | Supabase project URL | Server-side queries |
| `USE_CUBE_CHAT` | Yes (`true`) | Enable Cube.js chat system | chat/stream/route.ts |
| `VERCEL_OIDC_TOKEN` | Yes | Vercel CLI token (auto-generated) | Vercel integration |

### 2.3 Cube.js (`/packages/cube/.env.example`)

Template variables for Cube.js semantic layer deployment.

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `CUBEJS_DB_HOST` | Yes | - | Database host |
| `CUBEJS_DB_PORT` | Yes | `5432` | Database port |
| `CUBEJS_DB_NAME` | Yes | `postgres` | Database name |
| `CUBEJS_DB_USER` | Yes | `postgres` | Database user |
| `CUBEJS_DB_PASS` | Yes | - | Database password |
| `CUBEJS_API_SECRET` | Yes | - | JWT signing secret |
| `CUBEJS_DEV_MODE` | No | `true` | Enable playground UI |
| `CUBEJS_CACHE_AND_QUEUE_DRIVER` | No | `memory` | Cache driver |
| `CUBEJS_PRE_AGGREGATIONS_SCHEMA` | No | `cube_pre_aggs` | Pre-aggregation schema |

### 2.4 PICS Service (`/services/pics-service/.env.example`)

Variables for Python PICS microservice.

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `SUPABASE_URL` | Yes | - | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | - | Service role key |
| `MODE` | No | `change_monitor` | Service mode |
| `PORT` | No | `8080` | Health check port |
| `BULK_BATCH_SIZE` | No | `200` | Apps per batch (bulk mode) |
| `BULK_REQUEST_DELAY` | No | `0.5` | Seconds between batches |
| `POLL_INTERVAL` | No | `30` | Change poll interval |
| `PROCESS_BATCH_SIZE` | No | `100` | Changes per batch |
| `MAX_QUEUE_SIZE` | No | `10000` | Max queued changes |
| `LOG_LEVEL` | No | `INFO` | Log verbosity |
| `LOG_JSON` | No | `true` | JSON log format |
| `STEAM_USERNAME` | No | - | Steam credentials (optional) |
| `STEAM_PASSWORD` | No | - | Steam credentials (optional) |

### 2.5 GitHub Actions Workflow Variables

Variables used in `.github/workflows/*.yml` files.

| Variable | Source | Used By Workflows |
|----------|--------|-------------------|
| `SUPABASE_URL` | Secret | All sync workflows |
| `SUPABASE_SERVICE_KEY` | Secret | All sync workflows |
| `STEAM_API_KEY` | Secret | applist-sync |
| `DATABASE_URL` | Secret | refresh-views |
| `QDRANT_URL` | Secret | embedding-sync |
| `QDRANT_API_KEY` | Secret | embedding-sync |
| `OPENAI_API_KEY` | Secret | embedding-sync |
| `GITHUB_RUN_ID` | Auto | All workflows (job tracking) |

#### Per-Workflow Runtime Variables

| Workflow | Runtime Variables |
|----------|-------------------|
| `storefront-sync` | `BATCH_SIZE`, `PARTITION_COUNT`, `PARTITION_ID` |
| `reviews-sync` | `BATCH_SIZE` |
| `histogram-sync` | `BATCH_SIZE` |
| `steamspy-sync` | `MAX_PAGES`, `SUPPLEMENTARY_LIMIT` |
| `embedding-sync` | `BATCH_SIZE` |
| `ccu-daily-sync` | `CCU_DAILY_LIMIT` |
| `ccu-sync` | (none) |
| `interpolation` | `INTERPOLATION_DAYS` |

---

## 3. Deployment Configuration Details

### 3.1 Fly.io Configuration (`/packages/cube/fly.toml`)

```toml
app = 'publisheriq-cube'
primary_region = 'sjc'

[env]
CUBEJS_CACHE_AND_QUEUE_DRIVER = 'memory'
CUBEJS_DEV_MODE = 'true'
CUBEJS_LOG_LEVEL = 'info'
CUBEJS_PRE_AGGREGATIONS_SCHEMA = 'cube_pre_aggs'
CUBEJS_TELEMETRY = 'false'
NODE_ENV = 'production'

[http_service]
internal_port = 4000
min_machines_running = 1

[[vm]]
memory = '512mb'
cpus = 1
```

**Secrets managed via Fly.io CLI:**
- `CUBEJS_DB_HOST`
- `CUBEJS_DB_PORT`
- `CUBEJS_DB_NAME`
- `CUBEJS_DB_USER`
- `CUBEJS_DB_PASS`
- `CUBEJS_API_SECRET`

### 3.2 Railway Configuration (`/services/pics-service/railway.toml`)

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 5
```

**Secrets managed via Railway dashboard:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `MODE`
- `PORT` (auto-injected as `${{RAILWAY_PORT}}`)

---

## 4. Environment Comparison Matrix

### Core Variables Across Environments

| Variable | Root `.env` | Admin `.env.local` | GitHub Actions | Vercel | Railway | Fly.io |
|----------|-------------|-------------------|----------------|--------|---------|--------|
| `SUPABASE_URL` | [REDACTED] | [REDACTED] | Secret | Required | Required | - |
| `SUPABASE_SERVICE_KEY` | [REDACTED] | [REDACTED] | Secret | Required | Required | - |
| `DATABASE_URL` | [REDACTED] | - | Secret | - | - | - |
| `STEAM_API_KEY` | [REDACTED] | - | Secret | - | - | - |
| `OPENAI_API_KEY` | - | [REDACTED] | Secret | Required | - | - |
| `ANTHROPIC_API_KEY` | - | - | - | Optional | - | - |
| `LLM_PROVIDER` | - | `openai` | - | Required | - | - |
| `CUBE_API_URL` | - | [REDACTED] | - | Required | - | - |
| `CUBE_API_SECRET` | - | [REDACTED] | - | Required | - | Secret |
| `QDRANT_URL` | - | [REDACTED] | Secret | Required | - | - |
| `QDRANT_API_KEY` | - | [REDACTED] | Secret | Required | - | - |
| `CUBEJS_DB_*` | - | - | - | - | - | Secret |

### Feature Flag Variables

| Variable | Admin `.env.local` | Vercel | Default | Purpose |
|----------|-------------------|--------|---------|---------|
| `USE_CUBE_CHAT` | `true` | - | `false` | Enable Cube.js chat |
| `CREDITS_ENABLED` | Not set | Optional | `false` | Enable credit system |
| `AUTH_MODE` | Not set | Optional | `none` | Authentication mode |

---

## 5. Discrepancies and Concerns

### 5.1 Security Issues

| Issue | Severity | Location | Recommendation |
|-------|----------|----------|----------------|
| Production secrets in local `.env` files | HIGH | Root `.env`, `apps/admin/.env.local` | These files contain live production credentials. Ensure `.env` and `.env.local` are in `.gitignore` |
| Service key exposure risk | MEDIUM | All environments | Service key has full DB access. Consider RLS policies for additional protection |
| No secret rotation | LOW | All secrets | No evidence of secret rotation schedule |

### 5.2 Missing Variables

| Variable | Missing From | Impact | Recommendation |
|----------|--------------|--------|----------------|
| `ANTHROPIC_API_KEY` | Admin `.env.local` | Cannot use Anthropic LLM | Add if Anthropic support needed |
| `CREDITS_ENABLED` | Admin `.env.local` | Credit system disabled | Add if credit tracking needed |
| `NEXT_PUBLIC_SITE_URL` | Admin `.env.local` | Uses fallback origin | Add for consistent redirect URLs |
| `AUTH_MODE` | Admin `.env.local` | Auth disabled | Add if user auth needed |

### 5.3 Inconsistencies

| Issue | Details | Recommendation |
|-------|---------|----------------|
| `LLM_PROVIDER` default mismatch | Docs say `anthropic` default, but code defaults to `openai` | Update documentation or code |
| `OPENAI_API_KEY` dual purpose | Used for both LLM and embeddings | Consider separate keys for isolation |
| `DATABASE_URL` vs Supabase client | Some workflows use `DATABASE_URL` directly, others use Supabase client | Standardize approach |
| Missing `.env.example` in root | Only `packages/` and `services/` have examples | Add root `.env.example` |
| Missing `.env.example` in admin | `apps/admin/` lacks template | Add `apps/admin/.env.example` |

### 5.4 Configuration Drift Risks

| Risk | Description | Mitigation |
|------|-------------|------------|
| Local vs Production mismatch | Local `.env` files point to production Supabase | Consider separate dev database |
| No staging environment | All config is dev or production | Add staging for safer testing |
| Hardcoded defaults | Batch sizes, timeouts in code | Document all configurable defaults |

---

## 6. Variable Discovery in Code

### 6.1 TypeScript/JavaScript Usage (`process.env.*`)

| Package | Variables Used |
|---------|----------------|
| `packages/database` | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `packages/cube` | `CUBE_API_URL`, `CUBE_API_SECRET`, `CUBEJS_*` |
| `packages/qdrant` | `QDRANT_URL`, `QDRANT_API_KEY` |
| `packages/shared` | `LOG_LEVEL` |
| `packages/ingestion` | `GITHUB_RUN_ID`, `BATCH_SIZE`, `PARTITION_*`, `*_LIMIT`, `STEAM_API_KEY`, `OPENAI_API_KEY` |
| `apps/admin` | All chat/LLM variables, Supabase, Cube, Qdrant |

### 6.2 Python Usage (PICS Service)

Uses `pydantic-settings` for type-safe config validation:

```python
class Settings(BaseSettings):
    supabase_url: str           # Required
    supabase_service_key: str   # Required
    steam_username: Optional[str] = None
    steam_password: Optional[str] = None
    mode: str = "change_monitor"
    port: int = 8080
    # ... etc
```

### 6.3 No Env Validation Schema Found

The TypeScript codebase does **not** use Zod, Joi, or similar for environment validation. Variables are accessed directly with optional fallbacks.

---

## 7. Recommendations

### Immediate Actions

1. **Create root `.env.example`** with all required variables documented
2. **Create `apps/admin/.env.example`** template
3. **Add environment validation** using Zod or similar for TypeScript packages
4. **Document secret rotation** procedure

### Short-term Improvements

1. **Consider staging environment** - separate database for pre-production testing
2. **Separate OpenAI keys** - one for LLM, one for embeddings
3. **Add `NEXT_PUBLIC_SITE_URL`** to admin for consistent URLs
4. **Fix documentation** - `LLM_PROVIDER` default is `openai`, not `anthropic`

### Long-term Considerations

1. **Secret management** - Consider vault-based secret management (e.g., Doppler, HashiCorp Vault)
2. **Environment parity** - Ensure local dev mirrors production structure
3. **Automated config validation** - CI check for required environment variables

---

## 8. Appendix: Complete Variable Reference

### All Discovered Variables (Alphabetical)

| Variable | Type | Required | Default |
|----------|------|----------|---------|
| `ANTHROPIC_API_KEY` | Secret | Conditional | - |
| `AUTH_MODE` | Config | No | `none` |
| `AUTH_PASSWORD` | Secret | Legacy | - |
| `BATCH_SIZE` | Config | No | Varies |
| `BULK_BATCH_SIZE` | Config | No | `200` |
| `BULK_REQUEST_DELAY` | Config | No | `0.5` |
| `CCU_DAILY_LIMIT` | Config | No | `50000` |
| `CCU_LIMIT` | Config | No | Varies |
| `CREDITS_ENABLED` | Feature Flag | No | `false` |
| `CUBE_API_SECRET` | Secret | Yes | - |
| `CUBE_API_URL` | Config | Yes | - |
| `CUBEJS_API_SECRET` | Secret | Yes | - |
| `CUBEJS_CACHE_AND_QUEUE_DRIVER` | Config | No | `memory` |
| `CUBEJS_DB_HOST` | Secret | Yes | - |
| `CUBEJS_DB_NAME` | Config | No | `postgres` |
| `CUBEJS_DB_PASS` | Secret | Yes | - |
| `CUBEJS_DB_PORT` | Config | No | `5432` |
| `CUBEJS_DB_USER` | Config | No | `postgres` |
| `CUBEJS_DEV_MODE` | Config | No | `true` |
| `CUBEJS_LOG_LEVEL` | Config | No | `info` |
| `CUBEJS_PRE_AGGREGATIONS_SCHEMA` | Config | No | `cube_pre_aggs` |
| `CUBEJS_TELEMETRY` | Config | No | `false` |
| `DATABASE_URL` | Secret | For psql | - |
| `GITHUB_RUN_ID` | Auto | No | - |
| `INTERPOLATION_DAYS` | Config | No | `30` |
| `LLM_PROVIDER` | Config | No | `openai` |
| `LOG_JSON` | Config | No | `true` |
| `LOG_LEVEL` | Config | No | `INFO` |
| `MAX_PAGES` | Config | No | `0` (unlimited) |
| `MAX_QUEUE_SIZE` | Config | No | `10000` |
| `MODE` | Config | No | `change_monitor` |
| `NEXT_PUBLIC_SITE_URL` | Config | No | Origin fallback |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Secret | For client auth | - |
| `NEXT_PUBLIC_SUPABASE_URL` | Config | For client auth | - |
| `NODE_ENV` | Config | No | - |
| `OPENAI_API_KEY` | Secret | Yes | - |
| `PAGES_LIMIT` | Config | No | `0` |
| `PARTITION_COUNT` | Config | No | `1` |
| `PARTITION_ID` | Config | No | `0` |
| `POLL_INTERVAL` | Config | No | `30` |
| `PORT` | Config | No | `8080` |
| `PROCESS_BATCH_SIZE` | Config | No | `100` |
| `QDRANT_API_KEY` | Secret | Yes | - |
| `QDRANT_URL` | Config | Yes | - |
| `STEAM_API_KEY` | Secret | Yes | - |
| `STEAM_PASSWORD` | Secret | No | - |
| `STEAM_USERNAME` | Secret | No | - |
| `SUPABASE_SERVICE_KEY` | Secret | Yes | - |
| `SUPABASE_URL` | Config | Yes | - |
| `SUPPLEMENTARY_LIMIT` | Config | No | `100` |
| `SYNC_COLLECTION` | Config | No | `all` |
| `USE_CUBE_CHAT` | Feature Flag | No | `false` |
| `VERCEL_OIDC_TOKEN` | Auto | No | - |

---

*Report generated: January 9, 2026*
