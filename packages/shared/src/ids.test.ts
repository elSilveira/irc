import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstTaskId, nextTaskId, taskChannel, formatTaskId } from './ids.js';

test('creates the first task id', () => {
  assert.equal(firstTaskId(), 'TASK-0001');
});

test('increments padded task ids', () => {
  assert.equal(nextTaskId('TASK-0001'), 'TASK-0002');
  assert.equal(nextTaskId('TASK-0042'), 'TASK-0043');
  assert.equal(nextTaskId('TASK-9999'), 'TASK-10000');
});

test('formats task channel names', () => {
  assert.equal(taskChannel('TASK-0001'), '#task-0001');
});

test('formatTaskId pads width', () => {
  assert.equal(formatTaskId(7), 'TASK-0007');
});
