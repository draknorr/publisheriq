'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: {
    value: string | number;
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  };
  headerExtra?: ReactNode;
  className?: string;
}

const badgeVariants = {
  default: 'bg-surface-elevated text-text-secondary',
  success: 'bg-accent-green/15 text-accent-green',
  warning: 'bg-accent-yellow/15 text-accent-yellow',
  error: 'bg-accent-red/15 text-accent-red',
  info: 'bg-accent-primary/15 text-accent-primary',
};

export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  badge,
  headerExtra,
  className = '',
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-lg border border-border-subtle bg-surface-raised ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-elevated/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <ChevronRight
            className={`h-4 w-4 text-text-tertiary transition-transform duration-150 ${
              isOpen ? 'rotate-90' : ''
            }`}
          />
          <span className="text-body-sm font-medium text-text-primary">{title}</span>
          {badge && (
            <span
              className={`px-1.5 py-0.5 text-caption rounded ${
                badgeVariants[badge.variant ?? 'default']
              }`}
            >
              {badge.value}
            </span>
          )}
        </div>
        {headerExtra && <div className="flex items-center gap-2">{headerExtra}</div>}
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-1 border-t border-border-subtle">
          {children}
        </div>
      )}
    </div>
  );
}
