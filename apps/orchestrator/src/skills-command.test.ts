import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '@irc/db';
import { handleCommand, type CommandServices } from './commands.js';
import type { IrcClient } from './irc.js';

function setup() {
  const sent: { target: string; text: string }[] = [];
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
  };
  return { services, sent };
}

test('skills command lists every available skill with a description', () => {
  const c = setup();

  const result = handleCommand({ name: 'skills', args: [] }, c.services);

  assert.equal(result.handled, true);
  const reply = c.sent.at(-1)?.text ?? '';
  for (const skill of ['implementation', 'tdd', 'repo-editing', 'qa', 'testing', 'review', 'orchestration', 'planning', 'routing', 'research', 'docs', 'context', 'ops', 'logs', 'diagnostics']) {
    assert.match(reply, new RegExp(`${skill}:\\s+\\S`));
  }
});

test('skills command updates one agent with normalized catalog skills', () => {
  const c = setup();
  c.services.repos.agents.createAgent({ id: 'qa', nick: 'QaBot', role: 'qa', context: 'Reviews work' });

  handleCommand({ name: 'skills', args: ['qa', 'QA; testing,Review'] }, c.services);

  assert.equal(c.services.repos.agents.findAgent('qa')?.skills, 'qa,testing,review');
  assert.equal(c.sent.at(-1)?.text, 'Agent qa skills updated: qa,testing,review');
});

test('skills command rejects unknown skill ids', () => {
  const c = setup();
  c.services.repos.agents.createAgent({ id: 'qa', nick: 'QaBot', role: 'qa', context: 'Reviews work', skills: 'qa' });

  handleCommand({ name: 'skills', args: ['qa', 'qa,unknown'] }, c.services);

  assert.equal(c.services.repos.agents.findAgent('qa')?.skills, 'qa');
  assert.match(c.sent.at(-1)?.text ?? '', /Unknown skills: unknown/);
});
