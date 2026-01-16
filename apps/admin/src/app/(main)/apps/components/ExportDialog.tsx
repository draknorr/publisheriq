'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, FileSpreadsheet, FileJson, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { App } from '../lib/apps-types';
import type { AppColumnId } from '../lib/apps-columns';
import {
  generateCSV,
  generateJSON,
  downloadCSV,
  downloadJSON,
  generateFilename,
  type ExportOptions,
  type FilterDescription,
} from '../lib/apps-export';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  apps: App[];
  selectedApps: App[];
  visibleColumns: AppColumnId[];
  filterDescription?: FilterDescription;
  defaultScope?: 'filtered' | 'selected';
}

/**
 * Export dialog for the Games page.
 * Allows exporting filtered or selected games to CSV or JSON format.
 */
export function ExportDialog({
  isOpen,
  onClose,
  apps,
  selectedApps,
  visibleColumns,
  filterDescription,
  defaultScope = 'filtered',
}: ExportDialogProps) {
  const [scope, setScope] = useState<'filtered' | 'selected'>(defaultScope);
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [includeVisibleOnly, setIncludeVisibleOnly] = useState(true);
  const [includeFilterMetadata, setIncludeFilterMetadata] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Reset scope when dialog opens
  useEffect(() => {
    if (isOpen) {
      setScope(defaultScope);
      closeButtonRef.current?.focus();
    }
  }, [isOpen, defaultScope]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExporting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExporting, onClose]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);

    try {
      // Small delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dataToExport = scope === 'selected' ? selectedApps : apps;
      const options: ExportOptions = {
        scope,
        format,
        includeVisibleOnly,
        includeFilterMetadata,
      };

      if (format === 'csv') {
        const csv = generateCSV(dataToExport, visibleColumns, options, filterDescription);
        const filename = generateFilename(scope, 'csv');
        downloadCSV(csv, filename);
      } else {
        const json = generateJSON(dataToExport, visibleColumns, options, filterDescription);
        const filename = generateFilename(scope, 'json');
        downloadJSON(json, filename);
      }

      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [scope, format, includeVisibleOnly, includeFilterMetadata, apps, selectedApps, visibleColumns, filterDescription, onClose]);

  if (!isOpen) return null;

  const hasSelectedApps = selectedApps.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={isExporting ? undefined : onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md mx-4 bg-surface-raised border border-border-subtle rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h2 id="export-modal-title" className="text-heading-md font-semibold text-text-primary">
            Export Games
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            disabled={isExporting}
            className="p-1 text-text-muted hover:text-text-primary rounded transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Format Selection */}
          <div>
            <label className="block text-body-sm font-medium text-text-secondary mb-2">
              Format
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={() => setFormat('csv')}
                  disabled={isExporting}
                  className="w-4 h-4 text-accent-blue focus:ring-accent-blue focus:ring-offset-0"
                />
                <FileSpreadsheet className="w-4 h-4 text-text-muted" />
                <span className="text-body-sm text-text-primary">CSV</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={format === 'json'}
                  onChange={() => setFormat('json')}
                  disabled={isExporting}
                  className="w-4 h-4 text-accent-blue focus:ring-accent-blue focus:ring-offset-0"
                />
                <FileJson className="w-4 h-4 text-text-muted" />
                <span className="text-body-sm text-text-primary">JSON</span>
              </label>
            </div>
          </div>

          {/* Scope Selection */}
          <div>
            <label className="block text-body-sm font-medium text-text-secondary mb-2">
              Export Scope
            </label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="filtered"
                  checked={scope === 'filtered'}
                  onChange={() => setScope('filtered')}
                  disabled={isExporting}
                  className="w-4 h-4 text-accent-blue focus:ring-accent-blue focus:ring-offset-0"
                />
                <span className="text-body-sm text-text-primary">
                  All filtered results ({apps.length.toLocaleString()} games)
                </span>
              </label>
              <label
                className={`flex items-center gap-2 ${
                  hasSelectedApps ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="selected"
                  checked={scope === 'selected'}
                  onChange={() => setScope('selected')}
                  disabled={isExporting || !hasSelectedApps}
                  className="w-4 h-4 text-accent-blue focus:ring-accent-blue focus:ring-offset-0"
                />
                <span className="text-body-sm text-text-primary">
                  Selected only ({selectedApps.length} games)
                </span>
              </label>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeVisibleOnly}
                onChange={(e) => setIncludeVisibleOnly(e.target.checked)}
                disabled={isExporting}
                className="w-4 h-4 rounded border-border-subtle text-accent-blue focus:ring-accent-blue focus:ring-offset-0"
              />
              <span className="text-body-sm text-text-primary">
                Visible columns only ({visibleColumns.filter((c) => c !== 'sparkline').length} columns)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeFilterMetadata}
                onChange={(e) => setIncludeFilterMetadata(e.target.checked)}
                disabled={isExporting}
                className="w-4 h-4 rounded border-border-subtle text-accent-blue focus:ring-accent-blue focus:ring-offset-0"
              />
              <span className="text-body-sm text-text-primary">
                Include filter metadata
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle bg-surface-overlay/50 rounded-b-xl">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExport}
            disabled={isExporting || (scope === 'selected' && selectedApps.length === 0)}
            className="gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export {format.toUpperCase()}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
