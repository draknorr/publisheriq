'use client';

import type { Company } from '../lib/companies-types';

interface DataFreshnessFooterProps {
  companies: Company[];
  resultCount: number;
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

function getFreshnessIcon(dateString: string | null): string {
  if (!dateString) return '\u26A0\uFE0F'; // warning
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return '\u26A1'; // lightning
  if (diffHours < 24) return '\uD83D\uDCC5'; // calendar
  return '\u26A0\uFE0F'; // warning
}

function getFreshnessClass(dateString: string | null): string {
  if (!dateString) return 'text-accent-orange';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'text-accent-green';
  if (diffHours < 24) return 'text-text-tertiary';
  return 'text-accent-orange';
}

export function DataFreshnessFooter({
  companies,
  resultCount,
}: DataFreshnessFooterProps) {
  // Find most recent data_updated_at
  const timestamps = companies
    .map((c) => c.data_updated_at)
    .filter((t): t is string => t !== null)
    .map((t) => new Date(t).getTime());

  const mostRecent =
    timestamps.length > 0
      ? new Date(Math.max(...timestamps)).toISOString()
      : null;

  return (
    <div className="flex items-center justify-between mt-4 text-caption text-text-tertiary">
      <span>Showing {resultCount} companies</span>
      <span className={getFreshnessClass(mostRecent)}>
        {getFreshnessIcon(mostRecent)} Data updated:{' '}
        {formatRelativeTime(mostRecent)}
      </span>
    </div>
  );
}
