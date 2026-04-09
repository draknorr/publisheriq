import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTigerChatRenderData,
  buildTigerClarificationRenderData,
} from './chat-render-data';
import { removeMarkdownTables } from '@/components/chat/content/parsers';

test('buildTigerChatRenderData maps current-player momentum rows to render data', () => {
  const renderData = buildTigerChatRenderData({
    contractName: 'discoverMomentum',
    response: {
      items: [
        {
          appid: 730,
          ccuPeak: 1404982,
          ccuSparkline: [1200000, 1275000, 1310000, 1404982],
          name: 'Counter-Strike 2',
          platformSupport: ['windows', 'linux'],
          totalReviews: 9495164,
          trendDirection: 'up',
        },
      ],
      rankingLabel: 'Peak CCU',
      timeframe: 'current',
    },
  });

  assert.deepEqual(renderData, {
    kind: 'momentum_current_players',
    rankingLabel: 'Peak CCU',
    rows: [
      {
        appid: 730,
        ccuPeak: 1404982,
        ccuSparkline: [1200000, 1275000, 1310000, 1404982],
        name: 'Counter-Strike 2',
        platformSupport: ['windows', 'linux'],
        totalReviews: 9495164,
        trendDirection: 'up',
      },
    ],
  });
});

test('buildTigerChatRenderData ignores non-current momentum screens', () => {
  const renderData = buildTigerChatRenderData({
    contractName: 'discoverMomentum',
    response: {
      items: [
        {
          appid: 1145360,
          ccuPeak: 50000,
          ccuSparkline: [41000, 43000, 50000],
          name: 'Hades II',
        },
      ],
      rankingLabel: 'Reviews Added (7d)',
      timeframe: '7d',
    },
  });

  assert.equal(renderData, null);
});

test('buildTigerChatRenderData maps metric-history responses to chart render data', () => {
  const renderData = buildTigerChatRenderData({
    contractName: 'traceMetricHistory',
    response: {
      entity: { displayName: 'Counter-Strike 2' },
      endDate: '2026-04-05',
      series: [
        {
          metric: 'ccu_peak',
          points: [
            { date: '2026-03-30', value: 1300000 },
            { date: '2026-04-05', value: 1404982 },
          ],
          summary: {
            deltaAbs: 104982,
            deltaPct: 8.08,
            firstDate: '2026-03-30',
            lastDate: '2026-04-05',
            latestValue: 1404982,
            pointCount: 2,
            startValue: 1300000,
          },
        },
      ],
      startDate: '2026-03-30',
    },
  });

  assert.deepEqual(renderData, {
    endDate: '2026-04-05',
    entityName: 'Counter-Strike 2',
    kind: 'metric_history',
    series: [
      {
        metric: 'ccu_peak',
        points: [
          { date: '2026-03-30', value: 1300000 },
          { date: '2026-04-05', value: 1404982 },
        ],
        summary: {
          deltaAbs: 104982,
          deltaPct: 8.08,
          firstDate: '2026-03-30',
          lastDate: '2026-04-05',
          latestValue: 1404982,
          pointCount: 2,
          startValue: 1300000,
        },
      },
    ],
    startDate: '2026-03-30',
  });
});

test('buildTigerClarificationRenderData maps ambiguous selection state to clickable render data', () => {
  const renderData = buildTigerClarificationRenderData({
    originalPrompt: "What's the CCU for Counter-Strike 2?",
    selectionState: {
      family: 'entity_overview',
      slots: [
        {
          candidates: [
            {
              displayName: 'Counter-Strike 2',
              entityKind: 'game',
              entityUid: 'steam:game:730',
              matchQuality: 'exact',
              matchSource: 'canonical_name',
              ordinal: 1,
              platform: 'steam',
              platformEntityId: '730',
              releaseYear: 2023,
              resolutionTier: 'canonical_exact',
              score: 100,
              totalReviews: 2000000,
            },
            {
              displayName: 'Counter-Strike: Condition Zero',
              entityKind: 'game',
              entityUid: 'steam:game:80',
              matchQuality: 'exact',
              matchSource: 'canonical_name',
              ordinal: 2,
              platform: 'steam',
              platformEntityId: '80',
              releaseYear: 2004,
              resolutionTier: 'canonical_exact',
              score: 99,
              totalReviews: 100000,
            },
          ],
          continuationToken: null,
          expectedEntityKind: 'game',
          label: 'game',
          query: 'Counter-Strike 2',
          requiresClarification: true,
          selectedEntityUid: null,
          slotId: 'primary',
          totalCandidates: 2,
        },
      ],
    },
  });

  assert.deepEqual(renderData, {
    family: 'entity_overview',
    kind: 'entity_clarification',
    originalPrompt: "What's the CCU for Counter-Strike 2?",
    slots: [
      {
        candidates: [
          {
            displayName: 'Counter-Strike 2',
            entityKind: 'game',
            entityUid: 'steam:game:730',
            matchQuality: 'exact',
            matchSource: 'canonical_name',
            ordinal: 1,
            platform: 'steam',
            platformEntityId: '730',
            releaseYear: 2023,
            resolutionTier: 'canonical_exact',
            selectedEntity: {
              displayName: 'Counter-Strike 2',
              entityKind: 'game',
              entityUid: 'steam:game:730',
              matchQuality: 'exact',
              platform: 'steam',
              platformEntityId: '730',
            },
            totalReviews: 2000000,
          },
          {
            displayName: 'Counter-Strike: Condition Zero',
            entityKind: 'game',
            entityUid: 'steam:game:80',
            matchQuality: 'exact',
            matchSource: 'canonical_name',
            ordinal: 2,
            platform: 'steam',
            platformEntityId: '80',
            releaseYear: 2004,
            resolutionTier: 'canonical_exact',
            selectedEntity: {
              displayName: 'Counter-Strike: Condition Zero',
              entityKind: 'game',
              entityUid: 'steam:game:80',
              matchQuality: 'exact',
              platform: 'steam',
              platformEntityId: '80',
            },
            totalReviews: 100000,
          },
        ],
        continuationToken: null,
        expectedEntityKind: 'game',
        label: 'game',
        query: 'Counter-Strike 2',
        requiresClarification: true,
        slotId: 'primary',
        totalCandidates: 2,
      },
    ],
  });
});

test('removeMarkdownTables strips structured tables but preserves surrounding copy', () => {
  const content = [
    'Here are the current leaders.',
    '',
    '| Game | Peak CCU |',
    '| --- | --- |',
    '| Counter-Strike 2 | 1,404,982 |',
    '',
    'Snapshot date: **2026-04-05**.',
  ].join('\n');

  assert.equal(
    removeMarkdownTables(content),
    ['Here are the current leaders.', '', 'Snapshot date: **2026-04-05**.'].join('\n')
  );
});
