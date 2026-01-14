'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ReviewScoreBadge } from '@/components/data-display/TrendIndicator';
import { GrowthCell } from './GrowthCell';
import { MethodologyTooltip } from './MethodologyTooltip';
import {
  formatCompactNumber,
  formatRevenue,
  formatHours,
  getReviewPercentage,
} from '../lib/companies-queries';
import type { Company, SortField, SortOrder } from '../lib/companies-types';

interface CompaniesTableProps {
  companies: Company[];
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
}

interface SortHeaderProps {
  field: SortField;
  label: string;
  currentSort: SortField;
  currentOrder: SortOrder;
  onSort: (field: SortField) => void;
  tooltipField?: string;
  className?: string;
}

function SortHeader({
  field,
  label,
  currentSort,
  currentOrder,
  onSort,
  tooltipField,
  className = '',
}: SortHeaderProps) {
  const isActive = currentSort === field;
  const arrow = isActive ? (currentOrder === 'asc' ? ' \u2191' : ' \u2193') : '';

  return (
    <th
      className={`px-3 py-2 text-left text-caption font-medium text-text-tertiary whitespace-nowrap ${className}`}
    >
      <button
        onClick={() => onSort(field)}
        className={`hover:text-text-primary transition-colors ${
          isActive ? 'text-accent-blue' : ''
        }`}
      >
        {label}
        {arrow}
      </button>
      {tooltipField && <MethodologyTooltip field={tooltipField} />}
    </th>
  );
}

function RoleBadge({ type }: { type: 'publisher' | 'developer' }) {
  return (
    <Badge
      variant={type === 'publisher' ? 'primary' : 'purple'}
      size="sm"
    >
      {type === 'publisher' ? 'Pub' : 'Dev'}
    </Badge>
  );
}

function TrendingCell({
  up,
  down,
}: {
  up: number | null;
  down: number | null;
}) {
  const upVal = up ?? 0;
  const downVal = down ?? 0;

  if (upVal === 0 && downVal === 0) {
    return <span className="text-text-muted">&mdash;</span>;
  }

  return (
    <span className="inline-flex items-center gap-2 text-body-sm">
      {upVal > 0 && (
        <span className="text-accent-green">
          \u2191{upVal}
        </span>
      )}
      {downVal > 0 && (
        <span className="text-accent-red">
          \u2193{downVal}
        </span>
      )}
    </span>
  );
}

export function CompaniesTable({
  companies,
  sortField,
  sortOrder,
  onSort,
}: CompaniesTableProps) {
  if (companies.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-text-secondary">No companies found</p>
      </Card>
    );
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-2">
        {companies.map((company, index) => (
          <Link
            key={`${company.type}-${company.id}`}
            href={`/${company.type}s/${company.id}`}
          >
            <Card variant="interactive" padding="sm">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-text-muted text-caption">
                    #{index + 1}
                  </span>
                  <span className="text-body font-medium text-text-primary">
                    {company.name}
                  </span>
                </div>
                <RoleBadge type={company.type} />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-body-sm">
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Weekly Hours</span>
                  <span className="text-text-secondary">
                    {formatHours(company.estimated_weekly_hours)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Games</span>
                  <span className="text-text-secondary">
                    {company.game_count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Owners</span>
                  <span className="text-text-secondary">
                    {formatCompactNumber(company.total_owners)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Revenue</span>
                  <span className="text-text-secondary">
                    {formatRevenue(company.revenue_estimate_cents)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Growth (7d)</span>
                  <GrowthCell value={company.ccu_growth_7d_percent} />
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Reviews</span>
                  <span className="text-text-secondary">
                    {formatCompactNumber(company.total_reviews)}
                    {company.avg_review_score !== null && (
                      <span className="text-text-muted ml-1">
                        ({company.avg_review_score}%)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto scrollbar-thin rounded-lg border border-border-subtle">
        <table className="w-full">
          <thead className="bg-surface-elevated sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-caption font-medium text-text-tertiary w-12">
                #
              </th>
              <SortHeader
                field="name"
                label="Company"
                currentSort={sortField}
                currentOrder={sortOrder}
                onSort={onSort}
                className="min-w-[200px]"
              />
              <th className="px-3 py-2 text-left text-caption font-medium text-text-tertiary">
                Role
              </th>
              <SortHeader
                field="estimated_weekly_hours"
                label="Est. Weekly Hours"
                currentSort={sortField}
                currentOrder={sortOrder}
                onSort={onSort}
                tooltipField="estimated_weekly_hours"
              />
              <SortHeader
                field="game_count"
                label="Games"
                currentSort={sortField}
                currentOrder={sortOrder}
                onSort={onSort}
                tooltipField="game_count"
              />
              <SortHeader
                field="total_owners"
                label="Total Owners"
                currentSort={sortField}
                currentOrder={sortOrder}
                onSort={onSort}
                tooltipField="total_owners"
              />
              <SortHeader
                field="total_ccu"
                label="Peak CCU"
                currentSort={sortField}
                currentOrder={sortOrder}
                onSort={onSort}
                tooltipField="total_ccu"
              />
              <SortHeader
                field="total_reviews"
                label="Reviews"
                currentSort={sortField}
                currentOrder={sortOrder}
                onSort={onSort}
                tooltipField="total_reviews"
              />
              <SortHeader
                field="revenue_estimate_cents"
                label="Est. Revenue"
                currentSort={sortField}
                currentOrder={sortOrder}
                onSort={onSort}
                tooltipField="revenue_estimate_cents"
              />
              <SortHeader
                field="ccu_growth_7d"
                label="CCU Growth (7d)"
                currentSort={sortField}
                currentOrder={sortOrder}
                onSort={onSort}
                tooltipField="ccu_growth_7d_percent"
              />
              <SortHeader
                field="games_trending_up"
                label="Trending"
                currentSort={sortField}
                currentOrder={sortOrder}
                onSort={onSort}
                tooltipField="games_trending_up"
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {companies.map((company, index) => {
              const reviewPct = getReviewPercentage(
                company.positive_reviews,
                company.total_reviews
              );
              return (
                <tr
                  key={`${company.type}-${company.id}`}
                  className="hover:bg-surface-overlay transition-colors"
                >
                  <td className="px-3 py-2 text-caption text-text-muted">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/${company.type}s/${company.id}`}
                      className="text-body font-medium text-text-primary hover:text-accent-blue transition-colors"
                    >
                      {company.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <RoleBadge type={company.type} />
                  </td>
                  <td className="px-3 py-2 text-body-sm text-text-secondary">
                    {formatHours(company.estimated_weekly_hours)}
                  </td>
                  <td className="px-3 py-2 text-body-sm text-text-secondary">
                    {company.game_count}
                  </td>
                  <td className="px-3 py-2 text-body-sm text-text-secondary">
                    {formatCompactNumber(company.total_owners)}
                  </td>
                  <td className="px-3 py-2 text-body-sm text-text-secondary">
                    {formatCompactNumber(company.total_ccu)}
                  </td>
                  <td className="px-3 py-2 text-body-sm text-text-secondary">
                    <span>{formatCompactNumber(company.total_reviews)}</span>
                    {reviewPct !== null && (
                      <span className="ml-1">
                        <ReviewScoreBadge score={reviewPct} />
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-body-sm text-text-secondary">
                    {formatRevenue(company.revenue_estimate_cents)}
                  </td>
                  <td className="px-3 py-2 text-body-sm">
                    <GrowthCell value={company.ccu_growth_7d_percent} />
                  </td>
                  <td className="px-3 py-2 text-body-sm">
                    <TrendingCell
                      up={company.games_trending_up}
                      down={company.games_trending_down}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Result count footer */}
      <div className="mt-4 text-center text-caption text-text-tertiary">
        Showing {companies.length} companies
      </div>
    </>
  );
}
