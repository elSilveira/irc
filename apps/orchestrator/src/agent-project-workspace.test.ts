import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentBot } from './agent-bot.js';

test('channel chat uses the workspace bound to that project channel', async () => {
  const contexts: unknown[] = [];
  const bot = new AgentBot({
    host: '127.0.0.1',
    port: 6667,
    agent: { id: 'feature', nick: 'FeatureImpl', role: 'implementer', context: 'implements code' },
    channels: ['#agents'],
    codex: { configured: false, generate: async () => ({ text: '', threadId: '' }) },
    conversations: {} as never,
    gateway: {} as never,
    workspace: 'C:/main/irc',
    workspaceForChannel: (channel) => channel.toLowerCase() === '#investments'
      ? 'C:\\Users\\duzit\\source\\inv'
      : 'C:/main/irc',
    brain: {
      async respond(_prompt, context) {
        contexts.push(context);
        return 'README summary';
      },
    },
  });
  const calls: string[] = [];
  (bot as unknown as { irc: { join: (channel: string) => void; privmsg: (target: string, text: string) => void } }).irc = {
    join: (channel) => calls.push(`join:${channel}`),
    privmsg: (target, text) => calls.push(`msg:${target}:${text}`),
  };

  await (bot as unknown as { handle(line: { command: string; prefix: string; params: string[] }): Promise<void> })
    .handle({ command: 'PRIVMSG', prefix: 'eduardo!u@h', params: ['#investments', '@FeatureImpl read the README'] });

  assert.deepEqual(contexts.at(-1), {
    contextKey: contexts.at(-1) && (contexts.at(-1) as { contextKey: string }).contextKey,
    sender: 'eduardo',
    channel: '#investments',
    workspace: 'C:\\Users\\duzit\\source\\inv',
  });
  assert.ok(calls.some((call) => call.startsWith('msg:#investments:') && call.includes('README summary')));
});
