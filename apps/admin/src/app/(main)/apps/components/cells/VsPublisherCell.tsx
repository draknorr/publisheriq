/**
 * VsPublisherCell - Display review score delta vs publisher average
 *
 * Shows "+X" in green for above average
 * Shows "-X" in red for below average
 * Shows "0" in gray for average
 */

interface VsPublisherCellProps {
  value: number | null;
}

export function VsPublisherCell({ value }: VsPublisherCellProps) {
  if (value === null || value === undefined) {
    return <span className="text-text-muted">&mdash;</span>;
  }

  const rounded = Math.round(value);

  if (rounded > 0) {
    return (
      <span className="text-accent-green font-medium">
        +{rounded}
      </span>
    );
  }

  if (rounded < 0) {
    return (
      <span className="text-accent-red font-medium">
        {rounded}
      </span>
    );
  }

  return <span className="text-text-tertiary">0</span>;
}
