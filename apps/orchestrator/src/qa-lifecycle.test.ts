import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleQaLifecycle } from './qa-lifecycle.js';
import { setupQaLifecycleTest } from './qa-lifecycle-test-helpers.js';

test('rdt handoff creates QA agent and assigns it to the task channel', () => {
  const s = setupQaLifecycleTest();
  s.repos.agents.createAgent({
    id: 'qa',
    nick: 'QA',
    role: 'qa',
    context: 'validates work',
  });
  s.repos.taskEvents.recordEvent({
    taskId: s.task.id,
    actor: 'FeatureImpl',
    eventType: 'result',
    content: 'implemented requested behavior',
  });
  s.repos.taskEvents.recordEvent({
    taskId: s.task.id,
    actor: 'FeatureImpl',
    eventType: 'rdt',
    content: 'ready for QA',
  });

  handleQaLifecycle({
    ingested: { taskId: s.task.id, eventType: 'rdt' },
    repos: s.repos,
    supervisor: s.supervisor,
    irc: s.irc,
  });

  assert.equal(s.repos.tasks.findTask(s.task.id)?.assignedTo, 'qa');
  assert.equal(s.repos.tasks.findTask(s.task.id)?.status, 'testing');
  assert.match(s.assigned[0] ?? '', /^QA:TASK-0001:/);
  assert.match(s.assigned[0] ?? '', /implemented requested behavior/);
  assert.match(s.assigned[0] ?? '', /Do not report \[type:result\] or \[type:rdt\]/);
  assert.match(s.assigned[0] ?? '', /not\.pass.*exactly what needs to change/);
  assert.doesNotMatch(s.assigned[0] ?? '', /Implementation result\/context: ready for QA/);
  s.repos.close();
});

test('qa rdt does not reassign qa after a pass', () => {
  const s = setupQaLifecycleTest();
  s.repos.agents.createAgent({
    id: 'qa',
    nick: 'QA',
    role: 'qa',
    context: 'validates work',
  });
  s.repos.tasks.assignTask(s.task.id, 'qa', 'done');
  s.repos.taskEvents.recordEvent({
    taskId: s.task.id,
    actor: 'QA',
    eventType: 'pass',
    content: 'validated',
  });
  s.repos.taskEvents.recordEvent({
    taskId: s.task.id,
    actor: 'QA',
    eventType: 'rdt',
    content: 'ready for QA',
  });

  handleQaLifecycle({
    ingested: { taskId: s.task.id, eventType: 'rdt' },
    repos: s.repos,
    supervisor: s.supervisor,
    irc: s.irc,
  });

  assert.equal(s.assigned.length, 0);
  assert.equal(s.repos.tasks.findTask(s.task.id)?.status, 'done');
  s.repos.close();
});

test('rdt does not reassign qa while qa already owns the task', () => {
  const s = setupQaLifecycleTest();
  s.repos.agents.createAgent({
    id: 'qa',
    nick: 'QA',
    role: 'qa',
    context: 'validates work',
  });
  s.repos.tasks.assignTask(s.task.id, 'qa', 'testing');
  s.repos.taskEvents.recordEvent({
    taskId: s.task.id,
    actor: 'QA',
    eventType: 'rdt',
    content: 'ready for QA',
  });

  handleQaLifecycle({
    ingested: { taskId: s.task.id, eventType: 'rdt' },
    repos: s.repos,
    supervisor: s.supervisor,
    irc: s.irc,
  });

  assert.equal(s.assigned.length, 0);
  assert.equal(s.repos.tasks.findTask(s.task.id)?.status, 'testing');
  s.repos.close();
});

test('result alone does not start QA before rdt', () => {
  const s = setupQaLifecycleTest();
  s.repos.agents.createAgent({
    id: 'qa',
    nick: 'QA',
    role: 'qa',
    context: 'validates work',
  });

  handleQaLifecycle({
    ingested: { taskId: s.task.id, eventType: 'result' },
    repos: s.repos,
    supervisor: s.supervisor,
    irc: s.irc,
  });

  assert.equal(s.assigned.length, 0);
  assert.equal(s.repos.tasks.findTask(s.task.id)?.assignedTo, 'feature-implementer');
  s.repos.close();
});

test('rdt handoff requires an existing dedicated QA agent', () => {
  const s = setupQaLifecycleTest();

  handleQaLifecycle({
    ingested: { taskId: s.task.id, eventType: 'rdt' },
    repos: s.repos,
    supervisor: s.supervisor,
    irc: s.irc,
  });

  assert.equal(s.repos.agents.findAgent('qa'), null);
  assert.equal(s.repos.tasks.findTask(s.task.id)?.assignedTo, 'feature-implementer');
  assert.equal(s.messages.some((message) => message === 'spawn:QA'), false);
  assert.ok(s.messages.includes('#task-0001:TASK-0001 is ready to test, but QA agent is missing.'));
  s.repos.close();
});
