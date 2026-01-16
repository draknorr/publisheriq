/**
 * CCUTierCell - Display CCU tier badge
 *
 * Wrapper for numeric CCU tier (1, 2, 3) converting to badge display
 * Tier 1 = Hot (green)
 * Tier 2 = Active (blue)
 * Tier 3 = Quiet (gray)
 */

import type { CcuTier } from '../../lib/apps-types';

interface CCUTierCellProps {
  tier: CcuTier | null;
}

const tierConfig: Record<CcuTier, { label: string; colorClass: string; bgClass: string }> = {
  1: { label: 'Hot', colorClass: 'text-accent-green', bgClass: 'bg-accent-green/15' },
  2: { label: 'Active', colorClass: 'text-accent-blue', bgClass: 'bg-accent-blue/15' },
  3: { label: 'Quiet', colorClass: 'text-text-muted', bgClass: 'bg-surface-overlay' },
};

export function CCUTierCell({ tier }: CCUTierCellProps) {
  if (tier === null || tier === undefined) {
    return <span className="text-text-muted">&mdash;</span>;
  }

  const config = tierConfig[tier];
  if (!config) {
    return <span className="text-text-muted">&mdash;</span>;
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-caption font-medium ${config.bgClass} ${config.colorClass}`}
    >
      {config.label}
    </span>
  );
}
