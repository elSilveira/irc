import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '@irc/db';
import {
  collectHeartbeats,
  findStaleTasks,
  parseDbTimestamp,
} from './heartbeat.js';

const NOW = Date.parse('2026-07-03T12:00:00Z');

test('parseDbTimestamp reads SQLite CURRENT_TIMESTAMP as UTC epoch ms', () => {
  assert.equal(parseDbTimestamp('2026-07-03 12:00:00'), NOW);
  assert.equal(parseDbTimestamp(null), null);
  assert.equal(parseDbTimestamp(''), null);
});

test('findStaleTasks flags a doing task whose last heartbeat is too old', () => {
  const beats = [{ taskId: 'TASK-0001', status: 'doing', lastEventAt: NOW - 120_000 }];
  const stale = findStaleTasks(beats, NOW, 60_000);
  assert.deepEqual(stale, [{ taskId: 'TASK-0001', reason: 'stale_wip' }]);
});

test('findStaleTasks flags a doing task with no heartbeat at all', () => {
  const beats = [{ taskId: 'TASK-0002', status: 'doing', lastEventAt: null }];
  const stale = findStaleTasks(beats, NOW, 60_000);
  assert.deepEqual(stale, [{ taskId: 'TASK-0002', reason: 'no_heartbeat' }]);
});

test('findStaleTasks leaves a fresh doing task alone', () => {
  const beats = [{ taskId: 'TASK-0003', status: 'doing', lastEventAt: NOW - 10_000 }];
  assert.deepEqual(findStaleTasks(beats, NOW, 60_000), []);
});

test('findStaleTasks ignores tasks that are not doing', () => {
  const beats = [
    { taskId: 'TASK-0004', status: 'blocked', lastEventAt: NOW - 999_999 },
    { taskId: 'TASK-0005', status: 'done', lastEventAt: null },
  ];
  assert.deepEqual(findStaleTasks(beats, NOW, 60_000), []);
});

test('collectHeartbeats only gathers doing tasks with their last event time', () => {
  const repos = createRepositories(':memory:');
  const active = repos.tasks.createTask('Active');
  const idle = repos.tasks.createTask('Idle');
  repos.tasks.updateStatus(active.id, 'doing');

  const beats = collectHeartbeats(repos);
  assert.deepEqual(
    beats.map((beat) => beat.taskId),
    [active.id],
  );
  assert.equal(beats[0]?.lastEventAt, null);

  repos.taskEvents.recordEvent({ taskId: active.id, actor: 'a', eventType: 'wip', content: 'x' });
  const updated = collectHeartbeats(repos);
  assert.notEqual(updated[0]?.lastEventAt, null);
  assert.equal(repos.tasks.findTask(idle.id)?.status, 'open');
  repos.close();
});
