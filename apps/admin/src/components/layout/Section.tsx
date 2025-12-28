import { type ReactNode } from 'react';

interface SectionProps {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function Section({
  children,
  title,
  description,
  actions,
  className = '',
}: SectionProps) {
  return (
    <section className={`${className}`}>
      {(title || description || actions) && (
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {title && (
              <h3 className="text-subheading text-text-primary">{title}</h3>
            )}
            {description && (
              <p className="mt-0.5 text-body-sm text-text-secondary">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// Grid layout helper
interface GridProps {
  children: ReactNode;
  cols?: 1 | 2 | 3 | 4 | 5 | 6;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

const colsMap = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
};

const gapMap = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
};

export function Grid({ children, cols = 4, gap = 'md', className = '' }: GridProps) {
  return (
    <div className={`grid ${colsMap[cols]} ${gapMap[gap]} ${className}`}>
      {children}
    </div>
  );
}

// Divider
export function Divider({ className = '' }: { className?: string }) {
  return <hr className={`border-t border-border-subtle my-6 ${className}`} />;
}
