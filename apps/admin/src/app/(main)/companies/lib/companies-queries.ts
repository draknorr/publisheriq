import { getSupabase } from '@/lib/supabase';
import type { Company, CompanyType, SortField, SortOrder } from './companies-types';

/**
 * Fetch companies from the database using the unified RPC
 */
export async function getCompanies(params: {
  type: CompanyType;
  sort: SortField;
  order: SortOrder;
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<Company[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc('get_companies_with_filters', {
    p_type: params.type,
    p_sort_by: params.sort,
    p_sort_order: params.order,
    p_limit: params.limit ?? 50,
    p_offset: params.offset ?? 0,
    p_search: params.search,
  });

  if (error) {
    console.error('Error fetching companies:', error);
    throw new Error(`Failed to fetch companies: ${error.message}`);
  }

  return (data ?? []) as Company[];
}

/**
 * Format large numbers compactly (e.g., 1.2M, 5.6K)
 */
export function formatCompactNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || n === 0) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * Format revenue in cents to USD string (e.g., $1.2M)
 */
export function formatRevenue(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || cents === 0) return '—';
  const usd = cents / 100;
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${usd.toLocaleString()}`;
}

/**
 * Format hours (e.g., 15.2M hrs)
 */
export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || hours === 0) return '—';
  if (hours >= 1_000_000) return `${(hours / 1_000_000).toFixed(1)}M hrs`;
  if (hours >= 1_000) return `${(hours / 1_000).toFixed(1)}K hrs`;
  return `${hours.toLocaleString()} hrs`;
}

/**
 * Calculate review percentage
 */
export function getReviewPercentage(
  positive: number | null | undefined,
  total: number | null | undefined
): number | null {
  if (!positive || !total || total === 0) return null;
  return Math.round((positive / total) * 100);
}
