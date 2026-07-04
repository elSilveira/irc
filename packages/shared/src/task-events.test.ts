import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTaskEvent,
  parseTaskEvents,
  formatTaskEvent,
  isTaskEventType,
  isTaskId,
  deriveTaskId,
  TASK_EVENT_TYPES,
} from './task-events.js';

test('parseTaskEvent reads the full canonical header', () => {
  const event = parseTaskEvent(
    '[task:TASK-0001] [from:feature-implementer] [type:ack] [status:working] I received the request.',
  );
  assert.deepEqual(event, {
    taskId: 'TASK-0001',
    from: 'feature-implementer',
    type: 'ack',
    status: 'working',
    content: 'I received the request.',
  });
});

test('parseTaskEvent treats from and status as optional', () => {
  const event = parseTaskEvent('[task:TASK-0009] [type:ack] I received the request.');
  assert.equal(event?.taskId, 'TASK-0009');
  assert.equal(event?.from, null);
  assert.equal(event?.status, null);
  assert.equal(event?.content, 'I received the request.');
});

test('parseTaskEvent captures multiline bodies', () => {
  const event = parseTaskEvent(
    '[task:TASK-0001] [from:feature-implementer] [type:result] [status:complete]\nImplementation plan:\n1. Add heartbeat',
  );
  assert.equal(event?.status, 'complete');
  assert.match(event?.content ?? '', /Implementation plan:/);
  assert.match(event?.content ?? '', /Add heartbeat/);
});

test('parseTaskEvent keeps chain markers inside the body', () => {
  const event = parseTaskEvent(
    '[task:TASK-0001] [type:wip] [chain:abc123ef] still working',
  );
  assert.match(event?.content ?? '', /\[chain:abc123ef\] still working/);
});

test('parseTaskEvent returns null for ordinary chatter', () => {
  assert.equal(parseTaskEvent('hello everyone'), null);
  assert.equal(parseTaskEvent('@orchestrator read package.json'), null);
  assert.equal(parseTaskEvent('[chain:abc123ef] follow up'), null);
});

test('parseTaskEvents splits collapsed task markers in one IRC line', () => {
  const events = parseTaskEvents(
    '[task:TASK-0001] [type:ack] acknowledged [task:TASK-0001] [type:wip] wrote file [task:TASK-0001] [type:done] completed',
  );

  assert.deepEqual(events.map((event) => event.type), ['ack', 'wip', 'done']);
  assert.equal(events[0]?.content, 'acknowledged');
  assert.equal(events[1]?.content, 'wrote file');
  assert.equal(events[2]?.content, 'completed');
});

test('formatTaskEvent round-trips a parsed event', () => {
  const original = '[task:TASK-0001] [from:feature-implementer] [type:done] [status:complete] shipped';
  const formatted = formatTaskEvent(parseTaskEvent(original)!);
  assert.equal(formatted, original);
});

test('formatTaskEvent omits absent from and status segments', () => {
  const formatted = formatTaskEvent({
    taskId: 'TASK-0007',
    from: null,
    type: 'ack',
    status: null,
    content: 'got it',
  });
  assert.equal(formatted, '[task:TASK-0007] [type:ack] got it');
});

test('formatTaskEvent drops the body when empty', () => {
  const formatted = formatTaskEvent({
    taskId: 'TASK-0007',
    from: 'worker',
    type: 'wip',
    status: 'working',
    content: '   ',
  });
  assert.equal(formatted, '[task:TASK-0007] [from:worker] [type:wip] [status:working]');
});

test('isTaskEventType guards the known event set', () => {
  assert.equal(isTaskEventType('ack'), true);
  assert.equal(isTaskEventType('context.request'), true);
  assert.equal(isTaskEventType('rdt'), true);
  assert.equal(isTaskEventType('testing'), true);
  assert.equal(isTaskEventType('tested'), true);
  assert.equal(isTaskEventType('pass'), true);
  assert.equal(isTaskEventType('not.pass'), true);
  assert.equal(isTaskEventType('nope'), false);
  assert.equal(TASK_EVENT_TYPES.length, 15);
});

test('isTaskId recognises tracked task ids', () => {
  assert.equal(isTaskId('TASK-0001'), true);
  assert.equal(isTaskId('task-0042'), true);
  assert.equal(isTaskId('TASK-XYZ'), false);
  assert.equal(isTaskId('#task-0001'), false);
});

test('deriveTaskId reads the task from a structured line', () => {
  assert.equal(deriveTaskId('[task:TASK-0007] [type:ack] hi', '#control'), 'TASK-0007');
});

test('deriveTaskId reads the task from a task channel name', () => {
  assert.equal(deriveTaskId('plain message', '#task-0042'), 'TASK-0042');
});

test('deriveTaskId returns null without task context', () => {
  assert.equal(deriveTaskId('hello everyone', '#control'), null);
  assert.equal(deriveTaskId('[chain:abc123ef] follow up', '#agents'), null);
});
