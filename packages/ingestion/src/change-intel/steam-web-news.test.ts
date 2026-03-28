import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchAppNews } from '../apis/steam-web.js';

test('fetchAppNews treats Steam 403 responses as empty news', async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () =>
      ({
        ok: false,
        status: 403,
      }) as Response;

    const news = await fetchAppNews(1613450, { count: 10 });

    assert.deepEqual(news, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchAppNews still throws for non-403 API failures', async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () =>
      ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }) as Response;

    await assert.rejects(() => fetchAppNews(570, { count: 10 }), /Failed to fetch news for app 570/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
