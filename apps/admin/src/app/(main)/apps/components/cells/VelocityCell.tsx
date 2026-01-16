/**
 * VelocityCell - Display review velocity with units
 *
 * Shows "X.X/day" for velocity values
 * Color based on velocity tier thresholds
 */

interface VelocityCellProps {
  value: number | null;
}

function getVelocityConfig(value: number): { colorClass: string } {
  if (value >= 5) {
    return { colorClass: 'text-accent-green font-medium' }; // High
  }
  if (value >= 1) {
    return { colorClass: 'text-accent-blue' }; // Medium
  }
  if (value >= 0.1) {
    return { colorClass: 'text-accent-yellow' }; // Low
  }
  return { colorClass: 'text-text-muted' }; // Dormant
}

export function VelocityCell({ value }: VelocityCellProps) {
  if (value === null || value === undefined) {
    return <span className="text-text-muted">&mdash;</span>;
  }

  const { colorClass } = getVelocityConfig(value);

  return (
    <span className={`inline-flex items-center ${colorClass}`}>
      <span>{value.toFixed(1)}</span>
      <span className="text-text-muted ml-0.5 text-caption">/day</span>
    </span>
  );
}
