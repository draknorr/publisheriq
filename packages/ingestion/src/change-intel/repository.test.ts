import assert from 'node:assert/strict';
import test from 'node:test';
import { enqueueCaptureJobs } from './repository.js';

interface QueueRpcArgs {
  p_jobs: Array<Record<string, unknown>>;
}

test('enqueueCaptureJobs delegates dedupe-safe inserts to enqueue_app_capture_queue', async () => {
  let rpcName: string | null = null;
  let rpcArgs: QueueRpcArgs | null = null;

  const supabase = {
    rpc(name: string, args: QueueRpcArgs) {
      rpcName = name;
      rpcArgs = args;
      return Promise.resolve({ data: 1, error: null });
    },
  } as any;

  const inserted = await enqueueCaptureJobs(supabase, [
    {
      appid: 10,
      source: 'storefront',
      triggerReason: 'steam_app_change_hint',
      triggerCursor: '123:456',
      priority: 100,
      payload: { source: 'hint' },
    },
    {
      appid: 10,
      source: 'news',
      triggerReason: 'stale_news_catchup',
      triggerCursor: null,
      priority: 25,
    },
  ]);

  assert.equal(inserted, 1);
  assert.equal(rpcName, 'enqueue_app_capture_queue');
  if (!rpcArgs) {
    throw new Error('Expected enqueue_app_capture_queue RPC to be called');
  }
  const queueRows = (rpcArgs as QueueRpcArgs).p_jobs;
  assert.equal(queueRows.length, 2);
  assert.deepEqual(queueRows[0], {
    appid: 10,
    source: 'storefront',
    priority: 100,
    trigger_reason: 'steam_app_change_hint',
    trigger_cursor: '123:456',
    payload: { source: 'hint' },
    available_at: queueRows[0].available_at,
  });
  assert.deepEqual(queueRows[1], {
    appid: 10,
    source: 'news',
    priority: 25,
    trigger_reason: 'stale_news_catchup',
    trigger_cursor: '',
    payload: {},
    available_at: queueRows[0].available_at,
  });
  assert.ok(typeof queueRows[0].available_at === 'string');
  assert.ok(!Number.isNaN(Date.parse(String(queueRows[0].available_at))));
});

test('enqueueCaptureJobs returns zero without issuing an RPC for empty batches', async () => {
  let called = false;
  const supabase = {
    rpc() {
      called = true;
      return Promise.resolve({ data: 0, error: null });
    },
  } as any;

  const inserted = await enqueueCaptureJobs(supabase, []);

  assert.equal(inserted, 0);
  assert.equal(called, false);
});

test('enqueueCaptureJobs surfaces RPC errors', async () => {
  const supabase = {
    rpc() {
      return Promise.resolve({ data: null, error: { message: 'boom' } });
    },
  } as any;

  await assert.rejects(
    () =>
      enqueueCaptureJobs(supabase, [
        {
          appid: 10,
          source: 'storefront',
          triggerReason: 'steam_app_change_hint',
          triggerCursor: '123:456',
        },
      ]),
    /Failed to enqueue app capture jobs: boom/
  );
});
