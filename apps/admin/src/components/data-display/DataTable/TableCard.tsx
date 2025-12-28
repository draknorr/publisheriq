import { type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface TableCardProps {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

export function TableCard({
  href,
  onClick,
  children,
  className = '',
}: TableCardProps) {
  const cardClasses = `
    block p-4 bg-surface-raised border border-border-subtle rounded-lg
    transition-all duration-150
    hover:border-border-muted hover:bg-surface-elevated
    ${className}
  `;

  if (href) {
    return (
      <Link href={href} className={cardClasses}>
        {children}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button onClick={onClick} className={`${cardClasses} w-full text-left`}>
        {children}
      </button>
    );
  }

  return <div className={cardClasses}>{children}</div>;
}

interface TableCardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  trailing?: ReactNode;
}

export function TableCardHeader({
  title,
  subtitle,
  badge,
  trailing,
}: TableCardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-body font-medium text-text-primary truncate">
            {title}
          </span>
          {badge}
        </div>
        {subtitle && (
          <span className="text-body-sm text-text-secondary mt-0.5 block">
            {subtitle}
          </span>
        )}
      </div>
      {trailing && <div className="flex-shrink-0">{trailing}</div>}
    </div>
  );
}

interface TableCardStatsProps {
  stats: Array<{
    label: string;
    value: ReactNode;
  }>;
}

export function TableCardStats({ stats }: TableCardStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat, index) => (
        <div key={index}>
          <p className="text-caption text-text-tertiary">{stat.label}</p>
          <p className="text-body-sm text-text-primary mt-0.5">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

interface TableCardFooterProps {
  children: ReactNode;
  showArrow?: boolean;
}

export function TableCardFooter({
  children,
  showArrow = false,
}: TableCardFooterProps) {
  return (
    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-subtle">
      <div className="flex items-center gap-2 text-body-sm text-text-secondary">
        {children}
      </div>
      {showArrow && <ChevronRight className="h-4 w-4 text-text-tertiary" />}
    </div>
  );
}
