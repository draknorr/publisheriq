import assert from 'node:assert/strict';
import test from 'node:test';

import type { ChangeDetailEvent, JsonValue } from './change-feed-types';
import { buildDiffPreviews } from './change-feed-presenters';

function changeEvent(overrides: Partial<ChangeDetailEvent>): ChangeDetailEvent {
  return {
    eventId: overrides.eventId ?? 1,
    appid: overrides.appid ?? 2868840,
    source: overrides.source ?? 'media',
    changeType: overrides.changeType ?? 'header_url_changed',
    occurredAt: overrides.occurredAt ?? '2026-03-18T16:03:27.184Z',
    beforeValue: overrides.beforeValue ?? null,
    afterValue: overrides.afterValue ?? null,
    context: overrides.context ?? {},
  };
}

test('query-only hero asset URL changes render as timestamp notes', () => {
  const diffs = buildDiffPreviews([
    changeEvent({
      beforeValue: 'https://cdn.example.com/apps/1/header.jpg?t=100',
      afterValue: 'https://cdn.example.com/apps/1/header.jpg?t=200',
    }),
  ]);

  assert.equal(diffs.length, 1);
  assert.equal(diffs[0]?.kind, 'note');
  assert.equal(diffs[0]?.label, 'Header art');
  assert.equal(
    diffs[0]?.note,
    'Steam asset timestamp refreshed; image path unchanged. t: 100 -> 200'
  );
  assert.equal(diffs[0]?.beforeImageUrl, null);
  assert.equal(diffs[0]?.afterImageUrl, null);
});

test('verified same-path content hash changes still render media diffs', () => {
  const beforeUrl = 'https://cdn.example.com/apps/1/header.jpg?t=100';
  const afterUrl = 'https://cdn.example.com/apps/1/header.jpg?t=200';
  const diffs = buildDiffPreviews([
    changeEvent({
      beforeValue: beforeUrl,
      afterValue: afterUrl,
      context: { mediaChangeReason: 'content_hash_changed' },
    }),
  ]);

  assert.equal(diffs.length, 1);
  assert.equal(diffs[0]?.kind, 'media');
  assert.equal(diffs[0]?.beforeImageUrl, beforeUrl);
  assert.equal(diffs[0]?.afterImageUrl, afterUrl);
});

test('paired query-only screenshot churn collapses into one timestamp note', () => {
  const beforeUrl = 'https://cdn.example.com/apps/1/ss_a.jpg?t=100';
  const afterUrl = 'https://cdn.example.com/apps/1/ss_a.jpg?t=200';
  const diffs = buildDiffPreviews([
    changeEvent({
      eventId: 10,
      changeType: 'screenshot_removed',
      beforeValue: [beforeUrl],
    }),
    changeEvent({
      eventId: 11,
      changeType: 'screenshot_added',
      afterValue: [afterUrl],
    }),
  ]);

  assert.equal(diffs.length, 1);
  assert.equal(diffs[0]?.kind, 'note');
  assert.equal(diffs[0]?.label, 'Screenshots');
  assert.equal(
    diffs[0]?.note,
    'Steam asset timestamp refreshed; image path unchanged. t: 100 -> 200'
  );
});

test('mixed screenshot churn keeps real added and removed images', () => {
  const timestampBefore = 'https://cdn.example.com/apps/1/ss_a.jpg?t=100';
  const timestampAfter = 'https://cdn.example.com/apps/1/ss_a.jpg?t=200';
  const removedReal = 'https://cdn.example.com/apps/1/ss_old.jpg?t=100';
  const addedReal = 'https://cdn.example.com/apps/1/ss_new.jpg?t=200';
  const diffs = buildDiffPreviews([
    changeEvent({
      eventId: 20,
      changeType: 'screenshot_removed',
      beforeValue: [timestampBefore, removedReal] satisfies JsonValue,
    }),
    changeEvent({
      eventId: 21,
      changeType: 'screenshot_added',
      afterValue: [timestampAfter, addedReal] satisfies JsonValue,
    }),
  ]);

  assert.equal(diffs.length, 3);
  assert.equal(diffs[0]?.kind, 'note');
  assert.deepEqual(diffs[1]?.added, [addedReal]);
  assert.deepEqual(diffs[2]?.removed, [removedReal]);
});
