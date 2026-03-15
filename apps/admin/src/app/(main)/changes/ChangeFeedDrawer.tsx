'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2, X } from 'lucide-react';
import { Badge, Card } from '@/components/ui';
import type { ChangeBurstDetail, ChangeBurstImpactWindow, ChangeBurstRow } from './lib';

interface ChangeFeedDrawerProps {
  isOpen: boolean;
  summary: ChangeBurstRow | null;
  detail: ChangeBurstDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

function formatAbsoluteTime(timestamp: string | null): string {
  if (!timestamp) {
    return 'Unknown';
  }

  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) {
    return 'Unknown';
  }

  const diffMs = Date.now() - new Date(timestamp).getTime();
  if (diffMs < 60_000) {
    return 'Just now';
  }
  if (diffMs < 3_600_000) {
    return `${Math.floor(diffMs / 60_000)}m ago`;
  }
  if (diffMs < 86_400_000) {
    return `${Math.floor(diffMs / 3_600_000)}h ago`;
  }
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
}

function formatTokenLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatChangeLabel(changeType: string): string {
  if (changeType === 'technical_update') {
    return 'Technical update';
  }

  return formatTokenLabel(changeType);
}

function getSourceBadgeVariant(source: string): 'info' | 'purple' | 'orange' {
  switch (source) {
    case 'storefront':
      return 'info';
    case 'pics':
      return 'purple';
    case 'media':
      return 'orange';
    default:
      return 'info';
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'None';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return 'Unserializable';
  }
}

function formatMetric(value: number | null, kind: 'number' | 'price' | 'percent' = 'number'): string {
  if (value == null) {
    return '—';
  }

  if (kind === 'price') {
    return `$${(value / 100).toFixed(2)}`;
  }

  if (kind === 'percent') {
    return `${value}%`;
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function hasImpactWindow(window: ChangeBurstImpactWindow | null): boolean {
  if (!window) {
    return false;
  }

  return Object.values(window).some((value) => value !== null);
}

function ImpactCard({
  title,
  window,
}: {
  title: string;
  window: ChangeBurstImpactWindow | null;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
      <p className="text-caption uppercase tracking-wide text-text-tertiary">{title}</p>
      <div className="mt-2 space-y-1 text-body-sm text-text-secondary">
        <p>Peak CCU: <span className="text-text-primary">{formatMetric(window?.ccuPeak ?? null)}</span></p>
        <p>Reviews: <span className="text-text-primary">{formatMetric(window?.totalReviews ?? null)}</span></p>
        <p>Review score: <span className="text-text-primary">{formatMetric(window?.reviewScore ?? null, 'percent')}</span></p>
        <p>Price: <span className="text-text-primary">{formatMetric(window?.priceCents ?? null, 'price')}</span></p>
        <p>Discount: <span className="text-text-primary">{formatMetric(window?.discountPercent ?? null, 'percent')}</span></p>
      </div>
    </div>
  );
}

export function ChangeFeedDrawer({
  isOpen,
  summary,
  detail,
  loading,
  error,
  onClose,
}: ChangeFeedDrawerProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const displayDetail = detail ?? summary;
  const showImpact =
    detail?.impact &&
    (hasImpactWindow(detail.impact.baseline7d) ||
      hasImpactWindow(detail.impact.response1d) ||
      hasImpactWindow(detail.impact.response7d));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-feed-drawer-title"
        className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-border-subtle bg-surface-raised shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle bg-surface-elevated px-5 py-4">
          <div className="min-w-0">
            <p className="text-caption uppercase tracking-wide text-text-tertiary">Burst Detail</p>
            <h2 id="change-feed-drawer-title" className="truncate text-heading-sm text-text-primary">
              {displayDetail?.appName ?? 'Loading burst'}
            </h2>
            {displayDetail && (
              <p className="mt-1 text-body-sm text-text-secondary">
                Latest activity {formatAbsoluteTime(displayDetail.effectiveAt)} • {formatRelativeTime(displayDetail.effectiveAt)}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-surface-overlay"
            aria-label="Close change detail"
          >
            <X className="h-5 w-5 text-text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading && (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
            </div>
          )}

          {!loading && error && (
            <Card className="border-accent-red/30 bg-accent-red/10">
              <p className="text-body-sm text-accent-red">{error}</p>
            </Card>
          )}

          {!loading && !error && detail && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="primary">{detail.eventCount} events</Badge>
                <Badge variant="default">
                  Window {formatAbsoluteTime(detail.burstStartedAt)} to {formatAbsoluteTime(detail.burstEndedAt)}
                </Badge>
                {detail.hasRelatedNews && (
                  <Badge variant="warning">{detail.relatedNewsCount} related posts</Badge>
                )}
                <Link
                  href={`/apps/${detail.appid}`}
                  className="inline-flex items-center gap-1 text-body-sm text-accent-blue transition-colors hover:text-accent-blue/80"
                >
                  Open app page
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {detail.sourceSet.map((source) => (
                  <Badge key={source} variant={getSourceBadgeVariant(source)} size="sm">
                    {source === 'pics' ? 'PICS' : formatTokenLabel(source)}
                  </Badge>
                ))}
                {detail.headlineChangeTypes.map((changeType) => (
                  <Badge key={changeType} variant="info" size="sm">
                    {formatChangeLabel(changeType)}
                  </Badge>
                ))}
              </div>

              {showImpact && detail.impact && (
                <Card padding="md">
                  <div>
                    <p className="text-caption uppercase tracking-wide text-text-tertiary">
                      Impact snapshot
                    </p>
                    <p className="mt-1 text-body-sm text-text-secondary">
                      Baseline and response windows around this burst.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <ImpactCard title="Baseline 7d" window={detail.impact.baseline7d} />
                    <ImpactCard title="Response 1d" window={detail.impact.response1d} />
                    <ImpactCard title="Response 7d" window={detail.impact.response7d} />
                  </div>
                </Card>
              )}

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-subheading text-text-primary">Atomic events</h3>
                  <Badge variant="default" size="sm">
                    {detail.events.length}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {detail.events.map((event) => (
                    <Card key={event.eventId} padding="md" className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={getSourceBadgeVariant(event.source)} size="sm">
                          {event.source === 'pics' ? 'PICS' : formatTokenLabel(event.source)}
                        </Badge>
                        <Badge variant="default" size="sm">
                          {formatChangeLabel(event.changeType)}
                        </Badge>
                        <span className="text-caption text-text-muted">
                          {formatAbsoluteTime(event.occurredAt)}
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-caption uppercase tracking-wide text-text-tertiary">Before</p>
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-surface-elevated px-3 py-2 text-body-sm text-text-secondary">
                            {formatValue(event.beforeValue)}
                          </pre>
                        </div>
                        <div>
                          <p className="text-caption uppercase tracking-wide text-text-tertiary">After</p>
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-surface-elevated px-3 py-2 text-body-sm text-text-secondary">
                            {formatValue(event.afterValue)}
                          </pre>
                        </div>
                      </div>

                      {Object.keys(event.context).length > 0 && (
                        <div>
                          <p className="text-caption uppercase tracking-wide text-text-tertiary">Context</p>
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-surface-elevated px-3 py-2 text-body-sm text-text-secondary">
                            {formatValue(event.context)}
                          </pre>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-subheading text-text-primary">Related news</h3>
                  <Badge variant="default" size="sm">
                    {detail.relatedNews.length}
                  </Badge>
                </div>

                {detail.relatedNews.length === 0 ? (
                  <Card padding="md">
                    <p className="text-body-sm text-text-secondary">
                      No related news attached to this burst.
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {detail.relatedNews.map((newsItem) => (
                      <Card key={newsItem.gid} padding="md">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-body-sm font-medium text-text-primary">
                              {newsItem.title ?? 'Untitled post'}
                            </p>
                            <p className="mt-1 text-caption text-text-secondary">
                              Published {formatAbsoluteTime(newsItem.publishedAt ?? newsItem.firstSeenAt)}
                              {' '}• captured {formatRelativeTime(newsItem.firstSeenAt)}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {newsItem.feedLabel && (
                                <Badge variant="purple" size="sm">{newsItem.feedLabel}</Badge>
                              )}
                              {newsItem.feedName && (
                                <Badge variant="default" size="sm">{newsItem.feedName}</Badge>
                              )}
                            </div>
                          </div>

                          {newsItem.url && (
                            <a
                              href={newsItem.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-8 items-center justify-center rounded-md border border-border-muted bg-surface-elevated px-3 text-body-sm font-medium text-text-primary transition-colors hover:border-border-prominent hover:bg-surface-overlay"
                            >
                              Open
                            </a>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
