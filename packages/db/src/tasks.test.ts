import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from './index.js';

test('createTask returns the first task id and channel', () => {
  const repos = createRepositories(':memory:');
  const task = repos.tasks.createTask('Build local IRC control plane');
  assert.equal(task.id, 'TASK-0001');
  assert.equal(task.channel, '#task-0001');
  repos.close();
});

test('createTask increments task ids', () => {
  const repos = createRepositories(':memory:');
  repos.tasks.createTask('one');
  const second = repos.tasks.createTask('two');
  assert.equal(second.id, 'TASK-0002');
  repos.close();
});

test('createTask rejects empty titles', () => {
  const repos = createRepositories(':memory:');
  assert.throws(() => repos.tasks.createTask('   '));
  repos.close();
});

test('listTasks returns persisted tasks', () => {
  const repos = createRepositories(':memory:');
  repos.tasks.createTask('one');
  repos.tasks.createTask('two');
  assert.equal(repos.tasks.listTasks().length, 2);
  repos.close();
});

test('assignTask can set ready or queued status', () => {
  const repos = createRepositories(':memory:');
  const task = repos.tasks.createTask('Route me');

  const ready = repos.tasks.assignTask(task.id, 'feature-agent', 'ready');
  assert.equal(ready.assignedTo, 'feature-agent');
  assert.equal(ready.status, 'ready');

  const queued = repos.tasks.assignTask(task.id, 'feature-agent', 'queued');
  assert.equal(queued.status, 'queued');
  repos.close();
});
