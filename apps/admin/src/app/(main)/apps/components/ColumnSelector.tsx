'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, RotateCcw, Columns } from 'lucide-react';
import {
  APP_COLUMN_DEFINITIONS,
  APP_COLUMN_CATEGORIES,
  DEFAULT_APP_COLUMNS,
  CORE_COLUMNS,
  type AppColumnId,
} from '../lib/apps-columns';

interface ColumnSelectorProps {
  visibleColumns: AppColumnId[];
  onChange: (columns: AppColumnId[]) => void;
  disabled?: boolean;
}

export function ColumnSelector({
  visibleColumns,
  onChange,
  disabled,
}: ColumnSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Count total selectable columns (excludes core columns)
  const selectableColumnIds = (Object.keys(APP_COLUMN_DEFINITIONS) as AppColumnId[]).filter(
    (id) => !CORE_COLUMNS.includes(id)
  );
  const totalColumns = selectableColumnIds.length;
  const visibleCount = visibleColumns.filter((id) => !CORE_COLUMNS.includes(id)).length;

  const toggleColumn = (columnId: AppColumnId) => {
    if (visibleColumns.includes(columnId)) {
      // Remove column (but ensure core columns and at least one non-core column remain)
      const nonCoreVisible = visibleColumns.filter((c) => !CORE_COLUMNS.includes(c));
      if (nonCoreVisible.length > 1 || CORE_COLUMNS.includes(columnId)) {
        onChange(visibleColumns.filter((c) => c !== columnId));
      }
    } else {
      onChange([...visibleColumns, columnId]);
    }
  };

  const resetToDefault = () => {
    onChange(DEFAULT_APP_COLUMNS);
  };

  const isDefault =
    JSON.stringify([...visibleColumns].sort()) ===
    JSON.stringify([...DEFAULT_APP_COLUMNS].sort());

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-subtle bg-surface hover:bg-surface-elevated transition-colors disabled:opacity-50"
      >
        <Columns className="w-4 h-4 text-text-muted" />
        <span className="text-body-sm text-text-secondary">
          Columns ({visibleCount})
        </span>
        <ChevronDown
          className={`w-4 h-4 text-text-muted transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-surface-elevated rounded-lg border border-border-subtle shadow-lg z-50 max-h-[400px] overflow-y-auto">
          {/* Header with reset button */}
          <div className="sticky top-0 p-3 border-b border-border-subtle bg-surface-elevated flex justify-between items-center">
            <span className="text-caption text-text-muted">
              Select visible columns
            </span>
            <button
              onClick={resetToDefault}
              disabled={isDefault}
              className="flex items-center gap-1 text-caption text-accent-blue hover:underline disabled:text-text-muted disabled:no-underline disabled:cursor-default"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          {/* Category groups */}
          {Object.entries(APP_COLUMN_CATEGORIES).map(([categoryKey, category]) => (
            <div key={categoryKey} className="border-b border-border-subtle last:border-b-0">
              <div className="px-3 py-2 text-caption font-medium text-text-tertiary uppercase tracking-wide bg-surface-overlay/50">
                {category.label}
              </div>
              {category.columns.map((columnId) => {
                const column = APP_COLUMN_DEFINITIONS[columnId];
                if (!column) return null;
                const isVisible = visibleColumns.includes(columnId);

                return (
                  <button
                    key={columnId}
                    onClick={() => toggleColumn(columnId)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-overlay transition-colors text-left"
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        isVisible
                          ? 'bg-accent-blue border-accent-blue'
                          : 'border-border-subtle'
                      }`}
                    >
                      {isVisible && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-body-sm text-text-primary">
                        {column.label}
                      </span>
                      {column.methodology && (
                        <p className="text-caption text-text-muted truncate">
                          {column.methodology.split('.')[0]}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
