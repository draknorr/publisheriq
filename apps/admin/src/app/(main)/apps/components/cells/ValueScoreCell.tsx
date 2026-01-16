/**
 * ValueScoreCell - Display value score (hours of playtime per dollar)
 *
 * Shows "X.X hrs/$" for paid games
 * Shows "Free" for free games
 * Color gradient based on value
 */

interface ValueScoreCellProps {
  value: number | null;
  isFree?: boolean;
}

function getValueConfig(value: number): { colorClass: string } {
  if (value >= 10) {
    return { colorClass: 'text-[#00d084] font-semibold' }; // Excellent value
  }
  if (value >= 5) {
    return { colorClass: 'text-accent-green' }; // Great value
  }
  if (value >= 2) {
    return { colorClass: 'text-lime-400' }; // Good value
  }
  if (value >= 1) {
    return { colorClass: 'text-accent-yellow' }; // Average value
  }
  return { colorClass: 'text-text-tertiary' }; // Below average
}

export function ValueScoreCell({ value, isFree }: ValueScoreCellProps) {
  if (isFree) {
    return <span className="text-accent-green font-medium">Free</span>;
  }

  if (value === null || value === undefined) {
    return <span className="text-text-muted">&mdash;</span>;
  }

  const { colorClass } = getValueConfig(value);

  return (
    <span className={`inline-flex items-center ${colorClass}`}>
      <span>{value.toFixed(1)}</span>
      <span className="text-text-muted ml-0.5 text-caption">hrs/$</span>
    </span>
  );
}
