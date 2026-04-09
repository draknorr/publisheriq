import assert from 'node:assert/strict';
import test from 'node:test';

import { extractEntitySearchQuery } from './chat-entity-picker';

test('extractEntitySearchQuery captures reversed single-entity metric prompts', () => {
  assert.equal(
    extractEntitySearchQuery('what CCU is Counter Strike 2?'),
    'Counter Strike 2'
  );
});
