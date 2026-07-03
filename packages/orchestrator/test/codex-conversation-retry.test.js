const test = require('node:test');
const assert = require('node:assert/strict');

const { handleLine } = require('../src/codex-bot');

test('restarts a channel thread when persisted context is missing', async () => {
  const socket = fakeSocket();
  const conversations = fakeConversations({ 'channel:#control': 'missing' });
  const codex = {
    calls: [],
    async generate(input) {
      this.calls.push(input);
      if (input.threadId === 'missing') throw new Error('thread not found: missing');
      return { threadId: 'fresh', text: 'ok' };
    },
  };

  await handleLine(socket, {
    nick: 'codex-agent',
    conversations,
    codex,
  }, ':eduardo PRIVMSG #control :@codex hello');

  assert.deepEqual(codex.calls, [
    { prompt: 'hello', threadId: 'missing' },
    { prompt: 'hello', threadId: undefined },
  ]);
  assert.deepEqual(conversations.saved, [
    { contextKey: 'channel:#control', threadId: 'fresh' },
  ]);
  assert.deepEqual(socket.writes, ['PRIVMSG #control :ok\r\n']);
});

function fakeSocket() {
  const writes = [];
  return { writes, write: (value) => writes.push(value) };
}

function fakeConversations(seed) {
  const saved = [];
  return {
    saved,
    findThread: (contextKey) => ({ contextKey, threadId: seed[contextKey] }),
    saveThread(contextKey, threadId) {
      saved.push({ contextKey, threadId });
    },
  };
}
