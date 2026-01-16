/**
 * ControllerCell - Display controller support badge
 *
 * Shows "Full" in green for full controller support
 * Shows "Partial" in yellow for partial support
 * Shows dash for no controller support
 */

import type { ControllerSupport } from '../../lib/apps-types';

interface ControllerCellProps {
  support: ControllerSupport;
}

const controllerConfig = {
  full: { label: 'Full', colorClass: 'text-accent-green', bgClass: 'bg-accent-green/15' },
  partial: { label: 'Partial', colorClass: 'text-accent-yellow', bgClass: 'bg-accent-yellow/15' },
};

export function ControllerCell({ support }: ControllerCellProps) {
  if (!support) {
    return <span className="text-text-muted">&mdash;</span>;
  }

  const config = controllerConfig[support];
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
