'use client';

import React, { useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, Scale } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { App, AggregateStats } from '../lib/apps-types';
import {
  buildCompareMetricRows,
  groupMetricsByCategory,
  formatPercentDiff,
  CATEGORY_LABELS,
  type CompareCategory,
} from '../lib/apps-compare';

interface CompareModeProps {
  apps: App[];
  aggregateStats?: AggregateStats;
  onClose: () => void;
  onRemove: (appid: number) => void;
}

/**
 * Full-screen modal for side-by-side game comparison.
 * Games displayed as columns, metrics as rows.
 * First game is baseline for % diff calculations.
 */
export function CompareMode({
  apps,
  aggregateStats,
  onClose,
  onRemove,
}: CompareModeProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap and ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Focus the close button when modal opens
    closeButtonRef.current?.focus();

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Build comparison data
  const metricRows = useMemo(
    () => buildCompareMetricRows(apps, aggregateStats),
    [apps, aggregateStats]
  );

  const groupedMetrics = useMemo(
    () => groupMetricsByCategory(metricRows),
    [metricRows]
  );

  // Categories to display (in order)
  const categories: CompareCategory[] = ['engagement', 'reviews', 'growth', 'financial'];

  if (apps.length < 2) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-modal-title"
        className="relative w-full max-w-5xl mx-4 bg-surface-raised border border-border-subtle rounded-xl shadow-lg max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface-elevated">
          <div className="flex items-center gap-3">
            <Scale className="w-5 h-5 text-accent-blue" />
            <h2 id="compare-modal-title" className="text-heading-sm font-semibold text-text-primary">
              Compare Games
            </h2>
            <Badge variant="default" size="sm">
              {apps.length} games
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface-overlay transition-colors"
              aria-label="Close comparison modal"
            >
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>
        </div>

        {/* Content - horizontal scroll wrapper */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <table className="min-w-full w-max border-collapse">
            {/* Game Headers */}
            <thead className="sticky top-0 bg-surface-elevated z-10">
              <tr>
                <th className="w-[140px] px-4 py-3 text-left text-caption font-medium text-text-tertiary border-b border-border-subtle">
                  Metric
                </th>
                {apps.map((app, i) => (
                  <th
                    key={app.appid}
                    className="w-[130px] px-3 py-3 text-left border-b border-border-subtle"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <Link
                          href={`/apps/${app.appid}`}
                          className="text-body-sm font-medium text-text-primary truncate hover:text-accent-blue transition-colors"
                          title={app.name}
                        >
                          {app.name}
                        </Link>
                        <div className="flex items-center gap-1">
                          <Badge variant="default" size="sm">
                            {app.type}
                          </Badge>
                          {i === 0 && (
                            <Badge variant="primary" size="sm">
                              Baseline
                            </Badge>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => onRemove(app.appid)}
                        className="p-1 rounded hover:bg-surface-overlay transition-colors flex-shrink-0 -mr-1"
                        aria-label={`Remove ${app.name}`}
                      >
                        <X className="w-3.5 h-3.5 text-text-muted hover:text-text-primary" />
                      </button>
                    </div>
                  </th>
                ))}
                {/* vs Avg column */}
                <th className="w-[90px] px-3 py-3 text-left border-b border-border-subtle">
                  <span className="text-body-sm font-medium text-text-secondary">
                    vs Avg
                  </span>
                </th>
              </tr>
            </thead>

            <tbody>
              {/* Grouped metric rows */}
              {categories.map((categoryKey) => {
                const categoryRows = groupedMetrics[categoryKey];
                if (!categoryRows || categoryRows.length === 0) return null;

                return (
                  <React.Fragment key={categoryKey}>
                    {/* Category header */}
                    <tr className="bg-surface-overlay/50">
                      <td
                        colSpan={apps.length + 2}
                        className="px-4 py-2 text-caption font-medium text-text-tertiary uppercase tracking-wide border-b border-border-subtle"
                      >
                        {CATEGORY_LABELS[categoryKey]}
                      </td>
                    </tr>

                    {/* Metric rows */}
                    {categoryRows.map((row) => (
                      <tr
                        key={row.metricId}
                        className="border-b border-border-subtle hover:bg-surface-overlay/20 transition-colors"
                      >
                        {/* Metric label */}
                        <td className="px-4 py-2.5 text-body-sm text-text-secondary">
                          {row.label}
                        </td>

                        {/* Game values */}
                        {row.formattedValues.map((formatted, i) => {
                          const isBest = row.bestIndex === i;
                          const isWorst = row.worstIndex === i && row.bestIndex !== row.worstIndex;
                          const percentDiff = row.percentDiffs[i];

                          return (
                            <td
                              key={i}
                              className={`px-3 py-2.5 ${
                                isBest
                                  ? 'bg-accent-green/10'
                                  : isWorst
                                  ? 'bg-accent-red/10'
                                  : ''
                              }`}
                            >
                              <div className="flex flex-col">
                                <span
                                  className={`text-body-sm ${
                                    isBest
                                      ? 'text-accent-green font-medium'
                                      : isWorst
                                      ? 'text-accent-red'
                                      : 'text-text-primary'
                                  }`}
                                >
                                  {formatted}
                                </span>
                                <span
                                  className={`text-caption ${
                                    i === 0
                                      ? 'text-text-muted'
                                      : percentDiff === null
                                      ? 'text-text-muted'
                                      : percentDiff >= 0
                                      ? 'text-accent-green'
                                      : 'text-accent-red'
                                  }`}
                                >
                                  {i === 0 ? '—' : percentDiff !== null ? formatPercentDiff(percentDiff) : '—'}
                                </span>
                              </div>
                            </td>
                          );
                        })}

                        {/* vs Avg */}
                        <td className="px-3 py-2.5">
                          {row.vsAvgDiff !== null ? (
                            <span
                              className={`text-body-sm ${
                                row.vsAvgDiff >= 0
                                  ? 'text-accent-green'
                                  : 'text-accent-red'
                              }`}
                            >
                              {formatPercentDiff(row.vsAvgDiff)}
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle bg-surface-elevated">
          <p className="text-caption text-text-muted">
            First game is used as baseline for percentage comparisons
          </p>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
