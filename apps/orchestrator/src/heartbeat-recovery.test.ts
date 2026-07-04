import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '@irc/db';
import { recoverStaleTasks } from './heartbeat-recovery.js';

test('recoverStaleTasks resumes stale doing work without a new assignment ack', () => {
  const repos = createRepositories(':memory:');
  repos.agents.createAgent({
    id: 'feature-implementer',
    nick: 'FeatureImpl',
    role: 'implementer',
    context: 'implements features',
  });
  const task = repos.tasks.createTask('Keep working');
  repos.tasks.assignTask(task.id, 'feature-implementer', 'doing');

  const resumed: string[] = [];
  const messages: string[] = [];
  recoverStaleTasks({
    repos,
    stale: [{ taskId: task.id, reason: 'stale_wip' }],
    supervisor: {
      resumeTaskChannel: (nick, task, reason) => {
        resumed.push(`${nick}:${task.id}:${reason}:${task.title}`);
        return true;
      },
    },
    irc: { privmsg: (target, text) => messages.push(`${target}:${text}`) },
    logsChannel: '#logs',
  });

  assert.equal(resumed[0], 'FeatureImpl:TASK-0001:stale_wip:Keep working');
  assert.equal(repos.tasks.findTask(task.id)?.status, 'doing');
  assert.equal(
    repos.taskEvents.listEvents(task.id).some((event) => event.actor === 'orchestrator' && event.eventType === 'heartbeat.resume'),
    true,
  );
  assert.equal(messages.some((message) => /stale \(stale_wip\); htb resume FeatureImpl/.test(message)), true);
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
    supervisor: { resumeTaskChannel: () => true },
    irc: { privmsg: (target, text) => messages.push(`${target}:${text}`) },
    logsChannel: '#logs',
  });

  assert.equal(messages.at(-1), '#logs:[heartbeat] TASK-0001 stale (no_heartbeat); no assigned agent to resume');
  repos.close();
});
