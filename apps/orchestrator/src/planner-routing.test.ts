import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '@irc/db';
import { handleCommand, type CommandServices } from './commands.js';
import { buildAgentSystemPrompt } from './agent-turn.js';
import type { IrcClient } from './irc.js';

function setup() {
  const sent: { target: string; text: string }[] = [];
  const assignedChannels: string[] = [];
  const irc = {
    privmsg: (target: string, text: string) => sent.push({ target, text }),
    join: () => {},
    send: () => {},
  } as unknown as IrcClient;
  const services: CommandServices = {
    irc,
    repos: createRepositories(':memory:'),
    nick: 'orchestrator',
    channels: ['#control'],
    agentSupervisor: {
      assignTaskChannel: (nick, task) => {
        assignedChannels.push(`${nick}:${task.id}:${task.channel}`);
        return true;
      },
    },
  };
  return { services, sent, assignedChannels };
}

test('new assigns available planning agent before feature implementer', () => {
  const c = setup();
  c.services.repos.agents.createAgent({
    id: 'feature-implementer',
    nick: 'FeatureImpl',
    role: 'implementation',
    context: 'implements scoped features',
    strengths: 'feature,implementation,typescript',
  });
  c.services.repos.agents.createAgent({
    id: 'plan-agent',
    nick: 'Planner',
    role: 'planning',
    context: 'improves prompts and coordinates delivery plans',
    strengths: 'planning,orchestration,prompt',
    skills: 'orchestration,planning,routing',
  });

  handleCommand({ name: 'new', args: ['Build TypeScript feature'] }, c.services);

  assert.equal(c.services.repos.tasks.findTask('TASK-0001')?.assignedTo, 'plan-agent');
  assert.deepEqual(c.assignedChannels, ['Planner:TASK-0001:#task-0001']);
  assert.match(c.sent.find((entry) => entry.target === '#control')?.text ?? '', /assigned plan-agent/);
});

test('planner prompt requires prompt improvement and feature plus QA alignment', () => {
  const prompt = buildAgentSystemPrompt({
    id: 'plan-agent',
    nick: 'Planner',
    role: 'planning',
    context: 'plans work before implementation',
    skills: 'orchestration,planning,routing',
  });

  assert.match(prompt, /improve the task prompt/i);
  assert.match(prompt, /feature/i);
  assert.match(prompt, /QA/i);
  assert.match(prompt, /match expectations/i);
});
