import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentBot, buildAgentSystemPrompt, buildAgentTurn } from './agent-bot.js';

test('agent prompt includes role context and repo tools', () => {
  const prompt = buildAgentSystemPrompt({
    id: 'readme-agent',
    nick: 'readme-agent',
    role: 'researcher',
    context: 'Reads repository docs for IRC users.',
  });

  assert.match(prompt, /readme-agent/);
  assert.match(prompt, /researcher/);
  assert.match(prompt, /Reads repository docs/);
  assert.match(prompt, /read_file/);
  assert.match(prompt, /write_file/);
  assert.match(prompt, /run_verification/);
  assert.match(prompt, /IRC_TOOL/);
  assert.match(prompt, /Task lifecycle protocol/);
  assert.match(prompt, /\[type:ack\]/);
});

test('buildAgentTurn keeps channel replies on the referenced chain', () => {
  const turn = buildAgentTurn({
    agentNick: 'worker',
    sender: 'lead',
    target: '#control',
    text: '@worker [chain:abc123ef] continue the task',
  });

  assert.equal(turn?.chainRef, 'abc123ef');
  assert.equal(turn?.replyTarget, '#control');
  assert.equal(turn?.contextKey, 'agent:worker:channel:#control:chain:abc123ef');
  assert.match(turn?.prompt ?? '', /\[chain:abc123ef\]/);
});

test('buildAgentTurn removes channel mention from the framed prompt', () => {
  const turn = buildAgentTurn({
    agentNick: 'worker',
    sender: 'lead',
    target: '#control',
    text: '@worker please continue',
  });

  assert.match(turn?.prompt ?? '', /\nplease continue$/);
  assert.doesNotMatch(turn?.prompt ?? '', /@worker please/);
});

test('buildAgentTurn creates a chain for direct messages without one', () => {
  const turn = buildAgentTurn({
    agentNick: 'worker',
    sender: 'lead',
    target: 'worker',
    text: 'please check status',
  });

  assert.match(turn?.chainRef ?? '', /^[a-f0-9]{12}$/);
  assert.equal(turn?.replyTarget, 'lead');
  assert.match(turn?.contextKey ?? '', /^agent:worker:dm:lead:chain:/);
  assert.match(turn?.prompt ?? '', /include \[chain:/);
});

test('assignTaskChannel joins and reports assignment in the task channel', () => {
  const responses: string[] = [];
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
        responses.push(prompt);
        return '[task:TASK-0007] [type:wip] started';
      },
    },
  });
  const calls: string[] = [];
  (bot as unknown as { irc: { join: (channel: string) => void; privmsg: (target: string, text: string) => void } }).irc = {
    join: (channel) => calls.push(`join:${channel}`),
    privmsg: (target, text) => calls.push(`msg:${target}:${text}`),
  };

  bot.assignTaskChannel({ id: 'TASK-0007', title: 'Live task', channel: '#task-0007' });

  assert.deepEqual(calls, [
    'join:#task-0007',
    'msg:#task-0007:[task:TASK-0007] [type:ack] FeatureImpl assigned: Live task',
  ]);
  assert.match(responses[0] ?? '', /TASK-0007/);
  assert.match(responses[0] ?? '', /Use IRC_TOOL write_file/);
});

test('assignTaskChannel reports agent work output in the task channel', async () => {
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
      async respond() {
        return '[task:TASK-0007] [type:wip] started';
      },
    },
  });
  const calls: string[] = [];
  (bot as unknown as { irc: { join: (channel: string) => void; privmsg: (target: string, text: string) => void } }).irc = {
    join: (channel) => calls.push(`join:${channel}`),
    privmsg: (target, text) => calls.push(`msg:${target}:${text}`),
  };

  bot.assignTaskChannel({ id: 'TASK-0007', title: 'Live task', channel: '#task-0007' });
  await new Promise((resolve) => setImmediate(resolve));

  assert.ok(calls.includes('msg:#task-0007:[task:TASK-0007] [type:wip] started'));
});
