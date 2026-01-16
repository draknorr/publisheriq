'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { ReviewScoreBadge } from '@/components/data-display/TrendIndicator';
import { GrowthCell } from './GrowthCell';
import { MomentumCell } from './MomentumCell';
import { MethodologyTooltip } from './MethodologyTooltip';
import {
  APP_COLUMN_DEFINITIONS,
  DEFAULT_APP_COLUMNS,
  type AppColumnId,
} from '../lib/apps-columns';
import { formatCompactNumber, formatPrice } from '../lib/apps-queries';
import type { App, SortField, SortOrder } from '../lib/apps-types';

interface AppsTableProps {
  apps: App[];
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  visibleColumns?: AppColumnId[];
  isLoading?: boolean;
}

interface SortHeaderProps {
  field: SortField | null;
  label: string;
  currentSort: SortField;
  currentOrder: SortOrder;
  onSort: (field: SortField) => void;
  tooltipField?: string;
  className?: string;
  isDisabled?: boolean;
}

function SortHeader({
  field,
  label,
  currentSort,
  currentOrder,
  onSort,
  tooltipField,
  className = '',
  isDisabled = false,
}: SortHeaderProps) {
  const isActive = field !== null && currentSort === field;
  const arrow = isActive ? (currentOrder === 'asc' ? ' \u2191' : ' \u2193') : '';

  const handleClick = () => {
    if (!isDisabled && field) {
      onSort(field);
    }
  };

  return (
    <th
      className={`px-3 py-2 text-left text-caption font-medium text-text-tertiary whitespace-nowrap ${className}`}
    >
      <button
        onClick={handleClick}
        className={`hover:text-text-primary transition-colors ${
          isActive ? 'text-accent-blue' : ''
        } ${isDisabled ? 'cursor-default hover:text-text-tertiary' : ''}`}
        disabled={isDisabled}
        title={isDisabled ? 'This column cannot be sorted' : undefined}
      >
        {label}
        {arrow}
      </button>
      {tooltipField && <MethodologyTooltip field={tooltipField} />}
    </th>
  );
}

/**
 * Format a date string to a readable format
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '\u2014';
  }
}

/**
 * Discount badge for price display
 */
function DiscountBadge({ percent }: { percent: number }) {
  if (percent <= 0) return null;
  return (
    <span className="ml-1 px-1 py-0.5 text-[10px] font-medium bg-accent-green/20 text-accent-green rounded">
      -{percent}%
    </span>
  );
}

/**
 * Mobile card view for a single app
 */
function MobileAppCard({ app, rank }: { app: App; rank: number }) {
  return (
    <Link href={`/apps/${app.appid}`}>
      <Card variant="interactive" padding="sm">
        {/* Header: Rank + Name */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-text-muted text-caption">#{rank}</span>
          <span className="text-body font-medium text-text-primary truncate">
            {app.name}
          </span>
        </div>

        {/* 2-column metrics grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-body-sm">
          <div className="flex justify-between">
            <span className="text-text-tertiary">Peak CCU</span>
            <span className="text-text-secondary">
              {formatCompactNumber(app.ccu_peak)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Growth 7d</span>
            <GrowthCell value={app.ccu_growth_7d_percent} />
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Momentum</span>
            <MomentumCell value={app.momentum_score} />
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Owners</span>
            <span className="text-text-secondary">
              {formatCompactNumber(app.owners_midpoint)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Reviews</span>
            <span className="text-text-secondary">
              {formatCompactNumber(app.total_reviews)}
              {app.review_score !== null && (
                <span className="ml-1">
                  <ReviewScoreBadge score={app.review_score} />
                </span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Price</span>
            <span className="text-text-secondary">
              {formatPrice(app.price_cents)}
              {app.current_discount_percent > 0 && (
                <DiscountBadge percent={app.current_discount_percent} />
              )}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

/**
 * Render cell content based on column ID
 */
function renderCell(columnId: AppColumnId, app: App, rank: number): React.ReactNode {
  switch (columnId) {
    case 'rank':
      return rank;
    case 'name':
      return (
        <Link
          href={`/apps/${app.appid}`}
          className="text-body font-medium text-text-primary hover:text-accent-blue transition-colors"
        >
          {app.name}
        </Link>
      );
    case 'ccu_peak':
      return formatCompactNumber(app.ccu_peak);
    case 'ccu_growth_7d':
      return <GrowthCell value={app.ccu_growth_7d_percent} />;
    case 'momentum_score':
      return <MomentumCell value={app.momentum_score} />;
    case 'owners':
      return formatCompactNumber(app.owners_midpoint);
    case 'reviews':
      return (
        <>
          <span>{formatCompactNumber(app.total_reviews)}</span>
          {app.review_score !== null && (
            <span className="ml-1">
              <ReviewScoreBadge score={app.review_score} />
            </span>
          )}
        </>
      );
    case 'price':
      return (
        <>
          <span>{formatPrice(app.price_cents)}</span>
          {app.current_discount_percent > 0 && (
            <DiscountBadge percent={app.current_discount_percent} />
          )}
        </>
      );
    case 'release_date':
      return formatDate(app.release_date);
    case 'sparkline':
      // Placeholder per M2b spec - actual sparklines implemented in M5b
      return <span className="text-text-muted">\u2014</span>;
    default:
      return '\u2014';
  }
}

/**
 * Desktop table row for a single app
 */
function AppRow({
  app,
  rank,
  columns,
}: {
  app: App;
  rank: number;
  columns: AppColumnId[];
}) {
  return (
    <tr className="hover:bg-surface-overlay transition-colors">
      {columns.map((columnId) => (
        <td
          key={columnId}
          className={`px-3 py-2 text-body-sm text-text-secondary ${
            columnId === 'name' ? 'min-w-[200px]' : ''
          } ${columnId === 'rank' ? 'text-text-muted w-12' : ''}`}
        >
          {renderCell(columnId, app, rank)}
        </td>
      ))}
    </tr>
  );
}

export function AppsTable({
  apps,
  sortField,
  sortOrder,
  onSort,
  visibleColumns,
  isLoading = false,
}: AppsTableProps) {
  const columns = visibleColumns ?? DEFAULT_APP_COLUMNS;

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-8 h-8 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin mb-4" />
          <p className="text-body text-text-secondary">Loading games...</p>
        </div>
      </Card>
    );
  }

  if (apps.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-text-secondary">No games found</p>
        <p className="text-caption text-text-muted mt-1">
          Try adjusting your filters
        </p>
      </Card>
    );
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="md:hidden space-y-2">
        {apps.map((app, index) => (
          <MobileAppCard key={app.appid} app={app} rank={index + 1} />
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto scrollbar-thin rounded-lg border border-border-subtle">
        <table className="w-full">
          <thead className="bg-surface-elevated sticky top-0 z-10">
            <tr>
              {columns.map((columnId) => {
                const column = APP_COLUMN_DEFINITIONS[columnId];
                if (!column) return null;

                return (
                  <SortHeader
                    key={columnId}
                    field={column.sortField ?? null}
                    label={column.shortLabel || column.label}
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={onSort}
                    tooltipField={column.methodology}
                    isDisabled={!column.sortable}
                    className={columnId === 'name' ? 'min-w-[200px]' : ''}
                  />
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {apps.map((app, index) => (
              <AppRow
                key={app.appid}
                app={app}
                rank={index + 1}
                columns={columns}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
