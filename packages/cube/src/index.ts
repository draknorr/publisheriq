/**
 * @publisheriq/cube
 *
 * Cube.dev semantic layer client for PublisherIQ
 */

// Client exports
export {
  CubeClient,
  createCubeClient,
  generateCubeToken,
  type CubeQuery,
  type CubeFilter,
  type CubeTimeDimension,
  type CubeResultSet,
  type CubeClientConfig,
} from './client';

// Pre-defined query exports
export {
  // Publishers
  getPublishersWithMetrics,
  getPublisherStats,
  // Developers
  getDevelopersWithMetrics,
  // Discovery
  discoverGames,
  // Sync Health
  getSyncHealthStats,
  getSourceCompletionStats,
  getJobStats24h,
  getJobHistory,
  // Daily Metrics
  getAppMetricsHistory,
  getPlatformMetricsTrends,
} from './queries';
