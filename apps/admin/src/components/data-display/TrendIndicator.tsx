import { ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown } from 'lucide-react';

type TrendDirection = 'up' | 'down' | 'stable';

interface TrendIndicatorProps {
  direction: TrendDirection;
  value?: number;
  showIcon?: boolean;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'badge' | 'icon-only';
  className?: string;
}

export function TrendIndicator({
  direction,
  value,
  showIcon = true,
  showValue = true,
  size = 'md',
  variant = 'default',
  className = '',
}: TrendIndicatorProps) {
  const Icon =
    direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus;

  const colorClass =
    direction === 'up'
      ? 'text-accent-green'
      : direction === 'down'
      ? 'text-accent-red'
      : 'text-text-tertiary';

  const bgColorClass =
    direction === 'up'
      ? 'bg-accent-green/15'
      : direction === 'down'
      ? 'bg-accent-red/15'
      : 'bg-surface-overlay';

  const sizeConfig = {
    sm: { text: 'text-caption', icon: 'h-3 w-3', padding: 'px-1.5 py-0.5' },
    md: { text: 'text-body-sm', icon: 'h-3.5 w-3.5', padding: 'px-2 py-1' },
    lg: { text: 'text-body', icon: 'h-4 w-4', padding: 'px-2.5 py-1' },
  };

  const config = sizeConfig[size];

  if (variant === 'icon-only') {
    return (
      <span className={`inline-flex ${colorClass} ${className}`}>
        <Icon className={config.icon} />
      </span>
    );
  }

  if (variant === 'badge') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded ${bgColorClass} ${colorClass} ${config.text} font-medium ${config.padding} ${className}`}
      >
        {showIcon && <Icon className={config.icon} />}
        {showValue && value !== undefined && (
          <span>{direction === 'stable' ? '0.0' : Math.abs(value).toFixed(1)}%</span>
        )}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${colorClass} ${config.text} ${className}`}
    >
      {showIcon && <Icon className={config.icon} />}
      {showValue && value !== undefined && (
        <span>{direction === 'stable' ? '0.0' : Math.abs(value).toFixed(1)}%</span>
      )}
    </span>
  );
}

// Trend badge with label
interface TrendBadgeProps {
  direction: TrendDirection;
  value?: number;
  label?: string;
  className?: string;
}

export function TrendBadge({
  direction,
  value,
  label,
  className = '',
}: TrendBadgeProps) {
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;

  const colorClass =
    direction === 'up'
      ? 'text-accent-green'
      : direction === 'down'
      ? 'text-accent-red'
      : 'text-text-tertiary';

  const bgColorClass =
    direction === 'up'
      ? 'bg-accent-green/10'
      : direction === 'down'
      ? 'bg-accent-red/10'
      : 'bg-surface-overlay';

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${bgColorClass} ${className}`}
    >
      <Icon className={`h-4 w-4 ${colorClass}`} />
      <div className="flex flex-col">
        {value !== undefined && (
          <span className={`text-body font-medium ${colorClass}`}>
            {direction === 'up' ? '+' : direction === 'down' ? '' : ''}
            {value.toFixed(1)}%
          </span>
        )}
        {label && <span className="text-caption text-text-tertiary">{label}</span>}
      </div>
    </div>
  );
}

// Tier badge for refresh tiers
interface TierBadgeProps {
  tier: 'active' | 'moderate' | 'dormant' | 'dead';
  className?: string;
}

const tierConfig = {
  active: { label: 'Active', color: 'text-accent-green', bg: 'bg-accent-green/15' },
  moderate: { label: 'Moderate', color: 'text-accent-yellow', bg: 'bg-accent-yellow/15' },
  dormant: { label: 'Dormant', color: 'text-accent-orange', bg: 'bg-accent-orange/15' },
  dead: { label: 'Dead', color: 'text-accent-red', bg: 'bg-accent-red/15' },
};

export function TierBadge({ tier, className = '' }: TierBadgeProps) {
  const config = tierConfig[tier];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-caption font-medium ${config.bg} ${config.color} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}

// Type badge for app types
interface TypeBadgeProps {
  type: 'game' | 'dlc' | 'demo' | 'mod' | 'video';
  className?: string;
}

const typeConfig = {
  game: { label: 'Game', color: 'text-accent-purple', bg: 'bg-accent-purple/15' },
  dlc: { label: 'DLC', color: 'text-accent-blue', bg: 'bg-accent-blue/15' },
  demo: { label: 'Demo', color: 'text-accent-cyan', bg: 'bg-accent-cyan/15' },
  mod: { label: 'Mod', color: 'text-accent-orange', bg: 'bg-accent-orange/15' },
  video: { label: 'Video', color: 'text-accent-pink', bg: 'bg-accent-pink/15' },
};

export function TypeBadge({ type, className = '' }: TypeBadgeProps) {
  const config = typeConfig[type] || typeConfig.game;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-caption font-medium ${config.bg} ${config.color} ${className}`}
    >
      {config.label}
    </span>
  );
}

// Review score badge
interface ReviewScoreBadgeProps {
  score: number;
  description?: string;
  showScore?: boolean;
  className?: string;
}

export function ReviewScoreBadge({
  score,
  description,
  showScore = true,
  className = '',
}: ReviewScoreBadgeProps) {
  let colorClass: string;
  let bgClass: string;

  if (score >= 95) {
    colorClass = 'text-accent-green';
    bgClass = 'bg-accent-green/15';
  } else if (score >= 80) {
    colorClass = 'text-accent-green';
    bgClass = 'bg-accent-green/10';
  } else if (score >= 70) {
    colorClass = 'text-lime-400';
    bgClass = 'bg-lime-400/10';
  } else if (score >= 50) {
    colorClass = 'text-accent-yellow';
    bgClass = 'bg-accent-yellow/10';
  } else if (score >= 30) {
    colorClass = 'text-accent-orange';
    bgClass = 'bg-accent-orange/10';
  } else {
    colorClass = 'text-accent-red';
    bgClass = 'bg-accent-red/10';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-caption font-medium ${bgClass} ${colorClass} ${className}`}
    >
      {showScore && <span>{score}%</span>}
      {description && <span>{description}</span>}
    </span>
  );
}
