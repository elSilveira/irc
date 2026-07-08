import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '@irc/db';
import { handleCommand, type CommandServices } from './commands.js';
import type { IrcClient } from './irc.js';

function setup(channel = '#client-a') {
  const sent: { target: string; text: string }[] = [];
  const joined: string[] = [];
  const irc = {
    privmsg: (target: string, text: string) => sent.push({ target, text }),
    join: (target: string) => joined.push(target),
    send: () => {},
  } as unknown as IrcClient;
  const services: CommandServices = {
    irc,
    repos: createRepositories(':memory:'),
    nick: 'orchestrator',
    channels: [channel],
  };
  return { services, sent, joined };
}

test('project connect maps current channel to a workspace', () => {
  const c = setup('#client-a');

  const result = handleCommand({ name: 'project', args: ['connect', 'client-a', 'C:/work/client-a'] }, c.services);

  assert.equal(result.handled, true);
  assert.deepEqual(c.services.repos.projects.findByChannel('#client-a'), {
    channel: '#client-a',
    name: 'client-a',
    workspace: 'C:/work/client-a',
  });
  assert.deepEqual(c.sent.at(-1), { target: '#client-a', text: '#client-a connected to project client-a at C:/work/client-a.' });
});

test('project connect maps an explicit channel and preserves a quoted Windows path', () => {
  const c = setup('#control');

  const result = handleCommand({
    name: 'project',
    args: ['connect', '#investments', 'C:\\Users\\duzit\\source\\inv'],
  }, c.services);

  assert.equal(result.handled, true);
  assert.deepEqual(c.services.repos.projects.findByChannel('#investments'), {
    channel: '#investments',
    name: 'investments',
    workspace: 'C:\\Users\\duzit\\source\\inv',
  });
  assert.deepEqual(c.joined, ['#investments']);
  assert.deepEqual(c.sent.at(-1), {
    target: '#control',
    text: '#investments connected to project investments at C:\\Users\\duzit\\source\\inv.',
  });
});

test('join brings one managed agent into a project channel', () => {
  const c = setup('#control');
  const joinedAgents: string[] = [];
  c.services.repos.projects.connectChannelProject({
    channel: '#investments',
    name: 'investments',
    workspace: 'C:\\Users\\duzit\\source\\inv',
  });
  c.services.repos.agents.createAgent({ id: 'feature', nick: 'FeatureImpl', role: 'feature', context: 'implements' });
  c.services.agentSupervisor = {
    joinChannel(nick, channel, workspace) {
      joinedAgents.push(`${nick}:${channel}:${workspace}`);
      return true;
    },
  };

  handleCommand({ name: 'join', args: ['#investments', 'feature'] }, c.services);

  assert.deepEqual(c.joined, ['#investments']);
  assert.deepEqual(joinedAgents, ['FeatureImpl:#investments:C:\\Users\\duzit\\source\\inv']);
  assert.equal(c.sent.at(-1)?.text, 'Joined FeatureImpl to #investments.');
});

test('join all brings every managed agent into a project channel', () => {
  const c = setup('#control');
  const joinedAgents: string[] = [];
  c.services.repos.projects.connectChannelProject({ channel: '#investments', name: 'investments', workspace: 'C:/inv' });
  c.services.repos.agents.createAgent({ id: 'plan', nick: 'Planner', role: 'planner', context: 'plans' });
  c.services.repos.agents.createAgent({ id: 'feature', nick: 'FeatureImpl', role: 'feature', context: 'implements' });
  c.services.agentSupervisor = {
    joinChannel(nick, channel, workspace) {
      joinedAgents.push(`${nick}:${channel}:${workspace}`);
      return true;
    },
  };

  handleCommand({ name: 'join', args: ['#investments', 'all'] }, c.services);

  assert.deepEqual(joinedAgents, ['Planner:#investments:C:/inv', 'FeatureImpl:#investments:C:/inv']);
  assert.equal(c.sent.at(-1)?.text, 'Joined 2 agents to #investments.');
});

test('projects lists mapped project channels', () => {
  const c = setup('#control');
  c.services.repos.projects.connectChannelProject({ channel: '#client-a', name: 'client-a', workspace: 'C:/work/client-a' });

  handleCommand({ name: 'projects', args: [] }, c.services);

  assert.equal(c.sent.at(-1)?.text, 'Projects: #client-a=client-a (C:/work/client-a)');
});

test('new creates task channel with project workspace from source channel', () => {
  const c = setup('#client-a');
  c.services.repos.projects.connectChannelProject({ channel: '#client-a', name: 'client-a', workspace: 'C:/work/client-a' });

  handleCommand({ name: 'new', args: ['Ship client feature'] }, c.services);

  const task = c.services.repos.tasks.findTask('TASK-0001');
  assert.equal(task?.projectChannel, '#client-a');
  assert.equal(task?.workspace, 'C:/work/client-a');
  assert.deepEqual(c.joined, ['#task-0001']);
});
