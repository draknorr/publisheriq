import { type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`mb-8 ${className}`}>
      {/* Breadcrumb */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="mb-3 flex items-center gap-1 text-body-sm">
          {breadcrumb.map((item, index) => (
            <span key={index} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
              )}
              {item.href ? (
                <Link
                  href={item.href}
                  className="text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-text-secondary">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Header content */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-display text-text-primary">{title}</h1>
          {description && (
            <p className="mt-1 text-body text-text-secondary max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

// Compact variant for nested pages
interface PageSubHeaderProps {
  title: string;
  description?: string;
  backLink?: { label: string; href: string };
  actions?: ReactNode;
  className?: string;
}

export function PageSubHeader({
  title,
  description,
  backLink,
  actions,
  className = '',
}: PageSubHeaderProps) {
  return (
    <div className={`mb-6 ${className}`}>
      {backLink && (
        <Link
          href={backLink.href}
          className="inline-flex items-center gap-1 text-body-sm text-text-tertiary hover:text-text-secondary transition-colors mb-3"
        >
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          {backLink.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-heading text-text-primary">{title}</h2>
          {description && (
            <p className="mt-0.5 text-body-sm text-text-secondary">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
