import { type ReactNode } from 'react';

interface DenseMetric {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: ReactNode;
  status?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

interface DenseMetricGridProps {
  metrics: DenseMetric[];
  columns?: 3 | 4 | 5 | 6;
  className?: string;
}

const statusColors = {
  success: 'text-accent-green',
  warning: 'text-accent-yellow',
  error: 'text-accent-red',
  info: 'text-accent-primary',
  neutral: 'text-text-primary',
};

const statusBgColors = {
  success: 'bg-accent-green/10',
  warning: 'bg-accent-yellow/10',
  error: 'bg-accent-red/10',
  info: 'bg-accent-primary/10',
  neutral: 'bg-surface-elevated',
};

export function DenseMetricGrid({
  metrics,
  columns = 4,
  className = '',
}: DenseMetricGridProps) {
  const gridCols = {
    3: 'grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-2 ${className}`}>
      {metrics.map((metric, index) => (
        <div
          key={index}
          className={`px-2.5 py-2 rounded-md border border-border-subtle ${
            statusBgColors[metric.status ?? 'neutral']
          }`}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            {metric.icon && (
              <span className="text-text-tertiary">{metric.icon}</span>
            )}
            <span className="text-caption text-text-tertiary truncate">
              {metric.label}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-body font-semibold ${
                statusColors[metric.status ?? 'neutral']
              }`}
            >
              {typeof metric.value === 'number'
                ? metric.value.toLocaleString()
                : metric.value}
            </span>
            {metric.subValue && (
              <span className="text-caption text-text-muted">{metric.subValue}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Compact inline metric for status bars
interface InlineMetricProps {
  label: string;
  value: string | number;
  status?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

export function InlineMetric({ label, value, status = 'neutral' }: InlineMetricProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-caption text-text-tertiary">{label}:</span>
      <span className={`text-body-sm font-medium ${statusColors[status]}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

// Status bar for top-level health indicators
interface StatusBarProps {
  metrics: Array<{
    label: string;
    value: string | number;
    status?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  }>;
  className?: string;
}

export function StatusBar({ metrics, className = '' }: StatusBarProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 rounded-lg bg-surface-raised border border-border-subtle ${className}`}
    >
      {metrics.map((metric, index) => (
        <InlineMetric
          key={index}
          label={metric.label}
          value={metric.value}
          status={metric.status}
        />
      ))}
    </div>
  );
}
