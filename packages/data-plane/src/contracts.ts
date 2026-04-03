import type {
  SemanticSearchCandidate,
  SemanticSearchDebugInfo,
  SemanticSearchEngineResult,
  SemanticSearchFilters,
  SemanticSearchReference,
  SemanticSearchResultItem,
} from '@publisheriq/semantic-search';

export type {
  SemanticSearchCandidate,
  SemanticSearchDebugInfo,
  SemanticSearchFilters,
  SemanticSearchReference,
  SemanticSearchResultItem,
};

export type EntityKind = 'game' | 'publisher' | 'developer';
export type EntityPlatform = 'steam' | 'publisheriq';
export type DataPlaneSource = 'supabase-postgres' | 'tiger';
export type MatchQuality = 'exact' | 'prefix' | 'substring';
export type ContractStatus = 'ready' | 'planned';
export type ContractRuntimeReadiness = 'ready' | 'blocked';
export type RankMetric =
  | 'total_reviews'
  | 'owners_midpoint'
  | 'ccu_peak'
  | 'review_score'
  | 'game_count';
export type TraceMetric =
  | 'owners_midpoint'
  | 'ccu_peak'
  | 'total_reviews'
  | 'positive_reviews'
  | 'negative_reviews'
  | 'review_score'
  | 'positive_percentage'
  | 'price_cents'
  | 'discount_percent'
  | 'average_playtime_forever'
  | 'average_playtime_2weeks';
export type ChangeActivityView =
  | 'overview'
  | 'launch-watch'
  | 'commercial-moves'
  | 'store-refreshes'
  | 'all-activity';
export type ChangeActivityMode = 'all' | 'changes' | 'announcements';
export type ChangeActivitySort =
  | 'relevant'
  | 'newest'
  | 'biggest-change'
  | 'most-commercial'
  | 'most-launch-relevant';
export type ChangeActivitySignalFamily =
  | 'announcement'
  | 'release'
  | 'pricing'
  | 'store-page'
  | 'media'
  | 'taxonomy'
  | 'platform'
  | 'build';
export type ChangeActivityStoryKind =
  | 'announcement'
  | 'commercial-move'
  | 'launch-prep'
  | 'store-refresh'
  | 'taxonomy-shift'
  | 'update-tease'
  | 'change-roundup';
export type ChangePattern =
  | 'marketing_push'
  | 'relaunch_pattern'
  | 'update_tease'
  | 'under_marketed'
  | 'signable_candidate'
  | 'rescue_candidate'
  | 'sustained_response'
  | 'announcement_weak_response';
export type CatalogFacetKind = 'tags' | 'genres' | 'categories';
export type DataPlaneRelationKey =
  | 'apps'
  | 'developers'
  | 'publishers'
  | 'app_dlc'
  | 'app_developers'
  | 'app_publishers'
  | 'latest_daily_metrics'
  | 'metrics_daily_metrics'
  | 'core_entities'
  | 'events_app_change_events'
  | 'docs_steam_news_items'
  | 'docs_steam_news_search_projection'
  | 'app_genres'
  | 'steam_genres'
  | 'app_steam_tags'
  | 'steam_tags'
  | 'steam_categories';

export interface QueryProvenance {
  capturedAt: string;
  source: DataPlaneSource;
  tables: string[];
}

export interface ResolveEntitiesRequest {
  entityKinds?: EntityKind[];
  includeMetrics?: boolean;
  limit?: number;
  query: string;
}

export interface ResolvedEntity {
  confidence: number;
  displayName: string;
  entityKind: EntityKind;
  entityUid: string;
  latestMetrics?: {
    ccuPeak: number | null;
    ownersMidpoint: number | null;
    reviewScore: number | null;
    totalReviews: number | null;
  };
  matchQuality: MatchQuality;
  matchedName: string;
  platform: EntityPlatform;
  platformEntityId: string;
  releaseYear?: number | null;
  signals?: {
    gameCount?: number | null;
  };
}

export interface ResolveEntitiesResponse {
  ambiguity: {
    candidateNames: string[];
    message: string | null;
    requiresClarification: boolean;
  };
  entities: ResolvedEntity[];
  provenance: QueryProvenance;
}

export interface SearchCatalogRequest {
  appids?: number[];
  developerIds?: number[];
  continuationToken?: string | null;
  developerQuery?: string | null;
  facetQuery?: string | null;
  genres?: string[];
  includeFacets?: CatalogFacetKind[];
  includeAppTypes?: string[];
  isFree?: boolean | null;
  isReleased?: boolean | null;
  limit?: number;
  minCcu?: number | null;
  minDiscountPercent?: number | null;
  minPriceCents?: number | null;
  minOwners?: number | null;
  minReviewScore?: number | null;
  minReviews?: number | null;
  onSale?: boolean | null;
  parentAppids?: number[];
  platforms?: string[];
  publisherIds?: number[];
  publisherQuery?: string | null;
  query?: string | null;
  releaseYear?: {
    gte?: number | null;
    lte?: number | null;
  } | null;
  sortBy?: 'relevance' | 'reviews' | 'owners' | 'release_date' | 'ccu_peak';
  sortDirection?: 'asc' | 'desc';
  tags?: string[];
  maxPriceCents?: number | null;
}

export interface SearchCatalogItem {
  appid: number;
  appType: string | null;
  ccuPeak: number | null;
  developers: string[];
  developerIds: number[];
  discountPercent: number | null;
  entityUid: string;
  isFree: boolean;
  isReleased: boolean | null;
  name: string;
  ownersMidpoint: number | null;
  parentAppid: number | null;
  platforms: string[];
  priceCents: number | null;
  publishers: string[];
  publisherIds: number[];
  releaseDate: string | null;
  releaseState: string | null;
  releaseYear: number | null;
  reviewScore: number | null;
  totalReviews: number | null;
}

export interface SearchCatalogResponse {
  continuationToken: string | null;
  facets?: {
    canonicalMatch: {
      name: string;
      type: CatalogFacetKind;
    } | null;
    categories: string[];
    genres: string[];
    tags: string[];
  } | null;
  interpretedFilters: {
    appids: number[];
    developerIds: number[];
    developerQuery: string | null;
    facetQuery: string | null;
    genres: string[];
    includeFacets: CatalogFacetKind[];
    includeAppTypes: string[];
    isFree: boolean | null;
    isReleased: boolean | null;
    minCcu: number | null;
    minDiscountPercent: number | null;
    minPriceCents: number | null;
    minOwners: number | null;
    minReviewScore: number | null;
    minReviews: number | null;
    onSale: boolean | null;
    parentAppids: number[];
    platforms: string[];
    publisherIds: number[];
    publisherQuery: string | null;
    query: string | null;
    releaseYear: {
      gte: number | null;
      lte: number | null;
    } | null;
    sortBy: SearchCatalogRequest['sortBy'];
    sortDirection: SearchCatalogRequest['sortDirection'];
    tags: string[];
    maxPriceCents: number | null;
  };
  items: SearchCatalogItem[];
  provenance: QueryProvenance;
  sufficientToAnswer: boolean;
}

export interface GetEntityOverviewRequest {
  entityKind: EntityKind;
  gamesLimit?: number;
  gamesSortBy?: 'release_date' | 'reviews';
  platformEntityId: string;
}

export interface EntityOverviewGameItem {
  appid: number;
  name: string;
  ownersMidpoint: number | null;
  releaseDate: string | null;
  releaseYear: number | null;
  reviewScore: number | null;
  totalReviews: number | null;
}

export interface GetEntityOverviewResponse {
  entity: {
    details: {
      appType: string | null;
      developerIds: number[];
      developers: string[];
      discountPercent: number | null;
      isFree: boolean | null;
      isReleased: boolean | null;
      parentAppid: number | null;
      platforms: string[];
      priceCents: number | null;
      publisherIds: number[];
      publishers: string[];
      releaseDate: string | null;
      releaseState: string | null;
      releaseYear: number | null;
    };
    displayName: string;
    entityKind: EntityKind;
    entityUid: string;
    metrics: {
      ccuPeak: number | null;
      gameCount: number | null;
      ownersMidpoint: number | null;
      reviewScore: number | null;
      totalReviews: number | null;
    };
    platform: EntityPlatform;
    platformEntityId: string;
  };
  games: EntityOverviewGameItem[];
  provenance: QueryProvenance;
  sufficientToAnswer: boolean;
}

export interface RankEntitiesRequest {
  aggregateFilters?: {
    minAverageReviewScore?: number | null;
    minGameCount?: number | null;
    minMinimumReviewScore?: number | null;
  } | null;
  catalogFilters?: {
    developerIds?: number[];
    genres?: string[];
    includeAppTypes?: string[];
    isFree?: boolean | null;
    maxPriceCents?: number | null;
    minPriceCents?: number | null;
    minReviewScore?: number | null;
    minReviews?: number | null;
    onSale?: boolean | null;
    parentAppids?: number[];
    platforms?: string[];
    publisherIds?: number[];
    releaseYear?: {
      gte?: number | null;
      lte?: number | null;
    } | null;
    tags?: string[];
  } | null;
  entityKind: EntityKind;
  limit?: number;
  metric: RankMetric;
  query?: string | null;
  releaseDays?: number | null;
  sortDirection?: 'asc' | 'desc';
}

export interface RankedEntity {
  displayName: string;
  entityKind: EntityKind;
  entityUid: string;
  metricValue: number | null;
  metrics: {
    ccuPeak: number | null;
    gameCount: number | null;
    ownersMidpoint: number | null;
    reviewScore: number | null;
    totalReviews: number | null;
  };
  platform: EntityPlatform;
  platformEntityId: string;
  rank: number;
  releaseYear?: number | null;
}

export interface RankEntitiesResponse {
  entityKind: EntityKind;
  items: RankedEntity[];
  metric: RankMetric;
  provenance: QueryProvenance;
  sufficientToAnswer: boolean;
}

export interface TraceMetricHistoryRequest {
  endDate?: string | null;
  entityUid: string;
  metrics: TraceMetric[];
  startDate?: string | null;
}

export interface TraceMetricHistoryPoint {
  date: string;
  value: number | null;
}

export interface TraceMetricHistorySeriesSummary {
  deltaAbs: number | null;
  deltaPct: number | null;
  firstDate: string | null;
  lastDate: string | null;
  latestValue: number | null;
  pointCount: number;
  startValue: number | null;
}

export interface TraceMetricHistorySeries {
  metric: TraceMetric;
  points: TraceMetricHistoryPoint[];
  summary: TraceMetricHistorySeriesSummary;
}

export interface TraceMetricHistoryResponse {
  entity: {
    displayName: string;
    entityKind: EntityKind;
    entityUid: string;
    platform: EntityPlatform;
    platformEntityId: string;
  };
  endDate: string;
  metrics: TraceMetric[];
  provenance: QueryProvenance;
  series: TraceMetricHistorySeries[];
  startDate: string;
  sufficientToAnswer: boolean;
}

export interface ExplainChangesRequest {
  activityId?: string | null;
  changeTypes?: string[];
  endTime?: string | null;
  entityUid?: string | null;
  includeNews?: boolean;
  limit?: number;
  mode?: 'timeline' | 'before_after';
  sources?: string[];
  startTime?: string | null;
}

export interface ExplainChangesEvent {
  afterValue: unknown | null;
  beforeValue: unknown | null;
  changeType: string;
  context: unknown;
  id: string;
  newsItemGid: string | null;
  occurredAt: string;
  source: string;
}

export interface ExplainChangesLinkedNewsItem {
  feedLabel: string | null;
  feedName: string | null;
  feedScope: string | null;
  firstSeenAt: string;
  gid: string;
  publishedAt: string | null;
  sortTime: string;
  title: string | null;
  url: string;
}

export interface ExplainChangesMoment {
  changeTypes: string[];
  eventCount: number;
  events: ExplainChangesEvent[];
  linkedNews: ExplainChangesLinkedNewsItem[];
  sources: string[];
  windowEnd: string;
  windowStart: string;
}

export interface ExplainChangeMetricsWindow {
  ccuPeak: number | null;
  discountPercent: number | null;
  negativeReviews: number | null;
  positiveReviews: number | null;
  priceCents: number | null;
  reviewScore: number | null;
  reviewScoreLabel: string | null;
  totalReviews: number | null;
}

export interface ExplainChangesResponse {
  comparisonWindows: {
    baseline30d: ExplainChangeMetricsWindow | null;
    baseline7d: ExplainChangeMetricsWindow | null;
    response1d: ExplainChangeMetricsWindow | null;
    response30d: ExplainChangeMetricsWindow | null;
    response7d: ExplainChangeMetricsWindow | null;
  } | null;
  entity: {
    displayName: string;
    entityKind: EntityKind;
    entityUid: string;
    platform: EntityPlatform;
    platformEntityId: string;
  };
  mode: 'timeline' | 'before_after';
  moments: ExplainChangesMoment[];
  provenance: QueryProvenance;
  selectedMoment: ExplainChangesMoment | null;
  sufficientToAnswer: boolean;
  summary: {
    countsByChangeType: Record<string, number>;
    countsBySource: Record<string, number>;
    eventCount: number;
    momentCount: number;
    newsCount: number;
  };
  timeWindow: {
    endTime: string;
    startTime: string;
  };
}

export interface SearchDocumentsRequest {
  endTime?: string | null;
  entityUid?: string | null;
  entityUids?: string[];
  feedScopes?: string[];
  limit?: number;
  mode?: 'topic_search' | 'latest_item' | 'digest';
  query?: string | null;
  startTime?: string | null;
}

export interface SearchDocumentItem {
  appid: number;
  appName: string;
  bodyPreview?: string | null;
  entityUid: string;
  excerpt?: string | null;
  feedLabel: string | null;
  feedName: string | null;
  feedScope: string;
  firstSeenAt: string;
  gid: string;
  matchReason: 'matched_title_phrase' | 'matched_topic_terms' | 'recent_entity_news';
  publishedAt: string | null;
  rank: number;
  sortTime: string;
  title: string | null;
  url: string;
}

export interface SearchDocumentsResponse {
  entity:
    | {
        displayName: string;
        entityKind: EntityKind;
        entityUid: string;
        platform: EntityPlatform;
        platformEntityId: string;
      }
    | null;
  interpretedFilters: {
    endTime: string;
    entityUids: string[];
    feedScopes: string[];
    mode: 'topic_search' | 'latest_item' | 'digest';
    query: string;
    startTime: string;
  };
  items: SearchDocumentItem[];
  latestItem: SearchDocumentItem | null;
  provenance: QueryProvenance;
  sufficientToAnswer: boolean;
}

export interface SearchChangeActivityRequest {
  activityId?: string | null;
  appTypes?: string[];
  continuationToken?: string | null;
  days?: number;
  excludeActivityIds?: string[];
  limit?: number;
  mode?: ChangeActivityMode;
  query?: string | null;
  signalFamilies?: ChangeActivitySignalFamily[];
  sort?: ChangeActivitySort;
  view?: ChangeActivityView;
}

export interface SearchChangeActivityItem {
  activityId: string;
  activityKind: 'change' | 'announcement';
  appType: string | null;
  appid: number;
  externalUrl: string | null;
  facts: string[];
  hasBeforeAfter: boolean;
  headline: string;
  highlightLabels: string[];
  isReleased: boolean | null;
  name: string;
  occurredAt: string;
  relatedAnnouncementCount: number;
  releaseDate: string | null;
  signalFamilies: ChangeActivitySignalFamily[];
  storyKind: ChangeActivityStoryKind;
  summary: string;
}

export interface SearchChangeActivityResponse {
  continuationToken: string | null;
  interpretedFilters: {
    appTypes: string[];
    days: number;
    mode: ChangeActivityMode;
    query: string | null;
    signalFamilies: ChangeActivitySignalFamily[];
    sort: ChangeActivitySort;
    view: ChangeActivityView;
  };
  items: SearchChangeActivityItem[];
  provenance: QueryProvenance;
  sufficientToAnswer: boolean;
}

export interface DiscoverChangePatternProof {
  activityId: string;
  facts: string[];
  headline: string;
  occurredAt: string;
  signalFamilies: ChangeActivitySignalFamily[];
  summary: string;
}

export interface DiscoverChangePatternItem {
  activityIds: string[];
  appType: string | null;
  appid: number;
  confidence: 'high' | 'medium';
  metrics: {
    ccuPeak: number | null;
    ccuTrend7dPct: number | null;
    discountPercent: number | null;
    positivePercentage: number | null;
    priceCents: number | null;
    reviewVelocity30d: number | null;
    reviewVelocity7d: number | null;
    totalReviews: number | null;
    trend30dDirection: string | null;
  } | null;
  name: string;
  occurredAt: string;
  primaryProof: DiscoverChangePatternProof | null;
  reasons: string[];
  signalFamilies: ChangeActivitySignalFamily[];
  storyKinds: ChangeActivityStoryKind[];
}

export interface DiscoverChangePatternsRequest {
  appTypes?: string[];
  continuationToken?: string | null;
  days?: number;
  excludeAppIds?: number[];
  limit?: number;
  pattern: ChangePattern;
  query?: string | null;
}

export interface DiscoverChangePatternsResponse {
  continuationToken: string | null;
  interpretedFilters: {
    appTypes: string[];
    days: number;
    pattern: ChangePattern;
    query: string | null;
  };
  items: DiscoverChangePatternItem[];
  provenance: QueryProvenance;
  sufficientToAnswer: boolean;
}

export interface DiscoverMomentumRequest {
  excludeAppIds?: number[];
  filters?: {
    genres?: string[];
    isFree?: boolean | null;
    maxPriceCents?: number | null;
    maxReviews?: number | null;
    minCcu?: number | null;
    minReviewScore?: number | null;
    minReviews?: number | null;
    minReviewsAdded30d?: number | null;
    minReviewsAdded7d?: number | null;
    platforms?: string[];
    releaseYear?: {
      gte?: number | null;
      lte?: number | null;
    } | null;
    steamDeck?: Array<'playable' | 'verified'>;
    tags?: string[];
  } | null;
  indieHeuristic?: boolean;
  limit?: number;
  sortBy:
    | 'ccu_peak'
    | 'momentum_score'
    | 'review_score'
    | 'reviews_added_30d'
    | 'reviews_added_7d'
    | 'sentiment_delta'
    | 'total_reviews'
    | 'velocity_7d'
    | 'velocity_acceleration';
  sortDirection?: 'asc' | 'desc';
  timeframe?: '7d' | '30d' | 'current';
  trendType?: 'accelerating' | 'breaking_out' | 'declining' | 'review_momentum' | null;
}

export interface DiscoverMomentumItem {
  appid: number;
  ccuGrowth30dPercent: number | null;
  ccuGrowth7dPercent: number | null;
  ccuPeak: number | null;
  developerName: string | null;
  discountPercent: number | null;
  entityUid: string;
  isFree: boolean;
  isSelfPublished: boolean;
  matchedSteamDeck: 'playable' | 'verified' | null;
  momentumScore: number | null;
  name: string;
  platformSupport: string[];
  priceCents: number | null;
  publisherName: string | null;
  releaseDate: string | null;
  releaseYear: number | null;
  reviewPercentage: number | null;
  reviewsAdded30d: number | null;
  reviewsAdded7d: number | null;
  sentimentDelta: number | null;
  steamDeckCategory: string | null;
  supportLevel: 'high' | 'low' | 'medium';
  supportReasons: string[];
  totalReviews: number | null;
  trendDirection: 'down' | 'stable' | 'up' | null;
  velocity30d: number | null;
  velocity7d: number | null;
  velocityAcceleration: number | null;
}

export interface DiscoverMomentumResponse {
  filtersApplied: string[];
  items: DiscoverMomentumItem[];
  provenance: QueryProvenance;
  rankingDefinition: string;
  rankingLabel: string;
  sufficientToAnswer: boolean;
  timeframe: '7d' | '30d' | 'current';
  timeframeLabel: string;
}

export interface SemanticSearchRequest {
  continuationToken?: string | null;
  description?: string | null;
  entityKind: EntityKind;
  filters?: SemanticSearchFilters;
  limit?: number;
  mode: 'concept' | 'similarity';
  referencePlatformEntityId?: string | null;
  referenceQuery?: string | null;
}

export type CompareMetric =
  | 'ccu_peak'
  | 'game_count'
  | 'owners_midpoint'
  | 'review_score'
  | 'total_reviews';

export interface CompareEntitiesRequest {
  entityUids: string[];
  metrics?: CompareMetric[];
}

export interface ComparedEntity {
  displayName: string;
  entityKind: EntityKind;
  entityUid: string;
  metrics: {
    ccuPeak: number | null;
    gameCount: number | null;
    ownersMidpoint: number | null;
    reviewScore: number | null;
    totalReviews: number | null;
  };
  platform: EntityPlatform;
  platformEntityId: string;
  releaseYear?: number | null;
}

export interface CompareEntitiesResponse {
  entityKind: EntityKind;
  highlights: Array<{
    displayName: string;
    entityUid: string;
    metric: CompareMetric;
    value: number | null;
  }>;
  items: ComparedEntity[];
  metrics: CompareMetric[];
  platform: EntityPlatform;
  provenance: QueryProvenance;
  sufficientToAnswer: boolean;
}

export interface SemanticSearchResponse extends SemanticSearchEngineResult {
  provenance: QueryProvenance;
}

export interface ContinueResultSetRequest {
  continuationToken?: string | null;
  delta?: {
    maxPriceCents?: number;
    steamDeck?: Array<'verified' | 'playable'>;
  };
  requestedCount?: number;
  sourceArgs: SearchCatalogRequest | SemanticSearchRequest;
  sourceContract: 'searchCatalog' | 'semanticSearch';
}

export interface ContinueResultSetResponse {
  continuationToken: string | null;
  effectiveArgs: SearchCatalogRequest | SemanticSearchRequest;
  exhausted: boolean;
  provenance: QueryProvenance;
  result: SearchCatalogResponse | SemanticSearchResponse;
  sourceContract: ContinueResultSetRequest['sourceContract'];
  sufficientToAnswer: boolean;
}

export interface QueryContractDescriptor {
  description: string;
  endpoint: string;
  name:
    | 'resolveEntities'
    | 'getEntityOverview'
    | 'searchCatalog'
    | 'searchChangeActivity'
    | 'discoverMomentum'
    | 'discoverChangePatterns'
    | 'rankEntities'
    | 'compareEntities'
    | 'traceMetricHistory'
    | 'explainChanges'
    | 'searchDocuments'
    | 'semanticSearch'
    | 'getUserContext'
    | 'continueResultSet';
  naturalLanguageStrength: string[];
  requiredRelations: DataPlaneRelationKey[];
  status: ContractStatus;
}

export interface RuntimeQueryContractDescriptor extends QueryContractDescriptor {
  blockingTables: string[];
  runtimeReadiness: ContractRuntimeReadiness;
}

export interface DataPlaneReadiness {
  blockedContracts: Array<{
    blockingTables: string[];
    name: QueryContractDescriptor['name'];
  }>;
  provenance: QueryProvenance;
  ready: boolean;
}
