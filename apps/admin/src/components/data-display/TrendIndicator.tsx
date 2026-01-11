import { ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown, Check, X, HelpCircle, Circle } from 'lucide-react';

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
  // Fallback to 'dormant' for unexpected values
  const validTier = tier in tierConfig ? tier : 'dormant';
  const config = tierConfig[validTier];

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

// Steam Deck compatibility badge
type SteamDeckCategory = 'verified' | 'playable' | 'unsupported' | 'unknown';

interface SteamDeckBadgeProps {
  category: SteamDeckCategory;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

const steamDeckConfig: Record<SteamDeckCategory, {
  label: string;
  icon: typeof Check;
  color: string;
  bg: string;
}> = {
  verified: { label: 'Verified', icon: Check, color: 'text-accent-green', bg: 'bg-accent-green/15' },
  playable: { label: 'Playable', icon: Circle, color: 'text-accent-yellow', bg: 'bg-accent-yellow/15' },
  unsupported: { label: 'Unsupported', icon: X, color: 'text-accent-red', bg: 'bg-accent-red/15' },
  unknown: { label: 'Unknown', icon: HelpCircle, color: 'text-text-muted', bg: 'bg-surface-overlay' },
};

export function SteamDeckBadge({
  category,
  size = 'md',
  showLabel = false,
  className = ''
}: SteamDeckBadgeProps) {
  // Fallback to 'unknown' for unexpected values
  const validCategory = category in steamDeckConfig ? category : 'unknown';
  const config = steamDeckConfig[validCategory];
  const Icon = config.icon;

  const sizeConfig = {
    sm: { icon: 'h-3.5 w-3.5', padding: 'p-0.5', text: 'text-caption' },
    md: { icon: 'h-4 w-4', padding: 'px-1.5 py-0.5', text: 'text-body-sm' },
  };

  const sizeClass = sizeConfig[size];

  if (!showLabel) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded ${config.bg} ${config.color} ${sizeClass.padding} ${className}`}
        title={`Steam Deck: ${config.label}`}
      >
        <Icon className={sizeClass.icon} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${config.bg} ${config.color} ${sizeClass.text} font-medium ${className}`}
    >
      <Icon className={sizeClass.icon} />
      {config.label}
    </span>
  );
}

// Platform icons component (Windows, Mac, Linux)
interface PlatformIconsProps {
  platforms: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

export function PlatformIcons({ platforms, size = 'sm', className = '' }: PlatformIconsProps) {
  if (!platforms) return null;

  const platformList = platforms.toLowerCase().split(',').map(p => p.trim());
  const hasWindows = platformList.includes('windows');
  const hasMac = platformList.includes('mac') || platformList.includes('macos');
  const hasLinux = platformList.includes('linux');

  if (!hasWindows && !hasMac && !hasLinux) return null;

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {hasWindows && (
        <span className={`${iconSize} text-text-secondary`} title="Windows">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
            <path d="M3 12V6.75l6-1v6.25H3zm7-7.25L21 3v9h-11V4.75zM3 13h6v6.25l-6-1V13zm7 .25V21l11-1.75v-6H10z"/>
          </svg>
        </span>
      )}
      {hasMac && (
        <span className={`${iconSize} text-text-secondary`} title="macOS">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
        </span>
      )}
      {hasLinux && (
        <span className={`${iconSize} text-text-secondary`} title="Linux">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
            <path d="M12.5 2c-1.93 0-3.5 2.24-3.5 5 0 1.65.55 3.12 1.4 4.08-.76.84-1.26 1.73-1.26 2.42 0 1.1.9 2 2 2h.22c.29 0 .56-.11.78-.29V18c0 1.1.9 2 2 2s2-.9 2-2v-2.79c.22.18.49.29.78.29h.22c1.1 0 2-.9 2-2 0-.69-.5-1.58-1.26-2.42.85-.96 1.4-2.43 1.4-4.08 0-2.76-1.57-5-3.5-5s-3.5 2.24-3.5 5c0 .27.02.53.06.79-.04.07-.06.14-.06.21 0 .55.45 1 1 1s1-.45 1-1c0-.07-.02-.14-.06-.21.04-.26.06-.52.06-.79 0-1.65.78-3 1.5-3s1.5 1.35 1.5 3c0 1.24-.47 2.32-1.11 3.01-.14.15-.22.35-.22.56 0 .24.1.47.28.63.65.58 1.05 1.19 1.05 1.6 0 .28-.22.5-.5.5h-.22a.5.5 0 0 1-.5-.5v-1c0-.55-.45-1-1-1s-1 .45-1 1v5c0 .55-.45 1-1 1s-1-.45-1-1v-5c0-.55-.45-1-1-1s-1 .45-1 1v1a.5.5 0 0 1-.5.5h-.22c-.28 0-.5-.22-.5-.5 0-.41.4-1.02 1.05-1.6.18-.16.28-.39.28-.63 0-.21-.08-.41-.22-.56-.64-.69-1.11-1.77-1.11-3.01z"/>
          </svg>
        </span>
      )}
    </div>
  );
}

// Velocity tier badge
type VelocityTier = 'high' | 'medium' | 'low' | 'dormant';

interface VelocityTierBadgeProps {
  tier: VelocityTier;
  className?: string;
}

const velocityTierConfig: Record<VelocityTier, {
  label: string;
  description: string;
  color: string;
  bg: string;
}> = {
  high: { label: 'High', description: '5+ reviews/day', color: 'text-accent-green', bg: 'bg-accent-green/15' },
  medium: { label: 'Medium', description: '1-5 reviews/day', color: 'text-accent-blue', bg: 'bg-accent-blue/15' },
  low: { label: 'Low', description: '0.1-1 reviews/day', color: 'text-accent-yellow', bg: 'bg-accent-yellow/15' },
  dormant: { label: 'Dormant', description: '<0.1 reviews/day', color: 'text-text-muted', bg: 'bg-surface-overlay' },
};

export function VelocityTierBadge({ tier, className = '' }: VelocityTierBadgeProps) {
  // Fallback to 'dormant' for unexpected values
  const validTier = tier in velocityTierConfig ? tier : 'dormant';
  const config = velocityTierConfig[validTier];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-caption font-medium ${config.bg} ${config.color} ${className}`}
      title={config.description}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}

// CCU tier badge
type CCUTier = 'tier1' | 'tier2' | 'tier3';

interface CCUTierBadgeProps {
  tier: CCUTier;
  reason?: string;
  className?: string;
}

const ccuTierConfig: Record<CCUTier, {
  label: string;
  description: string;
  color: string;
  bg: string;
}> = {
  tier1: { label: 'Tier 1', description: 'Top 500 by CCU (hourly)', color: 'text-accent-green', bg: 'bg-accent-green/15' },
  tier2: { label: 'Tier 2', description: 'Top 1000 newest (every 2h)', color: 'text-accent-blue', bg: 'bg-accent-blue/15' },
  tier3: { label: 'Tier 3', description: 'All other games (daily)', color: 'text-text-muted', bg: 'bg-surface-overlay' },
};

export function CCUTierBadge({ tier, reason, className = '' }: CCUTierBadgeProps) {
  // Fallback to 'tier3' for unexpected values
  const validTier = tier in ccuTierConfig ? tier : 'tier3';
  const config = ccuTierConfig[validTier];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-caption font-medium ${config.bg} ${config.color} ${className}`}
      title={reason || config.description}
    >
      {config.label}
    </span>
  );
}

// CCU source badge
interface CCUSourceBadgeProps {
  source: 'steam_api' | 'steamspy' | null;
  className?: string;
}

export function CCUSourceBadge({ source, className = '' }: CCUSourceBadgeProps) {
  if (!source) return null;

  const isExact = source === 'steam_api';
  const label = isExact ? 'Exact' : 'Estimated';
  const color = isExact ? 'text-accent-green' : 'text-accent-yellow';
  const bg = isExact ? 'bg-accent-green/15' : 'bg-accent-yellow/15';

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${bg} ${color} ${className}`}
      title={isExact ? 'From Steam API (exact count)' : 'From SteamSpy (estimated)'}
    >
      {label}
    </span>
  );
}
