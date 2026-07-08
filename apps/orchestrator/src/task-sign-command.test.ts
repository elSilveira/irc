import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '@irc/db';
import { handleCommand, type CommandServices } from './commands.js';
import type { IrcClient } from './irc.js';

test('sign marks a task done and starts the next queued task for its agent', () => {
  const repos = createRepositories(':memory:');
  repos.agents.createAgent({
    id: 'feature-implementer',
    nick: 'FeatureImpl',
    role: 'implementer',
    context: 'implements features',
  });
  const current = repos.tasks.createTask('Current task');
  repos.tasks.assignTask(current.id, 'feature-implementer', 'doing');
  const queued = repos.tasks.createTask('Queued task');
  repos.tasks.assignTask(queued.id, 'feature-implementer', 'queued');
  const assigned: string[] = [];
  const sent: string[] = [];
  const services: CommandServices = {
    irc: { privmsg: (target: string, text: string) => sent.push(`${target}:${text}`), join: () => {}, send: () => {} } as unknown as IrcClient,
    repos,
    nick: 'orchestrator',
    channels: ['#control'],
    agentSupervisor: {
      assignTaskChannel: (nick, task) => {
        assigned.push(`${nick}:${task.id}`);
        return true;
      },
    },
  };

  const result = handleCommand({ name: 'sign', args: ['task-0001'] }, services);

  assert.equal(result.handled, true);
  assert.equal(repos.tasks.findTask(current.id)?.status, 'done');
  assert.equal(repos.tasks.findTask(queued.id)?.status, 'ready');
  assert.deepEqual(assigned, ['FeatureImpl:TASK-0002']);
  assert.match(sent.at(-1) ?? '', /TASK-0001 signed off; status done/);
  repos.close();
});
