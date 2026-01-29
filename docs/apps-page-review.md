# Apps Page Review (2026-01-28)

## Scope
Reviewed `/apps` UI, client query flow, API route, and database RPCs/views used by the Games page. Focused on correctness, UX regressions, and query performance (live DB).

## Key Findings
1. **Filter chip removal is broken**: quick filters remove the wrong chip; genre/tag/category chips don’t clear at all. The chip keys emitted by `ActiveFilterBar` don’t match the handler in `AppsPageClient`.
2. **“On Sale” filter is a no‑op**: `minDiscount` never reaches the API or the DB, so results are unfiltered.
3. **Aggregate stats often mismatch the table**: `get_apps_aggregate_stats` ignores many filters and filter modes (platforms, workshop, controller, early access, publisher/dev, min/max modes), so stats can be materially wrong.
4. **`selfPublished=false` returns zero rows**: the SQL filter only handles the TRUE case, so “External Publisher” yields no results.
5. **Filter modes lost in API**: `genreMode/tagMode/platformMode=any` is dropped by the client and defaulted to `all` in the API.
6. **SSR initial data is incomplete**: server-side filter parsing only includes a subset, so initial render can be wrong until client refetch.
7. **Boolean filters with false aren’t treated as active**: `isFree=false`/`hasWorkshop=false` won’t appear active and may skip “Clear filters.”
8. **Default view cache ignores `limit`**: requests with non‑50 limits can get cached 50-row results.
9. **Data freshness footer may be misleading**: uses `apps[0].data_updated_at`, which depends on sort, not freshness.
10. **`formatCompactNumber(0)` renders “—”**: hides real zero values in the table.

## Performance Notes (Live DB)
- `get_apps_with_filters` default view: ~2.8s function scan; internal query ~0.73s with external sort + temp spill.
- `get_apps_aggregate_stats` default view: ~4.16s full scan with joins.
- Default API path runs both sequentially, so a cold load can exceed 4–5s.

## Proposed Fixes
### Correctness / UX
- **Align filter chip removal**: either emit `genre:`/`tag:`/`category:` keys from the chip or update the handler to accept plain `genre/tag/category`. For quick filters, pass the filter id and remove that exact id (not `activeQuickFilters[0]`).
- **Plumb `minDiscount` end‑to‑end**: add to URL params, API parse, RPC args, and SQL filter (use `current_discount_percent >= p_min_discount`).
- **Fix `selfPublished=false` SQL**: include `FALSE` case with `<>` comparison (guard for NULL names).
- **Preserve filter modes**: send `genreMode/tagMode/platformMode` when set to `any`, and default the API to `any` when no param is present to match DB defaults.
- **Unify filter parsing**: export a shared parse/validate helper (server + client) so SSR uses the same full set of filters.
- **Treat `false` as active**: use `!== undefined` for boolean filters in `hasActiveFilters`.
- **Fix default cache key**: include `limit` in `cacheKey`, or cache only when `limit===50`.
- **Data freshness**: compute `MAX(data_updated_at)` in the API/RPC and pass it explicitly.
- **Zero values**: render `0` instead of “—” in `formatCompactNumber`.

### Performance
- **Fast path for default list**: reorder query to use `latest_daily_metrics` index (`ccu_peak DESC`) for top‑N, then join `apps`/`app_filter_data` for those 50 appids.
- **Use materialized stats for default view in API**: mirror the server path (use `mv_apps_aggregate_stats` when no filters).
- **Extend aggregate stats RPC**: accept full filter set + filter modes, or compute stats from a filtered CTE shared with `get_apps_with_filters` to keep semantics identical.

## Verification Checklist
- Apply each filter preset and remove chips; confirm the exact chip clears.
- Validate “On Sale” returns only discounted apps (non‑zero `current_discount_percent`).
- Compare stats vs. table for complex filters (tags + platforms + early access).
- Confirm “External Publisher” returns results.
- Measure default page load: ensure aggregate stats <500ms and list <1s.
