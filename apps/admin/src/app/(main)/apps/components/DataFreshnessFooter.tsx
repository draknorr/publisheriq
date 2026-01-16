'use client';

import { Clock, Info } from 'lucide-react';

interface DataFreshnessFooterProps {
  lastUpdated?: string | null; // ISO timestamp
}

/**
 * Footer showing data freshness and methodology link
 */
export function DataFreshnessFooter({ lastUpdated }: DataFreshnessFooterProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-4 text-caption text-text-muted border-t border-border-muted mt-4">
      {/* Data freshness */}
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" />
        <span>Data last synced: {formatRelativeTime(lastUpdated)}</span>
      </div>

      {/* Methodology link */}
      <div className="flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5" />
        <a
          href="/docs/methodology"
          className="hover:text-text-secondary hover:underline transition-colors"
          title="Learn about data sources and calculations"
        >
          Data sources & methodology
        </a>
      </div>
    </div>
  );
}

/**
 * Format ISO timestamp to relative time string
 */
function formatRelativeTime(timestamp?: string | null): string {
  if (!timestamp) return 'Unknown';

  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    // Fallback to formatted date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return 'Unknown';
  }
}
