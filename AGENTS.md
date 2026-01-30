# Repository Guidelines

## Canonical Docs
- `CLAUDE.md` is the source of truth for architecture, database safety rules, schema notes, and UI/design system guidance. If anything here conflicts, follow `CLAUDE.md`.

## When Uncertain, Ask
- Ask before making architectural decisions (new patterns/files/dependencies), changing existing behavior, or doing anything destructive/hard to reverse.
- Provide 2–4 concrete options with brief trade-offs.

## Project Structure & Module Organization
- `apps/admin/`: Next.js 15 dashboard (App Router UI).
- `packages/`: shared libraries.
  - `packages/database/`: Supabase client + generated types.
  - `packages/ingestion/`: Steam API clients + workers.
  - `packages/qdrant/`: Qdrant client + collection schemas.
  - `packages/shared/`: utilities/logger.
  - `packages/cube/`: Cube.js semantic layer models.
- `services/pics-service/`: Python PICS microservice.
- `supabase/migrations/`: database schema changes.
- `docs/`: architecture, guides, deployment.

## Build, Test, and Development Commands
Use pnpm + Turbo:
- `pnpm install`: install dependencies.
- `pnpm build`: build all packages/apps via Turbo.
- `pnpm dev`: run dev servers via Turbo.
- `pnpm --filter @publisheriq/admin dev`: run the dashboard only (http://localhost:3001).
- `pnpm lint`: lint all packages.
- `pnpm check-types`: TypeScript type-check.
- `pnpm format`: Prettier format for `*.ts`, `*.tsx`, `*.md`.

## Environment Variables
- Root `.env`: ingestion/sync workers + Supabase service credentials + `DATABASE_URL`.
- `apps/admin/.env.local`: dashboard auth + Supabase + chat/Cube/Qdrant config.
- `services/pics-service/.env`: Python PICS service config (Railway).
- `packages/cube/.env`: Cube.js config (Fly.io).

## Coding Style & Naming Conventions
- TypeScript strict mode; prefer `const`, explicit return types.
- Naming:
  - files: kebab-case (`steam-web.ts`).
  - functions: camelCase (`fetchAppList`).
  - classes: PascalCase (`RateLimiter`).
  - constants: UPPER_SNAKE_CASE (`RATE_LIMITS`).
- Keep modules single-purpose; use barrel exports (`index.ts`).

## Validation Guidelines
No dedicated test runner is documented. Validate changes with:
- `pnpm check-types` and `pnpm lint`.
- Manual verification: `pnpm --filter @publisheriq/admin dev`.
- Worker spot checks (example): `BATCH_SIZE=10 pnpm --filter @publisheriq/ingestion storefront-sync` (see `packages/ingestion/package.json` for available workers).

## Commit & Pull Request Guidelines
- Commit messages follow concise, imperative summaries (e.g., “Fix /apps page performance”).
- PRs should include: clear description, linked issues, and docs updates where relevant.
- Ensure lint + type-check pass before opening a PR.

## Data & Migration Notes
- Migrations live in `supabase/migrations/` and use `YYYYMMDDHHMMSS_description.sql`.
- Never apply migrations automatically. Follow the database safety rules below.
- After schema changes, regenerate database types:
  - `pnpm --filter @publisheriq/database generate-types` (requires `SUPABASE_PROJECT_ID`), or
  - `supabase gen types typescript --linked > packages/database/src/types.ts`

## Database Safety Rules
- **NEVER** run destructive/write operations without explicit approval.
- Before any write operation, explain: what will change, why, risk level (low/medium/high), and rollback plan.
- Requires explicit approval:
  - `supabase db push` / `supabase migration up` / `supabase start`
  - `ALTER TABLE`, `DROP`, `CREATE TABLE`, `TRUNCATE`
  - `INSERT`, `UPDATE`, `DELETE` on production data
- Always safe (no approval needed): `SELECT` queries, `supabase inspect db *`, `supabase migration list`, type generation.
- Some `supabase` commands require Docker (`db push`, `db dump`, `start`); `inspect`/`migration list` do not.

## Database Access (Supabase Postgres)
- Prefer read-only `SELECT` queries unless you explicitly get approval to write/apply migrations.
- Connection string lives in `.env` as `DATABASE_URL`.
- On macOS/Homebrew, `psql` may not be in `PATH`; use the full binary path:
  - `source "$(git rev-parse --show-toplevel)/.env" && /opt/homebrew/opt/libpq/bin/psql "$DATABASE_URL" -c "SELECT 1;"`
- Avoid `psql` meta-commands (like `\d`); use `information_schema` queries instead.

## Schema Gotchas (Common Footguns)
- `apps` has **no** `description` or `short_description` columns.
- `daily_metrics` uses `metric_date` (not `date`).

## Query Performance Notes
- Always use `LIMIT`, and time-bound queries on large tables (especially `daily_metrics` and `ccu_snapshots`).
- Prefer materialized views and RPC functions when available (see `CLAUDE.md` for canonical recommendations).
