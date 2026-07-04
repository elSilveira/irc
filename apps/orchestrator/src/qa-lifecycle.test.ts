import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '@irc/db';
import { handleQaLifecycle } from './qa-lifecycle.js';

function setup() {
  const repos = createRepositories(':memory:');
  const task = repos.tasks.createTask('Build the thing');
  repos.agents.createAgent({
    id: 'feature-implementer',
    nick: 'FeatureImpl',
    role: 'implementer',
    context: 'implements features',
  });
  repos.tasks.assignTask(task.id, 'feature-implementer', 'doing');
  const messages: string[] = [];
  const assigned: string[] = [];
  return {
    repos,
    task,
    messages,
    supervisor: {
      spawn: (agent: { nick: string }) => {
        messages.push(`spawn:${agent.nick}`);
        return {};
      },
      assignTaskChannel: (nick: string, t: { id: string; title: string; channel: string }) => {
        assigned.push(`${nick}:${t.id}:${t.title}`);
        return true;
      },
    },
    irc: { privmsg: (target: string, text: string) => messages.push(`${target}:${text}`) },
    assigned,
  };
}

test('rdt handoff creates QA agent and assigns it to the task channel', () => {
  const s = setup();
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
  s.repos.close();
});

test('rdt handoff requires an existing dedicated QA agent', () => {
  const s = setup();

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

test('pass announces the final accepted result', () => {
  const s = setup();
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

test('not.pass loops the task back to the implementer with QA context', () => {
  const s = setup();
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
  s.repos.close();
});
