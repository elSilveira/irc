import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '@irc/db';
import { recoverStaleTasks } from './heartbeat-recovery.js';

test('recoverStaleTasks reassigns stale doing work to the current agent', () => {
  const repos = createRepositories(':memory:');
  repos.agents.createAgent({
    id: 'feature-implementer',
    nick: 'FeatureImpl',
    role: 'implementer',
    context: 'implements features',
  });
  const task = repos.tasks.createTask('Keep working');
  repos.tasks.assignTask(task.id, 'feature-implementer', 'doing');

  const assigned: string[] = [];
  const messages: string[] = [];
  recoverStaleTasks({
    repos,
    stale: [{ taskId: task.id, reason: 'stale_wip' }],
    supervisor: {
      assignTaskChannel: (nick, resumed) => {
        assigned.push(`${nick}:${resumed.id}:${resumed.title}`);
        return true;
      },
    },
    irc: { privmsg: (target, text) => messages.push(`${target}:${text}`) },
    logsChannel: '#logs',
  });

  assert.match(assigned[0] ?? '', /^FeatureImpl:TASK-0001:/);
  assert.match(assigned[0] ?? '', /Resume this stale task/);
  assert.match(assigned[0] ?? '', /Keep working/);
  assert.equal(repos.tasks.findTask(task.id)?.status, 'doing');
  assert.equal(
    repos.taskEvents.listEvents(task.id).some((event) => event.actor === 'orchestrator' && event.eventType === 'heartbeat.resume'),
    true,
  );
  assert.equal(messages.some((message) => /stale \(stale_wip\); resuming FeatureImpl/.test(message)), true);
  repos.close();
});

test('recoverStaleTasks reports stale work without an assigned agent', () => {
  const repos = createRepositories(':memory:');
  const task = repos.tasks.createTask('No owner');
  repos.tasks.updateStatus(task.id, 'doing');
  const messages: string[] = [];

  recoverStaleTasks({
    repos,
    stale: [{ taskId: task.id, reason: 'no_heartbeat' }],
    supervisor: { assignTaskChannel: () => true },
    irc: { privmsg: (target, text) => messages.push(`${target}:${text}`) },
    logsChannel: '#logs',
  });

  assert.equal(messages.at(-1), '#logs:[heartbeat] TASK-0001 stale (no_heartbeat); no assigned agent to resume');
  repos.close();
});
