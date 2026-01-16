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
 * Empty state component shown when no games match the current filters.
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

  if (hasPreset === 'breakout_hits') {
    suggestions.push('Remove the "Breakout Hits" preset (very restrictive - requires 50%+ growth)');
  } else if (hasPreset === 'true_gems') {
    suggestions.push('Remove the "True Gems" preset (requires 90%+ score with <50K owners)');
  } else if (hasPreset === 'comeback_stories') {
    suggestions.push('Remove the "Comeback Stories" preset (requires improving sentiment)');
  } else if (hasPreset === 'publishers_best') {
    suggestions.push('Remove the "Publisher\'s Best" preset (requires +10% vs publisher avg)');
  } else if (hasPreset) {
    suggestions.push('Try a different preset view');
  }

  if (hasSearch) {
    suggestions.push('Check your search query for typos');
    suggestions.push('Try a shorter or more general search term');
  }

  if (hasFilters) {
    suggestions.push('Expand the metric ranges (CCU, owners, reviews)');
    suggestions.push('Try a different time period or release year');
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
        No games match your filters
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
            label="Top Games"
            href="/apps?preset=top_games"
          />
          <QuickPresetButton
            icon={<Sparkles className="w-3.5 h-3.5" />}
            label="Rising Stars"
            href="/apps?preset=rising_stars"
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
