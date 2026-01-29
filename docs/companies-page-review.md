# Companies Page Review (2026-01-28)

## Scope
Reviewed `/companies` UI, client filter flow, and the database RPCs used for list + aggregate stats. Focused on correctness, UX issues, and query performance on the live DB.

## Key Findings
1. **Relationship filters are very slow**: `get_companies_with_filters` switches to a correlated-subquery “slow path” when `relationship` is set; this took ~5.8s for 50 rows on the live DB.
2. **Aggregate stats ignore relationship filters**: `get_companies_aggregate_stats` has no `p_relationship`, so stats don’t match the list when relationship filters are active.
3. **Tag match mode UI is non-functional**: the command palette offers “Match ANY/ALL” for tags, but tag mode is not stored in URL, not passed to RPC, and SQL always uses `&&` (ANY). “ALL” never takes effect.
4. **Genre mode race condition**: command palette applies genres + mode via separate URL pushes (`setGenres` then `setGenreMode`), which can drop one of the updates.
5. **Period filter is a no‑op**: `period` is passed through but unused in both list and aggregate RPCs.
6. **Search likely scans large sets**: `p_search` is applied after a UNION in the filtered CTE, which likely bypasses publisher/developer trigram indexes.
7. **Ratio sorts are only local**: client-side ratio sorts (e.g., `revenue_per_game`) reorder only the top 50 rows fetched by the server’s sort, not the full dataset.
8. **Result count is partial**: ActiveFilterBar shows `initialData.length` (<=50), not the total filtered count.
9. **Zero values are hidden**: `formatCompactNumber/formatRevenue/formatHours` return `—` for 0, masking real zeros.
10. **Review percentage bug**: `getReviewPercentage` returns null when `positive_reviews = 0` and `total_reviews > 0`, so 0% is hidden.

## Performance Notes (Live DB)
- Default list RPC (`get_companies_with_filters`): ~0.97s for 50 rows.
- Aggregate stats RPC: ~0.48s.
- Relationship filter path: ~5.8s (slowest path).

## Proposed Fixes
### Correctness / UX
- **Relationship stats**: add `p_relationship` to `get_companies_aggregate_stats` and reuse the same filtered base as list RPC.
- **Tag mode**: either remove the Match ANY/ALL UI for tags or implement `tagMode` end‑to‑end (`CompaniesFilterParams`, URL params, RPC param, SQL `@>` for ALL).
- **Genre mode race**: add a combined setter (e.g., `setGenresWithMode`) and use it in the command palette to avoid URL state clobbering.
- **Period filter**: implement it (filter by release date / activity windows) or remove it from UI until supported.
- **Search**: push `p_search` into the publisher/developer subqueries so trigram indexes on `publishers.name` / `developers.name` can be used.
- **Ratio sorts**: implement server-side computed columns for ratios, or explicitly label them as “sorted within current results” to avoid misleading global ordering.
- **Result count**: display `aggregateStats.total_companies` instead of `initialData.length`.
- **Zero values**: return “0” / “$0” / “0 hrs” instead of `—` for zero values.
- **Review percentage**: change `if (!positive || !total)` to `if (positive == null || total == null || total === 0)` so 0% renders.

### Performance
- **Relationship filter speed**: precompute relationship metrics (self‑published, external partners, latest release date) in a materialized view keyed by publisher/developer and join it in both RPCs.
- **Default list speed**: consider a fast path using ordered metrics tables per company type rather than sorting the UNION result.

## Verification Checklist
- Apply relationship filters and confirm list + aggregate stats match.
- Toggle tag match mode and verify it changes results (or remove the control).
- Apply genre selection + mode from command palette and confirm both persist in the URL.
- Test period filter behavior after implementation (or confirm it is hidden).
- Compare ratio sorts vs. DB‑sorted results for correctness.
- Confirm 0 values render as 0 and review percentage shows 0%.
