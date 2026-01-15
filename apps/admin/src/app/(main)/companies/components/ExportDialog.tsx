'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Company } from '../lib/companies-types';
import type { ColumnId } from '../lib/companies-columns';
import {
  generateCSV,
  downloadCSV,
  generateFilename,
  type ExportOptions,
  type FilterDescription,
} from '../lib/companies-export';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  selectedCompanies: Company[];
  visibleColumns: ColumnId[];
  filterDescription?: FilterDescription;
  defaultScope?: 'filtered' | 'selected';
}

/**
 * Export dialog modal for CSV download options
 */
export function ExportDialog({
  isOpen,
  onClose,
  companies,
  selectedCompanies,
  visibleColumns,
  filterDescription,
  defaultScope = 'filtered',
}: ExportDialogProps) {
  const [scope, setScope] = useState<'filtered' | 'selected'>(defaultScope);
  const [includeVisibleOnly, setIncludeVisibleOnly] = useState(true);
  const [includePerGameBreakdown] = useState(false); // M6b: Setter unused until per-game RPC implemented
  const [isExporting, setIsExporting] = useState(false);

  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // ESC key handler and focus management
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExporting) {
        onClose();
      }
    };

    // Focus close button when modal opens
    closeButtonRef.current?.focus();

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExporting, onClose]);

  if (!isOpen) return null;

  const hasSelection = selectedCompanies.length > 0;
  const exportCount = scope === 'selected' ? selectedCompanies.length : companies.length;

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const dataToExport = scope === 'selected' ? selectedCompanies : companies;

      const options: ExportOptions = {
        scope,
        includeVisibleOnly,
        includePerGameBreakdown,
      };

      const csv = generateCSV(dataToExport, visibleColumns, options, filterDescription);
      const filename = generateFilename(
        scope === 'selected' ? 'companies-selected' : 'companies-filtered'
      );

      downloadCSV(csv, filename);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

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
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        className="relative w-full max-w-md mx-4 bg-surface-raised border border-border-subtle rounded-xl shadow-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-accent-blue" />
            <h2 id="export-modal-title" className="text-heading-sm font-semibold text-text-primary">
              Export Companies
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-overlay transition-colors"
            aria-label="Close export dialog"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-5">
          {/* Format section */}
          <div>
            <label className="block text-body-sm font-medium text-text-primary mb-2">Format</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked
                  readOnly
                  className="w-4 h-4 text-accent-blue"
                />
                <span className="text-body-sm text-text-primary">CSV</span>
              </label>
              <label className="flex items-center gap-2 cursor-not-allowed opacity-50">
                <input type="radio" name="format" disabled className="w-4 h-4" />
                <span className="text-body-sm text-text-muted">Excel (coming soon)</span>
              </label>
            </div>
          </div>

          {/* Scope section */}
          <div>
            <label className="block text-body-sm font-medium text-text-primary mb-2">Scope</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'filtered'}
                  onChange={() => setScope('filtered')}
                  className="w-4 h-4 text-accent-blue"
                />
                <span className="text-body-sm text-text-primary">
                  Filtered results ({companies.length.toLocaleString()} companies)
                </span>
              </label>
              <label
                className={`flex items-center gap-2 ${hasSelection ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
              >
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'selected'}
                  onChange={() => hasSelection && setScope('selected')}
                  disabled={!hasSelection}
                  className="w-4 h-4 text-accent-blue"
                />
                <span className="text-body-sm text-text-primary">
                  Selected only ({selectedCompanies.length} companies)
                </span>
              </label>
            </div>
          </div>

          {/* Include section */}
          <div>
            <label className="block text-body-sm font-medium text-text-primary mb-2">Include</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeVisibleOnly}
                  onChange={(e) => setIncludeVisibleOnly(e.target.checked)}
                  className="w-4 h-4 rounded text-accent-blue"
                />
                <span className="text-body-sm text-text-primary">
                  Visible columns only ({visibleColumns.length} columns)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-not-allowed opacity-50">
                <input
                  type="checkbox"
                  checked={includePerGameBreakdown}
                  disabled
                  className="w-4 h-4 rounded"
                />
                <span className="text-body-sm text-text-muted">
                  Include per-game breakdown (coming soon)
                </span>
              </label>
            </div>
            {!includeVisibleOnly && (
              <p className="mt-1 text-caption text-text-muted">
                All 15 metrics will be included in the export.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border-subtle bg-surface-elevated rounded-b-xl">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExport}
            disabled={isExporting || exportCount === 0}
            className="gap-1.5"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export {exportCount.toLocaleString()} Companies
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
