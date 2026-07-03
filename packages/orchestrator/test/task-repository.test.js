const test = require('node:test');
const assert = require('node:assert/strict');

const { createTaskRepository } = require('../src/task-repository');

test('creates first task with split channel', () => {
  const repo = createTaskRepository(':memory:');

  assert.deepEqual(repo.createTask('Build agent'), {
    id: 'TASK-0001',
    title: 'Build agent',
    status: 'open',
    channel: '#task-0001',
  });

  repo.close();
});
