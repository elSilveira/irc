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
