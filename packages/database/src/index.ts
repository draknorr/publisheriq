// Client
export {
  createServiceClient,
  createBrowserClient,
  getServiceClient,
  type TypedSupabaseClient,
} from './client.js';

// Types
export type { Database } from './types.js';

// Re-export commonly used types from the Database type
import type { Database } from './types.js';

export type Tables = Database['public']['Tables'];
export type Enums = Database['public']['Enums'];

// Table row types
export type Publisher = Tables['publishers']['Row'];
export type Developer = Tables['developers']['Row'];
export type App = Tables['apps']['Row'];
export type AppDeveloper = Tables['app_developers']['Row'];
export type AppPublisher = Tables['app_publishers']['Row'];
export type AppTag = Tables['app_tags']['Row'];
export type DailyMetric = Tables['daily_metrics']['Row'];
export type ReviewHistogram = Tables['review_histogram']['Row'];
export type AppTrend = Tables['app_trends']['Row'];
export type SyncStatus = Tables['sync_status']['Row'];
export type SyncJob = Tables['sync_jobs']['Row'];

// Insert types
export type PublisherInsert = Tables['publishers']['Insert'];
export type DeveloperInsert = Tables['developers']['Insert'];
export type AppInsert = Tables['apps']['Insert'];
export type DailyMetricInsert = Tables['daily_metrics']['Insert'];
export type ReviewHistogramInsert = Tables['review_histogram']['Insert'];
export type SyncStatusInsert = Tables['sync_status']['Insert'];
export type SyncJobInsert = Tables['sync_jobs']['Insert'];

// Enum types
export type AppType = Enums['app_type'];
export type SyncSource = Enums['sync_source'];
export type TrendDirection = Enums['trend_direction'];
