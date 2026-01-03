interface MiniProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'default' | 'success' | 'warning' | 'info';
  className?: string;
}

const sizeStyles = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2',
};

const variantStyles = {
  default: 'bg-accent-primary',
  success: 'bg-accent-green',
  warning: 'bg-accent-yellow',
  info: 'bg-accent-cyan',
};

export function MiniProgressBar({
  value,
  max = 100,
  label,
  showPercentage = true,
  size = 'sm',
  variant = 'default',
  className = '',
}: MiniProgressBarProps) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  // Auto-determine variant based on percentage if using default
  const effectiveVariant =
    variant === 'default'
      ? percentage >= 90
        ? 'success'
        : percentage >= 50
        ? 'default'
        : 'warning'
      : variant;

  return (
    <div className={className}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-1">
          {label && (
            <span className="text-caption text-text-tertiary">{label}</span>
          )}
          {showPercentage && (
            <span className="text-caption font-medium text-text-secondary">
              {percentage.toFixed(1)}%
            </span>
          )}
        </div>
      )}
      <div className={`w-full ${sizeStyles[size]} rounded-full bg-surface-overlay overflow-hidden`}>
        <div
          className={`h-full ${variantStyles[effectiveVariant]} transition-all duration-300`}
          style={{ width: `${Math.max(percentage, 0.5)}%` }}
        />
      </div>
    </div>
  );
}

// Compact source card for data completion
interface SourceCompletionCardProps {
  source: string;
  icon: string;
  synced: number;
  total: number;
  lastSync?: string;
  className?: string;
}

export function SourceCompletionCard({
  source,
  icon,
  synced,
  total,
  lastSync,
  className = '',
}: SourceCompletionCardProps) {
  const percentage = total > 0 ? (synced / total) * 100 : 0;
  const remaining = total - synced;

  return (
    <div
      className={`p-2 rounded-md border border-border-subtle bg-surface-raised ${className}`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-sm">{icon}</span>
        <span className="text-body-sm font-medium text-text-primary truncate">
          {source}
        </span>
      </div>
      <MiniProgressBar value={percentage} size="xs" showPercentage={false} />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-caption text-accent-green">
          {synced.toLocaleString()}
        </span>
        <span className="text-caption text-text-muted">
          {remaining > 0 ? `${remaining.toLocaleString()} left` : 'Complete'}
        </span>
      </div>
      {lastSync && (
        <div className="mt-1 text-caption-sm text-text-muted truncate">
          {lastSync}
        </div>
      )}
    </div>
  );
}
