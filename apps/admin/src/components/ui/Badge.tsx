import { type ReactNode } from 'react';

type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'purple'
  | 'cyan'
  | 'orange'
  | 'pink';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--badge-default-bg)] text-[var(--badge-default-text)]',
  primary: 'bg-[var(--badge-primary-bg)] text-[var(--badge-primary-text)]',
  success: 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)]',
  warning: 'bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)]',
  error: 'bg-[var(--badge-error-bg)] text-[var(--badge-error-text)]',
  info: 'bg-accent-blue/15 text-accent-blue',
  purple: 'bg-accent-purple/15 text-accent-purple',
  cyan: 'bg-accent-cyan/15 text-accent-cyan',
  orange: 'bg-accent-orange/15 text-accent-orange',
  pink: 'bg-accent-pink/15 text-accent-pink',
};

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-caption',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded font-medium
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

// Specialized badges for common use cases
export function StatusBadge({
  status,
  className = '',
}: {
  status: 'active' | 'inactive' | 'pending' | 'error';
  className?: string;
}) {
  const config = {
    active: { variant: 'success' as const, label: 'Active' },
    inactive: { variant: 'default' as const, label: 'Inactive' },
    pending: { variant: 'warning' as const, label: 'Pending' },
    error: { variant: 'error' as const, label: 'Error' },
  };

  const { variant, label } = config[status];

  return (
    <Badge variant={variant} className={className}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}
