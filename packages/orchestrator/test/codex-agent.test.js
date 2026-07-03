const test = require('node:test');
const assert = require('node:assert/strict');

const { createCodexReply } = require('../src/codex-agent');

test('ignores messages not addressed to codex', () => {
  assert.equal(createCodexReply({ text: '@orc status' }), null);
});

test('responds with status', () => {
  const reply = createCodexReply({ text: '@codex status' });

  assert.match(reply, /codex-agent online/);
  assert.match(reply, /chat-only/);
});

test('responds with help', () => {
  const reply = createCodexReply({ text: '@codex help' });

  assert.match(reply, /@codex status/);
  assert.match(reply, /@codex echo/);
});

test('echoes text for connectivity checks', () => {
  assert.equal(createCodexReply({ text: '@codex echo hello irc' }), 'hello irc');
});
