import assert from 'node:assert/strict';
import test from 'node:test';

import type { ChangeBurstImpact, ChangeBurstImpactWindow } from './change-feed-types';
import { buildChangeImpactMetricRows } from './change-impact-metrics';

function impactWindow(
  overrides: Partial<ChangeBurstImpactWindow> = {}
): ChangeBurstImpactWindow {
  return {
    ccuPeak: null,
    totalReviews: null,
    positiveReviews: null,
    negativeReviews: null,
    reviewsAdded: null,
    positiveAdded: null,
    negativeAdded: null,
    avgDailyReviews: null,
    reviewScore: null,
    reviewScoreLabel: null,
    priceCents: null,
    discountPercent: null,
    metricDays: null,
    reviewDays: null,
    ccuSamples: null,
    ccuSource: null,
    ...overrides,
  };
}

function impact(overrides: Partial<ChangeBurstImpact> = {}): ChangeBurstImpact {
  return {
    baseline7d: impactWindow({
      ccuPeak: 3090,
      totalReviews: 17550,
      reviewsAdded: 59,
      positiveAdded: 6451,
      negativeAdded: 3,
      avgDailyReviews: 9.9199,
      reviewScore: 8,
      priceCents: 2999,
      discountPercent: 0,
      metricDays: 8,
      reviewDays: 8,
      ccuSamples: 114,
    }),
    response1d: impactWindow({
      ccuPeak: 3293,
      totalReviews: 17559,
      reviewsAdded: 9,
      positiveAdded: 9,
      negativeAdded: 0,
      avgDailyReviews: 9,
      reviewScore: 8,
      priceCents: 2999,
      discountPercent: 0,
      metricDays: 2,
      reviewDays: 2,
      ccuSamples: 24,
    }),
    response7d: impactWindow({
      ccuPeak: 4027,
      totalReviews: 17670,
      reviewsAdded: 213,
      positiveAdded: 4529,
      negativeAdded: 1,
      avgDailyReviews: 18.5107,
      reviewScore: 8,
      priceCents: 2999,
      discountPercent: 0,
      metricDays: 8,
      reviewDays: 8,
      ccuSamples: 107,
    }),
    ...overrides,
  };
}

test('buildChangeImpactMetricRows formats metric deltas and hides invalid polarity rows', () => {
  const rows = buildChangeImpactMetricRows(impact());
  const labels = rows.map((row) => row.label);

  assert.ok(labels.includes('Peak CCU'));
  assert.ok(labels.includes('Reviews'));
  assert.ok(labels.includes('Reviews Added'));
  assert.ok(labels.includes('Avg Daily Reviews'));
  assert.ok(!labels.includes('Review %'));
  assert.ok(!labels.includes('CCU Samples'));
  assert.ok(!labels.includes('Metric Days'));
  assert.ok(!labels.includes('Review Days'));
  assert.ok(!labels.includes('Positive Added'));
  assert.ok(!labels.includes('Negative Added'));
  assert.ok(!labels.includes('Price'));
  assert.ok(!labels.includes('Discount'));

  const ccuRow = rows.find((row) => row.id === 'ccuPeak');
  assert.equal(ccuRow?.pre7d, '3,090');
  assert.equal(ccuRow?.post7d, '4,027');
  assert.equal(ccuRow?.delta7d.label, '+937 / +30.3%');
  assert.equal(ccuRow?.delta7d.tone, 'positive');
});

test('buildChangeImpactMetricRows shows polarity rows only when review deltas reconcile', () => {
  const rows = buildChangeImpactMetricRows(
    impact({
      baseline7d: impactWindow({
        reviewsAdded: 10,
        positiveAdded: 8,
        negativeAdded: 2,
      }),
      response1d: impactWindow({
        reviewsAdded: 2,
        positiveAdded: 1,
        negativeAdded: 1,
      }),
      response7d: impactWindow({
        reviewsAdded: 14,
        positiveAdded: 11,
        negativeAdded: 3,
      }),
    })
  );
  const labels = rows.map((row) => row.label);

  assert.ok(labels.includes('Positive Added'));
  assert.ok(labels.includes('Negative Added'));
});

test('buildChangeImpactMetricRows formats changed review score as review percentage', () => {
  const rows = buildChangeImpactMetricRows(
    impact({
      baseline7d: impactWindow({ reviewScore: 8 }),
      response1d: impactWindow({ reviewScore: 8 }),
      response7d: impactWindow({ reviewScore: 9 }),
    })
  );
  const reviewRow = rows.find((row) => row.id === 'reviewScore');

  assert.equal(reviewRow?.label, 'Review %');
  assert.equal(reviewRow?.pre7d, '80%');
  assert.equal(reviewRow?.post1d, '80%');
  assert.equal(reviewRow?.delta1d.label, '0pp');
  assert.equal(reviewRow?.post7d, '90%');
  assert.equal(reviewRow?.delta7d.label, '+10pp');
});

test('buildChangeImpactMetricRows supports already-normalized review percentages', () => {
  const rows = buildChangeImpactMetricRows(
    impact({
      baseline7d: impactWindow({ reviewScore: 83.4 }),
      response1d: impactWindow({ reviewScore: 83.4 }),
      response7d: impactWindow({ reviewScore: 84.9 }),
    })
  );
  const reviewRow = rows.find((row) => row.id === 'reviewScore');

  assert.equal(reviewRow?.pre7d, '83%');
  assert.equal(reviewRow?.post7d, '85%');
  assert.equal(reviewRow?.delta7d.label, '+1.5pp');
});

test('buildChangeImpactMetricRows applies commercial relevance rules', () => {
  const stableRows = buildChangeImpactMetricRows(
    impact({
      baseline7d: impactWindow({ priceCents: 2999, discountPercent: 0 }),
      response1d: impactWindow({ priceCents: 2999, discountPercent: 0 }),
      response7d: impactWindow({ priceCents: 2999, discountPercent: 0 }),
    })
  );
  assert.ok(!stableRows.some((row) => row.id === 'priceCents'));
  assert.ok(!stableRows.some((row) => row.id === 'discountPercent'));

  const pricingRows = buildChangeImpactMetricRows(
    impact({
      baseline7d: impactWindow({ priceCents: 2999, discountPercent: 0 }),
      response1d: impactWindow({ priceCents: 1999, discountPercent: 33 }),
      response7d: impactWindow({ priceCents: 1999, discountPercent: 33 }),
    })
  );
  assert.ok(pricingRows.some((row) => row.id === 'priceCents'));
  assert.ok(pricingRows.some((row) => row.id === 'discountPercent'));

  const signalRows = buildChangeImpactMetricRows(
    impact({
      baseline7d: impactWindow({ priceCents: 2999, discountPercent: 0 }),
      response1d: impactWindow({ priceCents: 2999, discountPercent: 0 }),
      response7d: impactWindow({ priceCents: 2999, discountPercent: 0 }),
    }),
    { changeTypes: ['price_change'] }
  );
  assert.ok(signalRows.some((row) => row.id === 'priceCents'));
});

test('buildChangeImpactMetricRows hides invalid metric rows', () => {
  const rows = buildChangeImpactMetricRows(
    impact({
      baseline7d: impactWindow({ reviewScore: 8, ccuPeak: 100 }),
      response1d: impactWindow({ reviewScore: 101, ccuPeak: 125 }),
      response7d: impactWindow({ reviewScore: 9, ccuPeak: 130 }),
    })
  );

  assert.ok(!rows.some((row) => row.id === 'reviewScore'));
  assert.ok(rows.some((row) => row.id === 'ccuPeak'));
});

test('buildChangeImpactMetricRows preserves sparse window positions', () => {
  const rows = buildChangeImpactMetricRows({
    baseline7d: null,
    response1d: impactWindow({ ccuPeak: 3293, ccuSamples: 24 }),
    response7d: impactWindow({ ccuPeak: 4027, ccuSamples: 107 }),
  });
  const ccuRow = rows.find((row) => row.id === 'ccuPeak');

  assert.equal(ccuRow?.pre7d, '-');
  assert.equal(ccuRow?.post1d, '3,293');
  assert.equal(ccuRow?.delta1d.label, '-');
  assert.equal(ccuRow?.post7d, '4,027');
  assert.equal(ccuRow?.delta7d.label, '-');
});
