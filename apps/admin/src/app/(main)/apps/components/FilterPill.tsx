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
 * - Inactive preset: Purple tint with dot indicator
 * - Inactive quick filter: Neutral gray
 * - Active (either): Teal accent
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
      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-body-sm',
      'font-medium whitespace-nowrap transition-all duration-150',
      'border focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2',
    ];

    // Disabled state
    if (disabled) {
      base.push('opacity-50 cursor-not-allowed');
    } else {
      base.push('cursor-pointer');
    }

    // Active state (same for both preset and quick)
    if (isActive) {
      base.push('bg-accent-primary/20 text-accent-primary border-accent-primary/40 shadow-sm');
    }
    // Inactive preset state (purple tint)
    else if (isPreset) {
      base.push('bg-accent-purple/5 text-text-secondary border-accent-purple/20');
      if (!disabled) {
        base.push('hover:border-accent-purple/40 hover:bg-accent-purple/10');
      }
    }
    // Inactive quick filter state (neutral)
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
      {emoji && <span className="text-sm">{emoji}</span>}
      <span>{label}</span>
      {/* Dot indicator for inactive presets to distinguish them */}
      {isPreset && !isActive && (
        <span className="w-1.5 h-1.5 rounded-full bg-accent-purple/50 ml-0.5" />
      )}
    </button>
  );
}
