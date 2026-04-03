import assert from 'node:assert/strict';
import test from 'node:test';

import { DataPlaneService } from './service.js';

function createService(): DataPlaneService {
  return new DataPlaneService({
    connectionString: 'postgres://localhost/test',
    maxPoolSize: 1,
    source: 'tiger',
    statementTimeoutMs: 1000,
  });
}

test('continueResultSet forwards searchCatalog continuations through the catalog contract', async () => {
  const service = createService();
  let receivedArgs: Record<string, unknown> | null = null;

  (service as any).assertContractRuntime = async () => undefined;
  (service as any).searchCatalog = async (args: Record<string, unknown>) => {
    receivedArgs = args;
    return {
      continuationToken: 'cursor-2',
      interpretedFilters: {
        developerQuery: null,
        genres: [],
        isFree: null,
        minCcu: null,
        minOwners: null,
        minReviewScore: null,
        minReviews: null,
        platforms: [],
        publisherQuery: null,
        query: 'roguelike',
        releaseYear: null,
        sortBy: 'relevance',
        sortDirection: 'desc',
        tags: [],
      },
      items: [{ appid: 367520, entityUid: 'game:steam:367520', isFree: false, name: 'Hollow Knight', ccuPeak: null, developers: [], ownersMidpoint: null, platforms: [], publishers: [], releaseDate: null, releaseYear: null, reviewScore: null, totalReviews: null }],
      provenance: {
        capturedAt: '2026-04-01T00:00:00.000Z',
        source: 'tiger',
        tables: ['legacy.apps'],
      },
      sufficientToAnswer: true,
    };
  };

  const result = await service.continueResultSet({
    continuationToken: 'cursor-1',
    requestedCount: 3,
    sourceArgs: { query: 'roguelike' },
    sourceContract: 'searchCatalog',
  });

  assert.deepEqual(receivedArgs, {
    continuationToken: 'cursor-1',
    limit: 3,
    query: 'roguelike',
  });
  assert.equal(result.sourceContract, 'searchCatalog');
  assert.equal(result.continuationToken, 'cursor-2');
});

test('continueResultSet narrows semantic game continuations with bounded deltas', async () => {
  const service = createService();
  let receivedArgs: Record<string, unknown> | null = null;

  (service as any).assertContractRuntime = async () => undefined;
  (service as any).semanticSearch = async (args: Record<string, unknown>) => {
    receivedArgs = args;
    return {
      continuation_token: null,
      provenance: {
        capturedAt: '2026-04-01T00:00:00.000Z',
        source: 'tiger',
        tables: ['qdrant:publisheriq_games'],
      },
      results: [{ id: 367520, name: 'Hollow Knight', score: 0.94 }],
      sufficient_to_answer: true,
    };
  };

  const result = await service.continueResultSet({
    continuationToken: 'cursor-9',
    delta: {
      maxPriceCents: 2000,
      steamDeck: ['verified'],
    },
    requestedCount: 4,
    sourceArgs: {
      entityKind: 'game',
      filters: {
        max_price_cents: 4000,
      },
      mode: 'similarity',
      referenceQuery: 'Hades',
    },
    sourceContract: 'semanticSearch',
  });

  assert.deepEqual(receivedArgs, {
    continuationToken: 'cursor-9',
    entityKind: 'game',
    filters: {
      max_price_cents: 2000,
      steam_deck: ['verified'],
    },
    limit: 4,
    mode: 'similarity',
    referenceQuery: 'Hades',
  });
  assert.equal(result.sourceContract, 'semanticSearch');
  assert.equal(result.exhausted, true);
});

test('discoverMomentum returns Tiger momentum rows as typed items', async () => {
  const service = createService();

  (service as any).assertContractRuntime = async () => undefined;
  (service as any).queryMomentumRows = async () => [
    {
      appid: 730,
      ccu_growth_30d_percent: 12,
      ccu_growth_7d_percent: 8,
      ccu_peak: 1500000,
      developer_name: 'Valve',
      discount_percent: 0,
      is_free: true,
      is_self_published: true,
      name: 'Counter-Strike 2',
      owners_midpoint: 100000000,
      platforms: 'windows',
      positive_percentage: 88,
      price_cents: 0,
      publisher_name: 'Valve',
      release_date: '2023-09-27',
      release_year: 2023,
      reviews_added_30d: 42000,
      reviews_added_7d: 9000,
      sentiment_delta: 1.4,
      total_reviews: 9000000,
      trend_direction: 'up',
      velocity_30d: 1400,
      velocity_7d: 1285,
      velocity_acceleration: 12,
    },
  ];
  (service as any).applyMomentumQdrantFilters = async (rows: unknown[]) => rows;

  const result = await service.discoverMomentum({
    filters: { isFree: true },
    sortBy: 'ccu_peak',
    timeframe: 'current',
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.appid, 730);
  assert.equal(result.items[0]?.momentumScore, 9006);
  assert.equal(result.rankingLabel, 'Peak CCU');
  assert.equal(result.timeframe, 'current');
});

test('searchCatalog can answer facet-only taxonomy lookups without querying items', async () => {
  const service = createService();

  (service as any).assertContractRuntime = async () => undefined;
  (service as any).assertTigerSearchFiltersSupported = async () => undefined;
  (service as any).lookupCatalogFacets = async () => ({
    canonicalMatch: {
      name: 'Colony Sim',
      type: 'tags',
    },
    categories: [],
    genres: [],
    tags: ['Colony Sim', 'Base Building'],
  });

  const result = await service.searchCatalog({
    facetQuery: 'colony sim',
    includeFacets: ['tags'],
    limit: 5,
  });

  assert.equal(result.items.length, 0);
  assert.equal(result.facets?.tags[0], 'Colony Sim');
  assert.equal(result.interpretedFilters.facetQuery, 'colony sim');
  assert.deepEqual(result.interpretedFilters.includeFacets, ['tags']);
  assert.equal(result.sufficientToAnswer, true);
});

test('discoverMomentum only checks Tiger tag backfill when tag filters are requested', async () => {
  const service = createService();
  let requiredRelations: string[] | null = null;

  (service as any).getBlockingTables = async (relations: string[]) => {
    requiredRelations = relations;
    return [];
  };

  await (service as any).assertTigerMomentumFiltersSupported({
    filters: { isFree: true },
    sortBy: 'ccu_peak',
  });
  assert.equal(requiredRelations, null);

  await (service as any).assertTigerMomentumFiltersSupported({
    filters: { tags: ['Horror'] },
    sortBy: 'reviews_added_30d',
  });
  assert.deepEqual(requiredRelations, ['app_steam_tags', 'steam_tags']);
});

test('searchChangeActivity narrows raw event queries by requested signal families', async () => {
  const service = createService();
  let receivedParams: Record<string, unknown> | null = null;

  (service as any).assertContractRuntime = async () => undefined;
  (service as any).querySearchChangeEventRows = async (params: Record<string, unknown>) => {
    receivedParams = params;
    return [];
  };
  (service as any).queryNewsRowsByGids = async () => [];

  const result = await service.searchChangeActivity({
    appTypes: ['game'],
    days: 30,
    signalFamilies: ['store-page', 'media'],
    sort: 'biggest-change',
    view: 'store-refreshes',
  });

  assert.deepEqual(receivedParams, {
    appTypes: ['game'],
    changeTypes: [
      'description_rewrite',
      'short_description_rewrite',
      'capsule_url_changed',
      'header_url_changed',
      'background_url_changed',
      'screenshot_added',
      'screenshot_removed',
      'screenshot_reordered',
      'trailer_added',
      'trailer_removed',
      'trailer_reordered',
      'trailer_thumbnail_changed',
    ],
    days: 30,
    limit: 800,
    query: null,
  });
  assert.equal(result.items.length, 0);
  assert.equal(result.sufficientToAnswer, false);
});

test('discoverChangePatterns narrows candidate activity reads to pattern-relevant signal families', async () => {
  const service = createService();
  let receivedParams: Record<string, unknown> | null = null;

  (service as any).assertContractRuntime = async () => undefined;
  (service as any).querySearchChangeEventRows = async (params: Record<string, unknown>) => {
    receivedParams = params;
    return [];
  };
  (service as any).queryNewsRowsByGids = async () => [];

  const result = await service.discoverChangePatterns({
    appTypes: ['game'],
    days: 30,
    limit: 8,
    pattern: 'marketing_push',
  });

  assert.deepEqual(receivedParams, {
    appTypes: ['game'],
    changeTypes: [
      'price_change',
      'discount_start',
      'discount_end',
      'dlc_references_changed',
      'package_references_changed',
      'news_published',
      'news_edited',
      'capsule_url_changed',
      'header_url_changed',
      'background_url_changed',
      'screenshot_added',
      'screenshot_removed',
      'screenshot_reordered',
      'trailer_added',
      'trailer_removed',
      'trailer_reordered',
      'trailer_thumbnail_changed',
      'description_rewrite',
      'short_description_rewrite',
    ],
    days: 30,
    limit: 800,
    query: null,
  });
  assert.equal(result.items.length, 0);
  assert.equal(result.sufficientToAnswer, false);
});

test('compareEntities rejects fewer than two unique entities', async () => {
  const service = createService();
  (service as any).assertContractRuntime = async () => undefined;

  await assert.rejects(
    () =>
      service.compareEntities({
        entityUids: ['game:steam:1', 'game:steam:1'],
      }),
    /between 2 and 5 unique entityUids/
  );
});

test('rankEntities forwards expanded company ranking requests to the company ranking query', async () => {
  const service = createService();
  let receivedRequest: unknown = null;

  (service as any).assertContractRuntime = async () => undefined;
  (service as any).queryRankedCompanies = async (
    entityKind: string,
    request: unknown,
    limit: number,
    direction: string
  ) => {
    receivedRequest = { direction, entityKind, limit, request };
    return [];
  };

  await service.rankEntities({
    aggregateFilters: {
      minAverageReviewScore: 85,
      minGameCount: 5,
    },
    catalogFilters: {
      onSale: true,
      tags: ['Roguelike'],
    },
    entityKind: 'publisher',
    metric: 'game_count',
    releaseDays: 180,
  });

  assert.deepEqual(receivedRequest, {
    direction: 'DESC',
    entityKind: 'publisher',
    limit: 10,
    request: {
      aggregateFilters: {
        minAverageReviewScore: 85,
        minGameCount: 5,
      },
      catalogFilters: {
        onSale: true,
        tags: ['Roguelike'],
      },
      entityKind: 'publisher',
      metric: 'game_count',
      releaseDays: 180,
    },
  });
});

test('compareEntities rejects more than five unique entities', async () => {
  const service = createService();
  (service as any).assertContractRuntime = async () => undefined;

  await assert.rejects(
    () =>
      service.compareEntities({
        entityUids: [
          'game:steam:1',
          'game:steam:2',
          'game:steam:3',
          'game:steam:4',
          'game:steam:5',
          'game:steam:6',
        ],
      }),
    /between 2 and 5 unique entityUids/
  );
});

test('compareEntities returns current-state metrics, preserves requested metric order, and supports five peers', async () => {
  const service = createService();

  (service as any).assertContractRuntime = async () => undefined;
  (service as any).resolveCoreEntity = async (entityUid: string) => ({
    canonical_name:
      entityUid === 'game:steam:1'
        ? 'Hades'
        : entityUid === 'game:steam:2'
          ? 'Dead Cells'
          : entityUid === 'game:steam:3'
            ? 'Slay the Spire'
            : entityUid === 'game:steam:4'
              ? 'Risk of Rain 2'
              : 'Rogue Legacy 2',
    entity_kind: 'game',
    entity_uid: entityUid,
    platform: 'steam',
    platform_entity_id: entityUid.split(':').at(-1) ?? '0',
  });
  (service as any).queryComparedGames = async () =>
    new Map([
      [
        1,
        {
          ccu_peak: 25000,
          display_name: 'Hades',
          entity_id: 1,
          game_count: null,
          owners_midpoint: 1500000,
          release_year: 2020,
          review_score: 98,
          total_reviews: 250000,
        },
      ],
      [
        2,
        {
          ccu_peak: 18000,
          display_name: 'Dead Cells',
          entity_id: 2,
          game_count: null,
          owners_midpoint: 1200000,
          release_year: 2018,
          review_score: 97,
          total_reviews: 140000,
        },
      ],
      [
        3,
        {
          ccu_peak: 16000,
          display_name: 'Slay the Spire',
          entity_id: 3,
          game_count: null,
          owners_midpoint: 1800000,
          release_year: 2019,
          review_score: 97,
          total_reviews: 150000,
        },
      ],
      [
        4,
        {
          ccu_peak: 42000,
          display_name: 'Risk of Rain 2',
          entity_id: 4,
          game_count: null,
          owners_midpoint: 3000000,
          release_year: 2020,
          review_score: 93,
          total_reviews: 190000,
        },
      ],
      [
        5,
        {
          ccu_peak: 9000,
          display_name: 'Rogue Legacy 2',
          entity_id: 5,
          game_count: null,
          owners_midpoint: 700000,
          release_year: 2022,
          review_score: 90,
          total_reviews: 28000,
        },
      ],
    ]);

  const result = await service.compareEntities({
    entityUids: [
      'game:steam:1',
      'game:steam:2',
      'game:steam:3',
      'game:steam:4',
      'game:steam:5',
    ],
    metrics: ['total_reviews', 'review_score', 'ccu_peak'],
  });

  assert.equal(result.entityKind, 'game');
  assert.equal(result.platform, 'steam');
  assert.deepEqual(result.metrics, ['total_reviews', 'review_score', 'ccu_peak']);
  assert.deepEqual(
    result.highlights.map((item) => [item.metric, item.displayName]),
    [
      ['total_reviews', 'Hades'],
      ['review_score', 'Hades'],
      ['ccu_peak', 'Risk of Rain 2'],
    ]
  );
  assert.equal(result.items[0]?.displayName, 'Hades');
  assert.equal(result.items[1]?.displayName, 'Dead Cells');
  assert.equal(result.items[4]?.displayName, 'Rogue Legacy 2');
});

test('getEntityOverview returns company metrics and related games', async () => {
  const service = createService();

  (service as any).assertContractRuntime = async () => undefined;
  (service as any).queryCompanyOverview = async () => ({
    app_type: null,
    appid: null,
    ccu_peak: 12000,
    developer_ids: [],
    developers: [],
    discount_percent: null,
    display_name: 'FromSoftware',
    entity_id: 3005,
    game_count: 7,
    is_free: null,
    is_released: null,
    owners_midpoint: 4000000,
    parent_appid: null,
    platforms: null,
    price_cents: null,
    publisher_ids: [],
    publishers: [],
    release_date: null,
    release_state: null,
    release_year: null,
    review_score: 94,
    total_reviews: 600000,
  });
  (service as any).queryEntityOverviewGames = async () => ([
    {
      appid: 1245620,
      name: 'ELDEN RING',
      owners_midpoint: 2500000,
      release_date: '2022-02-25',
      release_year: 2022,
      review_score: 94,
      total_reviews: 700000,
    },
  ]);

  const result = await service.getEntityOverview({
    entityKind: 'developer',
    gamesLimit: 5,
    gamesSortBy: 'reviews',
    platformEntityId: '3005',
  });

  assert.equal(result.entity.displayName, 'FromSoftware');
  assert.equal(result.entity.metrics.gameCount, 7);
  assert.equal(result.games.length, 1);
  assert.equal(result.games[0]?.name, 'ELDEN RING');
});

test('explainChanges before_after mode includes the selected moment and comparison windows', async () => {
  const service = createService();

  (service as any).assertContractRuntime = async () => undefined;
  (service as any).resolveCoreEntity = async () => ({
    canonical_name: 'Hades',
    entity_kind: 'game',
    entity_uid: 'steam:game:1145360',
    platform: 'steam',
    platform_entity_id: '1145360',
  });
  (service as any).queryChangeEvents = async () => [
    {
      after_value: 'New trailer',
      before_value: null,
      change_type: 'trailer_added',
      context: null,
      id: 'event-1',
      news_item_gid: null,
      occurred_at: '2026-03-20T12:00:00.000Z',
      source: 'storefront',
    },
  ];
  (service as any).buildExplainMoments = () => [
    {
      directNewsGids: new Set<string>(),
      events: [
        {
          after_value: 'New trailer',
          before_value: null,
          change_type: 'trailer_added',
          context: null,
          id: 'event-1',
          news_item_gid: null,
          occurred_at: '2026-03-20T12:00:00.000Z',
          source: 'storefront',
        },
      ],
      linkedNews: [],
      windowEnd: new Date('2026-03-20T18:00:00.000Z'),
      windowStart: new Date('2026-03-20T12:00:00.000Z'),
    },
  ];
  (service as any).buildExplainComparisonWindows = async () => ({
    baseline30d: { ccuPeak: 100, discountPercent: 0, negativeReviews: 10, positiveReviews: 90, priceCents: 1999, reviewScore: 90, reviewScoreLabel: 'Very Positive', totalReviews: 100 },
    baseline7d: null,
    response1d: null,
    response30d: null,
    response7d: null,
  });

  const result = await service.explainChanges({
    entityUid: 'steam:game:1145360',
    includeNews: false,
    mode: 'before_after',
  });

  assert.equal(result.mode, 'before_after');
  assert.equal(result.selectedMoment?.eventCount, 1);
  assert.equal(result.comparisonWindows?.baseline30d?.reviewScoreLabel, 'Very Positive');
});
