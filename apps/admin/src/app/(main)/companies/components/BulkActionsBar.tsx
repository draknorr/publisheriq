'use client';

import { Scale, Pin, Download, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface BulkActionsBarProps {
  selectedCount: number;
  canCompare: boolean; // 2-5 selected
  onCompare: () => void;
  onPinAll: () => void;
  onExport: () => void;
  onClear: () => void;
  isPinning?: boolean;
}

/**
 * Fixed-position floating bar showing selected count and bulk action buttons.
 * Appears when 1+ companies are selected.
 */
export function BulkActionsBar({
  selectedCount,
  canCompare,
  onCompare,
  onPinAll,
  onExport,
  onClear,
  isPinning = false,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  const compareTooltip = !canCompare
    ? selectedCount < 2
      ? 'Select at least 2 companies to compare'
      : 'Select up to 5 companies to compare'
    : undefined;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 animate-slide-up"
      style={{
        animation: 'slide-up 0.2s ease-out',
      }}
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-surface-elevated border border-border-subtle rounded-xl shadow-lg">
        {/* Selection count */}
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 pr-3 border-r border-border-subtle"
        >
          <div className="w-5 h-5 rounded bg-accent-blue flex items-center justify-center">
            <span className="text-white text-caption font-medium" aria-hidden="true">
              {selectedCount > 9 ? '9+' : selectedCount}
            </span>
          </div>
          <span className="text-body-sm text-text-secondary">
            {selectedCount === 1 ? '1 company selected' : `${selectedCount} companies selected`}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Compare button */}
          <Button
            variant="primary"
            size="sm"
            onClick={onCompare}
            disabled={!canCompare}
            title={compareTooltip}
            className="gap-1.5"
          >
            <Scale className="w-4 h-4" />
            Compare
          </Button>

          {/* Pin All button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={onPinAll}
            className="gap-1.5"
            disabled={isPinning}
            title={isPinning ? 'Pinning...' : `Pin ${selectedCount} companies to dashboard`}
          >
            {isPinning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Pin className="w-4 h-4" />
            )}
            {isPinning ? 'Pinning...' : 'Pin All'}
          </Button>

          {/* Export button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={onExport}
            className="gap-1.5"
            title={`Export ${selectedCount} selected companies`}
          >
            <Download className="w-4 h-4" />
            Export
          </Button>

          {/* Clear button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="gap-1.5 text-text-muted hover:text-text-primary"
          >
            <X className="w-4 h-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* CSS for slide-up animation */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
