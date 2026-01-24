'use client';

interface FilterPillProps {
  label: string;
  emoji?: string;
  tooltip?: string;
  isActive: boolean;
  isPreset: boolean;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Reusable pill component for unified filter system.
 *
 * Visual states:
 * - Inactive preset: Card-like with purple left accent bar
 * - Inactive quick filter: Subtle surface
 * - Active (either): Solid coral with shadow
 */
export function FilterPill({
  label,
  emoji,
  tooltip,
  isActive,
  isPreset,
  onClick,
  disabled,
}: FilterPillProps) {
  // Build className based on state
  const getClassName = () => {
    const base = [
      'relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-body-sm',
      'font-medium whitespace-nowrap transition-all duration-150',
      'border focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2',
    ];

    // Disabled state
    if (disabled) {
      base.push('opacity-50 cursor-not-allowed');
    } else {
      base.push('cursor-pointer');
    }

    // Active state (same for both preset and quick) - solid coral with shadow
    if (isActive) {
      base.push(
        'bg-accent-primary text-white border-accent-primary',
        'shadow-[0_2px_8px_rgba(212,113,106,0.3)]'
      );
    }
    // Inactive preset state - card-like with purple accent on hover
    else if (isPreset) {
      base.push('bg-surface-raised text-text-primary border-border-muted shadow-sm');
      if (!disabled) {
        base.push(
          'hover:border-accent-purple/50 hover:shadow-md',
          'hover:bg-gradient-to-r hover:from-accent-purple/5 hover:to-transparent'
        );
      }
    }
    // Inactive quick filter state (subtle surface)
    else {
      base.push('bg-surface-elevated text-text-secondary border-border-subtle');
      if (!disabled) {
        base.push('hover:border-border-prominent hover:bg-surface-overlay');
      }
    }

    return base.join(' ');
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={getClassName()}
      title={tooltip}
    >
      {/* Purple left accent bar for inactive presets */}
      {isPreset && !isActive && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-accent-purple/60"
          aria-hidden="true"
        />
      )}
      {emoji && <span className="text-sm">{emoji}</span>}
      <span>{label}</span>
    </button>
  );
}
