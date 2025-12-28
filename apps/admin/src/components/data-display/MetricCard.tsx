import { type ReactNode } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Sparkline } from './Sparkline';

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: {
    value: number;
    direction: 'up' | 'down' | 'stable';
    label?: string;
  };
  sparklineData?: number[];
  icon?: ReactNode;
  suffix?: string;
  variant?: 'default' | 'compact';
  className?: string;
}

export function MetricCard({
  label,
  value,
  change,
  sparklineData,
  icon,
  suffix,
  variant = 'default',
  className = '',
}: MetricCardProps) {
  if (variant === 'compact') {
    return (
      <div
        className={`flex items-center justify-between p-3 rounded-lg bg-surface-raised border border-border-subtle ${className}`}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-surface-elevated text-text-tertiary">
              {icon}
            </div>
          )}
          <div>
            <p className="text-caption text-text-tertiary">{label}</p>
            <p className="text-body font-medium text-text-primary">
              {typeof value === 'number' ? value.toLocaleString() : value}
              {suffix && <span className="text-text-tertiary ml-1">{suffix}</span>}
            </p>
          </div>
        </div>
        {change && <ChangeIndicator {...change} size="sm" />}
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-lg bg-surface-raised border border-border-subtle ${className}`}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-body-sm text-text-secondary">{label}</p>
        {icon && <div className="text-text-tertiary">{icon}</div>}
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-heading text-text-primary">
            {typeof value === 'number' ? value.toLocaleString() : value}
            {suffix && (
              <span className="text-body text-text-tertiary ml-1">{suffix}</span>
            )}
          </p>
          {change && (
            <div className="mt-1">
              <ChangeIndicator {...change} />
            </div>
          )}
        </div>

        {sparklineData && sparklineData.length > 0 && (
          <Sparkline
            data={sparklineData}
            color={
              change?.direction === 'up'
                ? 'green'
                : change?.direction === 'down'
                ? 'red'
                : 'blue'
            }
            height={40}
            width={80}
          />
        )}
      </div>
    </div>
  );
}

// Change indicator component
interface ChangeIndicatorProps {
  value: number;
  direction: 'up' | 'down' | 'stable';
  label?: string;
  size?: 'sm' | 'md';
}

export function ChangeIndicator({
  value,
  direction,
  label,
  size = 'md',
}: ChangeIndicatorProps) {
  const Icon =
    direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus;

  const colorClass =
    direction === 'up'
      ? 'text-accent-green'
      : direction === 'down'
      ? 'text-accent-red'
      : 'text-text-tertiary';

  const sizeClass = size === 'sm' ? 'text-caption' : 'text-body-sm';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <span className={`inline-flex items-center gap-0.5 ${colorClass} ${sizeClass}`}>
      <Icon className={iconSize} />
      {Math.abs(value).toFixed(1)}%
      {label && <span className="text-text-muted ml-1">{label}</span>}
    </span>
  );
}

// Stats row for quick metrics display
interface StatsRowProps {
  stats: Array<{
    label: string;
    value: string | number;
    change?: { value: number; direction: 'up' | 'down' | 'stable' };
  }>;
  className?: string;
}

export function StatsRow({ stats, className = '' }: StatsRowProps) {
  return (
    <div
      className={`flex items-center divide-x divide-border-subtle ${className}`}
    >
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`flex-1 ${index === 0 ? 'pr-4' : 'px-4'} ${
            index === stats.length - 1 ? 'pl-4 pr-0' : ''
          }`}
        >
          <p className="text-caption text-text-tertiary mb-0.5">{stat.label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-subheading text-text-primary">
              {typeof stat.value === 'number'
                ? stat.value.toLocaleString()
                : stat.value}
            </p>
            {stat.change && <ChangeIndicator {...stat.change} size="sm" />}
          </div>
        </div>
      ))}
    </div>
  );
}
