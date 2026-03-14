import assert from 'node:assert/strict';
import test from 'node:test';
import { partitionHintRows } from './hints.js';

test('partitionHintRows skips unknown apps and only marks changed known apps', () => {
  const batch = [
    { appid: 10, lastModified: 100, priceChangeNumber: 5 },
    { appid: 20, lastModified: 200, priceChangeNumber: 8 },
    { appid: 30, lastModified: 300, priceChangeNumber: 9 },
  ];

  const knownAppids = new Set([10, 20]);
  const existingRows = new Map([
    [10, { appid: 10, steam_last_modified: 100, steam_price_change_number: 5 }],
    [20, { appid: 20, steam_last_modified: 150, steam_price_change_number: 8 }],
  ]);

  const result = partitionHintRows(batch, knownAppids, existingRows);

  assert.deepEqual(result.knownRows, [
    { appid: 10, lastModified: 100, priceChangeNumber: 5 },
    { appid: 20, lastModified: 200, priceChangeNumber: 8 },
  ]);
  assert.deepEqual(result.changedRows, [
    { appid: 20, lastModified: 200, priceChangeNumber: 8 },
  ]);
  assert.deepEqual(result.skippedRows, [
    { appid: 30, lastModified: 300, priceChangeNumber: 9 },
  ]);
});

test('partitionHintRows treats known apps without sync_status rows as changed', () => {
  const batch = [{ appid: 40, lastModified: 400, priceChangeNumber: 12 }];

  const result = partitionHintRows(batch, new Set([40]), new Map());

  assert.deepEqual(result.knownRows, batch);
  assert.deepEqual(result.changedRows, batch);
  assert.deepEqual(result.skippedRows, []);
});
