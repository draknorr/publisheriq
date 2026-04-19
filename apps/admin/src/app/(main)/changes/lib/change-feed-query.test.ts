import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChangeFeedActivityRpcArgs,
  buildChangeFeedNewsRpcArgs,
  parseChangeFeedActivityParams,
  parseChangeFeedNewsParams,
} from './change-feed-query';
import {
  buildChangeFeedUrl,
  parseChangeFeedSelectedGames,
} from './change-feed-url';

function queryFromUrl(path: string): URLSearchParams {
  return new URLSearchParams(path.slice(path.indexOf('?') + 1));
}

test('change feed activity params parse exact-title all-history app IDs', () => {
  const params = parseChangeFeedActivityParams(
    new URLSearchParams('days=30&history=all&appIds=3321460,3321460&mode=changes')
  );

  assert.deepEqual(params.appIds, [3321460]);
  assert.equal(params.historyScope, 'all');
  assert.equal(params.days, 30);
  assert.equal(params.mode, 'changes');

  const rpcArgs = buildChangeFeedActivityRpcArgs(params);
  assert.deepEqual(rpcArgs.p_appids, [3321460]);
  assert.equal(rpcArgs.p_all_history, true);
});

test('change feed history all falls back to range without app IDs', () => {
  const params = parseChangeFeedActivityParams(new URLSearchParams('history=all'));
  const rpcArgs = buildChangeFeedActivityRpcArgs(params);

  assert.equal(params.historyScope, 'range');
  assert.equal(rpcArgs.p_appids, null);
  assert.equal(rpcArgs.p_all_history, false);
});

test('change feed news params pass app IDs and all-history to RPC args', () => {
  const params = parseChangeFeedNewsParams(
    new URLSearchParams('history=all&appIds=3321460&cursorTime=2026-04-16T00%3A00%3A00.000Z&cursorKey=gid-1')
  );

  const rpcArgs = buildChangeFeedNewsRpcArgs(params);

  assert.equal(params.historyScope, 'all');
  assert.deepEqual(rpcArgs.p_appids, [3321460]);
  assert.equal(rpcArgs.p_all_history, true);
  assert.equal(rpcArgs.p_cursor_gid, 'gid-1');
});

test('change feed URL builder preserves app names, activity, and full inspector', () => {
  const url = buildChangeFeedUrl('/changes', new URLSearchParams(), {
    appIds: '3321460',
    appNames: ['Crimson Desert'],
    history: 'all',
    activity: 'change:burst-3321460-1',
    inspector: 'full',
  });
  const params = queryFromUrl(url);

  assert.equal(url.startsWith('/changes?'), true);
  assert.equal(params.get('appIds'), '3321460');
  assert.deepEqual(params.getAll('appNames'), ['Crimson Desert']);
  assert.equal(params.get('history'), 'all');
  assert.equal(params.get('activity'), 'change:burst-3321460-1');
  assert.equal(params.get('inspector'), 'full');
});

test('change feed selected games parse repeated app names', () => {
  const selectedGames = parseChangeFeedSelectedGames(
    new URLSearchParams('appIds=3321460,1145350&appNames=Crimson+Desert&appNames=Hades+II')
  );

  assert.deepEqual(selectedGames, [
    { appid: 3321460, name: 'Crimson Desert' },
    { appid: 1145350, name: 'Hades II' },
  ]);
});
