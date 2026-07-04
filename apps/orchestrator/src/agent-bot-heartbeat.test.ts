import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentBot } from './agent-bot.js';

test('assignTaskChannel emits progress heartbeats while task work is pending', async () => {
  let finish!: (value: string) => void;
  const pending = new Promise<string>((resolve) => {
    finish = resolve;
  });
  const bot = new AgentBot({
    host: '127.0.0.1',
    port: 6667,
    agent: { id: 'feature', nick: 'FeatureImpl', role: 'implementer', context: 'implements code' },
    channels: ['#agents'],
    codex: { configured: false, generate: async () => ({ text: '', threadId: '' }) },
    conversations: {} as never,
    gateway: {} as never,
    workspace: '.',
    taskHeartbeatMs: 5,
    brain: {
      async respond() {
        return pending;
      },
    },
  });
  const calls: string[] = [];
  (bot as unknown as { irc: { join: (channel: string) => void; privmsg: (target: string, text: string) => void } }).irc = {
    join: (channel) => calls.push(`join:${channel}`),
    privmsg: (target, text) => calls.push(`msg:${target}:${text}`),
  };

  bot.assignTaskChannel({ id: 'TASK-0007', title: 'Long task', channel: '#task-0007' });
  await new Promise((resolve) => setTimeout(resolve, 20));
  finish('[task:TASK-0007] [type:result] done\n[task:TASK-0007] [type:rdt] ready for QA');
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(
    calls.some((call) => call.includes('[task:TASK-0007] [type:wip] still working')),
    true,
  );
  assert.ok(calls.includes('msg:#task-0007:[task:TASK-0007] [type:result] done'));
});
