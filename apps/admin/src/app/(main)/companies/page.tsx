import type { Metadata } from 'next';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ConfigurationRequired } from '@/components/ConfigurationRequired';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { CompaniesPageClient } from './components/CompaniesPageClient';
import { getCompanies } from './lib/companies-queries';
import type {
  Company,
  CompanyType,
  SortField,
  SortOrder,
  CompaniesSearchParams,
} from './lib/companies-types';

export const metadata: Metadata = {
  title: 'Companies | PublisherIQ',
  description: 'Browse Steam publishers and developers with unified metrics and analytics.',
};

export const dynamic = 'force-dynamic';

// Valid values for each param
const VALID_TYPES: CompanyType[] = ['all', 'publisher', 'developer'];
const VALID_SORTS: SortField[] = [
  'name',
  'estimated_weekly_hours',
  'game_count',
  'total_owners',
  'total_ccu',
  'avg_review_score',
  'total_reviews',
  'revenue_estimate_cents',
  'games_trending_up',
  'ccu_growth_7d',
];

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<CompaniesSearchParams>;
}) {
  // Check Supabase configuration
  if (!isSupabaseConfigured()) {
    return <ConfigurationRequired />;
  }

  // Parse and validate search params
  const params = await searchParams;

  const type: CompanyType = VALID_TYPES.includes(params.type as CompanyType)
    ? (params.type as CompanyType)
    : 'all';

  const sort: SortField = VALID_SORTS.includes(params.sort as SortField)
    ? (params.sort as SortField)
    : 'estimated_weekly_hours';

  const order: SortOrder = params.order === 'asc' ? 'asc' : 'desc';

  // Fetch companies
  let companies: Company[] = [];
  let fetchError: string | null = null;

  try {
    companies = await getCompanies({
      type,
      sort,
      order,
      limit: 50,
    });
  } catch (error) {
    console.error('Failed to fetch companies:', error);
    fetchError = error instanceof Error ? error.message : 'Unknown error';
    companies = [];
  }

  // Show error state if fetch failed
  if (fetchError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Companies"
          description="Browse Steam publishers and developers"
        />
        <Card className="p-6 border-accent-red/50 bg-accent-red/10">
          <h2 className="text-subheading text-accent-red mb-2">
            Error Loading Companies
          </h2>
          <p className="text-body text-text-secondary mb-4">
            Failed to load company data. Please try again.
          </p>
          <pre className="p-4 bg-surface-raised rounded-lg text-caption text-text-muted overflow-x-auto whitespace-pre-wrap">
            {fetchError}
          </pre>
        </Card>
      </div>
    );
  }

  // Build description with count and type
  const typeLabel =
    type === 'all' ? 'publishers and developers' : `${type}s`;
  const description = `Showing ${companies.length} ${typeLabel}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Companies" description={description} />
      <CompaniesPageClient
        initialData={companies}
        initialType={type}
        initialSort={sort}
        initialOrder={order}
      />
    </div>
  );
}
