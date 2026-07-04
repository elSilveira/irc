import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from './index.js';

test('recordMessage stores an IRC line for a task', () => {
  const repos = createRepositories(':memory:');
  const task = repos.tasks.createTask('Persist protocol line');

  const message = repos.ircMessages.recordMessage({
    channel: '#control',
    sender: 'feature-implementer',
    message: '[task:TASK-0001] [type:ack] starting',
    taskId: task.id,
  });

  assert.equal(message.channel, '#control');
  assert.equal(message.sender, 'feature-implementer');
  assert.equal(message.taskId, task.id);
  assert.ok(message.id > 0);
  repos.close();
});

test('listMessages returns messages for one task in insertion order', () => {
  const repos = createRepositories(':memory:');
  const task = repos.tasks.createTask('Timeline');
  const other = repos.tasks.createTask('Other');

  repos.ircMessages.recordMessage({ channel: '#control', sender: 'a', message: 'first', taskId: task.id });
  repos.ircMessages.recordMessage({ channel: '#control', sender: 'a', message: 'ignored', taskId: other.id });
  repos.ircMessages.recordMessage({ channel: '#control', sender: 'a', message: 'second', taskId: task.id });

  assert.deepEqual(
    repos.ircMessages.listMessages(task.id).map((message) => message.message),
    ['first', 'second'],
  );
  repos.close();
});
