/**
 * GrowthCell - Color-coded growth percentage display
 *
 * Thresholds from spec:
 * >= 50%: rocket + bright green
 * 10-49%: up arrow + green
 * -10 to 10%: right arrow + gray
 * -49 to -10%: down arrow + orange
 * <= -50%: chart down + red
 */

interface GrowthCellProps {
  value: number | null;
  showEmoji?: boolean;
}

interface GrowthConfig {
  icon: string;
  colorClass: string;
  prefix: string;
}

function getGrowthConfig(value: number): GrowthConfig {
  if (value >= 50) {
    return {
      icon: '\u{1F680}', // rocket emoji
      colorClass: 'text-semantic-success font-semibold',
      prefix: '+',
    };
  }
  if (value >= 10) {
    return {
      icon: '\u2191', // up arrow
      colorClass: 'text-trend-positive',
      prefix: '+',
    };
  }
  if (value > -10) {
    return {
      icon: '\u2192', // right arrow
      colorClass: 'text-text-tertiary',
      prefix: value > 0 ? '+' : '',
    };
  }
  if (value > -50) {
    return {
      icon: '\u2193', // down arrow
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

export function GrowthCell({ value, showEmoji = true }: GrowthCellProps) {
  if (value === null || value === undefined) {
    return <span className="text-text-muted">&mdash;</span>;
  }

  const { icon, colorClass, prefix } = getGrowthConfig(value);
  const formattedValue = `${prefix}${Math.abs(value).toFixed(1)}%`;

  return (
    <span className={`inline-flex items-center gap-1 ${colorClass}`}>
      {showEmoji && <span>{icon}</span>}
      <span>{formattedValue}</span>
    </span>
  );
}
