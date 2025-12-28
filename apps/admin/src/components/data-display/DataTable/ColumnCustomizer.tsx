'use client';

import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import type { Column } from './DataTable';

interface ColumnCustomizerProps<T> {
  columns: Column<T>[];
  visibleColumns: string[];
  onToggle: (key: string) => void;
  onClose: () => void;
}

export function ColumnCustomizer<T>({
  columns,
  visibleColumns,
  onToggle,
  onClose,
}: ColumnCustomizerProps<T>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 w-56 py-2 bg-surface-raised border border-border-muted rounded-lg shadow-elevated z-50 animate-fade-in"
    >
      <div className="px-3 py-1.5 text-caption text-text-tertiary border-b border-border-subtle mb-1">
        Toggle columns
      </div>
      <div className="max-h-64 overflow-y-auto scrollbar-thin">
        {columns.map((column) => {
          const isVisible = visibleColumns.includes(column.key);
          return (
            <button
              key={column.key}
              onClick={() => onToggle(column.key)}
              className={`
                w-full flex items-center gap-2 px-3 py-2 text-body-sm text-left
                transition-colors hover:bg-surface-elevated
                ${isVisible ? 'text-text-primary' : 'text-text-tertiary'}
              `}
            >
              <div
                className={`
                  flex items-center justify-center w-4 h-4 rounded border
                  transition-colors
                  ${
                    isVisible
                      ? 'bg-accent-blue border-accent-blue'
                      : 'border-border-muted'
                  }
                `}
              >
                {isVisible && <Check className="h-3 w-3 text-white" />}
              </div>
              {column.header}
            </button>
          );
        })}
      </div>
    </div>
  );
}
