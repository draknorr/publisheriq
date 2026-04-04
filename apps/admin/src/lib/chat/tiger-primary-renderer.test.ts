import assert from 'node:assert/strict';
import test from 'node:test';

import { renderTigerPrimaryResult } from './tiger-primary-renderer';

test('renderTigerPrimaryResult uses player-centric columns for current Peak CCU momentum answers', () => {
  const markdown = renderTigerPrimaryResult({
    matchedIntent: 'momentum_discovery',
    response: {
      items: [
        {
          appid: 730,
          ccuPeak: 1404982,
          name: 'Counter-Strike 2',
          platformSupport: ['windows', 'linux'],
          reviewPercentage: null,
          reviewsAdded7d: 0,
          supportLevel: 'low',
          supportReasons: ['Current-state momentum evidence is limited.'],
          totalReviews: 10000000,
          trendDirection: 'stable',
        },
      ],
      rankingDefinition: 'Peak CCU uses the latest 24-hour concurrent-player snapshot.',
      rankingLabel: 'Peak CCU',
      sortBy: 'ccu_peak',
      sufficientToAnswer: true,
      timeframe: 'current',
      timeframeLabel: 'Current snapshot',
      trendType: null,
    },
  });

  assert.match(markdown, /\| Game \| Peak CCU \| Trend \| Total Reviews \| Platforms \|/);
  assert.doesNotMatch(markdown, /Reviews Added \(7d\)/);
  assert.doesNotMatch(markdown, /Review %/);
});

test('renderTigerPrimaryResult keeps review-centric columns for review momentum answers', () => {
  const markdown = renderTigerPrimaryResult({
    matchedIntent: 'momentum_discovery',
    response: {
      items: [
        {
          appid: 1145360,
          ccuPeak: 50000,
          name: 'Hades II',
          platformSupport: ['windows'],
          reviewPercentage: 96,
          reviewsAdded7d: 2400,
          reviewsAdded30d: 5200,
          supportLevel: 'high',
          supportReasons: ['2,400 reviews added over 7d.'],
          totalReviews: 75000,
          trendDirection: 'up',
        },
      ],
      rankingDefinition: 'Reviews added (7d) counts net new reviews in the last 7 days.',
      rankingLabel: 'Reviews Added (7d)',
      sortBy: 'reviews_added_7d',
      sufficientToAnswer: true,
      timeframe: '7d',
      timeframeLabel: 'Last 7 days',
      trendType: 'review_momentum',
    },
  });

  assert.match(markdown, /\| Game \| Reviews Added \(7d\) \| Review % \| Total Reviews \| Peak CCU \| Platforms \|/);
});
