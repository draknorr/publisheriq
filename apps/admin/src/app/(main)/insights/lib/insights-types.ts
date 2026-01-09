/**
 * Type definitions for the Insights dashboard
 * Designed for extensibility to support additional metrics beyond CCU
 */

export type TimeRange = '24h' | '7d' | '30d';

export type InsightsTab = 'top' | 'newest' | 'trending';

export type NewestSortMode = 'release' | 'growth';

/**
 * Game data for insights display
 */
export interface GameInsight {
  appid: number;
  name: string;
  releaseDate: string | null;
  currentCcu: number;
  peakCcu?: number;
  avgCcu?: number;
  growthPct?: number;
  priorAvgCcu?: number;
  ccuTier?: 1 | 2 | 3;
  tierReason?: string;
  releaseRank?: number;
  // Sparkline data
  ccuSparkline?: number[];
  ccuTrend?: 'up' | 'down' | 'stable';
  // Review metrics
  totalReviews?: number;
  positivePercent?: number;
  reviewVelocity?: number;
  // Price context
  priceCents?: number | null;
  discountPercent?: number | null;
  isFree?: boolean;
  // Engagement
  avgPlaytimeHours?: number | null;
}

/**
 * Time-series data point for charts
 */
export interface CCUDataPoint {
  time: string;
  ccu: number;
}

/**
 * Configuration for time range options
 */
export interface TimeRangeConfig {
  interval: string;
  priorInterval: string;
  granularity: 'hour' | 'day';
  chartPoints: number;
  label: string;
}

/**
 * Props interfaces for components
 */
export interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

export interface GameInsightCardProps {
  game: GameInsight;
  rank?: number;
  showGrowth?: boolean;
  showTier?: boolean;
}

export interface CCUTimeSeriesChartProps {
  data: CCUDataPoint[];
  timeRange: TimeRange;
  height?: number;
  showXAxis?: boolean;
  showYAxis?: boolean;
  compact?: boolean;
}

/**
 * Future extensibility: Metric configuration for adding new metrics
 */
export interface MetricDefinition {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
  color: 'blue' | 'green' | 'red' | 'purple' | 'cyan' | 'orange';
  dataSource: string;
  aggregation: 'sum' | 'avg' | 'max' | 'min' | 'count';
  chartType: 'area' | 'bar' | 'line' | 'sparkline';
  enabled: boolean;
  requiresTimeRange: boolean;
}

/**
 * Future: Saved filter presets
 */
export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  filters: {
    timeRange: TimeRange;
    tab: InsightsTab;
    minCcu?: number;
    maxCcu?: number;
    releaseDateFrom?: string;
    releaseDateTo?: string;
    tags?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Future: Watchlist entry
 */
export interface WatchlistEntry {
  appid: number;
  addedAt: string;
  alerts?: {
    ccuThreshold?: number;
    trendDirection?: 'up' | 'down';
    enabled: boolean;
  };
}
