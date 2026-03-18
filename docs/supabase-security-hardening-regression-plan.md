# Supabase Security Hardening Regression Plan

## Status
- Scope: compatibility-first hardening for exposed Supabase tables, RPC grants, and stale RPC definitions.
- Repo state: code, migration, and regenerated linked types are present locally.
- Deployment state: applied manually to the linked database on 2026-03-18 via `psql` because the linked project is missing 33 older local migrations, so `supabase migration up --linked` would have applied unrelated backlog changes too.
- Operational note: migration history drift still exists on the linked project and should be reconciled in a separate pass before any future CLI-based remote migration rollout.

## Goals
- Close the exposed anon/public table and RPC surfaces identified in the Supabase review.
- Preserve current product behavior for authenticated users, admins, and background workers.
- Keep all existing user-facing routes, page contracts, and response payloads intact.
- Provide a concrete pre-deploy, deploy, and post-deploy test plan for every changed surface.

## Change Inventory

| Change ID | Change | Objects | Product surfaces | Risk |
|---|---|---|---|---|
| C1 | Move chat raw SQL execution behind a server-only service-role path | `apps/admin/src/lib/query-executor.ts`, `public.execute_readonly_query(text)` | `/chat`, `/api/chat`, `/api/chat/stream` | Medium |
| C2 | Remove caller-supplied admin identity from credit adjustment UI path | `apps/admin/src/app/(main)/admin/users/UsersTable.tsx`, `public.admin_adjust_user_credits`, `public.admin_adjust_credits` | `/admin/users` | Medium |
| C3 | Move admin dashboard and dashboard stats reads off anon/internal table access | `apps/admin/src/app/(main)/admin/page.tsx`, `apps/admin/src/app/(main)/dashboard/page.tsx` | `/admin`, `/dashboard` | Low |
| C4 | Move internal CCU reads to service-role server code | `apps/admin/src/lib/ccu-queries.ts`, `apps/admin/src/app/(main)/insights/lib/insights-queries.ts`, `apps/admin/src/lib/search/unified-search.ts` | `/apps/[appid]`, `/developers/[id]`, `/publishers/[id]`, `/insights`, `/api/search` | Medium |
| C5 | Move portfolio PICS reads to service-role server code | `apps/admin/src/lib/portfolio-pics.ts` | `/developers/[id]`, `/publishers/[id]` | Low |
| C6 | Move `/api/apps` RPC execution to service-role | `apps/admin/src/app/api/apps/route.ts` | `/apps` data API | Low |
| C7 | Tighten direct table grants on operational/private tables | `alert_detection_state`, `app_dlc`, `ccu_snapshots`, `ccu_tier_assignments`, `dashboard_stats_cache`, `pics_sync_state`, `review_deltas`, `sync_jobs`, `sync_status` | All server/admin/worker flows listed above | Medium |
| C8 | Normalize grants on user/account tables | `chat_query_logs`, `user_profiles`, `waitlist` | `/admin`, `/admin/usage`, `/admin/waitlist`, login/waitlist flow, middleware | Medium |
| C9 | Remove unsafe public waitlist update policy | `waitlist` RLS policy | `/waitlist`, `/admin/waitlist` | Low |
| C10 | Restrict privileged RPCs to the minimum required roles | `execute_readonly_query`, `get_pinned_entities_with_metrics`, `get_user_pins_with_metrics`, `admin_adjust_credits`, `admin_adjust_user_credits`, `get_credit_balance`, `update_user_profile`, `refresh_*`, `update_alert_detection_state`, `recalculate_ccu_tiers`, `get_priority_distribution`, `get_queue_status`, `get_source_completion_stats`, `get_pics_data_stats`, `get_app_sparkline_data`, `get_company_sparkline_data`, `get_apps_filter_option_counts` | Chat, pins, admin pages, apps page, company sparklines, workers | High |
| C11 | Add explicit `search_path` hardening for SECURITY DEFINER functions | Same RPC set as C10 where applicable | All dependent surfaces | Low |
| C12 | Fix stale developer/publisher metrics RPCs against current materialized view columns | `public.get_developers_with_metrics`, `public.get_publishers_with_metrics` | `/developers`, `/publishers` | Medium |
| C13 | Fix stale admin source completion RPC | `public.get_source_completion_stats` | `/admin` | Low |
| C14 | Fix stale apps filter counts RPC compatibility without changing payload shape | `public.get_apps_filter_option_counts` | `/apps` filter dropdown counts | Medium |

## Grant Matrix

### Tables

| Object | Before | After |
|---|---|---|
| `alert_detection_state` | `anon` and `authenticated` had broad read/write | `service_role` only |
| `app_dlc` | `anon` and `authenticated` had broad read/write | `service_role` only |
| `ccu_snapshots` | `anon` and `authenticated` had broad read/write | table access `service_role` only; browser access preserved via hardened sparkline RPCs |
| `ccu_tier_assignments` | `anon` and `authenticated` had broad read/write | table access `service_role` only; browser access preserved via hardened filter-count RPC |
| `dashboard_stats_cache` | `anon` and `authenticated` had broad read/write | `service_role` only |
| `pics_sync_state` | broad table grants plus RLS | `service_role` only |
| `review_deltas` | `anon` and `authenticated` had broad read/write | `service_role` only |
| `sync_jobs` | broad table grants plus RLS | `service_role` only |
| `sync_status` | broad table grants plus RLS | `service_role` only |
| `chat_query_logs` | `anon` and `authenticated` had select/insert/update grants | `authenticated` read only, `service_role` full write/read |
| `user_profiles` | `anon` select/insert/update and `authenticated` select/insert/update | `authenticated` select only, `service_role` full write/read |
| `waitlist` | `anon` select/insert/update, `authenticated` select/insert/update | `anon` insert only, `authenticated` insert/select/update, `service_role` full write/read |

### Functions

| Function | Before | After |
|---|---|---|
| `execute_readonly_query` | `authenticated`, `service_role`; server called it through public REST surface | `service_role` only |
| `get_pinned_entities_with_metrics` | `anon`, `authenticated`, `service_role` | `service_role` only |
| `get_user_pins_with_metrics` | `anon`, `authenticated`, `service_role` | `authenticated` only |
| `admin_adjust_credits` | `anon`, `authenticated`, `service_role` | `authenticated` only |
| `admin_adjust_user_credits` | new | `authenticated` only |
| `get_credit_balance` | `anon`, `authenticated`, `service_role` | `authenticated` only |
| `update_user_profile` | `anon`, `authenticated`, `service_role` | `authenticated` only |
| `refresh_materialized_view` | `anon`, `authenticated`, `service_role` | `service_role` only |
| `refresh_entity_metrics` | `anon`, `authenticated`, `service_role` | `service_role` only |
| `refresh_latest_daily_metrics` | `anon`, `authenticated`, `service_role` | `service_role` only |
| `refresh_monthly_game_metrics` | `anon`, `authenticated`, `service_role` | `service_role` only |
| `update_alert_detection_state` | `anon`, `authenticated`, `service_role` | `service_role` only |
| `recalculate_ccu_tiers` | `anon`, `authenticated`, `service_role` | `service_role` only |
| `get_priority_distribution` | `anon`, `authenticated`, `service_role` | `service_role` only |
| `get_queue_status` | `anon`, `authenticated`, `service_role` | `service_role` only |
| `get_source_completion_stats` | `anon`, `authenticated`, `service_role` | `service_role` only |
| `get_pics_data_stats` | `anon`, `authenticated`, `service_role` | `service_role` only |
| `get_app_sparkline_data` | `anon`, `authenticated`, `service_role` | `authenticated`, `service_role` |
| `get_company_sparkline_data` | `anon`, `authenticated`, `service_role` | `authenticated`, `service_role` |
| `get_apps_filter_option_counts` | `anon`, `authenticated`, `service_role` | `authenticated`, `service_role` |

## Change Matrix

| Change ID | Implementation detail | Expected unchanged behavior |
|---|---|---|
| C1 | `query-executor.ts` now calls the RPC through `getServiceSupabase()` and the DB function is service-only | Chat still answers SQL-backed questions, returns the same result shape, and keeps credits/rate-limit behavior unchanged |
| C2 | Admin UI now calls `admin_adjust_user_credits` without passing the acting admin ID | Credit adjustments still succeed for admins, still fail for non-admins, and balances/transactions still update atomically |
| C3 | `/admin` and `/dashboard` now read internal tables with the service-role client | Dashboard counts and admin monitoring widgets render the same values as before |
| C4 | CCU server helpers now use service-role reads | Detail pages, insights tabs, and `/api/search` still render sparklines and CCU trends |
| C5 | Portfolio PICS helper now uses service-role reads | Developer and publisher detail pages still show genres, categories, platforms, Steam Deck, franchises, languages, and content descriptors |
| C6 | `/api/apps` now runs its RPCs with the service-role client after an auth check | `/apps` list, pagination, search, and aggregate stats still load with the same JSON shape |
| C7 | Internal tables lose browser-role access | No user-facing page should need direct reads/writes to these tables anymore |
| C8 | User/account tables keep only the minimal browser-role privileges | Login, middleware role checks, waitlist signup, admin waitlist review, admin usage, and profile reads still work |
| C9 | Public waitlist updates are removed | Anonymous users can still join the waitlist, but cannot mutate existing rows |
| C10 | Sensitive RPC grants are tightened and worker/admin RPCs are no longer public | Existing UI flows still work through authenticated or service-role paths only |
| C11 | `SECURITY DEFINER` functions get explicit `search_path = public` | No behavior change expected; this is hardening only |
| C12 | Developer/publisher metrics RPCs now map current materialized view columns back to legacy response fields | `/developers` and `/publishers` stop erroring, keep the same field names, and display single owner values cleanly when min=max |
| C13 | Source completion RPC now matches current `sync_status` schema | Admin completion cards render the same four source rows without SQL errors |
| C14 | Apps filter counts regain compatibility by reading `app_steam_deck.category` on the slow path and SECURITY DEFINER execution | Steam Deck filter counts load again without changing the filter option payload |

## Validation Commands

Run these before deployment:

```bash
pnpm check-types
pnpm lint
supabase db lint --linked
```

Run these after deployment approval and migration apply:

```bash
supabase db lint --linked
source .env && /opt/homebrew/opt/libpq/bin/psql "$DATABASE_URL" -P pager=off -c "SELECT proname, prosecdef, proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND proname IN ('execute_readonly_query','get_pinned_entities_with_metrics','get_user_pins_with_metrics','admin_adjust_credits','admin_adjust_user_credits','refresh_materialized_view','refresh_entity_metrics','refresh_latest_daily_metrics','refresh_monthly_game_metrics','update_alert_detection_state','get_app_sparkline_data','get_company_sparkline_data','get_apps_filter_option_counts') ORDER BY proname;"
source .env && /opt/homebrew/opt/libpq/bin/psql "$DATABASE_URL" -P pager=off -c "SELECT table_name, grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name IN ('alert_detection_state','app_dlc','ccu_snapshots','ccu_tier_assignments','dashboard_stats_cache','pics_sync_state','review_deltas','sync_jobs','sync_status','chat_query_logs','user_profiles','waitlist') AND grantee IN ('anon','authenticated','service_role') GROUP BY table_name, grantee ORDER BY table_name, grantee;"
source .env && /opt/homebrew/opt/libpq/bin/psql "$DATABASE_URL" -P pager=off -c "SELECT tablename, policyname, cmd, roles FROM pg_policies WHERE schemaname='public' AND tablename IN ('user_profiles','waitlist','chat_query_logs') ORDER BY tablename, policyname;"
```

Optional worker smoke commands after deployment:

```bash
pnpm --filter @publisheriq/ingestion refresh-views
pnpm --filter @publisheriq/ingestion ccu-tiered-sync
pnpm --filter @publisheriq/ingestion alert-detection
```

## Execution Results

### Static validation
- `pnpm check-types`: passed before deploy.
- `pnpm lint`: passed with the existing warning-only baseline in unrelated files.
- `pnpm build`: passed after the app-side hardening changes.
- `supabase gen types typescript --linked > packages/database/src/types.ts`: completed after the live DB apply.
- `pnpm check-types`: passed again after regenerating linked types.

### Live database apply
- First apply attempt failed cleanly and rolled back because Postgres rejected the generated compatibility column on `app_steam_deck` as non-immutable.
- Migration was patched to fix `get_apps_filter_option_counts` directly instead of adding a compatibility column.
- Second apply attempt succeeded in a single transaction.

### Post-apply database validation
- `supabase db lint --linked`: the previously confirmed live errors for `get_developers_with_metrics`, `get_publishers_with_metrics`, `get_source_completion_stats`, and `get_apps_filter_option_counts` are gone.
- Remaining lint output is limited to existing extra-parameter warnings plus the known `recalculate_ccu_tiers` false positive.
- `recalculate_ccu_tiers()` was executed inside `BEGIN ... ROLLBACK` and completed successfully, confirming the lint error is a false positive.
- SECURITY DEFINER hardening landed for:
  - `execute_readonly_query`
  - `get_pinned_entities_with_metrics`
  - `get_user_pins_with_metrics`
  - `admin_adjust_credits`
  - `admin_adjust_user_credits`
  - `get_app_sparkline_data`
  - `get_company_sparkline_data`
  - `get_apps_filter_option_counts`
  - `refresh_*`
  - `update_alert_detection_state`
- Table grant validation confirmed the intended browser-role reductions for:
  - `alert_detection_state`
  - `app_dlc`
  - `ccu_snapshots`
  - `ccu_tier_assignments`
  - `dashboard_stats_cache`
  - `pics_sync_state`
  - `review_deltas`
  - `sync_jobs`
  - `sync_status`
  - `chat_query_logs`
  - `user_profiles`
  - `waitlist`

### Runtime smoke results
- `get_source_completion_stats()` returned the expected four rows: `steamspy`, `storefront`, `reviews`, and `histogram`.
- `get_developers_with_metrics(... limit 1 ...)` executed successfully and returned live data.
- `get_publishers_with_metrics(... limit 1 ...)` executed successfully and returned live data.
- `get_apps_filter_option_counts('steam_deck', 'game', 0, 0, 0, 0)` executed successfully on the slow path and returned live counts.

### Still pending
- Authenticated browser-flow checks that require a real signed-in session remain to be run manually:
  - `/chat`
  - `/admin/users`
  - `/admin/waitlist`
  - `/api/pins`
  - `/apps` filter UI and sparklines
  - `/developers/[id]` and `/publishers/[id]`
- Worker write-path smoke tests remain pending:
  - `refresh-views`
  - `ccu-tiered-sync`
  - `alert-detection`

## Manual Regression Test Plan

### T1. Chat raw SQL path
- Preconditions: authenticated user with sufficient credits.
- Steps:
  1. Open `/chat`.
  2. Ask for a simple SQL-backed answer such as “top 5 games by reviews”.
  3. Ask a follow-up question that triggers another SQL query.
  4. Inspect the final assistant message debug/tool panel.
- Expected:
  - Responses still stream normally.
  - SQL-backed answers still return tabular data.
  - No `HTTP 500` or `Database error` appears.
  - Credit reservation/finalization behavior remains unchanged.

### T2. Chat security negative checks
- Preconditions: authenticated user, browser devtools or REST client.
- Steps:
  1. Attempt to call `execute_readonly_query` directly with the anon key.
  2. Attempt to query `user_profiles` or `waitlist` through the chat raw SQL path.
- Expected:
  - Direct RPC call is denied after migration.
  - Restricted relations are rejected by the function.

### T3. Admin user credit adjustment
- Preconditions: admin user and a target user account.
- Steps:
  1. Open `/admin/users`.
  2. Add credits to a user.
  3. Deduct credits from the same user.
  4. Refresh the page.
- Expected:
  - Both adjustments succeed.
  - Displayed balance updates after refresh.
  - The flow does not require or expose an admin ID in the client request payload.

### T4. Non-admin credit adjustment negative check
- Preconditions: non-admin account, direct RPC attempt or UI route access.
- Steps:
  1. Attempt to load `/admin/users`.
  2. If direct access to the RPC is possible, call `admin_adjust_user_credits`.
- Expected:
  - UI redirects away from the admin page.
  - RPC returns failure or authorization denial for non-admins.

### T5. Dashboard stats cache
- Preconditions: authenticated user.
- Steps:
  1. Open `/dashboard`.
  2. Confirm Games, Publishers, and Developers cards render.
  3. Repeat with a cold browser session if possible.
- Expected:
  - Counts render exactly as before.
  - No SQL or permission errors appear.

### T6. Admin dashboard data
- Preconditions: admin account.
- Steps:
  1. Open `/admin`.
  2. Verify sync health, queue status, apps with errors, completion stats, PICS stats, running jobs, recent jobs, and chat logs.
  3. Refresh twice to exercise the in-memory cache path.
- Expected:
  - All admin cards and tables load.
  - Completion stats show only SteamSpy, storefront, reviews, and histogram.
  - No zeros caused by permission loss unless the underlying data is actually zero.

### T7. Admin usage page
- Preconditions: admin account with chat history.
- Steps:
  1. Open `/admin/usage`.
  2. Verify aggregate credit/message cards.
  3. Verify top-user rankings and tool usage bars.
- Expected:
  - Page loads without chat log permission errors.
  - Counts align with existing data.

### T8. Waitlist public signup
- Preconditions: signed-out browser.
- Steps:
  1. Open `/waitlist`.
  2. Submit a new waitlist request.
- Expected:
  - Insert still succeeds.
  - No public select/update capability is required.

### T9. Waitlist admin review
- Preconditions: admin account and at least one pending waitlist row.
- Steps:
  1. Open `/admin/waitlist`.
  2. Approve an entry with custom initial credits.
  3. Reject another entry.
  4. Resend an invite from the approved tab.
- Expected:
  - Admin review actions still succeed.
  - Invite resend still works.
  - Non-admin public updates are not possible.

### T10. Pins list and pin checks
- Preconditions: authenticated account with existing pins.
- Steps:
  1. Open `/dashboard` or any page using the pin UI.
  2. Load current pins through `/api/pins`.
  3. Pin and unpin an entity.
  4. Check pin state on app, developer, and publisher detail pages.
- Expected:
  - Current user pins still load.
  - Tampering with `p_user_id` can no longer read another user’s pins.
  - Create/delete pin flows still work.

### T11. Alert worker path
- Preconditions: service-role environment and at least one pinned entity.
- Steps:
  1. Run the alert-detection worker.
  2. Confirm pinned entities are read.
  3. Confirm alert detection state updates complete.
- Expected:
  - Worker still reads `get_pinned_entities_with_metrics`.
  - State upserts succeed.
  - No permission failures occur on `alert_detection_state`.

### T12. Apps page table data
- Preconditions: authenticated user.
- Steps:
  1. Open `/apps`.
  2. Apply several filters.
  3. Clear filters.
  4. Paginate.
- Expected:
  - `/api/apps` still returns the same payload shape.
  - Aggregate stats stay in sync with the table.
  - Default-view cache behavior remains intact.

### T13. Apps page filter dropdown counts
- Preconditions: authenticated user.
- Steps:
  1. Open each filter dropdown that lazily loads counts.
  2. Specifically open Steam Deck, genre, tag, category, platform, and CCU tier filters.
  3. Apply contextual filters such as min score and min owners, then reopen the dropdowns.
- Expected:
  - Counts load without RPC errors.
  - Steam Deck options populate again.
  - Response shape remains `{ option_id, option_name, app_count }`.

### T14. Apps page sparklines
- Preconditions: authenticated user.
- Steps:
  1. Open `/apps`.
  2. Scroll enough to trigger lazy sparkline loading.
  3. Verify several rows render sparklines and trends.
- Expected:
  - `get_app_sparkline_data` still loads from the browser for authenticated users.
  - No permission or auth-race regressions.

### T15. App detail page
- Preconditions: authenticated user.
- Steps:
  1. Open `/apps/[appid]` for a game with rich data.
  2. Verify summary metrics, developers, publishers, histogram, sync status, tags, genres, categories, franchises, and pin state.
  3. Verify the sparkline renders.
- Expected:
  - Page content matches prior behavior.
  - No internal table permission errors appear.

### T16. Developer list page
- Preconditions: authenticated user.
- Steps:
  1. Open `/developers`.
  2. Sort by owners, peak CCU, reviews, revenue, and trending.
  3. Search by name.
  4. Filter active/dormant.
- Expected:
  - Page no longer errors due to stale columns.
  - Owner display collapses cleanly to a single value when min=max.
  - Sorting still works across legacy field names.

### T17. Publisher list page
- Preconditions: authenticated user.
- Steps:
  1. Open `/publishers`.
  2. Sort by owners, peak CCU, reviews, revenue, trending, and unique developers.
  3. Search and filter.
- Expected:
  - Page no longer errors due to stale columns.
  - Owner display remains readable.
  - Unique developer counts still render.

### T18. Developer and publisher detail pages
- Preconditions: authenticated user.
- Steps:
  1. Open `/developers/[id]` and `/publishers/[id]`.
  2. Verify portfolio sparkline, per-game sparklines, related companies, tags, histogram, and PICS summary cards.
- Expected:
  - CCU sparklines still load.
  - Portfolio PICS sections still render.
  - Pin state still loads.

### T19. Insights page
- Preconditions: authenticated user.
- Steps:
  1. Open `/insights`.
  2. Switch among top, newest, and trending tabs.
  3. Change the time range.
- Expected:
  - All tabs still load.
  - Sparkline data and CCU rankings render.
  - No direct `ccu_snapshots` or `ccu_tier_assignments` permission errors appear.

### T20. Search API
- Preconditions: authenticated user.
- Steps:
  1. Use global search or chat autocomplete.
  2. Search for a game with sparkline support.
  3. Search for a publisher and a developer.
- Expected:
  - `/api/search` still returns the same grouped shape.
  - Game results still include sparkline/trend data.

### T21. Worker smoke tests
- Preconditions: service-role environment.
- Steps:
  1. Run `refresh-views`.
  2. Run `ccu-tiered-sync`.
  3. Run `alert-detection`.
- Expected:
  - Worker RPCs and direct table writes succeed with tightened grants.
  - No permission regressions on `refresh_materialized_view`, `recalculate_ccu_tiers`, `sync_jobs`, `sync_status`, `ccu_snapshots`, `ccu_tier_assignments`, or `alert_detection_state`.

## Negative Security Tests

### N1. Direct browser update to `user_profiles`
- Attempt to update `role` or `credit_balance` from a browser client.
- Expected: denied.

### N2. Direct browser insert/update to `chat_query_logs`
- Attempt to insert or update `chat_query_logs` from a browser client.
- Expected: denied.

### N3. Public waitlist mutation
- Attempt to update an existing waitlist row from an anonymous client.
- Expected: denied.

### N4. Direct browser read/write on operational tables
- Attempt reads/writes against `ccu_snapshots`, `ccu_tier_assignments`, `sync_status`, `sync_jobs`, `review_deltas`, `alert_detection_state`, `dashboard_stats_cache`, `pics_sync_state`, `app_dlc`.
- Expected: denied for anon/authenticated roles.

### N5. Sensitive RPC execution
- Attempt direct browser RPC calls to:
  - `execute_readonly_query`
  - `get_pinned_entities_with_metrics`
  - `refresh_materialized_view`
  - `refresh_entity_metrics`
  - `refresh_latest_daily_metrics`
  - `refresh_monthly_game_metrics`
  - `update_alert_detection_state`
  - `recalculate_ccu_tiers`
  - `get_priority_distribution`
  - `get_queue_status`
  - `get_source_completion_stats`
  - `get_pics_data_stats`
- Expected: denied for browser roles.

## Rollout Plan

### Pre-deploy
- Run `pnpm check-types`.
- Run `pnpm lint`.
- Run `supabase db lint --linked`.
- Manually review the SQL migration against current production grants and policies.

### Deploy
- Deploy app code first or in the same release as the migration.
- Apply the migration only after the new app build is available.
- Run the post-deploy validation commands.
- Run smoke tests T1, T3, T6, T12, T13, T14, T19, and T21 immediately.

### Post-deploy stop-ship criteria
- Any authenticated user-facing page loses data due to permission errors.
- Admin pages show empty/zero data because service-role migration or code path failed.
- Chat SQL-backed responses fail.
- Apps filter counts or sparklines fail.
- Alert or refresh workers fail due to grants.

## Rollback Plan

### App rollback
- Revert the app deploy to the previous build if user-facing regressions appear before or during migration apply.

### Migration rollback outline
- Re-grant the previous function/table privileges to the affected roles.
- Restore the prior definitions of:
  - `get_developers_with_metrics`
  - `get_publishers_with_metrics`
  - `get_source_completion_stats`
  - `get_user_pins_with_metrics`
  - `admin_adjust_credits`
  - `execute_readonly_query`
- Drop `admin_adjust_user_credits` if necessary.
- Recreate the removed waitlist update policy only if the product depends on it.
- Leave the compatibility column `app_steam_deck.steam_deck_category` in place unless there is a clear reason to remove it later.

## Notes
- `recalculate_ccu_tiers` was treated as a security-grant issue, not a confirmed logic bug. The linter’s temp-table complaint still needs runtime confirmation after deployment.
- The developer/publisher metrics fix intentionally maps single-value owner totals into the legacy min/max response fields. The UI was updated to display a single formatted owner count when both values are equal.
