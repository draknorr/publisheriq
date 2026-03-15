import type { Database } from '@publisheriq/database';

export type AppType = Database['public']['Enums']['app_type'];

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue | undefined }
  | JsonValue[];

export const CHANGE_FEED_PRESETS = [
  'high-signal',
  'upcoming-radar',
  'all-changes',
] as const;

export type ChangeFeedPreset = (typeof CHANGE_FEED_PRESETS)[number];

export const CHANGE_FEED_SOURCES = ['storefront', 'pics', 'media'] as const;

export type ChangeFeedSource = (typeof CHANGE_FEED_SOURCES)[number];

export const CHANGE_FEED_STATUS_STATES = [
  'healthy',
  'catching_up',
  'delayed',
] as const;

export type ChangeFeedStatusState = (typeof CHANGE_FEED_STATUS_STATES)[number];

export const CHANGE_FEED_APP_TYPES: AppType[] = [
  'game',
  'dlc',
  'demo',
  'mod',
  'video',
  'hardware',
  'music',
  'episode',
  'tool',
  'application',
  'series',
  'advertising',
];

export interface ChangeFeedCursor {
  time: string;
  key: string;
}

export interface ChangeBurstImpactWindow {
  ccuPeak: number | null;
  totalReviews: number | null;
  positiveReviews: number | null;
  negativeReviews: number | null;
  reviewScore: number | null;
  reviewScoreLabel: string | null;
  priceCents: number | null;
  discountPercent: number | null;
}

export interface ChangeBurstImpact {
  baseline7d: ChangeBurstImpactWindow | null;
  response1d: ChangeBurstImpactWindow | null;
  response7d: ChangeBurstImpactWindow | null;
}

export interface ChangeBurstRow {
  burstId: string;
  appid: number;
  appName: string;
  appType: AppType | null;
  isReleased: boolean | null;
  releaseDate: string | null;
  effectiveAt: string;
  burstStartedAt: string;
  burstEndedAt: string;
  eventCount: number;
  sourceSet: ChangeFeedSource[];
  headlineChangeTypes: string[];
  changeTypeCount: number;
  hasRelatedNews: boolean;
  relatedNewsCount: number;
}

export interface ChangeDetailEvent {
  eventId: number;
  appid: number;
  source: ChangeFeedSource;
  changeType: string;
  occurredAt: string;
  beforeValue: JsonValue;
  afterValue: JsonValue;
  context: Record<string, JsonValue | undefined>;
}

export interface ChangeNewsRow {
  gid: string;
  appid: number;
  appName: string;
  appType: AppType | null;
  publishedAt: string | null;
  firstSeenAt: string | null;
  title: string | null;
  feedLabel: string | null;
  feedName: string | null;
  url: string | null;
}

export interface ChangeBurstDetail {
  burstId: string;
  appid: number;
  appName: string;
  appType: AppType | null;
  isReleased: boolean | null;
  releaseDate: string | null;
  effectiveAt: string;
  burstStartedAt: string;
  burstEndedAt: string;
  eventCount: number;
  sourceSet: ChangeFeedSource[];
  headlineChangeTypes: string[];
  changeTypeCount: number;
  hasRelatedNews: boolean;
  relatedNewsCount: number;
  events: ChangeDetailEvent[];
  relatedNews: ChangeNewsRow[];
  impact: ChangeBurstImpact | null;
}

export interface ChangeFeedStatus {
  state: ChangeFeedStatusState;
  queuedJobs: number;
  oldestQueuedAt: string | null;
  latestStorefrontEventAt: string | null;
  latestNewsEventAt: string | null;
  reasons: string[];
}

export interface ChangeFeedBurstsResponse {
  items: ChangeBurstRow[];
  nextCursor: ChangeFeedCursor | null;
  meta: {
    days: number;
    preset: ChangeFeedPreset;
    limit: number;
    appTypes: AppType[] | null;
    sourceFilter: ChangeFeedSource[] | null;
    search: string | null;
  };
}

export interface ChangeFeedNewsResponse {
  items: ChangeNewsRow[];
  nextCursor: ChangeFeedCursor | null;
  meta: {
    days: number;
    limit: number;
    appTypes: AppType[] | null;
    search: string | null;
  };
}

export interface ChangeBurstDetailResponse {
  item: ChangeBurstDetail;
}

export interface RawChangeBurstRow {
  burst_id: string;
  appid: number;
  app_name: string;
  app_type: AppType | null;
  is_released: boolean | null;
  release_date: string | null;
  effective_at: string;
  burst_started_at: string;
  burst_ended_at: string;
  event_count: number;
  source_set: unknown;
  headline_change_types: unknown;
  change_type_count: number;
  has_related_news: boolean;
  related_news_count: number;
}

export interface RawChangeBurstDetailEvent {
  event_id: number;
  appid: number;
  source: ChangeFeedSource;
  change_type: string;
  occurred_at: string;
  before_value: JsonValue;
  after_value: JsonValue;
  context: Record<string, JsonValue | undefined> | null;
}

export interface RawChangeNewsRow {
  gid: string;
  appid: number;
  app_name: string;
  app_type: AppType | null;
  published_at: string | null;
  first_seen_at: string | null;
  title: string | null;
  feedlabel: string | null;
  feedname: string | null;
  url: string | null;
}

export interface RawChangeBurstDetailRow extends RawChangeBurstRow {
  events: RawChangeBurstDetailEvent[] | null;
  related_news: RawChangeNewsRow[] | null;
  impact: Record<string, JsonValue | undefined> | null;
}
