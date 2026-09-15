import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '@irc/db';
import { handleCommand, type CommandServices } from './commands.js';
import type { IrcClient } from './irc.js';

function setup() {
  const sent: { target: string; text: string }[] = [];
  const agentJoins: string[] = [];
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
      joinChannel: (nick, channel) => {
        agentJoins.push(`${nick}:${channel}`);
        return true;
      },
    },
  };
  return { services, sent, agentJoins };
}

test('agent create stores channels and joins the new agent to them', () => {
  const c = setup();

  const result = handleCommand({
    name: 'agent',
    args: ['create', 'docs', '--nick', 'DocsBot', '--role', 'docs', '--context', 'Writes docs', '--skills', 'docs,context', '--channels', '#docs,#review'],
  }, c.services);

  assert.equal(result.handled, true);
  assert.equal(c.services.repos.agents.findAgent('docs')?.channels, '#docs,#review');
  assert.deepEqual(c.agentJoins, ['DocsBot:#docs', 'DocsBot:#review']);
  assert.match(c.sent.at(-1)?.text ?? '', /Agent docs created/);
  assert.match(c.sent.at(-1)?.text ?? '', /channels=#docs,#review/);
});

test('agent create normalizes semicolon and comma separated skills', () => {
  const c = setup();

  handleCommand({
    name: 'agent',
    args: ['create', 'qa', '--nick', 'QaBot', '--role', 'qa', '--context', 'Reviews changes', '--skills', 'QA; testing,Review'],
  }, c.services);

  assert.equal(c.services.repos.agents.findAgent('qa')?.skills, 'qa,testing,review');
  assert.match(c.sent.at(-1)?.text ?? '', /skills=qa,testing,review/);
});

test('agent create rejects skills outside the shared catalog', () => {
  const c = setup();

  handleCommand({
    name: 'agent',
    args: ['create', 'bad', '--nick', 'BadBot', '--role', 'qa', '--context', 'Reviews changes', '--skills', 'qa,unknown'],
  }, c.services);

  assert.equal(c.services.repos.agents.findAgent('bad'), null);
  assert.match(c.sent.at(-1)?.text ?? '', /Unknown skills: unknown/);
});

test('agent update edits skills, prompt context, and channel membership', () => {
  const c = setup();
  c.services.repos.agents.createAgent({ id: 'qa', nick: 'QaBot', role: 'qa', context: 'old' });

  handleCommand({
    name: 'agent',
    args: ['update', 'qa', '--context', 'Reviews changes', '--skills', 'qa;testing', '--channels', '#qa,#review'],
  }, c.services);

  const updated = c.services.repos.agents.findAgent('qa');
  assert.equal(updated?.context, 'Reviews changes');
  assert.equal(updated?.skills, 'qa,testing');
  assert.equal(updated?.channels, '#qa,#review');
  assert.deepEqual(c.agentJoins, ['QaBot:#qa', 'QaBot:#review']);
});

test('agent delete removes an agent by id', () => {
  const c = setup();
  c.services.repos.agents.createAgent({ id: 'qa', nick: 'QaBot', role: 'qa', context: 'Reviews work' });

  handleCommand({ name: 'agent', args: ['delete', 'qa'] }, c.services);

  assert.equal(c.services.repos.agents.findAgent('qa'), null);
  assert.equal(c.sent.at(-1)?.text, 'Agent qa deleted.');
});

test('agent delete reports missing agents', () => {
  const c = setup();

  handleCommand({ name: 'agent', args: ['delete', 'missing'] }, c.services);

  assert.equal(c.sent.at(-1)?.text, 'Agent missing not found.');
});

test('agents lists editable config fields for modal refreshes', () => {
  const c = setup();
  c.services.repos.agents.createAgent({ id: 'feature', nick: 'FeatureBot', role: 'impl', context: 'Implements features', skills: 'implementation', channels: '#implementation' });

  handleCommand({ name: 'agents', args: [] }, c.services);

  const text = c.sent.at(-1)?.text ?? '';
  assert.match(text, /feature nick=FeatureBot role=impl/);
  assert.match(text, /channels=#implementation/);
  assert.match(text, /skills=implementation/);
  assert.match(text, /context="Implements features"/);
});
