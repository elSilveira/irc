const test = require('node:test');
const assert = require('node:assert/strict');

const { firstTaskId, nextTaskId, taskChannel } = require('../src/task-ids');

test('creates the first task id', () => {
  assert.equal(firstTaskId(), 'TASK-0001');
});

test('increments padded task ids', () => {
  assert.equal(nextTaskId('TASK-0001'), 'TASK-0002');
  assert.equal(nextTaskId('TASK-0099'), 'TASK-0100');
});

test('formats task channel names', () => {
  assert.equal(taskChannel('TASK-0007'), '#task-0007');
});
