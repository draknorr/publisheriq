/**
 * CSV export utilities for the Companies page
 * M6b: Export & Dashboard Integration
 */

import type { Company } from './companies-types';
import type { ColumnId } from './companies-columns';
import { COLUMN_DEFINITIONS } from './companies-columns';

/**
 * Export options for the dialog
 */
export interface ExportOptions {
  scope: 'filtered' | 'selected';
  includeVisibleOnly: boolean;
  includePerGameBreakdown: boolean;
}

/**
 * Filter description for CSV header
 */
export interface FilterDescription {
  type?: string;
  search?: string;
  minRevenue?: number;
  minGames?: number;
  // Add more as needed
}

/**
 * Escape a value for CSV (handles quotes, commas, newlines)
 */
export function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // If contains special characters, wrap in quotes and escape existing quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Format a number for CSV export
 */
function formatValueForExport(value: unknown, columnId: ColumnId): string {
  if (value === null || value === undefined) {
    return '';
  }

  // For financial columns, convert cents to dollars
  if (columnId === 'revenue' || columnId === 'revenue_per_game') {
    return (Number(value) / 100).toFixed(2);
  }

  // For percentage columns
  if (columnId === 'growth_7d' || columnId === 'growth_30d' || columnId === 'avg_score') {
    return Number(value).toFixed(2);
  }

  // For ratio columns with decimals
  if (columnId === 'reviews_per_1k_owners') {
    return Number(value).toFixed(2);
  }

  return String(value);
}

/**
 * All columns that can be exported (excluding sparkline)
 */
const ALL_EXPORTABLE_COLUMNS: ColumnId[] = [
  'hours',
  'owners',
  'ccu',
  'games',
  'unique_developers',
  'reviews',
  'avg_score',
  'review_velocity',
  'revenue',
  'growth_7d',
  'growth_30d',
  'trending',
  'revenue_per_game',
  'owners_per_game',
  'reviews_per_1k_owners',
];

/**
 * Generate CSV content from companies data
 */
export function generateCSV(
  companies: Company[],
  visibleColumns: ColumnId[],
  options: ExportOptions,
  filterDescription?: FilterDescription
): string {
  const lines: string[] = [];

  // Determine columns to export
  const columnsToExport = options.includeVisibleOnly
    ? visibleColumns.filter((c) => c !== 'sparkline')
    : ALL_EXPORTABLE_COLUMNS;

  // Add header comments
  lines.push('# Export from PublisherIQ - Companies Page');
  if (filterDescription) {
    const filters: string[] = [];
    if (filterDescription.type && filterDescription.type !== 'all') {
      filters.push(`type = ${filterDescription.type}`);
    }
    if (filterDescription.search) {
      filters.push(`search = "${filterDescription.search}"`);
    }
    if (filterDescription.minRevenue) {
      filters.push(`revenue >= $${(filterDescription.minRevenue / 100).toLocaleString()}`);
    }
    if (filterDescription.minGames) {
      filters.push(`games >= ${filterDescription.minGames}`);
    }
    if (filters.length > 0) {
      lines.push(`# Filters: ${filters.join(', ')}`);
    }
  }
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# Total companies: ${companies.length}`);
  lines.push('');

  // Add header row
  const headers = ['id', 'name', 'type', ...columnsToExport.map((c) => COLUMN_DEFINITIONS[c].label)];
  lines.push(headers.map(escapeCSVValue).join(','));

  // Add data rows
  for (const company of companies) {
    const values = [
      company.id,
      company.name,
      company.type,
      ...columnsToExport.map((columnId) => {
        const columnDef = COLUMN_DEFINITIONS[columnId];
        const value = columnDef.getValue(company);
        return formatValueForExport(value, columnId);
      }),
    ];
    lines.push(values.map(escapeCSVValue).join(','));
  }

  return lines.join('\n');
}

/**
 * Game data for per-game export
 */
export interface GameExportData {
  company_id: number;
  company_name: string;
  company_type: string;
  game_id: number;
  game_name: string;
  game_owners: number | null;
  game_ccu: number | null;
  game_revenue: number | null;
  game_review_score: number | null;
}

/**
 * Generate per-game breakdown CSV
 */
export function generatePerGameCSV(games: GameExportData[]): string {
  const lines: string[] = [];

  // Add header comments
  lines.push('# Export from PublisherIQ - Per-Game Breakdown');
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# Total games: ${games.length}`);
  lines.push('');

  // Header row
  const headers = [
    'company_id',
    'company_name',
    'company_role',
    'game_id',
    'game_name',
    'game_owners',
    'game_ccu',
    'game_revenue_usd',
    'game_review_score',
  ];
  lines.push(headers.map(escapeCSVValue).join(','));

  // Data rows
  for (const game of games) {
    const values = [
      game.company_id,
      game.company_name,
      game.company_type,
      game.game_id,
      game.game_name,
      game.game_owners ?? '',
      game.game_ccu ?? '',
      game.game_revenue !== null ? (game.game_revenue / 100).toFixed(2) : '',
      game.game_review_score ?? '',
    ];
    lines.push(values.map(escapeCSVValue).join(','));
  }

  return lines.join('\n');
}

/**
 * Generate comparison export CSV
 */
export function generateCompareCSV(
  companies: Company[],
  metricRows: Array<{
    metricId: string;
    label: string;
    formattedValues: string[];
    percentDiffs: (number | null)[];
  }>
): string {
  const lines: string[] = [];

  // Add header comments
  lines.push('# Export from PublisherIQ - Company Comparison');
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# Companies compared: ${companies.length}`);
  lines.push('');

  // Header row: Metric, Company1, %Diff1, Company2, %Diff2, ...
  const headers: string[] = ['Metric'];
  for (let i = 0; i < companies.length; i++) {
    headers.push(companies[i].name);
    if (i > 0) {
      headers.push(`${companies[i].name} vs ${companies[0].name}`);
    }
  }
  lines.push(headers.map(escapeCSVValue).join(','));

  // Data rows
  for (const row of metricRows) {
    const values: (string | number | null)[] = [row.label];
    for (let i = 0; i < companies.length; i++) {
      values.push(row.formattedValues[i] || '');
      if (i > 0 && row.percentDiffs[i] !== null) {
        values.push(`${row.percentDiffs[i]! >= 0 ? '+' : ''}${row.percentDiffs[i]!.toFixed(1)}%`);
      } else if (i > 0) {
        values.push('');
      }
    }
    lines.push(values.map(escapeCSVValue).join(','));
  }

  return lines.join('\n');
}

/**
 * Trigger browser download of CSV content
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate a filename with timestamp
 */
export function generateFilename(prefix: string, extension: string = 'csv'): string {
  const date = new Date();
  const timestamp = date.toISOString().slice(0, 10); // YYYY-MM-DD
  return `${prefix}-${timestamp}.${extension}`;
}
