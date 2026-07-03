const test = require('node:test');
const assert = require('node:assert/strict');

const { routeCodexMessage } = require('../src/message-router');

test('routes prefixed channel messages to the channel context', () => {
  assert.deepEqual(routeCodexMessage({
    botNick: 'codex-agent',
    sender: 'eduardo',
    target: '#control',
    text: '@codex status',
  }), {
    ok: true,
    contextKey: 'channel:#control',
    prompt: 'status',
    isLogin: false,
  });
});

test('routes direct messages to the sender context', () => {
  assert.equal(routeCodexMessage({
    botNick: 'codex-agent',
    sender: 'eduardo',
    target: 'codex-agent',
    text: 'hello',
  }).contextKey, 'dm:eduardo');
});

test('routes prefixed direct messages to the sender context', () => {
  assert.deepEqual(routeCodexMessage({
    botNick: 'codex-agent',
    sender: 'eduardo',
    target: 'codex-agent',
    text: '@codex status',
  }), {
    ok: true,
    contextKey: 'dm:eduardo',
    prompt: 'status',
    isLogin: false,
  });
});

test('marks login prompts as login requests', () => {
  assert.equal(routeCodexMessage({
    botNick: 'codex-agent',
    sender: 'eduardo',
    target: '#control',
    text: '@codex login',
  }).isLogin, true);
});

test('does not mark non-login prompts as login requests', () => {
  assert.equal(routeCodexMessage({
    botNick: 'codex-agent',
    sender: 'eduardo',
    target: '#control',
    text: '@codex login please',
  }).isLogin, false);

  assert.equal(routeCodexMessage({
    botNick: 'codex-agent',
    sender: 'eduardo',
    target: '#control',
    text: '@codex status',
  }).isLogin, false);
});

test('ignores unprefixed channel messages', () => {
  assert.deepEqual(routeCodexMessage({
    botNick: 'codex-agent',
    sender: 'eduardo',
    target: '#control',
    text: 'hello',
  }), { ok: false });
});
