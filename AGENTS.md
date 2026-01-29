# Repository Guidelines

## Project Structure & Module Organization
- `apps/admin/`: Next.js 15 dashboard (App Router UI).
- `packages/`: shared libraries.
  - `packages/database/`: Supabase client + generated types.
  - `packages/ingestion/`: Steam API clients + workers.
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
- `pnpm --filter admin dev`: run the dashboard only.
- `pnpm lint`: lint all packages.
- `pnpm check-types`: TypeScript type-check.
- `pnpm format`: Prettier format for `*.ts`, `*.tsx`, `*.md`.

## Coding Style & Naming Conventions
- TypeScript strict mode; prefer `const`, explicit return types.
- Naming:
  - files: kebab-case (`steam-web.ts`).
  - functions: camelCase (`fetchAppList`).
  - classes: PascalCase (`RateLimiter`).
  - constants: UPPER_SNAKE_CASE (`RATE_LIMITS`).
- Keep modules single-purpose; use barrel exports (`index.ts`).

## Testing Guidelines
No dedicated test runner is documented. Validate changes with:
- `pnpm check-types` and `pnpm lint`.
- Manual verification: `pnpm --filter admin dev`.
- Worker spot checks (example): `BATCH_SIZE=10 pnpm --filter ingestion steamspy-sync`.

## Commit & Pull Request Guidelines
- Commit messages follow concise, imperative summaries (e.g., “Fix /apps page performance”).
- PRs should include: clear description, linked issues, and docs updates where relevant.
- Ensure lint + type-check pass before opening a PR.

## Data & Migration Notes
- Migrations live in `supabase/migrations/` and use `YYYYMMDDHHMMSS_description.sql`.
- After schema changes: `pnpm --filter database generate-types`.
- Follow database safety guidance in `CLAUDE.md` (no direct migration/apply without explicit approval).

## Database Access (Supabase Postgres)
- Prefer read-only `SELECT` queries unless you explicitly get approval to write/apply migrations.
- Connection string lives in `.env` as `DATABASE_URL`.
- On macOS/Homebrew, `psql` may not be in `PATH`; use the full binary path:
  - `source .env && /opt/homebrew/opt/libpq/bin/psql "$DATABASE_URL" -c "SELECT 1;"`
- Avoid `psql` meta-commands (like `\d`); use `information_schema` queries instead.
