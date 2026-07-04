import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from './index.js';

test('recordEvent stores a task event and returns it', () => {
  const repos = createRepositories(':memory:');
  const task = repos.tasks.createTask('Ship heartbeat policy');

  const record = repos.taskEvents.recordEvent({
    taskId: task.id,
    actor: 'feature-implementer',
    eventType: 'ack',
    content: 'I received the request.',
  });

  assert.equal(record.taskId, task.id);
  assert.equal(record.actor, 'feature-implementer');
  assert.equal(record.eventType, 'ack');
  assert.equal(record.content, 'I received the request.');
  assert.ok(record.id > 0);
  repos.close();
});

test('listEvents returns events in insertion order for a task', () => {
  const repos = createRepositories(':memory:');
  const task = repos.tasks.createTask('Multi-step work');

  repos.taskEvents.recordEvent({ taskId: task.id, actor: 'worker', eventType: 'ack', content: 'ack' });
  repos.taskEvents.recordEvent({ taskId: task.id, actor: 'worker', eventType: 'wip', content: 'step 1' });
  repos.taskEvents.recordEvent({ taskId: task.id, actor: 'worker', eventType: 'done', content: 'shipped' });

  const events = repos.taskEvents.listEvents(task.id);
  assert.deepEqual(
    events.map((event) => event.eventType),
    ['ack', 'wip', 'done'],
  );
  repos.close();
});

test('listEvents is scoped to one task', () => {
  const repos = createRepositories(':memory:');
  const a = repos.tasks.createTask('A');
  const b = repos.tasks.createTask('B');

  repos.taskEvents.recordEvent({ taskId: a.id, actor: 'x', eventType: 'ack', content: 'a' });
  repos.taskEvents.recordEvent({ taskId: b.id, actor: 'x', eventType: 'ack', content: 'b' });

  assert.equal(repos.taskEvents.listEvents(a.id).length, 1);
  assert.equal(repos.taskEvents.listEvents(b.id).length, 1);
  repos.close();
});

test('updateStatus changes the task status', () => {
  const repos = createRepositories(':memory:');
  const task = repos.tasks.createTask('Status check');

  const updated = repos.tasks.updateStatus(task.id, 'doing');

  assert.equal(updated.status, 'doing');
  assert.equal(repos.tasks.findTask(task.id)?.status, 'doing');
  repos.close();
});

test('updateStatus throws for an unknown task', () => {
  const repos = createRepositories(':memory:');
  assert.throws(() => repos.tasks.updateStatus('TASK-9999', 'doing'));
  repos.close();
});

test('findTask returns null for an unknown task', () => {
  const repos = createRepositories(':memory:');
  assert.equal(repos.tasks.findTask('TASK-9999'), null);
  repos.close();
});

test('createTask leaves a task unassigned', () => {
  const repos = createRepositories(':memory:');
  const task = repos.tasks.createTask('Unassigned');
  assert.equal(task.assignedTo, null);
  assert.equal(repos.tasks.findTask(task.id)?.assignedTo, null);
  repos.close();
});

test('assignTask sets the assignee and moves status to ready', () => {
  const repos = createRepositories(':memory:');
  const task = repos.tasks.createTask('Assign me');

  const assigned = repos.tasks.assignTask(task.id, 'feature-implementer');

  assert.equal(assigned.assignedTo, 'feature-implementer');
  assert.equal(assigned.status, 'ready');
  assert.equal(repos.tasks.findTask(task.id)?.assignedTo, 'feature-implementer');
  repos.close();
});

test('assignTask throws for an unknown task', () => {
  const repos = createRepositories(':memory:');
  assert.throws(() => repos.tasks.assignTask('TASK-9999', 'worker'));
  repos.close();
});

test('latestEventAt returns null when a task has no events', () => {
  const repos = createRepositories(':memory:');
  const task = repos.tasks.createTask('Quiet task');
  assert.equal(repos.taskEvents.latestEventAt(task.id), null);
  repos.close();
});

test('latestEventAt returns the most recent event timestamp', () => {
  const repos = createRepositories(':memory:');
  const task = repos.tasks.createTask('Chatty task');
  repos.taskEvents.recordEvent({ taskId: task.id, actor: 'a', eventType: 'ack', content: 'first' });
  repos.taskEvents.recordEvent({ taskId: task.id, actor: 'a', eventType: 'wip', content: 'second' });

  const events = repos.taskEvents.listEvents(task.id);
  const latest = repos.taskEvents.latestEventAt(task.id);
  assert.ok(latest, 'latest timestamp is present');
  assert.equal(latest, events[events.length - 1]?.createdAt);
  repos.close();
});
