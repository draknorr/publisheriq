/**
 * Export utilities for the Games page
 * Milestone 6b: Export & Polish
 */

import type { App } from './apps-types';
import type { AppColumnId } from './apps-columns';
import { APP_COLUMN_DEFINITIONS } from './apps-columns';

/**
 * Export options for the dialog
 */
export interface ExportOptions {
  scope: 'filtered' | 'selected';
  format: 'csv' | 'json';
  includeVisibleOnly: boolean;
  includeFilterMetadata: boolean;
}

/**
 * Filter description for export header metadata
 */
export interface FilterDescription {
  type?: string;
  search?: string;
  preset?: string;
  quickFilters?: string[];
  minCcu?: number;
  minScore?: number;
  minOwners?: number;
  minGrowth7d?: number;
  minMomentum?: number;
  genres?: number[];
  tags?: number[];
}

/**
 * All exportable columns (excludes visualization columns like sparkline)
 */
export const ALL_EXPORTABLE_COLUMNS: AppColumnId[] = [
  // Core
  'rank',
  'name',
  // Engagement
  'avg_playtime_forever',
  'avg_playtime_2weeks',
  'active_player_pct',
  // Reviews
  'reviews',
  'positive_percentage',
  'velocity_7d',
  'velocity_30d',
  'velocity_tier',
  'sentiment_delta',
  'review_rate',
  // Growth (excluding sparkline)
  'ccu_peak',
  'ccu_growth_7d',
  'ccu_growth_30d',
  'momentum_score',
  'velocity_acceleration',
  // Financial
  'price',
  'discount',
  'owners',
  'value_score',
  // Context
  'publisher',
  'developer',
  'vs_publisher_avg',
  'publisher_game_count',
  // Timeline
  'release_date',
  'days_live',
  'hype_duration',
  // Platform
  'steam_deck',
  'platforms',
  'controller_support',
  // Activity
  'ccu_tier',
];

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
 * Format a value for export based on column type
 */
function formatValueForExport(value: unknown, columnId: AppColumnId, app: App, rank: number): string {
  if (value === null || value === undefined) {
    return '';
  }

  switch (columnId) {
    // Rank is computed from position
    case 'rank':
      return String(rank);

    // Price: cents to dollars
    case 'price':
      if (app.is_free) return 'Free';
      if (app.price_cents === null) return '';
      return `$${(app.price_cents / 100).toFixed(2)}`;

    // Discount percentage
    case 'discount':
      if (app.current_discount_percent <= 0) return '';
      return `-${app.current_discount_percent}%`;

    // Playtime: minutes to hours
    case 'avg_playtime_forever':
    case 'avg_playtime_2weeks': {
      const minutes = Number(value);
      if (minutes < 60) return `${minutes}m`;
      return `${(minutes / 60).toFixed(1)}h`;
    }

    // Percentages with fixed decimals
    case 'active_player_pct':
    case 'positive_percentage':
      return `${Number(value).toFixed(1)}%`;

    // Growth percentages with sign
    case 'ccu_growth_7d':
    case 'ccu_growth_30d': {
      const pct = Number(value);
      const sign = pct >= 0 ? '+' : '';
      return `${sign}${pct.toFixed(1)}%`;
    }

    // Momentum and sentiment delta with sign
    case 'momentum_score':
    case 'sentiment_delta':
    case 'velocity_acceleration':
    case 'vs_publisher_avg': {
      const val = Number(value);
      const sign = val >= 0 ? '+' : '';
      return `${sign}${val.toFixed(1)}`;
    }

    // Velocity: reviews per day
    case 'velocity_7d':
    case 'velocity_30d':
      return `${Number(value).toFixed(1)}/day`;

    // Review rate: reviews per 1K owners
    case 'review_rate':
      return Number(value).toFixed(1);

    // Value score: hours per dollar
    case 'value_score':
      if (app.is_free) return 'N/A';
      return `${Number(value).toFixed(1)} hrs/$`;

    // Days live and hype duration
    case 'days_live':
    case 'hype_duration':
      return `${value}d`;

    // CCU tier
    case 'ccu_tier': {
      const tier = Number(value);
      if (tier === 1) return 'Tier 1 (Hot)';
      if (tier === 2) return 'Tier 2 (Active)';
      if (tier === 3) return 'Tier 3 (Quiet)';
      return String(value);
    }

    // Velocity tier
    case 'velocity_tier': {
      const tier = String(value);
      return tier.charAt(0).toUpperCase() + tier.slice(1);
    }

    // Steam Deck category
    case 'steam_deck': {
      const category = String(value);
      return category.charAt(0).toUpperCase() + category.slice(1);
    }

    // Controller support
    case 'controller_support': {
      const support = String(value);
      if (support === 'full') return 'Full';
      if (support === 'partial') return 'Partial';
      return '';
    }

    // Large numbers: use compact format
    case 'ccu_peak':
    case 'owners':
    case 'reviews':
    case 'publisher_game_count': {
      const num = Number(value);
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
      return String(num);
    }

    // Default: convert to string
    default:
      return String(value);
  }
}

/**
 * Build filter description string for CSV header
 */
function buildFilterDescriptionString(filterDescription: FilterDescription): string[] {
  const filters: string[] = [];

  if (filterDescription.type && filterDescription.type !== 'game') {
    filters.push(`type = ${filterDescription.type}`);
  }
  if (filterDescription.search) {
    filters.push(`search = "${filterDescription.search}"`);
  }
  if (filterDescription.preset) {
    filters.push(`preset = ${filterDescription.preset}`);
  }
  if (filterDescription.quickFilters && filterDescription.quickFilters.length > 0) {
    filters.push(`quick filters = ${filterDescription.quickFilters.join(', ')}`);
  }
  if (filterDescription.minCcu) {
    filters.push(`CCU >= ${filterDescription.minCcu.toLocaleString()}`);
  }
  if (filterDescription.minScore) {
    filters.push(`score >= ${filterDescription.minScore}%`);
  }
  if (filterDescription.minOwners) {
    filters.push(`owners >= ${filterDescription.minOwners.toLocaleString()}`);
  }
  if (filterDescription.minGrowth7d) {
    filters.push(`growth (7d) >= ${filterDescription.minGrowth7d}%`);
  }
  if (filterDescription.minMomentum) {
    filters.push(`momentum >= ${filterDescription.minMomentum}`);
  }

  return filters;
}

/**
 * Generate CSV content from apps data
 */
export function generateCSV(
  apps: App[],
  visibleColumns: AppColumnId[],
  options: ExportOptions,
  filterDescription?: FilterDescription
): string {
  const lines: string[] = [];

  // Determine columns to export
  const columnsToExport = options.includeVisibleOnly
    ? visibleColumns.filter((c) => !APP_COLUMN_DEFINITIONS[c]?.isVisualization)
    : ALL_EXPORTABLE_COLUMNS;

  // Add header comments if filter metadata included
  if (options.includeFilterMetadata) {
    lines.push('# Export from PublisherIQ - Games Page');
    if (filterDescription) {
      const filters = buildFilterDescriptionString(filterDescription);
      if (filters.length > 0) {
        lines.push(`# Filters: ${filters.join(', ')}`);
      }
    }
    lines.push(`# Scope: ${options.scope === 'selected' ? 'Selected games' : 'Filtered results'}`);
    lines.push(`# Generated: ${new Date().toISOString()}`);
    lines.push(`# Total games: ${apps.length}`);
    lines.push('');
  }

  // Add header row
  const headers = ['appid', ...columnsToExport.map((c) => APP_COLUMN_DEFINITIONS[c]?.label || c)];
  lines.push(headers.map(escapeCSVValue).join(','));

  // Add data rows
  for (let i = 0; i < apps.length; i++) {
    const app = apps[i];
    const rank = i + 1;

    const values = [
      app.appid,
      ...columnsToExport.map((columnId) => {
        const columnDef = APP_COLUMN_DEFINITIONS[columnId];
        if (!columnDef) return '';

        const rawValue = columnDef.getValue(app);
        return formatValueForExport(rawValue, columnId, app, rank);
      }),
    ];

    lines.push(values.map(escapeCSVValue).join(','));
  }

  return lines.join('\n');
}

/**
 * Generate JSON content from apps data
 */
export function generateJSON(
  apps: App[],
  visibleColumns: AppColumnId[],
  options: ExportOptions,
  filterDescription?: FilterDescription
): string {
  // Determine columns to export
  const columnsToExport = options.includeVisibleOnly
    ? visibleColumns.filter((c) => !APP_COLUMN_DEFINITIONS[c]?.isVisualization)
    : ALL_EXPORTABLE_COLUMNS;

  const exportData = {
    metadata: options.includeFilterMetadata
      ? {
          source: 'PublisherIQ - Games Page',
          scope: options.scope === 'selected' ? 'Selected games' : 'Filtered results',
          generated: new Date().toISOString(),
          totalGames: apps.length,
          filters: filterDescription
            ? buildFilterDescriptionString(filterDescription)
            : undefined,
        }
      : undefined,
    games: apps.map((app, index) => {
      const rank = index + 1;
      const gameData: Record<string, unknown> = { appid: app.appid };

      for (const columnId of columnsToExport) {
        const columnDef = APP_COLUMN_DEFINITIONS[columnId];
        if (!columnDef) continue;

        const rawValue = columnDef.getValue(app);
        // For JSON, store raw values (not formatted strings)
        if (columnId === 'rank') {
          gameData[columnId] = rank;
        } else if (columnId === 'price') {
          gameData[columnId] = app.is_free ? 0 : (app.price_cents ?? null);
        } else {
          gameData[columnId] = rawValue;
        }
      }

      return gameData;
    }),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Trigger browser download of file content
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
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
 * Convenience wrapper for CSV download
 */
export function downloadCSV(content: string, filename: string): void {
  downloadFile(content, filename, 'text/csv');
}

/**
 * Convenience wrapper for JSON download
 */
export function downloadJSON(content: string, filename: string): void {
  downloadFile(content, filename, 'application/json');
}

/**
 * Generate a filename with timestamp
 */
export function generateFilename(
  scope: 'filtered' | 'selected',
  extension: 'csv' | 'json' = 'csv'
): string {
  const date = new Date();
  const timestamp = date.toISOString().slice(0, 10); // YYYY-MM-DD
  return `games-${scope}-${timestamp}.${extension}`;
}
