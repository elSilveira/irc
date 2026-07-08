import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleQaLifecycle } from './qa-lifecycle.js';
import { setupQaLifecycleTest } from './qa-lifecycle-test-helpers.js';

test('pass announces the final accepted result', () => {
  const s = setupQaLifecycleTest();
  handleQaLifecycle({
    ingested: { taskId: s.task.id, eventType: 'pass' },
    repos: s.repos,
    supervisor: s.supervisor,
    irc: s.irc,
  });

  assert.ok(s.messages.includes('#task-0001:TASK-0001 passed QA; final answer is ready.'));
  assert.equal(s.repos.tasks.findTask(s.task.id)?.status, 'done');
  s.repos.close();
});

test('pass starts the next queued task for the implementer', () => {
  const s = setupQaLifecycleTest();
  const queued = s.repos.tasks.createTask('Next queued task');
  s.repos.tasks.assignTask(queued.id, 'feature-implementer', 'queued');
  s.repos.taskEvents.recordEvent({
    taskId: s.task.id,
    actor: 'FeatureImpl',
    eventType: 'result',
    content: 'finished first task',
  });

  handleQaLifecycle({
    ingested: { taskId: s.task.id, eventType: 'pass' },
    repos: s.repos,
    supervisor: s.supervisor,
    irc: s.irc,
  });

  assert.equal(s.repos.tasks.findTask(queued.id)?.status, 'ready');
  assert.deepEqual(s.assigned, ['FeatureImpl:TASK-0002:Next queued task']);
  s.repos.close();
});

test('not.pass loops the task back to the implementer with QA context', () => {
  const s = setupQaLifecycleTest();
  s.repos.taskEvents.recordEvent({
    taskId: s.task.id,
    actor: 'FeatureImpl',
    eventType: 'result',
    content: 'created partial modal implementation',
  });
  s.repos.taskEvents.recordEvent({
    taskId: s.task.id,
    actor: 'QA',
    eventType: 'not.pass',
    content: 'missing regression test',
  });

  handleQaLifecycle({
    ingested: { taskId: s.task.id, eventType: 'not.pass' },
    repos: s.repos,
    supervisor: s.supervisor,
    irc: s.irc,
  });

  assert.equal(s.repos.tasks.findTask(s.task.id)?.assignedTo, 'feature-implementer');
  assert.equal(s.repos.tasks.findTask(s.task.id)?.status, 'ready');
  assert.match(s.assigned[0] ?? '', /^FeatureImpl:TASK-0001:/);
  assert.match(s.assigned[0] ?? '', /missing regression test/);
  assert.match(s.assigned[0] ?? '', /created partial modal implementation/);
  assert.match(s.assigned[0] ?? '', /Fix the QA feedback/);
  assert.equal(
    s.repos.taskEvents.listEvents(s.task.id).some((event) => event.actor === 'orchestrator' && event.eventType === 'assign'),
    true,
  );
  s.repos.close();
});
