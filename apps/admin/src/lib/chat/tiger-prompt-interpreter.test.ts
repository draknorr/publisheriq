import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseTigerPromptInterpretation,
  tigerInterpretationMeetsThreshold,
} from './tiger-prompt-interpreter';

test('parseTigerPromptInterpretation normalizes valid JSON payloads', () => {
  const interpretation = parseTigerPromptInterpretation(`
    \`\`\`json
    {
      "intent": "entity_overview",
      "confidence": "high",
      "contractCandidates": ["resolveEntities", "getEntityOverview", "unknownContract"],
      "entities": [{"query": "Assetto Corsa", "role": "primary", "kindHint": "game"}],
      "filters": {
        "platforms": ["windows"],
        "steamDeck": ["verified", "unsupported"],
        "maxPriceCents": 2000
      },
      "continuationAction": "none"
    }
    \`\`\`
  `);

  assert.deepEqual(interpretation, {
    clarificationQuestion: null,
    confidence: 'high',
    continuationAction: 'none',
    contractCandidates: ['resolveEntities', 'getEntityOverview'],
    entities: [{ kindHint: 'game', query: 'Assetto Corsa', role: 'primary' }],
    filters: {
      genres: undefined,
      isFree: undefined,
      maxPriceCents: 2000,
      maxReviews: undefined,
      minReviews: undefined,
      platforms: ['windows'],
      releaseYear: null,
      relationKind: null,
      steamDeck: ['verified'],
      tags: undefined,
    },
    intent: 'entity_overview',
    timeWindow: null,
  });
});

test('tigerInterpretationMeetsThreshold compares confidence levels correctly', () => {
  assert.equal(
    tigerInterpretationMeetsThreshold(
      {
        confidence: 'medium',
        continuationAction: 'none',
        contractCandidates: [],
        entities: [],
        intent: 'news_search',
      },
      'medium'
    ),
    true
  );
  assert.equal(
    tigerInterpretationMeetsThreshold(
      {
        confidence: 'medium',
        continuationAction: 'none',
        contractCandidates: [],
        entities: [],
        intent: 'news_search',
      },
      'high'
    ),
    false
  );
});
