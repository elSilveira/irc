import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '@irc/db';
import { ingestTaskEvent } from './task-events.js';

function repos() {
  const r = createRepositories(':memory:');
  r.tasks.createTask('Ship heartbeat policy');
  return r;
}

test('ingests a structured ack line and records the event', () => {
  const r = repos();
  const line = '[task:TASK-0001] [from:feature-implementer] [type:ack] [status:working] I received the request.';
  const result = ingestTaskEvent(
    line,
    'feature-implementer',
    r,
    '#control',
  );

  assert.equal(result?.taskId, 'TASK-0001');
  assert.equal(result?.eventType, 'ack');
  assert.equal(result?.approvalId, undefined);
  const events = r.taskEvents.listEvents('TASK-0001');
  assert.equal(events.length, 1);
  const first = events[0];
  assert.equal(first?.eventType, 'ack');
  assert.equal(first?.actor, 'feature-implementer');
  assert.deepEqual(
    r.ircMessages.listMessages('TASK-0001').map((message) => message.message),
    [line],
  );
  r.close();
});

test('uses the IRC sender when the line omits [from:]', () => {
  const r = repos();
  ingestTaskEvent('[task:TASK-0001] [type:wip] still working', 'worker', r);

  assert.equal(r.taskEvents.listEvents('TASK-0001')[0]?.actor, 'worker');
  r.close();
});

test('reflects a derived status onto the task row', () => {
  const r = repos();
  ingestTaskEvent('[task:TASK-0001] [type:done] shipped', 'worker', r);
  assert.equal(r.tasks.findTask('TASK-0001')?.status, 'done');

  const r2 = repos();
  ingestTaskEvent('[task:TASK-0001] [type:blocked] need approval', 'worker', r2);
  assert.equal(r2.tasks.findTask('TASK-0001')?.status, 'blocked');
  r2.close();
  r.close();
});

test('ingests collapsed task markers and applies the final status', () => {
  const r = repos();
  const result = ingestTaskEvent(
    '[task:TASK-0001] [type:ack] start [task:TASK-0001] [type:wip] wrote file [task:TASK-0001] [type:done] completed',
    'worker',
    r,
    '#task-0001',
  );

  assert.equal(result?.eventType, 'done');
  assert.equal(r.tasks.findTask('TASK-0001')?.status, 'done');
  assert.deepEqual(r.taskEvents.listEvents('TASK-0001').map((event) => event.eventType), ['ack', 'wip', 'done']);
  r.close();
});

test('ignores task-event lines for unknown tasks', () => {
  const r = repos();
  const result = ingestTaskEvent('[task:TASK-9999] [type:ack] hi', 'worker', r);
  assert.equal(result, null);
  assert.equal(r.taskEvents.listEvents('TASK-9999').length, 0);
  r.close();
});

test('ignores ordinary chatter', () => {
  const r = repos();
  assert.equal(ingestTaskEvent('hello everyone', 'worker', r), null);
  assert.equal(ingestTaskEvent('@orchestrator read package.json', 'worker', r), null);
  r.close();
});

test('a blocked event opens a pending approval', () => {
  const r = repos();
  const result = ingestTaskEvent('[task:TASK-0001] [type:blocked] need write access', 'worker', r);
  assert.ok(result?.approvalId, 'returns the approval id');
  const pending = r.approvals.findPendingForTask('TASK-0001');
  assert.equal(pending?.id, result?.approvalId);
  assert.equal(pending?.requestedBy, 'worker');
  assert.equal(pending?.action, 'resume');
  r.close();
});

test('repeated blocked events reuse the pending approval', () => {
  const r = repos();
  const first = ingestTaskEvent('[task:TASK-0001] [type:blocked] need write', 'worker', r);
  const second = ingestTaskEvent('[task:TASK-0001] [type:blocked] still blocked', 'worker', r);

  assert.equal(second?.approvalId, first?.approvalId);
  assert.equal(r.approvals.listPending().length, 1);
  r.close();
});
