/**
 * AccelerationCell - Display velocity acceleration
 *
 * Shows the change in review velocity (7d vs 30d rate)
 * Positive = velocity increasing, Negative = velocity decreasing
 */

interface AccelerationCellProps {
  value: number | null;
}

function getAccelerationConfig(value: number): { icon: string; colorClass: string; prefix: string } {
  if (value >= 1) {
    return {
      icon: '\u2191', // up arrow
      colorClass: 'text-accent-green',
      prefix: '+',
    };
  }
  if (value > -1) {
    return {
      icon: '\u2192', // right arrow
      colorClass: 'text-text-tertiary',
      prefix: value > 0 ? '+' : '',
    };
  }
  return {
    icon: '\u2193', // down arrow
    colorClass: 'text-accent-orange',
    prefix: '',
  };
}

export function AccelerationCell({ value }: AccelerationCellProps) {
  if (value === null || value === undefined) {
    return <span className="text-text-muted">&mdash;</span>;
  }

  const { icon, colorClass, prefix } = getAccelerationConfig(value);

  return (
    <span className={`inline-flex items-center gap-1 ${colorClass}`}>
      <span>{icon}</span>
      <span>{prefix}{Math.abs(value).toFixed(1)}</span>
    </span>
  );
}
