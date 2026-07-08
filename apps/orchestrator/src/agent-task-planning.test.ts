import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentBot } from './agent-bot.js';

test('assigned task prompt requires planning before implementation work', () => {
  const prompts: string[] = [];
  const bot = new AgentBot({
    host: '127.0.0.1',
    port: 6667,
    agent: { id: 'feature', nick: 'FeatureImpl', role: 'implementer', context: 'implements code' },
    channels: ['#agents'],
    codex: { configured: false, generate: async () => ({ text: '', threadId: '' }) },
    conversations: {} as never,
    gateway: {} as never,
    workspace: '.',
    brain: {
      async respond(prompt) {
        prompts.push(prompt);
        return '[task:TASK-0012] [type:rdt] ready for QA';
      },
    },
  });
  (bot as unknown as { irc: { join: (channel: string) => void; privmsg: (target: string, text: string) => void } }).irc = {
    join: () => {},
    privmsg: () => {},
  };

  bot.assignTaskChannel({ id: 'TASK-0012', title: 'Build feature', channel: '#task-0012' });

  assert.match(prompts[0] ?? '', /improve the task prompt before feature or implementation work/i);
  assert.match(prompts[0] ?? '', /coordinate with feature and QA agents/i);
  assert.match(prompts[0] ?? '', /before code edits/i);
});
