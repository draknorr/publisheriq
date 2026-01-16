'use client';

import type { CcuTier } from '../../lib/apps-types';

interface ActivityFiltersProps {
  ccuTier: CcuTier | undefined;
  onCcuTierChange: (tier: CcuTier | undefined) => void;
  disabled?: boolean;
}

const CCU_TIER_OPTIONS: { value: CcuTier | undefined; label: string; description: string }[] = [
  { value: undefined, label: 'Any', description: 'All tiers' },
  { value: 1, label: 'Tier 1: Hot', description: 'Top 500 by CCU' },
  { value: 2, label: 'Tier 2: Active', description: 'Top 1000 new releases' },
  { value: 3, label: 'Tier 3: Quiet', description: 'All other games' },
];

/**
 * Activity filters: CCU Tier
 * Note: Velocity tier is already in SentimentFilters
 */
export function ActivityFilters({
  ccuTier,
  onCcuTierChange,
  disabled = false,
}: ActivityFiltersProps) {
  return (
    <div className="space-y-2">
      <label className="text-body-sm font-medium text-text-secondary">CCU Tier</label>
      <div className="flex flex-wrap gap-2">
        {CCU_TIER_OPTIONS.map(({ value, label, description }) => (
          <button
            key={label}
            type="button"
            onClick={() => onCcuTierChange(value)}
            disabled={disabled}
            title={description}
            className={`px-3 py-1.5 rounded-md text-body-sm transition-colors ${
              ccuTier === value
                ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                : 'bg-surface-elevated text-text-secondary border border-border-muted hover:border-border-prominent'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-caption text-text-muted">
        Tier 1 = highest CCU games (hourly polling), Tier 2 = new releases, Tier 3 = all others
      </p>
    </div>
  );
}
