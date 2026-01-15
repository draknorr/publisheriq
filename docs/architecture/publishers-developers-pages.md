# Publishers & Developers Index Pages Overview

> Current state documentation for `/publishers` and `/developers` index pages in PublisherIQ

---

## File Structure

```
apps/admin/src/app/(main)/
├── publishers/
│   ├── page.tsx              # Main index page (~400 lines)
│   └── error.tsx             # Error boundary
├── developers/
│   ├── page.tsx              # Main index page (~380 lines)
│   └── error.tsx             # Error boundary
```

Both pages are server components using Next.js 15 App Router with `force-dynamic` rendering.

---

## Page Layout (Top to Bottom)

### 1. Page Header
- Title ("Publishers" / "Developers") with result count
- Uses `PageHeader` component from `/components/layout/PageHeader.tsx`

### 2. Stats Cards (3-column grid)
Uses `MetricCard` component with icons:

| Publishers | Developers |
|------------|------------|
| Total publishers (Building2) | Total developers (Users) |
| Major - 10+ games (Layers) | Prolific - 5+ games (Layers) |
| Recently active (TrendingUp) | Recently active (TrendingUp) |

Stats fetched via separate RPC calls: `get_publisher_stats()` / `get_developer_stats()`

### 3. Search Bar
- Text input with magnifying glass icon
- HTML form submission (server-side search)
- ILIKE pattern matching: `%search%`
- Placeholder: "Search publishers/developers by name..."

### 4. Quick Filter Buttons
Toggle-style buttons below search:

**Publishers:** All | Major | Active | 100K+ Owners | 5+ Developers

**Developers:** All | Prolific | Active | 100K+ Owners | 80%+ Reviews

Active buttons show colored backgrounds (purple, green, cyan, orange, yellow).

### 5. Advanced Filters (Collapsible)
Uses `AdvancedFilters` component - collapsed by default with active count badge.

| Filter | Options |
|--------|---------|
| Min Owners | 1K, 10K, 100K, 1M, 10M |
| Min CCU Peak | 100, 1K, 10K, 100K |
| Min Review Score | 50%, 70%, 80%, 90%, 95% |
| Min Games | 2, 5, 10, 25, 50 |
| Min Developers | 2, 5, 10, 25 (publishers only) |
| Activity Status | Active, Dormant |

### 6. Results Display

**Mobile (md:hidden):** Vertical card stack
- Interactive cards linking to detail pages
- 2x2 metric grid per card (Games, Owners, Developers/CCU, Review Score)
- Badges: Major/Prolific, Active tier

**Desktop (hidden md:block):** Horizontal scrollable table

| Publishers Columns | Developers Columns |
|-------------------|-------------------|
| Name (sticky) | Name (sticky) |
| Games (sortable) | Games (sortable) |
| Developers (sortable) | — |
| Owners (range) | Owners (range) |
| Peak CCU | Peak CCU |
| Reviews (badge) | Reviews (badge) |
| Est. Revenue | Est. Revenue |
| Trending | Trending |
| Steam (external link) | Steam (external link) |

### 7. Empty State
Centered card with icon when no results match filters.

### 8. Metadata Footer
Shows when metrics were last updated.

---

## Data Fetching

### Primary: RPC Functions
```sql
get_publishers_with_metrics(p_search, p_min_owners, p_min_ccu, ...)
get_developers_with_metrics(p_search, p_min_owners, p_min_ccu, ...)
```

### Fallback
If RPC fails, falls back to basic Supabase queries with limited filtering.

### Parallel Loading
```typescript
[publishers, stats] = await Promise.all([
  getPublishers({ search, sort, order, filter, ... }),
  getPublisherStats(),
])
```

### Limits
- Max 100 results (no pagination - must filter)
- Shows message when hitting 100 limit

---

## Sorting

### Sortable Fields

**Publishers:**
`name | game_count | first_game_release_date | total_owners_max | total_ccu_peak | weighted_review_score | estimated_revenue_usd | games_trending_up | unique_developers`

**Developers:**
`name | game_count | first_game_release_date | total_owners_max | total_ccu_peak | weighted_review_score | estimated_revenue_usd | games_trending_up`

### Default Sort
`game_count DESC`

### UI
- Clickable column headers with arrow indicators (↑/↓)
- Blue highlight on active sort column
- Preserves other URL params when toggling

---

## URL Parameters

```
?search=Valve              # Text search
&sort=game_count           # Sort field
&order=desc                # Sort direction
&filter=major              # Quick filter (major/prolific/recent)
&minOwners=100000          # Advanced filters
&minCcu=1000
&minScore=80
&minGames=5
&minDevelopers=2           # Publishers only
&status=active             # active/dormant
```

All filters are URL-preserved for bookmarking and sharing.

---

## Visual Components

### Badges

**ReviewScoreBadge** (color-coded):
- 95%+: Green
- 80-94%: Green
- 70-79%: Lime
- 50-69%: Yellow
- 30-49%: Orange
- <30%: Red

**TierBadge:**
- Green dot + "Active" when games_released_last_year > 0

**TrendingBadge:**
- Green chevron up + count when trending up
- Red chevron down + count when trending down

### Number Formatting

| Function | Example Output |
|----------|---------------|
| `formatOwners(min, max)` | "1.5M - 3.2M" |
| `formatCompactNumber(n)` | "500K" |
| `formatRevenue(n)` | "$1.5M" |

---

## Design Patterns

1. **Server-side filtering** - All filtering via database RPC
2. **Mobile-first responsive** - Cards on mobile, tables on desktop
3. **URL-driven state** - All filters in URL params
4. **Fallback pattern** - RPC → basic query fallback
5. **Parallel data loading** - Stats + entities fetched together
6. **Configuration-driven filters** - Filter options defined as config arrays

---

## Key Differences: Publishers vs Developers

| Aspect | Publishers | Developers |
|--------|------------|------------|
| Quick filter label | "Major" (10+ games) | "Prolific" (5+ games) |
| Extra column | Developers count | — |
| Extra filter | Min Developers | — |
| Icon | Building2 | Users |
| RPC function | `get_publishers_with_metrics` | `get_developers_with_metrics` |

---

## Dependencies

- `next/link`, `next/navigation` - Routing
- Lucide icons - Building2, Users, TrendingUp, ChevronUp/Down, ExternalLink
- TailwindCSS - Utility-based styling
- Custom components: Card, MetricCard, PageHeader, AdvancedFilters
