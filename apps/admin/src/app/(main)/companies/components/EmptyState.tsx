'use client';

import { Search, FilterX, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface EmptyStateProps {
  hasSearch: boolean;
  hasFilters: boolean;
  hasPreset: string | null;
  onClearFilters: () => void;
}

/**
 * Empty state component shown when no companies match the current filters.
 * Provides contextual suggestions based on which filters are active.
 */
export function EmptyState({
  hasSearch,
  hasFilters,
  hasPreset,
  onClearFilters,
}: EmptyStateProps) {
  // Build contextual suggestions based on active filters
  const suggestions: string[] = [];

  if (hasPreset === 'breakout') {
    suggestions.push('Remove the "Breakout" preset (very restrictive - requires 50%+ growth)');
  } else if (hasPreset) {
    suggestions.push(`Try a different preset view`);
  }

  if (hasSearch) {
    suggestions.push('Check your search query for typos');
  }

  if (hasFilters) {
    suggestions.push('Expand the metric ranges (revenue, CCU, owners)');
    suggestions.push('Try a different time period');
    suggestions.push('Remove some content filters (genres, tags)');
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Icon */}
      <div className="w-16 h-16 rounded-full bg-surface-overlay flex items-center justify-center mb-6">
        <Search className="w-8 h-8 text-text-muted" />
      </div>

      {/* Message */}
      <h3 className="text-heading-md font-semibold text-text-primary mb-2">
        No companies match your filters
      </h3>
      <p className="text-body text-text-secondary text-center max-w-md mb-6">
        Try adjusting your search or filter criteria to find what you&apos;re looking for.
      </p>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mb-8 max-w-md">
          <p className="text-caption font-medium text-text-tertiary uppercase tracking-wide mb-3 text-center">
            Suggestions
          </p>
          <ul className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-body-sm text-text-secondary"
              >
                <span className="text-accent-blue mt-0.5">•</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Clear All Button */}
      <Button
        variant="primary"
        size="md"
        onClick={onClearFilters}
        className="gap-2"
      >
        <FilterX className="w-4 h-4" />
        Clear All Filters
      </Button>

      {/* Quick Access Presets */}
      <div className="mt-8 pt-6 border-t border-border-subtle">
        <p className="text-caption text-text-muted text-center mb-4">
          Or try a preset view
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          <QuickPresetButton
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            label="Market Leaders"
            href="/companies?preset=market_leaders"
          />
          <QuickPresetButton
            icon={<Sparkles className="w-3.5 h-3.5" />}
            label="Rising Indies"
            href="/companies?preset=rising_indies"
          />
        </div>
      </div>
    </div>
  );
}

function QuickPresetButton({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-body-sm text-text-secondary bg-surface-overlay hover:bg-surface-elevated rounded-lg transition-colors"
    >
      {icon}
      {label}
    </a>
  );
}
