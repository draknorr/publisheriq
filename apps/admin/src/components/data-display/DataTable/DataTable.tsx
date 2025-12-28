'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, Settings2 } from 'lucide-react';
import { ColumnCustomizer } from './ColumnCustomizer';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  minWidth?: string;
  sortable?: boolean;
  sticky?: boolean;
  hideOnMobile?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: T) => ReactNode;
}

interface DataTableProps<T extends Record<string, unknown>> {
  data: T[];
  columns: Column<T>[];
  keyField: string;
  defaultVisibleColumns?: string[];
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  emptyState?: ReactNode;
  cardRenderer?: (row: T) => ReactNode;
  stickyHeader?: boolean;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  keyField,
  defaultVisibleColumns,
  onSort,
  sortKey,
  sortDirection,
  onRowClick,
  isLoading,
  emptyState,
  cardRenderer,
  stickyHeader = true,
  className = '',
}: DataTableProps<T>) {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    defaultVisibleColumns || columns.map((c) => c.key)
  );
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);

  const filteredColumns = useMemo(
    () => columns.filter((col) => visibleColumns.includes(col.key)),
    [columns, visibleColumns]
  );

  const handleSort = (key: string) => {
    if (!onSort) return;
    const newDirection =
      sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(key, newDirection);
  };

  const handleToggleColumn = (key: string) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  if (isLoading) {
    return <TableSkeleton columns={filteredColumns.length} rows={5} />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-text-secondary text-body">
        {emptyState || 'No data available'}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Column customizer */}
      <div className="flex justify-end mb-3">
        <div className="relative">
          <button
            onClick={() => setShowColumnCustomizer(!showColumnCustomizer)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-body-sm text-text-secondary hover:text-text-primary bg-surface-elevated hover:bg-surface-overlay border border-border-subtle rounded-md transition-colors"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Columns
          </button>
          {showColumnCustomizer && (
            <ColumnCustomizer
              columns={columns}
              visibleColumns={visibleColumns}
              onToggle={handleToggleColumn}
              onClose={() => setShowColumnCustomizer(false)}
            />
          )}
        </div>
      </div>

      {/* Mobile card view */}
      {cardRenderer && (
        <div className="md:hidden space-y-3">
          {data.map((row) => (
            <div
              key={String(row[keyField])}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? 'cursor-pointer' : ''}
            >
              {cardRenderer(row)}
            </div>
          ))}
        </div>
      )}

      {/* Desktop table view */}
      <div className={`hidden md:block overflow-x-auto scrollbar-thin rounded-lg border border-border-subtle`}>
        <table className="w-full min-w-full">
          <thead
            className={`bg-surface-elevated ${
              stickyHeader ? 'sticky top-0 z-10' : ''
            }`}
          >
            <tr>
              {filteredColumns.map((column) => (
                <th
                  key={column.key}
                  className={`
                    px-4 py-3 text-caption font-medium text-text-secondary
                    ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}
                    ${column.sticky ? 'sticky left-0 bg-surface-elevated z-20' : ''}
                    ${column.sortable && onSort ? 'cursor-pointer hover:text-text-primary select-none' : ''}
                  `}
                  style={{
                    width: column.width,
                    minWidth: column.minWidth,
                  }}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-1">
                    <span>{column.header}</span>
                    {column.sortable && sortKey === column.key && (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {data.map((row) => (
              <tr
                key={String(row[keyField])}
                onClick={() => onRowClick?.(row)}
                className={`
                  bg-surface-raised hover:bg-surface-elevated transition-colors
                  ${onRowClick ? 'cursor-pointer' : ''}
                `}
              >
                {filteredColumns.map((column) => (
                  <td
                    key={column.key}
                    className={`
                      px-4 py-3 text-body text-text-primary
                      ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}
                      ${column.sticky ? 'sticky left-0 bg-surface-raised' : ''}
                    `}
                    style={{
                      width: column.width,
                      minWidth: column.minWidth,
                    }}
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : String(row[column.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Table skeleton for loading state
function TableSkeleton({ columns, rows }: { columns: number; rows: number }) {
  return (
    <div className="rounded-lg border border-border-subtle overflow-hidden">
      <div className="bg-surface-elevated">
        <div className="flex gap-4 p-4">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="h-4 flex-1 bg-surface-overlay rounded animate-pulse" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-border-subtle">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 p-4 bg-surface-raised">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={colIndex}
                className="h-4 flex-1 bg-surface-overlay rounded animate-pulse"
                style={{ animationDelay: `${(rowIndex * columns + colIndex) * 50}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
