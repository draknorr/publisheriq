# Contributing to PublisherIQ

Thank you for your interest in contributing to PublisherIQ. This document provides guidelines for contributing to the project.

## Getting Started

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Build packages: `pnpm build`
4. Set up environment variables (see [Environment Setup](docs/getting-started/environment-setup.md))

## Development Workflow

### Branch Naming

Use descriptive branch names:
- `feature/add-new-api` - New features
- `fix/storefront-rate-limit` - Bug fixes
- `docs/update-readme` - Documentation
- `refactor/worker-pattern` - Code refactoring

### Making Changes

1. Create a new branch from `main`
2. Make your changes
3. Run type checking: `pnpm check-types`
4. Run linting: `pnpm lint`
5. Test your changes locally
6. Commit with clear messages

### Commit Messages

Write clear, descriptive commit messages:

```
Add Steam Deck compatibility sync

- Fetch Steam Deck status from PICS
- Create app_steam_deck table
- Add migration for new columns
```

### Pull Requests

1. Update documentation if needed
2. Ensure all checks pass
3. Provide a clear description of changes
4. Link related issues

## Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use explicit return types for functions
- Use interfaces over type aliases for objects

### Naming Conventions

- **Files:** kebab-case (`steam-web.ts`, `rate-limiter.ts`)
- **Functions:** camelCase (`fetchAppList`, `createServiceClient`)
- **Classes:** PascalCase (`RateLimiter`, `AppError`)
- **Constants:** UPPER_SNAKE_CASE (`RATE_LIMITS`, `BATCH_SIZES`)

### Code Organization

- Keep files focused and single-purpose
- Group related functionality
- Use barrel exports (`index.ts`)

## Project Structure

### Packages

| Package | Purpose |
|---------|---------|
| `@publisheriq/database` | Supabase client and types |
| `@publisheriq/ingestion` | API clients and workers |
| `@publisheriq/shared` | Utilities and constants |

### Adding New Features

1. Determine which package the feature belongs to
2. Follow existing patterns in that package
3. Export from the package's `index.ts`
4. Add tests if applicable
5. Update documentation

### Adding New Workers

See [Adding New Workers](docs/guides/adding-new-worker.md) for detailed instructions.

## Documentation

- Update relevant docs when making changes
- Use markdown for all documentation
- Keep code examples current
- Link to related documentation

## Testing

### Manual Testing

```bash
# Run a specific worker with limited batch
BATCH_SIZE=10 pnpm --filter ingestion steamspy-sync

# Test the dashboard
pnpm --filter admin dev
```

### Type Checking

```bash
pnpm check-types
```

## Database Changes

### Adding Migrations

1. Create a new file in `supabase/migrations/`
2. Use timestamp prefix: `YYYYMMDDHHMMSS_description.sql`
3. Test migration in development first
4. Document changes in migration file

### Updating Types

After schema changes:

```bash
pnpm --filter database generate-types
```

## Rate Limits

When working with external APIs:
- Always use the rate limiter
- Test with small batches first
- Document any new rate limits

## Security

- Never commit API keys or secrets
- Use environment variables
- Validate all user input
- Use read-only queries in chat interface

## Questions

If you have questions:
1. Check existing documentation
2. Search for related issues
3. Open a new issue with details

## Code of Conduct

- Be respectful and constructive
- Focus on the code, not the person
- Help others learn and grow
