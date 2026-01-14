/**
 * TypeScript types for the Companies page
 */

export type CompanyType = 'all' | 'publisher' | 'developer';

export type SortField =
  | 'name'
  | 'estimated_weekly_hours'
  | 'game_count'
  | 'total_owners'
  | 'total_ccu'
  | 'avg_review_score'
  | 'total_reviews'
  | 'revenue_estimate_cents'
  | 'games_trending_up'
  | 'ccu_growth_7d';

export type SortOrder = 'asc' | 'desc';

/**
 * Company data returned from get_companies_with_filters RPC
 */
export interface Company {
  id: number;
  name: string;
  type: 'publisher' | 'developer';
  game_count: number;
  total_owners: number;
  total_ccu: number;
  estimated_weekly_hours: number;
  total_reviews: number;
  positive_reviews: number;
  avg_review_score: number | null;
  revenue_estimate_cents: number;
  games_trending_up: number;
  games_trending_down: number;
  // Growth metrics (NULL in fast path, computed in slow path)
  ccu_growth_7d_percent: number | null;
  ccu_growth_30d_percent: number | null;
  review_velocity_7d: number | null;
  review_velocity_30d: number | null;
  // Relationship flags (NULL in fast path)
  is_self_published: boolean | null;
  works_with_external_devs: boolean | null;
  external_partner_count: number | null;
  // Timeline
  first_release_date: string | null;
  latest_release_date: string | null;
  years_active: number | null;
  // Metadata
  steam_vanity_url: string | null;
  unique_developers: number;
  data_updated_at: string | null;
}

/**
 * Filter parameters for the Companies page
 */
export interface CompaniesFilterParams {
  type: CompanyType;
  sort: SortField;
  order: SortOrder;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Search params shape from URL
 */
export interface CompaniesSearchParams {
  type?: string;
  sort?: string;
  order?: string;
}
