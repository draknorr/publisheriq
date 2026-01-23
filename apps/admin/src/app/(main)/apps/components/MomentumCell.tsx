/**
 * MomentumCell - Color-coded momentum score display
 *
 * Momentum = (CCU Growth 7d + Velocity Acceleration) / 2
 *
 * Thresholds from spec:
 * >= 20: double rocket + bright green (explosive momentum)
 * 10-19: rocket + green (strong momentum)
 * 0-9: up-right arrow + light green (positive trajectory)
 * -9 to 0: right arrow + gray (flat momentum)
 * -19 to -10: down-right arrow + orange (declining momentum)
 * <= -20: chart down + red (severe decline)
 */

interface MomentumCellProps {
  value: number | null;
  showEmoji?: boolean;
}

interface MomentumConfig {
  icon: string;
  colorClass: string;
  prefix: string;
}

function getMomentumConfig(value: number): MomentumConfig {
  if (value >= 20) {
    return {
      icon: '\u{1F680}\u{1F680}', // double rocket emoji
      colorClass: 'text-semantic-success font-semibold',
      prefix: '+',
    };
  }
  if (value >= 10) {
    return {
      icon: '\u{1F680}', // rocket emoji
      colorClass: 'text-trend-positive',
      prefix: '+',
    };
  }
  if (value >= 0) {
    return {
      icon: '\u2197', // up-right arrow
      colorClass: 'text-semantic-success/70',
      prefix: '+',
    };
  }
  if (value > -10) {
    return {
      icon: '\u2192', // right arrow
      colorClass: 'text-text-tertiary',
      prefix: '',
    };
  }
  if (value > -20) {
    return {
      icon: '\u2198', // down-right arrow
      colorClass: 'text-semantic-warning',
      prefix: '',
    };
  }
  return {
    icon: '\u{1F4C9}', // chart down emoji
    colorClass: 'text-trend-negative font-semibold',
    prefix: '',
  };
}

export function MomentumCell({ value, showEmoji = true }: MomentumCellProps) {
  if (value === null || value === undefined) {
    return <span className="text-text-muted">&mdash;</span>;
  }

  // Momentum > 500 implies CCU growth > 1000% (from near-zero baseline) - show "NEW" instead
  if (value > 500) {
    return (
      <span className="inline-flex items-center gap-1 text-semantic-info font-semibold">
        {showEmoji && <span>🆕</span>}
        <span>NEW</span>
      </span>
    );
  }

  const { icon, colorClass, prefix } = getMomentumConfig(value);
  const formattedValue = `${prefix}${Math.abs(value).toFixed(1)}`;

  return (
    <span className={`inline-flex items-center gap-1 ${colorClass}`}>
      {showEmoji && <span>{icon}</span>}
      <span>{formattedValue}</span>
    </span>
  );
}
