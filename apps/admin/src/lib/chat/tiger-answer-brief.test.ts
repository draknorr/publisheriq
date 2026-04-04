import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTigerSuccessBrief } from './tiger-answer-brief';

test('buildTigerSuccessBrief keeps current-player momentum facts player-centric', () => {
  const brief = buildTigerSuccessBrief({
    fallbackMarkdown: [
      'Counter-Strike 2 currently has the highest player count.',
      '',
      '| Game | Peak CCU | Trend | Total Reviews | Platforms |',
      '| --- | --- | --- | --- | --- |',
      '| Counter-Strike 2 | 1,404,982 | stable | 10,000,000 | windows, linux |',
    ].join('\n'),
    intent: 'momentum_discovery',
    response: {
      items: [
        {
          ccuPeak: 1404982,
          name: 'Counter-Strike 2',
          reviewPercentage: null,
          reviewsAdded7d: 0,
          supportLevel: 'low',
          supportReasons: ['Current-state momentum evidence is limited.'],
          totalReviews: 10000000,
          trendDirection: 'stable',
        },
      ],
      rankingLabel: 'Peak CCU',
      sortBy: 'ccu_peak',
      timeframe: 'current',
      timeframeLabel: 'Current snapshot',
      trendType: null,
    },
    selectionState: null,
  });

  assert.match(brief.directAnswer, /highest player count|peak concurrent users/i);
  assert.ok(brief.keyFacts.some((fact) => /peak CCU/i.test(fact)));
  assert.ok(brief.keyFacts.some((fact) => /total reviews/i.test(fact)));
  assert.ok(brief.keyFacts.every((fact) => !/recent reviews added/i.test(fact)));
});
